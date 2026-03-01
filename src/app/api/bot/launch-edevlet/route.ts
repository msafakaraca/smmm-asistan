/**
 * e-Devlet Kapısı Hızlı Giriş API Endpoint
 * ========================================
 * Dashboard'dan Electron Bot'a e-Devlet giriş sinyali gönderir.
 *
 * Kullanım:
 * - Meslek Mensubu ile giriş: {} (ayarlar>şifreler'den bilgiler alınır)
 * - Mükellef ile giriş: { customerId: '...' } (mükellef e-devlet bilgileri)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { z } from "zod";

// ============================================
// GUVENLIK: TCKN Validation
// ============================================
function isValidTCKN(tckn: string): boolean {
  if (!/^\d{11}$/.test(tckn)) return false;
  if (tckn[0] === '0') return false;

  const digits = tckn.split('').map(Number);

  // 10. hane kontrolu
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const check10 = ((oddSum * 7) - evenSum) % 10;
  if (check10 < 0 ? check10 + 10 !== digits[9] : check10 !== digits[9]) return false;

  // 11. hane kontrolu
  const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (sum10 % 10 !== digits[10]) return false;

  return true;
}

// Zod schema for input validation
const launchRequestSchema = z.object({
  customerId: z.string().uuid().optional(),
});

interface LaunchRequestBody {
  customerId?: string; // Mükellef ile giriş için
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body'den parametreleri al ve validate et
    let customerId: string | null = null;

    try {
      const body = await req.json();
      const validationResult = launchRequestSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Geçersiz istek parametreleri", details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      if (validationResult.data.customerId) {
        customerId = validationResult.data.customerId;
      }
    } catch {
      // Body yoksa veya parse edilemezse meslek mensubu ile giriş
    }

    // 3. Credentials'ı belirle (Mükellef veya Meslek Mensubu)
    let tckn: string;
    let password: string;
    let customerName: string | null = null;

    if (customerId) {
      // Mükellef ile giriş - müşterinin e-Devlet bilgilerini al
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, tenantId },
        select: {
          id: true,
          unvan: true,
          kisaltma: true,
          edevletTckn: true,
          edevletSifre: true,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Mükellef bulunamadı", code: "CUSTOMER_NOT_FOUND" },
          { status: 404 }
        );
      }

      if (!customer.edevletTckn || !customer.edevletSifre) {
        return NextResponse.json(
          {
            error: `${customer.kisaltma || customer.unvan} için e-Devlet bilgileri eksik`,
            code: "CUSTOMER_MISSING_EDEVLET_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      // Müşteri credentials'ını decrypt et
      try {
        tckn = decrypt(customer.edevletTckn);
        password = decrypt(customer.edevletSifre);
        customerName = customer.kisaltma || customer.unvan;

        // GUVENLIK: TCKN format validation
        if (!isValidTCKN(tckn)) {
          console.error("[launch-edevlet] Geçersiz TCKN formatı:", tckn.slice(0, 3) + "***");
          return NextResponse.json(
            { error: "Mükellef T.C. Kimlik No formatı geçersiz. Lütfen bilgileri kontrol edin." },
            { status: 400 }
          );
        }
      } catch (decryptError) {
        console.error("[launch-edevlet] Müşteri şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "Mükellef e-Devlet şifresi çözümlenemedi. Lütfen mükellef bilgilerini kontrol edin." },
          { status: 400 }
        );
      }
    } else {
      // Meslek Mensubu ile giriş - tenant'ın e-Devlet bilgilerini al
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { edevletSettings: true },
      });

      const edevletSettings: Record<string, unknown> = (tenant?.edevletSettings as Record<string, unknown>) || {};

      if (!edevletSettings.tckn || !edevletSettings.password) {
        return NextResponse.json(
          {
            error: "e-Devlet giriş bilgileri ayarlardan girilmeli",
            code: "MISSING_EDEVLET_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      tckn = edevletSettings.tckn as string;

      // GUVENLIK: TCKN format validation
      if (!isValidTCKN(tckn)) {
        console.error("[launch-edevlet] Geçersiz TCKN formatı (meslek mensubu)");
        return NextResponse.json(
          { error: "T.C. Kimlik No formatı geçersiz. Lütfen ayarlardan bilgilerinizi kontrol edin." },
          { status: 400 }
        );
      }

      try {
        password = decrypt(edevletSettings.password as string);
      } catch (decryptError) {
        console.error("[launch-edevlet] Şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "e-Devlet şifresi çözümlenemedi. Lütfen ayarlardan şifrenizi tekrar girin." },
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
      console.warn("[launch-edevlet] Bot bağlantı kontrolü yapılamadı");
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

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "edevlet:launch",
        data: {
          tckn,
          password,
          customerName,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-edevlet] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi. Electron uygulamasını kontrol edin." },
        { status: 502 }
      );
    }

    let message = "e-Devlet Kapısı başlatılıyor";
    if (customerName) {
      message += ` (${customerName})`;
    }
    message += "...";

    return NextResponse.json({
      success: true,
      message,
      customerId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-edevlet] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
