import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { UpdateTaskInput } from "@/types/task";

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
    comments: (task.task_comments || []).map((tc: any) => ({
      id: tc.id,
      content: tc.content,
      userId: tc.userId,
      user: tc.user_profiles ? {
        id: tc.user_profiles.id,
        name: tc.user_profiles.name,
        email: tc.user_profiles.email,
        image: tc.user_profiles.image,
      } : { id: tc.userId, name: "Bilinmiyor", email: "" },
      createdAt: tc.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: tc.updatedAt?.toISOString() || new Date().toISOString(),
    })),
    attachments: (task.task_attachments || []).map((ta: any) => ({
      id: ta.id,
      filename: ta.filename,
      originalName: ta.originalName,
      mimeType: ta.mimeType,
      size: ta.size,
      url: ta.url,
      uploadedById: ta.uploadedById,
      createdAt: ta.createdAt?.toISOString() || new Date().toISOString(),
    })),
    _count: {
      comments: task._count?.task_comments || 0,
      attachments: task._count?.task_attachments || 0,
    },
    createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: task.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

// Yetki kontrolü helper
async function checkTaskAccess(
  taskId: string,
  userId: string,
  tenantId: string,
  userRole: string
): Promise<{ hasAccess: boolean; task: Awaited<ReturnType<typeof prisma.tasks.findFirst>> | null }> {
  const task = await prisma.tasks.findFirst({
    where: {
      id: taskId,
      tenantId,
    },
    include: {
      task_assignees: { select: { userId: true } },
    },
  });

  if (!task) {
    return { hasAccess: false, task: null };
  }

  // Owner ve Admin her göreve erişebilir
  if (userRole === "owner" || userRole === "admin") {
    return { hasAccess: true, task };
  }

  // User: sadece oluşturduğu veya atandığı görevler
  const isCreator = task.createdById === userId;
  const isAssignee = task.task_assignees.some((a) => a.userId === userId);

  return { hasAccess: isCreator || isAssignee, task };
}

// GET - Görev detayı
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.tasks.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
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
        task_comments: {
          include: {
            user_profiles: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        task_attachments: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { task_comments: true, task_attachments: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    // Herkes görev detayını görebilir (aynı tenant içinde)

    const now = new Date();
    const transformedTask = transformTask(task);
    const taskWithOverdue = {
      ...transformedTask,
      isOverdue:
        task.status !== "completed" &&
        task.dueDate !== null &&
        new Date(task.dueDate) < now,
    };

    return NextResponse.json({ task: taskWithOverdue });
  } catch (error) {
    console.error("[Task Detail API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Görev güncelle (sadece owner/admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sadece owner/admin düzenleyebilir
    if (user.role !== "owner" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Görev düzenleme yetkiniz yok" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body: UpdateTaskInput = await req.json();

    // Görev kontrolü
    const existingTask = await prisma.tasks.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    // Assignee güncellemesi varsa doğrula
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
        return NextResponse.json({ error: "Geçersiz müşteri" }, { status: 400 });
      }
    }

    // Transaction ile güncelle
    const updatedTask = await prisma.$transaction(async (tx) => {
      const { randomUUID } = await import("crypto");

      // Assignee güncellemesi varsa
      if (body.assigneeIds !== undefined) {
        // Mevcut atamaları sil
        await tx.task_assignees.deleteMany({ where: { taskId: id } });

        // Yeni atamaları ekle
        if (body.assigneeIds.length > 0) {
          await tx.task_assignees.createMany({
            data: body.assigneeIds.map((userId) => ({
              id: randomUUID(),
              taskId: id,
              userId,
            })),
          });
        }
      }

      // Görevi güncelle
      return tx.tasks.update({
        where: { id, tenantId: user.tenantId },
        data: {
          title: body.title?.trim(),
          description: body.description?.trim(),
          priority: body.priority,
          status: body.status,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          customerId: body.customerId,
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

    // Audit log
    await auditLog.update(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "tasks",
      id,
      { title: updatedTask.title, status: updatedTask.status }
    );

    return NextResponse.json(taskWithOverdue);
  } catch (error) {
    console.error("[Task Detail API] PUT Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Görev sil (sadece owner/admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sadece owner/admin silebilir
    if (user.role !== "owner" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Görev silme yetkiniz yok" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Görev kontrolü
    const task = await prisma.tasks.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    await prisma.tasks.delete({ where: { id, tenantId: user.tenantId } });

    // Audit log
    await auditLog.delete(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "tasks",
      id,
      { title: task.title }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Task Detail API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
