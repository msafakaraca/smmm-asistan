import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const tenantId = (session.user as any).tenantId

        // Delete related records first to avoid foreign key constraints

        // 1. First, break ALL parent references in tenant's documents
        // This is necessary because child documents may reference parent documents
        // that we're trying to delete, causing foreign key constraint violations
        await prisma.documents.updateMany({
            where: {
                tenantId: tenantId
            },
            data: {
                parentId: null
            }
        })

        // 2. Now delete all documents related to customers
        await prisma.documents.deleteMany({
            where: {
                tenantId: tenantId,
                customerId: { not: null }
            }
        })

        // 3. Delete all beyanname takip records
        await prisma.beyanname_takip.deleteMany({
            where: {
                tenantId: tenantId
            }
        })

        // 4. Now delete all customers for this tenant
        const result = await prisma.customers.deleteMany({
            where: {
                tenantId: tenantId
            }
        })

        return NextResponse.json({
            success: true,
            count: result.count,
            message: `${result.count} mükellef silindi`
        })
    } catch (error) {
        console.error("Error deleting all customers:", error)
        return NextResponse.json({ error: "Failed to delete customers" }, { status: 500 })
    }
}
