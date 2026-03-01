/**
 * Duplicate Document kayıtlarını tespit eder ve siler
 * Fiziksel storage dosyaları için de duplicate kontrolü yapar
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanDuplicates() {
    console.log('🔍 Duplicate document kayıtları aranıyor...\n');

    // Tüm PDF document'leri al
    const documents = await prisma.document.findMany({
        where: {
            isFolder: false,
            mimeType: 'application/pdf'
        },
        orderBy: [
            { name: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    console.log(`📄 Toplam ${documents.length} PDF document bulundu.\n`);

    // parentId + name kombinasyonuna göre grupla
    const grouped = {};
    for (const doc of documents) {
        const key = `${doc.parentId || 'root'}_${doc.name}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(doc);
    }

    // Duplicate'ları bul
    const duplicateGroups = Object.entries(grouped).filter(([key, docs]) => docs.length > 1);

    if (duplicateGroups.length === 0) {
        console.log('✅ Document tablosunda duplicate kayıt bulunamadı.\n');
    } else {
        console.log(`⚠️  ${duplicateGroups.length} grup duplicate bulundu:\n`);

        let deletedCount = 0;
        for (const [key, docs] of duplicateGroups) {
            console.log(`  📁 ${docs[0].name} (${docs.length} kopya)`);

            // İlk kaydı tut, diğerlerini sil
            const [keep, ...toDelete] = docs;
            console.log(`     ✓ Tutuluyor: ID ${keep.id} (${new Date(keep.createdAt).toLocaleString()})`);

            for (const dup of toDelete) {
                console.log(`     ✗ Siliniyor: ID ${dup.id} (${new Date(dup.createdAt).toLocaleString()})`);
                await prisma.document.delete({ where: { id: dup.id } });
                deletedCount++;
            }
        }

        console.log(`\n🗑️  Document tablosundan ${deletedCount} duplicate kayıt silindi.\n`);
    }

    // Storage klasöründeki duplicate dosyaları kontrol et
    console.log('🔍 Storage klasöründe duplicate fiziksel dosyalar kontrol ediliyor...\n');

    const storageRoot = path.join(process.cwd(), 'storage');

    if (!fs.existsSync(storageRoot)) {
        console.log('⚠️  Storage klasörü bulunamadı.\n');
        return;
    }

    // Tüm PDF dosyalarını bul
    const allPdfs = [];

    function scanDir(dir, relativePath = '') {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relPath = path.join(relativePath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDir(fullPath, relPath);
            } else if (item.toLowerCase().endsWith('.pdf')) {
                allPdfs.push({
                    name: item,
                    fullPath,
                    relativePath: relPath,
                    size: stat.size,
                    mtime: stat.mtime
                });
            }
        }
    }

    scanDir(storageRoot);

    console.log(`📄 Toplam ${allPdfs.length} PDF dosyası bulundu.\n`);

    // Aynı isim ve boyuttaki dosyaları grupla (potential duplicates)
    const fileGroups = {};
    for (const pdf of allPdfs) {
        const key = `${pdf.name}_${pdf.size}`;
        if (!fileGroups[key]) {
            fileGroups[key] = [];
        }
        fileGroups[key].push(pdf);
    }

    // Farklı klasörlerde aynı dosya var mı kontrol et
    const crossFolderDuplicates = Object.entries(fileGroups)
        .filter(([key, files]) => {
            if (files.length <= 1) return false;
            // Farklı klasörlerde mi?
            const folders = new Set(files.map(f => path.dirname(f.relativePath)));
            return folders.size > 1;
        });

    if (crossFolderDuplicates.length > 0) {
        console.log(`⚠️  ${crossFolderDuplicates.length} dosya farklı klasörlerde duplicate olarak bulundu:\n`);

        let deletedFileCount = 0;
        for (const [key, files] of crossFolderDuplicates) {
            console.log(`  📄 ${files[0].name} (${files[0].size} bytes)`);

            // En eski dosyayı tut
            files.sort((a, b) => a.mtime - b.mtime);
            const [keep, ...toDelete] = files;

            console.log(`     ✓ Tutuluyor: ${keep.relativePath}`);

            for (const dup of toDelete) {
                console.log(`     ✗ Siliniyor: ${dup.relativePath}`);
                fs.unlinkSync(dup.fullPath);
                deletedFileCount++;

                // Boş klasörleri temizle
                let parentDir = path.dirname(dup.fullPath);
                while (parentDir !== storageRoot && fs.existsSync(parentDir)) {
                    const contents = fs.readdirSync(parentDir);
                    if (contents.length === 0) {
                        fs.rmdirSync(parentDir);
                        console.log(`     📁 Boş klasör silindi: ${path.relative(storageRoot, parentDir)}`);
                        parentDir = path.dirname(parentDir);
                    } else {
                        break;
                    }
                }
            }
        }

        console.log(`\n🗑️  Storage'dan ${deletedFileCount} duplicate dosya silindi.\n`);
    } else {
        console.log('✅ Storage klasöründe cross-folder duplicate bulunamadı.\n');
    }

    console.log('✨ Temizlik tamamlandı!\n');
}

cleanDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
