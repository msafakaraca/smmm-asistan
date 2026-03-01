import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Tek çek getir
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
    const check = await prisma.checks.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true, vknTckn: true } },
        transactions: {
          select: { id: true, amount: true, status: true, date: true },
        },
      },
    });

    if (!check) {
      return NextResponse.json({ error: "Çek bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(check);
  } catch (error) {
    console.error("Çek getirme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
