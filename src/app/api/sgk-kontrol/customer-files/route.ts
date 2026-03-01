/**
 * SGK Kontrol Customer Files API
 *
 * GET: Belirli bir müşteri ve dönem için SGK dosyalarını döndür
 *      UI'dan kullanıcı tarafından çağrılır
 *
 * Query params:
 * - customerId: Müşteri UUID
 * - year: Yıl
 * - month: Ay
 * - type: "tahakkuk" | "hizmet" | "beyanname" | "muhsgk_tahakkuk"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { Prisma } from "@prisma/client";

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
    const type = searchParams.get("type") as "tahakkuk" | "hizmet" | "beyanname" | "muhsgk_tahakkuk" | null;

    if (!customerId || !year || !month || !type) {
      return NextResponse.json(
        { error: "customerId, year, month ve type parametreleri gerekli" },
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

    let whereClause: Prisma.documentsWhereInput;

    if (type === "beyanname") {
      // MUHSGK Beyanname dosyaları
      whereClause = {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        beyannameTuru: "MUHSGK",
        fileCategory: "BEYANNAME",
      };
    } else if (type === "muhsgk_tahakkuk") {
      // MUHSGK Tahakkuk dosyaları
      whereClause = {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        beyannameTuru: "MUHSGK",
        fileCategory: "TAHAKKUK",
      };
    } else {
      // SGK Tahakkuk veya Hizmet Listesi (mevcut mantık)
      const fileCategories =
        type === "tahakkuk"
          ? ["SGK_TAHAKKUK", "sgk_tahakkuk"]
          : ["HIZMET_LISTESI", "hizmet_listesi"];

      whereClause = {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        OR: [
          { fileCategory: { in: fileCategories } },
          { type: { in: fileCategories } },
        ],
      };
    }

    // Bu dönem ve tür için dosyaları getir
    const documents = await prisma.documents.findMany({
      where: whereClause,
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
    console.error("[SGK-CUSTOMER-FILES] Error:", error);
    return NextResponse.json(
      { error: "Dosyalar getirilemedi" },
      { status: 500 }
    );
  }
}
