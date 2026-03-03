import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

// GET - Belirli dönemdeki beyanname takip verilerini getir (Dinamik JSON yapı)
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

        // Dönem için tüm beyanname takip kayıtlarını, müşteri bilgilerini ve beyanname türlerini paralel getir
        const [takipRecords, activeCustomers, beyannameTurleri] = await Promise.all([
            prisma.beyanname_takip.findMany({
                where: { tenantId, year, month },
                select: { id: true, customerId: true, beyannameler: true }
            }),
            prisma.customers.findMany({
                where: { tenantId, status: "active" },
                select: { id: true, verilmeyecekBeyannameler: true, beyannameAyarlari: true }
            }),
            prisma.beyanname_turleri.findMany({
                where: { tenantId, aktif: true },
                select: { kod: true }
            })
        ]);

        // customerId -> beyannameler map'e dönüştür
        const recordMap: Record<string, any> = {};
        for (const record of takipRecords) {
            recordMap[record.customerId] = record.beyannameler || {};
        }

        // Aktif beyanname türü kodlarını set'e çevir
        const aktivTurKodlari = new Set(beyannameTurleri.map(t => t.kod));

        // Her müşteri için varsayılan statüleri hesapla (kayıt olmayan hücreler için)
        for (const customer of activeCustomers) {
            const customerBeyannameler = recordMap[customer.id] || {};
            const verilmeyecekler = (customer.verilmeyecekBeyannameler as string[]) || [];
            const ayarlar = (customer.beyannameAyarlari as Record<string, string>) || {};
            let hasDefaults = false;

            for (const turKod of aktivTurKodlari) {
                // Zaten kayıt varsa atla
                if (customerBeyannameler[turKod]) continue;

                if (verilmeyecekler.includes(turKod)) {
                    customerBeyannameler[turKod] = { status: "gonderilmeyecek" };
                    hasDefaults = true;
                } else if (ayarlar[turKod] === "dilekce") {
                    customerBeyannameler[turKod] = { status: "dilekce_gonderilecek" };
                    hasDefaults = true;
                } else if (ayarlar[turKod]) {
                    customerBeyannameler[turKod] = { status: "onay_bekliyor" };
                    hasDefaults = true;
                }
                // ayarlar'da yoksa "bos" kalır (frontend default)
            }

            if (hasDefaults) {
                recordMap[customer.id] = customerBeyannameler;
            }
        }

        return NextResponse.json(recordMap);
    } catch (error) {
        console.error("Error fetching beyanname takip:", error);
        return NextResponse.json(
            { error: "Beyanname takip verileri yüklenirken hata oluştu" },
            { status: 500 }
        );
    }
}

// PUT - Tek bir hücreyi güncelle
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const body = await req.json();
        const { customerId, year, month, kod, status, meta } = body;

        if (!customerId || !year || !month || !kod || !status) {
            return NextResponse.json(
                { error: "customerId, year, month, kod ve status gerekli" },
                { status: 400 }
            );
        }

        // Mevcut kaydı bul veya oluştur
        const existing = await prisma.beyanname_takip.findUnique({
            where: {
                customerId_year_month: { customerId, year, month }
            }
        });

        const currentBeyannameler = (existing?.beyannameler as any) || {};

        // Güncellenmiş beyannameler
        const updatedBeyannameler = {
            ...currentBeyannameler,
            [kod]: {
                ...(currentBeyannameler[kod] || {}), // Mevcut verileri (meta vb.) koru
                status,
                ...(meta && { meta })
            }
        };

        const record = await prisma.beyanname_takip.upsert({
            where: {
                customerId_year_month: { customerId, year, month }
            },
            update: {
                beyannameler: updatedBeyannameler
            },
            create: {
                tenantId,
                customerId,
                year,
                month,
                beyannameler: updatedBeyannameler
            }
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "beyanname_takip",
            record.id,
            { customerId, year, month, kod, status }
        );

        return NextResponse.json(record);
    } catch (error) {
        console.error("Error updating beyanname takip:", error);
        return NextResponse.json(
            { error: "Beyanname takip güncellenirken hata oluştu" },
            { status: 500 }
        );
    }
}

// POST - Varsayılana dön (tüm kayıtları sıfırla)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const body = await req.json();
        const { action, year, month } = body;

        if (action === "reset") {
            // Belirli dönemdeki tüm kayıtları sıfırla
            const result = await prisma.beyanname_takip.updateMany({
                where: {
                    tenantId,
                    year,
                    month
                },
                data: {
                    beyannameler: {}
                }
            });

            // Audit log
            await auditLog.bulk(
                { id: session.user.id || "", email: session.user.email || "", tenantId },
                "beyanname_takip",
                "BULK_UPDATE",
                result.count,
                { action: "reset", year, month }
            );

            return NextResponse.json({
                success: true,
                message: `${result.count} kayıt sıfırlandı`
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Error resetting beyanname takip:", error);
        return NextResponse.json(
            { error: "Beyanname takip sıfırlanırken hata oluştu" },
            { status: 500 }
        );
    }
}

// DELETE - Belirli dönemdeki tüm beyanname takip kayıtlarını kalıcı olarak sil
export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

        // Delete all records for this tenant and period
        const result = await prisma.beyanname_takip.deleteMany({
            where: {
                tenantId,
                year,
                month
            }
        });

        // Audit log
        await auditLog.bulk(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "beyanname_takip",
            "BULK_DELETE",
            result.count,
            { year, month }
        );

        return NextResponse.json({
            success: true,
            message: `${result.count} kayıt silindi`
        });
    } catch (error) {
        console.error("Error deleting beyanname takip:", error);
        return NextResponse.json(
            { error: "Beyanname takip verileri silinirken hata oluştu" },
            { status: 500 }
        );
    }
}
