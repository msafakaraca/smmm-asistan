/**
 * INTVRG Vergi Levhası PDF API
 * =============================
 * GET: Supabase Storage'dan signed URL ile PDF erişimi
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { getSignedUrl } from "@/lib/storage-supabase";

/**
 * GET /api/intvrg/vergi-levhasi-pdf?customerId=X&onayKodu=Y
 * Vergi levhası PDF'i için signed URL döner (10 dk geçerli)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const onayKodu = searchParams.get("onayKodu");

    if (!customerId || !onayKodu) {
      return NextResponse.json(
        { error: "customerId ve onayKodu parametreleri zorunludur" },
        { status: 400 }
      );
    }

    // Müşteri kontrolü
    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { vknTckn: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    }

    // Document'ı bul
    const filename = `${customer.vknTckn}_VERGILEVHASI_${onayKodu}.pdf`;
    const doc = await prisma.documents.findFirst({
      where: {
        customerId,
        tenantId: user.tenantId,
        fileCategory: "VERGI_LEVHASI",
        name: filename,
      },
      select: { path: true, name: true },
    });

    if (!doc || !doc.path) {
      return NextResponse.json(
        { error: "PDF bulunamadı. Henüz indirilmemiş olabilir.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    try {
      const signedUrl = await getSignedUrl(doc.path, 600);
      return NextResponse.json({ signedUrl, fileName: doc.name });
    } catch {
      return NextResponse.json(
        { error: "PDF dosyası storage'da bulunamadı. Tekrar sorgulayın.", code: "STORAGE_NOT_FOUND" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("[vergi-levhasi-pdf] GET hatası:", error);
    return NextResponse.json(
      { error: "PDF erişim hatası" },
      { status: 500 }
    );
  }
}
