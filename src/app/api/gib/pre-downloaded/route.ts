/**
 * GIB Pre-Downloaded Check API - V2
 * ==================================
 * Belirli bir dönem için daha önce indirilmiş dosyaları VKN + BeyannameTuru bazlı döndürür
 * Electron-bot bu API'yi kullanarak zaten indirilmiş dosyaları atlar
 *
 * YENİ YAPI:
 * - Dosya adı parsing yerine direkt metadata alanlarına sorgu
 * - VKN + BeyannameTuru bazlı gruplama
 * - Detaylı dosya listesi (fileCategory + fileIndex)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

// ═══════════════════════════════════════════════════════════════════
// RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════

interface DownloadedFile {
    fileCategory: string;  // "BEYANNAME", "TAHAKKUK", "SGK_TAHAKKUK", "HIZMET_LISTESI"
    fileIndex: number | null;
    documentId: string;
}

interface PreDownloadedDocument {
    vkn: string;
    beyannameTuru: string;
    downloadedFiles: DownloadedFile[];
}

interface JWTPayload {
    userId: string;
    tenantId: string;
    email: string;
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY SUPPORT - Eski dosya adlarından tip çıkarma
// ═══════════════════════════════════════════════════════════════════
function parseFileNameLegacy(fileName: string): { fileCategory: string; fileIndex: number | null } | null {
    const upperName = fileName.toUpperCase();

    // SGK_TAHAKKUK_1, SGK_TAHAKKUK_2, vb.
    const sgkMatch = upperName.match(/SGK_TAHAKKUK_?(\d+)?/);
    if (sgkMatch) {
        return {
            fileCategory: 'SGK_TAHAKKUK',
            fileIndex: sgkMatch[1] ? parseInt(sgkMatch[1]) : 1
        };
    }

    // HIZMET_LISTESI_1, HIZMET_LISTESI_2, vb.
    const hizmetMatch = upperName.match(/HIZMET_LISTESI_?(\d+)?/);
    if (hizmetMatch) {
        return {
            fileCategory: 'HIZMET_LISTESI',
            fileIndex: hizmetMatch[1] ? parseInt(hizmetMatch[1]) : 1
        };
    }

    // _BEYANNAME. (normal tahakkuk değil)
    if (upperName.includes('_BEYANNAME')) {
        return { fileCategory: 'BEYANNAME', fileIndex: null };
    }

    // _TAHAKKUK. (SGK_TAHAKKUK değil)
    if (upperName.includes('_TAHAKKUK') && !upperName.includes('SGK_TAHAKKUK')) {
        return { fileCategory: 'TAHAKKUK', fileIndex: null };
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// BEYANNAME TURU EXTRACTION - Dosya adından beyanname türü çıkarma
// ═══════════════════════════════════════════════════════════════════
function extractBeyannameTuruFromFileName(fileName: string): string | null {
    const upperName = fileName.toUpperCase();

    // Yeni format: {VKN}_{BEYANNAME_TURU}_{YIL}-{AY}_{CATEGORY}.pdf
    // Örnek: 1234567890_KDV1_2024-01_BEYANNAME.pdf
    const newFormatMatch = upperName.match(/^\d{10,11}_([A-Z0-9]+)_\d{4}-\d{2}_/);
    if (newFormatMatch) {
        return newFormatMatch[1];
    }

    // Eski format: {Unvan}_{BEYANNAME_TURU}_{AY}-{YIL}...
    // Örnek: Akturk_Ltd_Sti_KDV1_01-2024-01-2024_BEYANNAME.pdf
    const oldFormatMatch = upperName.match(/_([A-Z0-9]+)_\d{2}-\d{4}/);
    if (oldFormatMatch) {
        return oldFormatMatch[1];
    }

    return null;
}

export async function GET(req: NextRequest) {
    try {
        let tenantId: string | null = null;

        // 1. Önce Supabase session'ı dene
        const user = await getUserWithProfile();
        if (user) {
            tenantId = user.tenantId;
        }

        // 2. Supabase session yoksa Bearer token'ı dene (Electron-bot için)
        if (!tenantId) {
            const authHeader = req.headers.get("authorization");
            if (authHeader?.startsWith("Bearer ")) {
                const token = authHeader.substring(7);
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as JWTPayload;
                    tenantId = decoded.tenantId;
                } catch (e) {
                    console.warn("[PRE-DOWNLOADED] JWT doğrulama hatası:", e);
                }
            }
        }

        if (!tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const yearStr = searchParams.get("year");
        const monthStr = searchParams.get("month");

        if (!yearStr || !monthStr) {
            return NextResponse.json({ error: "year ve month parametreleri gerekli" }, { status: 400 });
        }

        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: "Geçersiz year veya month" }, { status: 400 });
        }

        // ═══════════════════════════════════════════════════════════════════
        // VKN -> Customer ID MAP (Eski dosyalar için)
        // ═══════════════════════════════════════════════════════════════════
        const customers = await prisma.customers.findMany({
            where: { tenantId },
            select: {
                id: true,
                vknTckn: true,
                vergiKimlikNo: true,
                tcKimlikNo: true,
            }
        });

        const customerIdToVkn = new Map<string, string>();
        for (const c of customers) {
            const vkn = c.vknTckn || c.vergiKimlikNo || c.tcKimlikNo;
            if (vkn) {
                customerIdToVkn.set(c.id, vkn.replace(/\D/g, ''));
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // DÖNEM İÇİN TÜM PDF DOSYALARINI ÇEK
        // Not: Yeni alanlar (vknTckn, beyannameTuru, fileCategory, fileIndex)
        // veritabanında yoksa hata vermemesi için try-catch ile sarıyoruz
        // ═══════════════════════════════════════════════════════════════════
        let documents: Array<{
            id: string;
            customerId: string | null;
            name: string;
            vknTckn?: string | null;
            beyannameTuru?: string | null;
            fileCategory?: string | null;
            fileIndex?: number | null;
        }> = [];

        try {
            // Önce yeni alanlarla dene
            documents = await prisma.documents.findMany({
                where: {
                    tenantId,
                    year,
                    month,
                    mimeType: "application/pdf",
                    isFolder: false
                },
                select: {
                    id: true,
                    customerId: true,
                    name: true,
                    vknTckn: true,
                    beyannameTuru: true,
                    fileCategory: true,
                    fileIndex: true
                }
            });
        } catch (schemaError) {
            // Yeni alanlar yoksa eski yöntemle devam et
            console.warn("[PRE-DOWNLOADED] Yeni schema alanları bulunamadı, eski yöntemle devam ediliyor");
            const basicDocs = await prisma.documents.findMany({
                where: {
                    tenantId,
                    year,
                    month,
                    mimeType: "application/pdf",
                    isFolder: false
                },
                select: {
                    id: true,
                    customerId: true,
                    name: true
                }
            });
            documents = basicDocs.map(d => ({ ...d, vknTckn: null, beyannameTuru: null, fileCategory: null, fileIndex: null }));
        }

        // ═══════════════════════════════════════════════════════════════════
        // VKN + BEYANNAME_TURU BAZLI GRUPLAMA
        // Key: "{vkn}_{beyannameTuru}"
        // ═══════════════════════════════════════════════════════════════════
        const groupedDownloads = new Map<string, Map<string, DownloadedFile>>();

        for (const doc of documents) {
            let vkn: string | null = null;
            let beyannameTuru: string | null = null;
            let fileCategory: string | null = null;
            let fileIndex: number | null = null;

            // ═══════════════════════════════════════════════════════════════════
            // ÖNCE: Yeni metadata alanlarına bak
            // ═══════════════════════════════════════════════════════════════════
            if (doc.vknTckn && doc.beyannameTuru && doc.fileCategory) {
                // VKN'yi normalize et (sadece rakamlar) - GİB'den boşluklu gelebilir
                vkn = doc.vknTckn.replace(/\D/g, '');
                beyannameTuru = doc.beyannameTuru;
                fileCategory = doc.fileCategory;
                fileIndex = doc.fileIndex ?? null;
            }
            // ═══════════════════════════════════════════════════════════════════
            // YOKSA: Eski yöntem - dosya adı + customerId üzerinden
            // ═══════════════════════════════════════════════════════════════════
            else if (doc.customerId) {
                vkn = customerIdToVkn.get(doc.customerId) || null;
                beyannameTuru = extractBeyannameTuruFromFileName(doc.name);
                const parsed = parseFileNameLegacy(doc.name);
                if (parsed) {
                    fileCategory = parsed.fileCategory;
                    fileIndex = parsed.fileIndex;
                }
            }

            // Gerekli bilgiler yoksa atla
            if (!vkn || !beyannameTuru || !fileCategory) {
                continue;
            }

            // Gruplama key'i
            const groupKey = `${vkn}_${beyannameTuru}`;

            if (!groupedDownloads.has(groupKey)) {
                groupedDownloads.set(groupKey, new Map());
            }

            // Dosya unique key (category + index)
            const fileKey = fileIndex ? `${fileCategory}_${fileIndex}` : fileCategory;

            // Aynı dosya daha önce eklenmemişse ekle
            if (!groupedDownloads.get(groupKey)!.has(fileKey)) {
                groupedDownloads.get(groupKey)!.set(fileKey, {
                    fileCategory,
                    fileIndex,
                    documentId: doc.id
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SONUÇ FORMATLAMA
        // ═══════════════════════════════════════════════════════════════════
        const result: PreDownloadedDocument[] = [];

        for (const [groupKey, filesMap] of groupedDownloads) {
            const [vkn, beyannameTuru] = groupKey.split('_');
            result.push({
                vkn,
                beyannameTuru,
                downloadedFiles: Array.from(filesMap.values())
            });
        }

        console.log(`[PRE-DOWNLOADED] Dönem ${month}/${year} için ${result.length} VKN+Tür kombinasyonu bulundu`);

        // ═══════════════════════════════════════════════════════════════════
        // GERIYE UYUMLULUK - Bot'un mevcut formatı için "downloadedTypes" da ekle
        // ═══════════════════════════════════════════════════════════════════
        const legacyResult = result.map(item => ({
            ...item,
            // Eski format: ['BEYANNAME', 'TAHAKKUK', 'SGK_TAHAKKUK_1', ...]
            downloadedTypes: item.downloadedFiles.map(f =>
                f.fileIndex ? `${f.fileCategory}_${f.fileIndex}` : f.fileCategory
            )
        }));

        return NextResponse.json({
            success: true,
            year,
            month,
            count: result.length,
            customers: legacyResult  // Bot'un beklediği format
        });

    } catch (error: any) {
        console.error("[PRE-DOWNLOADED] Hata:", error);
        return NextResponse.json(
            { error: error.message || "Sunucu hatası" },
            { status: 500 }
        );
    }
}
