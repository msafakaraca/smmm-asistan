import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { BulkWhatsAppRequest, SendResult } from "@/components/bulk-send/types";
import path from "path";
import fs from "fs";

// Telefon numarasını WhatsApp formatına çevir
function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return '90' + digits.slice(1);
  }

  if (digits.startsWith('5') && digits.length === 10) {
    return '90' + digits;
  }

  return '90' + digits;
}

// Default WhatsApp message template
function getDefaultWhatsAppMessage(params: {
  customerName: string;
  documentCount: number;
  year: number;
  month: number;
}): string {
  const { customerName, documentCount, year, month } = params;

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const monthName = months[month - 1];

  return `Sayın ${customerName},

${year} yılı ${monthName} ayına ait ${documentCount} adet beyanname belgeniz bilginize sunulmuştur.

İyi çalışmalar dileriz.`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkWhatsAppRequest = await req.json();
    const { documentIds, message, sendType } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "No documents selected" },
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

    // WHAPI API key kontrolü
    const whapiApiKey = process.env.WHAPI_API_KEY;
    if (!whapiApiKey) {
      return NextResponse.json(
        { error: "WhatsApp API yapılandırılmamış" },
        { status: 500 }
      );
    }

    // Her müşteri için WhatsApp gönder
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

      const formattedPhone = formatPhoneForWhatsApp(phone);

      try {
        const year = customerDocs[0].year || new Date().getFullYear();
        const month = customerDocs[0].month || new Date().getMonth() + 1;

        // Mesaj hazırla
        const finalMessage = message || getDefaultWhatsAppMessage({
          customerName: customer.kisaltma || customer.unvan,
          documentCount: customerDocs.length,
          year,
          month,
        });

        switch (sendType) {
          case 'text':
            // Sadece metin gönder
            await sendWhatsAppText(whapiApiKey, formattedPhone, finalMessage);
            break;

          case 'link':
            // Public URL'ler ile metin gönder
            const urls = customerDocs.map(doc => {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
              return `${baseUrl}/api/files/view?path=${encodeURIComponent(doc.path || '')}`;
            });
            const messageWithLinks = `${finalMessage}\n\nBelgeler:\n${urls.join('\n')}`;
            await sendWhatsAppText(whapiApiKey, formattedPhone, messageWithLinks);
            break;

          case 'document':
            // Dokümanları gönder
            for (const doc of customerDocs) {
              if (doc.path) {
                await sendWhatsAppDocument(whapiApiKey, formattedPhone, doc.path, doc.name);
              }
            }
            break;

          case 'document_text':
            // Önce metin, sonra dokümanlar
            await sendWhatsAppText(whapiApiKey, formattedPhone, finalMessage);
            for (const doc of customerDocs) {
              if (doc.path) {
                await sendWhatsAppDocument(whapiApiKey, formattedPhone, doc.path, doc.name);
              }
            }
            break;
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
              type: "whatsapp",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              whatsappSent: true,
              whatsappSentAt: new Date(),
              whatsappSentTo: formattedPhone,
              whatsappType: sendType,
              year: doc.year || year,
              month: doc.month || month,
              beyannameTuru: match?.[1] || 'DIGER',
              dosyaTipi: match?.[2] || 'BEYANNAME',
              sentBy: user.id,
            },
            update: {
              whatsappSent: true,
              whatsappSentAt: new Date(),
              whatsappSentTo: formattedPhone,
              whatsappType: sendType,
              whatsappError: null,
              sentBy: user.id,
            },
          });
          result.sent++;
        }
      } catch (error) {
        console.error(`[Bulk WhatsApp] Error for customer ${customerId}:`, error);

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
              type: "whatsapp",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              whatsappSent: false,
              whatsappError: error instanceof Error ? error.message : 'Bilinmeyen hata',
              year: doc.year || new Date().getFullYear(),
              month: doc.month || new Date().getMonth() + 1,
              beyannameTuru: 'DIGER',
              dosyaTipi: 'BEYANNAME',
            },
            update: {
              whatsappError: error instanceof Error ? error.message : 'Bilinmeyen hata',
            },
          });
        }
      }
    }

    result.success = result.failed === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Bulk WhatsApp] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// WhatsApp metin gönder
async function sendWhatsAppText(apiKey: string, phone: string, message: string): Promise<void> {
  const response = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: `${phone}@s.whatsapp.net`,
      body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'WhatsApp mesaj gönderme başarısız');
  }
}

// WhatsApp doküman gönder
async function sendWhatsAppDocument(apiKey: string, phone: string, filePath: string, filename: string): Promise<void> {
  // Dosyayı oku
  const storagePath = filePath.startsWith('uploads/')
    ? path.join(process.cwd(), 'public', filePath)
    : path.join(process.cwd(), 'storage', filePath);

  if (!fs.existsSync(storagePath)) {
    throw new Error(`Dosya bulunamadı: ${filename}`);
  }

  const fileBuffer = fs.readFileSync(storagePath);
  const base64Content = fileBuffer.toString('base64');

  const response = await fetch('https://gate.whapi.cloud/messages/document', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: `${phone}@s.whatsapp.net`,
      media: `data:application/pdf;base64,${base64Content}`,
      filename: filename,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'WhatsApp doküman gönderme başarısız');
  }
}
