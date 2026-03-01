/**
 * Düz klasör yapısındaki PDF kayıtlarını temizleme scripti
 * Prisma Client kullanarak
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanFlatPdfs() {
    try {
        console.log('🔍 Düz yapıda kaydedilmiş PDF dosyaları aranıyor...\n');

        // "Beyannameler" veya "Tahakkuklar" klasörlerini bul
        const mainFolders = await prisma.document.findMany({
            where: {
                isFolder: true,
                name: { in: ['Beyannameler', 'Tahakkuklar'] }
            }
        });

        console.log(`📁 ${mainFolders.length} ana klasör bulundu\n`);

        let totalDeleted = 0;

        for (const folder of mainFolders) {
            // Bu klasörün direkt altındaki PDF dosyalarını bul (klasör değil)
            // Bunlar düz yapı - hiyerarşik yapıda PDF'ler Yıl/Tür/Ay/ altında olmalı
            const flatPdfs = await prisma.document.findMany({
                where: {
                    parentId: folder.id,
                    isFolder: false,
                    OR: [
                        { mimeType: 'application/pdf' },
                        { name: { endsWith: '.pdf' } }
                    ]
                }
            });

            if (flatPdfs.length > 0) {
                // Müşteri bilgisini al
                const customer = await prisma.customer.findUnique({
                    where: { id: folder.customerId },
                    select: { unvan: true }
                });

                console.log(`📂 ${customer?.unvan || 'Bilinmeyen'} > ${folder.name}:`);
                console.log(`   ${flatPdfs.length} düz PDF bulundu`);

                for (const pdf of flatPdfs) {
                    console.log(`   🗑️  Siliniyor: ${pdf.name}`);

                    // Document kaydını sil
                    await prisma.document.delete({
                        where: { id: pdf.id }
                    });

                    totalDeleted++;
                }
                console.log('');
            }
        }

        console.log(`\n✅ Toplam ${totalDeleted} düz PDF kaydı silindi`);
        console.log('\n⚠️  Not: Fiziksel dosyalar public/uploads altında kalabilir.');

    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanFlatPdfs();
