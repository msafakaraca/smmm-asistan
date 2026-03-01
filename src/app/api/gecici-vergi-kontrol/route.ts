/**
 * Geçici Vergi Kontrol API
 *
 * GET: GGECICI veya KGECICI beyannamesi veren müşterilerin geçici vergi kontrol verilerini getir
 * PUT: Status veya notes güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Belirli dönemdeki geçici vergi kontrol verilerini getir
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
      searchParams.get("month") || "12"
    );
    const vergiTuru = searchParams.get("vergiTuru") || "KGECICI";
    const customerId = searchParams.get("customerId");

    // Müşteri filtreleme: KGECICI → firma, GGECICI → sahis/basit_usul
    const sirketTipiFilter =
      vergiTuru === "KGECICI"
        ? { sirketTipi: "firma" }
        : { sirketTipi: { in: ["sahis", "basit_usul"] } };

    const customersQuery: Record<string, unknown> = {
      tenantId,
      status: "active",
      ...sirketTipiFilter,
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

    // Geçici vergi veren müşterileri filtrele (verilmeyecekBeyannameler kontrolü)
    const filteredCustomers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes(vergiTuru)
    );

    // Bu müşteriler için geçici vergi kontrol kayıtlarını getir
    const kontrolRecords = await prisma.gecici_vergi_kontrol.findMany({
      where: {
        tenantId,
        year,
        month,
        vergiTuru,
        customerId: { in: filteredCustomers.map((c) => c.id) },
      },
    });

    // customerId -> kontrol map
    const kontrolMap = new Map(kontrolRecords.map((r) => [r.customerId, r]));

    // Dosya sayılarını getir
    const customerIds = filteredCustomers.map((c) => c.id);
    const beyannameTuru = vergiTuru; // GGECICI veya KGECICI

    let [tahakkukDocs, beyannameDocs] = await Promise.all([
      prisma.documents.findMany({
        where: {
          tenantId,
          customerId: { in: customerIds },
          year,
          month,
          isFolder: false,
          beyannameTuru,
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
          beyannameTuru,
          OR: [
            { fileCategory: { contains: "BEYANNAME", mode: "insensitive" } },
            { type: { contains: "beyanname", mode: "insensitive" } },
          ],
        },
        select: { customerId: true },
      }),
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // FALLBACK: Eski bot çalışmalarından yanlış ay ile kaydedilmiş dosyalar
    // Çeyreklik dönem (ör. Q4 month=12) dosyaları yanlışlıkla month+1
    // (ör. Ocak) ile kaydedilmiş olabilir. Bu durumda bir sonraki ayla dene.
    // ═══════════════════════════════════════════════════════════════════
    if (tahakkukDocs.length === 0 && beyannameDocs.length === 0) {
      let fbMonth = month + 1;
      let fbYear = year;
      if (fbMonth > 12) { fbMonth = 1; fbYear++; }

      const [fbTahakkukDocs, fbBeyannameDocs] = await Promise.all([
        prisma.documents.findMany({
          where: {
            tenantId,
            customerId: { in: customerIds },
            year: fbYear,
            month: fbMonth,
            isFolder: false,
            beyannameTuru,
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
            year: fbYear,
            month: fbMonth,
            isFolder: false,
            beyannameTuru,
            OR: [
              { fileCategory: { contains: "BEYANNAME", mode: "insensitive" } },
              { type: { contains: "beyanname", mode: "insensitive" } },
            ],
          },
          select: { customerId: true },
        }),
      ]);

      if (fbTahakkukDocs.length > 0 || fbBeyannameDocs.length > 0) {
        console.log(`[GECICI-VERGI] Fallback: ${fbTahakkukDocs.length + fbBeyannameDocs.length} dosya ${fbMonth}/${fbYear} ile bulundu (beklenen: ${month}/${year})`);
        tahakkukDocs = fbTahakkukDocs;
        beyannameDocs = fbBeyannameDocs;
      }
    }

    // customerId -> dosya sayısı map
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

    // Response
    const result = filteredCustomers.map((customer) => {
      const kontrol = kontrolMap.get(customer.id);
      const fileCount = tahakkukCountMap.get(customer.id) || 0;
      const beyannameCount = beyannameCountMap.get(customer.id) || 0;

      const manualStatuses = ["verildi", "verilmeyecek"];

      let effectiveStatus: string;
      if (kontrol?.status && manualStatuses.includes(kontrol.status)) {
        effectiveStatus = kontrol.status;
      } else if (fileCount > 0 || beyannameCount > 0) {
        effectiveStatus = kontrol?.status || "bekliyor";
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
        // Geçici Vergi Kontrol bilgileri
        id: kontrol?.id || null,
        vergilendirmeDonemi: kontrol?.vergilendirmeDonemi || null,
        matrah: kontrol?.matrah ? Number(kontrol.matrah) : null,
        tahakkukEden: kontrol?.tahakkukEden ? Number(kontrol.tahakkukEden) : null,
        mahsupEdilen: kontrol?.mahsupEdilen ? Number(kontrol.mahsupEdilen) : null,
        odenecek: kontrol?.odenecek ? Number(kontrol.odenecek) : null,
        damgaVergisi1047: kontrol?.damgaVergisi1047 ? Number(kontrol.damgaVergisi1047) : null,
        damgaVergisi1048: kontrol?.damgaVergisi1048 ? Number(kontrol.damgaVergisi1048) : null,
        vade: kontrol?.vade || null,
        beyanTarihi: kontrol?.beyanTarihi || null,
        tahakkukDocumentId: kontrol?.tahakkukDocumentId || null,
        status: effectiveStatus,
        notes: kontrol?.notes || null,
        // Dosya sayıları
        tahakkukFileCount: fileCount,
        beyannameFileCount: beyannameCount,
      };
    });

    // siraNo'ya göre sıralama
    result.sort((a, b) => {
      const aNum = a.siraNo ? parseInt(a.siraNo, 10) : Infinity;
      const bNum = b.siraNo ? parseInt(b.siraNo, 10) : Infinity;
      const aVal = isNaN(aNum) ? Infinity : aNum;
      const bVal = isNaN(bNum) ? Infinity : bNum;

      if (aVal === bVal) {
        return (a.unvan || "").localeCompare(b.unvan || "", "tr");
      }
      return aVal - bVal;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching gecici vergi kontrol:", error);
    return NextResponse.json(
      { error: "Geçici vergi kontrol verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Zod schema - PUT request validation
const updateGeciciVergiKontrolSchema = z.object({
  customerId: z.string().uuid("Geçerli bir customerId gerekli"),
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  vergiTuru: z.enum(["GGECICI", "KGECICI"]),
  status: z.string().optional(),
  notes: z.string().optional(),
});

// PUT - Geçici vergi kontrol kaydını güncelle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();

    const validation = updateGeciciVergiKontrolSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerId, year, month, vergiTuru, status, notes } = validation.data;

    const record = await prisma.gecici_vergi_kontrol.upsert({
      where: {
        customerId_year_month_vergiTuru: { customerId, year, month, vergiTuru },
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
        vergiTuru,
        status: status || "bekliyor",
        notes: notes || null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error updating gecici vergi kontrol:", error);
    return NextResponse.json(
      { error: "Geçici vergi kontrol güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}
