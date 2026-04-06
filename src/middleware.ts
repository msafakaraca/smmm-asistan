/**
 * Next.js Middleware for Supabase Auth + Rate Limiting
 *
 * This middleware:
 * 1. Applies rate limiting to API routes (Upstash)
 * 2. Refreshes the Supabase session cookie
 * 3. Protects authenticated routes (/dashboard/*)
 * 4. Redirects authenticated users away from /login
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRateLimiter, isRateLimitEnabled } from "@/lib/ratelimit";

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ============================================
  // RATE LIMITING (API routes + Auth sayfaları)
  // ============================================
  // Server Action'lar sayfa URL'sine POST yapar, /api ile başlamaz.
  // Auth brute-force koruması için auth sayfalarına da rate limiting uygula.
  // Auth sayfalarında sadece POST (Server Action) istekleri sıkı rate limit'e tabi
  // GET (sayfa yükleme) istekleri rate limit dışı — brute force sadece POST'ta olur
  const isAuthRoute = pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/");
  const isPostRequest = request.method === "POST";

  // Internal API çağrılarını rate limit'ten muaf tut
  // server.ts → /api/* çağrılarında X-Internal-Token header'ı gönderir
  // Token doğrulaması API route'larda verifyBearerOrInternal() ile yapılır
  const isInternalCall = !!request.headers.get("X-Internal-Token");

  const shouldRateLimit = !isInternalCall && (
    pathname.startsWith("/api") ||
    (isAuthRoute && isPostRequest)
  );

  if (shouldRateLimit && isRateLimitEnabled()) {
    try {
      const rateLimiter = getRateLimiter(pathname);

      // IP bazlı rate limiting
      // X-Forwarded-For header'ı varsa onu kullan (proxy arkasında)
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

      const { success, limit, remaining, reset } = await rateLimiter.limit(ip);

      // Rate limit aşıldıysa 429 döndür
      if (!success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": reset.toString(),
              "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      // Rate limit header'larını response'a ekle (aşağıda)
      // Not: Supabase response'una eklenecek
    } catch (error) {
      // Rate limiting hatası durumunda isteği engelleme, sadece logla
      console.error("[RateLimit] Error:", error);
    }
  }

  // ============================================
  // SUPABASE AUTH
  // ============================================
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() Supabase Auth server'a doğrulama yapar ve expired token'ı yeniler.
  // getSession() sadece cookie'den okur, token yenilemez — bu yüzden getUser() ZORUNLU.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = user ? true : false;

  const isAuthPage =
    pathname === "/login" || pathname === "/register";
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthFlow = pathname.startsWith("/auth/");

  // B2 düzeltmesi: Redirect'lerde Supabase cookie'lerini korumak için helper
  // getUser() token refresh tetikleyebilir ve yeni cookie'ler supabaseResponse'a yazılır.
  // Redirect response bunları içermezse session cookie'leri kaybolur.
  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Oturum açık kullanıcı login/register'a erişirse dashboard'a yönlendir
  if (session && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithCookies(url);
  }

  // Oturum kapalı kullanıcı dashboard'a erişirse login'e yönlendir
  if (!session && isDashboard) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url);
  }

  // Email doğrulama kontrolü — dashboard'a erişimde
  if (user && isDashboard) {
    // Supabase email doğrulanmamışsa verify sayfasına yönlendir
    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/verify-email";
      return redirectWithCookies(url);
    }
  }

  // Auth akış sayfaları — oturum gereksinimi kontrolü
  // B3 düzeltmesi: verify-email oturumsuz erişilebilir (signUp email confirmation aktifken session null döner)
  // forgot-password zaten oturumsuz erişilebilir
  if (!session && isAuthFlow) {
    if (pathname === "/auth/set-password" || pathname === "/auth/reset-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return redirectWithCookies(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
