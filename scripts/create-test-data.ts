import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Test Data Creation                           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // 1. Create Tenant
    console.log('📦 Creating test tenant...');
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test SMMM Ofisi',
        slug: 'test-ofis',
        plan: 'trial',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }
    });
    console.log('✅ Tenant created:', tenant.id);
    console.log('   Name:', tenant.name);
    console.log('   Slug:', tenant.slug);

    // 2. Create License
    console.log('\n📦 Creating license...');
    const license = await prisma.license.create({
      data: {
        tenantId: tenant.id,
        type: 'premium',
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      }
    });
    console.log('✅ License created:', license.id);

    // 3. Create User in Supabase Auth
    console.log('\n👤 Creating user in Supabase Auth...');
    const testEmail = 'admin@test.com';
    const testPassword = 'Test123456';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Test Admin',
        role: 'owner'
      }
    });

    if (authError) {
      console.error('❌ Supabase Auth error:', authError.message);
      throw authError;
    }

    console.log('✅ Supabase Auth user created:', authData.user?.id);

    // 4. Create user_profile
    console.log('\n📦 Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user!.id,
        tenantId: tenant.id,
        role: 'owner'
      });

    if (profileError) {
      console.error('❌ Profile creation error:', profileError.message);
      throw profileError;
    }

    console.log('✅ User profile created');

    // 5. Create User in Prisma (for backward compatibility - will be removed later)
    console.log('\n📦 Creating user in Prisma...');
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        id: authData.user!.id,
        email: testEmail,
        name: 'Test Admin',
        hashedPassword,
        role: 'owner',
        tenantId: tenant.id,
        emailVerified: new Date()
      }
    });
    console.log('✅ Prisma user created:', user.id);

    // 6. Create sample BeyannameTuru records
    console.log('\n📦 Creating sample beyanname types...');
    const beyannameTurleri = [
      { kod: 'KDV1', aciklama: 'Katma Değer Vergisi Beyannamesi (2 No.lu)', kisaAd: 'KDV1', kategori: 'KDV', siraNo: 1 },
      { kod: 'MUHSGK', aciklama: 'Muhtasar ve SGK Prim Hizmet Beyannamesi', kisaAd: 'MUHSGK', kategori: 'Muhtasar', siraNo: 2 },
      { kod: 'GELIR', aciklama: 'Yıllık Gelir Vergisi Beyannamesi', kisaAd: 'GELIR', kategori: 'Gelir', siraNo: 3 },
      { kod: 'KURUM', aciklama: 'Kurumlar Vergisi Beyannamesi', kisaAd: 'KURUM', kategori: 'Kurumlar', siraNo: 4 },
    ];

    for (const bt of beyannameTurleri) {
      await prisma.beyannameTuru.create({
        data: {
          ...bt,
          tenantId: tenant.id,
          aktif: true
        }
      });
    }
    console.log(`✅ ${beyannameTurleri.length} beyanname types created`);

    // 7. Create sample customer
    console.log('\n📦 Creating sample customer...');
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        unvan: 'Örnek Müşteri A.Ş.',
        kisaltma: 'ÖRNEK',
        vknTckn: '1234567890',
        vergiKimlikNo: '1234567890',
        vergiDairesi: 'Kadıköy',
        sirketTipi: 'firma',
        email: 'ornek@musteri.com',
        telefon1: '0212 123 45 67',
        adres: 'İstanbul',
        status: 'active',
        sortOrder: 1
      }
    });
    console.log('✅ Customer created:', customer.id);
    console.log('   Name:', customer.unvan);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test data created successfully!\n');

    console.log('📋 Login Credentials:');
    console.log('─'.repeat(50));
    console.log('   Email:    ', testEmail);
    console.log('   Password: ', testPassword);
    console.log('   Tenant:   ', tenant.name);
    console.log('─'.repeat(50));

    console.log('\n📝 Next Steps:');
    console.log('   1. Update auth system to use Supabase Auth');
    console.log('   2. Test login with these credentials');
    console.log('   3. Refactor API endpoints to use Supabase client');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
