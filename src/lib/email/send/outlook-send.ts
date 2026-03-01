/**
 * Microsoft Graph API ile Outlook mail gönderme
 * OAuth token kullanarak Outlook üzerinden mail gönderir
 */

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  mimeType: string;
}

interface SendEmailParams {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Microsoft Graph API ile mail gönder
 */
export async function sendOutlookEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { accessToken, to, subject, body, attachments = [] } = params;

  try {
    // Microsoft Graph API message format
    const message: {
      message: {
        subject: string;
        body: { contentType: string; content: string };
        toRecipients: { emailAddress: { address: string } }[];
        attachments?: {
          '@odata.type': string;
          name: string;
          contentType: string;
          contentBytes: string;
        }[];
      };
      saveToSentItems: boolean;
    } = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    // Attachment'ları ekle
    if (attachments.length > 0) {
      message.message.attachments = attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.mimeType,
        contentBytes: att.content,
      }));
    }

    // Microsoft Graph API'ye gönder
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Outlook Send] API Error:', response.status, errorData);

      if (response.status === 401) {
        return { success: false, error: 'Token süresi dolmuş. Lütfen hesabı yeniden bağlayın.' };
      }

      return {
        success: false,
        error: errorData.error?.message || `Microsoft Graph API hatası: ${response.status}`
      };
    }

    // sendMail endpoint'i başarılı olursa 202 Accepted döner, body boş
    console.log('[Outlook Send] Success');
    return { success: true, messageId: `outlook_${Date.now()}` };

  } catch (error) {
    console.error('[Outlook Send] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mail gönderme hatası'
    };
  }
}

/**
 * Access token'ın geçerli olup olmadığını kontrol et
 */
export async function validateOutlookToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
