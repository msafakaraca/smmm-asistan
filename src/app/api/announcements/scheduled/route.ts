import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import {
  CreateScheduledAnnouncementRequest,
  UpdateScheduledAnnouncementRequest,
  calculateNextExecuteDate,
  RepeatPattern,
} from "@/components/announcements/types";

/**
 * GET /api/announcements/scheduled
 * Zamanlı duyuru listesini getir
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const [announcements, total] = await Promise.all([
      prisma.scheduled_announcements.findMany({
        where: {
          tenantId: user.tenantId,
          ...(status && { status }),
        },
        include: {
          announcement_templates: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: { announcement_logs: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.scheduled_announcements.count({
        where: {
          tenantId: user.tenantId,
          ...(status && { status }),
        },
      }),
    ]);

    return NextResponse.json({ data: announcements, total });
  } catch (error) {
    console.error("[Scheduled GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements/scheduled
 * Yeni zamanlı duyuru oluştur
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateScheduledAnnouncementRequest = await req.json();
    const {
      name,
      subject,
      content,
      sendEmail,
      sendSms,
      sendWhatsApp,
      scheduledAt,
      repeatPattern,
      repeatDay,
      repeatEndDate,
      targetType,
      customerIds,
      groupIds,
      templateId,
    } = body;

    // Validasyon
    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Duyuru adı zorunludur" },
        { status: 400 }
      );
    }

    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Mesaj içeriği zorunludur" },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "Zamanlama tarihi zorunludur" },
        { status: 400 }
      );
    }

    if (!sendEmail && !sendSms && !sendWhatsApp) {
      return NextResponse.json(
        { error: "En az bir kanal seçilmelidir" },
        { status: 400 }
      );
    }

    if (targetType === "selected" && (!customerIds || customerIds.length === 0)) {
      return NextResponse.json(
        { error: "Hedef müşteri seçilmelidir" },
        { status: 400 }
      );
    }

    if (targetType === "group" && (!groupIds || groupIds.length === 0)) {
      return NextResponse.json(
        { error: "Hedef grup seçilmelidir" },
        { status: 400 }
      );
    }

    // Şablon kontrolü
    if (templateId) {
      const template = await prisma.announcement_templates.findFirst({
        where: { id: templateId, tenantId: user.tenantId },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Şablon bulunamadı" },
          { status: 400 }
        );
      }
    }

    const scheduledDate = new Date(scheduledAt);
    const nextExecuteAt = calculateNextExecuteDate(
      scheduledDate,
      (repeatPattern as RepeatPattern) || null,
      repeatDay
    );

    const announcement = await prisma.scheduled_announcements.create({
      data: {
        name: name.trim(),
        subject: subject?.trim() || null,
        content: content.trim(),
        sendEmail,
        sendSms,
        sendWhatsApp,
        scheduledAt: scheduledDate,
        repeatPattern: repeatPattern || null,
        repeatDay: repeatDay || null,
        repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : null,
        nextExecuteAt: nextExecuteAt || scheduledDate,
        targetType,
        customerIds: customerIds || [],
        groupIds: groupIds || [],
        templateId: templateId || null,
        tenantId: user.tenantId,
        createdBy: user.id,
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("[Scheduled POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/announcements/scheduled
 * Zamanlı duyuru güncelle (id query param ile)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Duyuru ID gerekli" },
        { status: 400 }
      );
    }

    const body: UpdateScheduledAnnouncementRequest = await req.json();

    // Duyurunun var olduğunu ve kullanıcının tenant'ına ait olduğunu kontrol et
    const existing = await prisma.scheduled_announcements.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Duyuru bulunamadı" },
        { status: 404 }
      );
    }

    // Tamamlanmış veya iptal edilmiş duyurular düzenlenemez
    if (existing.status === "completed" || existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Bu duyuru artık düzenlenemez" },
        { status: 400 }
      );
    }

    // nextExecuteAt hesapla (tarih veya tekrarlama değiştiğinde)
    let nextExecuteAt = existing.nextExecuteAt;
    if (body.scheduledAt || body.repeatPattern !== undefined) {
      const scheduledDate = body.scheduledAt
        ? new Date(body.scheduledAt)
        : existing.scheduledAt;
      const pattern = body.repeatPattern !== undefined
        ? (body.repeatPattern as RepeatPattern) || null
        : (existing.repeatPattern as RepeatPattern) || null;
      const day = body.repeatDay !== undefined ? body.repeatDay : existing.repeatDay;

      nextExecuteAt = calculateNextExecuteDate(scheduledDate, pattern, day || undefined) || scheduledDate;
    }

    const announcement = await prisma.scheduled_announcements.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.subject !== undefined && { subject: body.subject?.trim() || null }),
        ...(body.content && { content: body.content.trim() }),
        ...(body.sendEmail !== undefined && { sendEmail: body.sendEmail }),
        ...(body.sendSms !== undefined && { sendSms: body.sendSms }),
        ...(body.sendWhatsApp !== undefined && { sendWhatsApp: body.sendWhatsApp }),
        ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
        ...(body.repeatPattern !== undefined && { repeatPattern: body.repeatPattern || null }),
        ...(body.repeatDay !== undefined && { repeatDay: body.repeatDay || null }),
        ...(body.repeatEndDate !== undefined && {
          repeatEndDate: body.repeatEndDate ? new Date(body.repeatEndDate) : null,
        }),
        ...(body.targetType && { targetType: body.targetType }),
        ...(body.customerIds && { customerIds: body.customerIds }),
        ...(body.groupIds && { groupIds: body.groupIds }),
        ...(body.templateId !== undefined && { templateId: body.templateId || null }),
        ...(body.status && { status: body.status }),
        nextExecuteAt,
      },
    });

    return NextResponse.json(announcement);
  } catch (error) {
    console.error("[Scheduled PUT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/scheduled
 * Zamanlı duyuru sil (id query param ile)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Duyuru ID gerekli" },
        { status: 400 }
      );
    }

    // Duyurunun var olduğunu ve kullanıcının tenant'ına ait olduğunu kontrol et
    const existing = await prisma.scheduled_announcements.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Duyuru bulunamadı" },
        { status: 404 }
      );
    }

    await prisma.scheduled_announcements.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Scheduled DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/announcements/scheduled
 * Zamanlı duyuru durumunu değiştir (pause/resume/cancel)
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");
    const action = searchParams.get("action"); // pause, resume, cancel

    if (!id) {
      return NextResponse.json(
        { error: "Duyuru ID gerekli" },
        { status: 400 }
      );
    }

    if (!action || !["pause", "resume", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Geçersiz aksiyon" },
        { status: 400 }
      );
    }

    const existing = await prisma.scheduled_announcements.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Duyuru bulunamadı" },
        { status: 404 }
      );
    }

    // Durum geçişlerini kontrol et
    if (action === "pause" && existing.status !== "active") {
      return NextResponse.json(
        { error: "Sadece aktif duyurular duraklatılabilir" },
        { status: 400 }
      );
    }

    if (action === "resume" && existing.status !== "paused") {
      return NextResponse.json(
        { error: "Sadece duraklatılmış duyurular devam ettirilebilir" },
        { status: 400 }
      );
    }

    if (action === "cancel" && ["completed", "cancelled"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Bu duyuru zaten tamamlanmış veya iptal edilmiş" },
        { status: 400 }
      );
    }

    const newStatus = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";

    const announcement = await prisma.scheduled_announcements.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json(announcement);
  } catch (error) {
    console.error("[Scheduled PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
