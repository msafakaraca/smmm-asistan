/**
 * INTVRG Beyanname PDF API Endpoint
 * ==================================
 * GET: Supabase Storage'dan signed URL ile PDF erişimi (ultra-hızlı)
 * POST: Electron Bot'a PDF indirme komutu veya toplu signed URL
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { getSignedUrl } from "@/lib/storage-supabase";

/**
 * GET /api/intvrg/beyanname-pdf?customerId=X&turKodu=Y&donem=Z
 * Supabase Storage'daki PDF için signed URL döner (proxy bypass — ultra hızlı)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const turKodu = searchParams.get("turKodu");
    const donem = searchParams.get("donem");

    if (!customerId || !turKodu || !donem) {
      return NextResponse.json(
        { error: "customerId, turKodu ve donem parametreleri zorunludur" },
        { status: 400 }
      );
    }

    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // Dosya adını oluştur
    const year = donem.substring(0, 4);
    const month = donem.substring(4, 6);
    const filename = `${customer.vknTckn}_${turKodu}_${year}-${month}_BEYANNAME.pdf`;

    // Document'ı bul
    const doc = await prisma.documents.findFirst({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory: "BEYANNAME",
        name: filename,
      },
      select: { path: true, name: true },
    });

    if (!doc || !doc.path) {
      return NextResponse.json(
        { error: "PDF bulunamadı. Henüz indirilmemiş olabilir.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    try {
      const signedUrl = await getSignedUrl(doc.path, 600);
      return NextResponse.json({ signedUrl, fileName: doc.name });
    } catch {
      // Document DB'de var ama dosya Storage'da yok
      return NextResponse.json(
        { error: "PDF dosyası storage'da bulunamadı. Sorgulama sayfasından tekrar sorgulayın.", code: "STORAGE_NOT_FOUND" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("[beyanname-pdf] GET hatası:", error);
    return NextResponse.json(
      { error: "PDF bilgisi alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intvrg/beyanname-pdf
 * Mode 1: { action: "bulk-signed", customerId, items } → Toplu signed URL
 * Mode 2: { customerId, beyoid, turAdi } → Bot'a PDF indirme komutu
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // 2. Request body parse
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
    }

    // Toplu signed URL modu
    if (body.action === "bulk-signed") {
      return handleBulkSigned(body, tenantId);
    }

    // Bot komutu modu
    const { customerId, beyoid, turAdi } = body as {
      customerId: string;
      beyoid: string;
      turAdi?: string;
    };

    if (!customerId || !beyoid) {
      return NextResponse.json(
        { error: "customerId ve beyoid zorunludur" },
        { status: 400 }
      );
    }

    // 3. Müşteri bilgilerini al — tenantId filtresi zorunlu
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, vknTckn: true, unvan: true, kisaltma: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // 4. Bot bağlantı kontrolü
    const port = process.env.PORT || "3000";
    try {
      const clientsResponse = await fetch(`http://localhost:${port}/_internal/clients`);
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        if ((clientsData.electronConnections ?? clientsData.totalConnections) === 0) {
          return NextResponse.json(
            { error: "Masaüstü uygulaması bağlı değil. Lütfen uygulamayı çalıştırın.", code: "BOT_NOT_CONNECTED" },
            { status: 503 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        { error: "Masaüstü uygulaması bağlı değil.", code: "BOT_NOT_CONNECTED" },
        { status: 503 }
      );
    }

    // 5. Bot'a intvrg:beyanname-pdf sinyali gönder
    const internalUrl = `http://localhost:${port}/_internal/bot-command`;
    const response = await fetch(internalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        type: "intvrg:beyanname-pdf",
        data: {
          beyoid,
          vkn: customer.vknTckn,
          turAdi: turAdi || "",
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

    return NextResponse.json({ success: true, message: "PDF indirme başlatıldı" });
  } catch (error) {
    console.error("[intvrg-beyanname-pdf] Beklenmeyen hata:", error);
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
  }
}

/**
 * Toplu signed URL oluşturma — preload için
 */
async function handleBulkSigned(
  body: { customerId: string; items: Array<{ turKodu: string; donem: string; beyoid: string }> },
  tenantId: string
) {
  const { customerId, items } = body;

  if (!customerId || !items?.length) {
    return NextResponse.json({ error: "customerId ve items zorunludur" }, { status: 400 });
  }

  const customer = await prisma.customers.findFirst({
    where: { id: customerId, tenantId },
    select: { vknTckn: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  // Dosya adlarını oluştur
  const itemsWithFilename = items.map(item => {
    const year = item.donem.substring(0, 4);
    const month = item.donem.substring(4, 6);
    return {
      ...item,
      filename: `${customer.vknTckn}_${item.turKodu}_${year}-${month}_BEYANNAME.pdf`,
    };
  });

  // Benzersiz dosya adları
  const uniqueFilenames = [...new Set(itemsWithFilename.map(i => i.filename))];

  // Toplu document sorgusu — tek DB çağrısı
  const docs = await prisma.documents.findMany({
    where: {
      customerId,
      tenantId,
      fileCategory: "BEYANNAME",
      name: { in: uniqueFilenames },
    },
    select: { path: true, name: true },
  });

  // filename → signed URL (paralel oluştur)
  const filenameToUrl = new Map<string, string>();
  await Promise.all(
    docs.map(async (doc) => {
      if (!doc.path) return;
      try {
        const url = await getSignedUrl(doc.path, 600);
        filenameToUrl.set(doc.name, url);
      } catch {
        // Dosya Storage'da yok — sessizce atla
      }
    })
  );

  // beyoid → signed URL eşlemesi
  const signedUrls: Record<string, string> = {};
  for (const item of itemsWithFilename) {
    const url = filenameToUrl.get(item.filename);
    if (url) signedUrls[item.beyoid] = url;
  }

  return NextResponse.json({ signedUrls });
}
