import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/announcements/logs
 * Duyuru loglarını getir
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const announcementId = searchParams.get("announcementId");
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Where koşullarını oluştur
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (announcementId) {
      where.announcementId = announcementId;
    }

    if (channel) {
      where.channel = channel;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.announcement_logs.findMany({
        where,
        include: {
          customers: {
            select: {
              id: true,
              unvan: true,
              kisaltma: true,
            },
          },
          scheduled_announcements: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.announcement_logs.count({ where }),
    ]);

    return NextResponse.json({ data: logs, total });
  } catch (error) {
    console.error("[Logs GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/announcements/logs/stats
 * Log istatistiklerini getir
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate } = body;

    // Tarih aralığı filtresi
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    // İstatistikleri hesapla
    const [
      totalLogs,
      sentLogs,
      failedLogs,
      emailLogs,
      smsLogs,
      whatsappLogs,
    ] = await Promise.all([
      prisma.announcement_logs.count({ where }),
      prisma.announcement_logs.count({ where: { ...where, status: "sent" } }),
      prisma.announcement_logs.count({ where: { ...where, status: "failed" } }),
      prisma.announcement_logs.count({ where: { ...where, channel: "email" } }),
      prisma.announcement_logs.count({ where: { ...where, channel: "sms" } }),
      prisma.announcement_logs.count({ where: { ...where, channel: "whatsapp" } }),
    ]);

    // Kanala göre başarı oranları
    const emailSent = await prisma.announcement_logs.count({
      where: { ...where, channel: "email", status: "sent" },
    });
    const smsSent = await prisma.announcement_logs.count({
      where: { ...where, channel: "sms", status: "sent" },
    });
    const whatsappSent = await prisma.announcement_logs.count({
      where: { ...where, channel: "whatsapp", status: "sent" },
    });

    return NextResponse.json({
      total: totalLogs,
      sent: sentLogs,
      failed: failedLogs,
      byChannel: {
        email: {
          total: emailLogs,
          sent: emailSent,
          failed: emailLogs - emailSent,
          successRate: emailLogs > 0 ? Math.round((emailSent / emailLogs) * 100) : 0,
        },
        sms: {
          total: smsLogs,
          sent: smsSent,
          failed: smsLogs - smsSent,
          successRate: smsLogs > 0 ? Math.round((smsSent / smsLogs) * 100) : 0,
        },
        whatsapp: {
          total: whatsappLogs,
          sent: whatsappSent,
          failed: whatsappLogs - whatsappSent,
          successRate: whatsappLogs > 0 ? Math.round((whatsappSent / whatsappLogs) * 100) : 0,
        },
      },
      overallSuccessRate: totalLogs > 0 ? Math.round((sentLogs / totalLogs) * 100) : 0,
    });
  } catch (error) {
    console.error("[Logs Stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
