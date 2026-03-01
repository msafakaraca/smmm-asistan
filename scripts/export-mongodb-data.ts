/**
 * MongoDB Data Export Script
 *
 * This script exports all data from MongoDB before the Supabase migration.
 * Run this BEFORE changing Prisma schema to PostgreSQL.
 *
 * Usage:
 *   1. Ensure prisma/schema.prisma is still pointing to MongoDB
 *   2. Run: npx ts-node scripts/export-mongodb-data.ts
 *   3. Data will be saved to: mongodb-export.json
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface ExportData {
  metadata: {
    exportedAt: string;
    version: string;
  };
  tenants: any[];
  users: any[];
  customers: any[];
  documents: any[];
  licenses: any[];
  beyannameTuru: any[];
  beyannameTakip: any[];
  jobs: any[];
  botSessions: any[];
  rows: any[];
  kontrol: any[];
  mails: any[];
  passwords: any[];
  reminders: any[];
}

async function exportData(): Promise<ExportData> {
  console.log('📦 Exporting MongoDB data...\n');

  const data: ExportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    },
    tenants: [],
    users: [],
    customers: [],
    documents: [],
    licenses: [],
    beyannameTuru: [],
    beyannameTakip: [],
    jobs: [],
    botSessions: [],
    rows: [],
    kontrol: [],
    mails: [],
    passwords: [],
    reminders: []
  };

  try {
    // Export Tenants
    console.log('📁 Exporting Tenants...');
    data.tenants = await prisma.tenant.findMany();
    console.log(`   ✅ ${data.tenants.length} records`);

    // Export Users
    console.log('📁 Exporting Users...');
    data.users = await prisma.user.findMany();
    console.log(`   ✅ ${data.users.length} records`);

    // Export Customers
    console.log('📁 Exporting Customers...');
    data.customers = await prisma.customer.findMany();
    console.log(`   ✅ ${data.customers.length} records`);

    // Export Documents
    console.log('📁 Exporting Documents...');
    data.documents = await prisma.document.findMany();
    console.log(`   ✅ ${data.documents.length} records`);

    // Export Licenses
    console.log('📁 Exporting Licenses...');
    data.licenses = await prisma.license.findMany();
    console.log(`   ✅ ${data.licenses.length} records`);

    // Export BeyannameTuru
    console.log('📁 Exporting BeyannameTuru...');
    data.beyannameTuru = await prisma.beyannameTuru.findMany();
    console.log(`   ✅ ${data.beyannameTuru.length} records`);

    // Export BeyannameTakip
    console.log('📁 Exporting BeyannameTakip...');
    data.beyannameTakip = await prisma.beyannameTakip.findMany();
    console.log(`   ✅ ${data.beyannameTakip.length} records`);

    // Export Jobs
    console.log('📁 Exporting Jobs...');
    data.jobs = await prisma.job.findMany();
    console.log(`   ✅ ${data.jobs.length} records`);

    // Export BotSessions
    console.log('📁 Exporting BotSessions...');
    data.botSessions = await prisma.botSession.findMany();
    console.log(`   ✅ ${data.botSessions.length} records`);

    // Export Rows
    console.log('📁 Exporting Rows...');
    data.rows = await prisma.row.findMany();
    console.log(`   ✅ ${data.rows.length} records`);

    // Export Kontrol
    console.log('📁 Exporting Kontrol...');
    data.kontrol = await prisma.kontrol.findMany();
    console.log(`   ✅ ${data.kontrol.length} records`);

    // Export Mails
    console.log('📁 Exporting Mails...');
    data.mails = await prisma.mail.findMany();
    console.log(`   ✅ ${data.mails.length} records`);

    // Export Passwords
    console.log('📁 Exporting Passwords...');
    data.passwords = await prisma.password.findMany();
    console.log(`   ✅ ${data.passwords.length} records`);

    // Export Reminders
    console.log('📁 Exporting Reminders...');
    data.reminders = await prisma.reminder.findMany();
    console.log(`   ✅ ${data.reminders.length} records`);

    return data;

  } catch (error: any) {
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   MongoDB Data Export                         ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    await prisma.$connect();
    console.log('✅ Connected to MongoDB\n');

    const data = await exportData();

    const totalRecords = Object.values(data)
      .filter(val => Array.isArray(val))
      .reduce((sum, arr) => sum + arr.length, 0);

    console.log('\n📊 Export Summary:');
    console.log('─'.repeat(50));
    console.log(`   Total records: ${totalRecords}`);
    console.log('─'.repeat(50));

    // Save to file
    const filePath = join(process.cwd(), 'mongodb-export.json');
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const sizeKB = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(2);
    console.log(`\n✅ Data exported successfully!`);
    console.log(`   File: ${filePath}`);
    console.log(`   Size: ${sizeKB} KB`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Update prisma/schema.prisma to PostgreSQL');
    console.log('   2. Run: npx prisma db push');
    console.log('   3. Run: npx ts-node scripts/import-to-supabase.ts');

  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
