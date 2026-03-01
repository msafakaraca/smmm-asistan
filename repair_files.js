
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Repairing Root Folders...');

    // 1. Find all folders that are supposed to be root (e.g. they have no parentId or implicit null)
    // But since we can't query them easily with parentId: null, we'll fetch ALL folders and filter in JS
    const allFolders = await prisma.document.findMany({
        where: {
            isFolder: true
        },
        select: { id: true, name: true, parentId: true }
    });

    console.log(`Total folders found: ${allFolders.length}`);

    let updatedCount = 0;
    for (const folder of allFolders) {
        // Check if parentId is "missing" or implicit null or null
        // In JS, if it's null, it's null.
        // But we want to FORCE write it as explicit null to satisfy Prisma/Mongo quirks
        if (!folder.parentId) {
            console.log(`Fixing folder: ${folder.name} (${folder.id})`);
            await prisma.document.update({
                where: { id: folder.id },
                data: { parentId: null }
            });
            updatedCount++;
        }
    }

    console.log(`Repaired ${updatedCount} root folders.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
