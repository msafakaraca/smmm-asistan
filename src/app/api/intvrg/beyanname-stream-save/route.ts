import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile, generateStoragePath } from "@/lib/storage-supabase";
import { ensureBeyannameFolderChainLocked } from "@/lib/file-system";
import { Prisma } from "@prisma/client";

/**
 * POST /api/intvrg/beyanname-stream-save
 * Tek bir PDF için unified streaming save:
 * 1. Supabase Storage'a upload
 * 2. documents tablosuna kayıt
 * 3. query_archives tablosuna incremental merge
 *
 * Body: {
 *   customerId: string;
 *   pdfBase64: string;
 *   beyoid: string;
 *   turKodu: string;
 *   turAdi: string;
 *   donem: string;       // "202501202501" veya "202501"
 *   versiyon: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, pdfBase64, beyoid, turKodu, turAdi, donem, versiyon } = body;

    if (!customerId || !pdfBase64 || !beyoid || !turKodu || !donem) {
      return NextResponse.json(
        { error: "customerId, pdfBase64, beyoid, turKodu ve donem zorunludur" },
        { status: 400 }
      );
    }

    // Müşteri bilgilerini al
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true, unvan: true, vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // Dönem parse
    const year = parseInt(donem.substring(0, 4), 10);
    const month = parseInt(donem.substring(4, 6), 10);
    if (isNaN(year) || isNaN(month)) {
      return NextResponse.json({ error: "Geçersiz dönem formatı" }, { status: 400 });
    }

    const monthPadded = String(month).padStart(2, "0");
    const filename = `${customer.vknTckn}_${turKodu}_${year}-${monthPadded}_BEYANNAME.pdf`;

    // Duplicate check
    const existing = await prisma.documents.findFirst({
      where: {
        name: filename,
        customerId,
        tenantId: user.tenantId,
        fileCategory: "BEYANNAME",
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ success: true, beyoid, skipped: true });
    }

    // Base64 → Buffer
    const buffer = Buffer.from(pdfBase64, "base64");

    // Supabase Storage path
    const storagePath = generateStoragePath(user.tenantId, customerId, year, month, filename);

    // Klasör zinciri oluştur: Beyannameler → Yıl → TürKodu
    const targetFolderId = await ensureBeyannameFolderChainLocked(
      user.tenantId,
      customerId,
      "Beyannameler",
      "beyanname",
      year,
      turKodu
    );

    // Paralel: Storage upload + Document create + Archive merge
    const [, docResult] = await Promise.all([
      // A) Supabase'e yükle
      adminUploadFile(storagePath, buffer, "application/pdf"),

      // B) Document metadata kaydet
      prisma.documents.create({
        data: {
          name: filename,
          originalName: `${turAdi || turKodu} - ${monthPadded}/${year} (v${versiyon || "1"})`,
          type: "pdf",
          mimeType: "application/pdf",
          size: buffer.length,
          path: storagePath,
          storage: "supabase",
          year,
          month,
          vknTckn: customer.vknTckn,
          beyannameTuru: turKodu,
          fileCategory: "BEYANNAME",
          customerId,
          tenantId: user.tenantId,
          parentId: targetFolderId,
        },
      }),
    ]);

    // C) Archive incremental merge (arka planda, hata olursa yoksay)
    incrementalArchiveMerge(
      user.tenantId,
      user.id,
      customerId,
      { turKodu, turAdi, donem, beyoid, versiyon },
      month,
      year
    ).catch((err) => {
      console.error("[STREAM-SAVE] Arşiv merge hatası:", err);
    });

    return NextResponse.json({
      success: true,
      beyoid,
      documentId: docResult.id,
      skipped: false,
    });
  } catch (error) {
    console.error("[STREAM-SAVE] Hata:", error);
    return NextResponse.json(
      { error: "PDF kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * Tek bir beyanname item'ını query_archives tablosuna incremental merge et.
 * Mevcut kayıt varsa append + dedup, yoksa yeni oluştur.
 */
async function incrementalArchiveMerge(
  tenantId: string,
  userId: string,
  customerId: string,
  item: { turKodu: string; turAdi: string; donem: string; beyoid: string; versiyon: string },
  month: number,
  year: number
) {
  const existing = await prisma.query_archives.findUnique({
    where: {
      tenantId_customerId_queryType_month_year: {
        tenantId,
        customerId,
        queryType: "beyanname",
        month,
        year,
      },
    },
  });

  if (existing) {
    const results = (existing.resultData as Record<string, unknown>[]) || [];
    const alreadyExists = results.some(
      (r) => r.beyoid === item.beyoid
    );

    if (!alreadyExists) {
      results.push(item as unknown as Record<string, unknown>);
      await prisma.query_archives.update({
        where: { id: existing.id },
        data: {
          resultData: results as unknown as Prisma.InputJsonValue,
          totalCount: results.length,
          lastQueriedAt: new Date(),
          queryCount: existing.queryCount + 1,
        },
      });
    }
  } else {
    try {
      await prisma.query_archives.create({
        data: {
          tenantId,
          customerId,
          userId,
          queryType: "beyanname",
          month,
          year,
          resultData: [item] as unknown as Prisma.InputJsonValue,
          resultMeta: Prisma.JsonNull,
          queryHistory: [
            {
              date: new Date().toISOString(),
              addedCount: 1,
            },
          ] as unknown as Prisma.InputJsonValue,
          totalCount: 1,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const raceExisting = await prisma.query_archives.findUnique({
          where: {
            tenantId_customerId_queryType_month_year: {
              tenantId,
              customerId,
              queryType: "beyanname",
              month,
              year,
            },
          },
        });
        if (raceExisting) {
          const results =
            (raceExisting.resultData as Record<string, unknown>[]) || [];
          const alreadyExists = results.some((r) => r.beyoid === item.beyoid);
          if (!alreadyExists) {
            results.push(item as unknown as Record<string, unknown>);
            await prisma.query_archives.update({
              where: { id: raceExisting.id },
              data: {
                resultData: results as unknown as Prisma.InputJsonValue,
                totalCount: results.length,
                lastQueriedAt: new Date(),
                queryCount: raceExisting.queryCount + 1,
              },
            });
          }
        }
      } else {
        throw err;
      }
    }
  }
}
