import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/server-cache";
import type { DashboardAlert } from "@/types/dashboard";

interface UserProfile {
  id: string;
  tenantId: string;
}

/**
 * Dashboard Alerts Resolver
 * Mevcut alerts/route.ts logic'ini resolver fonksiyona çıkarır.
 */
export async function resolveAlerts(
  user: UserProfile,
): Promise<DashboardAlert[]> {
  const tenantId = user.tenantId;

  // Server-side cache kontrolu
  const cacheKey = `${tenantId}:alerts`;
  const cached = serverCache.get<DashboardAlert[]>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const alerts: DashboardAlert[] = [];

  const [
    overdueTasks,
    highPriorityTasks,
    customersWithoutGib,
    customersWithoutSgk,
  ] = await Promise.all([
    prisma.tasks.count({
      where: {
        tenantId,
        status: { not: "completed" },
        dueDate: { lt: now },
      },
    }),
    prisma.tasks.count({
      where: {
        tenantId,
        priority: "high",
        status: { not: "completed" },
      },
    }),
    prisma.customers.count({
      where: {
        tenantId,
        status: "active",
        OR: [
          { gibKodu: null },
          { gibKodu: "" },
          { gibSifre: null },
          { gibSifre: "" },
        ],
      },
    }),
    prisma.customers.count({
      where: {
        tenantId,
        status: "active",
        OR: [
          { sgkKullaniciAdi: null },
          { sgkKullaniciAdi: "" },
          { sgkSistemSifresi: null },
          { sgkSistemSifresi: "" },
        ],
      },
    }),
  ]);

  if (overdueTasks > 0) {
    alerts.push({
      id: "overdue-tasks",
      type: "error",
      title: "Gecikmiş Görevler",
      message: `${overdueTasks} adet görevin teslim tarihi geçti.`,
      link: "/dashboard/gorevler?filter=overdue",
      linkText: "Görevleri görüntüle",
      createdAt: now.toISOString(),
      count: overdueTasks,
    });
  }

  if (highPriorityTasks > 0) {
    alerts.push({
      id: "high-priority-tasks",
      type: "warning",
      title: "Yüksek Öncelikli Görevler",
      message: `${highPriorityTasks} adet yüksek öncelikli görev bekliyor.`,
      link: "/dashboard/gorevler?priority=high",
      linkText: "Görevleri görüntüle",
      createdAt: now.toISOString(),
      count: highPriorityTasks,
    });
  }

  if (customersWithoutGib > 0) {
    alerts.push({
      id: "missing-gib-credentials",
      type: "warning",
      title: "Eksik GİB Şifreleri",
      message: `${customersWithoutGib} müşterinin GİB şifreleri eksik.`,
      link: "/dashboard/mukellefler?filter=gib-eksik",
      linkText: "Müşterileri görüntüle",
      createdAt: now.toISOString(),
      count: customersWithoutGib,
    });
  }

  if (customersWithoutSgk > 0) {
    alerts.push({
      id: "missing-sgk-credentials",
      type: "info",
      title: "Eksik SGK Şifreleri",
      message: `${customersWithoutSgk} müşterinin SGK şifreleri eksik.`,
      link: "/dashboard/mukellefler?filter=sgk-eksik",
      linkText: "Müşterileri görüntüle",
      createdAt: now.toISOString(),
      count: customersWithoutSgk,
    });
  }

  // Bugün veya yarın teslim tarihi olan görevler
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const upcomingTasks = await prisma.tasks.count({
    where: {
      tenantId,
      status: { not: "completed" },
      dueDate: {
        gte: now,
        lte: tomorrow,
      },
    },
  });

  if (upcomingTasks > 0) {
    alerts.push({
      id: "upcoming-tasks",
      type: "info",
      title: "Yaklaşan Teslim Tarihleri",
      message: `${upcomingTasks} görevin teslim tarihi bugün veya yarın.`,
      link: "/dashboard/gorevler?filter=upcoming",
      linkText: "Görevleri görüntüle",
      createdAt: now.toISOString(),
      count: upcomingTasks,
    });
  }

  // Önem sırasına göre sırala
  const priorityOrder: Record<string, number> = {
    error: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  alerts.sort(
    (a, b) => priorityOrder[a.type] - priorityOrder[b.type]
  );

  serverCache.set(cacheKey, alerts, 60_000); // 60 saniye TTL
  return alerts;
}
