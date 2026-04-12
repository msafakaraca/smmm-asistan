/**
 * INTVRG Vergi Levhası API
 * ========================
 * GET: Mükellef vergi levhası durumlarını döner
 * POST: Vergi levhası sonucunu kaydet (PDF + metadata)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile } from "@/lib/storage-supabase";
import { getOrCreateFolderSafe } from "@/lib/file-system";
import { Prisma } from "@prisma/client";

/**
 * GET /api/intvrg/vergi-levhasi?customerId=xxx (opsiyonel)
 * Tüm veya tek mükellef vergi levhası kayıtlarını döner
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      queryType: "vergiLevhasi",
    };
    if (customerId) {
      where.customerId = customerId;
    }

    const archives = await prisma.query_archives.findMany({
      where,
      select: {
        customerId: true,
        resultData: true,
        lastQueriedAt: true,
        year: true,
        month: true,
      },
      orderBy: { lastQueriedAt: "desc" },
    });

    return NextResponse.json({ items: archives });
  } catch (error) {
    console.error("[vergi-levhasi] GET hatası:", error);
    return NextResponse.json(
      { error: "Vergi levhası durumu alınamadı" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/intvrg/vergi-levhasi
 * Tek mükellef vergi levhası sonucunu kaydet
 * Body: { customerId, onayKodu, onayZamani, vergiTuru, vergiDairesi, unvan, pdfBase64 }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, onayKodu, onayZamani, vergiTuru, vergiDairesi, unvan, pdfBase64 } = body;

    if (!customerId || !onayKodu || !pdfBase64) {
      return NextResponse.json(
        { error: "customerId, onayKodu ve pdfBase64 zorunludur" },
        { status: 400 }
      );
    }

    // Müşteri kontrolü + tenantId filtresi
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true, vknTckn: true, unvan: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    const buffer = Buffer.from(pdfBase64, "base64");
    const filename = `${customer.vknTckn}_VERGILEVHASI_${onayKodu}.pdf`;

    // Duplicate check
    const existingDoc = await prisma.documents.findFirst({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory: "VERGI_LEVHASI",
        name: filename,
      },
      select: { id: true },
    });

    if (existingDoc) {
      // Zaten kayıtlı — arşiv güncelle ve dön
      await upsertArchive(user.tenantId, user.id, customerId, {
        onayKodu,
        onayZamani,
        vergiTuru,
        vergiDairesi,
        unvan,
      });

      return NextResponse.json({
        saved: false,
        skipped: true,
        documentId: existingDoc.id,
        message: "Bu vergi levhası zaten kayıtlı",
      });
    }

    // Storage path: {tenantId}/{customerId}/VergiLevhasi/{onayKodu}.pdf
    const storagePath = `${user.tenantId}/${customerId}/VergiLevhasi/${onayKodu}.pdf`;

    // Klasör zinciri: Müşteri Kök → Vergi Levhası
    const customerRoot = await prisma.documents.findFirst({
      where: {
        tenantId: user.tenantId,
        customerId,
        isFolder: true,
        parentId: null,
      },
      select: { id: true },
    });

    let parentFolderId: string | null = null;
    if (customerRoot) {
      parentFolderId = await getOrCreateFolderSafe(
        user.tenantId,
        customerId,
        customerRoot.id,
        "Vergi Levhası",
        "VERGI_LEVHASI"
      );
    }

    // Onay zamanından yıl/ay parse et: "09/03/2026 03:14:30" → year=2026, month=3
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    if (onayZamani) {
      const parts = onayZamani.split(" ")[0]?.split("/");
      if (parts?.length === 3) {
        year = parseInt(parts[2], 10) || year;
        month = parseInt(parts[1], 10) || month;
      }
    }

    // Supabase Storage'a yükle
    await adminUploadFile(storagePath, buffer, "application/pdf");

    // Document kaydı oluştur
    const doc = await prisma.documents.create({
      data: {
        name: filename,
        originalName: `Vergi Levhası - ${unvan || customer.unvan} (${onayZamani || onayKodu})`,
        type: "pdf",
        mimeType: "application/pdf",
        size: buffer.length,
        path: storagePath,
        storage: "supabase",
        year,
        month,
        vknTckn: customer.vknTckn,
        fileCategory: "VERGI_LEVHASI",
        customerId,
        tenantId: user.tenantId,
        parentId: parentFolderId,
      },
    });

    // Arşiv kaydı
    await upsertArchive(user.tenantId, user.id, customerId, {
      onayKodu,
      onayZamani,
      vergiTuru,
      vergiDairesi,
      unvan,
    });

    return NextResponse.json({
      saved: true,
      skipped: false,
      documentId: doc.id,
    });
  } catch (error) {
    console.error("[vergi-levhasi] POST hatası:", error);
    return NextResponse.json(
      { error: "Vergi levhası kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * query_archives tablosuna vergi levhası kaydı upsert
 */
async function upsertArchive(
  tenantId: string,
  userId: string,
  customerId: string,
  data: {
    onayKodu: string;
    onayZamani?: string;
    vergiTuru?: string;
    vergiDairesi?: string;
    unvan?: string;
  }
) {
  // Onay zamanından yıl/ay parse et
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  if (data.onayZamani) {
    const parts = data.onayZamani.split(" ")[0]?.split("/");
    if (parts?.length === 3) {
      year = parseInt(parts[2], 10) || year;
      month = parseInt(parts[1], 10) || month;
    }
  }

  const newEntry = {
    onayKodu: data.onayKodu,
    onayZamani: data.onayZamani,
    vergiTuru: data.vergiTuru,
    vergiDairesi: data.vergiDairesi,
    unvan: data.unvan,
  };

  // Mevcut arşiv var mı kontrol et
  const existing = await prisma.query_archives.findUnique({
    where: {
      tenantId_customerId_queryType_month_year: {
        tenantId,
        customerId,
        queryType: "vergiLevhasi",
        month,
        year,
      },
    },
    select: { id: true, resultData: true, queryCount: true },
  });

  if (existing) {
    // Mevcut resultData'dan duplicate onayKodu kontrol
    const existingData = (existing.resultData as unknown[]) || [];
    const alreadyHas = existingData.some(
      (item: unknown) => (item as { onayKodu?: string }).onayKodu === data.onayKodu
    );

    if (!alreadyHas) {
      await prisma.query_archives.update({
        where: { id: existing.id },
        data: {
          resultData: [...existingData, newEntry] as unknown as Prisma.InputJsonValue,
          totalCount: existingData.length + 1,
          queryCount: (existing.queryCount || 0) + 1,
          lastQueriedAt: new Date(),
        },
      });
    } else {
      // Sadece tarih güncelle
      await prisma.query_archives.update({
        where: { id: existing.id },
        data: { lastQueriedAt: new Date() },
      });
    }
  } else {
    await prisma.query_archives.create({
      data: {
        tenantId,
        customerId,
        userId,
        queryType: "vergiLevhasi",
        month,
        year,
        resultData: [newEntry] as unknown as Prisma.InputJsonValue,
        resultMeta: Prisma.JsonNull,
        totalCount: 1,
        queryCount: 1,
        lastQueriedAt: new Date(),
      },
    });
  }
}
