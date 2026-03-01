/**
 * Gmail Sync Service
 * Gmail API ile e-posta senkronizasyonu
 */

import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { refreshGoogleToken, isTokenExpired } from '@/lib/email/oauth/google';
import type { email_oauth_connections, Prisma } from '@prisma/client';
type EmailOAuthConnection = email_oauth_connections;

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Son 30 gün
const INITIAL_SYNC_DAYS = 30;
// Bir seferde çekilecek maksimum e-posta
const MAX_RESULTS = 50;

interface GmailAttachmentPart {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
    size?: number;
    attachmentId?: string;
  };
  parts?: GmailAttachmentPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailAttachmentPart[];
  };
  internalDate?: string;
}

interface AttachmentMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
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

  const tokens = await refreshGoogleToken(connection.refreshToken);

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
 * Fetch Gmail message list
 */
async function fetchGmailMessageList(
  accessToken: string,
  query?: string,
  pageToken?: string
): Promise<GmailListResponse> {
  const params = new URLSearchParams({
    maxResults: MAX_RESULTS.toString(),
    labelIds: 'INBOX',
  });

  if (query) params.append('q', query);
  if (pageToken) params.append('pageToken', pageToken);

  const response = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Gmail Sync] Failed to fetch message list:', error);
    throw new Error('Failed to fetch Gmail messages');
  }

  return response.json();
}

/**
 * Fetch single Gmail message details
 */
async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch message ${messageId}`);
  }

  return response.json();
}

/**
 * Parse Gmail message headers
 */
function parseHeaders(headers?: Array<{ name: string; value: string }>) {
  const result: Record<string, string> = {};
  headers?.forEach((h) => {
    result[h.name.toLowerCase()] = h.value;
  });
  return result;
}

/**
 * Parse email address from header
 */
function parseEmailAddress(header?: string): { email: string; name?: string } {
  if (!header) return { email: '' };

  // Format: "Name <email@domain.com>" or "email@domain.com"
  const match = header.match(/^(?:([^<]*?)\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2],
    };
  }
  return { email: header };
}

/**
 * Parse multiple email addresses from header
 */
function parseEmailAddresses(header?: string): string[] {
  if (!header) return [];
  return header.split(',').map((addr) => {
    const parsed = parseEmailAddress(addr.trim());
    return parsed.email;
  });
}

/**
 * Decode Base64 URL-safe encoded string
 */
function decodeBase64Url(data: string): string {
  try {
    // URL-safe base64 to standard base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Extract body from Gmail message
 */
function extractBody(payload?: GmailMessage['payload']): { html?: string; text?: string } {
  if (!payload) return {};

  // Simple message
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      return { html: decoded };
    }
    return { text: decoded };
  }

  // Multipart message
  let html: string | undefined;
  let text: string | undefined;

  function extractFromParts(parts?: GmailAttachmentPart[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  extractFromParts(payload.parts);
  return { html, text };
}

/**
 * Extract attachments metadata from Gmail message
 */
function extractAttachments(payload?: GmailMessage['payload']): AttachmentMetadata[] {
  if (!payload?.parts) return [];

  const attachments: AttachmentMetadata[] = [];

  function extractFromParts(parts: GmailAttachmentPart[]) {
    for (const part of parts) {
      // Ek olarak kabul edilen MIME tipleri
      const isAttachment =
        part.body?.attachmentId &&
        part.filename &&
        part.filename.length > 0;

      if (isAttachment) {
        attachments.push({
          id: part.body!.attachmentId!,
          name: part.filename!,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body?.size || 0,
        });
      }

      // İç içe parts varsa recursive olarak kontrol et
      if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  extractFromParts(payload.parts);
  return attachments;
}

/**
 * Convert Gmail message to database format
 */
function convertGmailMessage(
  message: GmailMessage,
  connectionId: string,
  tenantId: string
): Prisma.email_messagesCreateInput {
  const headers = parseHeaders(message.payload?.headers);
  const from = parseEmailAddress(headers.from);
  const body = extractBody(message.payload);

  // Extract attachment metadata
  const attachments = extractAttachments(message.payload);
  const hasAttachments = attachments.length > 0;

  return {
    provider: 'gmail',
    providerId: message.id,
    messageId: headers['message-id'] || message.id,
    threadId: message.threadId,
    fromEmail: from.email,
    fromName: from.name,
    toEmails: parseEmailAddresses(headers.to),
    ccEmails: parseEmailAddresses(headers.cc),
    subject: headers.subject || '(Konu yok)',
    snippet: message.snippet,
    bodyHtml: body.html,
    bodyText: body.text,
    isRead: !message.labelIds?.includes('UNREAD'),
    isStarred: message.labelIds?.includes('STARRED') ?? false,
    labelIds: message.labelIds || [],
    folder: 'inbox',
    hasAttachments,
    attachments: hasAttachments ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
    receivedAt: message.internalDate
      ? new Date(parseInt(message.internalDate))
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

    // Query for last 30 days
    const after = Math.floor(
      (Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000) / 1000
    );
    const query = `after:${after}`;

    let synced = 0;
    let pageToken: string | undefined;

    do {
      const list = await fetchGmailMessageList(accessToken, query, pageToken);

      if (list.messages) {
        for (const msg of list.messages) {
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
              const fullMessage = await fetchGmailMessage(accessToken, msg.id);
              const data = convertGmailMessage(
                fullMessage,
                connection.id,
                connection.tenantId
              );
              await prisma.email_messages.create({ data });
              synced++;
            }
          } catch (err) {
            console.error(`[Gmail Sync] Failed to sync message ${msg.id}:`, err);
          }
        }
      }

      pageToken = list.nextPageToken;
    } while (pageToken);

    // Update sync status
    await prisma.email_oauth_connections.update({
      where: { id: connection.id },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
      },
    });

    console.log(`[Gmail Sync] Initial sync completed: ${synced} messages`);
    return { success: true, synced };
  } catch (error) {
    console.error('[Gmail Sync] Initial sync failed:', error);

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

    // Get latest email date
    const latestEmail = await prisma.email_messages.findFirst({
      where: { connectionId: connection.id },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });

    // Query for emails after last sync
    const after = latestEmail?.receivedAt
      ? Math.floor(latestEmail.receivedAt.getTime() / 1000 - 60) // 1 dakika tampon
      : Math.floor((Date.now() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000) / 1000);

    const query = `after:${after}`;

    let synced = 0;
    const list = await fetchGmailMessageList(accessToken, query);

    if (list.messages) {
      for (const msg of list.messages) {
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
            const fullMessage = await fetchGmailMessage(accessToken, msg.id);
            const data = convertGmailMessage(
              fullMessage,
              connection.id,
              connection.tenantId
            );
            await prisma.email_messages.create({ data });
            synced++;
          }
        } catch (err) {
          console.error(`[Gmail Sync] Failed to sync message ${msg.id}:`, err);
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

    console.log(`[Gmail Sync] Delta sync completed: ${synced} new messages`);
    return { success: true, synced };
  } catch (error) {
    console.error('[Gmail Sync] Delta sync failed:', error);

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
export async function syncGmailConnection(connection: EmailOAuthConnection): Promise<{
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
