import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in .env');
  process.exit(1);
}

async function applyRLSPolicies() {
  console.log('🚀 Starting RLS Policies Migration...\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to PostgreSQL
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read SQL file
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', '001_rls_policies.sql');
    console.log('📄 Reading SQL file:', sqlPath);

    const sql = readFileSync(sqlPath, 'utf-8');
    console.log('✅ SQL file loaded:', (sql.length / 1024).toFixed(2), 'KB\n');

    // Execute SQL
    console.log('⚙️  Executing RLS policies...\n');

    await client.query(sql);

    console.log('✅ RLS Policies applied successfully!\n');

    // Verification: Check RLS is enabled
    console.log('🔍 Verifying RLS configuration...\n');

    const verifyQuery = `
      SELECT
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'Customer', 'Document', 'Row', 'Kontrol', 'Mail', 'Password',
          'Reminder', 'BeyannameTakip', 'BeyannameTuru', 'Job',
          'BotSession', 'License', 'Tenant', 'user_profiles'
        )
      ORDER BY tablename;
    `;

    const result = await client.query(verifyQuery);

    console.log('📊 RLS Status:');
    console.log('─'.repeat(50));
    result.rows.forEach(row => {
      const status = row.rls_enabled ? '✅ Enabled' : '❌ Disabled';
      console.log(`  ${row.tablename.padEnd(20)} ${status}`);
    });
    console.log('─'.repeat(50));

    const enabledCount = result.rows.filter(r => r.rls_enabled).length;
    const totalCount = result.rows.length;

    console.log(`\n📈 Summary: ${enabledCount}/${totalCount} tables have RLS enabled\n`);

    // Check policies count
    const policiesQuery = `
      SELECT COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public';
    `;

    const policiesResult = await client.query(policiesQuery);
    const policyCount = policiesResult.rows[0].policy_count;

    console.log(`📋 Total policies created: ${policyCount}\n`);

    if (enabledCount === totalCount) {
      console.log('🎉 SUCCESS! All tables have RLS enabled and policies applied.\n');
      console.log('✅ Next Steps:');
      console.log('   1. Test tenant isolation');
      console.log('   2. Verify helper function works');
      console.log('   3. Proceed to data migration\n');
    } else {
      console.log('⚠️  WARNING: Not all tables have RLS enabled.');
      console.log('   Please review the migration SQL and try again.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error applying RLS policies:');
    console.error('   Message:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n💡 Note: Some objects already exist. This might be OK if re-running.');
    } else {
      console.error('\n🔧 Troubleshooting:');
      console.error('   1. Check DATABASE_URL is correct');
      console.error('   2. Verify Supabase database is accessible');
      console.error('   3. Review SQL syntax in 001_rls_policies.sql');
    }

    process.exit(1);
  } finally {
    // Close connection
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run the migration
console.log('╔══════════════════════════════════════════════╗');
console.log('║   SMMM Asistan - RLS Policies Migration     ║');
console.log('╚══════════════════════════════════════════════╝\n');

applyRLSPolicies()
  .then(() => {
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });
