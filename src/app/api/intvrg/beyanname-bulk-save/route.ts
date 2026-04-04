import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile, generateStoragePath } from "@/lib/storage-supabase";
import { ensureBeyannameFolderChainLocked } from "@/lib/file-system";
import { Prisma } from "@prisma/client";

/**
 * POST /api/intvrg/beyanname-bulk-save
 * Ultra-hızlı toplu PDF kaydetme:
 * - Tek auth check + tek müşteri sorgusu
 * - Toplu duplicate check (tek DB sorgusu)
 * - Paralel Supabase Storage upload + Document create
 * - Toplu arşiv merge (ay bazında gruplandırılmış)
 *
 * Body: {
 *   customerId: string;
 *   items: Array<{
 *     pdfBase64: string;
 *     beyoid: string;
 *     turKodu: string;
 *     turAdi: string;
 *     donem: string;
 *     versiyon: string;
 *   }>;
 * }
 */

interface BulkSaveItem {
  pdfBase64: string;
  beyoid: string;
  turKodu: string;
  turAdi: string;
  donem: string;
  versiyon: string;
}

interface ItemResult {
  beyoid: string;
  saved: boolean;
  skipped: boolean;
  failed: boolean;
  documentId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, items } = body as { customerId: string; items: BulkSaveItem[] };

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerId ve items zorunludur" },
        { status: 400 }
      );
    }

    // Tek sorguda müşteri bilgisi
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true, unvan: true, vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // Dosya adları oluştur + dönem parse (geçersiz dönemleri filtrele)
    const enriched = items
      .map((item) => {
        const year = parseInt(item.donem.substring(0, 4), 10);
        const month = parseInt(item.donem.substring(4, 6), 10);
        if (isNaN(year) || isNaN(month)) return null;
        const monthPadded = String(month).padStart(2, "0");
        const filename = `${customer.vknTckn}_${item.turKodu}_${year}-${monthPadded}_BEYANNAME.pdf`;
        return { ...item, year, month, monthPadded, filename };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Toplu duplicate check — TEK DB sorgusu
    const allFilenames = enriched.map((i) => i.filename);
    const existingDocs = await prisma.documents.findMany({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory: "BEYANNAME",
        name: { in: allFilenames },
      },
      select: { name: true },
    });
    const existingSet = new Set(existingDocs.map((d) => d.name));

    // Ayır: kaydedilecek vs atlanacak
    const toSave = enriched.filter((i) => !existingSet.has(i.filename));
    const skippedItems = enriched.filter((i) => existingSet.has(i.filename));

    // Paralel kaydet — Promise.allSettled ile hata izolasyonu
    const saveResults = await Promise.allSettled(
      toSave.map(async (item) => {
        const buffer = Buffer.from(item.pdfBase64, "base64");
        const storagePath = generateStoragePath(
          user.tenantId,
          customerId,
          item.year,
          item.month,
          item.filename
        );

        // Klasör zinciri oluştur: Beyannameler → Yıl → TürKodu
        const targetFolderId = await ensureBeyannameFolderChainLocked(
          user.tenantId,
          customerId,
          "Beyannameler",
          "beyanname",
          item.year,
          item.turKodu
        );

        // Önce Supabase'e yükle, sonra DB kaydı oluştur (sıralı — race condition önleme)
        await adminUploadFile(storagePath, buffer, "application/pdf");
        const docResult = await prisma.documents.create({
          data: {
            name: item.filename,
            originalName: `${item.turAdi || item.turKodu} - ${item.monthPadded}/${item.year} (v${item.versiyon || "1"})`,
            type: "pdf",
            mimeType: "application/pdf",
            size: buffer.length,
            path: storagePath,
            storage: "supabase",
            year: item.year,
            month: item.month,
            vknTckn: customer.vknTckn,
            beyannameTuru: item.turKodu,
            fileCategory: "BEYANNAME",
            customerId,
            tenantId: user.tenantId,
            parentId: targetFolderId,
          },
        });

        return { beyoid: item.beyoid, documentId: docResult.id };
      })
    );

    // Sonuçları derle
    const results: ItemResult[] = [];

    // Kaydedilenler
    for (let i = 0; i < toSave.length; i++) {
      const r = saveResults[i];
      if (r.status === "fulfilled") {
        results.push({
          beyoid: r.value.beyoid,
          saved: true,
          skipped: false,
          failed: false,
          documentId: r.value.documentId,
        });
      } else {
        console.error(`[BULK-SAVE] Item hatası (${toSave[i].beyoid}):`, r.reason);
        results.push({
          beyoid: toSave[i].beyoid,
          saved: false,
          skipped: false,
          failed: true,
        });
      }
    }

    // Atlananlar
    for (const item of skippedItems) {
      results.push({
        beyoid: item.beyoid,
        saved: false,
        skipped: true,
        failed: false,
      });
    }

    // Arşiv merge — response öncesi await (serverless'ta bağlantı kopmasını önler)
    const savedItems = toSave.filter(
      (_, i) => saveResults[i].status === "fulfilled"
    );
    if (savedItems.length > 0) {
      try {
        await bulkArchiveMerge(user.tenantId, user.id, customerId, savedItems);
      } catch (err) {
        console.error("[BULK-SAVE] Arşiv merge hatası:", err);
      }
    }

    const saved = results.filter((r) => r.saved).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => r.failed).length;

    return NextResponse.json({ results, saved, skipped, failed });
  } catch (error) {
    console.error("[BULK-SAVE] Genel hata:", error);
    return NextResponse.json(
      { error: "PDF kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * Retry wrapper — geçici DB bağlantı hatalarında yeniden dener
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        ("code" in error &&
          ((error as { code: string }).code === "P1001" ||
            (error as { code: string }).code === "P1017" ||
            (error as { code: string }).code === "P2024"));
      if (!isRetryable || attempt === maxRetries) throw error;
      console.warn(
        `[BULK-SAVE] DB bağlantı hatası, ${attempt}/${maxRetries} deneme — ${delayMs * attempt}ms bekleniyor...`
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("Retry limit aşıldı");
}

/**
 * Toplu arşiv merge — ay bazında gruplayıp tek seferde merge
 */
async function bulkArchiveMerge(
  tenantId: string,
  userId: string,
  customerId: string,
  items: Array<{
    turKodu: string;
    turAdi: string;
    donem: string;
    beyoid: string;
    versiyon: string;
    year: number;
    month: number;
  }>
) {
  // Ay bazında grupla
  const byMonth = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.year}-${item.month}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(item);
  }

  // Her ay için sırayla merge (çakışma önleme)
  for (const [, monthItems] of byMonth) {
    const { year, month } = monthItems[0];

    const newEntries = monthItems.map((i) => ({
      turKodu: i.turKodu,
      turAdi: i.turAdi,
      donem: i.donem,
      beyoid: i.beyoid,
      versiyon: i.versiyon,
    }));

    // upsert ile race condition önleme (P2002 hatası artık oluşmaz)
    const record = await withRetry(() => prisma.query_archives.upsert({
      where: {
        tenantId_customerId_queryType_month_year: {
          tenantId,
          customerId,
          queryType: "beyanname",
          month,
          year,
        },
      },
      create: {
        tenantId,
        customerId,
        userId,
        queryType: "beyanname",
        month,
        year,
        resultData: newEntries as unknown as Prisma.InputJsonValue,
        resultMeta: Prisma.JsonNull,
        queryHistory: [
          {
            date: new Date().toISOString(),
            addedCount: newEntries.length,
          },
        ] as unknown as Prisma.InputJsonValue,
        totalCount: newEntries.length,
      },
      update: {
        lastQueriedAt: new Date(),
      },
    }));

    // Upsert update path'inde (kayıt zaten varsa) merge gerekir
    const existingResults =
      (record.resultData as Record<string, unknown>[]) || [];
    const existingBeyoids = new Set(existingResults.map((r) => r.beyoid));
    const toAdd = newEntries.filter((e) => !existingBeyoids.has(e.beyoid));

    if (toAdd.length > 0 && existingResults.length > 0) {
      const merged = [
        ...existingResults,
        ...(toAdd as unknown as Record<string, unknown>[]),
      ];
      await withRetry(() => prisma.query_archives.update({
        where: { id: record.id },
        data: {
          resultData: merged as unknown as Prisma.InputJsonValue,
          totalCount: merged.length,
          queryCount: record.queryCount + 1,
        },
      }));
    }
  }
}
