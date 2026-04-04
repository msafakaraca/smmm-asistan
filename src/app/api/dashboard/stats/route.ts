import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/server-cache";
import type { DashboardStats } from "@/types/dashboard";

/**
 * Dashboard Stats API
 *
 * Müşteri, beyanname, görev ve şifre tamamlanma istatistiklerini döner.
 * Dönem parametresi ile belirli bir ay/yıl için istatistikler alınabilir.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

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

    const tenantId = user.tenantId;

    // Server-side cache kontrolu
    const cacheKey = `${tenantId}:stats:${year}:${month}`;
    const cached = serverCache.get<DashboardStats>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const nowDate = new Date();

    // Bu ayın ilk günü (yeni müşteri sayısı için)
    const firstDayOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);

    // Tüm sorguları paralel çalıştır
    const [
      // Müşteri istatistikleri
      totalCustomers,
      firmaCount,
      sahisCount,
      basitUsulCount,
      activeCustomers,
      passiveCustomers,
      pendingCustomers,

      // Eksik iletişim bilgileri (aktif müşteriler arasında)
      emailMissingCount,
      telefonMissingCount,

      // Bu ay eklenen müşteriler
      newThisMonthCount,

      // Son eklenen müşteriler
      recentCustomersList,

      // Müşteri grupları
      customerGroupsData,

      // Görev istatistikleri
      totalTasks,
      completedTasks,
      overdueTasks,
      highPriorityTasks,
      todoTasks,
      inProgressTasks,

      // Beyanname takip verileri
      beyannameTakipData,

      // Şifre tamamlanma için müşteri verileri
      customersWithCredentials,
    ] = await Promise.all([
      // Müşteri sorguları
      prisma.customers.count({ where: { tenantId } }),
      prisma.customers.count({ where: { tenantId, sirketTipi: "firma" } }),
      prisma.customers.count({ where: { tenantId, sirketTipi: "sahis" } }),
      prisma.customers.count({ where: { tenantId, sirketTipi: "basit_usul" } }),
      prisma.customers.count({ where: { tenantId, status: "active" } }),
      prisma.customers.count({ where: { tenantId, status: "passive" } }),
      prisma.customers.count({ where: { tenantId, status: "pending" } }),

      // Eksik iletişim bilgileri
      prisma.customers.count({
        where: {
          tenantId,
          status: "active",
          OR: [{ email: null }, { email: "" }],
        },
      }),
      prisma.customers.count({
        where: {
          tenantId,
          status: "active",
          OR: [{ telefon1: null }, { telefon1: "" }],
        },
      }),

      // Bu ay eklenen müşteriler
      prisma.customers.count({
        where: { tenantId, createdAt: { gte: firstDayOfMonth } },
      }),

      // Son eklenen 3 müşteri
      prisma.customers.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, kisaltma: true, unvan: true, createdAt: true },
      }),

      // Müşteri grupları + üye sayıları
      prisma.customer_groups.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { customer_group_members: true } },
        },
        orderBy: { name: "asc" },
      }),

      // Görev sorguları
      prisma.tasks.count({ where: { tenantId } }),
      prisma.tasks.count({ where: { tenantId, status: "completed" } }),
      prisma.tasks.count({
        where: {
          tenantId,
          status: { not: "completed" },
          dueDate: { lt: nowDate },
        },
      }),
      prisma.tasks.count({
        where: {
          tenantId,
          priority: "high",
          status: { not: "completed" },
        },
      }),
      prisma.tasks.count({ where: { tenantId, status: "todo" } }),
      prisma.tasks.count({ where: { tenantId, status: "in_progress" } }),

      // Beyanname takip
      prisma.beyanname_takip.findMany({
        where: { tenantId, year, month },
        select: { beyannameler: true },
      }),

      // Şifre tamamlanma için müşteriler
      prisma.customers.findMany({
        where: { tenantId, status: "active" },
        select: {
          id: true,
          gibKodu: true,
          gibSifre: true,
          sgkKullaniciAdi: true,
          sgkSistemSifresi: true,
        },
      }),
    ]);

    // Beyanname türü isimleri
    const declarationTypeNames: Record<string, string> = {
      KDV1: "KDV",
      KDV2: "KDV2",
      MUHSGK: "Muhtasar ve SGK",
      KONAKLAMA: "Konaklama Vergisi",
      GV: "Geçici Vergi",
      DAMGA: "Damga Vergisi",
      BA: "BA Formu",
      BS: "BS Formu",
      SORGU: "Sorgu Beyanı",
      EDEFTER: "e-Defter",
    };

    // Beyanname istatistiklerini hesapla
    let verildiCount = 0;
    let bekliyorCount = 0;
    let verilmeyecekCount = 0;
    let bosCount = 0;
    let totalDeclarations = 0;

    // Beyanname türlerine göre istatistikler
    const byTypeMap: Record<string, { verildi: number; bekliyor: number; verilmeyecek: number; bos: number }> = {};

    for (const takip of beyannameTakipData) {
      const beyannameler = takip.beyannameler as Record<
        string,
        { status?: string }
      >;
      for (const [typeCode, value] of Object.entries(beyannameler)) {
        totalDeclarations++;

        // Tür için map'i başlat
        if (!byTypeMap[typeCode]) {
          byTypeMap[typeCode] = { verildi: 0, bekliyor: 0, verilmeyecek: 0, bos: 0 };
        }

        switch (value?.status) {
          case "verildi":
            verildiCount++;
            byTypeMap[typeCode].verildi++;
            break;
          case "bekliyor":
            bekliyorCount++;
            byTypeMap[typeCode].bekliyor++;
            break;
          case "verilmeyecek":
            verilmeyecekCount++;
            byTypeMap[typeCode].verilmeyecek++;
            break;
          default:
            bosCount++;
            byTypeMap[typeCode].bos++;
        }
      }
    }

    // byType array'ini oluştur
    const byType = Object.entries(byTypeMap).map(([code, stats]) => ({
      code,
      name: declarationTypeNames[code] || code,
      ...stats,
      total: stats.verildi + stats.bekliyor + stats.verilmeyecek + stats.bos,
    })).sort((a, b) => b.total - a.total); // En çok kullanılandan en aza

    const completionRate =
      totalDeclarations > 0
        ? Math.round((verildiCount / totalDeclarations) * 100)
        : 0;

    // Şifre tamamlanma istatistiklerini hesapla
    let gibCompleteCount = 0;
    let sgkCompleteCount = 0;
    const totalActiveCustomers = customersWithCredentials.length;

    for (const customer of customersWithCredentials) {
      // GİB şifresi: gibKodu ve gibSifre ikisi de dolu olmalı
      if (customer.gibKodu && customer.gibSifre) {
        gibCompleteCount++;
      }
      // SGK şifresi: sgkKullaniciAdi ve sgkSistemSifresi ikisi de dolu olmalı
      if (customer.sgkKullaniciAdi && customer.sgkSistemSifresi) {
        sgkCompleteCount++;
      }
    }

    const gibCompletionRate =
      totalActiveCustomers > 0
        ? Math.round((gibCompleteCount / totalActiveCustomers) * 100)
        : 0;

    const sgkCompletionRate =
      totalActiveCustomers > 0
        ? Math.round((sgkCompleteCount / totalActiveCustomers) * 100)
        : 0;

    // Müşteri grupları dönüşümü (count > 0 olanlar)
    const groups = customerGroupsData
      .map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        count: g._count.customer_group_members,
      }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);

    const stats: DashboardStats = {
      customers: {
        total: totalCustomers,
        firma: firmaCount,
        sahis: sahisCount,
        basitUsul: basitUsulCount,
        active: activeCustomers,
        passive: passiveCustomers,
        pending: pendingCustomers,
        emailMissing: emailMissingCount,
        telefonMissing: telefonMissingCount,
        newThisMonth: newThisMonthCount,
        recentCustomers: recentCustomersList.map((c) => ({
          id: c.id,
          kisaltma: c.kisaltma,
          unvan: c.unvan,
          createdAt: c.createdAt.toISOString(),
        })),
        groups,
      },
      declarations: {
        total: totalDeclarations,
        verildi: verildiCount,
        bekliyor: bekliyorCount,
        verilmeyecek: verilmeyecekCount,
        bos: bosCount,
        completionRate,
        byType,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        highPriority: highPriorityTasks,
        todoCount: todoTasks,
        inProgressCount: inProgressTasks,
      },
      credentials: {
        totalCustomers: totalActiveCustomers,
        gibComplete: gibCompleteCount,
        sgkComplete: sgkCompleteCount,
        gibCompletionRate,
        sgkCompletionRate,
      },
      period: {
        year,
        month,
      },
    };

    serverCache.set(cacheKey, stats, 30_000); // 30 saniye TTL
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Dashboard Stats API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
