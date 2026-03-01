const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicatesByName() {
    // Tüm KDV içeren document'leri bul  
    const docs = await prisma.document.groupBy({
        by: ['parentId', 'name'],
        having: {
            name: {
                _count: {
                    gt: 1
                }
            }
        },
        _count: {
            name: true
        }
    });

    console.log('Duplicate gruplar:', docs.length);

    for (const group of docs) {
        console.log(`\nParent: ${group.parentId}, Name: ${group.name}, Count: ${group._count.name}`);

        // Bu gruptaki tüm kayıtları al
        const records = await prisma.document.findMany({
            where: {
                parentId: group.parentId,
                name: group.name
            },
            orderBy: { createdAt: 'asc' }
        });

        // İlki hariç diğerlerini sil
        const [keep, ...toDelete] = records;
        console.log(`  Tutulan: ${keep.id}`);

        for (const dup of toDelete) {
            console.log(`  Silinen: ${dup.id}`);
            await prisma.document.delete({ where: { id: dup.id } });
        }
    }

    console.log('\nTamamlandı!');
}

findDuplicatesByName()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
