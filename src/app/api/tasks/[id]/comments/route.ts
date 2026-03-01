import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

// GET - Görev yorumları
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

    const comments = await prisma.task_comments.findMany({
      where: { taskId: id },
      include: {
        user_profiles: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[Task Comments API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Yorum ekle
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { content } = (await req.json()) as { content: string };

    // Validation
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Yorum içeriği zorunludur" },
        { status: 400 }
      );
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

    // Yorum oluştur
    const { randomUUID } = await import("crypto");
    const comment = await prisma.task_comments.create({
      data: {
        id: randomUUID(),
        content: content.trim(),
        taskId: id,
        userId: user.id,
        updatedAt: new Date(),
      },
      include: {
        user_profiles: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("[Task Comments API] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Yorum sil
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "Yorum ID'si gerekli" },
        { status: 400 }
      );
    }

    // Yorum kontrolü
    const comment = await prisma.task_comments.findFirst({
      where: { id: commentId },
      include: {
        tasks: {
          select: { tenantId: true, createdById: true },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 });
    }

    // Tenant kontrolü
    if (comment.tasks.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Erişim reddedildi" }, { status: 403 });
    }

    // Silme yetkisi: owner, admin, görev sahibi veya yorum sahibi
    const canDelete =
      user.role === "owner" ||
      user.role === "admin" ||
      comment.tasks.createdById === user.id ||
      comment.userId === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: "Bu yorumu silme yetkiniz yok" },
        { status: 403 }
      );
    }

    await prisma.task_comments.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Task Comments API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
