/**
 * KDV2 Kontrol API
 *
 * GET: KDV2 beyannamesi veren müşterilerin KDV2 kontrol verilerini getir
 * PUT: Status veya notes güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Belirli dönemdeki KDV2 kontrol verilerini getir
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") || new Date().getFullYear().toString()
    );
    const month = parseInt(
      searchParams.get("month") || (new Date().getMonth() + 1).toString()
    );
    const customerId = searchParams.get("customerId");

    // KDV2 beyannamesi veren müşterileri getir
    // verilmeyecekBeyannameler arrayinde "KDV2" olmayanları filtrele
    const customersQuery: {
      tenantId: string;
      status: string;
      id?: string;
    } = {
      tenantId,
      status: "active",
    };

    if (customerId) {
      customersQuery.id = customerId;
    }

    const customers = await prisma.customers.findMany({
      where: customersQuery,
      select: {
        id: true,
        unvan: true,
        siraNo: true,
        vknTckn: true,
        sirketTipi: true,
        verilmeyecekBeyannameler: true,
      },
      orderBy: [{ siraNo: "asc" }, { unvan: "asc" }],
    });

    // KDV2 veren müşterileri filtrele
    const kdv2Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV2")
    );

    // Bu müşteriler için KDV2 kontrol kayıtlarını getir
    const kdv2KontrolRecords = await prisma.kdv2_kontrol.findMany({
      where: {
        tenantId,
        year,
        month,
        customerId: { in: kdv2Customers.map((c) => c.id) },
      },
    });

    // customerId -> kdv2_kontrol map
    const kdv2Map = new Map(kdv2KontrolRecords.map((r) => [r.customerId, r]));

    // Dosya sayılarını getir (KDV2 tahakkuk + beyanname dosyaları)
    const customerIds = kdv2Customers.map((c) => c.id);

    const documents = await prisma.documents.findMany({
      where: {
        tenantId,
        customerId: { in: customerIds },
        year,
        month,
        isFolder: false,
        beyannameTuru: "KDV2",
      },
      select: {
        customerId: true,
        fileCategory: true,
        type: true,
      },
    });

    // customerId -> tahakkuk/beyanname dosya sayısı map oluştur
    const tahakkukCountMap = new Map<string, number>();
    const beyannameCountMap = new Map<string, number>();

    for (const doc of documents) {
      if (!doc.customerId) continue;

      const category = (doc.fileCategory || "").toUpperCase();
      const docType = (doc.type || "").toLowerCase();

      if (category.includes("TAHAKKUK") || docType.includes("tahakkuk")) {
        tahakkukCountMap.set(doc.customerId, (tahakkukCountMap.get(doc.customerId) || 0) + 1);
      } else if (category.includes("BEYANNAME") || docType.includes("beyanname")) {
        beyannameCountMap.set(doc.customerId, (beyannameCountMap.get(doc.customerId) || 0) + 1);
      }
    }

    // Response formatı
    const result = kdv2Customers.map((customer) => {
      const kdv2 = kdv2Map.get(customer.id);
      const tahakkukFileCount = tahakkukCountMap.get(customer.id) || 0;
      const beyannameFileCount = beyannameCountMap.get(customer.id) || 0;
      const fileCount = tahakkukFileCount + beyannameFileCount;

      // Status belirleme mantığı:
      // 1. Kullanıcı manuel status seçmişse (verildi, verilmeyecek) → onu kullan
      // 2. Dosya yoksa → "eksik"
      // 3. Dosya varsa ama henüz parse edilmemişse → "bekliyor"
      const manualStatuses = ["verildi", "verilmeyecek"];

      let effectiveStatus: string;
      if (kdv2?.status && manualStatuses.includes(kdv2.status)) {
        effectiveStatus = kdv2.status;
      } else if (fileCount > 0) {
        effectiveStatus = kdv2?.status || "bekliyor";
      } else {
        effectiveStatus = "eksik";
      }

      return {
        customerId: customer.id,
        unvan: customer.unvan,
        siraNo: customer.siraNo,
        vknTckn: customer.vknTckn,
        sirketTipi: customer.sirketTipi,
        year,
        month,
        // KDV2 Kontrol bilgileri
        id: kdv2?.id || null,
        kdvMatrah: kdv2?.kdvMatrah ? Number(kdv2.kdvMatrah) : null,
        tahakkukEden: kdv2?.tahakkukEden ? Number(kdv2.tahakkukEden) : null,
        mahsupEdilen: kdv2?.mahsupEdilen ? Number(kdv2.mahsupEdilen) : null,
        odenecek: kdv2?.odenecek ? Number(kdv2.odenecek) : null,
        devredenKdv: kdv2?.devredenKdv ? Number(kdv2.devredenKdv) : null,
        damgaVergisi: kdv2?.damgaVergisi ? Number(kdv2.damgaVergisi) : null,
        vade: kdv2?.vade || null,
        beyanTarihi: kdv2?.beyanTarihi || null,
        tahakkukDocumentId: kdv2?.tahakkukDocumentId || null,
        status: effectiveStatus,
        notes: kdv2?.notes || null,
        // Dosya sayıları
        tahakkukFileCount,
        beyannameFileCount,
      };
    });

    // siraNo'ya göre sayısal sıralama (küçükten büyüğe)
    // siraNo null veya boş olanlar en sona
    result.sort((a, b) => {
      const aNum = a.siraNo ? parseInt(a.siraNo, 10) : Infinity;
      const bNum = b.siraNo ? parseInt(b.siraNo, 10) : Infinity;

      // NaN kontrolü
      const aVal = isNaN(aNum) ? Infinity : aNum;
      const bVal = isNaN(bNum) ? Infinity : bNum;

      if (aVal === bVal) {
        // siraNo eşitse unvan'a göre sırala
        return (a.unvan || "").localeCompare(b.unvan || "", "tr");
      }
      return aVal - bVal;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching KDV2 kontrol:", error);
    return NextResponse.json(
      { error: "KDV-2 kontrol verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Zod schema - PUT request validation
const updateKdv2KontrolSchema = z.object({
  customerId: z.string().uuid("Geçerli bir customerId gerekli"),
  year: z.number().int("Yıl tam sayı olmalı").min(2000, "Yıl en az 2000 olmalı"),
  month: z.number().int("Ay tam sayı olmalı").min(1, "Ay en az 1 olmalı").max(12, "Ay en fazla 12 olmalı"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// PUT - KDV2 kontrol kaydını güncelle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();

    // Zod validation
    const validation = updateKdv2KontrolSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerId, year, month, status, notes } = validation.data;

    // Upsert
    const record = await prisma.kdv2_kontrol.upsert({
      where: {
        customerId_year_month: { customerId, year, month },
      },
      update: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
      create: {
        tenantId,
        customerId,
        year,
        month,
        status: status || "bekliyor",
        notes: notes || null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error updating KDV2 kontrol:", error);
    return NextResponse.json(
      { error: "KDV-2 kontrol güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}
