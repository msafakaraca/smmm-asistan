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
