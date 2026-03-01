import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Giderleri listele
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const isRecurring = searchParams.get("isRecurring");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (categoryId) where.categoryId = categoryId;
    if (isRecurring !== null && isRecurring !== undefined) {
      where.isRecurring = isRecurring === "true";
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const expenses = await prisma.expenses.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Gider listeleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Yeni gider oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { categoryId, amount, currency, date, description, isRecurring, recurringFrequency } = body;

    if (!categoryId || !amount || !date) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik (kategori, tutar, tarih)" },
        { status: 400 }
      );
    }

    const expense = await prisma.expenses.create({
      data: {
        categoryId,
        amount,
        currency: currency || "TRY",
        date: new Date(date),
        description: description || null,
        isRecurring: isRecurring || false,
        recurringFrequency: isRecurring ? recurringFrequency : null,
        tenantId: user.tenantId,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Gider oluşturma hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
