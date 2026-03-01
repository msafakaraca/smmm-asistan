/**
 * KDV2 Kontrol Clear API
 *
 * DELETE: Belirli dönem için tüm KDV2 kontrol verilerini sil
 *
 * Query params:
 * - year: Yıl
 * - month: Ay
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserWithProfile } from "@/lib/supabase/auth";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "0");
    const month = parseInt(searchParams.get("month") || "0");

    if (!year || !month) {
      return NextResponse.json(
        { error: "year ve month parametreleri gerekli" },
        { status: 400 }
      );
    }

    // Bu tenant'a ait dönem verilerini sil
    const result = await prisma.kdv2_kontrol.deleteMany({
      where: {
        tenantId: user.tenantId,
        year,
        month,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} KDV-2 kontrol kaydı silindi`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("[KDV2-CLEAR] Error:", error);
    return NextResponse.json(
      { error: "Veriler temizlenirken hata oluştu" },
      { status: 500 }
    );
  }
}
