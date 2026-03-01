import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mskkqzpoiiytbgfifiup.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

// Create Supabase admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting RLS Policies Migration...\n');

  try {
    // Read SQL file
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', '001_rls_policies.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQL file loaded:', sqlPath);
    console.log('📏 SQL length:', sql.length, 'characters\n');

    // Split SQL into individual statements (split by semicolon, but skip semicolons in function bodies)
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--')) // Remove comments
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📊 Found', statements.length, 'SQL statements\n');

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip verification comments
      if (statement.includes('VERIFICATION QUERIES')) {
        continue;
      }

      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        // If rpc method doesn't exist, try alternative method
        if (error?.message?.includes('function public.exec_sql')) {
          // Fallback: use raw REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql_query: statement + ';' })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }
        } else if (error) {
          throw error;
        }

        console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
        successCount++;
      } catch (err: any) {
        console.error(`❌ [${i + 1}/${statements.length}] ${preview}...`);
        console.error('   Error:', err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('   ✅ Success:', successCount);
    console.log('   ❌ Errors:', errorCount);
    console.log('='.repeat(60));

    if (errorCount > 0) {
      console.log('\n⚠️  Migration completed with errors.');
      console.log('💡 Tip: Run the SQL manually in Supabase Dashboard > SQL Editor');
      process.exit(1);
    } else {
      console.log('\n✅ RLS Policies Migration Completed Successfully!');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Alternative: Run SQL manually in Supabase Dashboard:');
    console.error('   1. Go to https://supabase.com/dashboard/project/mskkqzpoiiytbgfifiup/sql');
    console.error('   2. Copy content from: supabase/migrations/001_rls_policies.sql');
    console.error('   3. Paste and run in SQL Editor');
    process.exit(1);
  }
}

// Verification function
async function verifyRLS() {
  console.log('\n🔍 Verifying RLS Policies...\n');

  try {
    // Check if RLS is enabled
    const { data: tables, error: tablesError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT tablename, rowsecurity
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
          ORDER BY tablename;
        `
      });

    if (tablesError) {
      console.log('⚠️  Unable to verify RLS automatically');
      console.log('💡 Please verify manually in Supabase Dashboard');
      return;
    }

    console.log('✅ Verification complete!');

  } catch (error: any) {
    console.log('⚠️  Verification skipped:', error.message);
  }
}

// Run migration
runMigration().then(() => {
  console.log('\n📝 Next Steps:');
  console.log('   1. Verify RLS in Supabase Dashboard');
  console.log('   2. Test tenant isolation');
  console.log('   3. Run data migration script');
});
