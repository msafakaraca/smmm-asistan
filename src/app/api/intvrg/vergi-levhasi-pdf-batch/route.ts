/**
 * INTVRG Vergi Levhası PDF Batch API
 * ====================================
 * POST: Birden fazla müşterinin PDF signed URL'lerini tek istekte döner
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { getSignedUrls } from "@/lib/storage-supabase";

interface BatchItem {
  customerId: string;
  onayKodu: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();
    const items: BatchItem[] = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items dizisi zorunludur" }, { status: 400 });
    }

    // Tüm müşterileri tek sorguda al
    const customerIds = [...new Set(items.map((i) => i.customerId))];
    const customers = await prisma.customers.findMany({
      where: { id: { in: customerIds }, tenantId: user.tenantId },
      select: { id: true, vknTckn: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c.vknTckn]));

    // Dosya isimlerini oluştur ve dokümanları tek sorguda bul
    const filenames = items
      .filter((i) => customerMap.has(i.customerId))
      .map((i) => `${customerMap.get(i.customerId)}_VERGILEVHASI_${i.onayKodu}.pdf`);

    const docs = await prisma.documents.findMany({
      where: {
        tenantId: user.tenantId,
        fileCategory: "VERGI_LEVHASI",
        name: { in: filenames },
        customerId: { in: customerIds },
      },
      select: { customerId: true, path: true, name: true },
    });

    // customerId → doc map
    const docMap = new Map(docs.map((d) => [d.customerId, d]));

    // Geçerli path'leri topla
    const validItems: Array<{ customerId: string; path: string; name: string }> = [];
    for (const item of items) {
      const doc = docMap.get(item.customerId);
      if (doc?.path) {
        validItems.push({ customerId: item.customerId, path: doc.path, name: doc.name });
      }
    }

    if (validItems.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Batch signed URL oluştur
    const paths = validItems.map((v) => v.path);
    const signedData = await getSignedUrls(paths, 600);

    // Sonuçları birleştir
    const results = validItems.map((v, idx) => ({
      customerId: v.customerId,
      signedUrl: signedData[idx]?.signedUrl || null,
      fileName: v.name,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[vergi-levhasi-pdf-batch] POST hatası:", error);
    return NextResponse.json({ error: "Batch PDF erişim hatası" }, { status: 500 });
  }
}
