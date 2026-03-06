/**
 * SGK E-Bildirge Bulk Save API Endpoint
 * ======================================
 * Birden fazla SGK PDF'ini tek istekte toplu kaydeder.
 * Auth 1 kez, customer 1 kez sorgulanır, PDF'ler paralel yüklenir.
 *
 * POST /api/sgk/ebildirge-bulk-save
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile, generateStoragePath } from "@/lib/storage-supabase";

interface BulkSaveItem {
  pdfBase64: string;
  bildirgeRefNo: string;
  belgeTuru: string;
  belgeMahiyeti: string;
  hizmetDonem: string;
  fileCategory: "SGK_TAHAKKUK" | "HIZMET_LISTESI";
}

interface BulkSaveRequest {
  customerId: string;
  items: BulkSaveItem[];
}

interface BulkSaveResultItem {
  bildirgeRefNo: string;
  fileCategory: string;
  documentId?: string;
  success: boolean;
  skipped: boolean;
  error?: string;
}

// Tüm PDF'leri aynı anda paralel yükle
const UPLOAD_CONCURRENCY = 44;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — tek sefer
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // 2. Body parse
    const body: BulkSaveRequest = await req.json();
    const { customerId, items } = body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerId ve en az 1 item zorunludur" },
        { status: 400 }
      );
    }

    // 3. Customer — tek sefer
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true, unvan: true, vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // 4. Mevcut dosyaları toplu sorgula — duplicate check tek seferde
    const existingDocs = await prisma.documents.findMany({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory: { in: ["SGK_TAHAKKUK", "HIZMET_LISTESI"] },
      },
      select: { name: true, fileCategory: true, fileIndex: true },
    });

    // Mevcut dosya adları seti — hızlı lookup
    const existingFileMap = new Map<string, number>();
    for (const doc of existingDocs) {
      const key = `${doc.fileCategory}_${doc.name}`;
      const currentMax = existingFileMap.get(`${doc.fileCategory}_base_${doc.name.replace(/_\d+\.pdf$/, '.pdf').replace(/\.pdf$/, '')}`) ?? -1;
      const idx = doc.fileIndex ?? 0;
      const baseKey = `${doc.fileCategory}_base_${doc.name.replace(/_\d+\.pdf$/, '').replace(/\.pdf$/, '')}`;
      existingFileMap.set(baseKey, Math.max(existingFileMap.get(baseKey) ?? -1, idx));
    }

    // 5. Tüm PDF'leri aynı anda paralel işle
    const results: BulkSaveResultItem[] = [];

    {
      const allResults = await Promise.allSettled(
        items.map(async (item): Promise<BulkSaveResultItem> => {
          try {
            const { pdfBase64, bildirgeRefNo, belgeTuru, belgeMahiyeti, hizmetDonem, fileCategory } = item;

            if (!pdfBase64 || !bildirgeRefNo || !belgeTuru || !hizmetDonem || !fileCategory) {
              return { bildirgeRefNo, fileCategory, success: false, skipped: false, error: "Eksik alanlar" };
            }

            if (fileCategory !== "SGK_TAHAKKUK" && fileCategory !== "HIZMET_LISTESI") {
              return { bildirgeRefNo, fileCategory, success: false, skipped: false, error: "Geçersiz fileCategory" };
            }

            // Dönem parse
            const donemParts = hizmetDonem.split("/");
            if (donemParts.length !== 2) {
              return { bildirgeRefNo, fileCategory, success: false, skipped: false, error: "Geçersiz dönem formatı" };
            }
            const year = parseInt(donemParts[0], 10);
            const month = parseInt(donemParts[1], 10);
            if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
              return { bildirgeRefNo, fileCategory, success: false, skipped: false, error: "Geçersiz dönem değerleri" };
            }

            const monthPadded = String(month).padStart(2, "0");
            const baseFilename = `${customer.vknTckn}_${belgeTuru}_${year}-${monthPadded}_${fileCategory}`;

            // fileIndex hesapla — existing map'ten
            const baseKey = `${fileCategory}_base_${baseFilename}`;
            const currentMaxIndex = existingFileMap.get(baseKey) ?? -1;
            const fileIndex = currentMaxIndex + 1;
            // Map'i güncelle — aynı batch'teki sonraki item'lar doğru index alsın
            existingFileMap.set(baseKey, fileIndex);

            const filename = fileIndex === 0 ? `${baseFilename}.pdf` : `${baseFilename}_${fileIndex}.pdf`;

            // Base64 → Buffer
            const buffer = Buffer.from(pdfBase64, "base64");

            // Storage path ve upload
            const storagePath = generateStoragePath(user.tenantId, customerId, year, month, filename);

            // Retry ile upload — hızlı backoff
            let uploadSuccess = false;
            let lastError: Error | null = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                await adminUploadFile(storagePath, buffer, "application/pdf");
                uploadSuccess = true;
                break;
              } catch (err) {
                lastError = err as Error;
                if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
              }
            }

            if (!uploadSuccess) {
              return {
                bildirgeRefNo,
                fileCategory,
                success: false,
                skipped: false,
                error: `Upload başarısız: ${lastError?.message?.substring(0, 100)}`,
              };
            }

            // DB kayıt
            const categoryLabel = fileCategory === "SGK_TAHAKKUK" ? "SGK Tahakkuk" : "Hizmet Listesi";
            const originalName = `${categoryLabel} - ${belgeMahiyeti || belgeTuru} ${monthPadded}/${year}${fileIndex > 0 ? ` (${fileIndex + 1})` : ""}`;

            const doc = await prisma.documents.create({
              data: {
                name: filename,
                originalName,
                type: "pdf",
                mimeType: "application/pdf",
                size: buffer.length,
                path: storagePath,
                storage: "supabase",
                year,
                month,
                vknTckn: customer.vknTckn,
                beyannameTuru: belgeTuru,
                fileCategory,
                fileIndex,
                customerId,
                tenantId: user.tenantId,
              },
            });

            return {
              bildirgeRefNo,
              fileCategory,
              documentId: doc.id,
              success: true,
              skipped: false,
            };
          } catch (err) {
            return {
              bildirgeRefNo: item.bildirgeRefNo,
              fileCategory: item.fileCategory,
              success: false,
              skipped: false,
              error: (err as Error).message?.substring(0, 200),
            };
          }
        })
      );

      for (const result of allResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            bildirgeRefNo: "unknown",
            fileCategory: "unknown",
            success: false,
            skipped: false,
            error: result.reason?.message || "Bilinmeyen hata",
          });
        }
      }
    }

    const saved = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success && !r.skipped).length;
    console.log(`[SGK-BULK-SAVE] ${saved} kaydedildi, ${failed} başarısız (toplam ${items.length})`);

    return NextResponse.json({ results, saved, failed, total: items.length });
  } catch (error) {
    console.error("[SGK-BULK-SAVE] Hata:", error);
    return NextResponse.json(
      { error: "Toplu kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
