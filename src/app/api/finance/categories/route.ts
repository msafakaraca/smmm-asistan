import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Tüm kategorileri listele
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // INCOME veya EXPENSE

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (type === "INCOME" || type === "EXPENSE") {
      where.type = type;
    }

    const categories = await prisma.finance_categories.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Kategori listeleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Yeni kategori oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { name, type, color, icon } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Ad ve tür alanları zorunludur" },
        { status: 400 }
      );
    }

    const category = await prisma.finance_categories.create({
      data: {
        name,
        type,
        color: color || null,
        icon: icon || null,
        isDefault: false,
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Bu isimde bir kategori zaten mevcut" },
        { status: 409 }
      );
    }
    console.error("Kategori oluşturma hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
