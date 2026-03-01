/**
 * Outlook Sync Service
 * Microsoft Graph API ile e-posta senkronizasyonu
 */

import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { refreshMicrosoftToken, isTokenExpired } from '@/lib/email/oauth/microsoft';
import type { email_oauth_connections, Prisma } from '@prisma/client';
type EmailOAuthConnection = email_oauth_connections;

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me';

// Son 30 gün
const INITIAL_SYNC_DAYS = 30;
// Bir seferde çekilecek maksimum e-posta
const MAX_RESULTS = 50;

interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline?: boolean;
}

interface OutlookAttachmentsResponse {
  value?: OutlookAttachment[];
}

interface AttachmentMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

interface OutlookMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  from?: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  isRead?: boolean;
  receivedDateTime?: string;
  hasAttachments?: boolean;
  flag?: {
    flagStatus: string;
  };
}

interface OutlookListResponse {
  value?: OutlookMessage[];
  '@odata.nextLink'?: string;
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidAccessToken(connection: EmailOAuthConnection): Promise<string> {
  if (!isTokenExpired(connection.expiresAt)) {
    return decrypt(connection.accessToken);
  }

  // Token expired, refresh it
  if (!connection.refreshToken) {
    throw new Error('No refresh token available');
  }

  const tokens = await refreshMicrosoftToken(connection.refreshToken);

  // Update tokens in database
  await prisma.email_oauth_connections.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? encrypt(tokens.refreshToken)
        : connection.refreshToken,
      expiresAt: tokens.expiresAt,
    },
  });

  return tokens.accessToken;
}

/**
 * Check if user has an Outlook mailbox
 */
async function checkMailboxExists(accessToken: string): Promise<{ exists: boolean; email?: string; error?: string }> {
  try {
    // Get user profile (without mailboxSettings which requires extra permissions)
    const userResponse = await fetch(`${GRAPH_API_BASE}?$select=mail,userPrincipalName,displayName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('[Outlook Sync] User API response status:', userResponse.status);

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Outlook Sync] User API error:', errorText);
      return { exists: false, error: `Kullanıcı bilgisi alınamadı: ${userResponse.status}` };
    }

    const userData = await userResponse.json();
    console.log('[Outlook Sync] User data:', JSON.stringify(userData, null, 2));

    // Check if user has a mailbox by trying to access mailFolders
    const mailFoldersResponse = await fetch(`${GRAPH_API_BASE}/mailFolders?$top=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('[Outlook Sync] MailFolders API response status:', mailFoldersResponse.status);

    if (!mailFoldersResponse.ok) {
      const errorData = await mailFoldersResponse.text();
      console.error('[Outlook Sync] Mailbox check failed:', errorData);

      // MailboxNotEnabledForRESTAPI or ResourceNotFound means no mailbox
      if (errorData.includes('MailboxNotEnabledForRESTAPI') ||
          errorData.includes('ResourceNotFound') ||
          errorData.includes('MailboxNotHostedOnThisForest')) {
        return {
          exists: false,
          email: userData.userPrincipalName,
          error: `Bu hesabın (${userData.userPrincipalName}) Outlook posta kutusu bulunmuyor. Lütfen @outlook.com, @hotmail.com veya Office 365 hesabı kullanın.`
        };
      }
      return { exists: false, error: `Posta kutusu kontrol edilemedi: ${mailFoldersResponse.status}` };
    }

    return { exists: true, email: userData.mail || userData.userPrincipalName };
  } catch (error) {
    console.error('[Outlook Sync] Mailbox check error:', error);
    return { exists: false, error: `Posta kutusu kontrol hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` };
  }
}

/**
 * Fetch Outlook messages from inbox
 */
async function fetchOutlookMessages(
  accessToken: string,
  filter?: string,
  nextLink?: string
): Promise<OutlookListResponse> {
  let url = nextLink;

  if (!url) {
    const params = new URLSearchParams({
      $top: MAX_RESULTS.toString(),
      $orderby: 'receivedDateTime desc',
      $select: 'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,isRead,receivedDateTime,hasAttachments,flag',
    });

    if (filter) {
      params.append('$filter', filter);
    }

    url = `${GRAPH_API_BASE}/mailFolders/inbox/messages?${params}`;
  }

  console.log('[Outlook Sync] Fetching from URL:', url);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  console.log('[Outlook Sync] Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('[Outlook Sync] Failed to fetch messages:', error);
    throw new Error(`Failed to fetch Outlook messages: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[Outlook Sync] Messages count:', data.value?.length || 0);
  return data;
}

/**
 * Fetch attachments for a specific message
 */
async function fetchOutlookAttachments(
  accessToken: string,
  messageId: string
): Promise<AttachmentMetadata[]> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error(`[Outlook Sync] Failed to fetch attachments for message ${messageId}`);
      return [];
    }

    const data: OutlookAttachmentsResponse = await response.json();

    // Filter out inline attachments (images embedded in HTML)
    return (data.value || [])
      .filter((att) => !att.isInline)
      .map((att) => ({
        id: att.id,
        name: att.name,
        mimeType: att.contentType,
        size: att.size,
      }));
  } catch (error) {
    console.error(`[Outlook Sync] Error fetching attachments:`, error);
    return [];
  }
}

/**
 * Convert Outlook message to database format
 */
function convertOutlookMessage(
  message: OutlookMessage,
  connectionId: string,
  tenantId: string,
  attachments?: AttachmentMetadata[]
): Prisma.email_messagesCreateInput {
  const toEmails = message.toRecipients?.map((r) => r.emailAddress.address) || [];
  const ccEmails = message.ccRecipients?.map((r) => r.emailAddress.address) || [];
  const hasAttachments = attachments && attachments.length > 0;

  return {
    provider: 'outlook',
    providerId: message.id,
    messageId: message.internetMessageId || message.id,
    threadId: message.conversationId,
    fromEmail: message.from?.emailAddress.address || '',
    fromName: message.from?.emailAddress.name,
    toEmails,
    ccEmails,
    subject: message.subject || '(Konu yok)',
    snippet: message.bodyPreview,
    bodyHtml: message.body?.contentType === 'html' ? message.body.content : undefined,
    bodyText: message.body?.contentType === 'text' ? message.body.content : undefined,
    isRead: message.isRead ?? false,
    isStarred: message.flag?.flagStatus === 'flagged',
    labelIds: [],
    folder: 'inbox',
    hasAttachments: hasAttachments ?? false,
    attachments: hasAttachments ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
    receivedAt: message.receivedDateTime
      ? new Date(message.receivedDateTime)
      : new Date(),
    email_oauth_connections: { connect: { id: connectionId } },
    tenants: { connect: { id: tenantId } },
  };
}

/**
 * Initial sync - fetch last 30 days of emails
 */
export async function initialSync(connection: EmailOAuthConnection): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    // Update sync status
    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: { syncStatus: 'syncing', syncError: null },
    });

    const accessToken = await getValidAccessToken(connection);

    // Check if mailbox exists before syncing
    const mailboxCheck = await checkMailboxExists(accessToken);
    if (!mailboxCheck.exists) {
      console.error('[Outlook Sync] Mailbox not found:', mailboxCheck.error);

      // Update connection with error
      await prisma.email_oauth_connections.update({
        where: { id: connection.id },
        data: {
          syncStatus: 'error',
          syncError: mailboxCheck.error || 'Bu hesabın Outlook posta kutusu bulunmuyor',
        },
      });

      return {
        success: false,
        synced: 0,
        error: mailboxCheck.error || 'Bu hesabın Outlook posta kutusu bulunmuyor. Lütfen @outlook.com, @hotmail.com veya Office 365 hesabı kullanın.',
      };
    }

    // Filter for last 30 days
    const afterDate = new Date(Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);
    const filter = `receivedDateTime ge ${afterDate.toISOString()}`;

    let synced = 0;
    let nextLink: string | undefined;

    do {
      const response = await fetchOutlookMessages(accessToken, filter, nextLink);

      if (response.value) {
        for (const msg of response.value) {
          try {
            // Check if already exists
            const exists = await prisma.email_messages.findUnique({
              where: {
                connectionId_providerId: {
                  connectionId: connection.id,
                  providerId: msg.id,
                },
              },
            });

            if (!exists) {
              // Eki olan mesajlar için attachment metadata çek
              let attachments: AttachmentMetadata[] | undefined;
              if (msg.hasAttachments) {
                attachments = await fetchOutlookAttachments(accessToken, msg.id);
              }

              const data = convertOutlookMessage(msg, connection.id, connection.tenantId, attachments);
              await prisma.email_messages.create({ data });
              synced++;
            }
          } catch (err) {
            console.error(`[Outlook Sync] Failed to sync message ${msg.id}:`, err);
          }
        }
      }

      nextLink = response['@odata.nextLink'];
    } while (nextLink);

    // Update sync status
    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
      },
    });

    console.log(`[Outlook Sync] Initial sync completed: ${synced} messages`);
    return { success: true, synced };
  } catch (error) {
    console.error('[Outlook Sync] Initial sync failed:', error);

    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: {
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      synced: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delta sync - fetch only new emails
 */
export async function deltaSync(connection: EmailOAuthConnection): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    // Update sync status
    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: { syncStatus: 'syncing', syncError: null },
    });

    const accessToken = await getValidAccessToken(connection);

    // Check if mailbox exists before syncing
    const mailboxCheck = await checkMailboxExists(accessToken);
    if (!mailboxCheck.exists) {
      console.error('[Outlook Sync] Mailbox not found:', mailboxCheck.error);

      // Update connection with error
      await prisma.email_oauth_connections.update({
        where: { id: connection.id },
        data: {
          syncStatus: 'error',
          syncError: mailboxCheck.error || 'Bu hesabın Outlook posta kutusu bulunmuyor',
        },
      });

      return {
        success: false,
        synced: 0,
        error: mailboxCheck.error || 'Bu hesabın Outlook posta kutusu bulunmuyor. Lütfen @outlook.com, @hotmail.com veya Office 365 hesabı kullanın.',
      };
    }

    // Get latest email date
    const latestEmail = await prisma.email_messages.findFirst({
      where: { connectionId: connection.id },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });

    // Filter for emails after last sync
    const afterDate = latestEmail?.receivedAt
      ? new Date(latestEmail.receivedAt.getTime() - 60000) // 1 dakika tampon
      : new Date(Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);

    const filter = `receivedDateTime ge ${afterDate.toISOString()}`;

    let synced = 0;
    const response = await fetchOutlookMessages(accessToken, filter);

    if (response.value) {
      for (const msg of response.value) {
        try {
          // Check if already exists
          const exists = await prisma.email_messages.findUnique({
            where: {
              connectionId_providerId: {
                connectionId: connection.id,
                providerId: msg.id,
              },
            },
          });

          if (!exists) {
            // Eki olan mesajlar için attachment metadata çek
            let attachments: AttachmentMetadata[] | undefined;
            if (msg.hasAttachments) {
              attachments = await fetchOutlookAttachments(accessToken, msg.id);
            }

            const data = convertOutlookMessage(msg, connection.id, connection.tenantId, attachments);
            await prisma.email_messages.create({ data });
            synced++;
          }
        } catch (err) {
          console.error(`[Outlook Sync] Failed to sync message ${msg.id}:`, err);
        }
      }
    }

    // Update sync status
    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
      },
    });

    console.log(`[Outlook Sync] Delta sync completed: ${synced} new messages`);
    return { success: true, synced };
  } catch (error) {
    console.error('[Outlook Sync] Delta sync failed:', error);

    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: {
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      synced: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync a connection (initial or delta based on last sync)
 */
export async function syncOutlookConnection(connection: EmailOAuthConnection): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  // If never synced before, do initial sync
  if (!connection.lastSyncAt) {
    return initialSync(connection);
  }

  // Otherwise do delta sync
  return deltaSync(connection);
}
