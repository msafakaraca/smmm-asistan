import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/query-archives/customer-bulk
 * Tek bir müşterinin tüm arşiv verilerini tek raw SQL sorgusu ile döner.
 * PostgreSQL tarafında JSON birleştirme yapılır — sıfır N+1, minimal overhead.
 *
 * Query params:
 * - customerId (zorunlu)
 * - queryType (zorunlu)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const queryType = searchParams.get("queryType");

    if (!customerId || !queryType) {
      return NextResponse.json(
        { error: "customerId ve queryType parametreleri zorunludur" },
        { status: 400 }
      );
    }

    // Raw SQL: PostgreSQL tarafında tüm resultData dizilerini birleştirir
    // jsonb_array_elements ile flatten → jsonb_agg ile tek dizi
    const result = await prisma.$queryRaw<Array<{ items: unknown[] | null }>>(
      Prisma.sql`
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) as items
        FROM query_archives qa,
             jsonb_array_elements(qa."resultData") as elem
        WHERE qa."tenantId" = ${user.tenantId}::uuid
          AND qa."customerId" = ${customerId}::uuid
          AND qa."queryType" = ${queryType}
      `
    );

    const items = result[0]?.items || [];

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[QUERY-ARCHIVES] customer-bulk GET hatası:", error);
    return NextResponse.json(
      { error: "Arşiv verileri yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}
