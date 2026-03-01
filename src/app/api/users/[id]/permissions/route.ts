/**
 * User Permissions API
 * PUT /api/users/[id]/permissions - Kullanıcı yetkilerini güncelle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserWithProfile } from '@/lib/supabase/auth';
import { prisma } from '@/lib/db';
import {
  requirePermission,
  canManageUser,
  ALL_PERMISSIONS,
  type UserRole,
  type Permission,
} from '@/lib/permissions';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PUT /api/users/[id]/permissions
 * Kullanıcının yetkilerini günceller
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(currentUser, 'users:manage');
    if (permError) return permError;

    const { id } = await context.params;
    const body = await req.json();
    const { permissions } = body;

    // Permissions array kontrolü
    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Yetkiler bir dizi olmalı' },
        { status: 400 }
      );
    }

    // Geçerli permission kontrolü
    const invalidPermissions = permissions.filter(
      (p: string) => !ALL_PERMISSIONS.includes(p as Permission)
    );

    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { error: `Geçersiz yetkiler: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      );
    }

    // Hedef kullanıcıyı bul
    const targetUser = await prisma.user_profiles.findFirst({
      where: {
        id,
        tenantId: currentUser!.tenantId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Kendinin yetkilerini değiştiremez
    if (id === currentUser!.id) {
      return NextResponse.json(
        { error: 'Kendi yetkilerinizi değiştiremezsiniz' },
        { status: 403 }
      );
    }

    // Role yönetim kontrolü
    if (!canManageUser(currentUser!.role as UserRole, targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: 'Bu kullanıcının yetkilerini değiştirme hakkınız yok' },
        { status: 403 }
      );
    }

    // Owner'ın yetkileri değiştirilemez
    if (targetUser.role === 'owner') {
      return NextResponse.json(
        { error: 'Ofis sahibinin yetkileri değiştirilemez' },
        { status: 403 }
      );
    }

    // Admin users:manage yetkisi veremez
    if (currentUser!.role === 'admin' && permissions.includes('users:manage')) {
      return NextResponse.json(
        { error: 'users:manage yetkisi verme hakkınız yok' },
        { status: 403 }
      );
    }

    // Güncelle
    const updatedUser = await prisma.user_profiles.update({
      where: { id },
      data: { permissions },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[Users Permissions API] PUT Error:', error);
    return NextResponse.json(
      { error: 'Yetkiler güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}
