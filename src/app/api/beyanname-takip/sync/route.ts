/**
 * Beyanname Takip Sync API
 *
 * Documents tablosundaki beyanname dosyalarını beyanname_takip tablosuyla senkronize eder.
 * Bu API, bot çalıştırıldığında veya manuel olarak çağrılabilir.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyInternalToken } from "@/lib/internal-auth";

// POST - Documents tablosundan beyanname_takip'e senkronize et
export async function POST(req: NextRequest) {
    // Check for internal token first (from server.ts WebSocket handler)
    const internalToken = req.headers.get('X-Internal-Token');

    let tenantId: string;

    if (internalToken) {
        // Internal call from server.ts - JWT token ile doğrulama
        const decoded = verifyInternalToken(internalToken);
        if (!decoded) {
            return NextResponse.json({ error: "Geçersiz internal token" }, { status: 401 });
        }
        tenantId = decoded.tenantId;
        console.log(`[SYNC] Internal call for tenant: ${tenantId}`);
    } else {
        // Normal auth check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        tenantId = (session.user as any).tenantId;
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { year, month } = body;

        console.log(`[SYNC] Starting sync for tenant ${tenantId}${year && month ? ` - ${month}/${year}` : ''}`);

        // 1. Tüm beyanname dosyalarını bul
        const whereClause: any = {
            tenantId,
            isFolder: false,
            mimeType: 'application/pdf',
            year: { not: null },
            month: { not: null },
            customerId: { not: null }
        };

        // Belirli dönem için filtrele (opsiyonel)
        if (year && month) {
            whereClause.year = year;
            whereClause.month = month;
        }

        const documents = await prisma.documents.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                path: true,
                customerId: true,
                vknTckn: true,
                beyannameTuru: true,
                fileCategory: true,
                year: true,
                month: true
            }
        });

        console.log(`[SYNC] Found ${documents.length} documents to process`);

        // 2. customerId + year + month bazında grupla
        const grouped = new Map<string, {
            customerId: string;
            year: number;
            month: number;
            files: typeof documents;
        }>();

        for (const doc of documents) {
            if (!doc.customerId || !doc.year || !doc.month) continue;

            const key = `${doc.customerId}_${doc.year}_${doc.month}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    customerId: doc.customerId,
                    year: doc.year,
                    month: doc.month,
                    files: []
                });
            }
            grouped.get(key)!.files.push(doc);
        }

        console.log(`[SYNC] ${grouped.size} unique customer-period combinations`);

        // 3. Her grup için beyanname_takip güncelle
        let updated = 0;
        let created = 0;
        const updatedCustomers: string[] = [];

        for (const [key, data] of grouped) {
            const { customerId, year: docYear, month: docMonth, files } = data;

            // Mevcut kaydı bul
            const existing = await prisma.beyanname_takip.findUnique({
                where: { customerId_year_month: { customerId, year: docYear, month: docMonth } }
            });

            const currentBeyannameler: Record<string, any> = (existing?.beyannameler as any) || {};
            let needsUpdate = false;

            // Her dosya için beyanname türünü belirle
            for (const doc of files) {
                // Dosya adından beyanname türünü çıkar: VKN_TUR_YIL-AY_CATEGORY.pdf
                const nameParts = doc.name.split('_');
                if (nameParts.length < 4) continue;

                const turKod = nameParts[1];
                const category = nameParts[3]?.replace('.pdf', '');

                if (!turKod) continue;

                // Bu tür için mevcut veri var mı?
                if (!currentBeyannameler[turKod]) {
                    currentBeyannameler[turKod] = {
                        status: 'onaylandi',
                        meta: {
                            vknTckn: doc.vknTckn || nameParts[0],
                            beyannameTuru: turKod,
                            syncedAt: new Date().toISOString()
                        },
                        files: {}
                    };
                    needsUpdate = true;
                }

                // Dosya kategorisine göre ekle
                const fileEntry = { documentId: doc.id, path: doc.path };

                if (category === 'BEYANNAME' && !currentBeyannameler[turKod].files?.beyanname) {
                    currentBeyannameler[turKod].files = currentBeyannameler[turKod].files || {};
                    currentBeyannameler[turKod].files.beyanname = fileEntry;
                    needsUpdate = true;
                } else if (category === 'TAHAKKUK' && !currentBeyannameler[turKod].files?.tahakkuk) {
                    currentBeyannameler[turKod].files = currentBeyannameler[turKod].files || {};
                    currentBeyannameler[turKod].files.tahakkuk = fileEntry;
                    needsUpdate = true;
                } else if (category?.startsWith('SGK_TAHAKKUK') && !currentBeyannameler[turKod].files?.sgkTahakkuk) {
                    currentBeyannameler[turKod].files = currentBeyannameler[turKod].files || {};
                    currentBeyannameler[turKod].files.sgkTahakkuk = fileEntry;
                    needsUpdate = true;
                } else if (category?.startsWith('HIZMET_LISTESI') && !currentBeyannameler[turKod].files?.hizmetListesi) {
                    currentBeyannameler[turKod].files = currentBeyannameler[turKod].files || {};
                    currentBeyannameler[turKod].files.hizmetListesi = fileEntry;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await prisma.beyanname_takip.upsert({
                    where: { customerId_year_month: { customerId, year: docYear, month: docMonth } },
                    update: { beyannameler: currentBeyannameler, updatedAt: new Date() },
                    create: {
                        id: crypto.randomUUID(),
                        tenantId,
                        customerId,
                        year: docYear,
                        month: docMonth,
                        beyannameler: currentBeyannameler,
                        updatedAt: new Date()
                    }
                });

                if (existing) {
                    updated++;
                } else {
                    created++;
                }
                updatedCustomers.push(customerId);
            }
        }

        console.log(`[SYNC] Completed: ${updated} updated, ${created} created`);

        return NextResponse.json({
            success: true,
            stats: {
                documentsProcessed: documents.length,
                updated,
                created,
                total: updated + created
            },
            updatedCustomers
        });

    } catch (error) {
        console.error("[SYNC] Error:", error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
