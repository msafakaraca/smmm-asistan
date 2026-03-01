import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { CheckStatus } from "@prisma/client";

// Geçerli çek durum geçişleri
const VALID_CHECK_TRANSITIONS: Record<CheckStatus, CheckStatus[]> = {
  IN_PORTFOLIO: ["COLLECTED", "BOUNCED", "RETURNED"],
  COLLECTED: [],
  BOUNCED: [],
  RETURNED: [],
};

// Çek durumu güncelle
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json({ error: "Yeni durum belirtilmedi" }, { status: 400 });
    }

    const check = await prisma.checks.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        transactions: { where: { type: "CREDIT", status: { not: "CANCELLED" } } },
      },
    });

    if (!check) {
      return NextResponse.json({ error: "Çek bulunamadı" }, { status: 404 });
    }

    // State machine validasyonu
    const validTransitions = VALID_CHECK_TRANSITIONS[check.status];
    if (!validTransitions.includes(newStatus as CheckStatus)) {
      return NextResponse.json(
        { error: `Geçersiz durum geçişi: ${check.status} → ${newStatus}` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Çek durumunu güncelle
      const updatedCheck = await tx.checks.update({
        where: { id },
        data: { status: newStatus },
      });

      // İlgili transaction'ları güncelle
      if (newStatus === "COLLECTED") {
        // Tahsil edildi → İlgili CREDIT transaction'lar COMPLETED
        for (const t of check.transactions) {
          await tx.financial_transactions.update({
            where: { id: t.id },
            data: { status: "COMPLETED" },
          });
        }
      } else if (newStatus === "BOUNCED" || newStatus === "RETURNED") {
        // Karşılıksız/İade → İlgili borç PENDING'e döner
        for (const t of check.transactions) {
          if (t.parentTransactionId) {
            await tx.financial_transactions.update({
              where: { id: t.parentTransactionId },
              data: { status: "PENDING" },
            });
          }
          // CREDIT transaction iptal
          await tx.financial_transactions.update({
            where: { id: t.id },
            data: { status: "CANCELLED" },
          });
        }
      }

      return updatedCheck;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Çek durum güncelleme hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
