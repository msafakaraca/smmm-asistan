/**
 * Geçici Vergi Kontrol Customer Files API
 *
 * GET: Belirli bir müşteri ve dönem için GGECICI/KGECICI dosyalarını döndür
 *
 * Query params:
 * - customerId: Müşteri UUID
 * - year: Yıl
 * - month: Ay
 * - fileCategory: "TAHAKKUK" | "BEYANNAME" (varsayılan: TAHAKKUK)
 * - beyannameTuru: "GGECICI" | "KGECICI"
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
    const beyannameTuru = searchParams.get("beyannameTuru") || "GGECICI";

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

    // Kategori filtresi
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

    let documents = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        customerId,
        year,
        month,
        isFolder: false,
        beyannameTuru,
        ...categoryFilter,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    // Fallback: Eski bot çalışmalarından yanlış ay ile kaydedilmiş dosyalar
    if (documents.length === 0) {
      let fbMonth = month + 1;
      let fbYear = year;
      if (fbMonth > 12) { fbMonth = 1; fbYear++; }

      const fbDocuments = await prisma.documents.findMany({
        where: {
          tenantId: user.tenantId,
          customerId,
          year: fbYear,
          month: fbMonth,
          isFolder: false,
          beyannameTuru,
          ...categoryFilter,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      });

      if (fbDocuments.length > 0) {
        console.log(`[GECICI-VERGI-FILES] Fallback: ${fbDocuments.length} dosya ${fbMonth}/${fbYear} ile bulundu (beklenen: ${month}/${year})`);
        documents = fbDocuments;
      }
    }

    return NextResponse.json({
      success: true,
      files: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
      })),
    });
  } catch (error) {
    console.error("[GECICI-VERGI-CUSTOMER-FILES] Error:", error);
    return NextResponse.json(
      { error: "Dosyalar getirilemedi" },
      { status: 500 }
    );
  }
}
