import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/server-cache";
import type { DashboardStats } from "@/types/dashboard";

interface UserProfile {
  id: string;
  tenantId: string;
}

/**
 * Dashboard Stats Resolver
 * Mevcut stats/route.ts logic'ini resolver fonksiyona çıkarır.
 */
export async function resolveStats(
  user: UserProfile,
  params: Record<string, string> = {}
): Promise<DashboardStats> {
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

  const year = parseInt(params.year) || defaultYear;
  const month = parseInt(params.month) || defaultMonth;

  const tenantId = user.tenantId;

  // Server-side cache kontrolu
  const cacheKey = `${tenantId}:stats:${year}:${month}`;
  const cached = serverCache.get<DashboardStats>(cacheKey);
  if (cached) return cached;

  const nowDate = new Date();
  const firstDayOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);

  const [
    totalCustomers,
    firmaCount,
    sahisCount,
    basitUsulCount,
    activeCustomers,
    passiveCustomers,
    pendingCustomers,
    emailMissingCount,
    telefonMissingCount,
    newThisMonthCount,
    recentCustomersList,
    customerGroupsData,
    totalTasks,
    completedTasks,
    overdueTasks,
    highPriorityTasks,
    todoTasks,
    inProgressTasks,
    beyannameTakipData,
    customersWithCredentials,
  ] = await Promise.all([
    prisma.customers.count({ where: { tenantId } }),
    prisma.customers.count({ where: { tenantId, sirketTipi: "firma" } }),
    prisma.customers.count({ where: { tenantId, sirketTipi: "sahis" } }),
    prisma.customers.count({ where: { tenantId, sirketTipi: "basit_usul" } }),
    prisma.customers.count({ where: { tenantId, status: "active" } }),
    prisma.customers.count({ where: { tenantId, status: "passive" } }),
    prisma.customers.count({ where: { tenantId, status: "pending" } }),

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

    prisma.customers.count({
      where: { tenantId, createdAt: { gte: firstDayOfMonth } },
    }),

    prisma.customers.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, kisaltma: true, unvan: true, createdAt: true },
    }),

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

    prisma.beyanname_takip.findMany({
      where: { tenantId, year, month },
      select: { beyannameler: true },
    }),

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

  let verildiCount = 0;
  let bekliyorCount = 0;
  let verilmeyecekCount = 0;
  let bosCount = 0;
  let totalDeclarations = 0;

  const byTypeMap: Record<string, { verildi: number; bekliyor: number; verilmeyecek: number; bos: number }> = {};

  for (const takip of beyannameTakipData) {
    const beyannameler = takip.beyannameler as Record<string, { status?: string }>;
    for (const [typeCode, value] of Object.entries(beyannameler)) {
      totalDeclarations++;
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

  const byType = Object.entries(byTypeMap)
    .map(([code, stats]) => ({
      code,
      name: declarationTypeNames[code] || code,
      ...stats,
      total: stats.verildi + stats.bekliyor + stats.verilmeyecek + stats.bos,
    }))
    .sort((a, b) => b.total - a.total);

  const completionRate =
    totalDeclarations > 0
      ? Math.round((verildiCount / totalDeclarations) * 100)
      : 0;

  let gibCompleteCount = 0;
  let sgkCompleteCount = 0;
  const totalActiveCustomers = customersWithCredentials.length;

  for (const customer of customersWithCredentials) {
    if (customer.gibKodu && customer.gibSifre) gibCompleteCount++;
    if (customer.sgkKullaniciAdi && customer.sgkSistemSifresi) sgkCompleteCount++;
  }

  const gibCompletionRate =
    totalActiveCustomers > 0
      ? Math.round((gibCompleteCount / totalActiveCustomers) * 100)
      : 0;

  const sgkCompletionRate =
    totalActiveCustomers > 0
      ? Math.round((sgkCompleteCount / totalActiveCustomers) * 100)
      : 0;

  const groups = customerGroupsData
    .map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      count: g._count.customer_group_members,
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);

  const result: DashboardStats = {
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

  serverCache.set(cacheKey, result, 30_000); // 30 saniye TTL
  return result;
}
