import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import type { BulkSendDocument, BulkSendFilterRequest, DosyaTipi, ParsedDocumentInfo } from "@/components/bulk-send/types";

// Dosya tipini normalize et
function normalizeDosyaTipi(str: string | undefined): DosyaTipi {
  if (!str) return 'BEYANNAME';
  const normalized = str.toUpperCase();
  if (normalized.includes('SGK_TAHAKKUK') || normalized === 'SGK_TAHAKKUK') return 'SGK_TAHAKKUK';
  if (normalized.includes('HIZMET') || normalized === 'HIZMET_LISTESI') return 'HIZMET_LISTESI';
  if (normalized.includes('TAHAKKUK') || normalized === 'TAHAKKUK') return 'TAHAKKUK';
  return 'BEYANNAME';
}

// Dosya adından beyanname bilgilerini parse et
function parseDocumentName(filename: string): ParsedDocumentInfo | null {
  // YENI FORMAT (GIB Bot - VKN bazli):
  // {VKN}_{BeyannameTuru}_{Yil}-{Ay}_{FileCategory}.pdf
  // Ornek: 1234567890_KDV1_2025-01_BEYANNAME.pdf
  //        1234567890_MUHSGK_2025-01_SGK_TAHAKKUK_1.pdf
  const newFormatRegex = /^(\d{10,11})_([A-Z0-9]+)_(\d{4})-(\d{2})_([A-Z_0-9]+?)(?:_(\d+))?\.pdf$/i;

  // ESKI FORMAT (Legacy):
  // {UNVAN}_{BEYANNAMETURU}_{AY}-{YIL}_{TIP}.pdf
  // Ornek: Fazli_Demirturk_KDV1_12-2025-12-2025_BEYANNAME.pdf
  const oldFormatRegex = /_([A-Z0-9]+)_(\d{2})-(\d{4})(?:-\d{2}-\d{4})?_([A-Z_0-9]+)\.pdf$/i;

  // Oncelikle yeni formati dene
  let match = filename.match(newFormatRegex);
  if (match) {
    const [, , beyannameTuru, yearStr, monthStr, dosyaTipiStr] = match;
    return {
      beyannameTuru: beyannameTuru.toUpperCase(),
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
      dosyaTipi: normalizeDosyaTipi(dosyaTipiStr),
    };
  }

  // Eski formati dene (geriye uyumluluk)
  match = filename.match(oldFormatRegex);
  if (match) {
    const [, beyannameTuru, monthStr, yearStr, dosyaTipiStr] = match;
    return {
      beyannameTuru: beyannameTuru.toUpperCase(),
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
      dosyaTipi: normalizeDosyaTipi(dosyaTipiStr),
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    console.log("[Bulk Send Documents] Starting...");

    const user = await getUserWithProfile();
    if (!user) {
      console.log("[Bulk Send Documents] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[Bulk Send Documents] User:", user.id, "Tenant:", user.tenantId);

    const body: BulkSendFilterRequest = await req.json();
    console.log("[Bulk Send Documents] Body:", JSON.stringify(body));
    const {
      customerIds,
      groupIds,
      beyannameTypes,
      documentTypes,
      status,
      yearStart,
      monthStart,
      yearEnd,
      monthEnd,
    } = body;

    // Önce dönem aralığındaki dosyaları çek
    const whereClause: {
      tenantId: string;
      isFolder: boolean;
      customerId: { not: null } | { in: string[] };
      OR?: Array<{
        AND: Array<{
          year?: { gte?: number; lte?: number; equals?: number };
          month?: { gte?: number; lte?: number };
        }>;
      }>;
      name?: { endsWith: string };
    } = {
      tenantId: user.tenantId,
      isFolder: false,
      customerId: { not: null },
      name: { endsWith: '.pdf' },
    };

    // Müşteri filtresi (customerIds veya groupIds)
    let effectiveCustomerIds: string[] = [];

    // Önce customerIds'leri ekle
    if (customerIds && customerIds.length > 0) {
      effectiveCustomerIds = [...customerIds];
    }

    // Gruplardan müşteri ID'lerini al
    if (groupIds && groupIds.length > 0) {
      const groupMembers = await prisma.customer_group_members.findMany({
        where: {
          groupId: { in: groupIds },
        },
        select: { customerId: true },
      });

      const memberIds = groupMembers.map((m) => m.customerId);

      // Eğer customerIds boşsa, sadece grup üyelerini kullan
      // Eğer customerIds doluysa, kesişim al (her iki filtreyi de karşılayanlar)
      if (effectiveCustomerIds.length === 0) {
        effectiveCustomerIds = memberIds;
      } else {
        // Kesişim: Her iki listede de bulunan ID'ler
        const customerIdSet = new Set(effectiveCustomerIds);
        effectiveCustomerIds = memberIds.filter((id) => customerIdSet.has(id));
      }
    }

    // Eğer müşteri filtresi varsa uygula
    if (effectiveCustomerIds.length > 0) {
      whereClause.customerId = { in: effectiveCustomerIds };
    }

    // Dönem filtresi
    // Aynı yılda: yearStart-monthStart ile yearEnd-monthEnd arasını al
    // Farklı yıllarda: Union olarak al
    if (yearStart === yearEnd) {
      whereClause.OR = [
        {
          AND: [
            { year: { equals: yearStart } },
            { month: { gte: monthStart, lte: monthEnd } },
          ],
        },
      ];
    } else {
      // Farklı yıllar arasında
      whereClause.OR = [
        // Başlangıç yılı
        {
          AND: [
            { year: { equals: yearStart } },
            { month: { gte: monthStart } },
          ],
        },
        // Ara yıllar
        {
          AND: [
            { year: { gte: yearStart + 1, lte: yearEnd - 1 } },
          ],
        },
        // Bitiş yılı
        {
          AND: [
            { year: { equals: yearEnd } },
            { month: { lte: monthEnd } },
          ],
        },
      ];
    }

    // Dosyaları çek
    console.log("[Bulk Send Documents] Querying database...");
    const documents = await prisma.documents.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: whereClause as any,
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
            email: true,
            telefon1: true,
            telefon2: true,
          },
        },
        bulk_send_logs: {
          where: { tenantId: user.tenantId },
          take: 1,
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { name: 'asc' },
      ],
    });
    console.log("[Bulk Send Documents] Found", documents.length, "documents");

    // Dosyaları parse et ve filtrele
    const result: BulkSendDocument[] = [];

    for (const doc of documents) {
      if (!doc.customers) continue;

      // Dosya adından beyanname bilgilerini parse et
      const parsed = parseDocumentName(doc.name);
      if (!parsed) continue;

      // Beyanname türü filtresi
      if (beyannameTypes && beyannameTypes.length > 0) {
        if (!beyannameTypes.includes(parsed.beyannameTuru)) continue;
      }

      // Dosya tipi filtresi
      if (documentTypes && documentTypes.length > 0) {
        if (!documentTypes.includes(parsed.dosyaTipi)) continue;
      }

      // Send status
      const sendLog = doc.bulk_send_logs[0];
      const sendStatus = sendLog
        ? {
            mailSent: sendLog.mailSent,
            mailSentAt: sendLog.mailSentAt?.toISOString() || null,
            mailSentTo: sendLog.mailSentTo,
            mailError: sendLog.mailError,
            whatsappSent: sendLog.whatsappSent,
            whatsappSentAt: sendLog.whatsappSentAt?.toISOString() || null,
            whatsappSentTo: sendLog.whatsappSentTo,
            whatsappType: sendLog.whatsappType as 'link' | 'document' | 'text' | 'document_text' | null,
            whatsappError: sendLog.whatsappError,
            smsSent: sendLog.smsSent,
            smsSentAt: sendLog.smsSentAt?.toISOString() || null,
            smsSentTo: sendLog.smsSentTo,
            smsError: sendLog.smsError,
          }
        : null;

      // Gönderim durumu filtresi
      if (status) {
        if (status.mailSent !== undefined) {
          const isSent = sendStatus?.mailSent || false;
          if (status.mailSent !== isSent) continue;
        }
        if (status.whatsappSent !== undefined) {
          const isSent = sendStatus?.whatsappSent || false;
          if (status.whatsappSent !== isSent) continue;
        }
        if (status.smsSent !== undefined) {
          const isSent = sendStatus?.smsSent || false;
          if (status.smsSent !== isSent) continue;
        }
      }

      result.push({
        id: doc.id,
        name: doc.name,
        originalName: doc.originalName,
        path: doc.path,
        size: doc.size,
        mimeType: doc.mimeType,
        year: doc.year,
        month: doc.month,
        beyannameTuru: parsed.beyannameTuru,
        dosyaTipi: parsed.dosyaTipi,
        customerId: doc.customers.id,
        customerName: doc.customers.unvan,
        customerKisaltma: doc.customers.kisaltma,
        customerEmail: doc.customers.email,
        customerTelefon1: doc.customers.telefon1,
        customerTelefon2: doc.customers.telefon2,
        sendStatus,
        createdAt: doc.createdAt.toISOString(),
      });
    }

    // İstatistikler
    const stats = {
      totalDocuments: result.length,
      totalCustomers: new Set(result.map((d) => d.customerId)).size,
      mailSent: result.filter((d) => d.sendStatus?.mailSent).length,
      whatsappSent: result.filter((d) => d.sendStatus?.whatsappSent).length,
      smsSent: result.filter((d) => d.sendStatus?.smsSent).length,
      notSent: result.filter(
        (d) =>
          !d.sendStatus?.mailSent &&
          !d.sendStatus?.whatsappSent &&
          !d.sendStatus?.smsSent
      ).length,
    };

    return NextResponse.json({
      documents: result,
      stats,
    });
  } catch (error) {
    console.error("[Bulk Send Documents] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
