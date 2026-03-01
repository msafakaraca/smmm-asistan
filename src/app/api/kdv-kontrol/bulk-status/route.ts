/**
 * KDV Kontrol Bulk Status API
 *
 * POST: Seçilen müşterilerin KDV kontrol durumlarını toplu güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Valid KDV status values
const KDV_STATUSES = [
  "bekliyor",
  "verildi",
  "eksik",
  "verilmeyecek",
] as const;

// Request validation schema
const bulkStatusSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, "En az bir müşteri seçilmelidir"),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  status: z.enum(KDV_STATUSES, {
    errorMap: () => ({ message: "Geçersiz durum değeri" }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await request.json();

    // Validation
    const validation = bulkStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { customerIds, year, month, status } = validation.data;

    // Müşterilerin tenant'a ait olduğunu kontrol et
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: customerIds },
        tenantId,
      },
      select: { id: true },
    });

    if (customers.length !== customerIds.length) {
      return NextResponse.json(
        { error: "Bazı müşteriler bulunamadı veya erişim yetkiniz yok" },
        { status: 400 }
      );
    }

    // Upsert ile toplu güncelleme (daha verimli)
    const result = await prisma.$transaction(
      async (tx) => {
        const operations = customerIds.map((customerId) =>
          tx.kdv_kontrol.upsert({
            where: {
              customerId_year_month: { customerId, year, month },
            },
            update: { status },
            create: {
              tenantId,
              customerId,
              year,
              month,
              status,
            },
          })
        );

        await Promise.all(operations);
        return { updatedCount: customerIds.length };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    const statusLabels: Record<string, string> = {
      bekliyor: "Bekliyor",
      verildi: "Verildi",
      eksik: "Eksik",
      verilmeyecek: "Verilmeyecek",
    };

    return NextResponse.json({
      success: true,
      message: `${customerIds.length} kayıt "${statusLabels[status]}" olarak güncellendi`,
      ...result,
    });
  } catch (error) {
    console.error("[kdv-kontrol/bulk-status] Error:", error);
    return NextResponse.json(
      { error: "Toplu durum güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
