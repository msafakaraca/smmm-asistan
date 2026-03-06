/**
 * SGK E-Bildirge Stream Save API Endpoint
 * =========================================
 * Electron Bot'tan gelen SGK PDF'lerini Supabase Storage'a kaydeder
 * ve documents tablosuna metadata ekler.
 *
 * POST /api/sgk/ebildirge-stream-save
 * Body: {
 *   customerId: string;
 *   pdfBase64: string;
 *   bildirgeRefNo: string;
 *   belgeTuru: string;         // "01", "02" vb.
 *   belgeMahiyeti: string;     // "Aylık Prim ve Hizmet Belgesi" vb.
 *   hizmetDonem: string;       // "2026/01" formatında
 *   fileCategory: "SGK_TAHAKKUK" | "HIZMET_LISTESI";
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile, generateStoragePath } from "@/lib/storage-supabase";

interface EbildirgeStreamSaveRequest {
  customerId: string;
  pdfBase64: string;
  bildirgeRefNo: string;
  belgeTuru: string;
  belgeMahiyeti: string;
  hizmetDonem: string;
  fileCategory: "SGK_TAHAKKUK" | "HIZMET_LISTESI";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // 2. Request body parse
    const body: EbildirgeStreamSaveRequest = await req.json();
    const {
      customerId,
      pdfBase64,
      bildirgeRefNo,
      belgeTuru,
      belgeMahiyeti,
      hizmetDonem,
      fileCategory,
    } = body;

    if (!customerId || !pdfBase64 || !bildirgeRefNo || !belgeTuru || !hizmetDonem || !fileCategory) {
      return NextResponse.json(
        { error: "customerId, pdfBase64, bildirgeRefNo, belgeTuru, hizmetDonem ve fileCategory zorunludur" },
        { status: 400 }
      );
    }

    // fileCategory doğrulama
    if (fileCategory !== "SGK_TAHAKKUK" && fileCategory !== "HIZMET_LISTESI") {
      return NextResponse.json(
        { error: "fileCategory 'SGK_TAHAKKUK' veya 'HIZMET_LISTESI' olmalıdır" },
        { status: 400 }
      );
    }

    // 3. Müşteri bilgilerini al — tenantId filtresi zorunlu
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true, unvan: true, vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // 4. Dönem parse — hizmetDonem: "2026/01" formatı
    const donemParts = hizmetDonem.split("/");
    if (donemParts.length !== 2) {
      return NextResponse.json({ error: "Geçersiz dönem formatı. Beklenen: YYYY/MM" }, { status: 400 });
    }

    const year = parseInt(donemParts[0], 10);
    const month = parseInt(donemParts[1], 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Geçersiz dönem değerleri" }, { status: 400 });
    }

    const monthPadded = String(month).padStart(2, "0");

    // 5. Dosya adı oluştur — {VKN}_{BelgeTuru}_{Year}-{Month}_{FileCategory}.pdf
    const baseFilename = `${customer.vknTckn}_${belgeTuru}_${year}-${monthPadded}_${fileCategory}`;

    // 6. Duplicate check — aynı dosya adı + customerId + tenantId + fileCategory
    const existingDocs = await prisma.documents.findMany({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory,
        name: { startsWith: baseFilename },
      },
      select: { id: true, name: true, fileIndex: true },
      orderBy: { fileIndex: "desc" },
    });

    // İlk dosya için index yok, sonrakiler için _1, _2, ...
    let filename: string;
    let fileIndex: number | null = null;

    if (existingDocs.length === 0) {
      // İlk dosya
      filename = `${baseFilename}.pdf`;
      fileIndex = 0;
    } else {
      // Aynı bildirgeRefNo ile kaydedilmiş mi kontrol et (tam eşleşme)
      const exactMatch = existingDocs.find((doc) => {
        // Dosya adından refNo çıkartılamaz, bildirgeRefNo bazlı duplicate'ı
        // ayrı bir check ile yapıyoruz
        return false; // Sadece dosya adı bazlı duplicate kontrolü
      });

      // Bir sonraki index'i hesapla
      const maxIndex = existingDocs.reduce((max, doc) => {
        const idx = doc.fileIndex ?? 0;
        return idx > max ? idx : max;
      }, 0);
      fileIndex = maxIndex + 1;
      filename = `${baseFilename}_${fileIndex}.pdf`;
    }

    // 7. Base64 -> Buffer
    const buffer = Buffer.from(pdfBase64, "base64");

    // 8. Supabase Storage path oluştur ve yükle
    const storagePath = generateStoragePath(user.tenantId, customerId, year, month, filename);

    // 9. Paralel: Storage upload + Document metadata kaydet
    const categoryLabel = fileCategory === "SGK_TAHAKKUK" ? "SGK Tahakkuk" : "Hizmet Listesi";
    const originalName = `${categoryLabel} - ${belgeMahiyeti || belgeTuru} ${monthPadded}/${year}${fileIndex && fileIndex > 0 ? ` (${fileIndex + 1})` : ""}`;

    const [, docResult] = await Promise.all([
      // A) Supabase Storage'a yükle
      adminUploadFile(storagePath, buffer, "application/pdf"),

      // B) Document metadata kaydet
      prisma.documents.create({
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
      }),
    ]);

    return NextResponse.json({
      success: true,
      bildirgeRefNo,
      documentId: docResult.id,
      skipped: false,
    });
  } catch (error) {
    console.error("[SGK-STREAM-SAVE] Hata:", error);
    return NextResponse.json(
      { error: "SGK PDF kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
