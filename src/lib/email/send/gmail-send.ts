/**
 * Gmail API ile mail gönderme
 * OAuth token kullanarak Gmail üzerinden mail gönderir
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
  from?: string; // Gönderen email (opsiyonel, OAuth'tan alınır)
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Gmail API ile mail gönder
 */
export async function sendGmailEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { accessToken, to, subject, body, attachments = [] } = params;

  try {
    // Multipart MIME message oluştur
    const boundary = `boundary_${Date.now()}`;

    let mimeMessage = '';

    if (attachments.length > 0) {
      // Attachment varsa multipart/mixed kullan
      mimeMessage = [
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        'MIME-Version: 1.0',
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body).toString('base64'),
      ].join('\r\n');

      // Attachment'ları ekle
      for (const attachment of attachments) {
        mimeMessage += [
          '',
          `--${boundary}`,
          `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.content, // Zaten base64
        ].join('\r\n');
      }

      mimeMessage += `\r\n--${boundary}--`;
    } else {
      // Attachment yoksa basit message
      mimeMessage = [
        `Content-Type: text/html; charset="UTF-8"`,
        'MIME-Version: 1.0',
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        '',
        body,
      ].join('\r\n');
    }

    // Base64 URL-safe encode
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Gmail API'ye gönder
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gmail Send] API Error:', response.status, errorData);

      if (response.status === 401) {
        return { success: false, error: 'Token süresi dolmuş. Lütfen hesabı yeniden bağlayın.' };
      }

      return {
        success: false,
        error: errorData.error?.message || `Gmail API hatası: ${response.status}`
      };
    }

    const data = await response.json();

    console.log('[Gmail Send] Success:', data.id);
    return { success: true, messageId: data.id };

  } catch (error) {
    console.error('[Gmail Send] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mail gönderme hatası'
    };
  }
}

/**
 * Access token'ın geçerli olup olmadığını kontrol et
 */
export async function validateGmailToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
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
