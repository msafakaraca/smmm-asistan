/**
 * KDV2 Kontrol Customer Files API
 *
 * GET: Belirli bir müşteri ve dönem için KDV2 dosyalarını döndür
 *
 * Query params:
 * - customerId: Müşteri UUID
 * - year: Yıl
 * - month: Ay
 * - type: "tahakkuk" | "beyanname" (varsayılan: tahakkuk)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserWithProfile } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const year = parseInt(searchParams.get("year") || "0");
    const month = parseInt(searchParams.get("month") || "0");
    const type = searchParams.get("type") || "tahakkuk";

    if (!customerId || !year || !month) {
      return NextResponse.json(
        { error: "customerId, year ve month parametreleri gerekli" },
        { status: 400 }
      );
    }

    // Müşterinin bu tenant'a ait olduğunu doğrula
    const customer = await prisma.customers.findFirst({
      where: {
        id: customerId,
        tenantId: user.tenantId,
      },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Müşteri bulunamadı" },
        { status: 404 }
      );
    }

    // Dosya kategorisi filtresini belirle
    const categoryFilter = type === "beyanname"
      ? [
          { fileCategory: { contains: "BEYANNAME", mode: "insensitive" as const } },
          { type: { contains: "beyanname", mode: "insensitive" as const } },
        ]
      : [
          { fileCategory: { contains: "TAHAKKUK", mode: "insensitive" as const } },
          { type: { contains: "tahakkuk", mode: "insensitive" as const } },
        ];

    // Bu dönem için KDV2 dosyalarını getir
    const documents = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        beyannameTuru: "KDV2",
        OR: categoryFilter,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      files: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
      })),
    });
  } catch (error) {
    console.error("[KDV2-CUSTOMER-FILES] Error:", error);
    return NextResponse.json(
      { error: "Dosyalar getirilemedi" },
      { status: 500 }
    );
  }
}
