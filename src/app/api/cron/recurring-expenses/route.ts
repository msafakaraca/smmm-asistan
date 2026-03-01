import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/cron/recurring-expenses
 * Vercel Cron Job - Tekrarlayan giderleri otomatik oluştur
 * Günde 1 kez, 03:00 UTC'de çalışır (Türkiye saati 06:00)
 */
export async function GET(req: NextRequest) {
  try {
    // Cron secret kontrolü
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const currentPeriod = getCurrentPeriod(now);
    console.log(
      `[Cron Recurring Expenses] Başlatılıyor: ${now.toISOString()}, Dönem: ${currentPeriod}`
    );

    // Tüm tekrarlayan giderleri getir
    const recurringExpenses = await prisma.expenses.findMany({
      where: { isRecurring: true },
      include: { category: true },
    });

    console.log(
      `[Cron Recurring Expenses] ${recurringExpenses.length} tekrarlayan gider bulundu`
    );

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const expense of recurringExpenses) {
      try {
        // Frekansa göre bu dönemde oluşturulmalı mı kontrol et
        if (
          !expense.recurringFrequency ||
          !shouldCreateForPeriod(expense.recurringFrequency, currentPeriod)
        ) {
          skippedCount++;
          continue;
        }

        // Bu dönem için zaten log var mı? (duplicate önleme)
        const existingLog = await prisma.recurring_expense_logs.findUnique({
          where: {
            sourceExpenseId_period: {
              sourceExpenseId: expense.id,
              period: currentPeriod,
            },
          },
        });

        if (existingLog) {
          skippedCount++;
          continue;
        }

        // Yeni gider kaydı oluştur
        const newExpense = await prisma.expenses.create({
          data: {
            categoryId: expense.categoryId,
            amount: expense.amount,
            currency: expense.currency,
            date: now,
            description: expense.description
              ? `${expense.description} (Otomatik)`
              : "Tekrarlayan gider (Otomatik)",
            isRecurring: false, // KRİTİK: Sonsuz döngü önleme!
            tenantId: expense.tenantId,
          },
        });

        // Başarılı log kaydı
        await prisma.recurring_expense_logs.create({
          data: {
            sourceExpenseId: expense.id,
            createdExpenseId: newExpense.id,
            period: currentPeriod,
            status: "SUCCESS",
            tenantId: expense.tenantId,
          },
        });

        createdCount++;
        console.log(
          `[Cron Recurring Expenses] Oluşturuldu: ${expense.id} -> ${newExpense.id} (${currentPeriod})`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[Cron Recurring Expenses] Hata (${expense.id}):`,
          error
        );

        // Hata log kaydı (duplicate constraint hatası hariç)
        try {
          await prisma.recurring_expense_logs.create({
            data: {
              sourceExpenseId: expense.id,
              period: currentPeriod,
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Bilinmeyen hata",
              tenantId: expense.tenantId,
            },
          });
        } catch {
          // Log oluşturma da başarısız olursa (örn. unique constraint) sessizce geç
        }
      }
    }

    console.log(
      `[Cron Recurring Expenses] Tamamlandı: ${createdCount} oluşturuldu, ${skippedCount} atlandı, ${errorCount} hata`
    );

    return NextResponse.json({
      success: true,
      period: currentPeriod,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount,
      total: recurringExpenses.length,
      executedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[Cron Recurring Expenses] Fatal hata:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Mevcut dönemi "YYYY-MM" formatında döndürür
 */
function getCurrentPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Frekansa göre bu dönemde yeni gider oluşturulmalı mı kontrol eder
 */
function shouldCreateForPeriod(
  frequency: "REC_MONTHLY" | "REC_QUARTERLY" | "REC_ANNUAL",
  period: string
): boolean {
  const month = parseInt(period.split("-")[1], 10);
  switch (frequency) {
    case "REC_MONTHLY":
      return true; // Her ay oluştur
    case "REC_QUARTERLY":
      return [1, 4, 7, 10].includes(month); // Çeyrek başları
    case "REC_ANNUAL":
      return month === 1; // Sadece Ocak
  }
}
