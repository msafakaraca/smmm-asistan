/**
 * Permission Check Functions
 * SMMM-AI Kullanıcı Yetki Sistemi
 */

import { NextResponse } from 'next/server';
import { Permission, UserRole } from './types';
import { getDefaultPermissions, roleHasPermission } from './defaults';

export interface UserWithPermissions {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  permissions?: string[];
  status?: string;
}

/**
 * Kullanıcının belirli bir yetkiye sahip olup olmadığını kontrol eder
 *
 * Öncelik sırası:
 * 1. Kullanıcıya özel atanmış yetkiler (permissions array)
 * 2. Role-based varsayılan yetkiler
 *
 * @param user - Kullanıcı bilgileri
 * @param permission - Kontrol edilecek yetki
 * @returns Yetki var mı?
 */
export function hasPermission(
  user: UserWithPermissions,
  permission: Permission
): boolean {
  // Suspended kullanıcıların hiçbir yetkisi yok
  if (user.status === 'suspended') {
    return false;
  }

  // Pending kullanıcıların sadece okuma yetkisi olabilir
  if (user.status === 'pending') {
    return false; // Pending kullanıcılar hiçbir şey yapamaz
  }

  // Owner her şeyi yapabilir
  if (user.role === 'owner') {
    return true;
  }

  // Kullanıcıya özel yetki tanımlanmışsa onu kullan
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }

  // Yoksa role-based varsayılan yetkileri kullan
  return roleHasPermission(user.role as UserRole, permission);
}

/**
 * Kullanıcının birden fazla yetkiden en az birine sahip olup olmadığını kontrol eder
 */
export function hasAnyPermission(
  user: UserWithPermissions,
  permissions: Permission[]
): boolean {
  return permissions.some(p => hasPermission(user, p));
}

/**
 * Kullanıcının tüm yetkilere sahip olup olmadığını kontrol eder
 */
export function hasAllPermissions(
  user: UserWithPermissions,
  permissions: Permission[]
): boolean {
  return permissions.every(p => hasPermission(user, p));
}

/**
 * Kullanıcının yetkisi yoksa hata döndürür (API için)
 *
 * @param user - Kullanıcı bilgileri
 * @param permission - Gerekli yetki
 * @returns NextResponse veya null (yetki varsa)
 */
export function requirePermission(
  user: UserWithPermissions | null,
  permission: Permission
): NextResponse | null {
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!hasPermission(user, permission)) {
    return NextResponse.json(
      { error: 'Bu işlem için yetkiniz yok' },
      { status: 403 }
    );
  }

  return null; // Yetki var, devam edilebilir
}

/**
 * Birden fazla yetkiden en az biri gerekli (API için)
 */
export function requireAnyPermission(
  user: UserWithPermissions | null,
  permissions: Permission[]
): NextResponse | null {
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!hasAnyPermission(user, permissions)) {
    return NextResponse.json(
      { error: 'Bu işlem için yetkiniz yok' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Kullanıcının aktif durumda olup olmadığını kontrol eder
 */
export function isUserActive(user: UserWithPermissions): boolean {
  return user.status === 'active' || user.role === 'owner';
}

/**
 * Kullanıcının efektif yetkilerini döndürür
 * (Özel yetkiler varsa onlar, yoksa role varsayılanları)
 */
export function getEffectivePermissions(user: UserWithPermissions): Permission[] {
  if (user.role === 'owner') {
    return getDefaultPermissions('owner');
  }

  if (user.permissions && user.permissions.length > 0) {
    return user.permissions as Permission[];
  }

  return getDefaultPermissions(user.role as UserRole);
}
