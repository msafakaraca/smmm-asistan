/**
 * Microsoft OAuth Helper for Outlook
 * Microsoft Graph API ile e-posta okuma yetkisi
 */

import { encrypt, decrypt } from '@/lib/crypto';

// Microsoft OAuth endpoints
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com';
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

// Microsoft Graph API scopes
const OUTLOOK_SCOPES = [
  'Mail.Read',
  'Mail.Send',
  'User.Read',
  'offline_access', // Refresh token için
];

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface MicrosoftUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

interface MicrosoftOAuthState {
  tenantId: string;
  userId: string;
  redirectUrl?: string;
}

/**
 * Get Microsoft tenant ID (default: 'common' for multi-tenant apps)
 */
function getMicrosoftTenantId(): string {
  return process.env.MICROSOFT_TENANT_ID || 'common';
}

/**
 * Generate Microsoft OAuth authorization URL
 */
export function getMicrosoftAuthUrl(tenantId: string, userId: string, redirectUrl?: string): string {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_MICROSOFT_CLIENT_ID is not configured');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/email/auth/microsoft/callback`;

  // State parametresini şifrele (CSRF koruması)
  const stateData: MicrosoftOAuthState = { tenantId, userId, redirectUrl };
  const state = encodeURIComponent(encrypt(JSON.stringify(stateData)));

  const msTenant = getMicrosoftTenantId();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: OUTLOOK_SCOPES.join(' '),
    response_mode: 'query',
    prompt: 'select_account', // Hesap seçimi ekranı göster
    state,
  });

  return `${MICROSOFT_AUTH_URL}/${msTenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(code: string): Promise<MicrosoftTokens> {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are not configured');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/email/auth/microsoft/callback`;
  const msTenant = getMicrosoftTenantId();

  const response = await fetch(`${MICROSOFT_AUTH_URL}/${msTenant}/oauth2/v2.0/token`, {
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
      scope: OUTLOOK_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Microsoft OAuth] Token exchange failed:', error);
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
export async function refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftTokens> {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are not configured');
  }

  // Refresh token'ı decrypt et
  const decryptedRefreshToken = decrypt(refreshToken);
  const msTenant = getMicrosoftTenantId();

  const response = await fetch(`${MICROSOFT_AUTH_URL}/${msTenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: decryptedRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      scope: OUTLOOK_SCOPES.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Microsoft OAuth] Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scopes: (data.scope || '').split(' '),
  };
}

/**
 * Get user info from Microsoft Graph
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
  const response = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get Microsoft user info');
  }

  const data = await response.json();

  return {
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
}

/**
 * Parse and validate OAuth state
 */
export function parseMicrosoftState(state: string): MicrosoftOAuthState {
  try {
    const decrypted = decrypt(decodeURIComponent(state));
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Microsoft OAuth] Failed to parse state:', error);
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

// Alias for clarity
export const isMicrosoftTokenExpired = isTokenExpired;
