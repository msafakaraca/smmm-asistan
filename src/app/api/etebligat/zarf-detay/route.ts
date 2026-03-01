/**
 * E-Tebligat Zarf Detay API Endpoint
 * ====================================
 * Tebligat zarfını açarak "okundu" işaretler.
 * DİKKAT: Bu işlem geri alınamaz!
 *
 * POST /api/etebligat/zarf-detay
 * Body: { customerId: string, tarafId: string, tarafSecureId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

interface ZarfDetayRequest {
  customerId: string;
  tarafId: string;
  tarafSecureId: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body parse
    let body: ZarfDetayRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    const { customerId, tarafId, tarafSecureId } = body;

    if (!customerId || !tarafId || !tarafSecureId) {
      return NextResponse.json(
        { error: "customerId, tarafId ve tarafSecureId zorunludur" },
        { status: 400 }
      );
    }

    // 3. Müşteri doğrulama — tenantId filtresi zorunlu
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, unvan: true, kisaltma: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Müşteri bulunamadı", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 4. Bot bağlantı kontrolü
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`, {
        method: "GET",
      });
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if ((clientsData.electronConnections ?? clientsData.totalConnections) === 0) {
          return NextResponse.json(
            { error: "SMMM Asistan masaüstü uygulaması bağlı değil.", code: "BOT_NOT_CONNECTED" },
            { status: 503 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        { error: "SMMM Asistan masaüstü uygulaması bağlı değil.", code: "BOT_NOT_CONNECTED" },
        { status: 503 }
      );
    }

    // 5. Bot'a etebligat:zarf-detay sinyali gönder
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "etebligat:zarf-detay",
        data: {
          customerId,
          tarafId,
          tarafSecureId,
          customerName,
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

    return NextResponse.json({
      success: true,
      message: "Zarf detay sorgusu başlatıldı",
    });
  } catch (error) {
    console.error("[etebligat-zarf-detay] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
