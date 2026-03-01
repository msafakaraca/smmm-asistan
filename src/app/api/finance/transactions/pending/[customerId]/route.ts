import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Müşterinin bekleyen borçlarını getir
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { customerId } = await params;

    const pendingDebts = await prisma.financial_transactions.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        type: "DEBIT",
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        child_transactions: {
          where: { type: "CREDIT", status: { not: "CANCELLED" } },
          select: { amount: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Her borç için kalan bakiyeyi hesapla
    const debtsWithBalance = pendingDebts.map((debt) => {
      const totalPaid = debt.child_transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
      const remaining = Number(debt.amount) - totalPaid;
      return {
        ...debt,
        totalPaid,
        remaining,
        child_transactions: undefined,
      };
    });

    return NextResponse.json(debtsWithBalance);
  } catch (error) {
    console.error("Bekleyen borçlar hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
