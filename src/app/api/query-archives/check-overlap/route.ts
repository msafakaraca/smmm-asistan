import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/query-archives/check-overlap
 * Aynı müşteri + queryType + ay + yıl için mevcut arşiv kaydı var mı kontrol eder
 *
 * Body: { customerId, queryType, month, year }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId, queryType, month, year } = await req.json();

    if (!customerId || !queryType || !month || !year) {
      return NextResponse.json(
        { error: "customerId, queryType, month ve year zorunludur" },
        { status: 400 }
      );
    }

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
      select: {
        id: true,
        month: true,
        year: true,
        totalCount: true,
        totalAmount: true,
        lastQueriedAt: true,
        customers: {
          select: { unvan: true, kisaltma: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ hasOverlap: false });
    }

    return NextResponse.json({
      hasOverlap: true,
      archiveId: existing.id,
      month: existing.month,
      year: existing.year,
      totalCount: existing.totalCount,
      totalAmount: existing.totalAmount ? Number(existing.totalAmount) : null,
      lastQueriedAt: existing.lastQueriedAt.toISOString(),
      customerName: existing.customers.kisaltma || existing.customers.unvan,
    });
  } catch (error) {
    console.error("[QUERY-ARCHIVES] check-overlap hatası:", error);
    return NextResponse.json(
      { error: "Çakışma kontrolü sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
