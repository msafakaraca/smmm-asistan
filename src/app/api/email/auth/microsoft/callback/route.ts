/**
 * Microsoft OAuth Callback Endpoint
 * GET /api/email/auth/microsoft/callback
 *
 * Handles OAuth callback from Microsoft
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  exchangeMicrosoftCode,
  getMicrosoftUserInfo,
  parseMicrosoftState,
} from "@/lib/email/oauth/microsoft";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Error handling
    if (error) {
      console.error('[Microsoft OAuth Callback] Error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/dashboard/mail/inbox?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      console.error('[Microsoft OAuth Callback] Missing code or state');
      return NextResponse.redirect(
        new URL('/dashboard/mail/inbox?error=invalid_callback', req.url)
      );
    }

    // Parse state
    const stateData = parseMicrosoftState(state);
    const { tenantId, userId, redirectUrl } = stateData;

    // Exchange code for tokens
    const tokens = await exchangeMicrosoftCode(code);

    // Get user info
    const userInfo = await getMicrosoftUserInfo(tokens.accessToken);

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : null;

    // Upsert connection (existing connection varsa güncelle)
    await prisma.email_oauth_connections.upsert({
      where: {
        tenantId_provider_email: {
          tenantId,
          provider: 'outlook',
          email: userInfo.email,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        syncStatus: 'idle',
        syncError: null,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        userId,
        provider: 'outlook',
        email: userInfo.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        syncStatus: 'idle',
      },
    });

    console.log(`[Microsoft OAuth Callback] Connection created/updated for ${userInfo.email}`);

    // Redirect to success page
    const successUrl = new URL(redirectUrl || '/dashboard/mail/inbox', req.url);
    successUrl.searchParams.set('connected', 'outlook');
    successUrl.searchParams.set('email', userInfo.email);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[Microsoft OAuth Callback] Error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/mail/inbox?error=connection_failed', req.url)
    );
  }
}
