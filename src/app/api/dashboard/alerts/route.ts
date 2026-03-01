import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { DashboardAlert } from "@/types/dashboard";

/**
 * Dashboard Alerts API
 *
 * Sistemdeki uyarıları döner:
 * - Gecikmiş görevler
 * - Eksik GİB şifreleri
 * - Yaklaşan beyanname son tarihleri
 * - Yüksek öncelikli bekleyen görevler
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const now = new Date();
    const alerts: DashboardAlert[] = [];

    // Paralel sorgular
    const [
      overdueTasks,
      highPriorityTasks,
      customersWithoutGib,
      customersWithoutSgk,
    ] = await Promise.all([
      // Gecikmiş görevler
      prisma.tasks.count({
        where: {
          tenantId,
          status: { not: "completed" },
          dueDate: { lt: now },
        },
      }),

      // Yüksek öncelikli bekleyen görevler
      prisma.tasks.count({
        where: {
          tenantId,
          priority: "high",
          status: { not: "completed" },
        },
      }),

      // GİB şifresi eksik aktif müşteriler
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

      // SGK şifresi eksik aktif müşteriler
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

    // Gecikmiş görev uyarısı
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

    // Yüksek öncelikli görev uyarısı
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

    // GİB şifre eksikliği uyarısı
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

    // SGK şifre eksikliği uyarısı
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

    // Uyarıları önem sırasına göre sırala: error > warning > info > success
    const priorityOrder: Record<string, number> = {
      error: 0,
      warning: 1,
      info: 2,
      success: 3,
    };

    alerts.sort(
      (a, b) => priorityOrder[a.type] - priorityOrder[b.type]
    );

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("[Dashboard Alerts API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
