import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const rawNext = searchParams.get('next') || '/dashboard';
  // B5 düzeltmesi: Open redirect koruması — sadece relative path'lere izin ver
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  // Supabase hata parametrelerini yakala (örn: otp_expired, access_denied)
  if (errorParam) {
    console.error('Auth callback error from Supabase:', errorParam, errorCode);
    const errorMsg = errorCode === 'otp_expired'
      ? 'link_expired'
      : 'auth_callback_failed';
    return NextResponse.redirect(`${origin}/login?error=${errorMsg}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component'ten çağrıldığında ignore edilebilir
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Şifre sıfırlama
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // Email doğrulama veya OAuth callback — profil kontrolü yap
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Profil yok — ilk OAuth girişi veya profil eksik, tamamlama sayfasına yönlendir
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
  }

  // Email doğrulama sonrası veya normal OAuth girişi → dashboard
  return NextResponse.redirect(`${origin}${next}`);
}
