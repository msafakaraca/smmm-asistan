/**
 * Users API - Detay, Güncelleme, Silme
 * GET    /api/users/[id] - Kullanıcı detay
 * PUT    /api/users/[id] - Kullanıcı güncelle
 * DELETE /api/users/[id] - Kullanıcı sil
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserWithProfile } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import {
  requirePermission,
  canManageUser,
  canAssignRole,
  type UserRole,
} from '@/lib/permissions';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/users/[id]
 * Kullanıcı detayını getirir
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(currentUser, 'users:read');
    if (permError) return permError;

    const { id } = await context.params;

    const user = await prisma.user_profiles.findFirst({
      where: {
        id,
        tenantId: currentUser!.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        status: true,
        permissions: true,
        lastLoginAt: true,
        invitedBy: true,
        invitedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('[Users API] GET [id] Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]
 * Kullanıcı bilgilerini günceller
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(currentUser, 'users:manage');
    if (permError) return permError;

    const { id } = await context.params;
    const body = await req.json();
    const { name, role, phoneNumber, status } = body;

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

    // Kendini silme/düşürme kontrolü
    if (id === currentUser!.id) {
      // Kendi rolünü düşüremez
      if (role && role !== currentUser!.role) {
        return NextResponse.json(
          { error: 'Kendi rolünüzü değiştiremezsiniz' },
          { status: 403 }
        );
      }
      // Kendini suspend edemez
      if (status === 'suspended') {
        return NextResponse.json(
          { error: 'Kendinizi askıya alamazsınız' },
          { status: 403 }
        );
      }
    }

    // Role yönetim kontrolü (admin owner'ı değiştiremez)
    if (!canManageUser(currentUser!.role as UserRole, targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: 'Bu kullanıcıyı yönetme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Role atama kontrolü
    if (role && !canAssignRole(currentUser!.role as UserRole, role as UserRole)) {
      return NextResponse.json(
        { error: 'Bu rolü atama yetkiniz yok' },
        { status: 403 }
      );
    }

    // Güncelleme verilerini hazırla
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
    if (status !== undefined) updateData.status = status;

    const updatedUser = await prisma.user_profiles.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phoneNumber: true,
        status: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Supabase Auth metadata güncelle
    if (name !== undefined) {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { name: name.trim() },
      });
    }

    // Audit log
    await auditLog.update(
      { id: currentUser!.id, email: currentUser!.email || '', tenantId: currentUser!.tenantId },
      'users',
      id,
      { email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, status: updatedUser.status }
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[Users API] PUT Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Kullanıcıyı siler
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(currentUser, 'users:manage');
    if (permError) return permError;

    const { id } = await context.params;

    // Kendini silemez
    if (id === currentUser!.id) {
      return NextResponse.json(
        { error: 'Kendinizi silemezsiniz' },
        { status: 403 }
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

    // Role yönetim kontrolü
    if (!canManageUser(currentUser!.role as UserRole, targetUser.role as UserRole)) {
      return NextResponse.json(
        { error: 'Bu kullanıcıyı silme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Owner silinemez
    if (targetUser.role === 'owner') {
      return NextResponse.json(
        { error: 'Ofis sahibi silinemez' },
        { status: 403 }
      );
    }

    // Supabase Auth'dan sil
    const supabaseAdmin = createAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      console.error('[Users API] Auth Delete Error:', authError);
      // Devam et, user_profiles'dan silmeyi dene
    }

    // user_profiles'dan sil
    await prisma.user_profiles.delete({
      where: { id },
    });

    // Audit log
    await auditLog.delete(
      { id: currentUser!.id, email: currentUser!.email || '', tenantId: currentUser!.tenantId },
      'users',
      id,
      { email: targetUser.email, name: targetUser.name }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Users API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı silinirken hata oluştu' },
      { status: 500 }
    );
  }
}
