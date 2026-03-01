/**
 * INTVRG Vergi Tahsil Alındıları Sorgulama API Endpoint
 * =====================================================
 * Dashboard'dan Electron Bot'a tahsilat sorgulama sinyali gönderir.
 *
 * POST /api/intvrg/tahsilat
 * Body: { customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface TahsilatQueryRequest {
  customerId: string;
  basAy: string;  // "01"-"12"
  basYil: string;  // "2025"
  bitAy: string;
  bitYil: string;
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
    let body: TahsilatQueryRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    const { customerId, basAy, basYil, bitAy, bitYil } = body;

    if (!customerId || !basAy || !basYil || !bitAy || !bitYil) {
      return NextResponse.json(
        { error: "customerId, basAy, basYil, bitAy ve bitYil zorunludur" },
        { status: 400 }
      );
    }

    // Ay/Yıl format kontrolü
    const ayNum = parseInt(basAy, 10);
    const yilNum = parseInt(basYil, 10);
    const bitAyNum = parseInt(bitAy, 10);
    const bitYilNum = parseInt(bitYil, 10);
    if (
      isNaN(ayNum) || ayNum < 1 || ayNum > 12 ||
      isNaN(yilNum) || yilNum < 2000 ||
      isNaN(bitAyNum) || bitAyNum < 1 || bitAyNum > 12 ||
      isNaN(bitYilNum) || bitYilNum < 2000
    ) {
      return NextResponse.json(
        { error: "Geçersiz ay/yıl değerleri" },
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
        vknTckn: true,
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
      console.error("[intvrg-tahsilat] Müşteri şifre çözümleme hatası:", decryptError);
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
      console.warn("[intvrg-tahsilat] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED",
        },
        { status: 503 }
      );
    }

    // 6. Captcha API key'leri
    const captchaApiKey = process.env.CAPTCHA_API_KEY || process.env.TWO_CAPTCHA_API_KEY;
    const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;

    if (!captchaApiKey && !ocrSpaceApiKey) {
      return NextResponse.json(
        { error: "Captcha API anahtarı yapılandırılmamış. Lütfen yöneticiyle iletişime geçin." },
        { status: 500 }
      );
    }

    // 7. Bot'a intvrg:tahsilat-query sinyali gönder
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "intvrg:tahsilat-query",
        data: {
          userid,
          password,
          vkn: customer.vknTckn,
          basAy: basAy.padStart(2, '0'),
          basYil,
          bitAy: bitAy.padStart(2, '0'),
          bitYil,
          customerName,
          captchaApiKey: captchaApiKey || "",
          ocrSpaceApiKey: ocrSpaceApiKey || undefined,
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
      message: `Tahsilat sorgulaması başlatıldı (${customerName})`,
    });
  } catch (error) {
    console.error("[intvrg-tahsilat] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
