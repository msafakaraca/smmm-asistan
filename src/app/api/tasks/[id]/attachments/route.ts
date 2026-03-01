import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/server";

// GET - Görev ekleri
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

    const attachments = await prisma.task_attachments.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[Task Attachments API] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Dosya yükle
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

    // FormData'dan dosya al
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }

    // Dosya boyutu kontrolü (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Dosya boyutu 10MB'dan büyük olamaz" },
        { status: 400 }
      );
    }

    // Unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}_${sanitizedName}`;
    const storagePath = `tasks/${user.tenantId}/${id}/${filename}`;

    // Supabase'e yükle
    const supabase = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Task Attachments API] Upload Error:", uploadError);
      return NextResponse.json(
        { error: "Dosya yüklenemedi" },
        { status: 500 }
      );
    }

    // Public URL al
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Veritabanına kaydet
    const { randomUUID } = await import("crypto");
    const attachment = await prisma.task_attachments.create({
      data: {
        id: randomUUID(),
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: urlData.publicUrl,
        storage: "supabase",
        taskId: id,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("[Task Attachments API] POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Dosya sil
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return NextResponse.json(
        { error: "Attachment ID gerekli" },
        { status: 400 }
      );
    }

    // Attachment kontrolü
    const attachment = await prisma.task_attachments.findFirst({
      where: { id: attachmentId },
      include: {
        tasks: {
          select: { tenantId: true, createdById: true },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
    }

    // Tenant kontrolü
    if (attachment.tasks.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Erişim reddedildi" }, { status: 403 });
    }

    // Silme yetkisi: owner, admin, görev sahibi veya yükleyen
    const canDelete =
      user.role === "owner" ||
      user.role === "admin" ||
      attachment.tasks.createdById === user.id ||
      attachment.uploadedById === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: "Bu dosyayı silme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Supabase'den sil
    if (attachment.storage === "supabase" && attachment.url) {
      const supabase = createAdminClient();
      const path = attachment.url.split("/documents/")[1];
      if (path) {
        await supabase.storage.from("documents").remove([path]);
      }
    }

    // Veritabanından sil
    await prisma.task_attachments.delete({ where: { id: attachmentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Task Attachments API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
