import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { BulkMailRequest, SendResult } from "@/components/bulk-send/types";
import { downloadFile } from "@/lib/storage-supabase";
import path from "path";
import fs from "fs";

// Default mail template
function getDefaultMailTemplate(params: {
  customerName: string;
  documents: Array<{ name: string; beyannameTuru: string; dosyaTipi: string }>;
  year: number;
  month: number;
}): { subject: string; body: string } {
  const { customerName, documents, year, month } = params;

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  const monthName = months[month - 1];

  // Beyanname türlerini listele
  const beyannameTypes = [...new Set(documents.map(d => d.beyannameTuru))].join(', ');

  const documentList = documents
    .map(d => `- ${d.name}`)
    .join('\n');

  return {
    subject: `${beyannameTypes} Beyanname - ${monthName} ${year}`,
    body: `Sayın ${customerName},

${year} yılı ${monthName} ayına ait beyanname belgeleriniz ekte sunulmuştur.

Ekteki Belgeler:
${documentList}

Bilgilerinize sunar, iyi çalışmalar dileriz.

Saygılarımızla;
Mali Müşavirlik Ofisi`,
  };
}

// SSE stream gönderimi için
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkMailRequest = await req.json();
    const { documentIds, subject, body: customBody, groupByCustomer } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "No documents selected" },
        { status: 400 }
      );
    }

    // Mail bağlantısını kontrol et
    const emailConnection = await prisma.email_oauth_connections.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!emailConnection) {
      return NextResponse.json(
        { error: "Mail hesabı bağlı değil. Lütfen önce mail hesabı bağlayın." },
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
            email: true,
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

    // Her müşteri için mail gönder
    for (const [customerId, customerDocs] of customerGroups) {
      const customer = customerDocs[0].customers;
      if (!customer) continue;

      // Email adresi kontrolü
      if (!customer.email) {
        for (const doc of customerDocs) {
          result.failed++;
          result.errors.push({
            documentId: doc.id,
            customerId,
            customerName: customer.kisaltma || customer.unvan,
            error: "E-posta adresi bulunamadı",
          });
        }
        continue;
      }

      try {
        // Dosyaları hazırla (base64)
        const attachments: Array<{ filename: string; content: string; mimeType: string }> = [];

        for (const doc of customerDocs) {
          if (doc.path) {
            try {
              let fileBuffer: Buffer;

              // Storage tipine göre dosyayı indir
              if (doc.storage === 'supabase') {
                // Supabase Storage'dan indir
                const blob = await downloadFile(doc.path);
                const arrayBuffer = await blob.arrayBuffer();
                fileBuffer = Buffer.from(arrayBuffer);
              } else {
                // Local storage (geriye uyumluluk)
                const storagePath = doc.path.startsWith('uploads/')
                  ? path.join(process.cwd(), 'public', doc.path)
                  : path.join(process.cwd(), 'storage', doc.path);

                if (!fs.existsSync(storagePath)) {
                  console.warn(`[Bulk Mail] Local file not found: ${storagePath}`);
                  continue;
                }
                fileBuffer = fs.readFileSync(storagePath);
              }

              const base64Content = fileBuffer.toString('base64');

              attachments.push({
                filename: doc.name,
                content: base64Content,
                mimeType: doc.mimeType || 'application/pdf',
              });
            } catch (fileError) {
              console.error(`[Bulk Mail] Error downloading file ${doc.name}:`, fileError);
            }
          }
        }

        // Template oluştur
        const year = customerDocs[0].year || new Date().getFullYear();
        const month = customerDocs[0].month || new Date().getMonth() + 1;

        const docInfos = customerDocs.map(d => {
          // Dosya adından tür bilgisi parse et
          // YENI FORMAT: {VKN}_{BeyannameTuru}_{Yil}-{Ay}_{FileCategory}.pdf
          const newFormatRegex = /^(\d{10,11})_([A-Z0-9]+)_(\d{4})-(\d{2})_([A-Z_0-9]+?)(?:_(\d+))?\.pdf$/i;
          // ESKI FORMAT: {UNVAN}_{BEYANNAMETURU}_{AY}-{YIL}_{TIP}.pdf
          const oldFormatRegex = /_([A-Z0-9]+)_\d{2}-\d{4}(?:-\d{2}-\d{4})?_([A-Z_0-9]+)\.pdf$/i;

          let newMatch = d.name.match(newFormatRegex);
          if (newMatch) {
            return {
              name: d.name,
              beyannameTuru: newMatch[2]?.toUpperCase() || 'DIGER',
              dosyaTipi: newMatch[5]?.toUpperCase() || 'BEYANNAME',
            };
          }

          const oldMatch = d.name.match(oldFormatRegex);
          return {
            name: d.name,
            beyannameTuru: oldMatch?.[1]?.toUpperCase() || 'DIGER',
            dosyaTipi: oldMatch?.[2]?.toUpperCase() || 'BEYANNAME',
          };
        });

        const template = getDefaultMailTemplate({
          customerName: customer.kisaltma || customer.unvan,
          documents: docInfos,
          year,
          month,
        });

        const finalSubject = subject || template.subject;
        const finalBody = customBody || template.body;

        // Mail gönder
        const htmlBody = finalBody.replace(/\n/g, '<br>');

        const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: emailConnection.id,
            to: customer.email,
            subject: finalSubject,
            body: htmlBody,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok || !sendResult.success) {
          throw new Error(sendResult.error || 'Mail gönderme başarısız');
        }

        // Başarılı - logları güncelle
        for (const doc of customerDocs) {
          await prisma.bulk_send_logs.upsert({
            where: {
              documentId_tenantId: {
                documentId: doc.id,
                tenantId: user.tenantId,
              },
            },
            create: {
              type: "email",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              mailSent: true,
              mailSentAt: new Date(),
              mailSentTo: customer.email,
              year: doc.year || year,
              month: doc.month || month,
              beyannameTuru: docInfos.find(d => d.name === doc.name)?.beyannameTuru || 'DIGER',
              dosyaTipi: docInfos.find(d => d.name === doc.name)?.dosyaTipi || 'BEYANNAME',
              sentBy: user.id,
            },
            update: {
              mailSent: true,
              mailSentAt: new Date(),
              mailSentTo: customer.email,
              mailError: null,
              sentBy: user.id,
            },
          });
          result.sent++;
        }
      } catch (error) {
        console.error(`[Bulk Mail] Error for customer ${customerId}:`, error);

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
              type: "email",
              documentId: doc.id,
              customerId,
              tenantId: user.tenantId,
              mailSent: false,
              mailError: error instanceof Error ? error.message : 'Bilinmeyen hata',
              year: doc.year || new Date().getFullYear(),
              month: doc.month || new Date().getMonth() + 1,
              beyannameTuru: 'DIGER',
              dosyaTipi: 'BEYANNAME',
            },
            update: {
              mailError: error instanceof Error ? error.message : 'Bilinmeyen hata',
            },
          });
        }
      }
    }

    result.success = result.failed === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Bulk Mail] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
