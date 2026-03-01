/**
 * Takip Çizelgesi Bulk Status API
 *
 * POST: Seçilen satırların belirli kolon değerlerini toplu güncelle
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// Request validation schema
const bulkStatusSchema = z.object({
  satirIds: z.array(z.string().uuid()).min(1, "En az bir satır seçilmelidir"),
  kolonKod: z.string().min(1, "Kolon kodu gereklidir"),
  value: z.union([z.boolean(), z.null()]).nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const body = await request.json();

    // Validation
    const validation = bulkStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { satirIds, kolonKod, value } = validation.data;

    // Satırların tenant'a ait olduğunu kontrol et
    const satirlar = await prisma.takip_satirlar.findMany({
      where: {
        id: { in: satirIds },
        tenantId,
      },
      select: { id: true, degerler: true },
    });

    if (satirlar.length !== satirIds.length) {
      return NextResponse.json(
        { error: "Bazı satırlar bulunamadı veya erişim yetkiniz yok" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Paralel update işlemleri ile toplu güncelleme
    const result = await prisma.$transaction(
      async (tx) => {
        const operations = satirlar.map((satir) => {
          const mevcutDegerler =
            typeof satir.degerler === "object" && satir.degerler !== null
              ? (satir.degerler as Record<string, unknown>)
              : {};

          const yeniDegerler = {
            ...mevcutDegerler,
            [kolonKod]: {
              value,
              modifiedBy: user.id,
              modifiedByName: user.name,
              modifiedAt: now,
            },
          };

          return tx.takip_satirlar.update({
            where: { id: satir.id },
            data: { degerler: yeniDegerler as object },
          });
        });

        await Promise.all(operations);
        return { updatedCount: satirlar.length };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    const valueLabels: Record<string, string> = {
      true: "Tamam",
      false: "İptal",
      null: "Bekliyor",
    };

    const valueLabel = valueLabels[String(value)] || String(value);

    // Kolon başlığını Türkçe göstermek için DB'den çek
    const kolon = await prisma.takip_kolonlar.findFirst({
      where: { tenantId, kod: kolonKod },
      select: { baslik: true },
    });
    const kolonBaslik = kolon?.baslik || kolonKod;

    // Audit log
    await auditLog.bulk(
      { id: user.id, email: user.email || "", tenantId },
      "takip_satirlar",
      "BULK_UPDATE",
      satirIds.length,
      { kolonKod, kolonBaslik, value, valueLabel }
    );

    return NextResponse.json({
      success: true,
      message: `${satirIds.length} satır "${kolonKod}" kolonu "${valueLabel}" olarak güncellendi`,
      ...result,
    });
  } catch (error) {
    console.error("[takip/bulk-status] Error:", error);
    return NextResponse.json(
      { error: "Toplu durum güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
