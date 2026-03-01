import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Maliyet tanımlarını listele
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const categoryId = searchParams.get("categoryId");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (customerId) where.customerId = customerId;
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== null) where.isActive = isActive !== "false";

    const definitions = await prisma.cost_definitions.findMany({
      where,
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true, vknTckn: true } },
        category: { select: { id: true, name: true, type: true, color: true, icon: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error("Maliyet tanımları listeleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Yeni maliyet tanımı oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const {
      customerId,
      categoryId,
      description,
      amount,
      currency,
      frequency,
      chargeStrategy,
      hasSMM,
      kdvRate,
      stopajRate,
      startDate,
      endDate,
    } = body;

    if (!customerId || !categoryId || !amount || !frequency || !startDate) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik (müşteri, kategori, tutar, periyot, başlangıç tarihi)" },
        { status: 400 }
      );
    }

    const definition = await prisma.cost_definitions.create({
      data: {
        customerId,
        categoryId,
        description: description || null,
        amount,
        currency: currency || "TRY",
        frequency,
        chargeStrategy: chargeStrategy || "FULL",
        hasSMM: hasSMM ?? true,
        kdvRate: kdvRate ?? null,
        stopajRate: stopajRate ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        tenantId: user.tenantId,
      },
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    console.error("Maliyet tanımı oluşturma hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
