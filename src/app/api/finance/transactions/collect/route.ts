import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Çoklu borç tahsilatı
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const {
      customerId, transactionIds, amount, paymentMethod,
      currency, exchangeRate, checkData, date, note,
    } = body;

    if (!customerId || !transactionIds?.length || !amount || !paymentMethod || !date) {
      return NextResponse.json(
        { error: "Zorunlu alanlar eksik" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Seçilen borçları getir
      const debts = await tx.financial_transactions.findMany({
        where: {
          id: { in: transactionIds },
          tenantId: user.tenantId,
          customerId,
          type: "DEBIT",
          status: { in: ["PENDING", "PARTIAL"] },
        },
        orderBy: { dueDate: "asc" },
      });

      if (debts.length === 0) {
        throw new Error("Seçilen borçlar bulunamadı veya zaten tahsil edilmiş");
      }

      // Çek varsa oluştur
      let checkId: string | null = null;
      if (paymentMethod === "CHECK" && checkData) {
        const check = await tx.checks.create({
          data: {
            checkNumber: checkData.checkNumber || null,
            bankName: checkData.bankName || null,
            amount: checkData.amount || amount,
            currency: currency || "TRY",
            issueDate: new Date(date),
            dueDate: new Date(checkData.dueDate),
            customerId,
            tenantId: user.tenantId,
          },
        });
        checkId = check.id;
      }

      // Tahsilat transaction'ını oluştur
      let remainingAmount = Number(amount);
      const updatedDebts: string[] = [];

      for (const debt of debts) {
        if (remainingAmount <= 0) break;

        const debtAmount = Number(debt.amount);
        if (remainingAmount >= debtAmount) {
          // Tam ödeme
          await tx.financial_transactions.update({
            where: { id: debt.id },
            data: { status: "COMPLETED" },
          });
          remainingAmount -= debtAmount;
        } else {
          // Kısmi ödeme
          await tx.financial_transactions.update({
            where: { id: debt.id },
            data: { status: "PARTIAL" },
          });
          remainingAmount = 0;
        }
        updatedDebts.push(debt.id);
      }

      // CREDIT transaction oluştur
      const creditTransaction = await tx.financial_transactions.create({
        data: {
          customerId,
          categoryId: debts[0].categoryId,
          type: "CREDIT",
          amount,
          currency: currency || "TRY",
          exchangeRate: exchangeRate || null,
          netAmount: amount,
          description: note || "Tahsilat",
          date: new Date(date),
          paymentMethod,
          checkId,
          status: "COMPLETED",
          parentTransactionId: debts[0].id,
          tenantId: user.tenantId,
        },
      });

      return { creditTransaction, updatedDebts: updatedDebts.length, checkId };
    });

    return NextResponse.json({
      message: `${result.updatedDebts} borç güncellendi`,
      ...result,
    });
  } catch (error) {
    console.error("Tahsilat hatası:", error);
    const message = error instanceof Error ? error.message : "Sunucu hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
