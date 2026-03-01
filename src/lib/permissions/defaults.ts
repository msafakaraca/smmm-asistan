/**
 * Role-Based Default Permissions
 * SMMM-AI Kullanıcı Yetki Sistemi
 */

import { Permission, UserRole, ALL_PERMISSIONS } from './types';

// Owner - Tüm yetkiler
export const OWNER_PERMISSIONS: Permission[] = [...ALL_PERMISSIONS];

// Admin - users:manage hariç çoğu yetki
export const ADMIN_PERMISSIONS: Permission[] = [
  'customers:read',
  'customers:write',
  'customers:delete',
  'beyanname:read',
  'beyanname:write',
  'takip:read',
  'takip:write',
  'files:read',
  'files:write',
  'passwords:read',
  'passwords:write',
  'settings:read',
  // settings:write yok
  'users:read',
  // users:manage yok
  'gib:run',
  'mail:read',
  'mail:write',
  'reminders:read',
  'reminders:write',
];

// User - Sadece okuma + beyanname/takip yazma
export const USER_PERMISSIONS: Permission[] = [
  'customers:read',
  // customers:write ve delete yok
  'beyanname:read',
  'beyanname:write',
  'takip:read',
  'takip:write',
  'files:read',
  // files:write yok
  'passwords:read',
  // passwords:write yok
  // settings yok
  // users yok
  // gib:run yok
  'mail:read',
  'reminders:read',
  'reminders:write',
];

/**
 * Role'e göre varsayılan yetkileri döndürür
 */
export function getDefaultPermissions(role: UserRole): Permission[] {
  switch (role) {
    case 'owner':
      return OWNER_PERMISSIONS;
    case 'admin':
      return ADMIN_PERMISSIONS;
    case 'user':
    default:
      return USER_PERMISSIONS;
  }
}

/**
 * Role'ün belirli bir yetkiye sahip olup olmadığını kontrol eder
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getDefaultPermissions(role);
  return permissions.includes(permission);
}

/**
 * Bir kullanıcının başka bir role atama yapıp yapamayacağını kontrol eder
 * Role hierarchy: owner > admin > user
 */
export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    owner: 3,
    admin: 2,
    user: 1,
  };

  // Owner her şeyi atayabilir
  if (assignerRole === 'owner') return true;

  // Admin sadece user atayabilir
  if (assignerRole === 'admin') return targetRole === 'user';

  // User hiç kimseyi atayamaz
  return false;
}

/**
 * Bir kullanıcının başka bir kullanıcıyı yönetip yönetemeyeceğini kontrol eder
 */
export function canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    owner: 3,
    admin: 2,
    user: 1,
  };

  return hierarchy[managerRole] > hierarchy[targetRole];
}
