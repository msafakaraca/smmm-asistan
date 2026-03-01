import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Çekleri listele
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const checks = await prisma.checks.findMany({
      where,
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true } },
        transactions: {
          select: { id: true, amount: true, status: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(checks);
  } catch (error) {
    console.error("Çek listeleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// Yeni çek oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const { checkNumber, bankName, amount, currency, issueDate, dueDate, customerId, note } = body;

    if (!amount || !issueDate || !dueDate || !customerId) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik (tutar, düzenleme tarihi, vade tarihi, müşteri)" },
        { status: 400 }
      );
    }

    const check = await prisma.checks.create({
      data: {
        checkNumber: checkNumber || null,
        bankName: bankName || null,
        amount,
        currency: currency || "TRY",
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        customerId,
        note: note || null,
        tenantId: user.tenantId,
      },
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true } },
      },
    });

    return NextResponse.json(check, { status: 201 });
  } catch (error) {
    console.error("Çek oluşturma hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
