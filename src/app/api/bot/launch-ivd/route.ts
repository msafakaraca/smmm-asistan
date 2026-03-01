/**
 * GİB İVD Hızlı Giriş API Endpoint
 * =================================
 * Dashboard'dan Electron Bot'a İVD başlatma sinyali gönderir.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Tenant'ın GİB credentials'ını al
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { gibSettings: true },
    });

    const gibSettings: Record<string, unknown> = (tenant?.gibSettings as Record<string, unknown>) || {};

    // 3. Credentials kontrolü
    if (!gibSettings.gibCode || !gibSettings.gibPassword) {
      return NextResponse.json(
        { error: "GİB giriş bilgileri ayarlardan girilmeli" },
        { status: 400 }
      );
    }

    // 4. Şifreleri decrypt et
    const userid = gibSettings.gibCode as string;
    let password: string;

    try {
      password = decrypt(gibSettings.gibPassword as string);
    } catch (decryptError) {
      console.error("[launch-ivd] Şifre çözümleme hatası:", decryptError);
      return NextResponse.json(
        { error: "GİB şifresi çözümlenemedi. Lütfen ayarlardan şifrenizi tekrar girin." },
        { status: 400 }
      );
    }

    // 5. F7 fix: Bot bağlantı kontrolü
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`, {
        method: "GET",
      });

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if (clientsData.totalConnections === 0) {
          return NextResponse.json(
            {
              error: "Bot bağlantısı yok. Lütfen Electron uygulamasını başlatın ve giriş yapın.",
              code: "BOT_NOT_CONNECTED"
            },
            { status: 503 }
          );
        }
      }
    } catch {
      // Clients endpoint'i erişilemezse devam et (eski davranış)
      console.warn("[launch-ivd] Bot bağlantı kontrolü yapılamadı, devam ediliyor...");
    }

    // 6. Internal API ile bot'a sinyal gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "gib:launch-ivd",
        data: { userid, password },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-ivd] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi. Electron uygulamasını kontrol edin." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "İVD başlatılıyor...",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-ivd] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
