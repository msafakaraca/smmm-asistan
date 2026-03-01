/**
 * GİB Uygulama Hızlı Giriş API Endpoint
 * =====================================
 * Dashboard'dan Electron Bot'a uygulama başlatma sinyali gönderir.
 * Desteklenen uygulamalar: ivd, ebeyanname
 *
 * Kullanım:
 * - Meslek Mensubu ile giriş: { application: 'ivd' | 'ebeyanname' }
 * - Mükellef ile giriş: { application: 'ivd', customerId: '...', targetPage: 'borc-sorgulama' }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

// Desteklenen uygulamalar
const SUPPORTED_APPS = ['ivd', 'interaktifvd', 'ebeyanname', 'defter-beyan', 'ebeyan', 'earsiv', 'edefter'] as const;
type GibApplication = typeof SUPPORTED_APPS[number];

// Desteklenen hedef sayfalar
const SUPPORTED_TARGET_PAGES = ['borc-sorgulama', 'odemelerim', 'emanet-defterim', 'e-tebligat', 'vergi-levhasi'] as const;
type IvdTargetPage = typeof SUPPORTED_TARGET_PAGES[number];

// Vergi levhası dil seçenekleri
type VergiLevhasiDil = 'tr' | 'en';
// Vergi levhası yıl seçenekleri
type VergiLevhasiYil = '2023' | '2024' | '2025' | '2026';

interface LaunchRequestBody {
  application?: GibApplication;
  customerId?: string;      // Mükellef ile giriş için
  targetPage?: IvdTargetPage; // İVD sonrası hedef sayfa
  vergiLevhasiYil?: VergiLevhasiYil; // Vergi levhası yılı
  vergiLevhasiDil?: VergiLevhasiDil; // Vergi levhası dili (tr/en)
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body'den parametreleri al
    let application: GibApplication = 'ivd';
    let customerId: string | null = null;
    let targetPage: IvdTargetPage | null = null;
    let vergiLevhasiYil: VergiLevhasiYil | null = null;
    let vergiLevhasiDil: VergiLevhasiDil | null = null;

    try {
      const body: LaunchRequestBody = await req.json();
      if (body.application && SUPPORTED_APPS.includes(body.application)) {
        application = body.application;
      }
      if (body.customerId) {
        customerId = body.customerId;
      }
      if (body.targetPage && SUPPORTED_TARGET_PAGES.includes(body.targetPage)) {
        targetPage = body.targetPage;
      }
      if (body.vergiLevhasiYil && ['2023', '2024', '2025', '2026'].includes(body.vergiLevhasiYil)) {
        vergiLevhasiYil = body.vergiLevhasiYil;
      }
      if (body.vergiLevhasiDil && ['tr', 'en'].includes(body.vergiLevhasiDil)) {
        vergiLevhasiDil = body.vergiLevhasiDil;
      }
    } catch {
      // Body yoksa veya parse edilemezse default değerler kullan
    }

    // 3. Credentials'ı belirle (Mükellef veya Meslek Mensubu)
    let userid: string;
    let password: string;
    let customerName: string | null = null;

    if (customerId) {
      // Mükellef ile giriş - müşterinin GİB bilgilerini al
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, tenantId },
        select: {
          id: true,
          unvan: true,
          kisaltma: true,
          gibKodu: true,
          gibSifre: true
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Mükellef bulunamadı", code: "CUSTOMER_NOT_FOUND" },
          { status: 404 }
        );
      }

      if (!customer.gibKodu || !customer.gibSifre) {
        return NextResponse.json(
          {
            error: `${customer.kisaltma || customer.unvan} için GİB bilgileri eksik`,
            code: "CUSTOMER_MISSING_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      // Müşteri credentials'ını decrypt et
      try {
        userid = decrypt(customer.gibKodu);
        password = decrypt(customer.gibSifre);
        customerName = customer.kisaltma || customer.unvan;
      } catch (decryptError) {
        console.error("[launch-gib] Müşteri şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "Mükellef GİB şifresi çözümlenemedi. Lütfen mükellef bilgilerini kontrol edin." },
          { status: 400 }
        );
      }
    } else {
      // Meslek Mensubu ile giriş - tenant'ın GİB bilgilerini al
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { gibSettings: true },
      });

      const gibSettings: Record<string, unknown> = (tenant?.gibSettings as Record<string, unknown>) || {};

      if (!gibSettings.gibCode || !gibSettings.gibPassword) {
        return NextResponse.json(
          {
            error: "GİB giriş bilgileri ayarlardan girilmeli",
            code: "MISSING_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      userid = gibSettings.gibCode as string;
      try {
        password = decrypt(gibSettings.gibPassword as string);
      } catch (decryptError) {
        console.error("[launch-gib] Şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "GİB şifresi çözümlenemedi. Lütfen ayarlardan şifrenizi tekrar girin." },
          { status: 400 }
        );
      }
    }

    // 4. Bot bağlantı kontrolü (Electron client bağlı mı?)
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
      console.warn("[launch-gib] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED"
        },
        { status: 503 }
      );
    }

    // 5. Internal API ile bot'a sinyal gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    // E-Arşiv için farklı event tipi kullan
    const eventType = application === 'earsiv' ? 'earsiv:launch' : 'gib:launch';

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: eventType,
        data: {
          userid,
          password,
          application,
          targetPage,
          customerName,
          vergiLevhasiYil,
          vergiLevhasiDil,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-gib] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi. Electron uygulamasını kontrol edin." },
        { status: 502 }
      );
    }

    // Uygulama isimlerini Türkçe olarak döndür
    const appNames: Record<GibApplication, string> = {
      ivd: 'İnternet Vergi Dairesi',
      interaktifvd: 'İnteraktif Vergi Dairesi',
      ebeyanname: 'E-Beyanname',
      'defter-beyan': 'Defter Beyan Sistemi',
      'ebeyan': 'e-Beyan Sistemi',
      'earsiv': 'E-Arşiv Portal (GİB 5000/2000)',
      'edefter': 'E-Defter Sistemi',
    };

    const targetPageNames: Record<IvdTargetPage, string> = {
      'borc-sorgulama': 'Borç Ödeme ve Detay',
      'odemelerim': 'Ödemelerim ve Alındılarım',
      'emanet-defterim': 'Emanet Defterim',
      'e-tebligat': 'e-Tebligat',
      'vergi-levhasi': 'Vergi Levhası',
    };

    let message = `${appNames[application]} başlatılıyor`;
    if (customerName) {
      message += ` (${customerName})`;
    }
    if (targetPage) {
      message += ` → ${targetPageNames[targetPage]}`;
    }
    message += '...';

    return NextResponse.json({
      success: true,
      message,
      application,
      customerId,
      targetPage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-gib] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
