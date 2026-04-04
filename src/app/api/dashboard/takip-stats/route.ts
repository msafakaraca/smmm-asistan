import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/server-cache";
import type { TakipStats, TakipCompletedItem } from "@/types/dashboard";

/**
 * GET /api/dashboard/takip-stats
 * Takip çizelgesi özet istatistiklerini döner
 *
 * İş Kuralı: İptal (false) = "Yapılmayacak", Bekliyor (null) = "Gerçek eksik"
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    let defaultMonth = currentMonth - 1;
    let defaultYear = currentYear;
    if (defaultMonth === 0) {
      defaultMonth = 12;
      defaultYear = currentYear - 1;
    }

    const year = parseInt(searchParams.get("year") || String(defaultYear));
    const month = parseInt(searchParams.get("month") || String(defaultMonth));
    const tenantId = user.tenantId;

    // Server-side cache kontrolu
    const cacheKey = `${tenantId}:takip-stats:${year}:${month}`;
    const cached = serverCache.get<TakipStats>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Dönem bazlı takip satırlarını çek (isim dahil)
    const satirlar = await prisma.takip_satirlar.findMany({
      where: { tenantId, year, month },
      select: { id: true, isim: true, degerler: true },
    });

    // SONDUR değerini kontrol et: completed (true), cancelled (false), pending (null)
    let completed = 0;
    let cancelled = 0;
    const handledItems: Array<{
      id: string;
      isim: string;
      completedAt?: string;
      completedBy?: string;
      isCancelled: boolean;
    }> = [];

    for (const satir of satirlar) {
      const degerler = satir.degerler as Record<string, unknown> | null;
      if (!degerler || !("SONDUR" in degerler)) continue;

      const sondur = degerler["SONDUR"];
      let sondurValue: boolean | null = null;
      let modifiedAt: string | undefined;
      let modifiedByName: string | undefined;

      // Eski format: boolean
      if (typeof sondur === "boolean") {
        sondurValue = sondur;
      }
      // Yeni format: { value: boolean, modifiedAt, modifiedByName, ... }
      else if (typeof sondur === "object" && sondur !== null && "value" in (sondur as Record<string, unknown>)) {
        const sondurObj = sondur as Record<string, unknown>;
        sondurValue = sondurObj.value as boolean | null;
        modifiedAt = sondurObj.modifiedAt as string | undefined;
        modifiedByName = sondurObj.modifiedByName as string | undefined;
      }

      if (sondurValue === true) {
        completed++;
        handledItems.push({
          id: satir.id,
          isim: satir.isim || "İsimsiz",
          completedAt: modifiedAt,
          completedBy: modifiedByName,
          isCancelled: false,
        });
      } else if (sondurValue === false) {
        cancelled++;
        handledItems.push({
          id: satir.id,
          isim: satir.isim || "İsimsiz",
          completedAt: modifiedAt,
          completedBy: modifiedByName,
          isCancelled: true,
        });
      }
    }

    // En son işlenenleri sırala (modifiedAt'a göre)
    const recentCompleted: TakipCompletedItem[] = handledItems
      .sort((a, b) => {
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      })
      .slice(0, 10);

    const total = satirlar.length;
    const handled = completed + cancelled;
    const pending = total - handled;
    const completionRate = total > 0 ? Math.round((handled / total) * 100) : 0;

    const stats: TakipStats = {
      total,
      completed,
      cancelled,
      handled,
      pending,
      completionRate,
      period: { year, month },
      recentCompleted,
    };

    serverCache.set(cacheKey, stats, 60_000); // 60 saniye TTL
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[Takip Stats API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
