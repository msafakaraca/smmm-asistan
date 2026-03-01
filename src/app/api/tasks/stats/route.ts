import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { TaskStats } from "@/types/task";

// GET - Dashboard istatistikleri
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Base where clause
    const baseWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    // User rolündeki kullanıcılar sadece kendi görevlerini görür
    if (user.role === "user") {
      baseWhere.OR = [
        { createdById: user.id },
        { assignees: { some: { userId: user.id } } },
      ];
    }

    const now = new Date();

    // Paralel sorgular ile istatistikleri al
    const [
      lowPriority,
      mediumPriority,
      highPriority,
      totalTasks,
      completedTasks,
      overdueTasks,
      todoCount,
      inProgressCount,
    ] = await Promise.all([
      // Low priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "low", status: { not: "completed" } },
      }),
      // Medium priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "medium", status: { not: "completed" } },
      }),
      // High priority (tamamlanmamış)
      prisma.tasks.count({
        where: { ...baseWhere, priority: "high", status: { not: "completed" } },
      }),
      // Toplam görev
      prisma.tasks.count({
        where: baseWhere,
      }),
      // Tamamlanan görevler
      prisma.tasks.count({
        where: { ...baseWhere, status: "completed" },
      }),
      // Gecikmiş görevler
      prisma.tasks.count({
        where: {
          ...baseWhere,
          status: { not: "completed" },
          dueDate: { lt: now },
        },
      }),
      // To Do
      prisma.tasks.count({
        where: { ...baseWhere, status: "todo" },
      }),
      // In Progress
      prisma.tasks.count({
        where: { ...baseWhere, status: "in_progress" },
      }),
    ]);

    const stats: TaskStats = {
      lowPriority,
      mediumPriority,
      highPriority,
      totalTasks,
      completedTasks,
      overdueTasks,
      todoCount,
      inProgressCount,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Tasks Stats API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
