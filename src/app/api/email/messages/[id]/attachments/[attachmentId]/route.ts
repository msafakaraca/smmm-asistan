/**
 * Email Attachment Download API
 * GET /api/email/messages/[id]/attachments/[attachmentId]
 * E-posta ekini indir
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { refreshGoogleToken, isTokenExpired as isGoogleTokenExpired } from "@/lib/email/oauth/google";
import { refreshMicrosoftToken, isTokenExpired as isMicrosoftTokenExpired } from "@/lib/email/oauth/microsoft";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0/me";

interface AttachmentMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Get valid access token (refresh if needed) for Gmail
 */
async function getValidGmailToken(connection: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}): Promise<string> {
  if (!isGoogleTokenExpired(connection.expiresAt)) {
    return decrypt(connection.accessToken);
  }

  if (!connection.refreshToken) {
    throw new Error("No refresh token available");
  }

  const tokens = await refreshGoogleToken(connection.refreshToken);

  await prisma.email_oauth_connections.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || connection.refreshToken,
      expiresAt: tokens.expiresAt,
    },
  });

  return tokens.accessToken;
}

/**
 * Get valid access token (refresh if needed) for Outlook
 */
async function getValidOutlookToken(connection: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}): Promise<string> {
  if (!isMicrosoftTokenExpired(connection.expiresAt)) {
    return decrypt(connection.accessToken);
  }

  if (!connection.refreshToken) {
    throw new Error("No refresh token available");
  }

  const tokens = await refreshMicrosoftToken(connection.refreshToken);

  await prisma.email_oauth_connections.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || connection.refreshToken,
      expiresAt: tokens.expiresAt,
    },
  });

  return tokens.accessToken;
}

/**
 * Download Gmail attachment
 */
async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ data: Buffer; mimeType: string }> {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to download Gmail attachment: ${response.status}`);
  }

  const result = await response.json();

  // Gmail returns base64url encoded data
  const base64 = result.data.replace(/-/g, "+").replace(/_/g, "/");
  const buffer = Buffer.from(base64, "base64");

  return { data: buffer, mimeType: "application/octet-stream" };
}

/**
 * Download Outlook attachment
 */
async function downloadOutlookAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ data: Buffer; mimeType: string }> {
  // First get attachment metadata with content
  const response = await fetch(
    `${GRAPH_API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to download Outlook attachment: ${response.status}`);
  }

  const result = await response.json();

  // Outlook returns base64 encoded contentBytes
  const buffer = Buffer.from(result.contentBytes, "base64");

  return { data: buffer, mimeType: result.contentType || "application/octet-stream" };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, attachmentId } = await params;

    // Get email with connection info
    const email = await prisma.email_messages.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        email_oauth_connections: {
          select: {
            id: true,
            provider: true,
            accessToken: true,
            refreshToken: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify attachment exists in email metadata
    const attachments = (email.attachments as AttachmentMetadata[] | null) || [];
    const attachment = attachments.find((a) => a.id === attachmentId);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Download attachment based on provider
    let result: { data: Buffer; mimeType: string };

    if (!email.providerId) {
      return NextResponse.json({ error: "Provider ID not found" }, { status: 400 });
    }

    if (email.provider === "gmail") {
      const accessToken = await getValidGmailToken(email.email_oauth_connections);
      result = await downloadGmailAttachment(accessToken, email.providerId, attachmentId);
    } else if (email.provider === "outlook") {
      const accessToken = await getValidOutlookToken(email.email_oauth_connections);
      result = await downloadOutlookAttachment(accessToken, email.providerId, attachmentId);
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // Return file as download
    const headers = new Headers();
    headers.set("Content-Type", attachment.mimeType || result.mimeType);
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`
    );
    headers.set("Content-Length", result.data.length.toString());

    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(result.data), { headers });
  } catch (error) {
    console.error("[Attachment Download API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download attachment" },
      { status: 500 }
    );
  }
}
