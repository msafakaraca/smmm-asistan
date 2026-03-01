/**
 * E-Tebligat PDF İndirme API Endpoint
 * =====================================
 * Tebligat belgesini PDF olarak indirip base64 döndürür.
 *
 * POST /api/etebligat/pdf
 * Body: { customerId, tebligId, tebligSecureId, tarafId, tarafSecureId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

interface PdfRequest {
  customerId: string;
  tebligId: string;
  tebligSecureId: string;
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
    let body: PdfRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    const { customerId, tebligId, tebligSecureId, tarafId, tarafSecureId } = body;

    if (!customerId || !tebligId || !tebligSecureId || !tarafId || !tarafSecureId) {
      return NextResponse.json(
        { error: "customerId, tebligId, tebligSecureId, tarafId ve tarafSecureId zorunludur" },
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

    // 5. Bot'a etebligat:pdf sinyali gönder
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "etebligat:pdf",
        data: {
          customerId,
          tebligId,
          tebligSecureId,
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
      message: "PDF indirme başlatıldı",
    });
  } catch (error) {
    console.error("[etebligat-pdf] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
