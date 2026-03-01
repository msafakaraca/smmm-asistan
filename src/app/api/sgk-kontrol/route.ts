/**
 * SGK Kontrol API
 *
 * GET: MUHSGK beyannamesi veren müşterilerin SGK kontrol verilerini getir
 * PUT: Status veya notes güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Belirli dönemdeki SGK kontrol verilerini getir
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

    // MUHSGK beyannamesi veren müşterileri getir
    // verilmeyecekBeyannameler arrayinde "MUHSGK" olmayanları filtrele
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

    // MUHSGK veren müşterileri filtrele
    const muhsgkCustomers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("MUHSGK")
    );

    // Bu müşteriler için SGK kontrol kayıtlarını getir
    const sgkKontrolRecords = await prisma.sgk_kontrol.findMany({
      where: {
        tenantId,
        year,
        month,
        customerId: { in: muhsgkCustomers.map((c) => c.id) },
      },
    });

    // customerId -> sgk_kontrol map
    const sgkMap = new Map(sgkKontrolRecords.map((r) => [r.customerId, r]));

    // Dosya sayılarını getir (beyanname, tahakkuk, sgk tahakkuk ve hizmet listesi)
    const customerIds = muhsgkCustomers.map((c) => c.id);

    // SGK dosyaları (SGK_TAHAKKUK, HIZMET_LISTESI)
    const sgkDocuments = await prisma.documents.findMany({
      where: {
        tenantId,
        customerId: { in: customerIds },
        year,
        month,
        isFolder: false,
        OR: [
          { fileCategory: "SGK_TAHAKKUK" },
          { fileCategory: "HIZMET_LISTESI" },
          { type: "sgk_tahakkuk" },
          { type: "hizmet_listesi" },
        ],
      },
      select: {
        customerId: true,
        fileCategory: true,
        type: true,
      },
    });

    // MUHSGK Beyanname ve Tahakkuk dosyaları
    const muhsgkDocuments = await prisma.documents.findMany({
      where: {
        tenantId,
        customerId: { in: customerIds },
        year,
        month,
        isFolder: false,
        beyannameTuru: "MUHSGK",
        OR: [
          { fileCategory: "BEYANNAME" },
          { fileCategory: "TAHAKKUK" },
        ],
      },
      select: {
        customerId: true,
        fileCategory: true,
      },
    });

    // customerId -> { beyanname, muhsgkTahakkuk, tahakkuk, hizmet } map oluştur
    const fileCountMap = new Map<string, { beyanname: number; muhsgkTahakkuk: number; tahakkuk: number; hizmet: number }>();

    for (const doc of sgkDocuments) {
      if (!doc.customerId) continue;

      const category = (doc.fileCategory || doc.type || "").toLowerCase();
      const isTahakkuk = category.includes("tahakkuk");
      const isHizmet = category.includes("hizmet");

      if (!fileCountMap.has(doc.customerId)) {
        fileCountMap.set(doc.customerId, { beyanname: 0, muhsgkTahakkuk: 0, tahakkuk: 0, hizmet: 0 });
      }

      const counts = fileCountMap.get(doc.customerId)!;
      if (isTahakkuk) counts.tahakkuk++;
      if (isHizmet) counts.hizmet++;
    }

    for (const doc of muhsgkDocuments) {
      if (!doc.customerId) continue;

      if (!fileCountMap.has(doc.customerId)) {
        fileCountMap.set(doc.customerId, { beyanname: 0, muhsgkTahakkuk: 0, tahakkuk: 0, hizmet: 0 });
      }

      const counts = fileCountMap.get(doc.customerId)!;
      if (doc.fileCategory === "BEYANNAME") counts.beyanname++;
      if (doc.fileCategory === "TAHAKKUK") counts.muhsgkTahakkuk++;
    }

    // Response formatı
    const result = muhsgkCustomers.map((customer) => {
      const sgk = sgkMap.get(customer.id);
      const fileCounts = fileCountMap.get(customer.id) || { beyanname: 0, muhsgkTahakkuk: 0, tahakkuk: 0, hizmet: 0 };

      // Status belirleme mantığı:
      // 1. Kullanıcı manuel status seçmişse (gonderildi, gonderilmeyecek, dilekce_gonderildi) → onu kullan
      // 2. Dosya yoksa → "eksik"
      // 3. Dosya varsa ama henüz parse edilmemişse → "bekliyor"
      const hasAnyFile = fileCounts.tahakkuk > 0 || fileCounts.hizmet > 0;
      const manualStatuses = ["gonderildi", "gonderilmeyecek", "dilekce_gonderildi"];

      let effectiveStatus: string;
      if (sgk?.status && manualStatuses.includes(sgk.status)) {
        // Kullanıcı manuel seçmiş, onu koru
        effectiveStatus = sgk.status;
      } else if (hasAnyFile) {
        // Dosya var ama henüz tam olarak işlenmemiş
        effectiveStatus = sgk?.status || "bekliyor";
      } else {
        // Dosya yok = eksik
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
        // SGK Kontrol bilgileri
        id: sgk?.id || null,
        hizmetIsciSayisi: sgk?.hizmetIsciSayisi || null,
        hizmetOnayTarihi: sgk?.hizmetOnayTarihi || null,
        hizmetDocumentId: sgk?.hizmetDocumentId || null,
        tahakkukIsciSayisi: sgk?.tahakkukIsciSayisi || null,
        tahakkukGunSayisi: sgk?.tahakkukGunSayisi || null,
        tahakkukNetTutar: sgk?.tahakkukNetTutar
          ? Number(sgk.tahakkukNetTutar)
          : null,
        tahakkukKabulTarihi: sgk?.tahakkukKabulTarihi || null,
        tahakkukDocumentId: sgk?.tahakkukDocumentId || null,
        status: effectiveStatus,
        notes: sgk?.notes || null,
        // Dosya sayıları
        beyannameFileCount: fileCounts.beyanname,
        muhsgkTahakkukFileCount: fileCounts.muhsgkTahakkuk,
        tahakkukFileCount: fileCounts.tahakkuk,
        hizmetFileCount: fileCounts.hizmet,
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
    console.error("Error fetching SGK kontrol:", error);
    return NextResponse.json(
      { error: "SGK kontrol verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Zod schema - PUT request validation
const updateSgkKontrolSchema = z.object({
  customerId: z.string().uuid("Geçerli bir customerId gerekli"),
  year: z.number().int("Yıl tam sayı olmalı").min(2000, "Yıl en az 2000 olmalı"),
  month: z.number().int("Ay tam sayı olmalı").min(1, "Ay en az 1 olmalı").max(12, "Ay en fazla 12 olmalı"),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// PUT - SGK kontrol kaydını güncelle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();

    // Zod validation
    const validation = updateSgkKontrolSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerId, year, month, status, notes } = validation.data;

    // Upsert
    const record = await prisma.sgk_kontrol.upsert({
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
    console.error("Error updating SGK kontrol:", error);
    return NextResponse.json(
      { error: "SGK kontrol güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}
