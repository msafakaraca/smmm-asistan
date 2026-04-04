import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import type { CreateTaskInput, TaskFilterStatus, TaskPriority } from "@/types/task";

// Prisma response'u frontend tipine dönüştür
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate?.toISOString() || null,
    createdById: task.createdById,
    createdBy: task.user_profiles ? {
      id: task.user_profiles.id,
      name: task.user_profiles.name,
      email: task.user_profiles.email,
      image: task.user_profiles.image,
    } : null,
    tenantId: task.tenantId,
    customerId: task.customerId,
    customer: task.customers ? {
      id: task.customers.id,
      unvan: task.customers.unvan,
      kisaltma: task.customers.kisaltma,
    } : null,
    assignees: (task.task_assignees || []).map((ta: any) => ({
      id: ta.id,
      userId: ta.userId,
      assignedAt: ta.assignedAt?.toISOString() || new Date().toISOString(),
      user: ta.user_profiles ? {
        id: ta.user_profiles.id,
        name: ta.user_profiles.name,
        email: ta.user_profiles.email,
        image: ta.user_profiles.image,
      } : { id: ta.userId, name: "Bilinmiyor", email: "" },
    })),
    _count: {
      comments: task._count?.task_comments || 0,
      attachments: task._count?.task_attachments || 0,
    },
    createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: task.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

// GET - Görev listesi (filtrelenebilir)
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as TaskFilterStatus | null;
    const priority = searchParams.get("priority") as TaskPriority | null;
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Base where clause - tenant isolation
    // Tüm görevler herkese gösterilsin
    const whereClause: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    // Status filtresi
    if (status && status !== "all") {
      if (status === "overdue") {
        // Gecikmiş: dueDate geçmiş ve tamamlanmamış
        whereClause.dueDate = { lt: new Date() };
        whereClause.status = { not: "completed" };
      } else {
        whereClause.status = status;
      }
    }

    // Priority filtresi
    if (priority && (priority as string) !== "all") {
      whereClause.priority = priority;
    }

    // Assignee filtresi
    if (assigneeId && assigneeId !== "all") {
      whereClause.assignees = { some: { userId: assigneeId } };
    }

    // Search filtresi
    if (search) {
      whereClause.title = { contains: search, mode: "insensitive" };
    }

    // Toplam sayı
    const total = await prisma.tasks.count({ where: whereClause });

    // Görevleri getir
    const tasks = await prisma.tasks.findMany({
      where: whereClause,
      include: {
        user_profiles: {
          select: { id: true, name: true, email: true, image: true },
        },
        task_assignees: {
          include: {
            user_profiles: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        customers: {
          select: { id: true, unvan: true, kisaltma: true },
        },
        _count: {
          select: { task_comments: true, task_attachments: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Transform ve isOverdue hesapla
    const now = new Date();
    const transformedTasks = tasks.map((task) => {
      const transformed = transformTask(task);
      return {
        ...transformed,
        isOverdue:
          task.status !== "completed" &&
          task.dueDate !== null &&
          new Date(task.dueDate) < now,
      };
    });

    return NextResponse.json({
      tasks: transformedTasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Tasks API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Yeni görev oluştur (sadece owner/admin)
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sadece owner/admin görev oluşturabilir
    if (user.role !== "owner" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Görev oluşturma yetkiniz yok" },
        { status: 403 }
      );
    }

    const body: CreateTaskInput = await req.json();

    // Validation
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Görev başlığı zorunludur" },
        { status: 400 }
      );
    }

    // Assignee'ların aynı tenant'a ait olduğunu doğrula
    if (body.assigneeIds && body.assigneeIds.length > 0) {
      const validUsers = await prisma.user_profiles.count({
        where: {
          id: { in: body.assigneeIds },
          tenantId: user.tenantId,
        },
      });

      if (validUsers !== body.assigneeIds.length) {
        return NextResponse.json(
          { error: "Geçersiz kullanıcı ataması" },
          { status: 400 }
        );
      }
    }

    // Customer doğrulama
    if (body.customerId) {
      const customer = await prisma.customers.findFirst({
        where: {
          id: body.customerId,
          tenantId: user.tenantId,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Geçersiz müşteri" },
          { status: 400 }
        );
      }
    }

    // Görev oluştur
    const { randomUUID } = await import("crypto");
    const task = await prisma.tasks.create({
      data: {
        id: randomUUID(),
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority: body.priority || "medium",
        status: body.status || "todo",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        createdById: user.id,
        tenantId: user.tenantId,
        customerId: body.customerId || null,
        updatedAt: new Date(),
        task_assignees: body.assigneeIds
          ? {
              create: body.assigneeIds.map((userId) => ({
                id: randomUUID(),
                userId,
              })),
            }
          : undefined,
      },
      include: {
        user_profiles: {
          select: { id: true, name: true, email: true, image: true },
        },
        task_assignees: {
          include: {
            user_profiles: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        customers: {
          select: { id: true, unvan: true, kisaltma: true },
        },
        _count: {
          select: { task_comments: true, task_attachments: true },
        },
      },
    });

    const now = new Date();
    const transformedTask = transformTask(task);
    const taskWithOverdue = {
      ...transformedTask,
      isOverdue:
        task.status !== "completed" &&
        task.dueDate !== null &&
        new Date(task.dueDate) < now,
    };

    // Audit log
    await auditLog.create(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "tasks",
      task.id,
      { title: task.title, priority: task.priority }
    );

    invalidateDashboard(user.tenantId, ['stats', 'alerts', 'tasks-summary']);

    return NextResponse.json(taskWithOverdue, { status: 201 });
  } catch (error) {
    console.error("[Tasks API] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
