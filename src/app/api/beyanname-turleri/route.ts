import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// Zod Schemas
const createBeyannameTuruSchema = z.object({
    kod: z.string().min(1, "Kod gerekli").max(20),
    aciklama: z.string().min(1, "Açıklama gerekli").max(200),
    kisaAd: z.string().max(8).optional(),
    kategori: z.string().max(50).optional(),
});

const updateBeyannameTuruSchema = z.object({
    id: z.string().uuid("Geçersiz ID"),
    aktif: z.boolean().optional(),
    siraNo: z.number().int().min(0).optional(),
});

// Hattat referanslı 23 beyanname türü (varsayılan olarak aktif)
const DEFAULT_BEYANNAME_TURLERI = [
    { kod: "GELIR",      aciklama: "Gelir Vergisi Beyannamesi",                  kisaAd: "GV",      kategori: "Gelir",    siraNo: 1,  donemSecenekleri: ["yillik"] },
    { kod: "KDV1",       aciklama: "KDV Beyannamesi 1",                          kisaAd: "KDV1",    kategori: "KDV",      siraNo: 2,  donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "KDV2",       aciklama: "KDV Beyannamesi 2",                          kisaAd: "KDV2",    kategori: "KDV",      siraNo: 3,  donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "DAMGA",      aciklama: "Damga Vergisi Beyannamesi",                  kisaAd: "DV",      kategori: "Damga",    siraNo: 4,  donemSecenekleri: ["aylik"] },
    { kod: "GGECICI",    aciklama: "Gelir Geçici Vergi Beyannamesi",             kisaAd: "GVG",     kategori: "Gelir",    siraNo: 5,  donemSecenekleri: ["3aylik"] },
    { kod: "KGECICI",    aciklama: "Kurum Geçici Vergi Beyannamesi",             kisaAd: "KVG",     kategori: "Kurumlar", siraNo: 6,  donemSecenekleri: ["3aylik"] },
    { kod: "KURUMLAR",   aciklama: "Kurumlar Vergisi Beyannamesi",               kisaAd: "KV",      kategori: "Kurumlar", siraNo: 7,  donemSecenekleri: ["yillik"] },
    { kod: "OTV",        aciklama: "ÖTV Beyannamesi",                            kisaAd: "ÖTV",     kategori: "ÖTV",      siraNo: 8,  donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "MUHSGK",     aciklama: "Muhtasar ve Prim Hizmet Beyannamesi",        kisaAd: "MUH/SGK", kategori: "Muhtasar", siraNo: 9,  donemSecenekleri: ["aylik", "3aylik", "dilekce"] },
    { kod: "POSET",      aciklama: "Poşet Beyannamesi",                          kisaAd: "POŞET",   kategori: "Diğer",    siraNo: 10, donemSecenekleri: ["aylik", "3aylik", "6aylik"] },
    { kod: "KDV4",       aciklama: "KDV Beyannamesi 4",                          kisaAd: "KDV4",    kategori: "KDV",      siraNo: 11, donemSecenekleri: ["aylik"] },
    { kod: "BASIT",      aciklama: "Basit Usul Ticari Kazanç Beyannamesi",       kisaAd: "BASIT",   kategori: "Gelir",    siraNo: 12, donemSecenekleri: ["yillik"] },
    { kod: "GELIR1001E", aciklama: "Gelir 1001E Beyannamesi",                    kisaAd: "1001E",   kategori: "Gelir",    siraNo: 13, donemSecenekleri: ["yillik"] },
    { kod: "GMSI",       aciklama: "Gayrimenkul Sermaye İradı Beyannamesi",      kisaAd: "GMSI",    kategori: "Gelir",    siraNo: 14, donemSecenekleri: ["yillik"] },
    { kod: "TURIZM",     aciklama: "Turizm Payı Beyannamesi",                    kisaAd: "TURZ",    kategori: "Diğer",    siraNo: 15, donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "MUHSGK2",    aciklama: "Muhtasar ve Prim Hizmet 2",                  kisaAd: "MUH2",    kategori: "Muhtasar", siraNo: 16, donemSecenekleri: ["aylik", "3aylik", "dilekce"] },
    { kod: "OTV3B",      aciklama: "ÖTV 3B Beyannamesi",                         kisaAd: "ÖTV3B",   kategori: "ÖTV",      siraNo: 17, donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "OTV1",       aciklama: "ÖTV 1 Beyannamesi",                          kisaAd: "ÖTV1",    kategori: "ÖTV",      siraNo: 18, donemSecenekleri: ["15gunluk", "aylik", "3aylik"] },
    { kod: "OTV3A",      aciklama: "ÖTV 3A Beyannamesi",                         kisaAd: "ÖTV3A",   kategori: "ÖTV",      siraNo: 19, donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "OTV4",       aciklama: "ÖTV 4 Beyannamesi",                          kisaAd: "ÖTV4",    kategori: "ÖTV",      siraNo: 20, donemSecenekleri: ["aylik", "3aylik"] },
    { kod: "OIV",        aciklama: "ÖİV Beyannamesi",                            kisaAd: "ÖİV",     kategori: "Diğer",    siraNo: 21, donemSecenekleri: ["aylik"] },
    { kod: "KONAKLAMA",  aciklama: "Konaklama Vergisi Beyannamesi",              kisaAd: "KONK",    kategori: "Diğer",    siraNo: 22, donemSecenekleri: ["aylik"] },
    { kod: "KDV9015",    aciklama: "KDV Tevkifat Beyannamesi",                   kisaAd: "9015",    kategori: "KDV",      siraNo: 23, donemSecenekleri: ["aylik"] },
];

// Eski türler — silmek yerine aktif: false yapılacak
const DEPRECATED_KODLAR = ["FORMBA", "FORMBS", "MUH"];

// GET - Tenant için aktif beyanname türlerini getir
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = session.user.tenantId as string;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant bilgisi bulunamadı" }, { status: 403 });
        }

        // Tenant'ın beyanname türlerini getir
        let turler = await prisma.beyanname_turleri.findMany({
            where: { tenantId },
            orderBy: { siraNo: "asc" }
        });

        // Eğer hiç tür yoksa varsayılanları ekle
        if (turler.length === 0) {
            const { randomUUID } = await import("crypto");
            const now = new Date();
            await prisma.beyanname_turleri.createMany({
                data: DEFAULT_BEYANNAME_TURLERI.map(t => ({
                    id: randomUUID(),
                    ...t,
                    tenantId,
                    updatedAt: now
                }))
            });
            turler = await prisma.beyanname_turleri.findMany({
                where: { tenantId },
                orderBy: { siraNo: "asc" }
            });
        } else {
            // Mevcut tenant'lara yeni varsayılan türleri ekle (eksik olanları)
            const existingKods = new Set(turler.map(t => t.kod));
            const missingTypes = DEFAULT_BEYANNAME_TURLERI.filter(t => !existingKods.has(t.kod));
            let needsRefresh = false;

            if (missingTypes.length > 0) {
                const { randomUUID } = await import("crypto");
                const now = new Date();
                const maxSiraNo = Math.max(...turler.map(t => t.siraNo));
                await prisma.beyanname_turleri.createMany({
                    data: missingTypes.map((t, i) => ({
                        id: randomUUID(),
                        ...t,
                        siraNo: maxSiraNo + 1 + i,
                        tenantId,
                        updatedAt: now,
                    })),
                    skipDuplicates: true,
                });
                needsRefresh = true;
            }

            // Eski türleri (FORMBA, FORMBS, MUH) aktif: false yap
            const deprecatedTurler = turler.filter(
                t => DEPRECATED_KODLAR.includes(t.kod) && t.aktif
            );
            if (deprecatedTurler.length > 0) {
                await prisma.beyanname_turleri.updateMany({
                    where: { id: { in: deprecatedTurler.map(t => t.id) }, tenantId },
                    data: { aktif: false },
                });
                needsRefresh = true;
            }

            // Mevcut türlerin donemSecenekleri boşsa DEFAULT'tan doldur
            const defaultMap = new Map(DEFAULT_BEYANNAME_TURLERI.map(t => [t.kod, t]));
            const emptyDonemTurler = turler.filter(
                t => t.donemSecenekleri.length === 0 && defaultMap.has(t.kod)
            );
            for (const tur of emptyDonemTurler) {
                const def = defaultMap.get(tur.kod)!;
                await prisma.beyanname_turleri.update({
                    where: { id: tur.id },
                    data: {
                        donemSecenekleri: def.donemSecenekleri,
                        aciklama: def.aciklama,
                        kisaAd: def.kisaAd,
                        kategori: def.kategori,
                    },
                });
                needsRefresh = true;
            }

            // Mevcut MUHSGK/MUHSGK2 türlerine "dilekce" seçeneği ekle (eksikse)
            const muhsgkTurler = turler.filter(
                t => (t.kod === "MUHSGK" || t.kod === "MUHSGK2") && !t.donemSecenekleri.includes("dilekce")
            );
            for (const tur of muhsgkTurler) {
                await prisma.beyanname_turleri.update({
                    where: { id: tur.id },
                    data: { donemSecenekleri: [...tur.donemSecenekleri, "dilekce"] },
                });
                needsRefresh = true;
            }

            if (needsRefresh) {
                turler = await prisma.beyanname_turleri.findMany({
                    where: { tenantId },
                    orderBy: { siraNo: "asc" }
                });
            }
        }

        return NextResponse.json(turler);
    } catch (error) {
        console.error("Error fetching beyanname türleri:", error);
        return NextResponse.json(
            { error: "Beyanname türleri yüklenirken hata oluştu" },
            { status: 500 }
        );
    }
}

// POST - Yeni beyanname türü ekle (GİB sync sırasında otomatik)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = session.user.tenantId as string;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant bilgisi bulunamadı" }, { status: 403 });
        }

        const body = await req.json();
        const validation = createBeyannameTuruSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }
        const { kod, aciklama, kisaAd, kategori } = validation.data;

        // Mevcut en yüksek sıra numarasını bul
        const maxSira = await prisma.beyanname_turleri.findFirst({
            where: { tenantId },
            orderBy: { siraNo: "desc" },
            select: { siraNo: true }
        });

        const tur = await prisma.beyanname_turleri.upsert({
            where: { tenantId_kod: { tenantId, kod } },
            update: { aciklama, kisaAd, kategori },
            create: {
                tenantId,
                kod,
                aciklama,
                kisaAd: kisaAd || kod.substring(0, 8),
                kategori,
                siraNo: (maxSira?.siraNo || 0) + 1
            }
        });

        // Audit log
        await auditLog.create(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "beyanname_turleri",
            tur.id,
            { kod, aciklama }
        );

        return NextResponse.json(tur);
    } catch (error) {
        console.error("Error creating beyanname türü:", error);
        return NextResponse.json(
            { error: "Beyanname türü eklenirken hata oluştu" },
            { status: 500 }
        );
    }
}

// PUT - Beyanname türlerinin sıralamasını veya aktiflik durumunu güncelle
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = session.user.tenantId as string;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant bilgisi bulunamadı" }, { status: 403 });
        }

        const body = await req.json();
        const validation = updateBeyannameTuruSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }
        const { id, aktif, siraNo } = validation.data;

        // Tenant isolation: Önce kaydın bu tenant'a ait olduğunu doğrula
        const existing = await prisma.beyanname_turleri.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Beyanname türü bulunamadı" }, { status: 404 });
        }

        const tur = await prisma.beyanname_turleri.update({
            where: { id },
            data: {
                ...(aktif !== undefined && { aktif }),
                ...(siraNo !== undefined && { siraNo })
            }
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "beyanname_turleri",
            id,
            { kod: tur.kod, aktif: tur.aktif }
        );

        return NextResponse.json(tur);
    } catch (error) {
        console.error("Error updating beyanname türü:", error);
        return NextResponse.json(
            { error: "Beyanname türü güncellenirken hata oluştu" },
            { status: 500 }
        );
    }
}
