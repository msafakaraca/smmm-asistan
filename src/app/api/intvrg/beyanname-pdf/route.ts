/**
 * INTVRG Beyanname PDF Görüntüleme API Endpoint
 * ===============================================
 * Electron Bot'a beyanname PDF indirme sinyali gönderir.
 *
 * POST /api/intvrg/beyanname-pdf
 * Body: { customerId: string, beyoid: string, turAdi?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body parse
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
    }

    const { customerId, beyoid, turAdi } = body as {
      customerId: string;
      beyoid: string;
      turAdi?: string;
    };

    if (!customerId || !beyoid) {
      return NextResponse.json(
        { error: "customerId ve beyoid zorunludur" },
        { status: 400 }
      );
    }

    // 3. Müşteri bilgilerini al — tenantId filtresi zorunlu
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, vknTckn: true, unvan: true, kisaltma: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // 4. Bot bağlantı kontrolü
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`);
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if ((clientsData.electronConnections ?? clientsData.totalConnections) === 0) {
          return NextResponse.json(
            { error: "Masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.", code: "BOT_NOT_CONNECTED" },
            { status: 503 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        { error: "Masaüstü uygulaması bağlı değil.", code: "BOT_NOT_CONNECTED" },
        { status: 503 }
      );
    }

    // 5. Bot'a intvrg:beyanname-pdf sinyali gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;
    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "intvrg:beyanname-pdf",
        data: {
          beyoid,
          vkn: customer.vknTckn,
          turAdi: turAdi || "",
          userId: user.id,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Bot komutu gönderilemedi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "PDF indirme başlatıldı" });
  } catch (error) {
    console.error("[intvrg-beyanname-pdf] Beklenmeyen hata:", error);
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
  }
}
