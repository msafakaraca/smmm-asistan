# SMMM-AI Veri Modelleri

> **ORM:** Prisma 6.19
> **Veritabanı:** Supabase PostgreSQL
> **Güvenlik:** Row Level Security (RLS)

---

## 📊 Model Genel Bakışı

**Toplam Model Sayısı:** 30+
**Mimari:** Multi-tenant (her kayıt tenantId ile izole)

---

## 🏢 Tenant & Kullanıcı Modelleri

### tenants

Ana kiracı (ofis) modeli. Tüm verilerin sahibi.

```prisma
model tenants {
  id                   String   @id @default(uuid()) @db.Uuid
  name                 String                          // Ofis adı
  slug                 String   @unique                // URL-friendly isim
  plan                 String   @default("trial")      // Abonelik planı
  status               String   @default("active")     // active, suspended
  expiresAt            DateTime?                       // Abonelik bitiş

  // Ofis Bilgileri
  email                String?
  telefon              String?
  adres                String?
  vergiDairesi         String?
  vknTckn              String?
  smmmSicilNo          String?

  // Ayarlar (JSON)
  settings             Json?                           // Genel ayarlar
  gibSettings          Json?                           // GİB bot ayarları
  turmobSettings       Json?                           // TÜRMOB ayarları
  notificationSettings Json?                           // Bildirim ayarları

  // API Keys (şifrelenmiş)
  captchaKey           String?                         // 2Captcha API
  whatsappApiKey       String?                         // Whapi.cloud

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  // İlişkiler (30+ model)
  customers            customers[]
  documents            documents[]
  user_profiles        user_profiles[]
  // ... ve diğerleri
}
```

### user_profiles

Kullanıcı profilleri. Supabase Auth ile entegre.

```prisma
model user_profiles {
  id             String   @id @db.Uuid              // Supabase Auth user.id
  tenantId       String   @db.Uuid
  email          String   @unique
  name           String
  role           String   @default("user")          // admin, user
  permissions    String[] @default([])              // Özel yetkiler
  status         String   @default("pending")       // pending, active
  phoneNumber    String?
  hashedPassword String?                            // Internal auth için
  lastLoginAt    DateTime?
  invitedAt      DateTime?
  invitedBy      String?  @db.Uuid

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // İlişkiler
  tenants        tenants  @relation(...)
  tasks          tasks[]
  reminders      reminders[]

  @@index([tenantId])
  @@index([tenantId, status])
}
```

---

## 👥 Mükellef Modelleri

### customers

Ana mükellef (müşteri) modeli.

```prisma
model customers {
  id                       String   @id @default(uuid()) @db.Uuid

  // Temel Bilgiler
  unvan                    String                    // Ticari unvan
  kisaltma                 String?                   // Kısa isim
  vknTckn                  String                    // VKN veya TCKN
  vergiKimlikNo            String?                   // 10 haneli VKN
  tcKimlikNo               String?                   // 11 haneli TCKN
  vergiDairesi             String?
  sirketTipi               String   @default("sahis") // sahis, firma, basit_usul
  faaliyetKodu             String?
  sortOrder                Int      @default(0)

  // İletişim
  email                    String?
  telefon1                 String?
  telefon2                 String?
  adres                    String?
  yetkiliKisi              String?

  // GİB Credentials (şifrelenmiş)
  gibKodu                  String?                   // encrypt()
  gibSifre                 String?                   // encrypt()
  gibParola                String?                   // encrypt()
  interaktifSifre          String?                   // encrypt()
  emuhurPin                String?                   // encrypt()

  // SGK Credentials (şifrelenmiş)
  sgkKullaniciAdi          String?
  sgkIsyeriKodu            String?
  sgkSistemSifresi         String?                   // encrypt()
  sgkIsyeriSifresi         String?                   // encrypt()

  // Durum
  status                   String   @default("active") // active, inactive
  notes                    String?
  verilmeyecekBeyannameler String[] @default([])     // KDV1, MUH, vb.

  // Sözleşme
  siraNo                   String?
  sozlesmeNo               String?
  sozlesmeTarihi           String?

  tenantId                 String   @db.Uuid
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  // İlişkiler
  tenants                  tenants  @relation(...)
  documents                documents[]
  beyanname_takip          beyanname_takip[]
  reminders                reminders[]
  tasks                    tasks[]
  sgk_kontrol              sgk_kontrol[]
  kdv_kontrol              kdv_kontrol[]
  kdv2_kontrol             kdv2_kontrol[]
  takip_satirlar           takip_satirlar[]

  @@unique([tenantId, vknTckn])
  @@index([tenantId])
  @@index([tenantId, status])
}
```

### customer_groups

Mükellef grupları (etiketleme).

```prisma
model customer_groups {
  id                 String   @id @default(uuid()) @db.Uuid
  name               String
  description        String?
  color              String   @default("#3B82F6")
  icon               String?
  sirketTipiFilter   String?                         // Şirket tipi filtresi
  beyannameTypes     String[] @default([])           // Beyanname türleri

  tenantId           String   @db.Uuid
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // İlişkiler
  members            customer_group_members[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

---

## 📋 Beyanname & Takip Modelleri

### beyanname_takip

Aylık beyanname durumları.

```prisma
model beyanname_takip {
  id           String   @id @default(uuid()) @db.Uuid
  year         Int
  month        Int
  customerId   String   @db.Uuid
  beyannameler Json     @default("{}")               // {"KDV1": {"status": "verildi"}}

  tenantId     String   @db.Uuid
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // İlişkiler
  customers    customers @relation(...)
  tenants      tenants   @relation(...)

  @@unique([customerId, year, month])
  @@index([tenantId])
  @@index([year, month])
  @@index([tenantId, year, month])
}
```

**beyannameler JSON yapısı:**
```json
{
  "KDV1": {
    "status": "verildi",      // bos, verildi, verilmeyecek, bekliyor
    "tahakkukTarihi": "2026-01-15",
    "damgaVergisi": 100.50
  },
  "MUH": { "status": "bos" },
  "SGK": { "status": "verildi" }
}
```

### beyanname_turleri

Beyanname türleri tanımları.

```prisma
model beyanname_turleri {
  id        String   @id @default(uuid()) @db.Uuid
  kod       String                                   // KDV1, MUH, SGK, vb.
  aciklama  String                                   // Uzun açıklama
  kisaAd    String?                                  // Kısa gösterim
  kategori  String?                                  // Kategori
  aktif     Boolean  @default(true)
  siraNo    Int      @default(0)

  tenantId  String   @db.Uuid

  @@unique([tenantId, kod])
  @@index([tenantId])
  @@index([tenantId, aktif])
}
```

### sgk_kontrol

SGK hizmet/tahakkuk takibi.

```prisma
model sgk_kontrol {
  id                  String   @id @default(uuid()) @db.Uuid
  customerId          String   @db.Uuid
  year                Int
  month               Int

  // Hizmet Listesi (PDF parse)
  hizmetIsciSayisi    Int?
  hizmetOnayTarihi    DateTime?
  hizmetDocumentId    String?                        // Virgülle ayrılmış UUID'ler
  hizmetDosyaSayisi   Int?     @default(1)

  // Tahakkuk (PDF parse)
  tahakkukIsciSayisi  Int?
  tahakkukGunSayisi   Int?
  tahakkukNetTutar    Decimal? @db.Decimal(15, 2)
  tahakkukKabulTarihi DateTime?
  tahakkukDocumentId  String?
  tahakkukDosyaSayisi Int?     @default(1)

  // Durum
  status              String   @default("bekliyor")  // bekliyor, gonderildi, eksik
  notes               String?

  tenantId            String   @db.Uuid

  @@unique([customerId, year, month])
  @@index([tenantId])
  @@index([tenantId, year, month])
}
```

### kdv_kontrol / kdv2_kontrol

KDV ve KDV2 (tevkifat) takibi.

```prisma
model kdv_kontrol {
  id                  String   @id @default(uuid()) @db.Uuid
  customerId          String   @db.Uuid
  year                Int
  month               Int

  // PDF parse edilen veriler
  kdvMatrah           Decimal? @db.Decimal(15, 2)
  tahakkukEden        Decimal? @db.Decimal(15, 2)
  mahsupEdilen        Decimal? @db.Decimal(15, 2)
  odenecek            Decimal? @db.Decimal(15, 2)
  devredenKdv         Decimal? @db.Decimal(15, 2)
  damgaVergisi        Decimal? @db.Decimal(15, 2)
  vade                DateTime?
  beyanTarihi         DateTime?

  // Dosya referansları
  tahakkukDocumentId  String?
  tahakkukDosyaSayisi Int?     @default(1)

  status              String   @default("bekliyor")
  notes               String?

  tenantId            String   @db.Uuid

  @@unique([customerId, year, month])
}
```

### takip_kolonlar / takip_satirlar

Dinamik takip çizelgesi.

```prisma
model takip_kolonlar {
  id        String   @id @default(uuid()) @db.Uuid
  kod       String                                   // Kolon kodu
  baslik    String                                   // Görünen başlık
  tip       String   @default("boolean")             // boolean, text, date
  siraNo    Int      @default(0)
  sistem    Boolean  @default(false)                 // Sistem kolonu mu?
  aktif     Boolean  @default(true)
  width     Int      @default(100)

  tenantId  String   @db.Uuid

  @@unique([tenantId, kod])
  @@index([tenantId])
}

model takip_satirlar {
  id         String   @id @default(uuid()) @db.Uuid
  customerId String?  @db.Uuid
  no         String?
  isim       String?
  year       Int
  month      Int
  siraNo     Int      @default(0)
  degerler   Json     @default("{}")                 // Kolon değerleri
  values     Json     @default("{}")

  tenantId   String   @db.Uuid

  @@unique([tenantId, customerId, year, month])
  @@index([year, month])
}
```

---

## 📁 Dosya Modelleri

### documents

Hiyerarşik dosya yönetimi.

```prisma
model documents {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  originalName    String?
  type            String                             // folder, file
  mimeType        String?
  size            Int      @default(0)

  // Hiyerarşi
  isFolder        Boolean  @default(false)
  parentId        String?  @db.Uuid                  // Üst klasör
  path            String?                            // /2026/KDV/...

  // Depolama
  url             String?                            // Supabase Storage URL
  storage         String   @default("local")         // local, supabase

  // Beyanname bilgileri
  year            Int?
  month           Int?
  beyannameTuru   String?                            // KDV1, MUH, vb.
  fileCategory    String?                            // tahakkuk, beyanname
  fileIndex       Int?

  // Görsel
  icon            String?
  color           String?
  vknTckn         String?

  customerId      String?  @db.Uuid
  tenantId        String   @db.Uuid

  // Self-relation (hiyerarşi)
  documents       documents? @relation("hierarchy", ...)
  children        documents[] @relation("hierarchy")

  @@index([parentId])
  @@index([tenantId, customerId])
  @@index([beyannameTuru])
}
```

---

## ✉️ İletişim Modelleri

### email_oauth_connections

OAuth email bağlantıları.

```prisma
model email_oauth_connections {
  id             String   @id @default(uuid()) @db.Uuid
  provider       String                              // google, microsoft
  email          String
  accessToken    String                              // Şifrelenmiş
  refreshToken   String?
  expiresAt      DateTime?
  scopes         String[] @default([])
  lastSyncAt     DateTime?
  syncStatus     String   @default("idle")           // idle, syncing, error
  isActive       Boolean  @default(true)

  tenantId       String   @db.Uuid

  // İlişkiler
  email_messages email_messages[]

  @@unique([tenantId, provider, email])
}
```

### email_messages

Email mesajları (cache).

```prisma
model email_messages {
  id             String   @id @default(uuid()) @db.Uuid
  messageId      String
  threadId       String?
  from           String?
  to             String[] @default([])
  cc             String[] @default([])
  subject        String?
  bodyHtml       String?
  bodyText       String?
  snippet        String?
  isRead         Boolean  @default(false)
  isStarred      Boolean  @default(false)
  folder         String?
  hasAttachments Boolean  @default(false)
  attachments    Json?
  receivedAt     DateTime?

  connectionId   String   @db.Uuid
  customerId     String?  @db.Uuid                   // Otomatik eşleşme
  tenantId       String   @db.Uuid

  @@unique([connectionId, messageId])
  @@index([receivedAt])
  @@index([isRead])
}
```

### scheduled_announcements

Zamanlanmış duyurular.

```prisma
model scheduled_announcements {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  subject         String?
  content         String

  // Kanallar
  sendEmail       Boolean  @default(false)
  sendSms         Boolean  @default(false)
  sendWhatsApp    Boolean  @default(false)

  // Zamanlama
  scheduledAt     DateTime
  repeatPattern   String?                            // daily, weekly, monthly
  repeatDay       Int?
  repeatEndDate   DateTime?
  lastExecutedAt  DateTime?
  nextExecuteAt   DateTime?

  // Hedef
  targetType      String   @default("selected")      // all, selected, group
  customerIds     String[] @default([])
  groupIds        String[] @default([])

  status          String   @default("active")
  templateId      String?  @db.Uuid
  createdBy       String   @db.Uuid
  tenantId        String   @db.Uuid

  @@index([status, nextExecuteAt])
}
```

---

## ✅ Görev Modelleri

### tasks

Görev yönetimi.

```prisma
model tasks {
  id               String   @id @default(uuid()) @db.Uuid
  title            String
  description      String?
  priority         String   @default("medium")       // low, medium, high, urgent
  status           String   @default("todo")         // todo, in_progress, done
  dueDate          DateTime?

  createdById      String   @db.Uuid
  customerId       String?  @db.Uuid                 // Müşteriye bağlı görev
  tenantId         String   @db.Uuid

  // İlişkiler
  assignees        task_assignees[]
  comments         task_comments[]
  attachments      task_attachments[]

  @@index([tenantId, status])
  @@index([tenantId, priority])
  @@index([tenantId, dueDate])
}
```

---

## 🔗 İlişki Diyagramı

```
tenants
    │
    ├── user_profiles
    │
    ├── customers
    │   ├── documents
    │   ├── beyanname_takip
    │   ├── sgk_kontrol
    │   ├── kdv_kontrol
    │   ├── reminders
    │   ├── tasks
    │   └── takip_satirlar
    │
    ├── customer_groups
    │   └── customer_group_members
    │
    ├── email_oauth_connections
    │   └── email_messages
    │
    ├── scheduled_announcements
    │   └── announcement_logs
    │
    ├── beyanname_turleri
    ├── takip_kolonlar
    └── passwords
```

---

## 📑 Index Stratejisi

### Performans İndeksleri

```prisma
// Tenant isolation
@@index([tenantId])

// Compound indexes
@@index([tenantId, status])
@@index([tenantId, year, month])

// Unique constraints
@@unique([tenantId, vknTckn])
@@unique([customerId, year, month])
```

---

## 🔐 Güvenlik Notları

1. **Tenant Isolation:** Her query'de `tenantId` filtresi zorunlu
2. **Encryption:** Hassas alanlar (`gibSifre`, `sgkSistemSifresi`, vb.) AES-256-GCM ile şifrelenmiş
3. **RLS:** Supabase seviyesinde Row Level Security politikaları aktif
4. **Soft Delete:** Kritik veriler için `status` alanı kullanılır

---

## 📚 İlgili Dokümantasyon

- [Proje Genel Bakışı](./project-overview.md)
- [Mimari](./architecture-main.md)
- [API Kontratları](./api-contracts.md)
