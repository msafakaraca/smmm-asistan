/**
 * KDV9015 Kontrol Clear API (KDV Tevkifat)
 *
 * DELETE: Belirli donem icin tum KDV9015 kontrol verilerini sil
 *
 * Query params:
 * - year: Yil
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

    // Bu tenant'a ait donem verilerini sil
    const result = await prisma.kdv9015_kontrol.deleteMany({
      where: {
        tenantId: user.tenantId,
        year,
        month,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} KDV Tevkifat kontrol kaydi silindi`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("[KDV9015-CLEAR] Error:", error);
    return NextResponse.json(
      { error: "Veriler temizlenirken hata olustu" },
      { status: 500 }
    );
  }
}
