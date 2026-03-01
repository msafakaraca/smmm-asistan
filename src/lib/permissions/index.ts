/**
 * Permission System - Barrel Export
 * SMMM-AI Kullanıcı Yetki Sistemi
 */

// Types
export {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type Permission,
  type UserStatus,
  type UserRole,
} from './types';

// Defaults
export {
  OWNER_PERMISSIONS,
  ADMIN_PERMISSIONS,
  USER_PERMISSIONS,
  getDefaultPermissions,
  roleHasPermission,
  canAssignRole,
  canManageUser,
} from './defaults';

// Check functions
export {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireAnyPermission,
  isUserActive,
  getEffectivePermissions,
  type UserWithPermissions,
} from './check';
