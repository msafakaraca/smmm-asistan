import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";

// GET /api/customers/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const customer = await prisma.customers.findUnique({
            where: {
                id: id,
                tenantId: session.user.tenantId,
            },
            select: {
                id: true,
                unvan: true,
                kisaltma: true,
                vknTckn: true,
                vergiKimlikNo: true,
                tcKimlikNo: true,
                vergiDairesi: true,
                sirketTipi: true,
                faaliyetKodu: true,
                email: true,
                telefon1: true,
                telefon2: true,
                adres: true,
                yetkiliKisi: true,
                status: true,
                notes: true,
                siraNo: true,
                sozlesmeNo: true,
                sozlesmeTarihi: true,
                updatedAt: true,
                createdAt: true,
            },
        });

        if (!customer) {
            return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
        }

        return NextResponse.json(customer);

    } catch (error) {
        console.error("Error fetching customer:", error);
        return NextResponse.json(
            { error: "Müşteri bilgileri alınırken hata oluştu" },
            { status: 500 }
        );
    }
}

// PUT /api/customers/[id]
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { gibSifre, gibParola, gibKodu, ...otherData } = body;

        const updateData: any = { ...otherData };

        if (gibKodu) updateData.gibKodu = encrypt(gibKodu);
        if (gibSifre) updateData.gibSifre = encrypt(gibSifre);
        if (gibParola) updateData.gibParola = encrypt(gibParola);

        const customer = await prisma.customers.update({
            where: {
                id: id,
                tenantId: session.user.tenantId,
            },
            data: updateData,
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
            "customers",
            id,
            { unvan: customer.unvan }
        );

        invalidateDashboard(session.user.tenantId, ['stats', 'alerts']);

        return NextResponse.json(customer);

    } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json(
            { error: "Güncelleme sırasında hata oluştu" },
            { status: 500 }
        );
    }
}

// DELETE /api/customers/[id]
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get customer info before deletion for audit
        const customer = await prisma.customers.findFirst({
            where: { id, tenantId: session.user.tenantId },
            select: { unvan: true, vknTckn: true }
        });

        await prisma.customers.delete({
            where: {
                id: id,
                tenantId: session.user.tenantId,
            },
        });

        // Audit log
        if (customer) {
            await auditLog.delete(
                { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
                "customers",
                id,
                { unvan: customer.unvan, vknTckn: customer.vknTckn }
            );
        }

        invalidateDashboard(session.user.tenantId, ['stats', 'alerts', 'declaration-stats']);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json(
            { error: "Silme işlemi başarısız oldu" },
            { status: 500 }
        );
    }
}
