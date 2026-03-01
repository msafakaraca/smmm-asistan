/**
 * İlk tenant ve kullanıcı oluşturma scripti
 * Kullanım: node scripts/create-first-user.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 İlk kullanıcı oluşturuluyor...\n');

    try {
        // Önce mevcut kullanıcı var mı kontrol et
        const existingUser = await prisma.user.findFirst();
        if (existingUser) {
            console.log('⚠️  Veritabanında zaten kullanıcı var!');
            console.log('Email:', existingUser.email);
            return;
        }

        // 1. Tenant oluştur
        console.log('📝 Tenant oluşturuluyor...');
        const tenant = await prisma.tenant.create({
            data: {
                name: 'SMMM Karaca Ofis',
                slug: 'karaca-ofis',
                plan: 'pro',
                status: 'active',
            },
        });
        console.log('✅ Tenant oluşturuldu:', tenant.name);

        // 2. Admin kullanıcısı oluştur
        console.log('\n📝 Admin kullanıcısı oluşturuluyor...');
        const hashedPassword = await bcrypt.hash('123456', 10);

        const user = await prisma.user.create({
            data: {
                email: 'smmm_karaca@hotmail.com',
                hashedPassword: hashedPassword,
                name: 'SMMM Karaca',
                role: 'owner',
                tenantId: tenant.id,
            },
        });
        console.log('✅ Kullanıcı oluşturuldu:', user.email);

        // 3. License oluştur
        console.log('\n📝 Lisans oluşturuluyor...');
        const license = await prisma.license.create({
            data: {
                type: 'premium',
                isActive: true,
                tenantId: tenant.id,
            },
        });
        console.log('✅ Lisans oluşturuldu:', license.type);

        console.log('\n🎉 Kurulum tamamlandı!\n');
        console.log('📌 Giriş Bilgileri:');
        console.log('   Email   : smmm_karaca@hotmail.com');
        console.log('   Şifre   : 123456');
        console.log('\n⚠️  Güvenlik için şifrenizi değiştirmeyi unutmayın!\n');

    } catch (error) {
        console.error('❌ Hata oluştu:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
