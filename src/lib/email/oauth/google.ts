/**
 * Google OAuth Helper for Gmail
 * Gmail API ile e-posta okuma yetkisi
 */

import { encrypt, decrypt } from '@/lib/crypto';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Gmail API scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

interface GoogleOAuthState {
  tenantId: string;
  userId: string;
  redirectUrl?: string;
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(tenantId: string, userId: string, redirectUrl?: string): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
  }

  // Base URL'yi al (production vs development)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/email/auth/google/callback`;

  // State parametresini şifrele (CSRF koruması)
  const stateData: GoogleOAuthState = { tenantId, userId, redirectUrl };
  const state = encodeURIComponent(encrypt(JSON.stringify(stateData)));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline', // Refresh token almak için
    prompt: 'select_account consent', // Hesap seçimi + izin ekranı göster
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/email/auth/google/callback`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Google OAuth] Token exchange failed:', error);
    throw new Error('Failed to exchange authorization code');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scopes: (data.scope || '').split(' '),
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  // Refresh token'ı decrypt et
  const decryptedRefreshToken = decrypt(refreshToken);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: decryptedRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Google OAuth] Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Yeni refresh token gelmezse eskisini kullan
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scopes: (data.scope || '').split(' '),
  };
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get Google user info');
  }

  const data = await response.json();

  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Parse and validate OAuth state
 */
export function parseGoogleState(state: string): GoogleOAuthState {
  try {
    const decrypted = decrypt(decodeURIComponent(state));
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Google OAuth] Failed to parse state:', error);
    throw new Error('Invalid OAuth state');
  }
}

/**
 * Check if access token needs refresh
 */
export function isTokenExpired(expiresAt?: Date | null): boolean {
  if (!expiresAt) return true;
  // 5 dakika tampon
  return new Date(expiresAt).getTime() - 5 * 60 * 1000 < Date.now();
}
