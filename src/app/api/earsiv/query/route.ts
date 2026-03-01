/**
 * E-Arşiv Fatura Sorgulama API Endpoint
 * ======================================
 * Dashboard'dan Electron Bot'a e-Arşiv alış faturası sorgulama sinyali gönderir.
 *
 * POST /api/earsiv/query
 * Body: { customerId: string, startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface EarsivQueryRequest {
  customerId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
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
    let body: EarsivQueryRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    const { customerId, startDate, endDate } = body;

    if (!customerId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "customerId, startDate ve endDate zorunludur" },
        { status: 400 }
      );
    }

    // Tarih format kontrolü (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Tarih formatı YYYY-MM-DD olmalıdır" },
        { status: 400 }
      );
    }

    // GİB dönem sınırı kontrolü — mevcut aydan önceki 2 aya kadar sorgulanabilir
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    let minAllowedMonth = currentMonth - 2;
    let minAllowedYear = currentYear;
    if (minAllowedMonth <= 0) {
      minAllowedMonth += 12;
      minAllowedYear -= 1;
    }
    const minAllowedDate = new Date(minAllowedYear, minAllowedMonth - 1, 1); // Ayın 1'i
    const requestedStart = new Date(startDate);
    if (requestedStart < minAllowedDate) {
      return NextResponse.json(
        {
          error: "Seçilen dönem GİB'in izin verdiği aralığın dışında. e-Arşiv sorgulaması yalnızca son 2 aya kadar yapılabilir.",
          code: "PERIOD_OUT_OF_RANGE",
        },
        { status: 400 }
      );
    }

    // 3. Müşteri bilgilerini al — tenantId filtresi zorunlu
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        gibKodu: true,
        gibSifre: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Müşteri bulunamadı", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!customer.gibKodu || !customer.gibSifre) {
      return NextResponse.json(
        {
          error: `${customer.kisaltma || customer.unvan} için GİB Dijital Vergi Dairesi bilgileri eksik. Şifreler sayfasından GİB kullanıcı adı ve şifresini girin.`,
          code: "CUSTOMER_MISSING_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    // 4. Credential'ları decrypt et
    let userid: string;
    let password: string;
    try {
      userid = decrypt(customer.gibKodu);
      password = decrypt(customer.gibSifre);
    } catch (decryptError) {
      console.error("[earsiv-query] Müşteri şifre çözümleme hatası:", decryptError);
      return NextResponse.json(
        { error: "Mükellef GİB şifresi çözümlenemedi. Lütfen mükellef bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    // 5. Bot bağlantı kontrolü
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
              code: "BOT_NOT_CONNECTED",
            },
            { status: 503 }
          );
        }
      }
    } catch {
      console.warn("[earsiv-query] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED",
        },
        { status: 503 }
      );
    }

    // 6. Captcha API key'leri — OCR.space (birincil) + 2Captcha (fallback)
    const captchaApiKey = process.env.CAPTCHA_API_KEY || process.env.TWO_CAPTCHA_API_KEY;
    const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;

    if (!captchaApiKey && !ocrSpaceApiKey) {
      return NextResponse.json(
        { error: "Captcha API anahtarı yapılandırılmamış. Lütfen yöneticiyle iletişime geçin." },
        { status: 500 }
      );
    }

    // 7. Bot'a earsiv:query sinyali gönder
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "earsiv:query",
        data: {
          userid,
          password,
          startDate,
          endDate,
          customerName,
          captchaApiKey: captchaApiKey || "",
          ocrSpaceApiKey: ocrSpaceApiKey || undefined,
          userId: user.id, // PM-3: requesterId olarak kullanılacak
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
      message: `E-Arşiv sorgulaması başlatıldı (${customerName})`,
    });
  } catch (error) {
    console.error("[earsiv-query] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
