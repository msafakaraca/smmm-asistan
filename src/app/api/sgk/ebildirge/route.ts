/**
 * SGK E-Bildirge Sorgulama API Endpoint
 * ======================================
 * Dashboard'dan Electron Bot'a SGK E-Bildirge sorgulama sinyali gönderir.
 *
 * POST /api/sgk/ebildirge
 * Body: { customerId, basAy, basYil, bitAy, bitYil, branchId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface EbildirgeQueryRequest {
  customerId: string;
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
  branchId?: string;
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
    let body: EbildirgeQueryRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
    }

    const { customerId, basAy, basYil, bitAy, bitYil, branchId } = body;

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
      return NextResponse.json({ error: "Geçersiz ay/yıl değerleri" }, { status: 400 });
    }

    // Başlangıç tarihi bitiş tarihinden büyük olamaz
    if (yilNum > bitYilNum || (yilNum === bitYilNum && ayNum > bitAyNum)) {
      return NextResponse.json(
        { error: "Başlangıç tarihi bitiş tarihinden büyük olamaz" },
        { status: 400 }
      );
    }

    // 3. Müşteri bilgilerini al — tenantId filtresi zorunlu, SGK credential'ları + branch'ler
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        sgkKullaniciAdi: true,
        sgkIsyeriKodu: true,
        sgkSistemSifresi: true,
        sgkIsyeriSifresi: true,
        customer_branches: {
          select: {
            id: true,
            branchName: true,
            sgkKullaniciAdi: true,
            sgkIsyeriKodu: true,
            sgkSistemSifresi: true,
            sgkIsyeriSifresi: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Müşteri bulunamadı", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 4. Credential'ları belirle — branch varsa branch'ten, yoksa customer'dan al
    let kullaniciAdi: string | null = null;
    let isyeriKodu: string | null = null;
    let sistemSifresi: string | null = null;
    let isyeriSifresi: string | null = null;

    if (branchId) {
      const branch = customer.customer_branches.find((b) => b.id === branchId);
      if (!branch) {
        return NextResponse.json(
          { error: "Seçilen şube bulunamadı", code: "BRANCH_NOT_FOUND" },
          { status: 404 }
        );
      }
      kullaniciAdi = branch.sgkKullaniciAdi;
      isyeriKodu = branch.sgkIsyeriKodu;
      sistemSifresi = branch.sgkSistemSifresi;
      isyeriSifresi = branch.sgkIsyeriSifresi;
    } else {
      kullaniciAdi = customer.sgkKullaniciAdi;
      isyeriKodu = customer.sgkIsyeriKodu;
      sistemSifresi = customer.sgkSistemSifresi;
      isyeriSifresi = customer.sgkIsyeriSifresi;
    }

    // Credential varlık kontrolü
    if (!kullaniciAdi || !sistemSifresi) {
      return NextResponse.json(
        {
          error: `${customer.kisaltma || customer.unvan} için SGK E-Bildirge bilgileri eksik. Şifreler sayfasından SGK bilgilerini girin.`,
          code: "CUSTOMER_MISSING_CREDENTIALS",
        },
        { status: 400 }
      );
    }

    // 5. Credential'ları decrypt et
    let decryptedKullaniciAdi: string;
    let decryptedIsyeriKodu: string | undefined;
    let decryptedSistemSifresi: string;
    let decryptedIsyeriSifresi: string | undefined;
    try {
      decryptedKullaniciAdi = decrypt(kullaniciAdi);
      decryptedIsyeriKodu = isyeriKodu ? decrypt(isyeriKodu) : undefined;
      decryptedSistemSifresi = decrypt(sistemSifresi);
      decryptedIsyeriSifresi = isyeriSifresi ? decrypt(isyeriSifresi) : undefined;
    } catch (decryptError) {
      console.error("[sgk-ebildirge] Müşteri SGK şifre çözümleme hatası:", decryptError);
      return NextResponse.json(
        { error: "Mükellef SGK şifresi çözümlenemedi. Lütfen mükellef bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    // 6. Bot bağlantı kontrolü
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
      console.warn("[sgk-ebildirge] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED",
        },
        { status: 503 }
      );
    }

    // 7. Captcha API key'leri
    const captchaApiKey = process.env.CAPTCHA_API_KEY || process.env.TWO_CAPTCHA_API_KEY;
    const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;

    if (!captchaApiKey && !ocrSpaceApiKey) {
      return NextResponse.json(
        { error: "Captcha API anahtarı yapılandırılmamış. Lütfen yöneticiyle iletişime geçin." },
        { status: 500 }
      );
    }

    // 8. Bot'a SGK E-Bildirge sorgulama sinyali gönder
    const customerName = customer.kisaltma || customer.unvan;
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "sgk:ebildirge-query-and-download",
        data: {
          credentials: {
            kullaniciAdi: decryptedKullaniciAdi,
            isyeriKodu: decryptedIsyeriKodu,
            sistemSifresi: decryptedSistemSifresi,
            isyeriSifresi: decryptedIsyeriSifresi,
          },
          startMonth: parseInt(basAy, 10),
          startYear: parseInt(basYil, 10),
          endMonth: parseInt(bitAy, 10),
          endYear: parseInt(bitYil, 10),
          captchaApiKey: captchaApiKey || "",
          ocrSpaceApiKey: ocrSpaceApiKey || undefined,
          customerName,
          customerId,
          vkn: customer.vknTckn,
          requesterId: user.id,
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
      message: `SGK E-Bildirge sorgulaması başlatıldı (${customerName})`,
    });
  } catch (error) {
    console.error("[sgk-ebildirge] Beklenmeyen hata:", error);
    return NextResponse.json(
      { error: "Beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
