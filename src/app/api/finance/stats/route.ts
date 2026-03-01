import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

  // Seçili ayın başı ve sonu
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Son 12 ayın başlangıcı (aylık trend için)
  const twelveMonthsAgo = new Date(year, month - 13, 1);

  const tenantId = user.tenantId;

  try {
    // Paralel aggregate sorgular
    const [
      pendingDebit,
      monthlyCredit,
      monthlyExpenses,
      monthlyDebitTotal,
      monthlyDebitCompleted,
      categoryBreakdown,
      topDebtors,
    ] = await Promise.all([
      // 1. Bekleyen toplam alacak (tüm zamanlar)
      prisma.financial_transactions.aggregate({
        where: {
          tenantId,
          type: "DEBIT",
          status: { in: ["PENDING", "PARTIAL"] },
        },
        _sum: { netAmount: true },
      }),

      // 2. Seçili ay tahsilat (CREDIT)
      prisma.financial_transactions.aggregate({
        where: {
          tenantId,
          type: "CREDIT",
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      }),

      // 3. Seçili ay gider
      prisma.expenses.aggregate({
        where: {
          tenantId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),

      // 4. Seçili ay toplam borçlandırma (DEBIT)
      prisma.financial_transactions.aggregate({
        where: {
          tenantId,
          type: "DEBIT",
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      }),

      // 5. Seçili ay tamamlanan borçlandırma (tahsilat oranı için)
      prisma.financial_transactions.aggregate({
        where: {
          tenantId,
          type: "DEBIT",
          status: "COMPLETED",
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      }),

      // 6. Kategori dağılımı (DEBIT, seçili ay)
      prisma.financial_transactions.groupBy({
        by: ["categoryId"],
        where: {
          tenantId,
          type: "DEBIT",
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      }),

      // 7. En borçlu müşteriler (PENDING/PARTIAL DEBIT, tüm zamanlar)
      prisma.financial_transactions.groupBy({
        by: ["customerId"],
        where: {
          tenantId,
          type: "DEBIT",
          status: { in: ["PENDING", "PARTIAL"] },
          customerId: { not: null },
        },
        _sum: { netAmount: true },
        orderBy: { _sum: { netAmount: "desc" } },
        take: 10,
      }),
    ]);

    // Zenginleştirme + aylık trend - PARALELde çalıştır
    const categoryIds = categoryBreakdown.map((c) => c.categoryId);
    const customerIds = topDebtors
      .map((d) => d.customerId)
      .filter((id): id is string => id !== null);

    const [categories, customers, monthlyTrend] = await Promise.all([
      categoryIds.length > 0
        ? prisma.finance_categories.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, color: true },
          })
        : [],
      customerIds.length > 0
        ? prisma.customers.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, unvan: true, kisaltma: true },
          })
        : [],
      getMonthlyTrend(tenantId, twelveMonthsAgo),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const enrichedCategories = categoryBreakdown
      .map((c) => {
        const cat = categoryMap.get(c.categoryId);
        return {
          categoryId: c.categoryId,
          categoryName: cat?.name || "Bilinmiyor",
          color: cat?.color || "#6b7280",
          total: Number(c._sum.netAmount || 0),
        };
      })
      .sort((a, b) => b.total - a.total);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const enrichedDebtors = topDebtors
      .filter((d) => d.customerId !== null)
      .map((d) => {
        const cust = customerMap.get(d.customerId!);
        return {
          customerId: d.customerId!,
          customerName: cust?.kisaltma || cust?.unvan || "Bilinmiyor",
          total: Number(d._sum.netAmount || 0),
        };
      });

    // Özet hesaplamalar
    const pendingTotal = Number(pendingDebit._sum.netAmount || 0);
    const thisMonthCollected = Number(monthlyCredit._sum.netAmount || 0);
    const thisMonthExpenses = Number(monthlyExpenses._sum.amount || 0);
    const netProfit = thisMonthCollected - thisMonthExpenses;
    const totalDebit = Number(monthlyDebitTotal._sum.netAmount || 0);
    const completedDebit = Number(monthlyDebitCompleted._sum.netAmount || 0);
    const collectionRate = totalDebit > 0
      ? Math.round((completedDebit / totalDebit) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        pendingTotal,
        thisMonthCollected,
        thisMonthExpenses,
        netProfit,
        collectionRate,
      },
      categoryBreakdown: enrichedCategories,
      monthlyTrend,
      topDebtors: enrichedDebtors,
    });
  } catch (error) {
    console.error("İstatistik API hatası:", error);
    return NextResponse.json(
      { error: "İstatistikler yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// Aylık trend verisi - raw SQL ile
async function getMonthlyTrend(
  tenantId: string,
  since: Date
): Promise<{ month: string; income: number; expense: number }[]> {
  // Tahsilat + Gider trendi - PARALELde çalıştır
  const [incomeRows, expenseRows] = await Promise.all([
    prisma.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
      SELECT
        TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM("netAmount"), 0) as total
      FROM financial_transactions
      WHERE "tenantId" = ${tenantId}::uuid
        AND type = 'CREDIT'
        AND date >= ${since}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month
    `,
    prisma.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
      SELECT
        TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE "tenantId" = ${tenantId}::uuid
        AND date >= ${since}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month
    `,
  ]);

  // Tüm ayları birleştir
  const incomeMap = new Map(
    incomeRows.map((r) => [r.month, Number(r.total)])
  );
  const expenseMap = new Map(
    expenseRows.map((r) => [r.month, Number(r.total)])
  );

  // Son 12 ayın listesi
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return months.map((m) => ({
    month: m,
    income: incomeMap.get(m) || 0,
    expense: expenseMap.get(m) || 0,
  }));
}
