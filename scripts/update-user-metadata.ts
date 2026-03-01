/**
 * User Metadata Migration Script
 *
 * Bu script mevcut kullanıcıların Supabase app_metadata'sına
 * tenant_id ve role ekler. JWT local decode için gereklidir.
 *
 * KULLANIM:
 * npx tsx scripts/update-user-metadata.ts
 *
 * UYARI: Bu script sadece bir kez çalıştırılmalıdır!
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const prisma = new PrismaClient();

async function updateAllUserMetadata() {
  console.log('🚀 User metadata migration started...\n');

  try {
    // Tüm user_profiles'ı çek (sadece gerekli alanlar)
    const profiles = await prisma.user.findMany({
      select: {
        id: true,
        tenantId: true,
        role: true
      }
    });

    console.log(`📊 Found ${profiles.length} users to update\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        // Supabase Auth user'ının metadata'sını güncelle
        const { error } = await supabase.auth.admin.updateUserById(profile.id, {
          app_metadata: {
            tenant_id: profile.tenantId,
            role: profile.role
          }
        });

        if (error) {
          console.error(`❌ Error updating user ${profile.id}: ${error.message}`);
          errorCount++;
        } else {
          console.log(`✅ Updated: ${profile.id.substring(0, 8)}... (tenant: ${profile.tenantId.substring(0, 8)}...)`);
          successCount++;
        }

        // Rate limiting için küçük bir bekleme
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`❌ Exception for user ${profile.id}:`, err);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📋 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${profiles.length}`);
    console.log('='.repeat(50));

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('Users can now benefit from fast JWT authentication.');
    } else {
      console.log('\n⚠️ Migration completed with some errors.');
      console.log('Please check the error messages above and retry if needed.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Verification function
async function verifyMetadata() {
  console.log('\n🔍 Verifying metadata for first 5 users...\n');

  const { data: users, error } = await supabase.auth.admin.listUsers({
    perPage: 5
  });

  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  for (const user of users.users) {
    const hasTenantId = !!user.app_metadata?.tenant_id;
    const hasRole = !!user.app_metadata?.role;
    const status = hasTenantId && hasRole ? '✅' : '❌';
    console.log(`${status} ${user.email}: tenant_id=${hasTenantId}, role=${hasRole}`);
  }
}

// Run migration
(async () => {
  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    process.exit(1);
  }

  await updateAllUserMetadata();
  await verifyMetadata();
})();
