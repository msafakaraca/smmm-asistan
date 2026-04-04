/**
 * SGK Kontrol Files API
 *
 * GET: Belirli dönemdeki SGK dosyalarını (hizmet listesi ve tahakkuk) listele
 *      Supabase signed URL ile birlikte döner
 *
 * Electron bot bu endpoint'i kullanarak hangi dosyaları parse edeceğini öğrenir.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyBearerOrInternal } from "@/lib/internal-auth";

const BUCKET_NAME = "smmm-documents";

export async function GET(req: NextRequest) {
  try {
    // Internal veya Bearer token ile doğrulama
    const auth = verifyBearerOrInternal(req.headers);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const tenantId = auth.tenantId;

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "0");
    const month = parseInt(searchParams.get("month") || "0");
    const groupId = searchParams.get("groupId");

    if (!year || !month) {
      return NextResponse.json(
        { error: "year ve month parametreleri gerekli" },
        { status: 400 }
      );
    }

    // Grup ID varsa, grup üyelerini al
    let groupMemberIds: string[] | null = null;
    if (groupId && groupId !== 'all') {
      const groupMembers = await prisma.customer_group_members.findMany({
        where: { groupId },
        select: { customerId: true }
      });
      groupMemberIds = groupMembers.map(m => m.customerId);
    }

    // MUHSGK beyannamesi veren müşterileri getir
    const allCustomers = await prisma.customers.findMany({
      where: {
        tenantId,
        status: "active",
        ...(groupMemberIds && { id: { in: groupMemberIds } }),
      },
      select: {
        id: true,
        unvan: true,
        vknTckn: true,
        verilmeyecekBeyannameler: true,
      },
    });

    // MUHSGK muaf olmayan müşterileri filtrele
    const customers = allCustomers.filter(
      (c) => !c.verilmeyecekBeyannameler?.includes("MUHSGK")
    );

    const customerIds = customers.map((c) => c.id);

    // Bu dönemde SGK ile ilgili dosyaları getir
    // fileCategory alanı ile filtreleme (SGK_TAHAKKUK ve HIZMET_LISTESI)
    const documents = await prisma.documents.findMany({
      where: {
        tenantId,
        year,
        month,
        customerId: { in: customerIds },
        isFolder: false,
        OR: [
          // Yeni format: fileCategory ile
          { fileCategory: "SGK_TAHAKKUK" },
          { fileCategory: "HIZMET_LISTESI" },
          // Eski format fallback: type ile
          { type: "sgk_tahakkuk" },
          { type: "hizmet_listesi" },
        ],
      },
      select: {
        id: true,
        name: true,
        path: true,
        url: true,
        beyannameTuru: true,
        fileCategory: true,
        type: true,
        customerId: true,
        year: true,
        month: true,
      },
    });

    // Supabase admin client - signed URL oluşturmak için
    const supabase = createAdminClient();

    // Müşterilere göre grupla
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // Her dosya için signed URL oluştur
    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const customer = customerMap.get(doc.customerId || "");

        // Dosya türünü belirle - fileCategory > type > name fallback
        let docType: "hizmet" | "tahakkuk" | "unknown" = "unknown";
        if (
          doc.fileCategory === "HIZMET_LISTESI" ||
          doc.type === "hizmet_listesi"
        ) {
          docType = "hizmet";
        } else if (
          doc.fileCategory === "SGK_TAHAKKUK" ||
          doc.type === "sgk_tahakkuk"
        ) {
          docType = "tahakkuk";
        }

        // Signed URL oluştur (1 saat geçerli)
        let signedUrl = doc.url;
        if (doc.path) {
          const { data } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(doc.path, 3600);
          if (data?.signedUrl) {
            signedUrl = data.signedUrl;
          }
        }

        return {
          documentId: doc.id,
          customerId: doc.customerId,
          customerUnvan: customer?.unvan || "Bilinmiyor",
          customerVkn: customer?.vknTckn || "",
          name: doc.name,
          path: doc.path,
          url: signedUrl,
          type: docType,
          year: doc.year,
          month: doc.month,
        };
      })
    );

    // Müşteri bazında grupla - ARRAY olarak (birden fazla dosya desteği)
    const grouped: Record<
      string,
      {
        customerId: string;
        customerUnvan: string;
        customerVkn: string;
        hizmetler: (typeof docsWithUrls)[0][];
        tahakkuklar: (typeof docsWithUrls)[0][];
        hasFiles: boolean;
      }
    > = {};

    // Önce TÜM müşterileri gruba ekle (dosyası olsun/olmasın)
    for (const customer of customers) {
      grouped[customer.id] = {
        customerId: customer.id,
        customerUnvan: customer.unvan,
        customerVkn: customer.vknTckn,
        hizmetler: [],
        tahakkuklar: [],
        hasFiles: false,
      };
    }

    // Sonra dosyaları ekle
    for (const doc of docsWithUrls) {
      if (!doc.customerId || !grouped[doc.customerId]) continue;

      if (doc.type === "hizmet") {
        grouped[doc.customerId].hizmetler.push(doc);
        grouped[doc.customerId].hasFiles = true;
      } else if (doc.type === "tahakkuk") {
        grouped[doc.customerId].tahakkuklar.push(doc);
        grouped[doc.customerId].hasFiles = true;
      }
    }

    // TÜM müşterileri döndür (dosyası olsun/olmasın)
    // Electron bot dosyası olmayanları "eksik" olarak işaretleyecek
    const groupedCustomers = Object.values(grouped);
    const customersWithFiles = groupedCustomers.filter((g) => g.hasFiles);
    const customersWithoutFiles = groupedCustomers.filter((g) => !g.hasFiles);

    return NextResponse.json({
      success: true,
      year,
      month,
      totalCustomers: groupedCustomers.length,
      customersWithFiles: customersWithFiles.length,
      customersWithoutFiles: customersWithoutFiles.length,
      totalDocuments: documents.length,
      customers: groupedCustomers,
    });
  } catch (error) {
    console.error("[SGK-FILES] Error:", error);
    return NextResponse.json(
      { error: "Dosya listesi alınamadı" },
      { status: 500 }
    );
  }
}
