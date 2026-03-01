const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listBeyannamelerContent() {
    // "Beyannameler" isimli klasörleri bul
    const beyannamelerFolders = await prisma.document.findMany({
        where: {
            name: 'Beyannameler',
            isFolder: true
        },
        select: { id: true, name: true, parentId: true }
    });

    console.log(`Beyannameler klasörleri: ${beyannamelerFolders.length}\n`);

    for (const folder of beyannamelerFolders) {
        // Parent klasörü bul (müşteri adını almak için)
        const parent = folder.parentId ? await prisma.document.findUnique({
            where: { id: folder.parentId },
            select: { name: true }
        }) : null;

        console.log(`📁 ${parent?.name || 'Root'} > Beyannameler (ID: ${folder.id})`);

        // Bu klasörün içindeki dosyaları listele
        const files = await prisma.document.findMany({
            where: {
                parentId: folder.id,
                isFolder: false
            },
            select: { id: true, name: true, path: true, createdAt: true },
            orderBy: { name: 'asc' }
        });

        console.log(`   ${files.length} dosya:`);
        for (const file of files) {
            console.log(`   - ${file.name}`);
        }
        console.log('');
    }
}

listBeyannamelerContent()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
