/**
 * Dashboard Toplu Gönderim Özeti API
 *
 * Belirtilen dönem için toplu gönderim istatistiklerini ve son gönderim kayıtlarını döner.
 * GET /api/dashboard/bulk-send-summary?year=2026&month=1
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

// Ay isimleri (dönem badge için)
const MONTH_NAMES = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

// Beyanname türü kod → tam ad eşlemesi
const BEYANNAME_LABELS: Record<string, string> = {
  KDV1: "KDV",
  KDV2: "KDV-2",
  KDV9015: "KDV Tevkifat",
  MUHSGK: "MUHSGK",
  GGECICI: "Geçici Vergi (Gelir)",
  KGECICI: "Geçici Vergi (Kurum)",
  DAMGA: "Damga Vergisi",
  BA: "BA Formu",
  BS: "BS Formu",
  FORMBA: "Form BA",
  FORMBS: "Form BS",
  GV: "Geçici Vergi",
  GELIR: "Gelir Vergisi",
  KURUMLAR: "Kurumlar Vergisi",
  KONAKLAMA: "Konaklama Vergisi",
  TURIZM: "Turizm Payı",
  YILLIKGELIR: "Yıllık Gelir",
  YILLIKKURUMLAR: "Yıllık Kurumlar",
  SORUMLU: "Sorumlu KDV",
  INDIRIMLI: "İndirimli Oran",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = user.tenantId;

    // Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let defaultMonth = currentMonth - 1;
    let defaultYear = currentYear;
    if (defaultMonth === 0) {
      defaultMonth = 12;
      defaultYear = currentYear - 1;
    }

    const year = parseInt(searchParams.get("year") || String(defaultYear));
    const month = parseInt(searchParams.get("month") || String(defaultMonth));

    // 3 paralel sorgu: toplam dosya, gönderim istatistikleri, son gönderimler
    const [totalDocuments, sendLogs, recentSends] = await Promise.all([
      // 1. Bu dönemdeki toplam dosya sayısı (gönderilecek dosyalar)
      prisma.documents.count({
        where: {
          tenantId,
          year,
          month,
          isFolder: false,
          customerId: { not: null },
        },
      }),

      // 2. Gönderim istatistikleri (bulk_send_logs)
      prisma.bulk_send_logs.findMany({
        where: {
          tenantId,
          year,
          month,
        },
        select: {
          id: true,
          status: true,
          mailSent: true,
          whatsappSent: true,
          smsSent: true,
          mailError: true,
          whatsappError: true,
          smsError: true,
        },
      }),

      // 3. Son gönderimler (müşteri bilgisiyle birlikte, gruplandıktan sonra 5'e düşürülür)
      prisma.bulk_send_logs.findMany({
        where: {
          tenantId,
          year,
          month,
          OR: [
            { mailSent: true },
            { whatsappSent: true },
            { smsSent: true },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          customerId: true,
          mailSent: true,
          mailSentAt: true,
          whatsappSent: true,
          whatsappSentAt: true,
          smsSent: true,
          smsSentAt: true,
          beyannameTuru: true,
          dosyaTipi: true,
          createdAt: true,
          documents: {
            select: {
              customers: {
                select: {
                  id: true,
                  unvan: true,
                  kisaltma: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Gönderim istatistiklerini hesapla
    let sent = 0;
    let failed = 0;

    for (const log of sendLogs) {
      const anySent = log.mailSent || log.whatsappSent || log.smsSent;
      const anyError = log.mailError || log.whatsappError || log.smsError;

      if (anySent) {
        sent++;
      } else if (anyError) {
        failed++;
      }
    }

    const pending = totalDocuments - sent - failed;
    const coveragePercent = totalDocuments > 0
      ? Math.round((sent / totalDocuments) * 100)
      : 0;

    // Son gönderim kayıtlarını müşteri bazlı grupla
    // customerId -> en son kayıt grubu
    const customerMap = new Map<string, {
      customerName: string;
      channel: "mail" | "whatsapp" | "sms";
      beyannameTurleri: Set<string>;
      documentCount: number;
      sentAt: Date;
      id: string;
    }>();

    for (const log of recentSends) {
      const customer = log.documents?.customers;
      if (!customer) continue;

      const customerId = customer.id;
      const customerName = customer.kisaltma || customer.unvan;

      // Ana kanalı belirle
      let channel: "mail" | "whatsapp" | "sms" = "mail";
      let sentAt: Date | null = null;

      if (log.mailSent && log.mailSentAt) {
        channel = "mail";
        sentAt = log.mailSentAt;
      } else if (log.whatsappSent && log.whatsappSentAt) {
        channel = "whatsapp";
        sentAt = log.whatsappSentAt;
      } else if (log.smsSent && log.smsSentAt) {
        channel = "sms";
        sentAt = log.smsSentAt;
      }

      if (!sentAt) sentAt = log.createdAt;

      const existing = customerMap.get(customerId);
      if (existing) {
        if (log.beyannameTuru) existing.beyannameTurleri.add(log.beyannameTuru);
        existing.documentCount++;
        if (sentAt > existing.sentAt) {
          existing.sentAt = sentAt;
          existing.channel = channel;
        }
      } else {
        customerMap.set(customerId, {
          customerName,
          channel,
          beyannameTurleri: new Set(log.beyannameTuru ? [log.beyannameTuru] : []),
          documentCount: 1,
          sentAt,
          id: log.id,
        });
      }
    }

    // Map'i array'e dönüştür ve son gönderime göre sırala
    const recentSendsList = Array.from(customerMap.entries())
      .map(([, value]) => ({
        id: value.id,
        customerName: value.customerName,
        channel: value.channel,
        beyannameTurleri: Array.from(value.beyannameTurleri).map(
          (code) => BEYANNAME_LABELS[code] || code
        ),
        documentCount: value.documentCount,
        sentAt: value.sentAt.toISOString(),
      }))
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, 3);

    return NextResponse.json({
      stats: {
        totalDocuments,
        sent,
        pending: Math.max(0, pending),
        failed,
        coveragePercent,
      },
      recentSends: recentSendsList,
      period: {
        year,
        month,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
      },
    });
  } catch (error) {
    console.error("[Dashboard Bulk Send Summary API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
