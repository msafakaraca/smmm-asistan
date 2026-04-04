/**
 * File System Utilities
 * Müşteri klasörlerinin otomatik oluşturulması ve yönetimi
 */

import { prisma } from "@/lib/db";

// Standart alt klasörler (4 klasör)
const STANDARD_SUBFOLDERS = [
    { name: "Banka Evrakları", icon: "bank", type: "banka" },
    { name: "Beyannameler", icon: "file-text", type: "beyanname" },
    { name: "Tahakkuklar", icon: "receipt", type: "tahakkuk" },
    { name: "SGK Tahakkuk ve Hizmet Listesi", icon: "shield", type: "sgk" }
];

/**
 * Müşteri adını dosya sistemi için uygun hale getirir
 * Tam ünvan kullanılır (dosya sistemi için yasaklı karakterler temizlenir)
 */
export function sanitizeCustomerName(unvan: string, sirketTipi: string): string {
    if (!unvan) return "Isimsiz";

    // Dosya sisteminde yasaklı karakterleri temizle, tam ünvan kullan
    return unvan
        .replace(/[<>:"/\\|?*]/g, "") // Dosya sisteminde yasaklı karakterler
        .replace(/\s+/g, " ") // Çoklu boşlukları tek boşluğa
        .trim();
}

/**
 * Müşteri için kök klasör oluşturur (yoksa)
 */
export async function ensureCustomerFolder(
    tenantId: string,
    customerId: string,
    customerName: string,
    sirketTipi: string
): Promise<string> {
    const folderName = sanitizeCustomerName(customerName, sirketTipi);

    // Mevcut kök klasörü kontrol et
    let rootFolder = await prisma.documents.findFirst({
        where: {
            tenantId,
            customerId,
            isFolder: true,
            parentId: null
        }
    });

    // Yoksa oluştur
    if (!rootFolder) {
        rootFolder = await prisma.documents.create({
            data: {
                name: folderName,
                type: "folder",
                isFolder: true,
                customerId,
                tenantId,
                icon: null, // Varsayılan klasör ikonu
                size: 0,
                storage: "local",
                parentId: null
            }
        });

        // Standart alt klasörleri oluştur
        for (const subfolder of STANDARD_SUBFOLDERS) {
            await prisma.documents.create({
                data: {
                    name: subfolder.name,
                    type: subfolder.type,
                    isFolder: true,
                    parentId: rootFolder.id,
                    customerId,
                    tenantId,
                    // Alt klasör ikonları kalsın mı? Kullanıcı hepsi dedi ama bunlar faydalı.
                    // Şimdilik null yapalım, kullanıcı standart istiyor.
                    icon: null,
                    size: 0,
                    storage: "local"
                }
            });
        }
    }

    return rootFolder.id;
}

/**
 * Tüm müşteriler için klasör yapısını senkronize eder
 */
export async function syncAllCustomerFolders(
    tenantId: string,
    onProgress?: (percent: number, message: string) => void
): Promise<{ created: number; existing: number }> {
    onProgress?.(10, "Müşteriler yükleniyor...");

    const customers = await prisma.customers.findMany({
        where: { tenantId },
        select: { id: true, unvan: true, sirketTipi: true }
    });

    onProgress?.(20, `${customers.length} müşteri bulundu`);

    let created = 0;
    let existing = 0;
    const total = customers.length;

    for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        const progress = 20 + Math.floor((i / total) * 70); // 20-90% arası

        onProgress?.(progress, `${customer.unvan} kontrol ediliyor...`);

        // Check existence efficiently
        // Using `findFirst` with `parentId: null` explicitly by correcting the type issue or using raw query if needed?
        // Actually, Prisma schema for Document says parentId is String?, so we can query it.
        // It might be an issue with MongoDB and null filtering or previous misinterpretation.
        // Let's try direct query. If `parentId` in schema is nullable, we can search for it.

        const existingFolder = await prisma.documents.findFirst({
            where: {
                tenantId,
                customerId: customer.id,
                isFolder: true,
                parentId: null
            }
        });

        if (existingFolder) {
            existing++;
        } else {
            await ensureCustomerFolder(
                tenantId,
                customer.id,
                customer.unvan,
                customer.sirketTipi
            );
            created++;
        }
    }

    onProgress?.(95, "Senkronizasyon tamamlanıyor...");
    return { created, existing };
}

/**
 * Belirli bir klasörün yolunu (path) döndürür
 */
export async function getFolderPath(folderId: string): Promise<string> {
    const parts: string[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
        const doc: { name: string; parentId: string | null } | null = await prisma.documents.findUnique({
            where: { id: currentId },
            select: { name: true, parentId: true }
        });

        if (!doc) break;
        parts.unshift(doc.name);
        currentId = doc.parentId;
    }

    return parts.join(" / ");
}

/**
 * Müşterinin belirli bir alt klasörünü bul veya oluştur
 */
export async function getOrCreateSubfolder(
    tenantId: string,
    customerId: string,
    subfolderType: string
): Promise<string | null> {
    // Önce müşteri kök klasörünü bul
    const rootFolder = await prisma.documents.findFirst({
        where: {
            tenantId,
            customerId,
            isFolder: true,
            parentId: null
        }
    });

    if (!rootFolder) return null;

    // Alt klasörü bul
    const subfolder = await prisma.documents.findFirst({
        where: {
            tenantId,
            parentId: rootFolder.id,
            type: subfolderType,
            isFolder: true
        }
    }) as any;

    return subfolder?.id || null;
}

/**
 * Batch olarak müşteri klasörlerini oluşturur
 * OPTIMIZED: Tek seferde tüm klasörleri createMany ile oluşturur
 * - Eski: 98 query (49 müşteri × 2)
 * - Yeni: 2 query (1 root + 1 subfolders)
 */
export async function createCustomerFoldersBatch(
    tenantId: string,
    customers: Array<{ id: string; unvan: string; sirketTipi: string }>,
    tx?: any // Prisma transaction client
): Promise<{ success: boolean; created: number; errors: string[] }> {
    const db = tx || prisma;
    const errors: string[] = [];

    if (customers.length === 0) {
        return { success: true, created: 0, errors: [] };
    }

    try {
        const { randomUUID } = await import("crypto");
        const now = new Date();

        // 1. Tüm kök klasörleri hazırla (müşteri başına 1)
        const rootFolders: Array<{
            id: string;
            customerId: string;
            name: string;
            type: string;
            isFolder: boolean;
            tenantId: string;
            icon: null;
            size: number;
            storage: string;
            parentId: null;
            updatedAt: Date;
        }> = [];

        // customerId -> rootFolderId mapping (alt klasörler için)
        const customerToRootId = new Map<string, string>();

        for (const customer of customers) {
            const rootId = randomUUID();
            customerToRootId.set(customer.id, rootId);

            rootFolders.push({
                id: rootId,
                customerId: customer.id,
                name: sanitizeCustomerName(customer.unvan, customer.sirketTipi),
                type: "folder",
                isFolder: true,
                tenantId,
                icon: null,
                size: 0,
                storage: "local",
                parentId: null,
                updatedAt: now
            });
        }

        // 2. Tüm alt klasörleri hazırla (müşteri başına 4)
        const subfolders: Array<{
            id: string;
            name: string;
            type: string;
            isFolder: boolean;
            parentId: string;
            customerId: string;
            tenantId: string;
            icon: null;
            size: number;
            storage: string;
            updatedAt: Date;
        }> = [];

        for (const customer of customers) {
            const rootId = customerToRootId.get(customer.id)!;
            for (const subfolder of STANDARD_SUBFOLDERS) {
                subfolders.push({
                    id: randomUUID(),
                    name: subfolder.name,
                    type: subfolder.type,
                    isFolder: true,
                    parentId: rootId,
                    customerId: customer.id,
                    tenantId,
                    icon: null,
                    size: 0,
                    storage: "local",
                    updatedAt: now
                });
            }
        }

        // 3. Tek seferde kök klasörleri oluştur
        await db.documents.createMany({
            data: rootFolders,
            skipDuplicates: true
        });

        // 4. Tek seferde alt klasörleri oluştur
        await db.documents.createMany({
            data: subfolders,
            skipDuplicates: true
        });

        return { success: true, created: customers.length, errors: [] };
    } catch (error) {
        errors.push((error as Error).message);
        return { success: false, created: 0, errors };
    }
}

// ═══════════════════════════════════════════════════════════════════
// BEYANNAME/TAHAKKUK KLASÖR ZİNCİRİ
// Hiyerarşi: Müşteri Kök → Ana Klasör → Yıl → TürKodu → dosya.pdf
// ═══════════════════════════════════════════════════════════════════

/**
 * Race-condition-safe klasör oluşturma.
 * findFirst → create → P2002 catch → findFirst retry
 */
export async function getOrCreateFolderSafe(
    tenantId: string,
    customerId: string,
    parentId: string,
    name: string,
    type: string = "FOLDER",
    extraData?: { year?: number; month?: number }
): Promise<string> {
    // 1. Önce var mı bak
    const existing = await prisma.documents.findFirst({
        where: { tenantId, customerId, parentId, name, isFolder: true },
        select: { id: true }
    });
    if (existing) return existing.id;

    // 2. Yoksa oluştur
    try {
        const { randomUUID } = await import("crypto");
        const created = await prisma.documents.create({
            data: {
                id: randomUUID(),
                tenantId,
                customerId,
                parentId,
                name,
                isFolder: true,
                type,
                size: 0,
                storage: "local",
                updatedAt: new Date(),
                ...extraData
            }
        });
        return created.id;
    } catch (e: unknown) {
        // 3. Race condition — başka bir request aynı anda oluşturduysa
        const error = e as { code?: string; message?: string };
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            const found = await prisma.documents.findFirst({
                where: { tenantId, customerId, parentId, name, isFolder: true },
                select: { id: true }
            });
            if (found) return found.id;
        }
        throw e;
    }
}

/**
 * Beyanname/Tahakkuk klasör zinciri oluşturur.
 * Hiyerarşi: Müşteri Kök → Ana Klasör → Yıl → TürKodu
 *
 * @returns TürKodu klasörünün ID'si (dosyalar buraya kaydedilecek)
 */
export async function ensureBeyannameFolderChain(
    tenantId: string,
    customerId: string,
    mainFolderName: "Beyannameler" | "Tahakkuklar",
    mainFolderType: "beyanname" | "tahakkuk",
    year: number,
    turKodu: string
): Promise<string> {
    // 1. Müşteri kök klasörünü bul
    const customerRoot = await prisma.documents.findFirst({
        where: { tenantId, customerId, isFolder: true, parentId: null },
        select: { id: true }
    });
    if (!customerRoot) {
        throw new Error(`Müşteri kök klasörü bulunamadı: ${customerId}`);
    }

    // 2. Ana klasör (Beyannameler veya Tahakkuklar)
    const mainFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, customerRoot.id,
        mainFolderName, mainFolderType
    );

    // 3. Yıl klasörü (2024, 2025, 2026)
    const yearFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, mainFolderId,
        String(year), "FOLDER",
        { year }
    );

    // 4. TürKodu klasörü (KDV1, MUHSGK, GGECICI)
    const cleanTurKodu = turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
    const turKoduFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, yearFolderId,
        cleanTurKodu, "FOLDER"
    );

    return turKoduFolderId;
}

// Aynı Node.js process içindeki concurrent request'ler için module-level lock
const folderCreationLocks = new Map<string, Promise<string>>();

/**
 * ensureBeyannameFolderChain'in lock korumalı versiyonu.
 * Aynı müşteri + yıl + tür için concurrent çağrılarda tek promise paylaşılır.
 */
export async function ensureBeyannameFolderChainLocked(
    tenantId: string,
    customerId: string,
    mainFolderName: "Beyannameler" | "Tahakkuklar",
    mainFolderType: "beyanname" | "tahakkuk",
    year: number,
    turKodu: string
): Promise<string> {
    const cleanTurKodu = turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
    const lockKey = `${tenantId}:${customerId}:${mainFolderName}:${year}:${cleanTurKodu}`;

    const existing = folderCreationLocks.get(lockKey);
    if (existing) return existing;

    const promise = ensureBeyannameFolderChain(
        tenantId, customerId, mainFolderName, mainFolderType, year, turKodu
    );
    folderCreationLocks.set(lockKey, promise);

    try {
        return await promise;
    } finally {
        folderCreationLocks.delete(lockKey);
    }
}

// ═══════════════════════════════════════════════════════════════════
// SGK KLASÖR ZİNCİRİ
// Hiyerarşi: Müşteri Kök → SGK Tahakkuk ve Hizmet Listesi → Tahakkuk|Hizmet Listesi → Ay/Yıl
// ═══════════════════════════════════════════════════════════════════

/**
 * SGK dosyaları için klasör zinciri oluşturur.
 * Hiyerarşi: Müşteri Kök → SGK Ana Klasör → Tip Klasörü → Ay/Yıl
 *
 * @returns Ay/Yıl klasörünün ID'si (dosyalar buraya kaydedilecek)
 */
export async function ensureSgkFolderChain(
    tenantId: string,
    customerId: string,
    fileCategory: "SGK_TAHAKKUK" | "HIZMET_LISTESI",
    year: number,
    month: number
): Promise<string> {
    // 1. Müşteri kök klasörünü bul
    const customerRoot = await prisma.documents.findFirst({
        where: { tenantId, customerId, isFolder: true, parentId: null },
        select: { id: true }
    });
    if (!customerRoot) {
        throw new Error(`Müşteri kök klasörü bulunamadı: ${customerId}`);
    }

    // 2. SGK ana klasörü
    const sgkMainFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, customerRoot.id,
        "SGK Tahakkuk ve Hizmet Listesi", "sgk"
    );

    // 3. Tip klasörü (Tahakkuk veya Hizmet Listesi)
    const typeFolderName = fileCategory === "SGK_TAHAKKUK" ? "Tahakkuk" : "Hizmet Listesi";
    const typeFolderType = fileCategory === "SGK_TAHAKKUK" ? "sgk_tahakkuk" : "hizmet_listesi";
    const typeFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, sgkMainFolderId,
        typeFolderName, typeFolderType
    );

    // 4. Ay/Yıl klasörü (01/2026 formatı)
    const monthPadded = String(month).padStart(2, '0');
    const monthYearFolderName = `${monthPadded}/${year}`;
    const monthYearFolderId = await getOrCreateFolderSafe(
        tenantId, customerId, typeFolderId,
        monthYearFolderName, "FOLDER",
        { year, month }
    );

    return monthYearFolderId;
}

/**
 * ensureSgkFolderChain'in lock korumalı versiyonu.
 */
export async function ensureSgkFolderChainLocked(
    tenantId: string,
    customerId: string,
    fileCategory: "SGK_TAHAKKUK" | "HIZMET_LISTESI",
    year: number,
    month: number
): Promise<string> {
    const lockKey = `sgk:${tenantId}:${customerId}:${fileCategory}:${year}:${month}`;

    const existing = folderCreationLocks.get(lockKey);
    if (existing) return existing;

    const promise = ensureSgkFolderChain(
        tenantId, customerId, fileCategory, year, month
    );
    folderCreationLocks.set(lockKey, promise);

    try {
        return await promise;
    } finally {
        folderCreationLocks.delete(lockKey);
    }
}
