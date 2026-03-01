/**
 * Users API - Liste ve Ekleme
 * GET  /api/users - Ekip listesi
 * POST /api/users - Kullanıcı ekle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserWithProfile } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import {
  requirePermission,
  getDefaultPermissions,
  canAssignRole,
  type UserRole,
} from '@/lib/permissions';

/**
 * GET /api/users
 * Tenant'a ait tüm kullanıcıları listeler
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(user, 'users:read');
    if (permError) return permError;

    const users = await prisma.user_profiles.findMany({
      where: { tenantId: user!.tenantId },
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
      orderBy: [
        { role: 'asc' }, // owner önce
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[Users API] GET Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcılar yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Yeni kullanıcı ekler (Supabase Auth + user_profiles)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getUserWithProfile();

    // Yetki kontrolü
    const permError = requirePermission(currentUser, 'users:manage');
    if (permError) return permError;

    const body = await req.json();
    const { email, name, role, phoneNumber, password, permissions: customPermissions } = body;

    // Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Geçerli bir email adresi gerekli' },
        { status: 400 }
      );
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'İsim en az 2 karakter olmalı' },
        { status: 400 }
      );
    }

    // Şifre validasyonu
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Şifre en az 8 karakter olmalı' },
        { status: 400 }
      );
    }

    // Şifre güvenlik kontrolü
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return NextResponse.json(
        { error: 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermeli' },
        { status: 400 }
      );
    }

    const targetRole = (role || 'user') as UserRole;

    // Role atama kontrolü
    if (!canAssignRole(currentUser!.role as UserRole, targetRole)) {
      return NextResponse.json(
        { error: 'Bu rolü atama yetkiniz yok' },
        { status: 403 }
      );
    }

    // Email zaten kullanılıyor mu?
    const existingUser = await prisma.user_profiles.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu email adresi zaten kullanılıyor' },
        { status: 400 }
      );
    }

    // Supabase Admin client ile kullanıcı oluştur
    const supabaseAdmin = createAdminClient();

    // Kullanıcının belirlediği şifreyi kullan
    const userPassword = password;

    // Supabase Auth'da kullanıcı oluştur (kullanıcının şifresiyle)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: userPassword,
      email_confirm: true, // Email doğrulamasını atla
      user_metadata: {
        name: name.trim(),
        invited_by: currentUser!.id,
      },
    });

    if (authError) {
      console.error('[Users API] Auth Error:', authError);

      // Supabase'de zaten varsa
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Bu email adresi zaten kayıtlı' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Kullanıcı oluşturulurken hata: ' + authError.message },
        { status: 500 }
      );
    }

    // user_profiles tablosuna ekle
    const permissions = customPermissions || getDefaultPermissions(targetRole);

    const newUser = await prisma.user_profiles.create({
      data: {
        id: authData.user.id,
        email: email.toLowerCase(),
        name: name.trim(),
        role: targetRole,
        phoneNumber: phoneNumber || null,
        status: 'active', // Şifreli kullanıcı direkt aktif
        permissions,
        invitedBy: currentUser!.id,
        invitedAt: new Date(),
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
        invitedBy: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    // Audit log
    await auditLog.create(
      { id: currentUser!.id, email: currentUser!.email || '', tenantId: currentUser!.tenantId },
      'users',
      newUser.id,
      { email: newUser.email, name: newUser.name, role: newUser.role }
    );

    // Kullanıcı bilgilerini döndür (şifre döndürülmez - güvenlik)
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('[Users API] POST Error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı eklenirken hata oluştu' },
      { status: 500 }
    );
  }
}
