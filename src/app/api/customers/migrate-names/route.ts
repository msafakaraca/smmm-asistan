import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toTitleCase } from "@/lib/utils/text";

// POST /api/customers/migrate-names - Migrate all customer names to Title Case
export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenantId = session.user.tenantId;

        // Get all customers for this tenant
        const customers = await prisma.customers.findMany({
            where: { tenantId },
            select: { id: true, unvan: true }
        });

        let updated = 0;

        // Update each customer's unvan to Title Case
        for (const customer of customers) {
            const newUnvan = toTitleCase(customer.unvan);

            // Only update if different
            if (newUnvan !== customer.unvan) {
                await prisma.customers.update({
                    where: { id: customer.id },
                    data: { unvan: newUnvan }
                });
                updated++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `${updated} mükellef ismi Title Case formatına dönüştürüldü.`,
            total: customers.length,
            updated
        });

    } catch (error) {
        console.error("Error migrating names:", error);
        return NextResponse.json(
            { error: "Migrasyon sırasında hata oluştu" },
            { status: 500 }
        );
    }
}
