/**
 * Supabase Auth Helper Functions
 *
 * These functions help with authentication and user profile management.
 */

import { cache } from 'react';
import { createClient } from './server';
import { createAdminClient } from './server';

/**
 * Get current user session from server-side
 *
 * @returns User session or null if not authenticated
 */
export async function getSession() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

/**
 * Get current user from server-side
 *
 * @returns User object or null if not authenticated
 */
export async function getUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Get user profile with tenant information
 *
 * This fetches the user_profiles table which contains tenantId and role.
 * RLS policies ensure users can only see their own profile.
 *
 * @param userId - User ID from Supabase Auth
 * @returns User profile with tenant info
 */
export async function getUserProfile(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      `
      id,
      tenantId,
      role,
      createdAt,
      updatedAt
    `
    )
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }

  return data;
}

/**
 * Get user with full profile and tenant data
 *
 * OPTIMIZED: Single query with JOIN instead of 3 separate queries.
 * Combines Supabase Auth user with profile and tenant info.
 *
 * PERFORMANCE: React.cache() ile per-request deduplikasyon.
 * Aynı request içinde birden fazla kez çağrıldığında tek sorgu çalışır.
 *
 * @returns Complete user object or null
 */
export const getUserWithProfile = cache(async function getUserWithProfile() {
  const supabase = await createClient();

  // 1. Auth user check (required for authentication)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // 2. Get user profile with permissions
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, tenantId, role, status, permissions, name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Failed to fetch user profile:', profileError, 'for user.id:', user.id);
    return null;
  }

  // 3. Get tenant data separately
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, status, settings, gibSettings, turmobSettings, captchaKey')
    .eq('id', profile.tenantId)
    .single();

  if (tenantError) {
    console.error('Failed to fetch tenant:', tenantError);
  }

  return {
    id: user.id,
    email: user.email!,
    name: profile.name || user.user_metadata?.name || user.email!,
    role: profile.role,
    tenantId: profile.tenantId,
    tenant: tenantData || undefined,
    emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
    image: user.user_metadata?.avatar_url || null,
    status: profile.status || 'active',
    permissions: profile.permissions || [],
  };
});

/**
 * Check if user is authenticated
 *
 * @returns boolean
 */
export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

/**
 * Get tenant ID for current user
 *
 * @returns Tenant ID or null
 */
export async function getUserTenantId() {
  const user = await getUser();

  if (!user) {
    return null;
  }

  const profile = await getUserProfile(user.id);
  return profile?.tenantId || null;
}

/**
 * Admin function: Create user profile after auth signup
 *
 * This should be called after creating a user in Supabase Auth.
 * Usually triggered by a webhook or signup flow.
 *
 * @param userId - Supabase Auth user ID
 * @param tenantId - Tenant ID
 * @param role - User role (owner, admin, member)
 */
export async function createUserProfile(
  userId: string,
  tenantId: string,
  role: string = 'member'
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.from('user_profiles').insert({
    id: userId,
    tenantId,
    role,
  });

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }

  return data;
}
