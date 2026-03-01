/**
 * Supabase Data Import Script
 *
 * This script imports MongoDB data (from mongodb-export.json) to Supabase PostgreSQL.
 * Run this AFTER:
 *   1. Updating Prisma schema to PostgreSQL
 *   2. Running: npx prisma db push
 *   3. Applying RLS policies
 *
 * Usage: npx ts-node scripts/import-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration in .env');
  process.exit(1);
}

// Supabase admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ObjectId → UUID mapping
const idMap = new Map<string, string>();

function mapId(mongoId: string | null | undefined): string | null {
  if (!mongoId) return null;
  if (idMap.has(mongoId)) return idMap.get(mongoId)!;

  const uuid = randomUUID();
  idMap.set(mongoId, uuid);
  return uuid;
}

function getMappedId(mongoId: string): string | null {
  return idMap.get(mongoId) || null;
}

async function insertBatch(tableName: string, records: any[]) {
  if (records.length === 0) return 0;

  const { data, error, count } = await supabase
    .from(tableName)
    .insert(records)
    .select();

  if (error) {
    console.error(`   ❌ Error in ${tableName}:`, error.message);
    if (error.details) console.error(`      Details:`, error.details);
    if (error.hint) console.error(`      Hint:`, error.hint);
    throw error;
  }

  return records.length;
}

async function verifyCount(tableName: string, expectedCount: number) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`❌ Verification failed for ${tableName}:`, error.message);
    return false;
  }

  const match = count === expectedCount;
  const status = match ? '✅' : '❌';
  console.log(`${status} ${tableName}: Expected=${expectedCount}, Got=${count}`);

  return match;
}

async function importData(data: any) {
  console.log('📦 Starting import in dependency order...\n');

  // 1. Tenants (no dependencies)
  console.log('[1/14] Importing Tenants...');
  let migrated = 0;
  for (let i = 0; i < data.tenants.length; i += BATCH_SIZE) {
    const batch = data.tenants.slice(i, i + BATCH_SIZE).map((t: any) => ({
      id: mapId(t.id),
      name: t.name,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
    migrated += await insertBatch('Tenant', batch);
    console.log(`   Progress: ${migrated}/${data.tenants.length}`);
  }
  await verifyCount('Tenant', data.tenants.length);

  // 2. Licenses
  console.log('\n[2/14] Importing Licenses...');
  migrated = 0;
  for (let i = 0; i < data.licenses.length; i += BATCH_SIZE) {
    const batch = data.licenses.slice(i, i + BATCH_SIZE).map((l: any) => ({
      id: mapId(l.id),
      tenantId: getMappedId(l.tenantId),
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      isActive: l.isActive,
      maxUsers: l.maxUsers,
      maxCustomers: l.maxCustomers,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    }));
    migrated += await insertBatch('License', batch);
    console.log(`   Progress: ${migrated}/${data.licenses.length}`);
  }
  await verifyCount('License', data.licenses.length);

  // 3. BeyannameTuru
  console.log('\n[3/14] Importing BeyannameTuru...');
  migrated = 0;
  for (let i = 0; i < data.beyannameTuru.length; i += BATCH_SIZE) {
    const batch = data.beyannameTuru.slice(i, i + BATCH_SIZE).map((bt: any) => ({
      id: mapId(bt.id),
      tenantId: getMappedId(bt.tenantId),
      ad: bt.ad,
      kod: bt.kod,
      periyot: bt.periyot,
      aktif: bt.aktif,
      createdAt: bt.createdAt,
      updatedAt: bt.updatedAt
    }));
    migrated += await insertBatch('BeyannameTuru', batch);
    console.log(`   Progress: ${migrated}/${data.beyannameTuru.length}`);
  }
  await verifyCount('BeyannameTuru', data.beyannameTuru.length);

  // 4. Users
  console.log('\n[4/14] Importing Users...');
  migrated = 0;
  for (let i = 0; i < data.users.length; i += BATCH_SIZE) {
    const batch = data.users.slice(i, i + BATCH_SIZE).map((u: any) => ({
      id: mapId(u.id),
      tenantId: getMappedId(u.tenantId),
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      hashedPassword: u.hashedPassword,
      role: u.role,
      image: u.image,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
    migrated += await insertBatch('User', batch);
    console.log(`   Progress: ${migrated}/${data.users.length}`);
  }
  await verifyCount('User', data.users.length);

  // 5. Customers
  console.log('\n[5/14] Importing Customers...');
  migrated = 0;
  for (let i = 0; i < data.customers.length; i += BATCH_SIZE) {
    const batch = data.customers.slice(i, i + BATCH_SIZE).map((c: any) => ({
      id: mapId(c.id),
      tenantId: getMappedId(c.tenantId),
      vknTckn: c.vknTckn,
      name: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      address: c.address,
      taxOffice: c.taxOffice,
      type: c.type,
      status: c.status,
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
    migrated += await insertBatch('Customer', batch);
    console.log(`   Progress: ${migrated}/${data.customers.length}`);
  }
  await verifyCount('Customer', data.customers.length);

  // 6. Documents (handle parent-child relationships)
  console.log('\n[6/14] Importing Documents...');
  // Sort by createdAt to ensure parents are created before children
  const sortedDocs = [...data.documents].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  migrated = 0;
  for (let i = 0; i < sortedDocs.length; i += BATCH_SIZE) {
    const batch = sortedDocs.slice(i, i + BATCH_SIZE).map((d: any) => ({
      id: mapId(d.id),
      tenantId: getMappedId(d.tenantId),
      customerId: d.customerId ? getMappedId(d.customerId) : null,
      name: d.name,
      path: d.path,
      size: d.size,
      mimeType: d.mimeType,
      isFolder: d.isFolder,
      parentId: d.parentId ? getMappedId(d.parentId) : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));
    migrated += await insertBatch('Document', batch);
    console.log(`   Progress: ${migrated}/${sortedDocs.length}`);
  }
  await verifyCount('Document', data.documents.length);

  // 7. BeyannameTakip
  console.log('\n[7/14] Importing BeyannameTakip...');
  migrated = 0;
  for (let i = 0; i < data.beyannameTakip.length; i += BATCH_SIZE) {
    const batch = data.beyannameTakip.slice(i, i + BATCH_SIZE).map((bt: any) => ({
      id: mapId(bt.id),
      tenantId: getMappedId(bt.tenantId),
      customerId: getMappedId(bt.customerId),
      beyannameTuruId: bt.beyannameTuruId ? getMappedId(bt.beyannameTuruId) : null,
      donem: bt.donem,
      yil: bt.yil,
      durum: bt.durum,
      verilmeTarihi: bt.verilmeTarihi,
      tahakkukTutari: bt.tahakkukTutari,
      odemeTutari: bt.odemeTutari,
      notlar: bt.notlar,
      createdAt: bt.createdAt,
      updatedAt: bt.updatedAt
    }));
    migrated += await insertBatch('BeyannameTakip', batch);
    console.log(`   Progress: ${migrated}/${data.beyannameTakip.length}`);
  }
  await verifyCount('BeyannameTakip', data.beyannameTakip.length);

  // 8. Jobs
  console.log('\n[8/14] Importing Jobs...');
  migrated = 0;
  for (let i = 0; i < data.jobs.length; i += BATCH_SIZE) {
    const batch = data.jobs.slice(i, i + BATCH_SIZE).map((j: any) => ({
      id: mapId(j.id),
      tenantId: getMappedId(j.tenantId),
      customerId: j.customerId ? getMappedId(j.customerId) : null,
      type: j.type,
      status: j.status,
      data: j.data,
      result: j.result,
      error: j.error,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt
    }));
    migrated += await insertBatch('Job', batch);
    console.log(`   Progress: ${migrated}/${data.jobs.length}`);
  }
  await verifyCount('Job', data.jobs.length);

  // 9. BotSessions
  console.log('\n[9/14] Importing BotSessions...');
  migrated = 0;
  for (let i = 0; i < data.botSessions.length; i += BATCH_SIZE) {
    const batch = data.botSessions.slice(i, i + BATCH_SIZE).map((bs: any) => ({
      id: mapId(bs.id),
      tenantId: getMappedId(bs.tenantId),
      userId: bs.userId ? getMappedId(bs.userId) : null,
      status: bs.status,
      currentStep: bs.currentStep,
      customerCount: bs.customerCount,
      processedCount: bs.processedCount,
      successCount: bs.successCount,
      failedCount: bs.failedCount,
      logs: bs.logs,
      startedAt: bs.startedAt,
      completedAt: bs.completedAt,
      createdAt: bs.createdAt,
      updatedAt: bs.updatedAt
    }));
    migrated += await insertBatch('BotSession', batch);
    console.log(`   Progress: ${migrated}/${data.botSessions.length}`);
  }
  await verifyCount('BotSession', data.botSessions.length);

  // 10. Rows
  console.log('\n[10/14] Importing Rows...');
  migrated = 0;
  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const batch = data.rows.slice(i, i + BATCH_SIZE).map((r: any) => ({
      id: mapId(r.id),
      tenantId: getMappedId(r.tenantId),
      customerId: getMappedId(r.customerId),
      year: r.year,
      month: r.month,
      data: r.data,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    migrated += await insertBatch('Row', batch);
    console.log(`   Progress: ${migrated}/${data.rows.length}`);
  }
  await verifyCount('Row', data.rows.length);

  // 11. Kontrol
  console.log('\n[11/14] Importing Kontrol...');
  migrated = 0;
  for (let i = 0; i < data.kontrol.length; i += BATCH_SIZE) {
    const batch = data.kontrol.slice(i, i + BATCH_SIZE).map((k: any) => ({
      id: mapId(k.id),
      tenantId: getMappedId(k.tenantId),
      customerId: getMappedId(k.customerId),
      type: k.type,
      status: k.status,
      details: k.details,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt
    }));
    migrated += await insertBatch('Kontrol', batch);
    console.log(`   Progress: ${migrated}/${data.kontrol.length}`);
  }
  await verifyCount('Kontrol', data.kontrol.length);

  // 12. Mail
  console.log('\n[12/14] Importing Mail...');
  migrated = 0;
  for (let i = 0; i < data.mails.length; i += BATCH_SIZE) {
    const batch = data.mails.slice(i, i + BATCH_SIZE).map((m: any) => ({
      id: mapId(m.id),
      tenantId: getMappedId(m.tenantId),
      customerId: m.customerId ? getMappedId(m.customerId) : null,
      subject: m.subject,
      body: m.body,
      from: m.from,
      to: m.to,
      status: m.status,
      sentAt: m.sentAt,
      createdAt: m.createdAt
    }));
    migrated += await insertBatch('Mail', batch);
    console.log(`   Progress: ${migrated}/${data.mails.length}`);
  }
  await verifyCount('Mail', data.mails.length);

  // 13. Password
  console.log('\n[13/14] Importing Password...');
  migrated = 0;
  for (let i = 0; i < data.passwords.length; i += BATCH_SIZE) {
    const batch = data.passwords.slice(i, i + BATCH_SIZE).map((p: any) => ({
      id: mapId(p.id),
      tenantId: getMappedId(p.tenantId),
      customerId: getMappedId(p.customerId),
      service: p.service,
      username: p.username,
      encryptedPassword: p.encryptedPassword,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
    migrated += await insertBatch('Password', batch);
    console.log(`   Progress: ${migrated}/${data.passwords.length}`);
  }
  await verifyCount('Password', data.passwords.length);

  // 14. Reminder
  console.log('\n[14/14] Importing Reminder...');
  migrated = 0;
  for (let i = 0; i < data.reminders.length; i += BATCH_SIZE) {
    const batch = data.reminders.slice(i, i + BATCH_SIZE).map((r: any) => ({
      id: mapId(r.id),
      tenantId: getMappedId(r.tenantId),
      customerId: r.customerId ? getMappedId(r.customerId) : null,
      title: r.title,
      description: r.description,
      dueDate: r.dueDate,
      status: r.status,
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    migrated += await insertBatch('Reminder', batch);
    console.log(`   Progress: ${migrated}/${data.reminders.length}`);
  }
  await verifyCount('Reminder', data.reminders.length);
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Supabase Data Import                         ║');
  console.log('║   MongoDB Export → PostgreSQL                  ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Test Supabase connection
    console.log('🔌 Testing Supabase connection...');
    const { error } = await supabase.from('Tenant').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('✅ Supabase connected\n');

    // Load export file
    const filePath = join(process.cwd(), 'mongodb-export.json');
    console.log('📂 Loading export file:', filePath);

    const fileContent = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log('✅ Export file loaded');
    console.log(`   Exported at: ${data.metadata.exportedAt}`);
    console.log(`   Version: ${data.metadata.version}\n`);

    const totalRecords = Object.keys(data)
      .filter(key => Array.isArray(data[key]))
      .reduce((sum, key) => sum + data[key].length, 0);

    console.log('📊 Records to import:', totalRecords);
    console.log('─'.repeat(50));

    // Start import
    await importData(data);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Import completed in ${duration}s`);
    console.log(`📊 ID mappings created: ${idMap.size}`);

    console.log('\n📝 Next Steps:');
    console.log('   1. ✅ Verify data in Supabase Dashboard');
    console.log('   2. ⏭️  Test RLS policies with different users');
    console.log('   3. ⏭️  Proceed to auth migration');

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
