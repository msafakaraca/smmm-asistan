import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Finansal ayarları getir
export async function GET() {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: { financialDefaults: true },
    });

    // Varsayılan değerler
    const defaults = {
      hasSMM: true,
      defaultKdvRate: 20,
      defaultStopajRate: 20,
      autoChargeEnabled: false,
      autoChargeDay: 1,
      ...(tenant?.financialDefaults as Record<string, unknown> || {}),
    };

    return NextResponse.json(defaults);
  } catch (error) {
    console.error("Finansal ayarlar getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Finansal ayarları güncelle
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { hasSMM, defaultKdvRate, defaultStopajRate, autoChargeEnabled, autoChargeDay } = body;

    // Mevcut ayarları al
    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: { financialDefaults: true },
    });

    const currentDefaults = (tenant?.financialDefaults as Record<string, unknown>) || {};

    const updatedDefaults = {
      ...currentDefaults,
      ...(hasSMM !== undefined && { hasSMM }),
      ...(defaultKdvRate !== undefined && { defaultKdvRate }),
      ...(defaultStopajRate !== undefined && { defaultStopajRate }),
      ...(autoChargeEnabled !== undefined && { autoChargeEnabled }),
      ...(autoChargeDay !== undefined && { autoChargeDay }),
    };

    await prisma.tenants.update({
      where: { id: user.tenantId },
      data: { financialDefaults: updatedDefaults },
    });

    return NextResponse.json(updatedDefaults);
  } catch (error) {
    console.error("Finansal ayarlar güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
