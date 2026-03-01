import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/takip/reset
 * Belirli dönemdeki tum boolean degerleri null (bekliyor) yapar
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // Dönem parametreleri
    const body = await req.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: "Yıl ve ay parametreleri gerekli" },
        { status: 400 }
      );
    }

    // Boolean tip kolonlari bul
    const booleanKolonlar = await prisma.takip_kolonlar.findMany({
      where: {
        tenantId,
        tip: "boolean",
        aktif: true,
      },
    });

    const booleanKodlar = booleanKolonlar.map((k) => k.kod);

    // Dönem bazlı satirlari getir
    const satirlar = await prisma.takip_satirlar.findMany({
      where: {
        tenantId,
        year,
        month
      },
    });

    // Her satir icin boolean degerleri null yap
    let guncellenenSayisi = 0;

    for (const satir of satirlar) {
      const mevcutDegerler =
        typeof satir.degerler === "object" && satir.degerler !== null
          ? (satir.degerler as Record<string, unknown>)
          : {};

      const yeniDegerler: Record<string, unknown> = { ...mevcutDegerler };

      // Sadece boolean kolonlari sifirla
      for (const kod of booleanKodlar) {
        if (kod in yeniDegerler) {
          yeniDegerler[kod] = null;
        }
      }

      await prisma.takip_satirlar.update({
        where: { id: satir.id },
        data: { degerler: yeniDegerler as object },
      });

      guncellenenSayisi++;
    }

    // Audit log
    await auditLog.bulk(
      { id: user.id, email: user.email || "", tenantId },
      "takip_satirlar",
      "BULK_UPDATE",
      guncellenenSayisi,
      { action: "reset", year, month }
    );

    return NextResponse.json({
      success: true,
      message: `${guncellenenSayisi} satır sıfırlandı`,
      updatedCount: guncellenenSayisi,
    });
  } catch (error) {
    console.error("[TakipReset] POST Error:", error);
    return NextResponse.json(
      { error: "Sıfırlama işlemi başarısız oldu" },
      { status: 500 }
    );
  }
}
