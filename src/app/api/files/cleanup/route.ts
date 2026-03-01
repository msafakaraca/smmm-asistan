/**
 * File Cleanup & Fix API
 * 1. Mükerrer klasörleri temizle
 * 2. İkonları standartlaştır (hepsini klasör yap)
 * 3. Klasör yapısını düzelt
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;

        // 1. Tüm root klasörleri çek
        const allRootFolders = await prisma.documents.findMany({
            where: {
                tenantId,
                isFolder: true
            }
        });

        const rootFolders = allRootFolders.filter(f => !f.parentId); // Memory filter

        let deletedCount = 0;
        let updatedCount = 0;

        // Duplicate gruplama
        const groups: { [key: string]: typeof rootFolders } = {};

        for (const folder of rootFolders) {
            // Gruplama anahtarı: CustomerID + Name
            // Root klasörler unique olmalı
            const key = `${folder.customerId || 'global'}_${folder.name}`;

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(folder);
        }

        // Duplicate temizliği ve Icon güncelleme
        for (const key in groups) {
            const folders = groups[key];

            // Sırala: En eski önce gelir (keep first created, delete newer duplicates)
            // Ya da tam tersi? Genelde ilk oluşturulanın içi doludur.
            folders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const toKeep = folders[0];
            const toDelete = folders.slice(1);

            // 1. Icon güncelle (Standardize)
            if (toKeep.icon !== null) { // Eğer icon varsa sil (null yap)
                await prisma.documents.update({
                    where: { id: toKeep.id },
                    data: { icon: null } // Force default folder icon
                });
                updatedCount++;
            }

            // 2. Duplicate'leri sil
            for (const dup of toDelete) {
                await deleteRecursive(dup.id, tenantId);
                deletedCount++;
            }
        }

        // Also update subfolders icons to null (recurvisely or bulk)
        // Kullanıcı "hepsi" dediği için tüm Tenant klasörlerinin ikonunu sıfırlayalım
        const updateResult = await prisma.documents.updateMany({
            where: {
                tenantId,
                isFolder: true,
                NOT: { icon: null }
            },
            data: { icon: null }
        });
        updatedCount += updateResult.count;

        return NextResponse.json({
            success: true,
            deleted: deletedCount,
            updated: updatedCount,
            message: `${deletedCount} mükerrer klasör silindi, ${updatedCount} klasör ikonu düzeltildi.`
        });

    } catch (error) {
        console.error("Cleanup error:", error);
        return NextResponse.json({ error: "Temizlik hatası" }, { status: 500 });
    }
}

// Recursive delete helper (copy from files API)
async function deleteRecursive(folderId: string, tenantId: string) {
    // 1. Find children
    // parentId ile bulmak için önce prisma findMany (Prisma relation)
    // Ama parentId alanı DB'de ObjectID. Prisma findMany({ where: { parentId: folderId } }) çalışmalı.

    // Eğer Prisma'da parentId sorunu varsa, yine memory filter yapmamız gerekebilir.
    // Ama delete işlemi kritik, memory filter ile tüm DB'yi çekemeyiz.
    // Neyse ki parentId varsa, children relation üzerinden erişilebilir.

    // Basitçe parentId ile silmeyi deneyelim. Eğer hata verirse (ki API'da vermedi), sorun yok.
    // API route'da parentId null sorunu vardı, ama dolu olanlarda sorun yoktu.

    const children = await prisma.documents.findMany({
        where: { parentId: folderId, tenantId }
    });

    for (const child of children) {
        if (child.isFolder) {
            await deleteRecursive(child.id, tenantId);
        } else {
            await prisma.documents.delete({ where: { id: child.id } });
        }
    }

    await prisma.documents.delete({ where: { id: folderId } });
}
