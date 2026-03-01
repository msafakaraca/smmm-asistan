import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Tek gider getir
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
    const expense = await prisma.expenses.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        category: { select: { id: true, name: true, type: true, color: true, icon: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Gider bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error("Gider getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Gider güncelle
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

    const existing = await prisma.expenses.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gider bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.expenses.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.date !== undefined && { date: new Date(body.date) }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
        ...(body.recurringFrequency !== undefined && { recurringFrequency: body.recurringFrequency }),
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Gider güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Gider sil
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
    const existing = await prisma.expenses.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gider bulunamadı" }, { status: 404 });
    }

    await prisma.expenses.delete({ where: { id } });
    return NextResponse.json({ message: "Gider silindi" });
  } catch (error) {
    console.error("Gider silme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
