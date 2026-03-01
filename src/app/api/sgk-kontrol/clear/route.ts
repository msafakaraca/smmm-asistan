/**
 * SGK Kontrol Clear API
 *
 * DELETE: Belirli dönemdeki tüm SGK kontrol verilerini sil
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "0");
    const month = parseInt(searchParams.get("month") || "0");

    if (!year || !month) {
      return NextResponse.json(
        { error: "year ve month parametreleri gerekli" },
        { status: 400 }
      );
    }

    // Bu döneme ait tüm SGK kontrol kayıtlarını sil
    const deleted = await prisma.sgk_kontrol.deleteMany({
      where: {
        tenantId,
        year,
        month,
      },
    });

    console.log(
      `[SGK-CLEAR] ${deleted.count} kayıt silindi (${year}/${month})`
    );

    return NextResponse.json({
      success: true,
      message: `${deleted.count} kayıt temizlendi`,
      deleted: deleted.count,
    });
  } catch (error) {
    console.error("[SGK-CLEAR] Error:", error);
    return NextResponse.json(
      { error: "Veriler temizlenirken hata oluştu" },
      { status: 500 }
    );
  }
}
