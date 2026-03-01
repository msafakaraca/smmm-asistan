/**
 * Microsoft OAuth Initiation Endpoint
 * GET /api/email/auth/microsoft
 *
 * Redirects user to Microsoft OAuth consent screen
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { getMicrosoftAuthUrl } from "@/lib/email/oauth/microsoft";

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

    // Microsoft OAuth URL'sini oluştur
    const authUrl = getMicrosoftAuthUrl(user.tenantId, user.id, redirectUrl);

    // Kullanıcıyı Microsoft'a yönlendir
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Microsoft OAuth] Error:', error);
    return NextResponse.redirect(new URL('/dashboard/mail/inbox?error=oauth_failed', req.url));
  }
}
