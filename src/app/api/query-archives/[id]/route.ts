import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/query-archives/[id]
 * Arşiv kaydının tüm detayını döner (resultData dahil)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const archive = await prisma.query_archives.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        customers: {
          select: { unvan: true, kisaltma: true, vknTckn: true },
        },
      },
    });

    if (!archive) {
      return NextResponse.json(
        { error: "Arşiv kaydı bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json(archive);
  } catch (error) {
    console.error("[QUERY-ARCHIVES] GET [id] hatası:", error);
    return NextResponse.json(
      { error: "Arşiv kaydı yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/query-archives/[id]
 * Arşiv kaydını sil
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Önce kaydın bu tenant'a ait olduğunu doğrula
    const existing = await prisma.query_archives.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Arşiv kaydı bulunamadı" },
        { status: 404 }
      );
    }

    await prisma.query_archives.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QUERY-ARCHIVES] DELETE hatası:", error);
    return NextResponse.json(
      { error: "Arşiv kaydı silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
