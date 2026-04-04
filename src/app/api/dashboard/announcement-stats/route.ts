import { NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/server-cache";

/**
 * GET /api/dashboard/announcement-stats
 * Duyuru Merkezi widget için istatistikleri döner
 */
export async function GET() {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Server-side cache kontrolu
    const cacheKey = `${user.tenantId}:announcement-stats`;
    const cached = serverCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const baseWhere = {
      tenantId: user.tenantId,
      createdAt: { gte: thirtyDaysAgo },
    };

    // Paralel sorgular
    const [
      total,
      sent,
      failed,
      emailTotal,
      emailSent,
      smsTotal,
      smsSent,
      whatsappTotal,
      whatsappSent,
      upcoming,
    ] = await Promise.all([
      prisma.announcement_logs.count({ where: baseWhere }),
      prisma.announcement_logs.count({ where: { ...baseWhere, status: "sent" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, status: "failed" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "email" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "email", status: "sent" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "sms" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "sms", status: "sent" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "whatsapp" } }),
      prisma.announcement_logs.count({ where: { ...baseWhere, channel: "whatsapp", status: "sent" } }),
      prisma.scheduled_announcements.findMany({
        where: {
          tenantId: user.tenantId,
          status: "active",
          nextExecuteAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          nextExecuteAt: true,
          sendEmail: true,
          sendSms: true,
          sendWhatsApp: true,
        },
        orderBy: { nextExecuteAt: "asc" },
        take: 3,
      }),
    ]);

    // Kanal bilgilerini oluştur
    const upcomingList = upcoming.map((item) => {
      const channels: string[] = [];
      if (item.sendEmail) channels.push("email");
      if (item.sendSms) channels.push("sms");
      if (item.sendWhatsApp) channels.push("whatsapp");
      return {
        id: item.id,
        name: item.name,
        nextExecuteAt: item.nextExecuteAt?.toISOString() ?? "",
        channels,
      };
    });

    const result = {
      total,
      sent,
      failed,
      byChannel: {
        email: { total: emailTotal, sent: emailSent },
        sms: { total: smsTotal, sent: smsSent },
        whatsapp: { total: whatsappTotal, sent: whatsappSent },
      },
      upcoming: upcomingList,
    };

    serverCache.set(cacheKey, result, 120_000); // 120 saniye TTL
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Announcement Stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
