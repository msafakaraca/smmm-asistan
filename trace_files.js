
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Get one recent subfolder
    const recentFolder = await prisma.document.findFirst({
        where: {
            isFolder: true,
            parentId: { not: null }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!recentFolder) {
        console.log('No recent subfolders found.');
        return;
    }

    console.log('Subfolder:', JSON.stringify(recentFolder, null, 2));
    console.log(`Checking Parent ID: ${recentFolder.parentId}`);

    const parent = await prisma.document.findUnique({
        where: { id: recentFolder.parentId }
    });

    if (parent) {
        console.log('Parent Folder Found:', JSON.stringify(parent, null, 2));
        console.log(`Parent's parentId is type: ${typeof parent.parentId}`);
        console.log(`Parent's parentId is value: ${parent.parentId}`);

        if (parent.parentId === null) {
            console.log('Parent IS a root folder (parentId is null).');
            // Double check if query { parentId: null } finds it
            const found = await prisma.document.findFirst({
                where: {
                    id: parent.id,
                    parentId: null
                }
            });
            console.log('Can verify via query { parentId: null } ?', !!found);
        } else {
            console.log('Parent is NOT a root folder.');
        }
    } else {
        console.log('Parent Folder NOT FOUND! (Subfolder is orphan)');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
