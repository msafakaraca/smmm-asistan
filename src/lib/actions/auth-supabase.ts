'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface AuthResult {
  error?: string;
  success?: boolean;
}

// Slug oluşturma yardımcısı — Türkçe karakter desteği
function generateSlug(name: string): string {
  const turkishMap: Record<string, string> = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
  };

  const slug = name
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  // B7 düzeltmesi: Sadece özel karakterlerden oluşan isimler boş slug üretir
  return slug || `ofis-${Date.now().toString(36)}`;
}

/**
 * Email/şifre ile kayıt
 * Supabase Auth user + Tenant + user_profiles atomik oluşturma
 */
export async function registerAction(formData: {
  email: string;
  password: string;
  name: string;
  officeName: string;
  kvkkConsent: boolean;
}): Promise<AuthResult> {
  if (!formData.kvkkConsent) {
    return { error: 'KVKK aydınlatma metni onayı gereklidir' };
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. Supabase Auth'da kullanıcı oluştur
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: { name: formData.name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (authError) {
    console.error('Register auth error:', authError);
    if (authError.message.includes('already registered')) {
      return { error: 'Bu email adresi zaten kullanılıyor' };
    }
    if ((authError as { code?: string }).code === 'weak_password') {
      return { error: 'Şifre en az 12 karakter olmalıdır' };
    }
    return { error: 'Kayıt sırasında bir hata oluştu' };
  }

  if (!authData.user) {
    return { error: 'Kullanıcı oluşturulamadı' };
  }

  // B1 düzeltmesi: Email Confirmation aktifken signUp() mevcut kullanıcı için hata vermez,
  // user objesi döner ama identities dizisi boş olur.
  if (authData.user.identities?.length === 0) {
    return { error: 'Bu email adresi zaten kullanılıyor' };
  }

  try {
    // 2. Benzersiz slug oluştur
    let slug = generateSlug(formData.officeName);
    const { data: existingSlug } = await adminClient
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // 3. Tenant oluştur (Supabase client Prisma'yı bypass eder, UUID ve tarihler manuel gerekli)
    const tenantId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .insert({
        id: tenantId,
        name: formData.officeName,
        slug,
        plan: 'trial',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant creation error:', tenantError);
      // Rollback: Auth kullanıcısını sil
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { error: 'Ofis oluşturulamadı' };
    }

    // 4. user_profiles oluştur
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        tenantId: tenant.id,
        email: formData.email,
        name: formData.name,
        role: 'owner',
        status: 'active',
        kvkkConsentAt: now,
        kvkkConsentVersion: 'v1.0',
        createdAt: now,
        updatedAt: now,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Rollback: Tenant ve auth kullanıcısını sil
      await adminClient.from('tenants').delete().eq('id', tenant.id);
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { error: 'Profil oluşturulamadı' };
    }

    return { success: true };
  } catch (err) {
    console.error('Register unexpected error:', err);
    // Rollback: Auth kullanıcısını sil
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { error: 'Kayıt sırasında beklenmeyen bir hata oluştu' };
  }
}

/**
 * Email/şifre ile giriş
 */
export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    console.error('Login error:', error);
    return { error: 'Email veya şifre hatalı' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * Çıkış
 */
export async function logoutAction(): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    return { error: 'Çıkış yapılırken bir hata oluştu' };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Google OAuth sonrası kayıt tamamlama (şifre + tenant)
 */
export async function completeOAuthRegistration(formData: {
  password: string;
  officeName: string;
  kvkkConsent: boolean;
}): Promise<AuthResult> {
  if (!formData.kvkkConsent) {
    return { error: 'KVKK aydınlatma metni onayı gereklidir' };
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Mevcut oturumdaki kullanıcıyı al
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Oturum bulunamadı' };
  }

  // B9 düzeltmesi: Çift tıklamada yetim tenant oluşmasını engelle
  const { data: existingProfile } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingProfile) {
    return { success: true }; // Zaten tamamlanmış
  }

  // Şifre belirle
  const { error: passwordError } = await supabase.auth.updateUser({
    password: formData.password,
  });

  if (passwordError) {
    console.error('OAuth password set error:', passwordError);
    return { error: 'Şifre belirlenemedi' };
  }

  try {
    // Benzersiz slug oluştur
    let slug = generateSlug(formData.officeName);
    const { data: existingSlug } = await adminClient
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Tenant oluştur (Supabase client Prisma'yı bypass eder, UUID ve tarihler manuel gerekli)
    const oauthTenantId = crypto.randomUUID();
    const oauthNow = new Date().toISOString();
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .insert({
        id: oauthTenantId,
        name: formData.officeName,
        slug,
        plan: 'trial',
        status: 'active',
        createdAt: oauthNow,
        updatedAt: oauthNow,
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      console.error('OAuth tenant creation error:', tenantError);
      return { error: 'Ofis oluşturulamadı' };
    }

    // user_profiles oluştur
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .insert({
        id: user.id,
        tenantId: tenant.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email!,
        role: 'owner',
        status: 'active',
        kvkkConsentAt: oauthNow,
        kvkkConsentVersion: 'v1.0',
        createdAt: oauthNow,
        updatedAt: oauthNow,
      });

    if (profileError) {
      console.error('OAuth profile creation error:', profileError);
      await adminClient.from('tenants').delete().eq('id', tenant.id);
      return { error: 'Profil oluşturulamadı' };
    }

    return { success: true };
  } catch (err) {
    console.error('OAuth register unexpected error:', err);
    return { error: 'Kayıt tamamlanırken beklenmeyen bir hata oluştu' };
  }
}

/**
 * Şifre sıfırlama emaili gönder
 */
export async function resetPasswordAction(email: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
  });

  if (error) {
    console.error('Password reset error:', error);
    // Rate limit hatası hesap varlığını ifşa etmez — kullanıcıya bildir
    if ((error as { code?: string }).code === 'over_email_send_rate_limit') {
      return { error: 'Çok fazla deneme yaptınız. Lütfen birkaç dakika bekleyip tekrar deneyin.' };
    }
  }

  // Güvenlik: Diğer hatalarda (hesap yok vb.) aynı başarılı mesaj
  return { success: true };
}

/**
 * Şifre güncelle (sıfırlama sonrası)
 */
export async function updatePasswordAction(newPassword: string): Promise<AuthResult> {
  // B8 düzeltmesi: Server Action doğrudan çağrılabilir, sunucu tarafı validasyon zorunlu
  if (!newPassword || newPassword.length < 8) {
    return { error: 'Şifre en az 8 karakter olmalıdır' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('Password update error:', error);
    return { error: 'Şifre güncellenemedi' };
  }

  return { success: true };
}

/**
 * Email doğrulama emailini tekrar gönder
 */
export async function resendVerificationEmail(): Promise<AuthResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { error: 'Oturum bulunamadı' };
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    console.error('Resend verification error:', error);
    return { error: 'Doğrulama emaili gönderilemedi' };
  }

  return { success: true };
}
