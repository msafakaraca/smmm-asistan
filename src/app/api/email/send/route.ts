/**
 * Email Send API
 * POST /api/email/send - Gerçek mail gönderimi
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { sendGmailEmail } from "@/lib/email/send/gmail-send";
import { sendOutlookEmail } from "@/lib/email/send/outlook-send";
import { refreshGoogleToken, isTokenExpired } from "@/lib/email/oauth/google";
import { refreshMicrosoftToken, isMicrosoftTokenExpired } from "@/lib/email/oauth/microsoft";

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  mimeType: string;
}

interface SendEmailRequest {
  connectionId: string;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SendEmailRequest = await req.json();
    const { connectionId, to, subject, body: emailBody, attachments = [] } = body;

    // Validation
    if (!connectionId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "connectionId, to, subject ve body zorunludur" },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: "Geçersiz email adresi" },
        { status: 400 }
      );
    }

    // Get connection
    const connection = await prisma.email_oauth_connections.findFirst({
      where: {
        id: connectionId,
        tenantId: user.tenantId,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Email bağlantısı bulunamadı" },
        { status: 404 }
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decrypt(connection.accessToken);
    } catch (decryptError) {
      console.error('[Email Send] Token decrypt error:', decryptError);
      return NextResponse.json(
        { error: "Token çözümleme hatası. Lütfen hesabı yeniden bağlayın." },
        { status: 400 }
      );
    }

    // Check if token is expired and refresh if needed
    if (connection.provider === 'gmail' && isTokenExpired(connection.expiresAt)) {
      if (!connection.refreshToken) {
        return NextResponse.json(
          { error: "Refresh token yok. Lütfen hesabı yeniden bağlayın." },
          { status: 401 }
        );
      }

      console.log('[Email Send] Gmail token expired, refreshing...');
      try {
        const newTokens = await refreshGoogleToken(connection.refreshToken);
        accessToken = newTokens.accessToken;

        // Update tokens in database
        await prisma.email_oauth_connections.update({
          where: { id: connectionId, tenantId: user.tenantId },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: newTokens.refreshToken
              ? encrypt(newTokens.refreshToken)
              : connection.refreshToken,
            expiresAt: newTokens.expiresAt,
          },
        });
      } catch (refreshError) {
        console.error('[Email Send] Token refresh error:', refreshError);
        return NextResponse.json(
          { error: "Token yenileme hatası. Lütfen hesabı yeniden bağlayın." },
          { status: 401 }
        );
      }
    }

    if (connection.provider === 'outlook' && isMicrosoftTokenExpired(connection.expiresAt)) {
      if (!connection.refreshToken) {
        return NextResponse.json(
          { error: "Refresh token yok. Lütfen hesabı yeniden bağlayın." },
          { status: 401 }
        );
      }

      console.log('[Email Send] Outlook token expired, refreshing...');
      try {
        const newTokens = await refreshMicrosoftToken(connection.refreshToken);
        accessToken = newTokens.accessToken;

        // Update tokens in database
        await prisma.email_oauth_connections.update({
          where: { id: connectionId, tenantId: user.tenantId },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: newTokens.refreshToken
              ? encrypt(newTokens.refreshToken)
              : connection.refreshToken,
            expiresAt: newTokens.expiresAt,
          },
        });
      } catch (refreshError) {
        console.error('[Email Send] Token refresh error:', refreshError);
        return NextResponse.json(
          { error: "Token yenileme hatası. Lütfen hesabı yeniden bağlayın." },
          { status: 401 }
        );
      }
    }

    // Send email based on provider
    let result;
    if (connection.provider === 'gmail') {
      result = await sendGmailEmail({
        accessToken,
        to,
        subject,
        body: emailBody,
        attachments,
      });
    } else if (connection.provider === 'outlook') {
      result = await sendOutlookEmail({
        accessToken,
        to,
        subject,
        body: emailBody,
        attachments,
      });
    } else {
      return NextResponse.json(
        { error: "Desteklenmeyen email sağlayıcısı" },
        { status: 400 }
      );
    }

    if (!result.success) {
      console.error('[Email Send] Send failed:', result.error);
      return NextResponse.json(
        { error: result.error || "Mail gönderme başarısız" },
        { status: 500 }
      );
    }

    console.log(`[Email Send] Email sent successfully via ${connection.provider} to ${to}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      provider: connection.provider,
      from: connection.email,
      to,
    });

  } catch (error) {
    console.error('[Email Send] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mail gönderme hatası" },
      { status: 500 }
    );
  }
}
