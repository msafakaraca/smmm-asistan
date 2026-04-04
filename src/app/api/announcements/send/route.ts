import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whapi";
import { sendSMS } from "@/lib/sms/netgsm";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import {
  SendAnnouncementRequest,
  SendResult,
  replaceTemplateVariables,
  formatPhoneForWhatsApp,
  formatPhoneForSms,
} from "@/components/announcements/types";

/**
 * POST /api/announcements/send
 * Anlık duyuru gönderimi
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SendAnnouncementRequest = await req.json();
    const { customerIds, subject, content, channels } = body;

    if (!customerIds || customerIds.length === 0) {
      return NextResponse.json(
        { error: "Müşteri seçilmedi" },
        { status: 400 }
      );
    }

    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Mesaj içeriği zorunludur" },
        { status: 400 }
      );
    }

    if (!channels.email && !channels.sms && !channels.whatsapp) {
      return NextResponse.json(
        { error: "En az bir kanal seçilmelidir" },
        { status: 400 }
      );
    }

    // Müşterileri getir
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: customerIds },
        tenantId: user.tenantId,
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

    if (customers.length === 0) {
      return NextResponse.json(
        { error: "Geçerli müşteri bulunamadı" },
        { status: 400 }
      );
    }

    // Mail bağlantısını kontrol et (email gönderimi için)
    let emailConnection = null;
    if (channels.email) {
      emailConnection = await prisma.email_oauth_connections.findFirst({
        where: { tenantId: user.tenantId, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (!emailConnection) {
        return NextResponse.json(
          { error: "Mail hesabı bağlı değil. Lütfen önce mail hesabı bağlayın." },
          { status: 400 }
        );
      }
    }

    const result: SendResult = {
      success: true,
      total: 0,
      sent: 0,
      failed: 0,
      results: [],
    };

    // Her müşteri için gönderim yap
    for (const customer of customers) {
      // Şablon değişkenlerini uygula
      const processedContent = replaceTemplateVariables(content, {
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

      const processedSubject = subject
        ? replaceTemplateVariables(subject, {
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
        : undefined;

      // Email gönderimi
      if (channels.email) {
        result.total++;

        if (!customer.email) {
          result.failed++;
          result.results.push({
            customerId: customer.id,
            customerName: customer.kisaltma || customer.unvan,
            channel: "email",
            status: "failed",
            error: "E-posta adresi bulunamadı",
          });

          // Log kaydet
          await createAnnouncementLog({
            tenantId: user.tenantId,
            customerId: customer.id,
            channel: "email",
            status: "failed",
            recipientEmail: null,
            recipientName: customer.kisaltma || customer.unvan,
            subject: processedSubject,
            content: processedContent,
            error: "E-posta adresi bulunamadı",
          });
        } else {
          try {
            // Email gönder
            const htmlBody = processedContent.replace(/\n/g, "<br>");
            const sendResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/email/send`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  connectionId: emailConnection!.id,
                  to: customer.email,
                  subject: processedSubject || "Duyuru",
                  body: htmlBody,
                }),
              }
            );

            const sendResult = await sendResponse.json();

            if (!sendResponse.ok || !sendResult.success) {
              throw new Error(sendResult.error || "Mail gönderme başarısız");
            }

            result.sent++;
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "email",
              status: "sent",
            });

            // Log kaydet
            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "email",
              status: "sent",
              recipientEmail: customer.email,
              recipientName: customer.kisaltma || customer.unvan,
              subject: processedSubject,
              content: processedContent,
              sentAt: new Date(),
            });
          } catch (error) {
            result.failed++;
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "email",
              status: "failed",
              error: errorMessage,
            });

            // Log kaydet
            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "email",
              status: "failed",
              recipientEmail: customer.email,
              recipientName: customer.kisaltma || customer.unvan,
              subject: processedSubject,
              content: processedContent,
              error: errorMessage,
            });
          }
        }
      }

      // SMS gönderimi
      if (channels.sms) {
        result.total++;
        const phone = customer.telefon1 || customer.telefon2;

        if (!phone) {
          result.failed++;
          result.results.push({
            customerId: customer.id,
            customerName: customer.kisaltma || customer.unvan,
            channel: "sms",
            status: "failed",
            error: "Telefon numarası bulunamadı",
          });

          await createAnnouncementLog({
            tenantId: user.tenantId,
            customerId: customer.id,
            channel: "sms",
            status: "failed",
            recipientPhone: null,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            error: "Telefon numarası bulunamadı",
          });
        } else {
          try {
            const formattedPhone = formatPhoneForSms(phone);
            const smsResult = await sendSMS({
              to: formattedPhone,
              message: processedContent,
            });

            if (!smsResult.success) {
              throw new Error(smsResult.error || "SMS gönderme başarısız");
            }

            result.sent++;
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "sms",
              status: "sent",
            });

            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "sms",
              status: "sent",
              recipientPhone: phone,
              recipientName: customer.kisaltma || customer.unvan,
              content: processedContent,
              sentAt: new Date(),
            });
          } catch (error) {
            result.failed++;
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "sms",
              status: "failed",
              error: errorMessage,
            });

            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "sms",
              status: "failed",
              recipientPhone: phone,
              recipientName: customer.kisaltma || customer.unvan,
              content: processedContent,
              error: errorMessage,
            });
          }
        }
      }

      // WhatsApp gönderimi
      if (channels.whatsapp) {
        result.total++;
        const phone = customer.telefon1 || customer.telefon2;

        if (!phone) {
          result.failed++;
          result.results.push({
            customerId: customer.id,
            customerName: customer.kisaltma || customer.unvan,
            channel: "whatsapp",
            status: "failed",
            error: "Telefon numarası bulunamadı",
          });

          await createAnnouncementLog({
            tenantId: user.tenantId,
            customerId: customer.id,
            channel: "whatsapp",
            status: "failed",
            recipientPhone: null,
            recipientName: customer.kisaltma || customer.unvan,
            content: processedContent,
            error: "Telefon numarası bulunamadı",
          });
        } else {
          try {
            const formattedPhone = formatPhoneForWhatsApp(phone);
            const waResult = await sendWhatsAppMessage({
              to: formattedPhone,
              message: processedContent,
            });

            if (!waResult.success) {
              throw new Error(waResult.error || "WhatsApp gönderme başarısız");
            }

            result.sent++;
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "whatsapp",
              status: "sent",
            });

            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "whatsapp",
              status: "sent",
              recipientPhone: phone,
              recipientName: customer.kisaltma || customer.unvan,
              content: processedContent,
              sentAt: new Date(),
            });
          } catch (error) {
            result.failed++;
            const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
            result.results.push({
              customerId: customer.id,
              customerName: customer.kisaltma || customer.unvan,
              channel: "whatsapp",
              status: "failed",
              error: errorMessage,
            });

            await createAnnouncementLog({
              tenantId: user.tenantId,
              customerId: customer.id,
              channel: "whatsapp",
              status: "failed",
              recipientPhone: phone,
              recipientName: customer.kisaltma || customer.unvan,
              content: processedContent,
              error: errorMessage,
            });
          }
        }

        // WhatsApp rate limiting: 1 mesaj/saniye
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    result.success = result.failed === 0;

    invalidateDashboard(user.tenantId, ['announcement-stats']);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Announcements Send] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Yardımcı fonksiyon: Log kaydet
async function createAnnouncementLog(data: {
  tenantId: string;
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
  announcementId?: string;
}) {
  await prisma.announcement_logs.create({
    data: {
      tenantId: data.tenantId,
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
      announcementId: data.announcementId,
    },
  });
}
