import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Tek maliyet tanımı getir
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const definition = await prisma.cost_definitions.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true, vknTckn: true } },
        category: { select: { id: true, name: true, type: true, color: true, icon: true } },
      },
    });

    if (!definition) {
      return NextResponse.json({ error: "Maliyet tanımı bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(definition);
  } catch (error) {
    console.error("Maliyet tanımı getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Maliyet tanımı güncelle
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.cost_definitions.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Maliyet tanımı bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.cost_definitions.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
        ...(body.chargeStrategy !== undefined && { chargeStrategy: body.chargeStrategy }),
        ...(body.hasSMM !== undefined && { hasSMM: body.hasSMM }),
        ...(body.kdvRate !== undefined && { kdvRate: body.kdvRate }),
        ...(body.stopajRate !== undefined && { stopajRate: body.stopajRate }),
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Maliyet tanımı güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Maliyet tanımı sil (soft delete - isActive false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.cost_definitions.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Maliyet tanımı bulunamadı" }, { status: 404 });
    }

    await prisma.cost_definitions.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Maliyet tanımı pasif yapıldı" });
  } catch (error) {
    console.error("Maliyet tanımı silme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
