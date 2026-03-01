/**
 * Authentication Module - Supabase Auth Wrapper
 */

import { getUserWithProfile } from './supabase/auth';

export async function auth() {
  const user = await getUserWithProfile();

  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name,
    },
  };
}

export { getUserWithProfile, getSession, getUser, isAuthenticated } from './supabase/auth';
