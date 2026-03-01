/**
 * KDV Kontrol API
 *
 * GET: KDV1 beyannamesi veren müşterilerin KDV kontrol verilerini getir
 * PUT: Status veya notes güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Belirli dönemdeki KDV kontrol verilerini getir
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

    // KDV1 beyannamesi veren müşterileri getir
    // verilmeyecekBeyannameler arrayinde "KDV1" olmayanları filtrele
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

    // KDV1 veren müşterileri filtrele
    const kdv1Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV1")
    );

    // Bu müşteriler için KDV kontrol kayıtlarını getir
    const kdvKontrolRecords = await prisma.kdv_kontrol.findMany({
      where: {
        tenantId,
        year,
        month,
        customerId: { in: kdv1Customers.map((c) => c.id) },
      },
    });

    // customerId -> kdv_kontrol map
    const kdvMap = new Map(kdvKontrolRecords.map((r) => [r.customerId, r]));

    // Dosya sayılarını getir (KDV1 tahakkuk + beyanname dosyaları)
    const customerIds = kdv1Customers.map((c) => c.id);

    const [tahakkukDocs, beyannameDocs] = await Promise.all([
      prisma.documents.findMany({
        where: {
          tenantId,
          customerId: { in: customerIds },
          year,
          month,
          isFolder: false,
          beyannameTuru: "KDV1",
          OR: [
            { fileCategory: { contains: "TAHAKKUK", mode: "insensitive" } },
            { type: { contains: "tahakkuk", mode: "insensitive" } },
          ],
        },
        select: { customerId: true },
      }),
      prisma.documents.findMany({
        where: {
          tenantId,
          customerId: { in: customerIds },
          year,
          month,
          isFolder: false,
          beyannameTuru: "KDV1",
          OR: [
            { fileCategory: { contains: "BEYANNAME", mode: "insensitive" } },
            { type: { contains: "beyanname", mode: "insensitive" } },
          ],
        },
        select: { customerId: true },
      }),
    ]);

    // customerId -> dosya sayısı map oluştur
    const tahakkukCountMap = new Map<string, number>();
    for (const doc of tahakkukDocs) {
      if (!doc.customerId) continue;
      tahakkukCountMap.set(doc.customerId, (tahakkukCountMap.get(doc.customerId) || 0) + 1);
    }

    const beyannameCountMap = new Map<string, number>();
    for (const doc of beyannameDocs) {
      if (!doc.customerId) continue;
      beyannameCountMap.set(doc.customerId, (beyannameCountMap.get(doc.customerId) || 0) + 1);
    }

    // Response formatı
    const result = kdv1Customers.map((customer) => {
      const kdv = kdvMap.get(customer.id);
      const fileCount = tahakkukCountMap.get(customer.id) || 0;
      const beyannameCount = beyannameCountMap.get(customer.id) || 0;

      // Status belirleme mantığı:
      // 1. Kullanıcı manuel status seçmişse (verildi, verilmeyecek) → onu kullan
      // 2. Dosya yoksa → "eksik"
      // 3. Dosya varsa ama henüz parse edilmemişse → "bekliyor"
      const manualStatuses = ["verildi", "verilmeyecek"];

      let effectiveStatus: string;
      if (kdv?.status && manualStatuses.includes(kdv.status)) {
        effectiveStatus = kdv.status;
      } else if (fileCount > 0 || beyannameCount > 0) {
        effectiveStatus = kdv?.status || "bekliyor";
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
        // KDV Kontrol bilgileri
        id: kdv?.id || null,
        kdvMatrah: kdv?.kdvMatrah ? Number(kdv.kdvMatrah) : null,
        tahakkukEden: kdv?.tahakkukEden ? Number(kdv.tahakkukEden) : null,
        mahsupEdilen: kdv?.mahsupEdilen ? Number(kdv.mahsupEdilen) : null,
        odenecek: kdv?.odenecek ? Number(kdv.odenecek) : null,
        devredenKdv: kdv?.devredenKdv ? Number(kdv.devredenKdv) : null,
        damgaVergisi: kdv?.damgaVergisi ? Number(kdv.damgaVergisi) : null,
        vade: kdv?.vade || null,
        beyanTarihi: kdv?.beyanTarihi || null,
        tahakkukDocumentId: kdv?.tahakkukDocumentId || null,
        status: effectiveStatus,
        notes: kdv?.notes || null,
        // Dosya sayıları
        tahakkukFileCount: fileCount,
        beyannameFileCount: beyannameCount,
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
    console.error("Error fetching KDV kontrol:", error);
    return NextResponse.json(
      { error: "KDV kontrol verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Zod schema - PUT request validation
const updateKdvKontrolSchema = z.object({
  customerId: z.string().uuid("Geçerli bir customerId gerekli"),
  year: z.number().int("Yıl tam sayı olmalı").min(2000, "Yıl en az 2000 olmalı"),
  month: z.number().int("Ay tam sayı olmalı").min(1, "Ay en az 1 olmalı").max(12, "Ay en fazla 12 olmalı"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// PUT - KDV kontrol kaydını güncelle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();

    // Zod validation
    const validation = updateKdvKontrolSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerId, year, month, status, notes } = validation.data;

    // Upsert
    const record = await prisma.kdv_kontrol.upsert({
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
    console.error("Error updating KDV kontrol:", error);
    return NextResponse.json(
      { error: "KDV kontrol güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}
