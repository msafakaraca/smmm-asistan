import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { TaskStatus } from "@/types/task";

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

// PATCH - Hızlı status güncelleme (optimistic UI için)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = (await req.json()) as { status: TaskStatus };

    // Status validation
    const validStatuses: TaskStatus[] = ["todo", "in_progress", "completed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Geçersiz status" }, { status: 400 });
    }

    // Görev kontrolü
    const task = await prisma.tasks.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        task_assignees: { select: { userId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    // Erişim kontrolü
    if (user.role === "user") {
      const isCreator = task.createdById === user.id;
      const isAssignee = task.task_assignees.some((a) => a.userId === user.id);
      if (!isCreator && !isAssignee) {
        return NextResponse.json({ error: "Erişim reddedildi" }, { status: 403 });
      }
    }

    // Status güncelle
    const updatedTask = await prisma.tasks.update({
      where: { id },
      data: { status },
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
    const transformedTask = transformTask(updatedTask);
    const taskWithOverdue = {
      ...transformedTask,
      isOverdue:
        updatedTask.status !== "completed" &&
        updatedTask.dueDate !== null &&
        new Date(updatedTask.dueDate) < now,
    };

    return NextResponse.json(taskWithOverdue);
  } catch (error) {
    console.error("[Task Status API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
