/**
 * KDV9015 Kontrol Bulk Status API (KDV Tevkifat)
 *
 * POST: Secilen musterilerin KDV9015 kontrol durumlarini toplu guncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Valid KDV9015 status values
const KDV9015_STATUSES = [
  "bekliyor",
  "verildi",
  "eksik",
  "verilmeyecek",
] as const;

// Request validation schema
const bulkStatusSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, "En az bir musteri secilmelidir"),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  status: z.enum(KDV9015_STATUSES, {
    errorMap: () => ({ message: "Gecersiz durum degeri" }),
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

    // Musterilerin tenant'a ait oldugunu kontrol et
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: customerIds },
        tenantId,
      },
      select: { id: true },
    });

    if (customers.length !== customerIds.length) {
      return NextResponse.json(
        { error: "Bazi musteriler bulunamadi veya erisim yetkiniz yok" },
        { status: 400 }
      );
    }

    // Upsert ile toplu guncelleme (daha verimli)
    const result = await prisma.$transaction(
      async (tx) => {
        const operations = customerIds.map((customerId) =>
          tx.kdv9015_kontrol.upsert({
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
      message: `${customerIds.length} kayit "${statusLabels[status]}" olarak guncellendi`,
      ...result,
    });
  } catch (error) {
    console.error("[kdv9015-kontrol/bulk-status] Error:", error);
    return NextResponse.json(
      { error: "Toplu durum guncellenirken bir hata olustu" },
      { status: 500 }
    );
  }
}
