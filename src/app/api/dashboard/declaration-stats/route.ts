/**
 * Dashboard Declaration Stats API
 *
 * Tüm beyanname türleri için istatistikleri döner.
 * - KDV, MUHSGK, KDV2, KDV9015: Özel kontrol çizelgesi tablolarından
 * - Diğerleri: beyanname_takip tablosundan
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

// Beyanname türü istatistikleri
interface DeclarationTypeStats {
  code: string;
  name: string;
  total: number;
  verildi: number;
  eksik: number;
  bekliyor: number;
  verilmeyecek: number;
  route: string;
  hasDetailPage: boolean; // Detay çizelgesi var mı?
}

// Beyanname türü tanımları
const DECLARATION_TYPES: Record<string, { name: string; route: string; hasDetailPage: boolean }> = {
  KDV1: { name: "KDV", route: "/dashboard/kontrol-cizelgesi/kdv-detay", hasDetailPage: true },
  MUHSGK: { name: "MUHSGK", route: "/dashboard/sgk-kontrol", hasDetailPage: true },
  KDV2: { name: "KDV-2", route: "/dashboard/kdv2-kontrol", hasDetailPage: true },
  KDV9015: { name: "KDV Tevkifat", route: "/dashboard/kontrol-cizelgesi/kdv9015-detay", hasDetailPage: true },
  BA: { name: "BA Formu", route: "/dashboard/kontrol", hasDetailPage: false },
  BS: { name: "BS Formu", route: "/dashboard/kontrol", hasDetailPage: false },
  DAMGA: { name: "Damga Vergisi", route: "/dashboard/kontrol", hasDetailPage: false },
  GV: { name: "Geçici Vergi", route: "/dashboard/kontrol", hasDetailPage: false },
  GELIR: { name: "Gelir Vergisi", route: "/dashboard/kontrol", hasDetailPage: false },
  KURUMLAR: { name: "Kurumlar Vergisi", route: "/dashboard/kontrol", hasDetailPage: false },
  KONAKLAMA: { name: "Konaklama Vergisi", route: "/dashboard/kontrol", hasDetailPage: false },
  TURIZM: { name: "Turizm Payı", route: "/dashboard/kontrol", hasDetailPage: false },
  GGECICI: { name: "Gelir Geçici", route: "/dashboard/gecici-vergi-kontrol", hasDetailPage: true },
  KGECICI: { name: "Kurum Geçici", route: "/dashboard/gecici-vergi-kontrol", hasDetailPage: true },
  FORMBA: { name: "Form BA", route: "/dashboard/kontrol", hasDetailPage: false },
  FORMBS: { name: "Form BS", route: "/dashboard/kontrol", hasDetailPage: false },
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = user.tenantId;

    // Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let defaultMonth = currentMonth - 1;
    let defaultYear = currentYear;
    if (defaultMonth === 0) {
      defaultMonth = 12;
      defaultYear = currentYear - 1;
    }

    const year = parseInt(searchParams.get("year") || String(defaultYear));
    const month = parseInt(searchParams.get("month") || String(defaultMonth));

    // Aktif müşterileri getir
    const customers = await prisma.customers.findMany({
      where: {
        tenantId,
        status: "active",
      },
      select: {
        id: true,
        verilmeyecekBeyannameler: true,
        sirketTipi: true, // GGECICI/KGECICI ayrımı için gerekli
      },
    });

    // KDV1 veren müşteriler
    const kdv1Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV1")
    );

    // KDV2 veren müşteriler
    const kdv2Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV2")
    );

    // MUHSGK veren müşteriler
    const muhsgkCustomers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("MUHSGK")
    );

    // KDV9015 veren müşteriler
    const kdv9015Customers = customers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("KDV9015")
    );

    // GGECICI veren müşteriler (sahis, basit_usul)
    const ggeciciCustomers = customers.filter(
      (c) =>
        c.sirketTipi && ['sahis', 'basit_usul'].includes(c.sirketTipi) &&
        !c.verilmeyecekBeyannameler?.includes("GGECICI")
    );

    // KGECICI veren müşteriler (firma)
    const kgeciciCustomers = customers.filter(
      (c) =>
        c.sirketTipi === 'firma' &&
        !c.verilmeyecekBeyannameler?.includes("KGECICI")
    );

    // Çeyreklik dönem dönüşümü: Dashboard'ın aylık month parametresini
    // geçici vergi çeyreğine çevir
    // Dashboard month (bir önceki ay): 1,2,3 → Q4 önceki yıl (month=12)
    // 4,5,6 → Q1 (month=3), 7,8,9 → Q2 (month=6), 10,11,12 → Q3 (month=9)
    function getQuarterPeriod(y: number, m: number): { qYear: number; qMonth: number } {
      if (m >= 1 && m <= 3) return { qYear: y - 1, qMonth: 12 };
      if (m >= 4 && m <= 6) return { qYear: y, qMonth: 3 };
      if (m >= 7 && m <= 9) return { qYear: y, qMonth: 6 };
      return { qYear: y, qMonth: 9 };
    }

    const { qYear, qMonth } = getQuarterPeriod(year, month);

    // Sorguları 3 gruba böl: kontrol tabloları, dosyalar, diğer
    // Böylece tek seferde max 5-6 sorgu çalışır (11 yerine)

    // GRUP 1: Kontrol tabloları (4 sorgu + 2 geçici vergi)
    const kontrolResults = await Promise.allSettled([
      prisma.kdv_kontrol.findMany({
        where: { tenantId, year, month, customerId: { in: kdv1Customers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
      prisma.kdv2_kontrol.findMany({
        where: { tenantId, year, month, customerId: { in: kdv2Customers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
      prisma.kdv9015_kontrol.findMany({
        where: { tenantId, year, month, customerId: { in: kdv9015Customers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
      prisma.sgk_kontrol.findMany({
        where: { tenantId, year, month, customerId: { in: muhsgkCustomers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
      prisma.gecici_vergi_kontrol.findMany({
        where: { tenantId, year: qYear, month: qMonth, vergiTuru: "GGECICI", customerId: { in: ggeciciCustomers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
      prisma.gecici_vergi_kontrol.findMany({
        where: { tenantId, year: qYear, month: qMonth, vergiTuru: "KGECICI", customerId: { in: kgeciciCustomers.map((c) => c.id) } },
        select: { customerId: true, status: true },
      }),
    ]);

    // GRUP 2: Dosya sorguları (4 ayrı sorgu yerine tek sorgu + client-side filtreleme)
    // Tüm beyanname dosyalarını tek sorguda getir, sonra türe göre ayır
    const allCustomerIds = [
      ...kdv1Customers.map((c) => c.id),
      ...kdv2Customers.map((c) => c.id),
      ...kdv9015Customers.map((c) => c.id),
      ...muhsgkCustomers.map((c) => c.id),
    ];
    const uniqueCustomerIds = [...new Set(allCustomerIds)];

    const [allDocsResult, beyannameTakipResult] = await Promise.allSettled([
      // Tek dosya sorgusu - tüm beyanname türleri
      prisma.documents.findMany({
        where: {
          tenantId,
          customerId: { in: uniqueCustomerIds },
          year,
          month,
          isFolder: false,
          OR: [
            { beyannameTuru: { in: ["KDV1", "KDV2", "KDV9015"] }, fileCategory: { contains: "TAHAKKUK", mode: "insensitive" } },
            { beyannameTuru: { in: ["KDV1", "KDV2", "KDV9015"] }, type: { contains: "tahakkuk", mode: "insensitive" } },
            { fileCategory: "SGK_TAHAKKUK" },
            { fileCategory: "HIZMET_LISTESI" },
            { type: "sgk_tahakkuk" },
            { type: "hizmet_listesi" },
          ],
        },
        select: { customerId: true, beyannameTuru: true, fileCategory: true, type: true },
      }),
      // Beyanname takip (diğer beyanname türleri için)
      prisma.beyanname_takip.findMany({
        where: { tenantId, year, month },
        select: { customerId: true, beyannameler: true },
      }),
    ]);

    // Hata logla
    const kontrolNames = ["KDV Kontrol", "KDV2 Kontrol", "KDV9015 Kontrol", "SGK Kontrol", "GGECICI Kontrol", "KGECICI Kontrol"];
    kontrolResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[DASHBOARD-STATS] ${kontrolNames[index]} sorgusu basarisiz:`, result.reason);
      }
    });
    if (allDocsResult.status === "rejected") {
      console.error("[DASHBOARD-STATS] Dosya sorgusu basarisiz:", allDocsResult.reason);
    }
    if (beyannameTakipResult.status === "rejected") {
      console.error("[DASHBOARD-STATS] Beyanname Takip sorgusu basarisiz:", beyannameTakipResult.reason);
    }

    // Sonuçları güvenli şekilde çöz
    const kdvKontrolRecords = kontrolResults[0].status === "fulfilled" ? kontrolResults[0].value : [];
    const kdv2KontrolRecords = kontrolResults[1].status === "fulfilled" ? kontrolResults[1].value : [];
    const kdv9015KontrolRecords = kontrolResults[2].status === "fulfilled" ? kontrolResults[2].value : [];
    const sgkKontrolRecords = kontrolResults[3].status === "fulfilled" ? kontrolResults[3].value : [];
    const ggeciciKontrolRecords = kontrolResults[4].status === "fulfilled" ? kontrolResults[4].value : [];
    const kgeciciKontrolRecords = kontrolResults[5].status === "fulfilled" ? kontrolResults[5].value : [];

    // Dosya sonuçlarını türe göre ayır (client-side filtreleme)
    const allDocs = allDocsResult.status === "fulfilled" ? allDocsResult.value : [];
    const kdvDocuments = allDocs.filter((d) => d.beyannameTuru === "KDV1");
    const kdv2Documents = allDocs.filter((d) => d.beyannameTuru === "KDV2");
    const kdv9015Documents = allDocs.filter((d) => d.beyannameTuru === "KDV9015");
    const sgkDocuments = allDocs.filter((d) =>
      !d.beyannameTuru || d.fileCategory === "SGK_TAHAKKUK" || d.fileCategory === "HIZMET_LISTESI" ||
      d.type === "sgk_tahakkuk" || d.type === "hizmet_listesi"
    );
    const beyannameTakipRecords = beyannameTakipResult.status === "fulfilled" ? beyannameTakipResult.value : [];

    // KDV1 istatistikleri hesapla (özel çizelge)
    const kdvStats = calculateKdvStats(
      kdv1Customers,
      kdvKontrolRecords,
      kdvDocuments
    );

    // KDV2 istatistikleri hesapla (özel çizelge)
    const kdv2Stats = calculateKdvStats(
      kdv2Customers,
      kdv2KontrolRecords,
      kdv2Documents
    );

    // KDV9015 istatistikleri hesapla (özel çizelge)
    const kdv9015Stats = calculateKdvStats(
      kdv9015Customers,
      kdv9015KontrolRecords,
      kdv9015Documents
    );

    // SGK/MUHSGK istatistikleri hesapla (özel çizelge)
    const sgkStats = calculateSgkStats(
      muhsgkCustomers,
      sgkKontrolRecords,
      sgkDocuments
    );

    // GGECICI istatistikleri (gecici_vergi_kontrol tablosundan)
    const ggeciciStats = calculateGeciciVergiStats(ggeciciCustomers, ggeciciKontrolRecords);

    // KGECICI istatistikleri (gecici_vergi_kontrol tablosundan)
    const kgeciciStats = calculateGeciciVergiStats(kgeciciCustomers, kgeciciKontrolRecords);

    // Diğer beyanname türlerinin istatistiklerini beyanname_takip'ten hesapla
    const otherDeclarationStats = calculateOtherDeclarationStats(
      customers,
      beyannameTakipRecords
    );

    // otherDeclarationStats'tan GGECICI/KGECICI'yi çıkar (artık özel sorgudan geliyor)
    const filteredOtherStats = otherDeclarationStats.filter(
      (d) => d.code !== "GGECICI" && d.code !== "KGECICI"
    );

    // Tüm beyanname türlerini birleştir
    const declarations: DeclarationTypeStats[] = [
      {
        code: "KDV1",
        ...DECLARATION_TYPES["KDV1"],
        ...kdvStats,
      },
      {
        code: "MUHSGK",
        ...DECLARATION_TYPES["MUHSGK"],
        ...sgkStats,
      },
      {
        code: "KDV2",
        ...DECLARATION_TYPES["KDV2"],
        ...kdv2Stats,
      },
      {
        code: "KDV9015",
        ...DECLARATION_TYPES["KDV9015"],
        ...kdv9015Stats,
      },
      // GGECICI - gecici_vergi_kontrol tablosundan
      {
        code: "GGECICI",
        ...DECLARATION_TYPES["GGECICI"],
        ...ggeciciStats,
      },
      // KGECICI - gecici_vergi_kontrol tablosundan
      {
        code: "KGECICI",
        ...DECLARATION_TYPES["KGECICI"],
        ...kgeciciStats,
      },
      // Diğer beyanname türlerini ekle (GGECICI/KGECICI hariç)
      ...filteredOtherStats,
    ];

    // Sadece müşterisi olan beyanname türlerini döndür ve sırala
    const activeDeclarations = declarations
      .filter((d) => d.total > 0)
      .sort((a, b) => {
        // Önce çizelgesi olanlar, sonra diğerleri
        if (a.hasDetailPage !== b.hasDetailPage) {
          return a.hasDetailPage ? -1 : 1;
        }
        // Sonra toplam müşteri sayısına göre
        return b.total - a.total;
      });

    // Genel istatistikler
    // Verilmeyecek olanları toplam müşteri sayısından çıkart
    const totalAll = activeDeclarations.reduce((sum, d) => sum + d.total, 0);
    const verildiAll = activeDeclarations.reduce((sum, d) => sum + d.verildi, 0);
    const verilmeyecekAll = activeDeclarations.reduce((sum, d) => sum + d.verilmeyecek, 0);
    const effectiveTotal = totalAll - verilmeyecekAll;
    const completionRate = effectiveTotal > 0 ? Math.round((verildiAll / effectiveTotal) * 100) : 0;

    return NextResponse.json({
      declarations: activeDeclarations,
      summary: {
        total: totalAll,
        verildi: verildiAll,
        completionRate,
      },
      period: { year, month },
    });
  } catch (error) {
    console.error("[Dashboard Declaration Stats API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * KDV/KDV2 istatistiklerini hesaplar
 * Status mantığı: kontrol çizelgesindekiyle aynı
 */
function calculateKdvStats(
  customers: { id: string }[],
  kontrolRecords: { customerId: string; status: string | null }[],
  documents: { customerId: string | null }[]
) {
  const kontrolMap = new Map(kontrolRecords.map((r) => [r.customerId, r.status]));

  // customerId -> dosya var mı?
  const hasFileSet = new Set(documents.map((d) => d.customerId).filter(Boolean));

  let verildi = 0;
  let eksik = 0;
  let bekliyor = 0;
  let verilmeyecek = 0;

  const manualStatuses = ["verildi", "verilmeyecek"];

  for (const customer of customers) {
    const status = kontrolMap.get(customer.id);
    const hasFile = hasFileSet.has(customer.id);

    let effectiveStatus: string;
    if (status && manualStatuses.includes(status)) {
      effectiveStatus = status;
    } else if (hasFile) {
      effectiveStatus = status || "bekliyor";
    } else {
      effectiveStatus = "eksik";
    }

    switch (effectiveStatus) {
      case "verildi":
        verildi++;
        break;
      case "verilmeyecek":
        verilmeyecek++;
        break;
      case "bekliyor":
        bekliyor++;
        break;
      default:
        eksik++;
    }
  }

  return {
    total: customers.length,
    verildi,
    eksik,
    bekliyor,
    verilmeyecek,
  };
}

/**
 * SGK/MUHSGK istatistiklerini hesaplar
 * Status mantığı: kontrol çizelgesindekiyle aynı
 */
function calculateSgkStats(
  customers: { id: string }[],
  kontrolRecords: { customerId: string; status: string | null }[],
  documents: { customerId: string | null }[]
) {
  const kontrolMap = new Map(kontrolRecords.map((r) => [r.customerId, r.status]));

  // customerId -> dosya var mı?
  const hasFileSet = new Set(documents.map((d) => d.customerId).filter(Boolean));

  let verildi = 0; // gonderildi veya dilekce_gonderildi
  let eksik = 0;
  let bekliyor = 0;
  let verilmeyecek = 0; // gonderilmeyecek

  const completedStatuses = ["gonderildi", "dilekce_gonderildi"];
  const manualStatuses = ["gonderildi", "gonderilmeyecek", "dilekce_gonderildi"];

  for (const customer of customers) {
    const status = kontrolMap.get(customer.id);
    const hasFile = hasFileSet.has(customer.id);

    let effectiveStatus: string;
    if (status && manualStatuses.includes(status)) {
      effectiveStatus = status;
    } else if (hasFile) {
      effectiveStatus = status || "bekliyor";
    } else {
      effectiveStatus = "eksik";
    }

    if (completedStatuses.includes(effectiveStatus)) {
      verildi++;
    } else if (effectiveStatus === "gonderilmeyecek") {
      verilmeyecek++;
    } else if (effectiveStatus === "bekliyor") {
      bekliyor++;
    } else {
      eksik++;
    }
  }

  return {
    total: customers.length,
    verildi,
    eksik,
    bekliyor,
    verilmeyecek,
  };
}

/**
 * Geçici vergi (GGECICI/KGECICI) istatistiklerini gecici_vergi_kontrol tablosundan hesaplar
 */
function calculateGeciciVergiStats(
  customers: { id: string }[],
  kontrolRecords: { customerId: string; status: string | null }[]
) {
  const kontrolMap = new Map(kontrolRecords.map((r) => [r.customerId, r.status]));

  let verildi = 0;
  let eksik = 0;
  let bekliyor = 0;
  let verilmeyecek = 0;

  for (const customer of customers) {
    const status = kontrolMap.get(customer.id);

    if (status === "verildi") {
      verildi++;
    } else if (status === "verilmeyecek") {
      verilmeyecek++;
    } else if (status === "bekliyor") {
      bekliyor++;
    } else {
      eksik++;
    }
  }

  return {
    total: customers.length,
    verildi,
    eksik,
    bekliyor,
    verilmeyecek,
  };
}

/**
 * Diğer beyanname türlerinin istatistiklerini beyanname_takip tablosundan hesaplar
 */
function calculateOtherDeclarationStats(
  customers: { id: string; verilmeyecekBeyannameler: string[] | null }[],
  beyannameTakipRecords: { customerId: string; beyannameler: unknown }[]
): DeclarationTypeStats[] {
  // Çizelgesi olan türler - bunları atla
  const typesWithDetailPage = ["KDV1", "MUHSGK", "KDV2", "KDV9015"];

  // beyanname_takip'teki tüm beyanname türlerini topla
  const typeStatsMap = new Map<string, { verildi: number; eksik: number; bekliyor: number; verilmeyecek: number; customerIds: Set<string> }>();

  // customerId -> beyannameler map
  const customerBeyannameMap = new Map<string, Record<string, { status?: string }>>();
  for (const record of beyannameTakipRecords) {
    const beyannameler = record.beyannameler as Record<string, { status?: string }> | null;
    if (beyannameler) {
      customerBeyannameMap.set(record.customerId, beyannameler);
    }
  }

  // Her müşteri için beyanname türlerini kontrol et
  for (const customer of customers) {
    const beyannameler = customerBeyannameMap.get(customer.id);
    const verilmeyecekList = customer.verilmeyecekBeyannameler || [];

    // beyanname_takip'teki beyannameleri kontrol et
    if (beyannameler) {
      for (const [typeCode, value] of Object.entries(beyannameler)) {
        // Çizelgesi olan türleri atla
        if (typesWithDetailPage.includes(typeCode)) continue;

        // Müşteri bu beyanname türünü verilmeyecek olarak işaretlediyse
        const isVerilmeyecekByCustomer = verilmeyecekList.includes(typeCode);

        if (!typeStatsMap.has(typeCode)) {
          typeStatsMap.set(typeCode, {
            verildi: 0,
            eksik: 0,
            bekliyor: 0,
            verilmeyecek: 0,
            customerIds: new Set(),
          });
        }

        const stats = typeStatsMap.get(typeCode)!;
        stats.customerIds.add(customer.id);

        // Müşteri bazında verilmeyecek kontrolü
        if (isVerilmeyecekByCustomer || value?.status === "verilmeyecek") {
          stats.verilmeyecek++;
        } else {
          switch (value?.status) {
            case "verildi":
              stats.verildi++;
              break;
            case "bekliyor":
              stats.bekliyor++;
              break;
            default:
              // bos veya tanımsız = eksik
              stats.eksik++;
          }
        }
      }
    }
  }

  // Map'i array'e çevir
  const result: DeclarationTypeStats[] = [];

  for (const [code, stats] of typeStatsMap) {
    const typeInfo = DECLARATION_TYPES[code] || {
      name: code,
      route: "/dashboard/kontrol",
      hasDetailPage: false,
    };

    result.push({
      code,
      name: typeInfo.name,
      route: typeInfo.route,
      hasDetailPage: typeInfo.hasDetailPage,
      total: stats.customerIds.size,
      verildi: stats.verildi,
      eksik: stats.eksik,
      bekliyor: stats.bekliyor,
      verilmeyecek: stats.verilmeyecek,
    });
  }

  return result;
}
