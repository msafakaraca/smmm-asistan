/**
 * Google OAuth Callback Endpoint
 * GET /api/email/auth/google/callback
 *
 * Handles OAuth callback from Google
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  exchangeGoogleCode,
  getGoogleUserInfo,
  parseGoogleState,
} from "@/lib/email/oauth/google";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Error handling
    if (error) {
      console.error('[Google OAuth Callback] Error from Google:', error);
      return NextResponse.redirect(
        new URL(`/dashboard/mail/inbox?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      console.error('[Google OAuth Callback] Missing code or state');
      return NextResponse.redirect(
        new URL('/dashboard/mail/inbox?error=invalid_callback', req.url)
      );
    }

    // Parse state
    const stateData = parseGoogleState(state);
    const { tenantId, userId, redirectUrl } = stateData;

    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.accessToken);

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
          provider: 'gmail',
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
        provider: 'gmail',
        email: userInfo.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        syncStatus: 'idle',
      },
    });

    console.log(`[Google OAuth Callback] Connection created/updated for ${userInfo.email}`);

    // Redirect to success page
    const successUrl = new URL(redirectUrl || '/dashboard/mail/inbox', req.url);
    successUrl.searchParams.set('connected', 'gmail');
    successUrl.searchParams.set('email', userInfo.email);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[Google OAuth Callback] Error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/mail/inbox?error=connection_failed', req.url)
    );
  }
}
