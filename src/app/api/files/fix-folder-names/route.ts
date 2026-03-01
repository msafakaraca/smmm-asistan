import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/files/fix-folder-names
 *
 * Mükellef klasörlerinin adlarını tam ünvan ile günceller.
 * Root seviyedeki klasörleri (parentId: null) customer unvan'ı ile eşleştirir.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    // 1. Tüm müşterileri al
    const customers = await prisma.customers.findMany({
      where: { tenantId },
      select: { id: true, unvan: true, kisaltma: true }
    });

    // 2. Root seviyedeki müşteri klasörlerini al (customerId olan)
    const customerFolders = await prisma.documents.findMany({
      where: {
        tenantId,
        isFolder: true,
        customerId: { not: null },
        parentId: null // Root seviye
      },
      select: { id: true, name: true, customerId: true }
    });

    let updatedCount = 0;
    const updates: { id: string; oldName: string; newName: string }[] = [];

    // 3. Her klasörün adını müşterinin tam ünvanı ile güncelle
    for (const folder of customerFolders) {
      const customer = customers.find(c => c.id === folder.customerId);
      if (!customer) continue;

      // Tam ünvan kullan, geçersiz dosya karakterlerini temizle
      const newName = customer.unvan.replace(/[<>:"/\\|?*]/g, '').trim();

      // Eğer isim farklıysa güncelle
      if (folder.name !== newName) {
        await prisma.documents.update({
          where: { id: folder.id },
          data: { name: newName }
        });
        updates.push({
          id: folder.id,
          oldName: folder.name,
          newName: newName
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} klasör adı güncellendi`,
      totalFolders: customerFolders.length,
      updatedCount,
      updates
    });

  } catch (error) {
    console.error("[Fix Folder Names] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
