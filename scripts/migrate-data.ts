import { PrismaClient as MongoClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================
// Configuration
// =============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BATCH_SIZE = 100; // Migrate records in batches

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

// MongoDB client (source)
const mongo = new MongoClient();

// Supabase client (destination) - using service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// ObjectId → UUID mapping for foreign key relationships
const idMap = new Map<string, string>();

// =============================================
// Utility Functions
// =============================================

function generateUUID(): string {
  return crypto.randomUUID();
}

function mapId(mongoId: string | null | undefined): string | null {
  if (!mongoId) return null;
  if (idMap.has(mongoId)) {
    return idMap.get(mongoId)!;
  }
  const uuid = generateUUID();
  idMap.set(mongoId, uuid);
  return uuid;
}

function getExistingId(mongoId: string): string | null {
  return idMap.get(mongoId) || null;
}

async function verifyCount(tableName: string, mongoCount: number) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`❌ Error verifying ${tableName}:`, error.message);
    return false;
  }

  const match = count === mongoCount;
  const status = match ? '✅' : '❌';
  console.log(`${status} ${tableName}: Mongo=${mongoCount}, Postgres=${count}`);

  return match;
}

async function migrateBatch<T>(
  tableName: string,
  mongoRecords: T[],
  transformer: (record: T) => any
): Promise<number> {
  if (mongoRecords.length === 0) return 0;

  const transformed = mongoRecords.map(transformer);

  const { error, count } = await supabase
    .from(tableName)
    .insert(transformed);

  if (error) {
    console.error(`   ❌ Batch failed:`, error.message);
    console.error(`   First record:`, JSON.stringify(transformed[0], null, 2));
    throw error;
  }

  return transformed.length;
}

// =============================================
// Migration Functions
// =============================================

async function migrateTenants() {
  console.log('\n📦 [1/12] Migrating Tenants...');

  const tenants = await mongo.tenant.findMany();
  console.log(`   Found ${tenants.length} tenants`);

  let migrated = 0;

  for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
    const batch = tenants.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Tenant', batch, (t) => ({
      id: mapId(t.id),
      name: t.name,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${tenants.length}`);
  }

  await verifyCount('Tenant', tenants.length);
  return migrated;
}

async function migrateLicenses() {
  console.log('\n📦 [2/12] Migrating Licenses...');

  const licenses = await mongo.license.findMany();
  console.log(`   Found ${licenses.length} licenses`);

  let migrated = 0;

  for (let i = 0; i < licenses.length; i += BATCH_SIZE) {
    const batch = licenses.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('License', batch, (l) => ({
      id: mapId(l.id),
      tenantId: getExistingId(l.tenantId),
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      isActive: l.isActive,
      maxUsers: l.maxUsers,
      maxCustomers: l.maxCustomers,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${licenses.length}`);
  }

  await verifyCount('License', licenses.length);
  return migrated;
}

async function migrateBeyannameTuru() {
  console.log('\n📦 [3/12] Migrating BeyannameTuru...');

  const types = await mongo.beyannameTuru.findMany();
  console.log(`   Found ${types.length} beyanname types`);

  let migrated = 0;

  for (let i = 0; i < types.length; i += BATCH_SIZE) {
    const batch = types.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('BeyannameTuru', batch, (bt) => ({
      id: mapId(bt.id),
      tenantId: getExistingId(bt.tenantId),
      ad: bt.ad,
      kod: bt.kod,
      periyot: bt.periyot,
      aktif: bt.aktif,
      createdAt: bt.createdAt,
      updatedAt: bt.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${types.length}`);
  }

  await verifyCount('BeyannameTuru', types.length);
  return migrated;
}

async function migrateUsers() {
  console.log('\n📦 [4/12] Migrating Users...');

  const users = await mongo.user.findMany();
  console.log(`   Found ${users.length} users`);

  let migrated = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('User', batch, (u) => ({
      id: mapId(u.id),
      tenantId: getExistingId(u.tenantId),
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      hashedPassword: u.hashedPassword,
      role: u.role,
      image: u.image,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${users.length}`);
  }

  await verifyCount('User', users.length);
  return migrated;
}

async function migrateCustomers() {
  console.log('\n📦 [5/12] Migrating Customers...');

  const customers = await mongo.customer.findMany();
  console.log(`   Found ${customers.length} customers`);

  let migrated = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Customer', batch, (c) => ({
      id: mapId(c.id),
      tenantId: getExistingId(c.tenantId),
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

    console.log(`   Migrated ${migrated}/${customers.length}`);
  }

  await verifyCount('Customer', customers.length);
  return migrated;
}

async function migrateDocuments() {
  console.log('\n📦 [6/12] Migrating Documents...');

  const documents = await mongo.document.findMany({
    orderBy: { createdAt: 'asc' } // Parent folders first
  });
  console.log(`   Found ${documents.length} documents`);

  let migrated = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Document', batch, (d) => ({
      id: mapId(d.id),
      tenantId: getExistingId(d.tenantId),
      customerId: d.customerId ? getExistingId(d.customerId) : null,
      name: d.name,
      path: d.path,
      size: d.size,
      mimeType: d.mimeType,
      isFolder: d.isFolder,
      parentId: d.parentId ? getExistingId(d.parentId) : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${documents.length}`);
  }

  await verifyCount('Document', documents.length);
  return migrated;
}

async function migrateBeyannameTakip() {
  console.log('\n📦 [7/12] Migrating BeyannameTakip...');

  const takip = await mongo.beyannameTakip.findMany();
  console.log(`   Found ${takip.length} beyanname takip records`);

  let migrated = 0;

  for (let i = 0; i < takip.length; i += BATCH_SIZE) {
    const batch = takip.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('BeyannameTakip', batch, (bt) => ({
      id: mapId(bt.id),
      tenantId: getExistingId(bt.tenantId),
      customerId: getExistingId(bt.customerId),
      beyannameTuruId: bt.beyannameTuruId ? getExistingId(bt.beyannameTuruId) : null,
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

    console.log(`   Migrated ${migrated}/${takip.length}`);
  }

  await verifyCount('BeyannameTakip', takip.length);
  return migrated;
}

async function migrateJobs() {
  console.log('\n📦 [8/12] Migrating Jobs...');

  const jobs = await mongo.job.findMany();
  console.log(`   Found ${jobs.length} jobs`);

  let migrated = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Job', batch, (j) => ({
      id: mapId(j.id),
      tenantId: getExistingId(j.tenantId),
      customerId: j.customerId ? getExistingId(j.customerId) : null,
      type: j.type,
      status: j.status,
      data: j.data, // JSON field
      result: j.result, // JSON field
      error: j.error,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${jobs.length}`);
  }

  await verifyCount('Job', jobs.length);
  return migrated;
}

async function migrateBotSessions() {
  console.log('\n📦 [9/12] Migrating BotSessions...');

  const sessions = await mongo.botSession.findMany();
  console.log(`   Found ${sessions.length} bot sessions`);

  let migrated = 0;

  for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
    const batch = sessions.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('BotSession', batch, (bs) => ({
      id: mapId(bs.id),
      tenantId: getExistingId(bs.tenantId),
      userId: bs.userId ? getExistingId(bs.userId) : null,
      status: bs.status,
      currentStep: bs.currentStep,
      customerCount: bs.customerCount,
      processedCount: bs.processedCount,
      successCount: bs.successCount,
      failedCount: bs.failedCount,
      logs: bs.logs, // JSON field
      startedAt: bs.startedAt,
      completedAt: bs.completedAt,
      createdAt: bs.createdAt,
      updatedAt: bs.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${sessions.length}`);
  }

  await verifyCount('BotSession', sessions.length);
  return migrated;
}

async function migrateRows() {
  console.log('\n📦 [10/12] Migrating Rows...');

  const rows = await mongo.row.findMany();
  console.log(`   Found ${rows.length} rows`);

  let migrated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Row', batch, (r) => ({
      id: mapId(r.id),
      tenantId: getExistingId(r.tenantId),
      customerId: getExistingId(r.customerId),
      year: r.year,
      month: r.month,
      data: r.data, // JSON field
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${rows.length}`);
  }

  await verifyCount('Row', rows.length);
  return migrated;
}

async function migrateKontrol() {
  console.log('\n📦 [11/12] Migrating Kontrol...');

  const kontrol = await mongo.kontrol.findMany();
  console.log(`   Found ${kontrol.length} kontrol records`);

  let migrated = 0;

  for (let i = 0; i < kontrol.length; i += BATCH_SIZE) {
    const batch = kontrol.slice(i, i + BATCH_SIZE);

    migrated += await migrateBatch('Kontrol', batch, (k) => ({
      id: mapId(k.id),
      tenantId: getExistingId(k.tenantId),
      customerId: getExistingId(k.customerId),
      type: k.type,
      status: k.status,
      details: k.details, // JSON field
      createdAt: k.createdAt,
      updatedAt: k.updatedAt
    }));

    console.log(`   Migrated ${migrated}/${kontrol.length}`);
  }

  await verifyCount('Kontrol', kontrol.length);
  return migrated;
}

async function migrateOtherTables() {
  console.log('\n📦 [12/12] Migrating Mail, Password, Reminder...');

  // Mail
  const mails = await mongo.mail.findMany();
  console.log(`   Found ${mails.length} mails`);
  let mailMigrated = 0;
  for (let i = 0; i < mails.length; i += BATCH_SIZE) {
    const batch = mails.slice(i, i + BATCH_SIZE);
    mailMigrated += await migrateBatch('Mail', batch, (m) => ({
      id: mapId(m.id),
      tenantId: getExistingId(m.tenantId),
      customerId: m.customerId ? getExistingId(m.customerId) : null,
      subject: m.subject,
      body: m.body,
      from: m.from,
      to: m.to,
      status: m.status,
      sentAt: m.sentAt,
      createdAt: m.createdAt
    }));
  }
  await verifyCount('Mail', mails.length);

  // Password
  const passwords = await mongo.password.findMany();
  console.log(`   Found ${passwords.length} passwords`);
  let pwdMigrated = 0;
  for (let i = 0; i < passwords.length; i += BATCH_SIZE) {
    const batch = passwords.slice(i, i + BATCH_SIZE);
    pwdMigrated += await migrateBatch('Password', batch, (p) => ({
      id: mapId(p.id),
      tenantId: getExistingId(p.tenantId),
      customerId: getExistingId(p.customerId),
      service: p.service,
      username: p.username,
      encryptedPassword: p.encryptedPassword,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
  }
  await verifyCount('Password', passwords.length);

  // Reminder
  const reminders = await mongo.reminder.findMany();
  console.log(`   Found ${reminders.length} reminders`);
  let reminderMigrated = 0;
  for (let i = 0; i < reminders.length; i += BATCH_SIZE) {
    const batch = reminders.slice(i, i + BATCH_SIZE);
    reminderMigrated += await migrateBatch('Reminder', batch, (r) => ({
      id: mapId(r.id),
      tenantId: getExistingId(r.tenantId),
      customerId: r.customerId ? getExistingId(r.customerId) : null,
      title: r.title,
      description: r.description,
      dueDate: r.dueDate,
      status: r.status,
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }
  await verifyCount('Reminder', reminders.length);

  return mailMigrated + pwdMigrated + reminderMigrated;
}

// =============================================
// Main Migration Function
// =============================================

async function runMigration() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   SMMM Asistan - Data Migration               ║');
  console.log('║   MongoDB → PostgreSQL (Supabase)             ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongo.$connect();
    console.log('✅ MongoDB connected\n');

    console.log('🔌 Connecting to Supabase...');
    const { data, error } = await supabase.from('Tenant').select('count');
    if (error) throw error;
    console.log('✅ Supabase connected\n');

    console.log('⚠️  IMPORTANT: Keep MongoDB running for rollback!\n');
    console.log('📊 Starting migration in dependency order...\n');
    console.log('='.repeat(50));

    // Migrate in dependency order
    await migrateTenants();
    await migrateLicenses();
    await migrateBeyannameTuru();
    await migrateUsers();
    await migrateCustomers();
    await migrateDocuments();
    await migrateBeyannameTakip();
    await migrateJobs();
    await migrateBotSessions();
    await migrateRows();
    await migrateKontrol();
    await migrateOtherTables();

    console.log('\n' + '='.repeat(50));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Migration completed successfully in ${duration}s!`);
    console.log(`📊 Total ID mappings created: ${idMap.size}`);

    console.log('\n📝 Next Steps:');
    console.log('   1. ✅ Verify data in Supabase Dashboard');
    console.log('   2. ✅ Test RLS policies');
    console.log('   3. ⏭️  Proceed to user/auth migration');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔧 Rollback:');
    console.error('   - MongoDB data is intact');
    console.error('   - Clear Supabase tables if needed');
    console.error('   - Fix issue and re-run migration');
    process.exit(1);
  } finally {
    await mongo.$disconnect();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run migration
runMigration();
