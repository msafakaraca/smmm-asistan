import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "crypto";

const donemEnum = z.enum(["15gunluk", "aylik", "3aylik", "6aylik", "yillik", "dilekce"]);

// Toplu kaydetme: her müşterinin tam beyannameAyarlari objesi
const bulkSaveSchema = z.object({
    data: z.record(
        z.string().uuid(),
        z.record(z.string(), donemEnum)
    ),
});

// Beyanname türü → Grup adı mapping
const BEYANNAME_LABEL_MAP: Record<string, string> = {
    KDV1: "KDV 1",
    KDV2: "KDV 2",
    MUHSGK: "MUHSGK",
    GGECICI: "Geçici (Gelir)",
    KGECICI: "Geçici (Kurumlar)",
    YILLIKGELIR: "Yıllık Gelir",
    YILLIKKURUMLAR: "Yıllık Kurumlar",
    DAMGA: "Damga",
    BA: "BA",
    BS: "BS",
    KONAKLAMA: "Konaklama",
    TURIZM: "Turizm",
    SORUMLU: "Sorumlu KDV",
    KDV9015: "KDV Tevkifat",
    INDIRIMLI: "İndirimli Oran",
};

// Her beyanname türü için sabit renk
const BEYANNAME_GROUP_COLORS: Record<string, string> = {
    KDV1: "#3B82F6",
    KDV2: "#6366F1",
    MUHSGK: "#F59E0B",
    GGECICI: "#10B981",
    KGECICI: "#8B5CF6",
    YILLIKGELIR: "#059669",
    YILLIKKURUMLAR: "#7C3AED",
    DAMGA: "#EF4444",
    BA: "#06B6D4",
    BS: "#0891B2",
    KONAKLAMA: "#EC4899",
    TURIZM: "#D946EF",
    SORUMLU: "#F97316",
    KDV9015: "#14B8A6",
    INDIRIMLI: "#84CC16",
};

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

        // ── Otomatik Grup Senkronizasyonu ──
        await syncBeyannameGroups(tenantId);

        return NextResponse.json({ success: true, count: customerIds.length });
    } catch (error) {
        console.error("Beyanname ayarları güncellenirken hata:", error);
        return NextResponse.json(
            { error: "Beyanname ayarları kaydedilirken hata oluştu" },
            { status: 500 }
        );
    }
}

/**
 * Beyanname türlerine göre otomatik müşteri gruplarını senkronize eder.
 * - Her beyanname türü için otomatik grup oluşturur/günceller
 * - Manuel eklenen üyelere dokunmaz (source="manual")
 * - Otomatik üyeleri (source="auto") beyanname atamasına göre ekler/çıkarır
 * - Üyesi kalmayan otomatik grupları siler
 */
async function syncBeyannameGroups(tenantId: string) {
    // 1. Tüm aktif müşterilerin beyannameAyarlari'nı çek
    const allCustomers = await prisma.customers.findMany({
        where: { tenantId, status: "active" },
        select: { id: true, beyannameAyarlari: true },
    });

    // 2. Tür → Müşteri ID'leri map'i oluştur
    const typeToCustomerIds = new Map<string, string[]>();
    for (const customer of allCustomers) {
        const ayarlar = (customer.beyannameAyarlari || {}) as Record<string, string>;
        for (const kod of Object.keys(ayarlar)) {
            if (!typeToCustomerIds.has(kod)) {
                typeToCustomerIds.set(kod, []);
            }
            typeToCustomerIds.get(kod)!.push(customer.id);
        }
    }

    // 3. Mevcut autoManaged grupları çek (üyeleriyle birlikte)
    const existingAutoGroups = await prisma.customer_groups.findMany({
        where: { tenantId, autoManaged: true },
        include: {
            customer_group_members: {
                select: { id: true, customerId: true, source: true },
            },
        },
    });

    // beyannameTypeCode → group map
    const groupByTypeCode = new Map<string, typeof existingAutoGroups[number]>();
    for (const group of existingAutoGroups) {
        if (group.beyannameTypeCode) {
            groupByTypeCode.set(group.beyannameTypeCode, group);
        }
    }

    // 4. Her beyanname türü için senkronize et
    const processedCodes = new Set<string>();

    for (const [kod, customerIds] of typeToCustomerIds) {
        if (customerIds.length === 0) continue;
        processedCodes.add(kod);

        const customerIdSet = new Set(customerIds);
        const existingGroup = groupByTypeCode.get(kod);

        if (existingGroup) {
            // Grup var — auto üyeleri senkronize et
            const allMemberCustomerIds = new Set(
                existingGroup.customer_group_members.map(m => m.customerId)
            );
            const autoMembers = existingGroup.customer_group_members.filter(m => m.source === "auto");
            const autoMemberCustomerIds = new Set(autoMembers.map(m => m.customerId));

            // Eklenecekler: beyannamesi var ama grupta yok (ne auto ne manual)
            const toAdd = customerIds.filter(id => !allMemberCustomerIds.has(id));

            // Çıkarılacaklar: auto olarak eklenmişti ama artık beyannamesi yok
            const toRemoveIds = autoMembers
                .filter(m => !customerIdSet.has(m.customerId))
                .map(m => m.id);

            const promises: Promise<unknown>[] = [];

            if (toAdd.length > 0) {
                promises.push(
                    prisma.customer_group_members.createMany({
                        data: toAdd.map(customerId => ({
                            id: randomUUID(),
                            groupId: existingGroup.id,
                            customerId,
                            tenantId,
                            source: "auto",
                        })),
                    })
                );
            }

            if (toRemoveIds.length > 0) {
                promises.push(
                    prisma.customer_group_members.deleteMany({
                        where: { id: { in: toRemoveIds } },
                    })
                );
            }

            if (promises.length > 0) {
                await Promise.all(promises);
            }
        } else {
            // Grup yok — oluştur
            const label = BEYANNAME_LABEL_MAP[kod] || kod;
            const groupName = `${label} Mükellefler`;
            const color = BEYANNAME_GROUP_COLORS[kod] || "#3B82F6";
            const description = `${label} Beyannamesi verilecek mükellefler grubu`;

            // İsim çakışması kontrolü
            const nameExists = await prisma.customer_groups.findUnique({
                where: { tenantId_name: { tenantId, name: groupName } },
            });

            if (nameExists) {
                // Manuel oluşturulmuş aynı isimli grup var — atla
                continue;
            }

            const groupId = randomUUID();
            await prisma.customer_groups.create({
                data: {
                    id: groupId,
                    name: groupName,
                    description,
                    color,
                    autoManaged: true,
                    beyannameTypeCode: kod,
                    beyannameTypes: [kod],
                    tenantId,
                    updatedAt: new Date(),
                },
            });

            await prisma.customer_group_members.createMany({
                data: customerIds.map(customerId => ({
                    id: randomUUID(),
                    groupId,
                    customerId,
                    tenantId,
                    source: "auto",
                })),
            });
        }
    }

    // 5. Artık hiçbir müşterisi kalmayan auto grupları temizle
    for (const group of existingAutoGroups) {
        if (!group.beyannameTypeCode || processedCodes.has(group.beyannameTypeCode)) {
            continue;
        }

        // Bu tür artık hiçbir müşteriye atanmamış
        const autoMemberIds = group.customer_group_members
            .filter(m => m.source === "auto")
            .map(m => m.id);

        if (autoMemberIds.length > 0) {
            await prisma.customer_group_members.deleteMany({
                where: { id: { in: autoMemberIds } },
            });
        }

        // Kalan üye (manuel) var mı?
        const manualCount = group.customer_group_members.filter(m => m.source !== "auto").length;
        if (manualCount === 0) {
            await prisma.customer_groups.delete({
                where: { id: group.id },
            });
        }
    }
}
