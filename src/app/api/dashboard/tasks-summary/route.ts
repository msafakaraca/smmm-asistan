import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type {
  TaskSummaryItem,
  TaskSummaryStats,
  TaskSummaryData,
  AssigneeTaskSummary,
} from "@/types/dashboard";

/**
 * Dashboard Task Summary API
 *
 * Görev özeti için detaylı veri döner:
 * - İstatistikler (toplam, tamamlanan, geciken, öncelik dağılımı)
 * - Haftalık karşılaştırma (bu hafta vs geçen hafta)
 * - Geciken görevler listesi
 * - Yaklaşan görevler listesi
 * - Bugün bitenler
 * - Atanan kişi bazlı özet
 * - Son tamamlanan görevler
 */

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Configurable limit (default: 5, max: 20)
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "5");
    const limit = Math.min(Math.max(1, limitParam), 20);

    const now = new Date();

    // Tarih hesaplamaları
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const endOfTomorrow = new Date(endOfToday);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Haftalık karşılaştırma için tarihler
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setMilliseconds(-1);

    // Base where clause - tenant isolation
    const baseWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    // User rolündeki kullanıcılar sadece kendi görevlerini görür
    if (user.role === "user") {
      baseWhere.OR = [
        { createdById: user.id },
        { task_assignees: { some: { userId: user.id } } },
      ];
    }

    // Paralel sorgular - Ana istatistikler
    const [
      // Stats
      totalCount,
      completedCount,
      inProgressCount,
      todoCount,
      overdueCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      // Bugün ve yarın
      dueTodayCount,
      dueTomorrowCount,
      // Haftalık karşılaştırma
      completedThisWeek,
      completedLastWeek,
      createdThisWeek,
      createdLastWeek,
      // Lists
      overdueTasks,
      upcomingTasks,
      todayTasks,
      recentlyCompleted,
      // Atanan kişiler
      assigneeData,
    ] = await Promise.all([
      // Total
      prisma.tasks.count({ where: baseWhere }),
      // Completed
      prisma.tasks.count({ where: { ...baseWhere, status: "completed" } }),
      // In Progress
      prisma.tasks.count({ where: { ...baseWhere, status: "in_progress" } }),
      // Todo
      prisma.tasks.count({ where: { ...baseWhere, status: "todo" } }),
      // Overdue (tamamlanmamış ve due date geçmiş)
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: { lt: now },
        },
      }),
      // High priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "high", status: { not: "completed" } },
      }),
      // Medium priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "medium", status: { not: "completed" } },
      }),
      // Low priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "low", status: { not: "completed" } },
      }),
      // Bugün biten
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      // Yarın biten
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: {
            gt: endOfToday,
            lte: endOfTomorrow,
          },
        },
      }),
      // Bu hafta tamamlanan
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: "completed",
          updatedAt: { gte: startOfThisWeek },
        },
      }),
      // Geçen hafta tamamlanan
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: "completed",
          updatedAt: {
            gte: startOfLastWeek,
            lte: endOfLastWeek,
          },
        },
      }),
      // Bu hafta oluşturulan
      prisma.tasks.count({
        where: {
          ...baseWhere,
          createdAt: { gte: startOfThisWeek },
        },
      }),
      // Geçen hafta oluşturulan
      prisma.tasks.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: startOfLastWeek,
            lte: endOfLastWeek,
          },
        },
      }),
      // Geciken görevler listesi
      prisma.tasks.findMany({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        include: {
          customers: {
            select: {
              id: true,
              unvan: true,
              kisaltma: true,
            },
          },
          user_profiles: {
            select: {
              id: true,
              name: true,
            },
          },
          task_assignees: {
            include: {
              user_profiles: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      // Yaklaşan görevler listesi (7 gün içinde)
      prisma.tasks.findMany({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: {
            gte: now,
            lte: sevenDaysLater,
          },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        include: {
          customers: {
            select: {
              id: true,
              unvan: true,
              kisaltma: true,
            },
          },
          user_profiles: {
            select: {
              id: true,
              name: true,
            },
          },
          task_assignees: {
            include: {
              user_profiles: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      // Bugün biten görevler
      prisma.tasks.findMany({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        include: {
          customers: {
            select: {
              id: true,
              unvan: true,
              kisaltma: true,
            },
          },
          user_profiles: {
            select: {
              id: true,
              name: true,
            },
          },
          task_assignees: {
            include: {
              user_profiles: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      // Son tamamlanan görevler
      prisma.tasks.findMany({
        where: {
          ...baseWhere,
          status: "completed",
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          customers: {
            select: {
              id: true,
              unvan: true,
              kisaltma: true,
            },
          },
          user_profiles: {
            select: {
              id: true,
              name: true,
            },
          },
          task_assignees: {
            include: {
              user_profiles: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      // Atanan kişi bazlı istatistikler
      prisma.task_assignees.groupBy({
        by: ["userId"],
        where: {
          tasks: baseWhere,
        },
        _count: {
          taskId: true,
        },
      }),
    ]);

    // Atanan kişi detaylarını al
    const assigneeIds = assigneeData.map((a) => a.userId);
    const assigneeProfiles = assigneeIds.length > 0
      ? await prisma.user_profiles.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    // N+1 Optimizasyonu: Tek sorguda tüm atanan kişilerin görev istatistiklerini al
    let assigneeSummary: AssigneeTaskSummary[] = [];

    if (assigneeIds.length > 0) {
      // Tüm atanan kişilerin görevlerini tek sorguda al
      const assigneeTasks = await prisma.tasks.findMany({
        where: {
          ...baseWhere,
          task_assignees: { some: { userId: { in: assigneeIds } } },
        },
        select: {
          id: true,
          status: true,
          dueDate: true,
          task_assignees: {
            where: { userId: { in: assigneeIds } },
            select: { userId: true },
          },
        },
      });

      // Client-side aggregation - çok daha hızlı
      const assigneeStatsMap = new Map<string, {
        total: number;
        completed: number;
        inProgress: number;
        overdue: number;
      }>();

      // Initialize stats for each assignee
      assigneeIds.forEach(id => {
        assigneeStatsMap.set(id, { total: 0, completed: 0, inProgress: 0, overdue: 0 });
      });

      // Aggregate task stats
      assigneeTasks.forEach(task => {
        task.task_assignees.forEach(assignee => {
          const stats = assigneeStatsMap.get(assignee.userId);
          if (stats) {
            stats.total++;
            if (task.status === "completed") {
              stats.completed++;
            } else if (task.status === "in_progress") {
              stats.inProgress++;
            }
            // Overdue check
            if (task.status !== "completed" && task.dueDate && task.dueDate < now) {
              stats.overdue++;
            }
          }
        });
      });

      // Build assignee summary
      assigneeSummary = assigneeProfiles.map(profile => {
        const stats = assigneeStatsMap.get(profile.id) || { total: 0, completed: 0, inProgress: 0, overdue: 0 };
        return {
          id: profile.id,
          fullName: profile.name || "İsimsiz",
          image: profile.image,
          totalTasks: stats.total,
          completedTasks: stats.completed,
          inProgressTasks: stats.inProgress,
          overdueTasks: stats.overdue,
          completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        };
      });

      // Sırala: en çok görevi olan önce
      assigneeSummary.sort((a, b) => b.totalTasks - a.totalTasks);
    }

    // Transform tasks
    const transformTask = (task: typeof overdueTasks[0], isOverdue: boolean): TaskSummaryItem => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      let daysOverdue: number | undefined;
      let daysUntil: number | undefined;

      if (dueDate) {
        // Gün bazlı hesaplama - saatleri sıfırlayarak karşılaştır
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const dueDateStart = new Date(dueDate);
        dueDateStart.setHours(0, 0, 0, 0);

        const diffTime = dueDateStart.getTime() - todayStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (isOverdue) {
          daysOverdue = Math.abs(diffDays);
        } else {
          daysUntil = diffDays;
        }
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority as "low" | "medium" | "high",
        status: task.status as "todo" | "in_progress" | "completed",
        dueDate: task.dueDate?.toISOString() || null,
        createdAt: task.createdAt.toISOString(),
        daysOverdue,
        daysUntil,
        customer: task.customers,
        createdBy: task.user_profiles
          ? { id: task.user_profiles.id, fullName: task.user_profiles.name || "İsimsiz" }
          : null,
        assignees: task.task_assignees.map((a: { user_profiles: { id: string; name: string | null; image: string | null } }) => ({
          id: a.user_profiles.id,
          fullName: a.user_profiles.name || "İsimsiz",
          image: a.user_profiles.image,
        })),
        tags: [],
      };
    };

    // Haftalık trend hesapla
    const weeklyChange = completedLastWeek > 0
      ? Math.round(((completedThisWeek - completedLastWeek) / completedLastWeek) * 100)
      : completedThisWeek > 0 ? 100 : 0;

    const trend: "up" | "down" | "stable" =
      weeklyChange > 0 ? "up" : weeklyChange < 0 ? "down" : "stable";

    const response: TaskSummaryData = {
      stats: {
        total: totalCount,
        completed: completedCount,
        inProgress: inProgressCount,
        todo: todoCount,
        overdue: overdueCount,
        highPriority: highPriorityCount,
        mediumPriority: mediumPriorityCount,
        lowPriority: lowPriorityCount,
        dueToday: dueTodayCount,
        dueTomorrow: dueTomorrowCount,
        weeklyComparison: {
          completedThisWeek,
          completedLastWeek,
          createdThisWeek,
          createdLastWeek,
          trend,
          changePercent: Math.abs(weeklyChange),
        },
      },
      overdueTasks: overdueTasks.map((t) => transformTask(t, true)),
      upcomingTasks: upcomingTasks.map((t) => transformTask(t, false)),
      todayTasks: todayTasks.map((t) => transformTask(t, false)),
      assigneeSummary: assigneeSummary.slice(0, 5), // Top 5
      recentlyCompleted: recentlyCompleted.map((t) => transformTask(t, false)),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Dashboard Tasks Summary API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
