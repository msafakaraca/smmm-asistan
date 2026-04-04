import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { toTitleCase } from "@/lib/utils/text";
import { ensureCustomerFolder } from "@/lib/file-system";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";

// GET /api/customers
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const type = searchParams.get("type");
        const status = searchParams.get("status");
        const fields = searchParams.get("fields"); // "minimal" for combobox

        const where: any = {
            tenantId: session.user.tenantId,
        };

        // Search filter (Unvan or VKN)
        if (search) {
            where.OR = [
                { unvan: { contains: search, mode: "insensitive" } },
                { vknTckn: { contains: search } },
            ];
        }

        // Type filter
        if (type && type !== "all") {
            where.sirketTipi = type;
        }

        // Status filter
        if (status && status !== "all") {
            where.status = status;
        }

        // Minimal fields for combobox/select (much faster)
        if (fields === "minimal") {
            const customers = await prisma.customers.findMany({
                where,
                select: {
                    id: true,
                    unvan: true,
                    kisaltma: true,
                    vknTckn: true,
                    sirketTipi: true,
                    siraNo: true,
                    // Credential flags (sadece varlık kontrolü, değerler gönderilmiyor)
                    gibKodu: true,
                    gibSifre: true,
                    edevletTckn: true,
                    edevletSifre: true,
                    turmobKullaniciAdi: true,
                    turmobSifre: true,
                    sgkKullaniciAdi: true,
                    sgkSistemSifresi: true,
                },
                orderBy: [
                    { sirketTipi: 'asc' },
                    { siraNo: 'asc' },
                    { unvan: 'asc' },
                ],
            });

            // Credential değerlerini gönderme, sadece flag'leri gönder
            const customersWithFlags = customers.map(c => ({
                id: c.id,
                unvan: c.unvan,
                kisaltma: c.kisaltma,
                vknTckn: c.vknTckn,
                sirketTipi: c.sirketTipi,
                siraNo: c.siraNo,
                hasGibCredentials: !!(c.gibKodu && c.gibSifre),
                hasEdevletCredentials: !!(c.edevletTckn && c.edevletSifre),
                hasTurmobCredentials: !!(c.turmobKullaniciAdi && c.turmobSifre),
                hasSgkCredentials: !!(c.sgkKullaniciAdi && c.sgkSistemSifresi),
            }));

            return NextResponse.json(customersWithFlags);
        }

        const customers = await prisma.customers.findMany({
            where,
            // Don't select sensitive encrypted fields
            select: {
                id: true,
                unvan: true,
                kisaltma: true,
                vknTckn: true,
                tcKimlikNo: true,
                vergiKimlikNo: true,
                vergiDairesi: true,
                sirketTipi: true,
                email: true,
                telefon1: true,
                status: true,
                updatedAt: true,
                createdAt: true,
                // Türmob fields
                siraNo: true,
                sozlesmeNo: true,
                sozlesmeTarihi: true,
                // Verilmeyecek beyannameler (kalıcı muafiyet)
                verilmeyecekBeyannameler: true,
            },
            orderBy: [
                { sirketTipi: 'asc' },
                { siraNo: 'asc' },
                { unvan: 'asc' },
            ],
        });

        return NextResponse.json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        return NextResponse.json(
            { error: "Müşteriler yüklenirken bir hata oluştu" },
            { status: 500 }
        );
    }
}

// POST /api/customers
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation
        if (!body.unvan || !body.vknTckn) {
            return NextResponse.json(
                { error: "Ünvan ve VKN/TCKN zorunludur" },
                { status: 400 }
            );
        }

        // Check duplicate VKN for this tenant
        const existing = await prisma.customers.findFirst({
            where: {
                tenantId: session.user.tenantId,
                vknTckn: body.vknTckn,
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Bu VKN/TCKN ile kayıtlı bir müşteri zaten var" },
                { status: 400 }
            );
        }

        // Encrypt credentials if provided
        const gibKodu = body.gibKodu ? encrypt(body.gibKodu) : null;
        const gibSifre = body.gibSifre ? encrypt(body.gibSifre) : null;
        const gibParola = body.gibParola ? encrypt(body.gibParola) : null;

        // Create customer
        const customer = await prisma.customers.create({
            data: {
                ...body,
                unvan: toTitleCase(body.unvan),
                gibKodu,
                gibSifre,
                gibParola,
                // Ensure tenant is set from session
                tenantId: session.user.tenantId,
            },
        });

        // Create customer folders (non-blocking)
        try {
            await ensureCustomerFolder(
                session.user.tenantId,
                customer.id,
                customer.unvan,
                customer.sirketTipi || 'firma'
            );
        } catch (folderError) {
            console.error("[Customers API] Folder creation error:", folderError);
            // Don't fail the customer creation if folder creation fails
        }

        // Audit log
        await auditLog.create(
            { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
            "customers",
            customer.id,
            { unvan: customer.unvan, vknTckn: customer.vknTckn }
        );

        invalidateDashboard(session.user.tenantId, ['stats', 'alerts', 'declaration-stats']);

        return NextResponse.json(customer);

    } catch (error) {
        console.error("Error creating customer:", error);
        return NextResponse.json(
            { error: "Müşteri oluşturulurken bir hata oluştu" },
            { status: 500 }
        );
    }
}

// PATCH /api/customers - Inline field updates (siraNo, unvan, sortOrder)
export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenantId = session.user.tenantId;
        const body = await request.json();
        const { id, field, value, reorder, renumberAll } = body;

        // Renumber all customers starting from 1
        if (renumberAll) {
            const customers = await prisma.customers.findMany({
                where: { tenantId },
                orderBy: [
                    { sirketTipi: 'asc' },
                    { siraNo: 'asc' },
                    { unvan: 'asc' }
                ],
                select: { id: true }
            });

            // Update all siraNo values sequentially
            await Promise.all(
                customers.map((customer, index) =>
                    prisma.customers.update({
                        where: { id: customer.id },
                        data: { siraNo: String(index + 1) }
                    })
                )
            );

            return NextResponse.json({ success: true, message: "Tüm sıra numaraları güncellendi" });
        }

        // Reorder operation - swap two customers
        if (reorder) {
            const { sourceId, targetId } = reorder;

            // Get both customers
            const [source, target] = await Promise.all([
                prisma.customers.findUnique({ where: { id: sourceId }, select: { siraNo: true } }),
                prisma.customers.findUnique({ where: { id: targetId }, select: { siraNo: true } })
            ]);

            if (!source || !target) {
                return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
            }

            // Swap siraNo values
            await Promise.all([
                prisma.customers.update({
                    where: { id: sourceId },
                    data: { siraNo: target.siraNo }
                }),
                prisma.customers.update({
                    where: { id: targetId },
                    data: { siraNo: source.siraNo }
                })
            ]);

            return NextResponse.json({ success: true, message: "Sıralama güncellendi" });
        }

        // Single field update
        if (!id || !field) {
            return NextResponse.json(
                { error: "id ve field alanları gerekli" },
                { status: 400 }
            );
        }

        // Allowed fields for inline edit
        const allowedFields = ["siraNo", "unvan"];
        if (!allowedFields.includes(field)) {
            return NextResponse.json(
                { error: "Bu alan düzenlenemez" },
                { status: 400 }
            );
        }

        // Verify customer belongs to tenant
        const customer = await prisma.customers.findFirst({
            where: { id, tenantId }
        });

        if (!customer) {
            return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
        }

        // Smart insert logic for siraNo - shift others to make room
        if (field === "siraNo" && value) {
            const newSiraNo = parseInt(value);
            const oldSiraNo = customer.siraNo ? parseInt(customer.siraNo) : null;

            if (!isNaN(newSiraNo)) {
                // Get all customers sorted by siraNo
                const allCustomers = await prisma.customers.findMany({
                    where: { tenantId, id: { not: id } },
                    select: { id: true, siraNo: true },
                    orderBy: { siraNo: 'asc' }
                });

                // Shift customers to make room
                const updates = allCustomers
                    .filter(c => c.siraNo && parseInt(c.siraNo) >= newSiraNo)
                    .map(c =>
                        prisma.customers.update({
                            where: { id: c.id },
                            data: { siraNo: String(parseInt(c.siraNo!) + 1) }
                        })
                    );

                if (updates.length > 0) {
                    await Promise.all(updates);
                }
            }
        }

        // Update the field
        const finalValue = field === "unvan" ? toTitleCase(value) : value;
        const updated = await prisma.customers.update({
            where: { id },
            data: { [field]: finalValue }
        });

        return NextResponse.json(updated);

    } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json(
            { error: "Müşteri güncellenirken bir hata oluştu" },
            { status: 500 }
        );
    }
}

// DELETE /api/customers - Delete a customer
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Müşteri ID gerekli" }, { status: 400 });
        }

        // Verify customer belongs to tenant
        const customer = await prisma.customers.findFirst({
            where: { id, tenantId: session.user.tenantId }
        });

        if (!customer) {
            return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
        }

        // Delete related records first (BeyannameTakip)
        await prisma.beyanname_takip.deleteMany({
            where: { customerId: id }
        });

        // Delete the customer
        await prisma.customers.delete({
            where: { id }
        });

        // Audit log
        await auditLog.delete(
            { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
            "customers",
            id,
            { unvan: customer.unvan, vknTckn: customer.vknTckn }
        );

        invalidateDashboard(session.user.tenantId, ['stats', 'alerts', 'declaration-stats']);

        return NextResponse.json({ success: true, message: "Müşteri silindi" });

    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json(
            { error: "Müşteri silinirken bir hata oluştu" },
            { status: 500 }
        );
    }
}
