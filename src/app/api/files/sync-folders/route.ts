import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCustomerFoldersBatch } from "@/lib/file-system";

/**
 * POST /api/files/sync-folders
 * Klasörü olmayan müşteriler için klasör oluşturur
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;

    try {
        // 1. Tüm müşterileri al
        const customers = await prisma.customers.findMany({
            where: { tenantId },
            select: { id: true, unvan: true, sirketTipi: true }
        });

        // 2. Mevcut kök klasörleri al (customerId'ye göre)
        const existingFolders = await prisma.documents.findMany({
            where: {
                tenantId,
                isFolder: true,
                parentId: null,
                customerId: { not: null }
            },
            select: { customerId: true }
        });

        const existingCustomerIds = new Set(existingFolders.map(f => f.customerId));

        // 3. Klasörü olmayan müşterileri filtrele
        const customersWithoutFolders = customers.filter(c => !existingCustomerIds.has(c.id));

        if (customersWithoutFolders.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Tüm müşterilerin klasörleri zaten mevcut",
                stats: { total: customers.length, created: 0, existing: existingFolders.length }
            });
        }

        // 4. Klasörleri oluştur
        const result = await createCustomerFoldersBatch(tenantId, customersWithoutFolders);

        return NextResponse.json({
            success: result.success,
            message: `${result.created} müşteri için klasör oluşturuldu`,
            stats: {
                total: customers.length,
                created: result.created,
                existing: existingFolders.length,
                errors: result.errors
            }
        });
    } catch (error) {
        console.error("[Sync Folders] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
