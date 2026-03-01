/**
 * Google OAuth Initiation Endpoint
 * GET /api/email/auth/google
 *
 * Redirects user to Google OAuth consent screen
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { getGoogleAuthUrl } from "@/lib/email/oauth/google";

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Redirect URL (başarılı bağlantı sonrası geri dönülecek sayfa)
    const searchParams = req.nextUrl.searchParams;
    const redirectUrl = searchParams.get('redirect') || '/dashboard/mail/inbox';

    // Google OAuth URL'sini oluştur
    const authUrl = getGoogleAuthUrl(user.tenantId, user.id, redirectUrl);

    // Kullanıcıyı Google'a yönlendir
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Google OAuth] Error:', error);
    return NextResponse.redirect(new URL('/dashboard/mail/inbox?error=oauth_failed', req.url));
  }
}
