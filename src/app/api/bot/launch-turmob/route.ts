/**
 * TÜRMOB Luca E-Entegratör Hızlı Giriş API Endpoint
 * ==================================================
 * Dashboard'dan Electron Bot'a TÜRMOB Luca başlatma sinyali gönderir.
 * Mükellef'in TÜRMOB bilgilerini (turmobKullaniciAdi, turmobSifre) kullanır.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface LaunchRequestBody {
  customerId: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body'den customerId al
    let customerId: string;

    try {
      const body: LaunchRequestBody = await req.json();
      if (!body.customerId) {
        return NextResponse.json(
          { error: "Mükellef ID gerekli", code: "MISSING_CUSTOMER_ID" },
          { status: 400 }
        );
      }
      customerId = body.customerId;
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek formatı" },
        { status: 400 }
      );
    }

    // 3. Mükellef'in TÜRMOB bilgilerini al
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        turmobKullaniciAdi: true,
        turmobSifre: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Mükellef bulunamadı", code: "CUSTOMER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!customer.turmobKullaniciAdi || !customer.turmobSifre) {
      return NextResponse.json(
        {
          error: `${customer.kisaltma || customer.unvan} için TÜRMOB bilgileri eksik`,
          code: "CUSTOMER_MISSING_TURMOB_CREDENTIALS"
        },
        { status: 400 }
      );
    }

    // 4. Credentials decrypt
    let userid: string;
    let password: string;

    try {
      userid = decrypt(customer.turmobKullaniciAdi);
      password = decrypt(customer.turmobSifre);
    } catch (decryptError) {
      console.error("[launch-turmob] Şifre çözümleme hatası:", decryptError);
      return NextResponse.json(
        { error: "TÜRMOB şifresi çözümlenemedi. Lütfen mükellef bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    const customerName = customer.kisaltma || customer.unvan;

    // 5. Bot bağlantı kontrolü (Electron client bağlı mı?)
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
      console.warn("[launch-turmob] Bot bağlantı kontrolü yapılamadı");
      return NextResponse.json(
        {
          error: "SMMM Asistan masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.",
          code: "BOT_NOT_CONNECTED"
        },
        { status: 503 }
      );
    }

    // 6. Internal API ile bot'a sinyal gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;

    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "turmob:launch",
        data: {
          userid,
          password,
          customerName,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[launch-turmob] Internal API hatası:", errorText);
      return NextResponse.json(
        { error: "Bot'a komut gönderilemedi. Electron uygulamasını kontrol edin." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `TÜRMOB Luca başlatılıyor (${customerName})...`,
      customerId,
      customerName,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Sunucu hatası";
    console.error("[launch-turmob] Hata:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
