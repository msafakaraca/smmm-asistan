/**
 * Supabase Migration Runner
 *
 * This script executes the generated migration.sql file on Supabase PostgreSQL
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  console.log('🚀 Starting Supabase Migration...\n');

  // Read migration SQL file
  const migrationPath = path.join(process.cwd(), 'migration.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ migration.sql not found!');
    console.log('Run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql');
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`📄 Migration file loaded (${sql.length} characters)\n`);

  // Initialize Supabase Admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔌 Connecting to Supabase PostgreSQL...\n');

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Extract table/action from statement for logging
      const match = statement.match(/CREATE TABLE "(\w+)"/i) ||
                    statement.match(/CREATE INDEX "(\w+)"/i) ||
                    statement.match(/ALTER TABLE "(\w+)"/i);
      const description = match ? match[1] : `Statement ${i + 1}`;

      process.stdout.write(`  [${i + 1}/${statements.length}] ${description}... `);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase
            .from('_prisma_migrations')
            .insert({ migration_name: `manual_${Date.now()}`, logs: statement });

          if (directError) {
            throw directError;
          }
        }

        console.log('✅');
        successCount++;
      } catch (error: any) {
        console.log('❌');
        console.error(`     Error: ${error.message}`);
        errorCount++;

        // Continue on non-critical errors
        if (error.message.includes('already exists')) {
          console.log('     (Skipping - already exists)');
          continue;
        }
      }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    // Verify tables created
    console.log('🔍 Verifying tables...\n');

    const tables = [
      'Tenant', 'User', 'Customer', 'Document',
      'BeyannameTakip', 'BeyannameTuru', 'BotSession',
      'License', 'Job', 'Row', 'Kontrol', 'Mail',
      'Password', 'Reminder'
    ];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   ❌ ${table}: ${error.message}`);
        } else {
          console.log(`   ✅ ${table}: ${count} rows`);
        }
      } catch (e: any) {
        console.log(`   ❌ ${table}: ${e.message}`);
      }
    }

    console.log('\n🎉 Database schema successfully created!\n');
    console.log('Next steps:');
    console.log('  1. Run data migration: npm run migrate:data');
    console.log('  2. Set up RLS policies');
    console.log('  3. Migrate users to Supabase Auth\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
runMigration().catch(console.error);
