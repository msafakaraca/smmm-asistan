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

// En çok kullanılan beyanname türleri (varsayılan olarak aktif)
const DEFAULT_BEYANNAME_TURLERI = [
    { kod: "KDV1", aciklama: "Katma Değer Vergisi Beyannamesi 1", kisaAd: "KDV1", kategori: "KDV", siraNo: 1 },
    { kod: "KDV2", aciklama: "Katma Değer Vergisi Beyannamesi 2", kisaAd: "KDV2", kategori: "KDV", siraNo: 2 },
    { kod: "KDV9015", aciklama: "Katma Değer Vergisi Tevkifatı", kisaAd: "KDV9015", kategori: "KDV", siraNo: 3 },
    { kod: "MUHSGK", aciklama: "Muhtasar ve Prim Hizmet Beyannamesi", kisaAd: "MUH/SGK", kategori: "Muhtasar", siraNo: 4 },
    { kod: "MUH", aciklama: "Muhtasar Beyanname", kisaAd: "MUH", kategori: "Muhtasar", siraNo: 5 },
    { kod: "GELIR", aciklama: "Yıllık Gelir Vergisi Beyannamesi", kisaAd: "GV", kategori: "Gelir", siraNo: 6 },
    { kod: "GGECICI", aciklama: "Gelir Geçici Vergi Beyannamesi", kisaAd: "GVG", kategori: "Gelir", siraNo: 7 },
    { kod: "KURUMLAR", aciklama: "Kurumlar Vergisi Beyannamesi", kisaAd: "KV", kategori: "Kurumlar", siraNo: 8 },
    { kod: "KGECICI", aciklama: "Kurum Geçici Vergi Beyannamesi", kisaAd: "KVG", kategori: "Kurumlar", siraNo: 9 },
    { kod: "FORMBA", aciklama: "Form BA", kisaAd: "BA", kategori: "Formlar", siraNo: 10 },
    { kod: "FORMBS", aciklama: "Form BS", kisaAd: "BS", kategori: "Formlar", siraNo: 11 },
    { kod: "DAMGA", aciklama: "Damga Vergisi Beyannamesi", kisaAd: "DV", kategori: "Damga", siraNo: 12 },
    { kod: "TURIZM", aciklama: "Turizm Payı Beyannamesi", kisaAd: "TURZ", kategori: "Diğer", siraNo: 13 },
    { kod: "KONAKLAMA", aciklama: "Konaklama Vergisi Beyannamesi", kisaAd: "KONK", kategori: "Diğer", siraNo: 14 },
    { kod: "BASIT", aciklama: "Basit Usul Ticari Kazanç Beyannamesi", kisaAd: "BASIT", kategori: "Gelir", siraNo: 15 },
    { kod: "GMSI", aciklama: "Gayrimenkul Sermaye İradı Beyannamesi", kisaAd: "GMSI", kategori: "Gelir", siraNo: 16 },
];

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
