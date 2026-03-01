/**
 * KDV Kontrol Customer Files API
 *
 * GET: Belirli bir müşteri ve dönem için KDV1 dosyalarını döndür
 *
 * Query params:
 * - customerId: Müşteri UUID
 * - year: Yıl
 * - month: Ay
 * - fileCategory: "TAHAKKUK" | "BEYANNAME" (varsayılan: TAHAKKUK)
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
    const fileCategory = searchParams.get("fileCategory") || "TAHAKKUK";

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

    // Bu dönem için KDV1 dosyalarını getir (kategori bazlı)
    const categoryFilter =
      fileCategory === "BEYANNAME"
        ? {
            OR: [
              { fileCategory: { contains: "BEYANNAME", mode: "insensitive" as const } },
              { type: { contains: "beyanname", mode: "insensitive" as const } },
            ],
          }
        : {
            OR: [
              { fileCategory: { contains: "TAHAKKUK", mode: "insensitive" as const } },
              { type: { contains: "tahakkuk", mode: "insensitive" as const } },
            ],
          };

    const documents = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        beyannameTuru: "KDV1",
        ...categoryFilter,
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
    console.error("[KDV-CUSTOMER-FILES] Error:", error);
    return NextResponse.json(
      { error: "Dosyalar getirilemedi" },
      { status: 500 }
    );
  }
}
