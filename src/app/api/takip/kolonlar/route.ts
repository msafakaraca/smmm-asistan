import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";

// Varsayilan kolonlar - ilk yuklenmede olusturulur
const VARSAYILAN_KOLONLAR = [
  { kod: "NO", baslik: "No", tip: "text", siraNo: 0, sistem: true },
  { kod: "ISIM", baslik: "İsim/Ünvan", tip: "text", siraNo: 1, sistem: true },
  { kod: "ALIS", baslik: "Alış", tip: "boolean", siraNo: 2, sistem: false },
  { kod: "SATIS", baslik: "Satış", tip: "boolean", siraNo: 3, sistem: false },
  { kod: "FIS", baslik: "Fiş", tip: "boolean", siraNo: 4, sistem: false },
  { kod: "ZRAPORU", baslik: "Z Raporu", tip: "boolean", siraNo: 5, sistem: false },
];

/**
 * GET /api/takip/kolonlar
 * Tenant'a ait tum kolonlari getirir
 * Eger kolon yoksa varsayilan kolonlari olusturur
 */
export async function GET() {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // Mevcut kolonlari getir
    let kolonlar = await prisma.takip_kolonlar.findMany({
      where: { tenantId },
      orderBy: { siraNo: "asc" },
    });

    // Eger kolon yoksa varsayilanlari olustur
    if (kolonlar.length === 0) {
      const { randomUUID } = await import("crypto");
      const now = new Date();
      await prisma.takip_kolonlar.createMany({
        data: VARSAYILAN_KOLONLAR.map((k) => ({
          id: randomUUID(),
          ...k,
          tenantId,
          updatedAt: now,
        })),
      });

      kolonlar = await prisma.takip_kolonlar.findMany({
        where: { tenantId },
        orderBy: { siraNo: "asc" },
      });
    }

    return NextResponse.json(kolonlar);
  } catch (error) {
    console.error("[TakipKolon] GET Error:", error);
    return NextResponse.json(
      { error: "Kolonlar yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/takip/kolonlar
 * Yeni kolon ekler
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const body = await req.json();
    const { kod, baslik, tip = "boolean" } = body;

    if (!kod || !baslik) {
      return NextResponse.json(
        { error: "Kod ve başlık gerekli" },
        { status: 400 }
      );
    }

    // Kod kontrolu (unique)
    const mevcutKolon = await prisma.takip_kolonlar.findUnique({
      where: {
        tenantId_kod: { tenantId, kod },
      },
    });

    if (mevcutKolon) {
      return NextResponse.json(
        { error: "Bu kod zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Son sira numarasini bul
    const sonKolon = await prisma.takip_kolonlar.findFirst({
      where: { tenantId },
      orderBy: { siraNo: "desc" },
    });

    const yeniSiraNo = (sonKolon?.siraNo ?? -1) + 1;

    const { randomUUID } = await import("crypto");
    const yeniKolon = await prisma.takip_kolonlar.create({
      data: {
        id: randomUUID(),
        kod,
        baslik,
        tip,
        siraNo: yeniSiraNo,
        aktif: true,
        sistem: false,
        tenantId,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await auditLog.create(
      { id: user.id, email: user.email || "", tenantId },
      "takip_kolonlar",
      yeniKolon.id,
      { kod, baslik, tip }
    );

    invalidateDashboard(tenantId, ['takip-stats', 'takip-column-stats']);
    return NextResponse.json(yeniKolon);
  } catch (error) {
    console.error("[TakipKolon] POST Error:", error);
    return NextResponse.json(
      { error: "Kolon eklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/takip/kolonlar
 * Kolon gunceller (baslik, siraNo, aktif)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const body = await req.json();
    const { id, baslik, siraNo, aktif } = body;

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    // Kolonu bul ve tenant kontrolu yap
    const mevcutKolon = await prisma.takip_kolonlar.findFirst({
      where: { id, tenantId },
    });

    if (!mevcutKolon) {
      return NextResponse.json({ error: "Kolon bulunamadı" }, { status: 404 });
    }

    // Guncelleme verilerini hazirla
    const updateData: Record<string, unknown> = {};
    if (baslik !== undefined) updateData.baslik = baslik;
    if (siraNo !== undefined) updateData.siraNo = siraNo;
    if (aktif !== undefined) updateData.aktif = aktif;

    const guncellenmisKolon = await prisma.takip_kolonlar.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await auditLog.update(
      { id: user.id, email: user.email || "", tenantId },
      "takip_kolonlar",
      id,
      { baslik: guncellenmisKolon.baslik, aktif: guncellenmisKolon.aktif }
    );

    invalidateDashboard(tenantId, ['takip-stats', 'takip-column-stats']);
    return NextResponse.json(guncellenmisKolon);
  } catch (error) {
    console.error("[TakipKolon] PUT Error:", error);
    return NextResponse.json(
      { error: "Kolon güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/takip/kolonlar?id=xxx
 * Kolon siler (sistem kolonlari silinemez)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    // Kolonu bul ve kontroller yap
    const kolon = await prisma.takip_kolonlar.findFirst({
      where: { id, tenantId },
    });

    if (!kolon) {
      return NextResponse.json({ error: "Kolon bulunamadı" }, { status: 404 });
    }

    if (kolon.sistem) {
      return NextResponse.json(
        { error: "Sistem kolonları silinemez" },
        { status: 400 }
      );
    }

    await prisma.takip_kolonlar.delete({
      where: { id },
    });

    // Audit log
    await auditLog.delete(
      { id: user.id, email: user.email || "", tenantId },
      "takip_kolonlar",
      id,
      { kod: kolon.kod, baslik: kolon.baslik }
    );

    invalidateDashboard(tenantId, ['takip-stats', 'takip-column-stats']);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TakipKolon] DELETE Error:", error);
    return NextResponse.json(
      { error: "Kolon silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
