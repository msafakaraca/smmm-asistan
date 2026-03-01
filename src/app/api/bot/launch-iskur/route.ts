/**
 * İŞKUR İşveren Sistemi Giriş API Endpoint
 * ==========================================
 * Dashboard'dan Electron Bot'a İŞKUR giriş sinyali gönderir.
 *
 * İki giriş yöntemi:
 * - İŞKUR bilgileriyle: iskurTckn + iskurSifre
 * - E-Devlet ile: edevletTckn + edevletSifre
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { z } from "zod";

// TCKN Validation
function isValidTCKN(tckn: string): boolean {
  if (!/^\d{11}$/.test(tckn)) return false;
  if (tckn[0] === '0') return false;

  const digits = tckn.split('').map(Number);

  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const check10 = ((oddSum * 7) - evenSum) % 10;
  if (check10 < 0 ? check10 + 10 !== digits[9] : check10 !== digits[9]) return false;

  const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (sum10 % 10 !== digits[10]) return false;

  return true;
}

const launchRequestSchema = z.object({
  customerId: z.string().uuid(),
  loginMethod: z.enum(["iskur", "edevlet"]),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body validate
    const body = await req.json();
    const validationResult = launchRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Geçersiz istek parametreleri", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { customerId, loginMethod } = validationResult.data;

    // 3. Customer fetch (tenantId filtreli)
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        iskurTckn: true,
        iskurSifre: true,
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

    const customerName = customer.kisaltma || customer.unvan;

    // 4. Credential check ve decrypt (loginMethod'a göre)
    let tckn: string;
    let password: string;

    if (loginMethod === "iskur") {
      if (!customer.iskurTckn || !customer.iskurSifre) {
        return NextResponse.json(
          {
            error: `${customerName} için İŞKUR bilgileri eksik`,
            code: "CUSTOMER_MISSING_ISKUR_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      try {
        tckn = decrypt(customer.iskurTckn);
        password = decrypt(customer.iskurSifre);
      } catch (decryptError) {
        console.error("[launch-iskur] İŞKUR şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "İŞKUR şifresi çözümlenemedi. Lütfen bilgileri kontrol edin." },
          { status: 400 }
        );
      }
    } else {
      // E-Devlet ile giriş
      if (!customer.edevletTckn || !customer.edevletSifre) {
        return NextResponse.json(
          {
            error: `${customerName} için e-Devlet bilgileri eksik`,
            code: "CUSTOMER_MISSING_EDEVLET_CREDENTIALS"
          },
          { status: 400 }
        );
      }

      try {
        tckn = decrypt(customer.edevletTckn);
        password = decrypt(customer.edevletSifre);
      } catch (decryptError) {
        console.error("[launch-iskur] e-Devlet şifre çözümleme hatası:", decryptError);
        return NextResponse.json(
          { error: "e-Devlet şifresi çözümlenemedi. Lütfen bilgileri kontrol edin." },
          { status: 400 }
        );
      }
    }

    // 5. TCKN format validation
    if (!isValidTCKN(tckn)) {
      console.error("[launch-iskur] Geçersiz TCKN formatı (customerId:", customerId, ")");
      return NextResponse.json(
        { error: "T.C. Kimlik No formatı geçersiz. Lütfen bilgileri kontrol edin." },
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
              code: "BOT_NOT_CONNECTED"
            },
            { status: 503 }
          );
        }
      }
    } catch {
      console.warn("[launch-iskur] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED"
        },
        { status: 503 }
      );
    }

    // 7. Internal API ile bot'a sinyal gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "iskur:launch",
        data: {
          tckn,
          password,
          loginMethod,
          customerName,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-iskur] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi. Electron uygulamasını kontrol edin." },
        { status: 502 }
      );
    }

    const methodLabel = loginMethod === "iskur" ? "İŞKUR bilgileriyle" : "E-Devlet ile";

    return NextResponse.json({
      success: true,
      message: `İŞKUR İşveren Sistemi ${methodLabel} başlatılıyor (${customerName})...`,
      customerId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-iskur] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
