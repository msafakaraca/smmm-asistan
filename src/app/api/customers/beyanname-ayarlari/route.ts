import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const donemEnum = z.enum(["15gunluk", "aylik", "3aylik", "6aylik", "yillik", "dilekce"]);

// Toplu kaydetme: her müşterinin tam beyannameAyarlari objesi
const bulkSaveSchema = z.object({
    data: z.record(
        z.string().uuid(),
        z.record(z.string(), donemEnum)
    ),
});

// GET — Tüm aktif mükelleflerin beyannameAyarlari'nı döner
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as Record<string, unknown>).tenantId as string;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 400 });
        }

        const customers = await prisma.customers.findMany({
            where: { tenantId, status: "active" },
            select: {
                id: true,
                unvan: true,
                kisaltma: true,
                sirketTipi: true,
                siraNo: true,
                beyannameAyarlari: true,
            },
            orderBy: [{ sirketTipi: "asc" }, { siraNo: "asc" }, { unvan: "asc" }],
        });

        return NextResponse.json({ customers });
    } catch (error) {
        console.error("Beyanname ayarları getirilirken hata:", error);
        return NextResponse.json(
            { error: "Beyanname ayarları yüklenirken hata oluştu" },
            { status: 500 }
        );
    }
}

// PATCH — Toplu beyannameAyarlari kaydetme (tek istek, tek transaction)
export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as Record<string, unknown>).tenantId as string;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 400 });
        }

        const body = await req.json();
        const validation = bulkSaveSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { data } = validation.data;
        const customerIds = Object.keys(data);

        if (customerIds.length === 0) {
            return NextResponse.json({ error: "Güncellenecek müşteri yok" }, { status: 400 });
        }

        // Tenant izolasyonu — transaction dışında doğrula (hızlı)
        const validCustomers = await prisma.customers.findMany({
            where: { id: { in: customerIds }, tenantId },
            select: { id: true },
        });
        const validIds = new Set(validCustomers.map(c => c.id));

        const tumAktifTurler = await prisma.beyanname_turleri.findMany({
            where: { tenantId, aktif: true },
            select: { kod: true },
        });
        const tumAktifKodlar = tumAktifTurler.map(t => t.kod);

        // Güncelleme verisini hazırla
        const updates = customerIds
            .filter(id => validIds.has(id))
            .map(customerId => {
                const beyannameAyarlari = data[customerId];
                const atanmisKodlar = new Set(Object.keys(beyannameAyarlari));
                const verilmeyecek = tumAktifKodlar.filter(k => !atanmisKodlar.has(k));
                return { customerId, beyannameAyarlari, verilmeyecek };
            });

        // 10'lu batch'ler halinde güncelle (connection pool taşmasını önle)
        const BATCH_SIZE = 10;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(({ customerId, beyannameAyarlari, verilmeyecek }) =>
                    prisma.customers.update({
                        where: { id: customerId },
                        data: {
                            beyannameAyarlari,
                            verilmeyecekBeyannameler: verilmeyecek,
                        },
                    })
                )
            );
        }

        return NextResponse.json({ success: true, count: customerIds.length });
    } catch (error) {
        console.error("Beyanname ayarları güncellenirken hata:", error);
        return NextResponse.json(
            { error: "Beyanname ayarları kaydedilirken hata oluştu" },
            { status: 500 }
        );
    }
}
