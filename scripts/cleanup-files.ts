/**
 * Dosya Temizlik Script'i
 *
 * Bu script:
 * 1. Document tablosundaki tüm dosyaları siler (klasörler hariç)
 * 2. Supabase Storage'daki dosyaları temizler
 * 3. Boş alt klasörleri siler
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const BUCKET_NAME = 'smmm-documents';

async function main() {
    console.log('🧹 Dosya temizliği başlatılıyor...\n');

    // Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Supabase environment variables eksik!');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Mevcut durumu göster
    console.log('📊 Mevcut durum kontrol ediliyor...');

    const fileCount = await prisma.document.count({
        where: { isFolder: false }
    });

    const folderCount = await prisma.document.count({
        where: { isFolder: true }
    });

    console.log(`   - Toplam dosya: ${fileCount}`);
    console.log(`   - Toplam klasör: ${folderCount}\n`);

    if (fileCount === 0) {
        console.log('✅ Silinecek dosya yok, temizlik gerekmiyor.\n');
    } else {
        // 2. Supabase Storage'daki dosyaları temizle
        console.log('☁️ Supabase Storage temizleniyor...');

        // Tüm tenant'ları bul
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true }
        });

        let storageDeleted = 0;

        for (const tenant of tenants) {
            try {
                // Tenant klasörünü listele
                const { data: items, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .list(tenant.id, { limit: 1000 });

                if (error) {
                    console.log(`   ⚠️ ${tenant.name}: Listeleme hatası - ${error.message}`);
                    continue;
                }

                if (items && items.length > 0) {
                    // Recursive olarak tüm dosyaları bul ve sil
                    const allPaths = await getAllFilePaths(supabase, tenant.id);

                    if (allPaths.length > 0) {
                        // Batch olarak sil (100'lük gruplar)
                        for (let i = 0; i < allPaths.length; i += 100) {
                            const batch = allPaths.slice(i, i + 100);
                            const { error: deleteError } = await supabase.storage
                                .from(BUCKET_NAME)
                                .remove(batch);

                            if (deleteError) {
                                console.log(`   ⚠️ Silme hatası: ${deleteError.message}`);
                            } else {
                                storageDeleted += batch.length;
                            }
                        }
                        console.log(`   ✓ ${tenant.name}: ${allPaths.length} dosya silindi`);
                    }
                }
            } catch (e) {
                console.log(`   ⚠️ ${tenant.name}: Hata - ${e}`);
            }
        }

        console.log(`   Toplam: ${storageDeleted} storage dosyası silindi\n`);

        // 3. Database'deki dosya kayıtlarını sil
        console.log('🗑️ Database dosya kayıtları siliniyor...');

        const deletedFiles = await prisma.document.deleteMany({
            where: { isFolder: false }
        });

        console.log(`   ✓ ${deletedFiles.count} dosya kaydı silindi\n`);

        // 4. Boş alt klasörleri temizle (yıl/ay klasörleri)
        console.log('📁 Boş alt klasörler temizleniyor...');

        let totalEmptyDeleted = 0;
        let hasMore = true;
        let iteration = 0;
        const maxIterations = 20;

        while (hasMore && iteration < maxIterations) {
            iteration++;

            // Sadece "FOLDER" tipindeki klasörleri kontrol et (standart klasörler hariç)
            const emptyFolders = await prisma.document.findMany({
                where: {
                    isFolder: true,
                    type: 'FOLDER', // Sadece alt klasörler (yıl, ay, tür)
                    parentId: { not: null }
                },
                select: { id: true, name: true }
            });

            const foldersToDelete: string[] = [];

            for (const folder of emptyFolders) {
                const childCount = await prisma.document.count({
                    where: { parentId: folder.id }
                });

                if (childCount === 0) {
                    foldersToDelete.push(folder.id);
                }
            }

            if (foldersToDelete.length === 0) {
                hasMore = false;
            } else {
                await prisma.document.deleteMany({
                    where: { id: { in: foldersToDelete } }
                });
                totalEmptyDeleted += foldersToDelete.length;
                console.log(`   ✓ İterasyon ${iteration}: ${foldersToDelete.length} boş klasör silindi`);
            }
        }

        console.log(`   Toplam: ${totalEmptyDeleted} boş klasör silindi\n`);
    }

    // 5. Son durumu göster
    console.log('📊 Son durum:');

    const finalFileCount = await prisma.document.count({
        where: { isFolder: false }
    });

    const finalFolderCount = await prisma.document.count({
        where: { isFolder: true }
    });

    console.log(`   - Kalan dosya: ${finalFileCount}`);
    console.log(`   - Kalan klasör: ${finalFolderCount}`);

    console.log('\n✅ Temizlik tamamlandı!');
}

/**
 * Recursive olarak tüm dosya path'lerini bulur
 */
async function getAllFilePaths(supabase: any, basePath: string): Promise<string[]> {
    const allPaths: string[] = [];

    async function listRecursive(path: string) {
        const { data: items, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(path, { limit: 1000 });

        if (error || !items) return;

        for (const item of items) {
            const itemPath = path ? `${path}/${item.name}` : item.name;

            if (item.id) {
                // Bu bir klasör, recursive devam et
                await listRecursive(itemPath);
            } else {
                // Bu bir dosya
                allPaths.push(itemPath);
            }
        }
    }

    await listRecursive(basePath);
    return allPaths;
}

main()
    .catch((e) => {
        console.error('❌ Hata:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
