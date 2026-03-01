import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const customerId = id
    const tenantId = (session.user as any).tenantId
    const { searchParams } = new URL(req.url)
    const parentId = searchParams.get("parentId")

    try {
        // Müşteriye ait dosyaları getir
        const whereClause: any = {
            customerId,
            tenantId,
        }

        // parentId varsa o klasörün içindekileri getir, yoksa root seviyeyi
        if (parentId && parentId !== "null" && parentId !== "root") {
            whereClause.parentId = parentId
        } else {
            whereClause.parentId = null
        }

        const items = await prisma.documents.findMany({
            where: whereClause,
            orderBy: [
                { isFolder: "desc" },
                { name: "asc" },
            ],
            select: {
                id: true,
                name: true,
                originalName: true,
                type: true,
                mimeType: true,
                size: true,
                isFolder: true,
                parentId: true,
                path: true,
                year: true,
                month: true,
                beyannameTuru: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        // Breadcrumbs hesapla
        let breadcrumbs: { id: string; name: string }[] = []
        if (parentId && parentId !== "null" && parentId !== "root") {
            let currentId: string | null = parentId
            while (currentId) {
                const folder: { id: string; name: string; parentId: string | null } | null = await prisma.documents.findUnique({
                    where: { id: currentId },
                    select: { id: true, name: true, parentId: true },
                })
                if (folder) {
                    breadcrumbs.unshift({ id: folder.id, name: folder.name })
                    currentId = folder.parentId
                } else {
                    break
                }
            }
        }

        // Klasör içindeki dosya sayısını hesapla (her klasör için)
        const foldersWithCounts = await Promise.all(
            items.map(async (item) => {
                if (item.isFolder) {
                    const childCount = await prisma.documents.count({
                        where: {
                            parentId: item.id,
                            tenantId,
                        },
                    })
                    return { ...item, childCount }
                }
                return { ...item, childCount: 0 }
            })
        )

        // Toplam dosya ve klasör sayısı (bu müşteriye ait)
        const stats = await prisma.documents.groupBy({
            by: ["isFolder"],
            where: { customerId, tenantId },
            _count: true,
        })

        const totalFolders = stats.find((s) => s.isFolder)?._count || 0
        const totalFiles = stats.find((s) => !s.isFolder)?._count || 0

        return NextResponse.json({
            items: foldersWithCounts,
            breadcrumbs,
            stats: {
                totalFolders,
                totalFiles,
                total: totalFolders + totalFiles,
            },
        })
    } catch (error) {
        console.error("Error fetching customer documents:", error)
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
}
