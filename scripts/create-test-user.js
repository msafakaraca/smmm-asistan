
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'test@test.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if tenant exists
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Test Mali Musavirlik',
            }
        });
        console.log('Created tenant:', tenant.id);
    }

    const user = await prisma.user.upsert({
        where: { email },
        update: { hashedPassword },
        create: {
            email,
            name: 'Test Kullanıcı',
            hashedPassword,
            role: 'ADMIN',
            tenantId: tenant.id
        },
    });

    console.log(`User created/updated: ${user.email} / ${password}`);

    // Create license
    await prisma.license.upsert({
        where: { tenantId: tenant.id },
        update: { isActive: true },
        create: {
            tenantId: tenant.id,
            type: 'PRO',
            isActive: true,
            expiresAt: new Date('2030-01-01')
        }
    });
    console.log('License active');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
