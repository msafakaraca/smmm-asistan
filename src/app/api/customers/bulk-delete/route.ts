import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { auditLog } from "@/lib/audit"

export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { ids } = body

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No IDs provided" }, { status: 400 })
        }

        const tenantId = (session.user as any).tenantId

        // Verify all customers belong to tenant
        const count = await prisma.customers.count({
            where: {
                id: { in: ids },
                tenantId: tenantId
            }
        })

        if (count !== ids.length) {
            return NextResponse.json({ error: "Some customers not found or unauthorized" }, { status: 403 })
        }

        // Delete related records first to avoid foreign key constraints

        // 1. Find all documents related to these customers
        const customerDocuments = await prisma.documents.findMany({
            where: {
                customerId: { in: ids },
                tenantId: tenantId
            },
            select: { id: true }
        })

        const documentIds = customerDocuments.map(d => d.id)

        if (documentIds.length > 0) {
            // Remove parent references from documents that reference these documents
            // This prevents foreign key constraint violations when deleting
            await prisma.documents.updateMany({
                where: {
                    parentId: { in: documentIds }
                },
                data: {
                    parentId: null
                }
            })

            // Also remove parent references from the documents themselves
            await prisma.documents.updateMany({
                where: {
                    id: { in: documentIds }
                },
                data: {
                    parentId: null
                }
            })

            // Now delete all documents
            await prisma.documents.deleteMany({
                where: {
                    id: { in: documentIds }
                }
            })
        }

        // 2. Delete beyanname takip records
        await prisma.beyanname_takip.deleteMany({
            where: {
                customerId: { in: ids },
                tenantId: tenantId
            }
        })

        // 3. Now delete customers
        await prisma.customers.deleteMany({
            where: {
                id: { in: ids },
                tenantId: tenantId
            }
        })

        // Audit log - bulk delete
        await auditLog.bulk(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "customers",
            "BULK_DELETE",
            count,
            { ids }
        )

        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error("Error deleting customers:", error)
        return NextResponse.json({ error: "Failed to delete customers" }, { status: 500 })
    }
}
