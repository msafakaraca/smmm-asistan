import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { toTitleCase } from "@/lib/utils/text"
import { ensureCustomerFolder } from "@/lib/file-system"
import { auditLog } from "@/lib/audit"
import { invalidateDashboard } from "@/lib/dashboard-invalidation"

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { customers } = body

        if (!Array.isArray(customers) || customers.length === 0) {
            return NextResponse.json({ error: "No customers provided" }, { status: 400 })
        }

        const tenantId = (session.user as any).tenantId

        let count = 0

        // Use transaction or createMany? createMany is safer for errors if we want partial success? 
        // No, createMany is good for bulk. But we need to handle duplicates (upsert isn't supported in createMany for MongoDB easily in same way).
        // Let's loop for now to be safe and handle individual errors or use createMany with skipDuplicates if possible (prisma doesn't support skipDuplicates for createMany on all dbs, and we have custom logic)
        // Actually for MongoDB createMany is supported. But validation...
        // Let's try createMany first, but better check for duplicates manually or let it fail?
        // Let's iterate and upsert to be safe especially with unique constraints mainly on vknTckn.

        for (const customer of customers) {
            // Check if exists
            const existing = await prisma.customers.findFirst({
                where: {
                    tenantId,
                    vknTckn: customer.vknTckn
                }
            })

            if (!existing) {
                const newCustomer = await prisma.customers.create({
                    data: {
                        tenantId,
                        unvan: toTitleCase(customer.unvan),
                        vknTckn: customer.vknTckn,
                        vergiDairesi: customer.vergiDairesi,
                        sirketTipi: customer.sirketTipi || "sahis",
                        email: customer.email,
                        telefon1: customer.telefon1,
                        kisaltma: customer.kisaltma,
                        adres: customer.adres,
                        status: "active"
                    }
                })

                // Create customer folders (non-blocking)
                try {
                    await ensureCustomerFolder(
                        tenantId,
                        newCustomer.id,
                        newCustomer.unvan,
                        newCustomer.sirketTipi || 'sahis'
                    )
                } catch (folderError) {
                    console.error("[Excel Import] Folder creation error:", folderError)
                }

                count++
            }
        }

        // Audit log - bulk import
        if (count > 0) {
            await auditLog.bulk(
                { id: session.user.id || "", email: session.user.email || "", tenantId },
                "customers",
                "IMPORT",
                count,
                { source: "excel" }
            )
        }

        invalidateDashboard(tenantId, ['stats', 'alerts', 'declaration-stats']);

        return NextResponse.json({ success: true, count })
    } catch (error) {
        console.error("Error importing customers:", error)
        return NextResponse.json({ error: "Failed to import customers" }, { status: 500 })
    }
}
