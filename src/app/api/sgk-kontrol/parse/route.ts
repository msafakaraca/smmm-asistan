/**
 * SGK Kontrol Parse API
 *
 * POST: Tek müşteri için SGK parse işlemi - Bot'u yönlendirir
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();
    const { customerId, year, month } = body;

    if (!customerId || !year || !month) {
      return NextResponse.json(
        { error: "customerId, year ve month gerekli" },
        { status: 400 }
      );
    }

    // Müşteriyi kontrol et
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, unvan: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Müşteri bulunamadı" },
        { status: 404 }
      );
    }

    // SGK verileri bot tarafından otomatik parse ediliyor
    // Bu endpoint kullanıcıya bilgi mesajı döndürür
    return NextResponse.json({
      success: true,
      message: `${customer.unvan} için SGK verileri bot tarafından otomatik çekilir`,
      instruction: "GİB Bot'u çalıştırarak SGK verilerini çekebilirsiniz",
      customerId,
      year,
      month,
    });
  } catch (error) {
    console.error("Error in SGK parse:", error);
    return NextResponse.json(
      { error: "SGK parse işleminde hata oluştu" },
      { status: 500 }
    );
  }
}
