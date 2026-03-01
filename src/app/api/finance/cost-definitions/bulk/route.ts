import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Toplu maliyet tanımı oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { customerIds, categoryId, amount, currency, frequency, chargeStrategy, hasSMM, kdvRate, stopajRate, startDate, endDate, description } = body;

    if (!customerIds?.length || !categoryId || !amount || !frequency || !startDate) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik" },
        { status: 400 }
      );
    }

    const results: { customerId: string; success: boolean; error?: string }[] = [];

    for (const customerId of customerIds) {
      try {
        await prisma.cost_definitions.create({
          data: {
            customerId,
            categoryId,
            description: description || null,
            amount,
            currency: currency || "TRY",
            frequency,
            chargeStrategy: chargeStrategy || "FULL",
            hasSMM: hasSMM ?? true,
            kdvRate: kdvRate ?? null,
            stopajRate: stopajRate ?? null,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            tenantId: user.tenantId,
          },
        });
        results.push({ customerId, success: true });
      } catch (err) {
        results.push({
          customerId,
          success: false,
          error: err instanceof Error ? err.message : "Bilinmeyen hata",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `${successCount} başarılı, ${failCount} başarısız`,
      results,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error("Toplu maliyet tanımı hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
