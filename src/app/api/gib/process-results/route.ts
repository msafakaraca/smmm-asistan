/**
 * API endpoint to process bot results from Electron
 * POST /api/gib/process-results
 * 
 * Receives beyanname data with PDF buffers,
 * saves files to customer folders, and updates BeyannameTakip
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BEYANNAME_TYPES } from "@/lib/constants/beyanname-types";
import { adminUploadFile, generateStoragePath } from "@/lib/storage-supabase";
import { isValidTaxNumber } from "@/lib/utils/tax-validation";
import { verifyInternalToken } from "@/lib/internal-auth";

// Beyanname türü eşleştirme (GIB kodları -> sistem kodları)
function getBeyannameTurKod(beyannameTuru: string): string {
    const normalizedType = beyannameTuru.toUpperCase();

    for (const type of BEYANNAME_TYPES) {
        if (type.searchPattern) {
            try {
                const regex = new RegExp(type.searchPattern, 'i');
                if (regex.test(normalizedType)) {
                    return type.code;
                }
            } catch { }
        }
    }

    // Fallback: Tevkifat veya 9015 içeriyorsa KDV9015
    if (normalizedType.includes('TEVKIFAT') || normalizedType.includes('9015')) {
        return 'KDV9015';
    }
    // Fallback: ilk kelime
    const firstWord = normalizedType.split(/\s+/)[0].replace(/[^A-Z0-9]/g, '');
    // KDV tek başına gelirse KDV1 olmalı
    if (firstWord === 'KDV') {
        return 'KDV1';
    }
    return firstWord || 'DIGER';
}

// Normalize unvan for matching
function normalizeUnvan(unvan: string): string {
    if (!unvan) return '';

    // 1. Türkçe küçük harfleri ÖNCE dönüştür (toUpperCase öncesi)
    let result = unvan
        .replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .toUpperCase();

    // 2. Türkçe büyük harfleri ASCII'ye çevir
    result = result
        .replace(/İ/g, 'I')
        .replace(/Ş/g, 'S')
        .replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C');

    // 3. Alfanumerik olmayan karakterleri kaldır
    return result.replace(/[^A-Z0-9]/g, '').trim();
}

// Türkçe ay isimleri
const MONTH_NAMES_TR = ['', 'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
    'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

// Türkçe karakterleri ASCII'ye çevir (Supabase Storage için gerekli)
function turkishToAscii(str: string): string {
    return str
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE STORAGE - PDF'i klasör yapısına kaydet
// Yapı: Müşteri / Beyannameler|Tahakkuklar|SGK / Yıl / Tür / Ay / dosya.pdf
// ═══════════════════════════════════════════════════════════════════

// File category mapping
type FileCategory = "BEYANNAME" | "TAHAKKUK" | "SGK_TAHAKKUK" | "HIZMET_LISTESI";

// ═══════════════════════════════════════════════════════════════════
// SGK KLASÖR YAPISI - Race condition önlemek için önceden oluştur
// Yapı: Müşteri / SGK Tahakkuk ve Hizmet Listesi / Tahakkuk|Hizmet Listesi / Ay/Yıl
// ═══════════════════════════════════════════════════════════════════
async function ensureSgkFolderStructure(
    tenantId: string,
    customerId: string,
    customerUnvan: string,
    fileType: "sgkTahakkuk" | "hizmetListesi",
    year: number,
    month: number
): Promise<string> {
    const monthPadded = String(month).padStart(2, '0');
    const monthYearFolderName = `${monthPadded}/${year}`;

    // 1. Müşteri kök klasörünü kontrol et/oluştur
    let customerRootFolder = await prisma.documents.findFirst({
        where: { tenantId, customerId, isFolder: true, parentId: null }
    });

    if (!customerRootFolder) {
        const customer = await prisma.customers.findUnique({
            where: { id: customerId },
            select: { unvan: true, sirketTipi: true }
        });

        const folderName = customer?.unvan?.replace(/[<>:"/\\|?*]/g, '').trim() || 'İsimsiz';

        customerRootFolder = await prisma.documents.create({
            data: {
                id: crypto.randomUUID(),
                name: folderName,
                type: "folder",
                isFolder: true,
                customerId,
                tenantId,
                size: 0,
                storage: "local",
                parentId: null,
                updatedAt: new Date()
            }
        });
        console.log(`[SUPABASE] 📁 Müşteri kök klasörü oluşturuldu: ${folderName}`);
    }

    // 2. SGK ana klasörünü kontrol et/oluştur
    const mainFolderName = "SGK Tahakkuk ve Hizmet Listesi";
    let mainFolder = await prisma.documents.findFirst({
        where: { tenantId, customerId, name: mainFolderName, isFolder: true, parentId: customerRootFolder.id }
    });

    if (!mainFolder) {
        mainFolder = await prisma.documents.create({
            data: {
                id: crypto.randomUUID(),
                name: mainFolderName,
                isFolder: true,
                type: "sgk",
                tenantId,
                customerId,
                parentId: customerRootFolder.id,
                size: 0,
                storage: "local",
                updatedAt: new Date()
            }
        });
        console.log(`[SUPABASE] 📁 ${mainFolderName} klasörü oluşturuldu`);
    }

    // 3. Tip klasörünü kontrol et/oluştur (Tahakkuk veya Hizmet Listesi)
    const typeFolderName = fileType === "sgkTahakkuk" ? "Tahakkuk" : "Hizmet Listesi";
    const typeFolderType = fileType === "sgkTahakkuk" ? "sgk_tahakkuk" : "hizmet_listesi";

    let typeFolder = await prisma.documents.findFirst({
        where: { tenantId, customerId, name: typeFolderName, isFolder: true, parentId: mainFolder.id }
    });

    if (!typeFolder) {
        typeFolder = await prisma.documents.create({
            data: {
                id: crypto.randomUUID(),
                name: typeFolderName,
                isFolder: true,
                type: typeFolderType,
                tenantId,
                customerId,
                parentId: mainFolder.id,
                size: 0,
                storage: "local",
                updatedAt: new Date()
            }
        });
        console.log(`[SUPABASE] 📁 ${typeFolderName} klasörü oluşturuldu`);
    }

    // 4. Ay/Yıl klasörünü kontrol et/oluştur
    let monthYearFolder = await prisma.documents.findFirst({
        where: { tenantId, customerId, name: monthYearFolderName, isFolder: true, parentId: typeFolder.id }
    });

    if (!monthYearFolder) {
        monthYearFolder = await prisma.documents.create({
            data: {
                id: crypto.randomUUID(),
                name: monthYearFolderName,
                isFolder: true,
                type: "FOLDER",
                tenantId,
                customerId,
                parentId: typeFolder.id,
                year,
                month,
                size: 0,
                storage: "local",
                updatedAt: new Date()
            }
        });
        console.log(`[SUPABASE] 📁 ${typeFolderName}/${monthYearFolderName} klasörü oluşturuldu`);
    }

    return monthYearFolder.id;
}

function getFileCategory(fileType: "beyanname" | "tahakkuk" | "sgkTahakkuk" | "hizmetListesi"): FileCategory {
    const map: Record<string, FileCategory> = {
        "beyanname": "BEYANNAME",
        "tahakkuk": "TAHAKKUK",
        "sgkTahakkuk": "SGK_TAHAKKUK",
        "hizmetListesi": "HIZMET_LISTESI"
    };
    return map[fileType] || "BEYANNAME";
}

async function savePdfToSupabase(
    tenantId: string,
    customerId: string,
    customerName: string,
    customerVknTckn: string,
    base64Data: string,
    fileType: "beyanname" | "tahakkuk" | "sgkTahakkuk" | "hizmetListesi",
    year: number,
    month: number,
    beyannameTuru: string,
    fileIndex?: number, // Coklu dosyalar icin: 1, 2, 3...
    preCreatedFolderId?: string // SGK dosyaları için önceden oluşturulmuş klasör ID'si
): Promise<{ path: string; documentId: string } | null> {
    try {
        if (!base64Data || base64Data.length < 100) {
            console.error(`[SUPABASE] Invalid base64 data for ${fileType} (Length: ${base64Data?.length})`);
            return null;
        }

        // VKN/TC temizle (sadece rakamlar)
        const cleanVknTckn = customerVknTckn.replace(/\D/g, '');
        const cleanBeyannameTuru = beyannameTuru.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
        const monthPadded = String(month).padStart(2, '0');
        const fileCategory = getFileCategory(fileType);

        // ═══════════════════════════════════════════════════════════════════
        // YENI DOSYA ADI FORMATI - VKN Bazli (Duplicate Detection icin)
        // Format: {VKN}_{BeyannameTuru}_{Yil}-{Ay}_{FileCategory}_{Index?}.pdf
        // ═══════════════════════════════════════════════════════════════════
        let fileName: string;
        if (fileIndex && fileIndex > 0) {
            // Coklu dosyalar: SGK_TAHAKKUK_1, HIZMET_LISTESI_2, vb.
            fileName = `${cleanVknTckn}_${cleanBeyannameTuru}_${year}-${monthPadded}_${fileCategory}_${fileIndex}.pdf`;
        } else {
            // Tekil dosyalar: BEYANNAME, TAHAKKUK
            fileName = `${cleanVknTckn}_${cleanBeyannameTuru}_${year}-${monthPadded}_${fileCategory}.pdf`;
        }

        // ═══════════════════════════════════════════════════════════════════
        // DUPLICATE CHECK - Yeni metadata alanlari ile kontrol
        // Oncelik: vknTckn + beyannameTuru + year + month + fileCategory + fileIndex
        // Fallback: name bazli (geriye uyumluluk)
        // ═══════════════════════════════════════════════════════════════════
        let existingDoc = null;

        try {
            // Önce yeni metadata alanlarıyla kontrol et
            existingDoc = await prisma.documents.findFirst({
                where: {
                    tenantId,
                    OR: [
                        // Yeni format: metadata bazli
                        {
                            vknTckn: cleanVknTckn,
                            beyannameTuru: cleanBeyannameTuru,
                            year,
                            month,
                            fileCategory,
                            fileIndex: fileIndex || null
                        },
                        // Eski format: dosya adi bazli (geriye uyumluluk)
                        { customerId, name: fileName }
                    ]
                }
            });
        } catch {
            // Yeni alanlar yoksa sadece dosya adı ile kontrol et
            existingDoc = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: fileName }
            });
        }

        if (existingDoc) {
            console.log(`[SUPABASE] ⏭️ Dosya zaten var: ${fileName}`);
            return { path: existingDoc.path || '', documentId: existingDoc.id };
        }

        // Base64'ü buffer'a çevir
        const base64Content = base64Data.replace(/^data:application\/pdf;base64,/, "");
        const buffer = Buffer.from(base64Content, "base64");

        // ═══════════════════════════════════════════════════════════════════
        // KLASÖR YAPISI OLUŞTUR
        // Yapı: Müşteri Kök / Ana Klasör / Yıl / Tür / Ay
        // ═══════════════════════════════════════════════════════════════════

        // 1. Müşteri kök klasörünü kontrol et/oluştur
        let customerRootFolder = await prisma.documents.findFirst({
            where: { tenantId, customerId, isFolder: true, parentId: null }
        });

        if (!customerRootFolder) {
            // Müşteri bilgilerini al
            const customer = await prisma.customers.findUnique({
                where: { id: customerId },
                select: { unvan: true, sirketTipi: true }
            });

            const folderName = customer?.unvan?.replace(/[<>:"/\\|?*]/g, '').trim() || 'İsimsiz';

            customerRootFolder = await prisma.documents.create({
                data: {
                    id: crypto.randomUUID(),
                    name: folderName,
                    type: "folder",
                    isFolder: true,
                    customerId,
                    tenantId,
                    size: 0,
                    storage: "local",
                    parentId: null,
                    updatedAt: new Date()
                }
            });
            console.log(`[SUPABASE] 📁 Müşteri kök klasörü oluşturuldu: ${folderName}`);
        }

        // 2. Ana klasör seçimi (YENİ YAPI - 4 klasör)
        let mainFolderName: string;
        let mainFolderType: string;

        if (fileType === "beyanname") {
            mainFolderName = "Beyannameler";
            mainFolderType = "beyanname";
        } else if (fileType === "tahakkuk") {
            mainFolderName = "Tahakkuklar";
            mainFolderType = "tahakkuk";
        } else {
            // sgkTahakkuk ve hizmetListesi → "SGK Tahakkuk ve Hizmet Listesi"
            mainFolderName = "SGK Tahakkuk ve Hizmet Listesi";
            mainFolderType = "sgk";
        }

        let mainFolder = await prisma.documents.findFirst({
            where: { tenantId, customerId, name: mainFolderName, isFolder: true, parentId: customerRootFolder.id }
        });

        if (!mainFolder) {
            mainFolder = await prisma.documents.create({
                data: { id: crypto.randomUUID(), name: mainFolderName, isFolder: true, type: mainFolderType, tenantId, customerId, parentId: customerRootFolder.id, size: 0, storage: "local", updatedAt: new Date() }
            });
            console.log(`[SUPABASE] 📁 ${mainFolderName} klasörü oluşturuldu`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 3. YENİ KLASÖR YAPISI - Dinamik alt klasörler
        // Aylık: {Ay}/{Yıl} örn: "01/2025", "12/2025"
        // Çeyreklik (GGECICI/KGECICI): {BaşlangıçAy}/{Yıl}-{BitişAy}/{Yıl} örn: "10/2025-12/2025"
        // ═══════════════════════════════════════════════════════════════════
        const isQuarterlyDeclaration = cleanBeyannameTuru === 'GGECICI' || cleanBeyannameTuru === 'KGECICI';
        let monthYearFolderName: string;

        if (isQuarterlyDeclaration) {
            // Çeyreklik dönem klasör adı: month Q sonuna işaret eder (3, 6, 9, 12)
            const quarterEnd = month;
            const quarterStart = quarterEnd - 2;
            const startPadded = String(quarterStart).padStart(2, '0');
            const endPadded = String(quarterEnd).padStart(2, '0');
            monthYearFolderName = `${startPadded}/${year}-${endPadded}/${year}`;
        } else {
            monthYearFolderName = `${monthPadded}/${year}`;
        }
        let targetParentId: string;

        // SGK dosyaları için preCreatedFolderId varsa klasör oluşturmayı atla
        if (preCreatedFolderId && (fileType === "sgkTahakkuk" || fileType === "hizmetListesi")) {
            targetParentId = preCreatedFolderId;
            console.log(`[SUPABASE] 📁 Önceden oluşturulmuş klasör kullanılıyor: ${preCreatedFolderId}`);
        } else if (fileType === "sgkTahakkuk") {
            // SGK Tahakkuk ve Hizmet Listesi / Tahakkuk / {Ay}/{Yıl}
            let tahakkukFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: "Tahakkuk", isFolder: true, parentId: mainFolder.id }
            });

            if (!tahakkukFolder) {
                tahakkukFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: "Tahakkuk", isFolder: true, type: "sgk_tahakkuk", tenantId, customerId, parentId: mainFolder.id, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            // Ay/Yıl klasörü
            let monthYearFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: monthYearFolderName, isFolder: true, parentId: tahakkukFolder.id }
            });

            if (!monthYearFolder) {
                monthYearFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: monthYearFolderName, isFolder: true, type: "FOLDER", tenantId, customerId, parentId: tahakkukFolder.id, year, month, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            targetParentId = monthYearFolder.id;

        } else if (fileType === "hizmetListesi") {
            // SGK Tahakkuk ve Hizmet Listesi / Hizmet Listesi / {Ay}/{Yıl}
            let hizmetListesiFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: "Hizmet Listesi", isFolder: true, parentId: mainFolder.id }
            });

            if (!hizmetListesiFolder) {
                hizmetListesiFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: "Hizmet Listesi", isFolder: true, type: "hizmet_listesi", tenantId, customerId, parentId: mainFolder.id, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            // Ay/Yıl klasörü
            let monthYearFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: monthYearFolderName, isFolder: true, parentId: hizmetListesiFolder.id }
            });

            if (!monthYearFolder) {
                monthYearFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: monthYearFolderName, isFolder: true, type: "FOLDER", tenantId, customerId, parentId: hizmetListesiFolder.id, year, month, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            targetParentId = monthYearFolder.id;

        } else {
            // Beyanname veya Tahakkuk: Ana Klasör / {Tür} / {Ay}/{Yıl}
            // Beyanname türü klasörü (KDV1, MUHSGK, vb.)
            let beyannameTuruFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: cleanBeyannameTuru, isFolder: true, parentId: mainFolder.id }
            });

            if (!beyannameTuruFolder) {
                beyannameTuruFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: cleanBeyannameTuru, isFolder: true, type: "FOLDER", tenantId, customerId, parentId: mainFolder.id, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            // Ay/Yıl klasörü
            let monthYearFolder = await prisma.documents.findFirst({
                where: { tenantId, customerId, name: monthYearFolderName, isFolder: true, parentId: beyannameTuruFolder.id }
            });

            if (!monthYearFolder) {
                monthYearFolder = await prisma.documents.create({
                    data: { id: crypto.randomUUID(), name: monthYearFolderName, isFolder: true, type: "FOLDER", tenantId, customerId, parentId: beyannameTuruFolder.id, year, month, size: 0, storage: "local", updatedAt: new Date() }
                });
            }

            targetParentId = monthYearFolder.id;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SUPABASE STORAGE'A YÜKLE
        // ═══════════════════════════════════════════════════════════════════
        const storagePath = generateStoragePath(tenantId, customerId, year, month, fileName);

        console.log(`[SUPABASE] 📤 Yükleniyor: ${fileName} (${Math.round(buffer.length / 1024)}KB)`);

        try {
            await adminUploadFile(storagePath, buffer, 'application/pdf');
        } catch (uploadError: any) {
            // Dosya zaten varsa hata verme (duplicate)
            if (uploadError.message?.includes('already exists') || uploadError.message?.includes('Duplicate')) {
                console.log(`[SUPABASE] ⏭️ Dosya zaten Storage'da var: ${fileName}`);
            } else {
                throw uploadError;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // DATABASE RECORD - Doğru klasör altına kaydet + YENI METADATA
        // ═══════════════════════════════════════════════════════════════════
        const documentTypeMap: Record<string, string> = {
            "beyanname": "beyanname",
            "tahakkuk": "tahakkuk",
            "sgkTahakkuk": "sgk_tahakkuk",
            "hizmetListesi": "hizmet_listesi"
        };

        // Temel document verisi
        const baseDocData = {
            id: crypto.randomUUID(),
            tenantId,
            customerId,
            name: fileName,
            originalName: fileName,
            type: documentTypeMap[fileType] || fileType,
            mimeType: "application/pdf",
            size: buffer.length,
            isFolder: false,
            path: storagePath,
            storage: "supabase",
            year,
            month,
            parentId: targetParentId, // Doğru klasör altına kaydet!
            updatedAt: new Date()
        };

        let document;
        try {
            // Yeni metadata alanlarıyla kaydet
            document = await prisma.documents.create({
                data: {
                    ...baseDocData,
                    // YENI METADATA ALANLARI - Duplicate Detection icin
                    vknTckn: cleanVknTckn,
                    beyannameTuru: cleanBeyannameTuru,
                    fileCategory,
                    fileIndex: fileIndex || null
                }
            });
        } catch {
            // Yeni alanlar yoksa eski yöntemle kaydet
            console.warn(`[SUPABASE] Yeni schema alanları bulunamadı, eski yöntemle kaydediliyor: ${fileName}`);
            document = await prisma.documents.create({
                data: baseDocData
            });
        }

        console.log(`[SUPABASE] ✅ Kaydedildi: ${fileName} (parentId: ${targetParentId})`);
        return { path: storagePath, documentId: document.id };

    } catch (error) {
        console.error(`[SUPABASE] ❌ Hata (${fileType}):`, error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    // Check for internal token first (from server.ts WebSocket handler)
    const internalToken = request.headers.get('X-Internal-Token');

    let tenantId: string;

    if (internalToken) {
        // Internal call from server.ts - JWT token ile doğrulama
        const decoded = verifyInternalToken(internalToken);
        if (!decoded) {
            return NextResponse.json({ error: "Geçersiz internal token" }, { status: 401 });
        }
        tenantId = decoded.tenantId;
        console.log(`[PROCESS] Internal call for tenant: ${tenantId}`);
    } else {
        // Normal auth check
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        tenantId = session.user.tenantId;
    }

    try {
        const body = await request.json();
        const { beyannameler, startDate } = body;

        console.log(`[PROCESS] Received ${beyannameler?.length} beyanname(s) to process.`);

        if (!beyannameler || !Array.isArray(beyannameler)) {
            console.error("[PROCESS] Invalid payload: beyannameler missing or not array");
            return NextResponse.json({ error: "beyannameler array required" }, { status: 400 });
        }

        // Parse dönem from startDate (bir önceki ay)
        const startDateParsed = new Date(startDate || new Date());
        let year = startDateParsed.getFullYear();
        let month = startDateParsed.getMonth() + 1;
        month = month - 1;
        if (month === 0) {
            month = 12;
            year = year - 1;
        }

        console.log(`[PROCESS] Processing ${beyannameler.length} beyanname for period ${month}/${year}`);

        // DEBUG: Her beyanname için buffer durumunu logla
        for (const b of beyannameler) {
            console.log(`[PROCESS-DEBUG] ${b.tcVkn} - ${(b.adSoyadUnvan || b.unvan || '').substring(0, 25)}`);
            console.log(`  beyannameBuffer: ${b.beyannameBuffer ? `${Math.round(b.beyannameBuffer.length / 1024)}KB` : 'YOK'}`);
            console.log(`  tahakkukBuffer: ${b.tahakkukBuffer ? `${Math.round(b.tahakkukBuffer.length / 1024)}KB` : 'YOK'}`);
            console.log(`  sgkTahakkukBuffer: ${b.sgkTahakkukBuffer ? 'VAR' : 'YOK'}`);
            console.log(`  sgkHizmetBuffer: ${b.sgkHizmetBuffer ? 'VAR' : 'YOK'}`);
        }

        // Get all customers for matching
        const customers = await prisma.customers.findMany({
            where: { tenantId },
            select: { id: true, vknTckn: true, vergiKimlikNo: true, tcKimlikNo: true, unvan: true }
        });

        const normalizedCustomers = customers.map(c => ({
            ...c,
            normalizedUnvan: normalizeUnvan(c.unvan)
        }));

        // Find matching customer - geliştirilmiş eşleştirme
        const findCustomer = (tcVkn: string, unvan: string) => {
            const cleanVkn = (tcVkn || '').replace(/\D/g, ''); // Sadece rakamlar

            // DEBUG: Eşleştirme bilgilerini logla
            console.log(`[MATCH-DEBUG] ═══════════════════════════════════════════════`);
            console.log(`[MATCH-DEBUG] Aranan VKN: "${cleanVkn}" (${cleanVkn.length} hane)`);
            console.log(`[MATCH-DEBUG] Aranan Unvan: "${unvan}"`);
            console.log(`[MATCH-DEBUG] DB'deki müşteri sayısı: ${customers.length}`);

            // VKN 10 hane, TCKN 11 hane - uzunluk kontrolü
            const hasValidLength = cleanVkn.length === 10 || cleanVkn.length === 11;

            // Checksum dogrulamasi (warn ama reject etme - GIB'den gelebilir)
            if (hasValidLength && !isValidTaxNumber(cleanVkn)) {
                console.warn(`[MATCH] ⚠️ VKN/TCKN checksum hatali: "${cleanVkn}" (${cleanVkn.length} hane) - Eslestirme yine de denenecek`);
            }

            // 1. VKN/TCKN tam eşleşme (SADECE geçerli uzunluk ise - en güvenilir)
            if (hasValidLength && cleanVkn) {
                const vknMatch = customers.find(c => {
                    const customerVkn = (c.vknTckn || '').replace(/\D/g, '');
                    const customerVergi = (c.vergiKimlikNo || '').replace(/\D/g, '');
                    const customerTc = (c.tcKimlikNo || '').replace(/\D/g, '');

                    // İlk 3 müşteri için karşılaştırma loglama
                    if (customers.indexOf(c) < 3) {
                        console.log(`[MATCH-DEBUG] Karşılaştırma: "${cleanVkn}" vs DB VKN="${customerVkn}", VergiNo="${customerVergi}", TC="${customerTc}"`);
                    }

                    return customerVkn === cleanVkn ||
                           customerVergi === cleanVkn ||
                           customerTc === cleanVkn;
                });
                if (vknMatch) {
                    console.log(`[MATCH] ✅ VKN eşleşmesi: ${cleanVkn} -> ${vknMatch.id} (${vknMatch.unvan})`);
                    return vknMatch;
                }
                console.log(`[MATCH-DEBUG] ❌ VKN ile eşleşme bulunamadı: ${cleanVkn}`);
            } else {
                console.log(`[MATCH-DEBUG] ⚠️ Geçersiz VKN formatı: "${cleanVkn}" (${cleanVkn.length} hane, beklenen: 10 veya 11)`);
            }

            // 2. Unvan tam eşleşme
            const normalized = normalizeUnvan(unvan);
            const exactUnvanMatch = normalizedCustomers.find(c => c.normalizedUnvan === normalized);
            if (exactUnvanMatch) return exactUnvanMatch;

            // 3. Unvan içerme kontrolü (esnek eşleştirme)
            const unvanMatch = normalizedCustomers.find(c =>
                normalized.includes(c.normalizedUnvan) ||
                c.normalizedUnvan.includes(normalized)
            );
            if (unvanMatch) return unvanMatch;

            // 4. Unvan ilk kelime eşleşmesi (örn: "GÜNDÜZLÜLER" -> "GÜNDÜZLÜLER OTELCİLİK...")
            const firstWords = normalized.substring(0, 15); // İlk 15 karakter
            const firstWordMatch = normalizedCustomers.find(c =>
                c.normalizedUnvan.startsWith(firstWords) ||
                firstWords.startsWith(c.normalizedUnvan.substring(0, 15))
            );
            if (firstWordMatch) return firstWordMatch;

            // 5. Kelime bazlı eşleştirme (en az 2 kelime eşleşmeli)
            const unvanWords = normalized.split(/[^A-Z0-9]+/).filter(w => w.length > 2);
            if (unvanWords.length >= 2) {
                const wordMatch = normalizedCustomers.find(c => {
                    const customerWords = c.normalizedUnvan.split(/[^A-Z0-9]+/).filter((w: string) => w.length > 2);
                    const matchingWords = unvanWords.filter(w => customerWords.includes(w));
                    return matchingWords.length >= 2;
                });
                if (wordMatch) return wordMatch;
            }

            console.log(`[MATCH] ❌ Eşleşme bulunamadı: VKN="${cleanVkn}" Unvan="${unvan}"`);
            return null;
        };

        let matched = 0;
        let unmatched = 0;
        let filesProcessed = 0;
        let skipped = 0;
        const unmatchedDetails: Array<{ tcVkn: string; unvan: string; beyannameTuru: string; vergiDairesi: string | null }> = [];

        // ═══════════════════════════════════════════════════════════════════
        // PARALEL İŞLEM - Tüm beyannameleri aynı anda işle
        // ═══════════════════════════════════════════════════════════════════
        const processingStartTime = Date.now();

        // Her beyanname için işlem fonksiyonu
        const processBeyanname = async (beyanname: any): Promise<{ matched: boolean; filesCount: number; skippedCount: number; unmatchedInfo?: { tcVkn: string; unvan: string; beyannameTuru: string; vergiDairesi: string | null } }> => {
            const tcVkn = beyanname.tcVkn || "";
            // Bot "adSoyadUnvan" gönderiyor, öncelikli olarak bu alandan oku
            const unvan = (beyanname.adSoyadUnvan || beyanname.unvan || "").trim();
            const beyannameTuru = beyanname.beyannameTuru || "UNKNOWN";
            const customer = findCustomer(tcVkn, unvan);

            if (!customer) {
                console.log(`[PROCESS] ✗ Customer not found: ${tcVkn} - ${unvan} (${beyannameTuru})`);
                return {
                    matched: false,
                    filesCount: 0,
                    skippedCount: 0,
                    unmatchedInfo: { tcVkn, unvan, beyannameTuru, vergiDairesi: beyanname.vergiDairesi || null }
                };
            }

            console.log(`[PROCESS] ✓ Customer matched: ${beyanname.tcVkn} → ${customer.id} (${customer.unvan})`);

            const turKod = getBeyannameTurKod(beyanname.beyannameTuru || "UNKNOWN");

            // ═══════════════════════════════════════════════════════════════════
            // ÇEYREKLIK DÖNEM OVERRIDE - GGECICI/KGECICI için gerçek dönem
            // Bot Şubat'ta çalışınca "bir önceki ay" = Ocak olur, ama GGV/KGV
            // Q4 (10-12/2025) dönemi altında kaydedilmeli. Parse edilen veri
            // doğru dönemi içerir, onu kullan.
            // ═══════════════════════════════════════════════════════════════════
            let docYear = year;
            let docMonth = month;

            if ((turKod === 'GGECICI' || turKod === 'KGECICI') && beyanname.geciciVergiTahakkukParsed) {
                const geciciParsed = beyanname.geciciVergiTahakkukParsed;
                if (geciciParsed.year && geciciParsed.month) {
                    docYear = geciciParsed.year;
                    docMonth = geciciParsed.month;
                    console.log(`[PROCESS] 📅 Çeyreklik dönem override: ${turKod} ${month}/${year} -> ${docMonth}/${docYear}`);
                }
            }

            // ═══════════════════════════════════════════════════════════════════
            // YENİ BEYANNAME TÜRÜ AUTO-REGISTER
            // Bot yeni tür çektiğinde (POSET, KGECICI vb.) otomatik olarak
            // beyanname_turleri tablosuna ekle (kontrol çizelgesinde sütun görünür)
            // ═══════════════════════════════════════════════════════════════════
            try {
                await prisma.beyanname_turleri.upsert({
                    where: {
                        tenantId_kod: { tenantId, kod: turKod }
                    },
                    update: {
                        // Varsa güncelleme yapma, sadece updatedAt güncelle
                        updatedAt: new Date()
                    },
                    create: {
                        id: crypto.randomUUID(),
                        tenantId,
                        kod: turKod,
                        aciklama: beyanname.beyannameTuru || turKod,
                        kisaAd: turKod.substring(0, 8),
                        kategori: turKod.startsWith('SGK') || turKod === 'MUHSGK' ? 'SGK' : 'VERGI',
                        aktif: true,
                        siraNo: 99, // En sona ekle
                        updatedAt: new Date()
                    }
                });
                console.log(`[PROCESS] 📋 Beyanname türü kaydedildi/güncellendi: ${turKod}`);
            } catch (error) {
                // Unique constraint hatası veya diğer hatalar - kritik değil, devam et
                console.log(`[PROCESS] ⚠️ Beyanname türü eklenemedi (muhtemelen zaten var): ${turKod}`);
            }

            const files: Record<string, { documentId: string; path: string }> = {};
            let localFilesProcessed = 0;
            let localSkipped = 0;

            // ═══════════════════════════════════════════════════════════════════
            // BEYANNAME VE TAHAKKUK - PARALEL İŞLEM (race condition yok)
            // ═══════════════════════════════════════════════════════════════════
            const pdfPromises: Promise<{ type: string; result: { path: string; documentId: string } | null }>[] = [];

            if (beyanname.beyannameBuffer) {
                pdfPromises.push(
                    savePdfToSupabase(tenantId, customer.id, customer.unvan, beyanname.tcVkn || '', beyanname.beyannameBuffer, "beyanname", docYear, docMonth, turKod)
                        .then(result => ({ type: 'beyanname', result }))
                );
            }

            if (beyanname.tahakkukBuffer) {
                pdfPromises.push(
                    savePdfToSupabase(tenantId, customer.id, customer.unvan, beyanname.tcVkn || '', beyanname.tahakkukBuffer, "tahakkuk", docYear, docMonth, turKod)
                        .then(result => ({ type: 'tahakkuk', result }))
                );
            }

            // Beyanname ve Tahakkuk'u paralel kaydet
            const pdfResults = await Promise.all(pdfPromises);

            // ═══════════════════════════════════════════════════════════════════
            // SGK DOSYALARI - SERİ İŞLEM (race condition önlemek için)
            // 1. Önce klasör yapısını oluştur
            // 2. Sonra dosyaları sırayla kaydet
            // ═══════════════════════════════════════════════════════════════════

            // SGK Tahakkuk - ÇOKLU DOSYA DESTEĞİ (SERİ İŞLEM)
            const hasSgkTahakkuk = (beyanname.sgkTahakkukBuffers && Array.isArray(beyanname.sgkTahakkukBuffers) && beyanname.sgkTahakkukBuffers.length > 0) || beyanname.sgkTahakkukBuffer;

            if (hasSgkTahakkuk) {
                // 1. ÖNCE klasör yapısı oluştur (tek sefer)
                const sgkTahakkukFolderId = await ensureSgkFolderStructure(
                    tenantId, customer.id, customer.unvan, "sgkTahakkuk", year, month
                );

                // 2. SONRA dosyaları sırayla kaydet
                if (beyanname.sgkTahakkukBuffers && Array.isArray(beyanname.sgkTahakkukBuffers) && beyanname.sgkTahakkukBuffers.length > 0) {
                    console.log(`[PROCESS] 📦 ${beyanname.sgkTahakkukBuffers.length} SGK Tahakkuk dosyası işleniyor (seri)`);
                    for (let idx = 0; idx < beyanname.sgkTahakkukBuffers.length; idx++) {
                        const sgkItem = beyanname.sgkTahakkukBuffers[idx];
                        const buffer = typeof sgkItem === 'string' ? sgkItem : sgkItem.buffer;
                        const fileIndex = typeof sgkItem === 'string' ? idx + 1 : sgkItem.index;

                        const result = await savePdfToSupabase(
                            tenantId, customer.id, customer.unvan, beyanname.tcVkn || '',
                            buffer, "sgkTahakkuk", year, month, turKod, fileIndex,
                            sgkTahakkukFolderId  // Önceden oluşturulmuş klasör
                        );

                        if (result) {
                            files[`sgkTahakkuk_${fileIndex}`] = result;
                            localFilesProcessed++;
                        }
                    }
                } else if (beyanname.sgkTahakkukBuffer) {
                    // Geriye uyumluluk: Eski tekil format
                    const result = await savePdfToSupabase(
                        tenantId, customer.id, customer.unvan, beyanname.tcVkn || '',
                        beyanname.sgkTahakkukBuffer, "sgkTahakkuk", year, month, turKod, 1,
                        sgkTahakkukFolderId
                    );
                    if (result) {
                        files['sgkTahakkuk'] = result;
                        localFilesProcessed++;
                    }
                }
            }

            // Hizmet Listesi - ÇOKLU DOSYA DESTEĞİ (SERİ İŞLEM)
            const hasSgkHizmet = (beyanname.sgkHizmetBuffers && Array.isArray(beyanname.sgkHizmetBuffers) && beyanname.sgkHizmetBuffers.length > 0) || beyanname.sgkHizmetBuffer || beyanname.hizmetListesiBuffer;

            if (hasSgkHizmet) {
                // 1. ÖNCE klasör yapısı oluştur (tek sefer)
                const sgkHizmetFolderId = await ensureSgkFolderStructure(
                    tenantId, customer.id, customer.unvan, "hizmetListesi", year, month
                );

                // 2. SONRA dosyaları sırayla kaydet
                if (beyanname.sgkHizmetBuffers && Array.isArray(beyanname.sgkHizmetBuffers) && beyanname.sgkHizmetBuffers.length > 0) {
                    console.log(`[PROCESS] 📦 ${beyanname.sgkHizmetBuffers.length} Hizmet Listesi dosyası işleniyor (seri)`);
                    for (let idx = 0; idx < beyanname.sgkHizmetBuffers.length; idx++) {
                        const hizmetItem = beyanname.sgkHizmetBuffers[idx];
                        const buffer = typeof hizmetItem === 'string' ? hizmetItem : hizmetItem.buffer;
                        const fileIndex = typeof hizmetItem === 'string' ? idx + 1 : hizmetItem.index;

                        const result = await savePdfToSupabase(
                            tenantId, customer.id, customer.unvan, beyanname.tcVkn || '',
                            buffer, "hizmetListesi", year, month, turKod, fileIndex,
                            sgkHizmetFolderId  // Önceden oluşturulmuş klasör
                        );

                        if (result) {
                            files[`hizmetListesi_${fileIndex}`] = result;
                            localFilesProcessed++;
                        }
                    }
                } else {
                    // Geriye uyumluluk: Eski tekil format
                    const hizmetBuffer = beyanname.sgkHizmetBuffer || beyanname.hizmetListesiBuffer;
                    if (hizmetBuffer) {
                        const result = await savePdfToSupabase(
                            tenantId, customer.id, customer.unvan, beyanname.tcVkn || '',
                            hizmetBuffer, "hizmetListesi", year, month, turKod, 1,
                            sgkHizmetFolderId
                        );
                        if (result) {
                            files['hizmetListesi'] = result;
                            localFilesProcessed++;
                        }
                    }
                }
            }

            for (const { type, result } of pdfResults) {
                if (result) {
                    files[type] = result;
                    // Eğer yeni kaydedildiyse count artır, zaten varsa skip
                    if (result.documentId && result.path) {
                        localFilesProcessed++;
                    }
                }
            }

            // BeyannameTakip güncelle (sadece dosya varsa)
            if (Object.keys(files).length > 0) {
                const existing = await prisma.beyanname_takip.findUnique({
                    where: { customerId_year_month: { customerId: customer.id, year: docYear, month: docMonth } }
                });

                const currentBeyannameler = (existing?.beyannameler as any) || {};

                const metaData = {
                    beyannameTuru: beyanname.beyannameTuru,
                    yuklemeZamani: beyanname.yuklemeZamani,
                    mukellef: (beyanname.unvan || beyanname.adSoyadUnvan || "").substring(0, 30),
                    unvan: (beyanname.unvan || beyanname.adSoyadUnvan || "").substring(0, 30), // UI için
                    donem: beyanname.donem || beyanname.vergilendirmeDonemi,
                    vknTckn: beyanname.tcVkn
                };

                const updatedBeyannameler = {
                    ...currentBeyannameler,
                    [turKod]: {
                        status: "verildi",
                        meta: metaData,
                        files
                    }
                };

                // ═══════════════════════════════════════════════════════════════════
                // TRANSACTION - BeyannameTakip + Kontrol Tablolari
                // Birisi fail ederse tümü rollback edilir (data consistency)
                // ═══════════════════════════════════════════════════════════════════
                try {
                    await prisma.$transaction(async (tx) => {
                        // 1. BeyannameTakip upsert (HER ZAMAN)
                        // GGECICI/KGECICI için docYear/docMonth kullan (çeyreklik dönem)
                        await tx.beyanname_takip.upsert({
                            where: { customerId_year_month: { customerId: customer.id, year: docYear, month: docMonth } },
                            update: { beyannameler: updatedBeyannameler, updatedAt: new Date() },
                            create: { id: crypto.randomUUID(), tenantId, customerId: customer.id, year: docYear, month: docMonth, beyannameler: updatedBeyannameler, updatedAt: new Date() }
                        });

                        // 2. SGK KONTROL - MUHSGK beyannamesi icin parsed data'yi kaydet
                        if (turKod === 'MUHSGK' && (beyanname.sgkTahakkukParsed || beyanname.sgkHizmetParsed || beyanname.sgkTahakkukToplam || beyanname.sgkHizmetToplam)) {
                            // Toplam varsa kullan, yoksa tekil parse sonucu (geriye uyumluluk)
                            const tahakkukToplam = beyanname.sgkTahakkukToplam;
                            const hizmetToplam = beyanname.sgkHizmetToplam;
                            const tahakkukParsed = beyanname.sgkTahakkukParsed;
                            const hizmetParsed = beyanname.sgkHizmetParsed;

                            // İşçi sayıları: Toplam > Tekil
                            const tahakkukIsci = tahakkukToplam?.isciSayisi ?? tahakkukParsed?.isciSayisi ?? null;
                            const hizmetIsci = hizmetToplam?.isciSayisi ?? hizmetParsed?.isciSayisi ?? null;

                            // Net tutar: Toplam > Tekil
                            const netTutar = tahakkukToplam?.netTutar ?? tahakkukParsed?.netTutar ?? null;

                            // Gün sayısı: Toplam > Tekil (ilk dosyadan)
                            const gunSayisi = tahakkukToplam?.gunSayisi ?? tahakkukParsed?.gunSayisi ?? null;

                            // Tarihleri Date objesine cevir (ilk dosyadan - tekil parse'dan)
                            let hizmetOnayDate: Date | null = null;
                            let tahakkukKabulDate: Date | null = null;

                            if (hizmetParsed?.onayTarihi) {
                                hizmetOnayDate = new Date(hizmetParsed.onayTarihi);
                            }
                            if (tahakkukParsed?.kabulTarihi) {
                                tahakkukKabulDate = new Date(tahakkukParsed.kabulTarihi);
                            }

                            // Durum belirleme: Toplam veya tekil parse var mı?
                            const hasTahakkuk = tahakkukToplam || tahakkukParsed;
                            const hasHizmet = hizmetToplam || hizmetParsed;
                            let status = 'bekliyor';
                            if (hasTahakkuk && hasHizmet) {
                                status = 'gonderildi';
                            } else if (hasTahakkuk || hasHizmet) {
                                status = 'eksik';
                            }

                            // Dosya sayısını logla
                            const tahakkukDosyaSayisi = tahakkukToplam?.dosyaSayisi || (tahakkukParsed ? 1 : 0);
                            const hizmetDosyaSayisi = hizmetToplam?.dosyaSayisi || (hizmetParsed ? 1 : 0);

                            await tx.sgk_kontrol.upsert({
                                where: {
                                    customerId_year_month: { customerId: customer.id, year, month }
                                },
                                update: {
                                    hizmetIsciSayisi: hizmetIsci,
                                    hizmetOnayTarihi: hizmetOnayDate,
                                    hizmetDocumentId: files.hizmetListesi?.documentId ?? null,
                                    tahakkukIsciSayisi: tahakkukIsci,
                                    tahakkukGunSayisi: gunSayisi,
                                    tahakkukNetTutar: netTutar,
                                    tahakkukKabulTarihi: tahakkukKabulDate,
                                    tahakkukDocumentId: files.sgkTahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                },
                                create: {
                                    id: crypto.randomUUID(),
                                    tenantId,
                                    customerId: customer.id,
                                    year,
                                    month,
                                    hizmetIsciSayisi: hizmetIsci,
                                    hizmetOnayTarihi: hizmetOnayDate,
                                    hizmetDocumentId: files.hizmetListesi?.documentId ?? null,
                                    tahakkukIsciSayisi: tahakkukIsci,
                                    tahakkukGunSayisi: gunSayisi,
                                    tahakkukNetTutar: netTutar,
                                    tahakkukKabulTarihi: tahakkukKabulDate,
                                    tahakkukDocumentId: files.sgkTahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                }
                            });

                            // Detaylı log: Çoklu dosya durumunu göster
                            if (tahakkukDosyaSayisi > 1 || hizmetDosyaSayisi > 1) {
                                console.log(`[PROCESS] 📊 SGK Kontrol kaydedildi: ${customer.unvan} (${month}/${year}) - TOPLAM: Tahakkuk ${tahakkukDosyaSayisi} dosya, Hizmet ${hizmetDosyaSayisi} dosya`);
                            } else {
                                console.log(`[PROCESS] 📊 SGK Kontrol kaydedildi: ${customer.unvan} (${month}/${year})`);
                            }
                        }

                        // 3. KDV KONTROL - KDV1 beyannamesi icin parsed data'yi kaydet
                        if (turKod === 'KDV1' && beyanname.kdvTahakkukParsed) {
                            const kdvParsed = beyanname.kdvTahakkukParsed;

                            // Tarihleri Date objesine cevir
                            let beyanTarihDate: Date | null = null;
                            let vadeDate: Date | null = null;

                            if (kdvParsed.beyanTarihi) {
                                beyanTarihDate = new Date(kdvParsed.beyanTarihi);
                            }
                            if (kdvParsed.vade) {
                                vadeDate = new Date(kdvParsed.vade);
                            }

                            // Durum belirleme: kdvTahakkukParsed varsa beyanname verilmiş demektir
                            // Tutarlar 0 olsa bile PDF parse edilmişse "verildi" statüsü verilmeli
                            const status = 'verildi';

                            await tx.kdv_kontrol.upsert({
                                where: {
                                    customerId_year_month: { customerId: customer.id, year, month }
                                },
                                update: {
                                    kdvMatrah: kdvParsed.kdvMatrah || null,
                                    tahakkukEden: kdvParsed.tahakkukEden || null,
                                    mahsupEdilen: kdvParsed.mahsupEdilen || null,
                                    odenecek: kdvParsed.odenecek || null,
                                    devredenKdv: kdvParsed.devredenKdv || null,
                                    damgaVergisi: kdvParsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                },
                                create: {
                                    id: crypto.randomUUID(),
                                    tenantId,
                                    customerId: customer.id,
                                    year,
                                    month,
                                    kdvMatrah: kdvParsed.kdvMatrah || null,
                                    tahakkukEden: kdvParsed.tahakkukEden || null,
                                    mahsupEdilen: kdvParsed.mahsupEdilen || null,
                                    odenecek: kdvParsed.odenecek || null,
                                    devredenKdv: kdvParsed.devredenKdv || null,
                                    damgaVergisi: kdvParsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                }
                            });

                            console.log(`[PROCESS] 📊 KDV Kontrol kaydedildi: ${customer.unvan} (${month}/${year}) - Matrah: ${kdvParsed.kdvMatrah}, Ödenecek: ${kdvParsed.odenecek}`);
                        }

                        // 4. KDV2 KONTROL - KDV2 (Tevkifat) beyannamesi icin parsed data'yi kaydet
                        if (turKod === 'KDV2' && beyanname.kdv2TahakkukParsed) {
                            const kdv2Parsed = beyanname.kdv2TahakkukParsed;

                            // Tarihleri Date objesine cevir
                            let beyanTarihDate: Date | null = null;
                            let vadeDate: Date | null = null;

                            if (kdv2Parsed.beyanTarihi) {
                                beyanTarihDate = new Date(kdv2Parsed.beyanTarihi);
                            }
                            if (kdv2Parsed.vade) {
                                vadeDate = new Date(kdv2Parsed.vade);
                            }

                            // Durum belirleme: kdv2TahakkukParsed varsa beyanname verilmiş demektir
                            const status = 'verildi';

                            await tx.kdv2_kontrol.upsert({
                                where: {
                                    customerId_year_month: { customerId: customer.id, year, month }
                                },
                                update: {
                                    kdvMatrah: kdv2Parsed.kdvMatrah || null,
                                    tahakkukEden: kdv2Parsed.tahakkukEden || null,
                                    mahsupEdilen: kdv2Parsed.mahsupEdilen || null,
                                    odenecek: kdv2Parsed.odenecek || null,
                                    devredenKdv: kdv2Parsed.devredenKdv || null,
                                    damgaVergisi: kdv2Parsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                },
                                create: {
                                    id: crypto.randomUUID(),
                                    tenantId,
                                    customerId: customer.id,
                                    year,
                                    month,
                                    kdvMatrah: kdv2Parsed.kdvMatrah || null,
                                    tahakkukEden: kdv2Parsed.tahakkukEden || null,
                                    mahsupEdilen: kdv2Parsed.mahsupEdilen || null,
                                    odenecek: kdv2Parsed.odenecek || null,
                                    devredenKdv: kdv2Parsed.devredenKdv || null,
                                    damgaVergisi: kdv2Parsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                }
                            });

                            console.log(`[PROCESS] 📊 KDV2 Kontrol kaydedildi: ${customer.unvan} (${month}/${year}) - Matrah: ${kdv2Parsed.kdvMatrah}, Ödenecek: ${kdv2Parsed.odenecek}`);
                        }

                        // 5. KDV9015 KONTROL - KDV9015 (KDV Tevkifatı) beyannamesi icin parsed data'yi kaydet
                        if (turKod === 'KDV9015' && beyanname.kdv9015TahakkukParsed) {
                            const kdv9015Parsed = beyanname.kdv9015TahakkukParsed;

                            // Tarihleri Date objesine cevir
                            let beyanTarihDate: Date | null = null;
                            let vadeDate: Date | null = null;

                            if (kdv9015Parsed.beyanTarihi) {
                                beyanTarihDate = new Date(kdv9015Parsed.beyanTarihi);
                            }
                            if (kdv9015Parsed.vade) {
                                vadeDate = new Date(kdv9015Parsed.vade);
                            }

                            // Durum belirleme: kdv9015TahakkukParsed varsa beyanname verilmiş demektir
                            const status = 'verildi';

                            await tx.kdv9015_kontrol.upsert({
                                where: {
                                    customerId_year_month: { customerId: customer.id, year, month }
                                },
                                update: {
                                    kdvMatrah: kdv9015Parsed.kdvMatrah || null,
                                    tahakkukEden: kdv9015Parsed.tahakkukEden || null,
                                    mahsupEdilen: kdv9015Parsed.mahsupEdilen || null,
                                    odenecek: kdv9015Parsed.odenecek || null,
                                    devredenKdv: kdv9015Parsed.devredenKdv || null,
                                    damgaVergisi: kdv9015Parsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                },
                                create: {
                                    id: crypto.randomUUID(),
                                    tenantId,
                                    customerId: customer.id,
                                    year,
                                    month,
                                    kdvMatrah: kdv9015Parsed.kdvMatrah || null,
                                    tahakkukEden: kdv9015Parsed.tahakkukEden || null,
                                    mahsupEdilen: kdv9015Parsed.mahsupEdilen || null,
                                    odenecek: kdv9015Parsed.odenecek || null,
                                    devredenKdv: kdv9015Parsed.devredenKdv || null,
                                    damgaVergisi: kdv9015Parsed.damgaVergisi || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                }
                            });

                            console.log(`[PROCESS] 📊 KDV9015 Kontrol kaydedildi: ${customer.unvan} (${month}/${year}) - Matrah: ${kdv9015Parsed.kdvMatrah}, Ödenecek: ${kdv9015Parsed.odenecek}`);
                        }

                        // 6. GEÇİCİ VERGİ KONTROL - GGECICI veya KGECICI beyannamesi icin parsed data'yi kaydet
                        if ((turKod === 'GGECICI' || turKod === 'KGECICI') && beyanname.geciciVergiTahakkukParsed) {
                            const geciciParsed = beyanname.geciciVergiTahakkukParsed;

                            let beyanTarihDate: Date | null = null;
                            let vadeDate: Date | null = null;

                            if (geciciParsed.beyanTarihi) {
                                beyanTarihDate = new Date(geciciParsed.beyanTarihi);
                            }
                            if (geciciParsed.vade) {
                                vadeDate = new Date(geciciParsed.vade);
                            }

                            // Geçici vergi çeyreklik: year/month parse'dan al
                            const gvYear = geciciParsed.year || year;
                            const gvMonth = geciciParsed.month || month;

                            const status = 'verildi';

                            await tx.gecici_vergi_kontrol.upsert({
                                where: {
                                    customerId_year_month_vergiTuru: {
                                        customerId: customer.id,
                                        year: gvYear,
                                        month: gvMonth,
                                        vergiTuru: turKod
                                    }
                                },
                                update: {
                                    vergilendirmeDonemi: geciciParsed.vergilendirmeDonemi || null,
                                    matrah: geciciParsed.matrah || null,
                                    tahakkukEden: geciciParsed.tahakkukEden || null,
                                    mahsupEdilen: geciciParsed.mahsupEdilen || null,
                                    odenecek: geciciParsed.odenecek || null,
                                    damgaVergisi1047: geciciParsed.damgaVergisi1047 || null,
                                    damgaVergisi1048: geciciParsed.damgaVergisi1048 || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                },
                                create: {
                                    id: crypto.randomUUID(),
                                    tenantId,
                                    customerId: customer.id,
                                    year: gvYear,
                                    month: gvMonth,
                                    vergiTuru: turKod,
                                    vergilendirmeDonemi: geciciParsed.vergilendirmeDonemi || null,
                                    matrah: geciciParsed.matrah || null,
                                    tahakkukEden: geciciParsed.tahakkukEden || null,
                                    mahsupEdilen: geciciParsed.mahsupEdilen || null,
                                    odenecek: geciciParsed.odenecek || null,
                                    damgaVergisi1047: geciciParsed.damgaVergisi1047 || null,
                                    damgaVergisi1048: geciciParsed.damgaVergisi1048 || null,
                                    vade: vadeDate,
                                    beyanTarihi: beyanTarihDate,
                                    tahakkukDocumentId: files.tahakkuk?.documentId ?? null,
                                    status,
                                    updatedAt: new Date()
                                }
                            });

                            console.log(`[PROCESS] 📊 Geçici Vergi Kontrol kaydedildi: ${customer.unvan} (${gvMonth}/${gvYear}) - ${turKod}, Matrah: ${geciciParsed.matrah}, Ödenecek: ${geciciParsed.odenecek}`);
                        }
                    }, { timeout: 10000 });

                    console.log(`[PROCESS] ✅ Transaction başarılı: ${customer.unvan} (${docMonth}/${docYear})`);
                } catch (transactionError) {
                    console.error(`[PROCESS] ❌ Transaction hatası:`, transactionError);
                    // Transaction hatası - tüm upsert'ler rollback edildi
                    throw transactionError;
                }
            }

            return { matched: true, filesCount: localFilesProcessed, skippedCount: localSkipped };
        };

        // Tüm beyannameleri paralel işle (batch size: 5 - DB yükünü azaltmak için)
        const BATCH_SIZE = 5;
        for (let i = 0; i < beyannameler.length; i += BATCH_SIZE) {
            const batch = beyannameler.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(processBeyanname));

            for (const result of results) {
                if (result.matched) {
                    matched++;
                    filesProcessed += result.filesCount;
                    skipped += result.skippedCount;
                } else {
                    unmatched++;
                    if (result.unmatchedInfo) {
                        unmatchedDetails.push(result.unmatchedInfo);
                    }
                }
            }

            // Progress log
            console.log(`[PROCESS] Batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}/${Math.ceil(beyannameler.length / BATCH_SIZE)} tamamlandı`);
        }

        const processingDuration = Date.now() - processingStartTime;
        console.log(`[PROCESS] Done: ${matched} matched, ${unmatched} unmatched, ${filesProcessed} files saved, ${skipped} skipped (${processingDuration}ms)`);

        // Eşleşmeyen müşterileri detaylı logla
        if (unmatchedDetails.length > 0) {
            console.log(`[PROCESS] ⚠️ Eşleşmeyen müşteriler:`);
            for (const detail of unmatchedDetails) {
                console.log(`  - VKN: ${detail.tcVkn} | Unvan: ${detail.unvan} | Tür: ${detail.beyannameTuru}`);
            }
        }

        return NextResponse.json({
            success: true,
            stats: { matched, unmatched, filesProcessed },
            unmatchedDetails: unmatchedDetails.slice(0, 50) // En fazla 50 detay döndür
        });

    } catch (error) {
        console.error("[PROCESS] Error:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
