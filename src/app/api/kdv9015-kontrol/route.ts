/**
 * KDV9015 Kontrol API (KDV Tevkifat)
 *
 * GET: KDV9015 beyannamesi veren musterilerin KDV9015 kontrol verilerini getir
 * PUT: Status veya notes guncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Belirli donemdeki KDV9015 kontrol verilerini getir
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

    // KDV9015 beyannamesi veren musterileri getir
    // verilmeyecekBeyannameler arrayinde "KDV9015" olmayanlari filtrele
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

    // KDV9015 veren musterileri filtrele
    const kdv9015Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV9015")
    );

    // Bu musteriler icin KDV9015 kontrol kayitlarini getir
    const kdv9015KontrolRecords = await prisma.kdv9015_kontrol.findMany({
      where: {
        tenantId,
        year,
        month,
        customerId: { in: kdv9015Customers.map((c) => c.id) },
      },
    });

    // customerId -> kdv9015_kontrol map
    const kdv9015Map = new Map(kdv9015KontrolRecords.map((r) => [r.customerId, r]));

    // Dosya sayilarini getir (KDV9015 tahakkuk + beyanname dosyalari)
    const customerIds = kdv9015Customers.map((c) => c.id);

    const documents = await prisma.documents.findMany({
      where: {
        tenantId,
        customerId: { in: customerIds },
        year,
        month,
        isFolder: false,
        beyannameTuru: "KDV9015",
      },
      select: {
        customerId: true,
        fileCategory: true,
        type: true,
      },
    });

    // customerId -> tahakkuk/beyanname dosya sayisi map olustur
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

    // Response formati
    const result = kdv9015Customers.map((customer) => {
      const kdv9015 = kdv9015Map.get(customer.id);
      const tahakkukFileCount = tahakkukCountMap.get(customer.id) || 0;
      const beyannameFileCount = beyannameCountMap.get(customer.id) || 0;
      const fileCount = tahakkukFileCount + beyannameFileCount;

      // Status belirleme mantigi:
      // 1. Kullanici manuel status secmisse (verildi, verilmeyecek) -> onu kullan
      // 2. Dosya yoksa -> "eksik"
      // 3. Dosya varsa ama henuz parse edilmemisse -> "bekliyor"
      const manualStatuses = ["verildi", "verilmeyecek"];

      let effectiveStatus: string;
      if (kdv9015?.status && manualStatuses.includes(kdv9015.status)) {
        effectiveStatus = kdv9015.status;
      } else if (fileCount > 0) {
        effectiveStatus = kdv9015?.status || "bekliyor";
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
        // KDV9015 Kontrol bilgileri
        id: kdv9015?.id || null,
        kdvMatrah: kdv9015?.kdvMatrah ? Number(kdv9015.kdvMatrah) : null,
        tahakkukEden: kdv9015?.tahakkukEden ? Number(kdv9015.tahakkukEden) : null,
        mahsupEdilen: kdv9015?.mahsupEdilen ? Number(kdv9015.mahsupEdilen) : null,
        odenecek: kdv9015?.odenecek ? Number(kdv9015.odenecek) : null,
        devredenKdv: kdv9015?.devredenKdv ? Number(kdv9015.devredenKdv) : null,
        damgaVergisi: kdv9015?.damgaVergisi ? Number(kdv9015.damgaVergisi) : null,
        vade: kdv9015?.vade || null,
        beyanTarihi: kdv9015?.beyanTarihi || null,
        tahakkukDocumentId: kdv9015?.tahakkukDocumentId || null,
        status: effectiveStatus,
        notes: kdv9015?.notes || null,
        // Dosya sayilari
        tahakkukFileCount,
        beyannameFileCount,
      };
    });

    // siraNo'ya gore sayisal siralama (kucukten buyuge)
    // siraNo null veya bos olanlar en sona
    result.sort((a, b) => {
      const aNum = a.siraNo ? parseInt(a.siraNo, 10) : Infinity;
      const bNum = b.siraNo ? parseInt(b.siraNo, 10) : Infinity;

      // NaN kontrolu
      const aVal = isNaN(aNum) ? Infinity : aNum;
      const bVal = isNaN(bNum) ? Infinity : bNum;

      if (aVal === bVal) {
        // siraNo esitse unvan'a gore sirala
        return (a.unvan || "").localeCompare(b.unvan || "", "tr");
      }
      return aVal - bVal;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching KDV9015 kontrol:", error);
    return NextResponse.json(
      { error: "KDV Tevkifat kontrol verileri yuklenirken hata olustu" },
      { status: 500 }
    );
  }
}

// Zod schema - PUT request validation
const updateKdv9015KontrolSchema = z.object({
  customerId: z.string().uuid("Geçerli bir customerId gerekli"),
  year: z.number().int("Yıl tam sayı olmalı").min(2000, "Yıl en az 2000 olmalı"),
  month: z.number().int("Ay tam sayı olmalı").min(1, "Ay en az 1 olmalı").max(12, "Ay en fazla 12 olmalı"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// PUT - KDV9015 kontrol kaydini guncelle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();

    // Zod validation
    const validation = updateKdv9015KontrolSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerId, year, month, status, notes } = validation.data;

    // Upsert
    const record = await prisma.kdv9015_kontrol.upsert({
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
    console.error("Error updating KDV9015 kontrol:", error);
    return NextResponse.json(
      { error: "KDV Tevkifat kontrol guncellenirken hata olustu" },
      { status: 500 }
    );
  }
}
