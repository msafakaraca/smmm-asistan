import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { BulkSmsRequest, SendResult, SmsSettings } from "@/components/bulk-send/types";
import { sendNetgsmSms, formatPhoneForSms } from "@/lib/sms/netgsm";
import { decrypt } from "@/lib/crypto";

// Default SMS template
function getDefaultSmsMessage(params: {
  customerName: string;
  documentCount: number;
  year: number;
  month: number;
}): string {
  const { customerName, documentCount, year, month } = params;

  const months = [
    'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
    'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'
  ];
  const monthName = months[month - 1];

  // SMS'te Türkçe karakter kullanılmaz (maliyet 2 katına çıkar)
  return `Sayin ${customerName}, ${year} yili ${monthName} ayi ${documentCount} adet beyanname belgeniz hazirdir. Bilgi icin iletisime geciniz.`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkSmsRequest = await req.json();
    const { documentIds, message } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "No documents selected" },
        { status: 400 }
      );
    }

    // Tenant SMS ayarlarını kontrol et
    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: { settings: true },
    });

    const settings = tenant?.settings as { smsSettings?: SmsSettings } | null;
    const smsSettings = settings?.smsSettings;

    if (!smsSettings?.enabled) {
      return NextResponse.json(
        { error: "SMS ayarları yapılandırılmamış veya devre dışı. Ayarlar > SMS bölümünden yapılandırın." },
        { status: 400 }
      );
    }

    // Dökümanları getir
    const documents = await prisma.documents.findMany({
      where: {
        id: { in: documentIds },
        tenantId: user.tenantId,
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
            telefon1: true,
            telefon2: true,
          },
        },
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No valid documents found" },
        { status: 400 }
      );
    }

    // Müşteri bazında grupla
    const customerGroups = new Map<string, typeof documents>();
    for (const doc of documents) {
      if (!doc.customers) continue;
      const existing = customerGroups.get(doc.customers.id) || [];
      existing.push(doc);
      customerGroups.set(doc.customers.id, existing);
    }

    const result: SendResult = {
      success: true,
      total: documents.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    // SMS provider config
    let decryptedApiKey: string;
    try {
      decryptedApiKey = decrypt(smsSettings.apiKey);
    } catch {
      return NextResponse.json(
        { error: "SMS API anahtarı çözümlenemedi" },
        { status: 500 }
      );
    }

    // Her müşteri için SMS gönder
    for (const [customerId, customerDocs] of customerGroups) {
      const customer = customerDocs[0].customers;
      if (!customer) continue;

      // Telefon kontrolü
      const phone = customer.telefon1 || customer.telefon2;
      if (!phone) {
        for (const doc of customerDocs) {
          result.failed++;
          result.errors.push({
            documentId: doc.id,
            customerId,
            customerName: customer.kisaltma || customer.unvan,
            error: "Telefon numarası bulunamadı",
          });
        }
        continue;
      }

      const formattedPhone = formatPhoneForSms(phone);

      try {
        const year = customerDocs[0].year || new Date().getFullYear();
        const month = customerDocs[0].month || new Date().getMonth() + 1;

        // Mesaj hazırla
        const finalMessage = message || getDefaultSmsMessage({
          customerName: customer.kisaltma || customer.unvan,
          documentCount: customerDocs.length,
          year,
          month,
        });

        // SMS gönder
        const smsResult = await sendNetgsmSms({
          to: formattedPhone,
          message: finalMessage,
          config: {
            usercode: process.env.NETGSM_USERCODE || '',
            password: decryptedApiKey,
            sender: smsSettings.sender,
          },
        });

        if (!smsResult.success) {
          throw new Error(smsResult.error || 'SMS gönderme başarısız');
        }

        // Başarılı - logları güncelle
        for (const doc of customerDocs) {
          const regex = /_([A-Z0-9]+)_\d{2}-\d{4}(?:-\d{2}-\d{4})?_([A-Z_0-9]+)\.pdf$/i;
          const match = doc.name.match(regex);

          await prisma.bulk_send_logs.upsert({
            where: {
              documentId_tenantId: {
                documentId: doc.id,
                tenantId: user.tenantId,
              },
            },
            create: {
              type: "sms",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              smsSent: true,
              smsSentAt: new Date(),
              smsSentTo: formattedPhone,
              year: doc.year || year,
              month: doc.month || month,
              beyannameTuru: match?.[1] || 'DIGER',
              dosyaTipi: match?.[2] || 'BEYANNAME',
              sentBy: user.id,
            },
            update: {
              smsSent: true,
              smsSentAt: new Date(),
              smsSentTo: formattedPhone,
              smsError: null,
              sentBy: user.id,
            },
          });
          result.sent++;
        }
      } catch (error) {
        console.error(`[Bulk SMS] Error for customer ${customerId}:`, error);

        for (const doc of customerDocs) {
          result.failed++;
          result.errors.push({
            documentId: doc.id,
            customerId,
            customerName: customer.kisaltma || customer.unvan,
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          });

          // Hata logunu kaydet
          await prisma.bulk_send_logs.upsert({
            where: {
              documentId_tenantId: {
                documentId: doc.id,
                tenantId: user.tenantId,
              },
            },
            create: {
              type: "sms",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              smsSent: false,
              smsError: error instanceof Error ? error.message : 'Bilinmeyen hata',
              year: doc.year || new Date().getFullYear(),
              month: doc.month || new Date().getMonth() + 1,
              beyannameTuru: 'DIGER',
              dosyaTipi: 'BEYANNAME',
            },
            update: {
              smsError: error instanceof Error ? error.message : 'Bilinmeyen hata',
            },
          });
        }
      }
    }

    result.success = result.failed === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Bulk SMS] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
