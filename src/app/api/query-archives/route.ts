import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/query-archives
 * Arşiv kayıtlarını listele/filtrele
 *
 * Query params:
 * - queryType (zorunlu): "beyanname"|"tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"
 * - customerIds (opsiyonel): UUID'ler virgülle ayrılmış
 * - startMonth, startYear, endMonth, endYear (opsiyonel): Dönem aralığı
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get("queryType");

    if (!queryType) {
      return NextResponse.json(
        { error: "queryType parametresi zorunludur" },
        { status: 400 }
      );
    }

    const customerIdsParam = searchParams.get("customerIds");
    const customerIds = customerIdsParam
      ? customerIdsParam.split(",").filter(Boolean)
      : undefined;

    const startMonth = searchParams.get("startMonth")
      ? parseInt(searchParams.get("startMonth")!, 10)
      : undefined;
    const startYear = searchParams.get("startYear")
      ? parseInt(searchParams.get("startYear")!, 10)
      : undefined;
    const endMonth = searchParams.get("endMonth")
      ? parseInt(searchParams.get("endMonth")!, 10)
      : undefined;
    const endYear = searchParams.get("endYear")
      ? parseInt(searchParams.get("endYear")!, 10)
      : undefined;

    // Dönem filtresi: yıl*100+ay değeri ile karşılaştırma
    const startVal =
      startYear && startMonth ? startYear * 100 + startMonth : undefined;
    const endVal = endYear && endMonth ? endYear * 100 + endMonth : undefined;

    const archives = await prisma.query_archives.findMany({
      where: {
        tenantId: user.tenantId,
        queryType,
        ...(customerIds && { customerId: { in: customerIds } }),
        ...(startVal && {
          OR: [
            { year: { gt: startYear! } },
            {
              year: startYear!,
              month: { gte: startMonth! },
            },
          ],
        }),
        ...(endVal && {
          AND: [
            ...(startVal
              ? [
                  {
                    OR: [
                      { year: { gt: startYear! } },
                      { year: startYear!, month: { gte: startMonth! } },
                    ],
                  },
                ]
              : []),
            {
              OR: [
                { year: { lt: endYear! } },
                { year: endYear!, month: { lte: endMonth! } },
              ],
            },
          ],
        }),
      },
      select: {
        id: true,
        customerId: true,
        month: true,
        year: true,
        queryType: true,
        totalCount: true,
        totalAmount: true,
        lastQueriedAt: true,
        queryCount: true,
        createdAt: true,
        customers: {
          select: { unvan: true, kisaltma: true, vknTckn: true },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    // Dönem filtre düzeltme: başlangıç ve bitiş birlikte verildiğinde AND koşulu karmaşık olabiliyor
    // Basit yaklaşım: sonuçları client-side filtrele
    let filteredArchives = archives;
    if (startVal || endVal) {
      filteredArchives = archives.filter((a) => {
        const val = a.year * 100 + a.month;
        if (startVal && val < startVal) return false;
        if (endVal && val > endVal) return false;
        return true;
      });
    }

    const summary = {
      totalArchives: filteredArchives.length,
      grandTotalCount: filteredArchives.reduce(
        (sum, a) => sum + a.totalCount,
        0
      ),
      grandTotalAmount: filteredArchives.reduce(
        (sum, a) => sum + (a.totalAmount ? Number(a.totalAmount) : 0),
        0
      ),
    };

    return NextResponse.json({ archives: filteredArchives, summary });
  } catch (error) {
    console.error("[QUERY-ARCHIVES] GET hatası:", error);
    return NextResponse.json(
      { error: "Arşiv kayıtları yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/query-archives
 * Toplu arşiv silme (test amaçlı)
 *
 * Query params:
 * - queryType (zorunlu): "beyanname"|"tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"
 * - customerId (opsiyonel): Belirli müşterinin arşivlerini sil
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get("queryType");

    if (!queryType) {
      return NextResponse.json(
        { error: "queryType parametresi zorunludur" },
        { status: 400 }
      );
    }

    const customerId = searchParams.get("customerId");

    const result = await prisma.query_archives.deleteMany({
      where: {
        tenantId: user.tenantId,
        queryType,
        ...(customerId && { customerId }),
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("[QUERY-ARCHIVES] DELETE hatası:", error);
    return NextResponse.json(
      { error: "Arşiv kayıtları silinirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/query-archives
 * Arşiv kaydı oluştur veya merge et
 *
 * Body: {
 *   customerId, queryType, month, year,
 *   newResults: unknown[],
 *   queryParams: Record<string, unknown>,
 *   dedupKey?: string[],
 *   meta?: Record<string, unknown>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, queryType, month, year, newResults, queryParams, dedupKey, meta } = body;

    if (!customerId || !queryType || !month || !year || !newResults) {
      return NextResponse.json(
        { error: "customerId, queryType, month, year ve newResults zorunludur" },
        { status: 400 }
      );
    }

    // Mevcut kayıt var mı?
    const existing = await prisma.query_archives.findUnique({
      where: {
        tenantId_customerId_queryType_month_year: {
          tenantId: user.tenantId,
          customerId,
          queryType,
          month,
          year,
        },
      },
    });

    // mergeAndReturn: mevcut kayıtla birleştir
    const mergeAndReturn = async (record: NonNullable<typeof existing>) => {
      const existingData = (record.resultData as unknown[]) || [];
      let uniqueNewResults = newResults as unknown[];
      let addedCount = newResults.length;

      if (dedupKey && dedupKey.length > 0) {
        const existingKeys = new Set(
          existingData.map((item: unknown) => {
            const rec = item as Record<string, unknown>;
            return dedupKey.map((k: string) => String(rec[k] ?? "")).join("|");
          })
        );

        uniqueNewResults = (newResults as unknown[]).filter((item: unknown) => {
          const rec = item as Record<string, unknown>;
          const key = dedupKey
            .map((k: string) => String(rec[k] ?? ""))
            .join("|");
          return !existingKeys.has(key);
        });
        addedCount = uniqueNewResults.length;
      }

      const mergedData = [...existingData, ...uniqueNewResults];
      const existingHistory = (record.queryHistory as Array<Record<string, unknown>>) || [];

      const archive = await prisma.query_archives.update({
        where: { id: record.id },
        data: {
          resultData: mergedData as unknown as Prisma.InputJsonValue,
          resultMeta: meta
            ? (meta as Prisma.InputJsonValue)
            : record.resultMeta
              ? (record.resultMeta as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          queryHistory: [
            ...existingHistory,
            {
              date: new Date().toISOString(),
              params: queryParams || {},
              addedCount,
            },
          ] as unknown as Prisma.InputJsonValue,
          totalCount: mergedData.length,
          queryCount: record.queryCount + 1,
          lastQueriedAt: new Date(),
        },
      });

      return NextResponse.json({
        action: "merged" as const,
        id: archive.id,
        totalCount: archive.totalCount,
        addedCount,
      });
    };

    if (existing) {
      return mergeAndReturn(existing);
    }

    // Yeni kayıt oluştur — race condition'a karşı try-catch
    try {
      const archive = await prisma.query_archives.create({
        data: {
          customerId,
          tenantId: user.tenantId,
          userId: user.id,
          queryType,
          month,
          year,
          resultData: newResults as Prisma.InputJsonValue,
          resultMeta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
          queryHistory: [
            {
              date: new Date().toISOString(),
              params: queryParams || {},
              addedCount: newResults.length,
            },
          ] as unknown as Prisma.InputJsonValue,
          totalCount: newResults.length,
        },
      });

      return NextResponse.json({
        action: "created" as const,
        id: archive.id,
        totalCount: archive.totalCount,
        addedCount: newResults.length,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Race condition: başka istek aynı anda create etti → merge yap
        const raceExisting = await prisma.query_archives.findUnique({
          where: {
            tenantId_customerId_queryType_month_year: {
              tenantId: user.tenantId,
              customerId,
              queryType,
              month,
              year,
            },
          },
        });
        if (raceExisting) {
          return mergeAndReturn(raceExisting);
        }
      }
      throw err;
    }
  } catch (error) {
    console.error("[QUERY-ARCHIVES] POST hatası:", error);
    return NextResponse.json(
      { error: "Arşiv kaydı oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
