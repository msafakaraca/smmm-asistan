import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import JSZip from "jszip";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentIds, groupByCustomer = false } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "No documents selected" },
        { status: 400 }
      );
    }

    // Dökümanları getir
    const documents = await prisma.documents.findMany({
      where: {
        id: { in: documentIds },
        tenantId: user.tenantId,
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
          },
        },
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No valid documents found" },
        { status: 400 }
      );
    }

    // ZIP oluştur
    const zip = new JSZip();

    if (groupByCustomer) {
      // Müşteri bazında klasörle
      const customerGroups = new Map<string, typeof documents>();
      for (const doc of documents) {
        if (!doc.customers) continue;
        const existing = customerGroups.get(doc.customers.id) || [];
        existing.push(doc);
        customerGroups.set(doc.customers.id, existing);
      }

      for (const [, customerDocs] of customerGroups) {
        const customer = customerDocs[0].customers;
        if (!customer) continue;

        // Klasör adı - Tam ünvan kullan, Türkçe karakterleri koru, sadece geçersiz karakterleri temizle
        const folderName = customer.unvan
          .replace(/[<>:"/\\|?*]/g, '')
          .trim();

        const folder = zip.folder(folderName);

        for (const doc of customerDocs) {
          if (doc.path && folder) {
            const storagePath = doc.path.startsWith('uploads/')
              ? path.join(process.cwd(), 'public', doc.path)
              : path.join(process.cwd(), 'storage', doc.path);

            if (fs.existsSync(storagePath)) {
              const fileContent = fs.readFileSync(storagePath);
              folder.file(doc.name, fileContent);
            }
          }
        }
      }
    } else {
      // Düz liste
      for (const doc of documents) {
        if (doc.path) {
          const storagePath = doc.path.startsWith('uploads/')
            ? path.join(process.cwd(), 'public', doc.path)
            : path.join(process.cwd(), 'storage', doc.path);

          if (fs.existsSync(storagePath)) {
            const fileContent = fs.readFileSync(storagePath);
            zip.file(doc.name, fileContent);
          }
        }
      }
    }

    // ZIP'i oluştur
    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Dosya adı oluştur
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `beyannameler_${dateStr}.zip`;

    // Response döndür - Buffer'ı Uint8Array'e çevir
    return new NextResponse(new Uint8Array(zipContent), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipContent.length),
      },
    });
  } catch (error) {
    console.error("[Bulk Download] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
