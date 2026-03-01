/**
 * API Helper Functions for Supabase
 *
 * Common utilities for API routes using Supabase
 * OPTIMIZED: JWT local decode for ~95% faster auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtDecode } from 'jwt-decode';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/supabase/auth';

/**
 * Supabase JWT Token Structure
 */
interface SupabaseJWT {
  sub: string;           // user id
  email?: string;
  user_metadata?: {
    tenant_id?: string;
    name?: string;
  };
  app_metadata?: {
    tenant_id?: string;
    role?: string;
  };
  exp: number;
  aud: string;
}

/**
 * FAST: Get authenticated user from JWT token (NO network call!)
 *
 * This decodes the JWT locally instead of calling Supabase API.
 * ~0-5ms vs ~60-100ms with auth.getUser()
 *
 * Falls back to slow method if JWT doesn't contain tenant_id
 */
export async function getAuthenticatedUserFast(): Promise<{
  id: string;
  email: string;
  tenantId: string;
  role: string;
} | null> {
  try {
    const cookieStore = await cookies();

    // Find Supabase auth token in cookies
    // Cookie name format: sb-{project-ref}-auth-token or sb-{project-ref}-auth-token.0 (chunked)
    let accessToken: string | null = null;

    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      // Look for base64 encoded JSON containing access_token
      if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
        try {
          // Try to parse as JSON (Supabase stores session as JSON)
          const decoded = JSON.parse(
            Buffer.from(cookie.value, 'base64').toString('utf-8')
          );
          if (decoded.access_token) {
            accessToken = decoded.access_token;
            break;
          }
        } catch {
          // Not base64 JSON, might be the token directly
          if (cookie.value.includes('.')) {
            accessToken = cookie.value;
            break;
          }
        }
      }
    }

    if (!accessToken) {
      return null;
    }

    // Decode JWT locally (NO network call!)
    const decoded = jwtDecode<SupabaseJWT>(accessToken);

    // Check if token is expired
    if (decoded.exp * 1000 < Date.now()) {
      console.log('[Auth] JWT expired, falling back to slow auth');
      return await getAuthenticatedUserSlow();
    }

    // Get tenant_id from app_metadata (set during signup/migration)
    const tenantId = decoded.app_metadata?.tenant_id
      || decoded.user_metadata?.tenant_id;

    if (!tenantId) {
      // Fallback: tenant_id not in JWT, need to fetch from DB
      console.log('[Auth] No tenant_id in JWT, falling back to slow auth');
      return await getAuthenticatedUserSlow();
    }

    return {
      id: decoded.sub,
      email: decoded.email || '',
      tenantId,
      role: decoded.app_metadata?.role || 'user'
    };
  } catch (error) {
    console.error('[Auth] JWT decode error:', error);
    return await getAuthenticatedUserSlow();
  }
}

/**
 * SLOW: Original method - calls Supabase API + DB query
 * Used as fallback when JWT doesn't contain tenant_id
 */
async function getAuthenticatedUserSlow(): Promise<{
  id: string;
  email: string;
  tenantId: string;
  role: string;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get user profile with tenantId
  const profile = await getUserProfile(user.id);

  if (!profile) {
    throw new Error('User profile not found');
  }

  return {
    id: user.id,
    email: user.email!,
    tenantId: profile.tenantId,
    role: profile.role,
  };
}

/**
 * Get authenticated user with tenant info
 * TEMPORARY: Using slow method until JWT decode issue is fixed
 */
export async function getAuthenticatedUser() {
  // Fast method has issues with cookie parsing, use slow method for now
  return await getAuthenticatedUserSlow();
}

/**
 * API wrapper that requires authentication
 *
 * Automatically handles auth check and error responses
 *
 * @example
 * export const GET = withAuth(async (req, user) => {
 *   const { data } = await supabase.from('Customer').select('*');
 *   return NextResponse.json(data);
 * });
 */
export function withAuth(
  handler: (
    req: NextRequest,
    user: {
      id: string;
      email: string;
      tenantId: string;
      role: string;
    }
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const user = await getAuthenticatedUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      return await handler(req, user);
    } catch (error: any) {
      console.error('API Error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Create Supabase client for API routes
 *
 * This client respects RLS policies and automatically filters by tenantId
 */
export async function createSupabaseClient() {
  return await createClient();
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response
 */
export function successResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
