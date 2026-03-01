-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "settings" JSONB,
    "gibSettings" JSONB,
    "turmobSettings" JSONB,
    "captchaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "phoneNumber" TEXT,
    "tenantId" UUID NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "invitedBy" UUID,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "unvan" TEXT NOT NULL,
    "kisaltma" TEXT,
    "vknTckn" TEXT NOT NULL,
    "vergiKimlikNo" TEXT,
    "tcKimlikNo" TEXT,
    "vergiDairesi" TEXT,
    "sirketTipi" TEXT NOT NULL DEFAULT 'sahis',
    "faaliyetKodu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,
    "telefon1" TEXT,
    "telefon2" TEXT,
    "adres" TEXT,
    "yetkiliKisi" TEXT,
    "gibKodu" TEXT,
    "gibSifre" TEXT,
    "gibParola" TEXT,
    "interaktifSifre" TEXT,
    "emuhurPin" TEXT,
    "sgkKullaniciAdi" TEXT,
    "sgkIsyeriKodu" TEXT,
    "sgkSistemSifresi" TEXT,
    "sgkIsyeriSifresi" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "verilmeyecekBeyannameler" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "siraNo" TEXT,
    "sozlesmeNo" TEXT,
    "sozlesmeTarihi" TEXT,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT,
    "sirketTipiFilter" TEXT,
    "beyannameTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_group_members" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "type" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "isFolder" BOOLEAN NOT NULL DEFAULT false,
    "parentId" UUID,
    "path" TEXT,
    "url" TEXT,
    "storage" TEXT NOT NULL DEFAULT 'local',
    "year" INTEGER,
    "month" INTEGER,
    "icon" TEXT,
    "color" TEXT,
    "vknTckn" TEXT,
    "beyannameTuru" TEXT,
    "fileCategory" TEXT,
    "fileIndex" INTEGER,
    "customerId" UUID,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rows" (
    "id" UUID NOT NULL,
    "no" TEXT NOT NULL,
    "isim" TEXT NOT NULL,
    "platform" TEXT,
    "alis" BOOLEAN,
    "satis" BOOLEAN,
    "fis" BOOLEAN,
    "zRaporu" BOOLEAN,
    "muhtasar" TEXT,
    "vergiTA" BOOLEAN,
    "puantaj" BOOLEAN,
    "rapor" BOOLEAN,
    "sonDurum" BOOLEAN NOT NULL DEFAULT false,
    "notlar" TEXT,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontrol" (
    "id" UUID NOT NULL,
    "no" TEXT NOT NULL,
    "isim" TEXT NOT NULL,
    "vkn" TEXT,
    "kdv" TEXT NOT NULL DEFAULT 'bos',
    "kdvMeta" JSONB,
    "muh" TEXT NOT NULL DEFAULT 'bos',
    "muhMeta" JSONB,
    "ssk" TEXT NOT NULL DEFAULT 'bos',
    "sskMeta" JSONB,
    "berat" TEXT NOT NULL DEFAULT 'bos',
    "beratMeta" JSONB,
    "kurum" TEXT NOT NULL DEFAULT 'bos',
    "kurumMeta" JSONB,
    "gecici" TEXT NOT NULL DEFAULT 'bos',
    "geciciMeta" JSONB,
    "turz" TEXT NOT NULL DEFAULT 'bos',
    "turzMeta" JSONB,
    "konk" TEXT NOT NULL DEFAULT 'bos',
    "konkMeta" JSONB,
    "poset" TEXT NOT NULL DEFAULT 'bos',
    "posetMeta" JSONB,
    "kdv2" TEXT NOT NULL DEFAULT 'bos',
    "kdv2Meta" JSONB,
    "mail" TEXT NOT NULL DEFAULT 'bos',
    "tenantId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontrol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mails" (
    "id" UUID NOT NULL,
    "no" TEXT NOT NULL,
    "isim" TEXT NOT NULL,
    "unvan" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passwords" (
    "id" UUID NOT NULL,
    "customerNo" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "emuhurSafeWord" TEXT,
    "emuhurPin" TEXT,
    "gibUsername" TEXT,
    "gibPassword" TEXT,
    "otherPasswords" JSONB,
    "notes" TEXT,
    "tenantId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passwords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'event',
    "date" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "repeatPattern" TEXT,
    "repeatDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "repeatEndDate" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "sendWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "whatsappSentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "location" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID,
    "customerId" UUID,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beyanname_takip" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "beyannameler" JSONB NOT NULL DEFAULT '{}',
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beyanname_takip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beyanname_turleri" (
    "id" UUID NOT NULL,
    "kod" TEXT NOT NULL,
    "aciklama" TEXT NOT NULL,
    "kisaAd" TEXT,
    "kategori" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beyanname_turleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takip_kolonlar" (
    "id" UUID NOT NULL,
    "kod" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'boolean',
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    "sistem" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "type" TEXT,
    "width" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takip_kolonlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takip_satirlar" (
    "id" UUID NOT NULL,
    "no" TEXT,
    "isim" TEXT,
    "customerId" UUID,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    "degerler" JSONB NOT NULL DEFAULT '{}',
    "values" JSONB NOT NULL DEFAULT '{}',
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takip_satirlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxCustomers" INTEGER NOT NULL DEFAULT 100,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_oauth_connections" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastSyncAt" TIMESTAMP(3),
    "syncError" TEXT,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerId" TEXT,
    "provider" TEXT,
    "threadId" TEXT,
    "folder" TEXT,
    "subject" TEXT,
    "from" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "toEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "snippet" TEXT,
    "labelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "headers" JSONB,
    "receivedAt" TIMESTAMP(3),
    "customerId" UUID,
    "connectionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_send_logs" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientName" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "beyannameTuru" TEXT,
    "dosyaTipi" TEXT,
    "customerId" UUID,
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "mailSentAt" TIMESTAMP(3),
    "mailSentTo" TEXT,
    "mailError" TEXT,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappSentAt" TIMESTAMP(3),
    "whatsappSentTo" TEXT,
    "whatsappType" TEXT,
    "whatsappError" TEXT,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSentAt" TIMESTAMP(3),
    "smsSentTo" TEXT,
    "smsError" TEXT,
    "documentId" UUID,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_announcements" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "sendSms" BOOLEAN NOT NULL DEFAULT false,
    "sendWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "repeatPattern" TEXT,
    "repeatDay" INTEGER,
    "repeatEndDate" TIMESTAMP(3),
    "lastExecutedAt" TIMESTAMP(3),
    "nextExecuteAt" TIMESTAMP(3),
    "targetType" TEXT NOT NULL DEFAULT 'selected',
    "customerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "templateId" UUID,
    "tenantId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_logs" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientName" TEXT,
    "subject" TEXT,
    "content" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "customerId" UUID,
    "announcementId" UUID,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'supabase',
    "taskId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE INDEX "user_profiles_tenantId_idx" ON "user_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "user_profiles_tenantId_status_idx" ON "user_profiles"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

-- CreateIndex
CREATE INDEX "customers_tenantId_status_idx" ON "customers"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_vknTckn_key" ON "customers"("tenantId", "vknTckn");

-- CreateIndex
CREATE INDEX "customer_groups_tenantId_idx" ON "customer_groups"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_tenantId_name_key" ON "customer_groups"("tenantId", "name");

-- CreateIndex
CREATE INDEX "customer_group_members_groupId_idx" ON "customer_group_members"("groupId");

-- CreateIndex
CREATE INDEX "customer_group_members_customerId_idx" ON "customer_group_members"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_members_groupId_customerId_key" ON "customer_group_members"("groupId", "customerId");

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE INDEX "documents_tenantId_customerId_idx" ON "documents"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "documents_parentId_idx" ON "documents"("parentId");

-- CreateIndex
CREATE INDEX "documents_vknTckn_idx" ON "documents"("vknTckn");

-- CreateIndex
CREATE INDEX "documents_beyannameTuru_idx" ON "documents"("beyannameTuru");

-- CreateIndex
CREATE INDEX "jobs_tenantId_idx" ON "jobs"("tenantId");

-- CreateIndex
CREATE INDEX "rows_tenantId_idx" ON "rows"("tenantId");

-- CreateIndex
CREATE INDEX "kontrol_tenantId_idx" ON "kontrol"("tenantId");

-- CreateIndex
CREATE INDEX "mails_tenantId_idx" ON "mails"("tenantId");

-- CreateIndex
CREATE INDEX "passwords_tenantId_idx" ON "passwords"("tenantId");

-- CreateIndex
CREATE INDEX "reminders_tenantId_idx" ON "reminders"("tenantId");

-- CreateIndex
CREATE INDEX "reminders_tenantId_date_idx" ON "reminders"("tenantId", "date");

-- CreateIndex
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

-- CreateIndex
CREATE INDEX "reminders_customerId_idx" ON "reminders"("customerId");

-- CreateIndex
CREATE INDEX "beyanname_takip_tenantId_idx" ON "beyanname_takip"("tenantId");

-- CreateIndex
CREATE INDEX "beyanname_takip_year_month_idx" ON "beyanname_takip"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "beyanname_takip_customerId_year_month_key" ON "beyanname_takip"("customerId", "year", "month");

-- CreateIndex
CREATE INDEX "beyanname_turleri_tenantId_idx" ON "beyanname_turleri"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "beyanname_turleri_tenantId_kod_key" ON "beyanname_turleri"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "takip_kolonlar_tenantId_idx" ON "takip_kolonlar"("tenantId");

-- CreateIndex
CREATE INDEX "takip_kolonlar_siraNo_idx" ON "takip_kolonlar"("siraNo");

-- CreateIndex
CREATE INDEX "takip_kolonlar_aktif_idx" ON "takip_kolonlar"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "takip_kolonlar_tenantId_kod_key" ON "takip_kolonlar"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "takip_satirlar_tenantId_idx" ON "takip_satirlar"("tenantId");

-- CreateIndex
CREATE INDEX "takip_satirlar_year_month_idx" ON "takip_satirlar"("year", "month");

-- CreateIndex
CREATE INDEX "takip_satirlar_siraNo_idx" ON "takip_satirlar"("siraNo");

-- CreateIndex
CREATE UNIQUE INDEX "takip_satirlar_tenantId_customerId_year_month_key" ON "takip_satirlar"("tenantId", "customerId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_key_key" ON "licenses"("key");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_tenantId_key" ON "licenses"("tenantId");

-- CreateIndex
CREATE INDEX "licenses_key_idx" ON "licenses"("key");

-- CreateIndex
CREATE INDEX "licenses_status_idx" ON "licenses"("status");

-- CreateIndex
CREATE INDEX "email_oauth_connections_tenantId_idx" ON "email_oauth_connections"("tenantId");

-- CreateIndex
CREATE INDEX "email_oauth_connections_provider_idx" ON "email_oauth_connections"("provider");

-- CreateIndex
CREATE INDEX "email_oauth_connections_syncStatus_idx" ON "email_oauth_connections"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "email_oauth_connections_tenantId_email_key" ON "email_oauth_connections"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "email_oauth_connections_tenantId_provider_email_key" ON "email_oauth_connections"("tenantId", "provider", "email");

-- CreateIndex
CREATE INDEX "email_messages_tenantId_idx" ON "email_messages"("tenantId");

-- CreateIndex
CREATE INDEX "email_messages_connectionId_idx" ON "email_messages"("connectionId");

-- CreateIndex
CREATE INDEX "email_messages_receivedAt_idx" ON "email_messages"("receivedAt");

-- CreateIndex
CREATE INDEX "email_messages_isRead_idx" ON "email_messages"("isRead");

-- CreateIndex
CREATE INDEX "email_messages_folder_idx" ON "email_messages"("folder");

-- CreateIndex
CREATE INDEX "email_messages_customerId_idx" ON "email_messages"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_connectionId_messageId_key" ON "email_messages"("connectionId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_connectionId_providerId_key" ON "email_messages"("connectionId", "providerId");

-- CreateIndex
CREATE INDEX "bulk_send_logs_tenantId_idx" ON "bulk_send_logs"("tenantId");

-- CreateIndex
CREATE INDEX "bulk_send_logs_documentId_idx" ON "bulk_send_logs"("documentId");

-- CreateIndex
CREATE INDEX "bulk_send_logs_customerId_idx" ON "bulk_send_logs"("customerId");

-- CreateIndex
CREATE INDEX "bulk_send_logs_status_idx" ON "bulk_send_logs"("status");

-- CreateIndex
CREATE INDEX "bulk_send_logs_type_idx" ON "bulk_send_logs"("type");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_send_logs_documentId_tenantId_key" ON "bulk_send_logs"("documentId", "tenantId");

-- CreateIndex
CREATE INDEX "announcement_templates_tenantId_idx" ON "announcement_templates"("tenantId");

-- CreateIndex
CREATE INDEX "announcement_templates_isActive_idx" ON "announcement_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_templates_tenantId_name_key" ON "announcement_templates"("tenantId", "name");

-- CreateIndex
CREATE INDEX "scheduled_announcements_tenantId_idx" ON "scheduled_announcements"("tenantId");

-- CreateIndex
CREATE INDEX "scheduled_announcements_status_idx" ON "scheduled_announcements"("status");

-- CreateIndex
CREATE INDEX "scheduled_announcements_status_nextExecuteAt_idx" ON "scheduled_announcements"("status", "nextExecuteAt");

-- CreateIndex
CREATE INDEX "scheduled_announcements_createdBy_idx" ON "scheduled_announcements"("createdBy");

-- CreateIndex
CREATE INDEX "announcement_logs_tenantId_idx" ON "announcement_logs"("tenantId");

-- CreateIndex
CREATE INDEX "announcement_logs_customerId_idx" ON "announcement_logs"("customerId");

-- CreateIndex
CREATE INDEX "announcement_logs_announcementId_idx" ON "announcement_logs"("announcementId");

-- CreateIndex
CREATE INDEX "announcement_logs_channel_idx" ON "announcement_logs"("channel");

-- CreateIndex
CREATE INDEX "announcement_logs_status_idx" ON "announcement_logs"("status");

-- CreateIndex
CREATE INDEX "announcement_logs_createdAt_idx" ON "announcement_logs"("createdAt");

-- CreateIndex
CREATE INDEX "tasks_tenantId_idx" ON "tasks"("tenantId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_status_idx" ON "tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tasks_tenantId_priority_idx" ON "tasks"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "tasks_tenantId_dueDate_idx" ON "tasks"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_createdById_idx" ON "tasks"("createdById");

-- CreateIndex
CREATE INDEX "tasks_customerId_idx" ON "tasks"("customerId");

-- CreateIndex
CREATE INDEX "task_assignees_taskId_idx" ON "task_assignees"("taskId");

-- CreateIndex
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_userId_key" ON "task_assignees"("taskId", "userId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE INDEX "task_comments_userId_idx" ON "task_comments"("userId");

-- CreateIndex
CREATE INDEX "task_attachments_taskId_idx" ON "task_attachments"("taskId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rows" ADD CONSTRAINT "rows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrol" ADD CONSTRAINT "kontrol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mails" ADD CONSTRAINT "mails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passwords" ADD CONSTRAINT "passwords_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beyanname_takip" ADD CONSTRAINT "beyanname_takip_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beyanname_takip" ADD CONSTRAINT "beyanname_takip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beyanname_turleri" ADD CONSTRAINT "beyanname_turleri_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takip_kolonlar" ADD CONSTRAINT "takip_kolonlar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takip_satirlar" ADD CONSTRAINT "takip_satirlar_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takip_satirlar" ADD CONSTRAINT "takip_satirlar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_oauth_connections" ADD CONSTRAINT "email_oauth_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "email_oauth_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_send_logs" ADD CONSTRAINT "bulk_send_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_send_logs" ADD CONSTRAINT "bulk_send_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_templates" ADD CONSTRAINT "announcement_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_announcements" ADD CONSTRAINT "scheduled_announcements_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "announcement_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_announcements" ADD CONSTRAINT "scheduled_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_logs" ADD CONSTRAINT "announcement_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_logs" ADD CONSTRAINT "announcement_logs_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "scheduled_announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_logs" ADD CONSTRAINT "announcement_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

