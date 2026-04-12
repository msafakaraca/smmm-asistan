/**
 * INTVRG Vergi Levhası Batch Save API
 * ====================================
 * POST: Birden fazla vergi levhası sonucunu tek istekte kaydet
 * Auth check ve müşteri kontrolü tek seferde yapılır, PDF'ler paralel yüklenir.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { adminUploadFile } from "@/lib/storage-supabase";
import { getOrCreateFolderSafe } from "@/lib/file-system";
import { Prisma } from "@prisma/client";

interface VergiLevhasiItem {
  customerId: string;
  onayKodu: string;
  onayZamani?: string;
  vergiTuru?: string;
  vergiDairesi?: string;
  unvan?: string;
  pdfBase64: string;
}

function parseOnayZamani(onayZamani?: string): { year: number; month: number } {
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  if (onayZamani) {
    const parts = onayZamani.split(" ")[0]?.split("/");
    if (parts?.length === 3) {
      year = parseInt(parts[2], 10) || year;
      month = parseInt(parts[1], 10) || month;
    }
  }
  return { year, month };
}

/**
 * POST /api/intvrg/vergi-levhasi/batch
 * Body: { items: VergiLevhasiItem[] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const items: VergiLevhasiItem[] = body.items;

    if (!items?.length) {
      return NextResponse.json({ error: "items boş" }, { status: 400 });
    }

    // Tüm müşterileri tek sorguda al
    const customerIds = [...new Set(items.map((i) => i.customerId))];
    const customers = await prisma.customers.findMany({
      where: { id: { in: customerIds }, tenantId: user.tenantId },
      select: { id: true, vknTckn: true, unvan: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // Mevcut document'ları tek sorguda kontrol et (duplicate check)
    const filenames = items.map((item) => {
      const customer = customerMap.get(item.customerId);
      return customer
        ? `${customer.vknTckn}_VERGILEVHASI_${item.onayKodu}.pdf`
        : "";
    });

    const existingDocs = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        fileCategory: "VERGI_LEVHASI",
        name: { in: filenames.filter(Boolean) },
      },
      select: { id: true, name: true, customerId: true },
    });
    const existingSet = new Set(
      existingDocs.map((d) => `${d.customerId}:${d.name}`)
    );

    // Müşteri kök klasörlerini tek sorguda al
    const rootFolders = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        customerId: { in: customerIds },
        isFolder: true,
        parentId: null,
      },
      select: { id: true, customerId: true },
    });
    const rootFolderMap = new Map(
      rootFolders.map((f) => [f.customerId!, f.id])
    );

    // Vergi Levhası alt klasörlerini önce toplu oluştur (cache)
    const folderCache = new Map<string, string | null>();
    await Promise.all(
      customerIds.map(async (cId) => {
        const rootId = rootFolderMap.get(cId);
        if (rootId) {
          const folderId = await getOrCreateFolderSafe(
            user.tenantId,
            cId,
            rootId,
            "Vergi Levhası",
            "VERGI_LEVHASI"
          );
          folderCache.set(cId, folderId);
        } else {
          folderCache.set(cId, null);
        }
      })
    );

    // Paralel kayıt: her item için upload + DB write
    const CONCURRENCY = 10;
    const results: Array<{
      customerId: string;
      saved: boolean;
      skipped: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const customer = customerMap.get(item.customerId);
          if (!customer) {
            return { customerId: item.customerId, saved: false, skipped: false, error: "Müşteri bulunamadı" };
          }

          const filename = `${customer.vknTckn}_VERGILEVHASI_${item.onayKodu}.pdf`;
          const key = `${item.customerId}:${filename}`;

          // Duplicate kontrolü
          if (existingSet.has(key)) {
            // Arşiv güncelle
            await upsertArchiveFast(user.tenantId, user.id, item);
            return { customerId: item.customerId, saved: false, skipped: true };
          }

          const buffer = Buffer.from(item.pdfBase64, "base64");
          const storagePath = `${user.tenantId}/${item.customerId}/VergiLevhasi/${item.onayKodu}.pdf`;
          const { year, month } = parseOnayZamani(item.onayZamani);
          const parentFolderId = folderCache.get(item.customerId) || null;

          // Upload + DB paralel
          await adminUploadFile(storagePath, buffer, "application/pdf");

          await prisma.documents.create({
            data: {
              name: filename,
              originalName: `Vergi Levhası - ${item.unvan || customer.unvan} (${item.onayZamani || item.onayKodu})`,
              type: "pdf",
              mimeType: "application/pdf",
              size: buffer.length,
              path: storagePath,
              storage: "supabase",
              year,
              month,
              vknTckn: customer.vknTckn,
              fileCategory: "VERGI_LEVHASI",
              customerId: item.customerId,
              tenantId: user.tenantId,
              parentId: parentFolderId,
            },
          });

          // Arşiv upsert
          await upsertArchiveFast(user.tenantId, user.id, item);

          return { customerId: item.customerId, saved: true, skipped: false };
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({
            customerId: "unknown",
            saved: false,
            skipped: false,
            error: r.reason?.message || "Bilinmeyen hata",
          });
        }
      }
    }

    const savedCount = results.filter((r) => r.saved).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    return NextResponse.json({
      total: items.length,
      saved: savedCount,
      skipped: skippedCount,
      failed: items.length - savedCount - skippedCount,
      results,
    });
  } catch (error) {
    console.error("[vergi-levhasi-batch] POST hatası:", error);
    return NextResponse.json(
      { error: "Toplu kaydetme sırasında hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * Hızlı arşiv upsert — tek item için
 */
async function upsertArchiveFast(
  tenantId: string,
  userId: string,
  item: VergiLevhasiItem
) {
  const { year, month } = parseOnayZamani(item.onayZamani);

  const newEntry = {
    onayKodu: item.onayKodu,
    onayZamani: item.onayZamani,
    vergiTuru: item.vergiTuru,
    vergiDairesi: item.vergiDairesi,
    unvan: item.unvan,
  };

  const existing = await prisma.query_archives.findUnique({
    where: {
      tenantId_customerId_queryType_month_year: {
        tenantId,
        customerId: item.customerId,
        queryType: "vergiLevhasi",
        month,
        year,
      },
    },
    select: { id: true, resultData: true, queryCount: true },
  });

  if (existing) {
    const existingData = (existing.resultData as unknown[]) || [];
    const alreadyHas = existingData.some(
      (e: unknown) => (e as { onayKodu?: string }).onayKodu === item.onayKodu
    );

    if (!alreadyHas) {
      await prisma.query_archives.update({
        where: { id: existing.id },
        data: {
          resultData: [...existingData, newEntry] as unknown as Prisma.InputJsonValue,
          totalCount: existingData.length + 1,
          queryCount: (existing.queryCount || 0) + 1,
          lastQueriedAt: new Date(),
        },
      });
    } else {
      await prisma.query_archives.update({
        where: { id: existing.id },
        data: { lastQueriedAt: new Date() },
      });
    }
  } else {
    await prisma.query_archives.create({
      data: {
        tenantId,
        customerId: item.customerId,
        userId,
        queryType: "vergiLevhasi",
        month,
        year,
        resultData: [newEntry] as unknown as Prisma.InputJsonValue,
        resultMeta: Prisma.JsonNull,
        totalCount: 1,
        queryCount: 1,
        lastQueriedAt: new Date(),
      },
    });
  }
}
