import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/intvrg/beyanname-saved-beyoids?customerId=XXX
 * Daha önce kaydedilmiş beyanname PDF'lerinin beyoid'lerini döner.
 * Pipeline'da skip mekanizması için kullanılır.
 *
 * Kaynak: query_archives tablosundaki resultData JSON array'inden beyoid çıkarımı
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId parametresi zorunludur" },
        { status: 400 }
      );
    }

    // query_archives'den beyanname kayıtlarını al (sadece resultData)
    const archives = await prisma.query_archives.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        queryType: "beyanname",
      },
      select: {
        resultData: true,
      },
    });

    // resultData JSON array'den beyoid'leri çıkar
    const beyoidSet = new Set<string>();
    for (const archive of archives) {
      const data = archive.resultData;
      if (Array.isArray(data)) {
        for (const item of data) {
          const record = item as Record<string, unknown>;
          if (record.beyoid && typeof record.beyoid === "string") {
            beyoidSet.add(record.beyoid);
          }
        }
      }
    }

    return NextResponse.json({ beyoids: Array.from(beyoidSet) });
  } catch (error) {
    console.error("[BEYANNAME-SAVED-BEYOIDS] Hata:", error);
    return NextResponse.json(
      { error: "Beyoid listesi yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}
