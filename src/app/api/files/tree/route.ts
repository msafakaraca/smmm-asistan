import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/files/tree
 *
 * Tüm dosya ve klasörleri tek seferde getirir.
 * Client-side navigasyon için - Windows Explorer gibi anlık açılma.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    // Tüm dosya ve klasörleri tek sorguda getir
    const items = await prisma.documents.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        isFolder: true,
        size: true,
        updatedAt: true,
        color: true,
        parentId: true,
        path: true,
        customers: {
          select: {
            sirketTipi: true
          }
        }
      },
      orderBy: [
        { isFolder: 'desc' },
        { name: 'asc' }
      ]
    });

    // sirketTipi'yi üst seviyeye taşı
    const mappedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      isFolder: item.isFolder,
      size: item.size,
      updatedAt: item.updatedAt,
      color: item.color,
      parentId: item.parentId,
      path: item.path,
      sirketTipi: item.customers?.sirketTipi || null
    }));

    return NextResponse.json({
      items: mappedItems,
      total: mappedItems.length
    });

  } catch (error) {
    console.error("[Files Tree] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
