import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/query-archives/customer-status
 * Her müşterinin belirli queryType için son sorgulama tarihini döner.
 *
 * Query params:
 * - queryType (zorunlu): "beyanname"|"tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"
 *
 * Response: { statuses: Record<string, string> } — customerId -> ISO date string
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

    const results = await prisma.query_archives.groupBy({
      by: ["customerId"],
      where: {
        tenantId: user.tenantId,
        queryType,
      },
      _max: {
        lastQueriedAt: true,
      },
    });

    const statuses: Record<string, string> = {};
    for (const r of results) {
      if (r._max.lastQueriedAt) {
        statuses[r.customerId] = r._max.lastQueriedAt.toISOString();
      }
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("customer-status API hatası:", error);
    return NextResponse.json(
      { error: "Sorgulama durumu alınamadı" },
      { status: 500 }
    );
  }
}
