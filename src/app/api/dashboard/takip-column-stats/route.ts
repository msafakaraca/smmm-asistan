import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { extractCellData } from "@/lib/takip-utils";
import type { TakipColumnStats, TakipColumnStat } from "@/types/dashboard";

/**
 * GET /api/dashboard/takip-column-stats
 * Takip çizelgesi kolon bazlı istatistiklerini döner
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

    // Aktif boolean kolonlar + dönem satırları paralel çek
    const [kolonlar, satirlar] = await Promise.all([
      prisma.takip_kolonlar.findMany({
        where: { tenantId, aktif: true, tip: "boolean", sistem: false },
        select: { kod: true, baslik: true },
        orderBy: { siraNo: "asc" },
      }),
      prisma.takip_satirlar.findMany({
        where: { tenantId, year, month },
        select: { degerler: true },
      }),
    ]);

    const total = satirlar.length;

    // Her kolon için istatistik hesapla
    const columns: TakipColumnStat[] = kolonlar.map((kolon) => {
      let trueCount = 0;
      let falseCount = 0;
      let pending = 0;

      for (const satir of satirlar) {
        const degerler = satir.degerler as Record<string, unknown> | null;
        if (!degerler) {
          pending++;
          continue;
        }

        const cellData = extractCellData(degerler[kolon.kod]);
        if (cellData.value === true) {
          trueCount++;
        } else if (cellData.value === false) {
          falseCount++;
        } else {
          pending++;
        }
      }

      const handled = trueCount + falseCount;
      const rate = total > 0 ? Math.round((handled / total) * 100) : 0;

      return {
        kod: kolon.kod,
        baslik: kolon.baslik,
        total,
        handled,
        pending,
        trueCount,
        falseCount,
        rate,
      };
    });

    const result: TakipColumnStats = {
      columns,
      period: { year, month },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Takip Column Stats API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
