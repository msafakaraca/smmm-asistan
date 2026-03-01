/**
 * Diğer İşlemler URL Launcher API Endpoint
 * =========================================
 * Dashboard'dan Electron Bot'a URL açma sinyali gönderir.
 * Kimlik bilgisi gerektirmez - sadece URL açar.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

// Desteklenen işlem ID'leri
const SUPPORTED_ACTIONS = [
  'efatura-iptal',
  'iskur',
  'ticaret-sicil',
  'turmob-ebirlik',
] as const;

type DigerIslemAction = typeof SUPPORTED_ACTIONS[number];

const ACTION_NAMES: Record<DigerIslemAction, string> = {
  'efatura-iptal': 'E-Fatura İptal/İtiraz Portalı',
  'iskur': 'İŞKUR İşveren Sistemi',
  'ticaret-sicil': 'Ticaret Sicili Gazetesi',
  'turmob-ebirlik': 'TÜRMOB E-Birlik Sistemi',
};

interface LaunchRequestBody {
  actionId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body'den actionId al
    let actionId: DigerIslemAction;

    try {
      const body: LaunchRequestBody = await req.json();
      if (!body.actionId || !SUPPORTED_ACTIONS.includes(body.actionId as DigerIslemAction)) {
        return NextResponse.json(
          { error: "Geçersiz işlem ID'si", code: "INVALID_ACTION" },
          { status: 400 }
        );
      }
      actionId = body.actionId as DigerIslemAction;
    } catch {
      return NextResponse.json(
        { error: "İstek gövdesi okunamadı" },
        { status: 400 }
      );
    }

    // 3. Bot bağlantı kontrolü (Electron client bağlı mı?)
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`, {
        method: "GET",
      });

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if ((clientsData.electronConnections ?? clientsData.totalConnections) === 0) {
          return NextResponse.json(
            {
              error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
              code: "BOT_NOT_CONNECTED"
            },
            { status: 503 }
          );
        }
      }
    } catch {
      console.warn("[launch-diger] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED"
        },
        { status: 503 }
      );
    }

    // 4. Internal API ile bot'a sinyal gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "diger-islemler:launch",
        data: { actionId },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-diger] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi." },
        { status: 502 }
      );
    }

    const actionName = ACTION_NAMES[actionId];

    return NextResponse.json({
      success: true,
      message: `${actionName} açılıyor...`,
      actionId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-diger] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
