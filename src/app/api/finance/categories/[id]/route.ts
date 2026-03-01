import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Tek kategori getir
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
    const category = await prisma.finance_categories.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!category) {
      return NextResponse.json({ error: "Kategori bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Kategori getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Kategori güncelle
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
    const { name, color, icon } = body;

    const existing = await prisma.finance_categories.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kategori bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.finance_categories.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Kategori güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Kategori sil
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
    const existing = await prisma.finance_categories.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        _count: {
          select: {
            cost_definitions: true,
            financial_transactions: true,
            expenses: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kategori bulunamadı" }, { status: 404 });
    }

    const totalRelated =
      existing._count.cost_definitions +
      existing._count.financial_transactions +
      existing._count.expenses;

    if (totalRelated > 0) {
      return NextResponse.json(
        {
          error: "Bu kategoriye bağlı kayıtlar var, silinemez",
          relatedCount: totalRelated,
        },
        { status: 409 }
      );
    }

    await prisma.finance_categories.delete({ where: { id } });
    return NextResponse.json({ message: "Kategori silindi" });
  } catch (error) {
    console.error("Kategori silme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
