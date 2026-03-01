import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whapi";
import { sendSMS } from "@/lib/sms/netgsm";
import {
  replaceTemplateVariables,
  formatPhoneForWhatsApp,
  formatPhoneForSms,
  calculateNextExecuteDate,
  RepeatPattern,
} from "@/components/announcements/types";

/**
 * GET /api/cron/announcements
 * Vercel Cron Job - Zamanlı duyuruları işle
 * Her 15 dakikada bir çalışır
 */
export async function GET(req: NextRequest) {
  try {
    // Cron secret kontrolü
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    console.log(`[Cron Announcements] Starting at ${now.toISOString()}`);

    // Bekleyen duyuruları getir
    const pendingAnnouncements = await prisma.scheduled_announcements.findMany({
      where: {
        status: "active",
        nextExecuteAt: { lte: now },
      },
      include: {
        tenants: true,
      },
    });

    console.log(`[Cron Announcements] Found ${pendingAnnouncements.length} pending announcements`);

    let processedCount = 0;
    let errorCount = 0;

    for (const announcement of pendingAnnouncements) {
      try {
        await processAnnouncement(announcement);
        processedCount++;
      } catch (error) {
        console.error(`[Cron Announcements] Error processing ${announcement.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: pendingAnnouncements.length,
      executedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[Cron Announcements] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Tek bir duyuruyu işle
 */
async function processAnnouncement(announcement: {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  sendEmail: boolean;
  sendSms: boolean;
  sendWhatsApp: boolean;
  targetType: string;
  customerIds: string[];
  groupIds: string[];
  repeatPattern: string | null;
  repeatDay: number | null;
  repeatEndDate: Date | null;
  scheduledAt: Date;
  tenantId: string;
}) {
  console.log(`[Cron Announcements] Processing: ${announcement.name} (${announcement.id})`);

  // Hedef müşterileri belirle
  let customerIds: string[] = [];

  if (announcement.targetType === "all") {
    // Tüm aktif müşteriler
    const customers = await prisma.customers.findMany({
      where: { tenantId: announcement.tenantId, status: "active" },
      select: { id: true },
    });
    customerIds = customers.map((c) => c.id);
  } else if (announcement.targetType === "selected") {
    customerIds = announcement.customerIds;
  } else if (announcement.targetType === "group") {
    // Grup üyelerini getir
    const members = await prisma.customer_group_members.findMany({
      where: { groupId: { in: announcement.groupIds } },
      select: { customerId: true },
    });
    customerIds = [...new Set(members.map((m) => m.customerId))];
  }

  if (customerIds.length === 0) {
    console.log(`[Cron Announcements] No customers for announcement ${announcement.id}`);
    await updateAnnouncementStatus(announcement);
    return;
  }

  // Müşteri detaylarını getir
  const customers = await prisma.customers.findMany({
    where: {
      id: { in: customerIds },
      tenantId: announcement.tenantId,
      status: "active",
    },
    select: {
      id: true,
      unvan: true,
      kisaltma: true,
      vknTckn: true,
      email: true,
      telefon1: true,
      telefon2: true,
    },
  });

  // Email bağlantısını al (email gönderimi için)
  let emailConnection = null;
  if (announcement.sendEmail) {
    emailConnection = await prisma.email_oauth_connections.findFirst({
      where: { tenantId: announcement.tenantId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // Her müşteri için gönderim yap
  for (const customer of customers) {
    const processedContent = replaceTemplateVariables(announcement.content, {
      id: customer.id,
      unvan: customer.unvan,
      kisaltma: customer.kisaltma,
      vknTckn: customer.vknTckn,
      email: customer.email,
      telefon1: customer.telefon1,
      sirketTipi: "",
      status: "active",
      groups: [],
    });

    const processedSubject = announcement.subject
      ? replaceTemplateVariables(announcement.subject, {
          id: customer.id,
          unvan: customer.unvan,
          kisaltma: customer.kisaltma,
          vknTckn: customer.vknTckn,
          email: customer.email,
          telefon1: customer.telefon1,
          sirketTipi: "",
          status: "active",
          groups: [],
        })
      : null;

    // Email gönderimi
    if (announcement.sendEmail && customer.email && emailConnection) {
      try {
        const htmlBody = processedContent.replace(/\n/g, "<br>");
        const sendResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/email/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionId: emailConnection.id,
              to: customer.email,
              subject: processedSubject || "Duyuru",
              body: htmlBody,
            }),
          }
        );

        const success = sendResponse.ok;
        await createLog({
          tenantId: announcement.tenantId,
          announcementId: announcement.id,
          customerId: customer.id,
          channel: "email",
          status: success ? "sent" : "failed",
          recipientEmail: customer.email,
          recipientName: customer.kisaltma || customer.unvan,
          subject: processedSubject,
          content: processedContent,
          sentAt: success ? new Date() : undefined,
          error: success ? undefined : "Email gönderimi başarısız",
        });
      } catch (error) {
        await createLog({
          tenantId: announcement.tenantId,
          announcementId: announcement.id,
          customerId: customer.id,
          channel: "email",
          status: "failed",
          recipientEmail: customer.email,
          recipientName: customer.kisaltma || customer.unvan,
          subject: processedSubject,
          content: processedContent,
          error: error instanceof Error ? error.message : "Bilinmeyen hata",
        });
      }
    }

    // SMS gönderimi
    if (announcement.sendSms) {
      const phone = customer.telefon1 || customer.telefon2;
      if (phone) {
        try {
          const formattedPhone = formatPhoneForSms(phone);
          const smsResult = await sendSMS({
            to: formattedPhone,
            message: processedContent,
          });

          await createLog({
            tenantId: announcement.tenantId,
            announcementId: announcement.id,
            customerId: customer.id,
            channel: "sms",
            status: smsResult.success ? "sent" : "failed",
            recipientPhone: phone,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            sentAt: smsResult.success ? new Date() : undefined,
            error: smsResult.success ? undefined : smsResult.error,
          });
        } catch (error) {
          await createLog({
            tenantId: announcement.tenantId,
            announcementId: announcement.id,
            customerId: customer.id,
            channel: "sms",
            status: "failed",
            recipientPhone: phone,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            error: error instanceof Error ? error.message : "Bilinmeyen hata",
          });
        }
      }
    }

    // WhatsApp gönderimi
    if (announcement.sendWhatsApp) {
      const phone = customer.telefon1 || customer.telefon2;
      if (phone) {
        try {
          const formattedPhone = formatPhoneForWhatsApp(phone);
          const waResult = await sendWhatsAppMessage({
            to: formattedPhone,
            message: processedContent,
          });

          await createLog({
            tenantId: announcement.tenantId,
            announcementId: announcement.id,
            customerId: customer.id,
            channel: "whatsapp",
            status: waResult.success ? "sent" : "failed",
            recipientPhone: phone,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            sentAt: waResult.success ? new Date() : undefined,
            error: waResult.success ? undefined : waResult.error,
          });

          // WhatsApp rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          await createLog({
            tenantId: announcement.tenantId,
            announcementId: announcement.id,
            customerId: customer.id,
            channel: "whatsapp",
            status: "failed",
            recipientPhone: phone,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            error: error instanceof Error ? error.message : "Bilinmeyen hata",
          });
        }
      }
    }
  }

  // Duyuru durumunu güncelle
  await updateAnnouncementStatus(announcement);
}

/**
 * Duyuru durumunu güncelle
 */
async function updateAnnouncementStatus(announcement: {
  id: string;
  repeatPattern: string | null;
  repeatDay: number | null;
  repeatEndDate: Date | null;
  scheduledAt: Date;
}) {
  const now = new Date();

  // Tekrarlama kontrolü
  if (announcement.repeatPattern && announcement.repeatPattern !== "once") {
    // Sonraki çalışma tarihini hesapla
    const nextExecuteAt = calculateNextExecuteDate(
      announcement.scheduledAt,
      announcement.repeatPattern as RepeatPattern,
      announcement.repeatDay || undefined
    );

    // Bitiş tarihi kontrolü
    if (
      nextExecuteAt &&
      (!announcement.repeatEndDate || nextExecuteAt <= announcement.repeatEndDate)
    ) {
      // Sonraki çalışma için güncelle
      await prisma.scheduled_announcements.update({
        where: { id: announcement.id },
        data: {
          lastExecutedAt: now,
          nextExecuteAt,
        },
      });
      return;
    }
  }

  // Tek seferlik veya tekrarlama sona erdi - completed olarak işaretle
  await prisma.scheduled_announcements.update({
    where: { id: announcement.id },
    data: {
      lastExecutedAt: now,
      nextExecuteAt: null,
      status: "completed",
    },
  });
}

/**
 * Log kaydı oluştur
 */
async function createLog(data: {
  tenantId: string;
  announcementId: string;
  customerId: string;
  channel: string;
  status: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientName: string;
  subject?: string | null;
  content: string;
  sentAt?: Date;
  error?: string;
}) {
  await prisma.announcement_logs.create({
    data: {
      tenantId: data.tenantId,
      announcementId: data.announcementId,
      customerId: data.customerId,
      channel: data.channel,
      status: data.status,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      recipientName: data.recipientName,
      subject: data.subject,
      content: data.content,
      sentAt: data.sentAt,
      error: data.error,
    },
  });
}
