import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
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

  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Silinecek görev ID'leri belirtilmedi" }, { status: 400 });
    }

    // Tüm görevlerin aynı tenant'a ait olduğunu doğrula
    const count = await prisma.tasks.count({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
      },
    });

    if (count !== ids.length) {
      return NextResponse.json(
        { error: "Bazı görevler bulunamadı veya yetkiniz yok" },
        { status: 403 }
      );
    }

    // Transaction ile ilgili tüm kayıtları sil
    await prisma.$transaction(async (tx) => {
      // 1. Task assignees sil
      await tx.task_assignees.deleteMany({
        where: { taskId: { in: ids } },
      });

      // 2. Task comments sil
      await tx.task_comments.deleteMany({
        where: { taskId: { in: ids } },
      });

      // 3. Task attachments sil
      await tx.task_attachments.deleteMany({
        where: { taskId: { in: ids } },
      });

      // 4. Tasks sil
      await tx.tasks.deleteMany({
        where: {
          id: { in: ids },
          tenantId: user.tenantId,
        },
      });
    });

    // Audit log
    await auditLog.bulk(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "tasks",
      "BULK_DELETE",
      count,
      { ids }
    );

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("[Tasks Bulk Delete] Error:", error);
    return NextResponse.json(
      { error: "Görevler silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
