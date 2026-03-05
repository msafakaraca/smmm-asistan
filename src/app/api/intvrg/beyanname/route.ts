/**
 * INTVRG Beyanname Sorgulama API Endpoint
 * ========================================
 * Dashboard'dan Electron Bot'a beyanname sorgulama sinyali gönderir.
 *
 * POST /api/intvrg/beyanname
 * Body: { customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface BeyannameQueryRequest {
  customerId: string;
  basAy: string;  // "01"-"12"
  basYil: string;  // "2025"
  bitAy: string;
  bitYil: string;
  savedBeyoids?: string[];
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
    let body: BeyannameQueryRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    const { customerId, basAy, basYil, bitAy, bitYil, savedBeyoids } = body;

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

    // Başlangıç tarihi bitiş tarihinden büyük olamaz
    if (yilNum > bitYilNum || (yilNum === bitYilNum && ayNum > bitAyNum)) {
      return NextResponse.json(
        { error: "Başlangıç tarihi bitiş tarihinden büyük olamaz" },
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
      console.error("[intvrg-beyanname] Müşteri şifre çözümleme hatası:", decryptError);
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
      console.warn("[intvrg-beyanname] Bot bağlantı kontrolü yapılamadı");
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

    // 7. Bot'a beyanname sorgulama sinyali gönder
    // Çoklu yıl tespiti: basYil !== bitYil ise multi-query komutu kullan
    const isMultiYear = basYil !== bitYil;
    const commandType = isMultiYear ? "intvrg:beyanname-multi-query-and-download" : "intvrg:beyanname-query-and-download";
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: commandType,
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
          savedBeyoids: savedBeyoids || [],
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
      message: `Beyanname sorgulaması başlatıldı (${customerName})`,
    });
  } catch (error) {
    console.error("[intvrg-beyanname] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/intvrg/beyanname — Toplu Beyanname Sorgulama Başlatma
// ═══════════════════════════════════════════════════════════════════════════

interface BulkQueryRequest {
  customerIds: string[];
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    let body: BulkQueryRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
    }

    const { customerIds, basAy, basYil, bitAy, bitYil } = body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: "En az bir mükellef seçilmelidir" }, { status: 400 });
    }

    if (!basAy || !basYil || !bitAy || !bitYil) {
      return NextResponse.json({ error: "Dönem bilgileri zorunludur" }, { status: 400 });
    }

    // Bot bağlantı kontrolü
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`);
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if ((clientsData.electronConnections ?? clientsData.totalConnections) === 0) {
          return NextResponse.json({
            error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
            code: "BOT_NOT_CONNECTED",
          }, { status: 503 });
        }
      }
    } catch {
      return NextResponse.json({
        error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
        code: "BOT_NOT_CONNECTED",
      }, { status: 503 });
    }

    // Captcha API key'leri
    const captchaApiKey = process.env.CAPTCHA_API_KEY || process.env.TWO_CAPTCHA_API_KEY;
    const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;

    if (!captchaApiKey && !ocrSpaceApiKey) {
      return NextResponse.json({
        error: "Captcha API anahtarı yapılandırılmamış.",
      }, { status: 500 });
    }

    // Tüm mükellefleri tek sorguda al
    const customers = await prisma.customers.findMany({
      where: { id: { in: customerIds }, tenantId },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        gibKodu: true,
        gibSifre: true,
      },
    });

    if (customers.length === 0) {
      return NextResponse.json({ error: "Mükellef bulunamadı" }, { status: 404 });
    }

    // Credential'ları decrypt et ve hazırla
    const preparedCustomers: Array<{
      customerId: string;
      customerName: string;
      userid: string;
      password: string;
      vkn: string;
      savedBeyoids: string[];
    }> = [];

    const skippedCustomers: Array<{ id: string; name: string; reason: string }> = [];

    // Tüm mükelleflerin saved beyoid'lerini tek sorguda al
    const allArchives = await prisma.query_archives.findMany({
      where: {
        tenantId,
        customerId: { in: customerIds },
        queryType: "beyanname",
      },
      select: {
        customerId: true,
        resultData: true,
      },
    });

    // Mükellef bazlı beyoid map'i
    const savedBeyoidsByCustomer = new Map<string, string[]>();
    for (const archive of allArchives) {
      const data = archive.resultData;
      if (!Array.isArray(data)) continue;
      const existing = savedBeyoidsByCustomer.get(archive.customerId) || [];
      for (const item of data) {
        const record = item as Record<string, unknown>;
        if (record.beyoid && typeof record.beyoid === "string") {
          existing.push(record.beyoid);
        }
      }
      savedBeyoidsByCustomer.set(archive.customerId, existing);
    }

    for (const customer of customers) {
      if (!customer.gibKodu || !customer.gibSifre) {
        skippedCustomers.push({
          id: customer.id,
          name: customer.kisaltma || customer.unvan,
          reason: "GİB bilgileri eksik",
        });
        continue;
      }

      try {
        const userid = decrypt(customer.gibKodu);
        const password = decrypt(customer.gibSifre);
        preparedCustomers.push({
          customerId: customer.id,
          customerName: customer.kisaltma || customer.unvan,
          userid,
          password,
          vkn: customer.vknTckn,
          savedBeyoids: savedBeyoidsByCustomer.get(customer.id) || [],
        });
      } catch {
        skippedCustomers.push({
          id: customer.id,
          name: customer.kisaltma || customer.unvan,
          reason: "Şifre çözümleme hatası",
        });
      }
    }

    if (preparedCustomers.length === 0) {
      return NextResponse.json({
        error: "Sorgulanabilecek mükellef bulunamadı. Tüm mükelleflerin GİB bilgileri eksik.",
      }, { status: 400 });
    }

    // Bot'a toplu sorgulama sinyali gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;
    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "intvrg:beyanname-bulk-start",
        data: {
          customers: preparedCustomers,
          basAy: basAy.padStart(2, "0"),
          basYil,
          bitAy: bitAy.padStart(2, "0"),
          bitYil,
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
      message: `Toplu beyanname sorgulaması başlatıldı`,
      totalCustomers: preparedCustomers.length,
      skippedCustomers,
    });
  } catch (error) {
    console.error("[intvrg-beyanname-bulk] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
