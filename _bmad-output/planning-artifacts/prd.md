# SMMM-AI Product Requirements Document (PRD)

**Version:** 1.0.0
**Tarih:** 2026-01-29
**Durum:** Mevcut Sistem Dokümantasyonu
**Hazırlayan:** BMAD Methodology

---

## 1. Ürün Özeti

### 1.1 Vizyon
SMMM-AI, Türkiye'deki Serbest Muhasebeci Mali Müşavirlik (SMMM) ofisleri için geliştirilmiş, bulut tabanlı, çok kiracılı (multi-tenant) bir SaaS platformudur. Platform, mükelef yönetimi, beyanname takibi, GİB otomasyon, dosya yönetimi ve müşteri iletişimi süreçlerini tek bir çatı altında toplar.

### 1.2 Hedef Kitle
| Segment | Açıklama |
|---------|----------|
| **Birincil** | SMMM ofisleri (1-10 çalışan) |
| **İkincil** | Bağımsız mali müşavirler |
| **Gelecek** | YMM ofisleri, muhasebe büroları |

### 1.3 Temel Değer Önerisi
- **Zaman Tasarrufu:** GİB bot ile manuel PDF indirme işlemlerini otomatikleştirir
- **Hata Azaltma:** Beyanname takip çizelgeleri ile dönem atlama riskini minimize eder
- **Merkezi Yönetim:** Tüm mükelef bilgileri, dosyalar ve şifreler tek platformda
- **KVKK Uyumu:** Hassas veriler AES-256-GCM ile şifrelenir

---

## 2. Kullanıcı Rolleri ve Personas

### 2.1 Roller
| Rol | Yetkiler | Tipik Kullanıcı |
|-----|----------|-----------------|
| **Admin** | Tüm özellikler, kullanıcı yönetimi, ayarlar | Ofis sahibi SMMM |
| **User** | Mükelef yönetimi, takip, dosyalar | Mali müşavir çalışanı |
| **Viewer** | Sadece görüntüleme (gelecek) | Stajyer |

### 2.2 Persona: Ahmet (Ofis Sahibi)
- **Yaş:** 45
- **Deneyim:** 20 yıl SMMM
- **Mükelef Sayısı:** 120
- **Sorunlar:**
  - Her ay 120 mükelef için GİB'den PDF indirmek 2 gün sürüyor
  - Hangi beyannamenin verildiğini takip etmek zor
  - Şifreleri Excel'de tutmak güvensiz
- **Beklentiler:**
  - Tek tıkla tüm beyannameleri indir
  - Verilmeyen beyannameleri hemen gör
  - Şifreleri güvenli bir yerde sakla

### 2.3 Persona: Ayşe (Çalışan Mali Müşavir)
- **Yaş:** 28
- **Deneyim:** 3 yıl
- **Sorumluluk:** 40 mükelef
- **Sorunlar:**
  - Hangi mükeleflerin KDV'si verildi, hatırlamak zor
  - SGK belgelerini bulmak vakit alıyor
  - Mükeleflerle iletişim kopuklukları
- **Beklentiler:**
  - Çizelgede tek bakışta durumu gör
  - Dosyaları hızlı bul
  - Hatırlatıcılarla hiçbir şeyi unutma

---

## 3. Mevcut Özellikler (Feature Inventory)

### 3.1 Mükelef Yönetimi (Customer Management)

**Modül:** `/dashboard/mukellefler`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Mükelef CRUD | Oluştur, oku, güncelle, sil | ✅ Aktif |
| Toplu Import | CSV/Excel'den mükelef aktar | ✅ Aktif |
| Toplu Silme | Birden fazla mükelef sil | ✅ Aktif |
| Mükelef Grupları | Mükelefleri kategorize et | ✅ Aktif |
| Şifre Yönetimi | GİB/SGK şifreleri (şifreli) | ✅ Aktif |
| Durum Yönetimi | Aktif/Pasif/Beklemede | ✅ Aktif |
| Firma Tipi | Şahıs/Firma/Basit Usul | ✅ Aktif |
| İletişim Bilgileri | Email, telefon, adres | ✅ Aktif |
| Verilmeyecek Beyannameler | Mükelef bazlı kural | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/customers
GET/PUT/DELETE /api/customers/[id]
POST       /api/customers/[id]/credentials
POST       /api/customers/bulk-delete
POST       /api/customers/bulk-status
POST       /api/customers/import
```

**Veritabanı:** `customers`, `customer_groups`, `customer_group_members`

---

### 3.2 Beyanname Takip (Statement Tracking)

**Modül:** `/dashboard/kontrol`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Aylık Takip | Her mükelef için dönem bazlı takip | ✅ Aktif |
| Çoklu Beyanname Tipi | KDV, KDV2, SGK, Muhasebe, Berat, vb. | ✅ Aktif |
| Durum Değerleri | Boş, Verildi, Verilmeyecek, Bekliyor | ✅ Aktif |
| JSON Tabanlı | Esnek beyanname türü desteği | ✅ Aktif |
| GİB Bot Entegrasyonu | Otomatik senkronizasyon | ✅ Aktif |
| Dönem Kuralı | Varsayılan bir önceki ay | ✅ Aktif |

**API Endpoints:**
```
GET/PUT    /api/beyanname-takip
POST       /api/beyanname-takip/sync
GET/POST   /api/beyanname-turleri
```

**Veritabanı:** `beyanname_takip`, `beyanname_turleri`

**İş Kuralı:** Beyannameler her zaman bir önceki ay için verilir. Ocak 2026'da Aralık 2025 dönemi görünür.

---

### 3.3 SGK Kontrol (SGK Tracking)

**Modül:** `/dashboard/sgk-kontrol`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Hizmet Listesi Takibi | İşçi sayısı, onay tarihi, dosya sayısı | ✅ Aktif |
| Tahakkuk Takibi | İşçi, gün, net tutar, kabul tarihi | ✅ Aktif |
| PDF Parse | SGK belgelerinden veri çıkarma | ✅ Aktif |
| Toplu Parse | Tüm dönem için otomatik parse | ✅ Aktif |
| Dosya İlişkilendirme | Mükelef-dönem-dosya bağlantısı | ✅ Aktif |
| Toplu Durum Güncelleme | Birden fazla satır güncelle | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/sgk-kontrol
POST       /api/sgk-kontrol/bulk-status
POST       /api/sgk-kontrol/parse
POST       /api/sgk-kontrol/parse-all
GET        /api/sgk-kontrol/customer-files
```

**Veritabanı:** `sgk_kontrol`

---

### 3.4 KDV Kontrol (VAT Tracking)

**Modül:** `/dashboard/kontrol` (entegre görünüm)

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Matrah Takibi | Vergi matrahı | ✅ Aktif |
| Tahakkuk Eden | Hesaplanan KDV | ✅ Aktif |
| Mahsup Edilen | İndirilecek KDV | ✅ Aktif |
| Ödenecek | Net ödenecek tutar | ✅ Aktif |
| Devreden KDV | Sonraki döneme aktarılan | ✅ Aktif |
| Damga Vergisi | İlgili damga vergisi | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/kdv-kontrol
POST       /api/kdv-kontrol/bulk-status
GET        /api/kdv-kontrol/customer-files
```

**Veritabanı:** `kdv_kontrol`

---

### 3.5 KDV2 Kontrol (Withholding Tax)

**Modül:** `/dashboard/kontrol` (entegre görünüm)

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| KDV2 Tevkifat Takibi | Stopaj beyanname takibi | ✅ Aktif |
| Aynı yapı KDV ile | Matrah, Tahakkuk, Mahsup, vb. | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/kdv2-kontrol
POST       /api/kdv2-kontrol/bulk-status
```

**Veritabanı:** `kdv2_kontrol`

---

### 3.6 Takip Çizelgesi (Tracking Spreadsheet)

**Modül:** `/dashboard/takip`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Dinamik Kolonlar | Özelleştirilebilir sütunlar | ✅ Aktif |
| Sistem Kolonları | Varsayılan kontrol alanları | ✅ Aktif |
| Dönem Bazlı | Ay/Yıl filtreleme | ✅ Aktif |
| Virtual Scrolling | 500+ satır performansı | ✅ Aktif |
| Otomatik Senkronizasyon | Yeni mükelefler otomatik eklenir | ✅ Aktif |
| JSON Tabanlı Değerler | Esnek veri yapısı | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/takip/satirlar
GET/POST   /api/takip/kolonlar
POST       /api/takip/bulk-status
POST       /api/takip/reset
```

**Veritabanı:** `takip_kolonlar`, `takip_satirlar`

---

### 3.7 Dosya Yönetimi (File Management)

**Modül:** `/dashboard/dosyalar`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Hiyerarşik Klasörler | VKN/Yıl/Ay/Beyanname yapısı | ✅ Aktif |
| Dosya Yükleme | Supabase Storage entegrasyonu | ✅ Aktif |
| PDF Görüntüleme | Tarayıcı içi PDF viewer | ✅ Aktif |
| Breadcrumb Navigasyon | Kolay gezinme | ✅ Aktif |
| Dosya Kategorileme | Tip ve dönem bazlı | ✅ Aktif |
| OCR Desteği | PDF'den metin çıkarma | ✅ Aktif |
| Klasör Senkronizasyonu | Otomatik klasör oluşturma | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/files
POST       /api/files/download
GET        /api/files/view
GET        /api/files/tree
GET        /api/files/breadcrumbs
POST       /api/files/sync
```

**Veritabanı:** `documents`

---

### 3.8 GİB Bot Entegrasyonu

**Modül:** `src/lib/gib/` + Electron App

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Otomatik Login | GİB portalına giriş | ✅ Aktif |
| PDF İndirme | Beyanname PDF'lerini indir | ✅ Aktif |
| Cookie Yönetimi | Oturum sürekliliği | ✅ Aktif |
| Captcha Çözümü | 2Captcha entegrasyonu | ✅ Aktif |
| Toplu İşlem | Tüm mükelefleri sırayla işle | ✅ Aktif |
| WebSocket Progress | Gerçek zamanlı ilerleme | ✅ Aktif |
| Pre-Download Kontrolü | Önceden indirilmiş kontrol | ✅ Aktif |
| Hata Yönetimi | Retry ve fallback | ✅ Aktif |

**API Endpoints:**
```
POST       /api/gib/sync
POST       /api/gib/process-results
GET        /api/gib/pre-downloaded
POST       /api/gib/mukellefler/sync
```

**Konfigürasyon:** `src/lib/gib/config.ts`
- Selector'lar, Timeout'lar, Delay'ler

---

### 3.9 Görev Yönetimi (Task Management)

**Modül:** `/dashboard/gorevler`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Görev CRUD | Oluştur, düzenle, sil | ✅ Aktif |
| Öncelik Seviyeleri | Düşük, Orta, Yüksek | ✅ Aktif |
| Durum Takibi | Yapılacak, Devam, Tamamlandı | ✅ Aktif |
| Atama | Kullanıcılara görev atama | ✅ Aktif |
| Ekler | Dosya ekleme | ✅ Aktif |
| Yorumlar | Görev yorumları | ✅ Aktif |
| Mükelef İlişkilendirme | Görev-mükelef bağı | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/tasks
GET/PUT/DELETE /api/tasks/[id]
POST       /api/tasks/[id]/comments
POST       /api/tasks/[id]/attachments
```

**Veritabanı:** `tasks`, `task_assignees`, `task_comments`, `task_attachments`

---

### 3.10 Hatırlatıcılar (Reminders)

**Modül:** `/dashboard/animsaticilar`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Etkinlik/Görev Türü | İki farklı hatırlatıcı tipi | ✅ Aktif |
| Tekrarlayan Hatırlatıcılar | Günlük, haftalık, aylık | ✅ Aktif |
| WhatsApp Bildirim | Otomatik mesaj gönderimi | ✅ Aktif |
| Tüm Gün Etkinlikleri | Saat belirtmeden | ✅ Aktif |
| Mükelef Bağlantısı | Hatırlatıcı-mükelef ilişkisi | ✅ Aktif |
| Toplu Hatırlatıcı | Birden fazla mükelefe | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/reminders
GET/PUT/DELETE /api/reminders/[id]
POST       /api/reminders/send
```

**Veritabanı:** `reminders`

---

### 3.11 E-Posta Entegrasyonu (Email Integration)

**Modül:** `/dashboard/mail`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| OAuth Bağlantısı | Google, Microsoft | ✅ Aktif |
| Mesaj Senkronizasyonu | Gelen kutusunu çek | ✅ Aktif |
| Klasör Yönetimi | Inbox, Sent, Drafts, vb. | ✅ Aktif |
| Mesaj Arama | İçerik bazlı arama | ✅ Aktif |
| Ek Görüntüleme | Dosyaları indir | ✅ Aktif |
| E-Posta Gönderme | Direkt platform üzerinden | ✅ Aktif |
| Şablonlar | Hazır mesaj şablonları | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/email/connections
POST       /api/email/auth/google
POST       /api/email/auth/microsoft
GET/POST   /api/email/messages
POST       /api/email/send
POST       /api/email/sync
```

**Veritabanı:** `email_oauth_connections`, `email_messages`

---

### 3.12 Toplu Gönderim (Bulk Sending)

**Modül:** `/dashboard/toplu-gonderim`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| E-Posta Gönderimi | Toplu mail | ✅ Aktif |
| SMS Gönderimi | NetGSM entegrasyonu | ✅ Aktif |
| WhatsApp Gönderimi | Whapi.cloud entegrasyonu | ✅ Aktif |
| Belge Dağıtımı | Dosyaları toplu gönder | ✅ Aktif |
| Excel Export | Sonuçları dışa aktar | ✅ Aktif |
| Durum Takibi | Gönderim başarı/hata | ✅ Aktif |

**API Endpoints:**
```
POST       /api/bulk-send/mail
POST       /api/bulk-send/sms
POST       /api/bulk-send/whatsapp
POST       /api/bulk-send/documents
GET        /api/bulk-send/status
```

**Veritabanı:** `bulk_send_logs`

---

### 3.13 Duyurular (Announcements)

**Modül:** `/dashboard/duyurular`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| Duyuru Şablonları | Hazır mesajlar | ✅ Aktif |
| Zamanlanmış Duyurular | İleri tarihli gönderim | ✅ Aktif |
| Çoklu Kanal | Email, SMS, WhatsApp | ✅ Aktif |
| Hedef Seçimi | Bireysel, grup, tümü | ✅ Aktif |
| Gönderim Geçmişi | Log takibi | ✅ Aktif |

**API Endpoints:**
```
GET/POST   /api/announcements/templates
GET/POST   /api/announcements/scheduled
POST       /api/announcements/send
GET        /api/announcements/logs
```

**Veritabanı:** `announcement_templates`, `scheduled_announcements`, `announcement_logs`

---

### 3.14 Şifre Yönetimi (Password Management)

**Modül:** `/dashboard/sifreler`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| GİB Şifreleri | Kullanıcı adı, şifre (şifreli) | ✅ Aktif |
| E-Mühür | Safe word, PIN | ✅ Aktif |
| Diğer Şifreler | JSON formatında | ✅ Aktif |
| Toplu Güncelleme | Çoklu şifre değiştirme | ✅ Aktif |
| Excel Export | Şifreleri dışa aktar | ✅ Aktif |

**API Endpoints:**
```
POST       /api/sifreler/bulk-update
GET        /api/sifreler/summary
GET        /api/sifreler/template
```

**Veritabanı:** `passwords`, `customers` (encrypted fields)

---

### 3.15 PDF Araçları (PDF Tools)

**Modül:** `/dashboard/araclar`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| PDF Sıkıştırma | Dosya boyutunu küçült | ✅ Aktif |
| PDF Birleştirme | Çoklu PDF'i birleştir | ✅ Aktif |
| PDF Bölme | Tek PDF'i böl | ✅ Aktif |
| PDF Döndürme | Sayfa yönünü değiştir | ✅ Aktif |
| OCR | Metin tanıma | ✅ Aktif |
| Format Dönüştürme | Excel↔PDF, Word↔PDF | ✅ Aktif |

**API Endpoints:**
```
POST       /api/pdf-tools/compress
POST       /api/pdf-tools/merge
POST       /api/pdf-tools/split
POST       /api/pdf-tools/rotate
POST       /api/pdf-tools/ocr
POST       /api/pdf-tools/convert/*
```

**Dış Servis:** Stirling PDF API

---

### 3.16 Ayarlar (Settings)

**Modül:** `/dashboard/ayarlar`

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| GİB Ayarları | Bot konfigürasyonu | ✅ Aktif |
| TÜRMOB Ayarları | Entegrasyon ayarları | ✅ Aktif |
| Bildirim Tercihleri | Email, SMS, WhatsApp | ✅ Aktif |
| Profil Yönetimi | Kullanıcı bilgileri | ✅ Aktif |
| Abonelik Bilgisi | Plan ve kullanım | ✅ Aktif |

**API Endpoints:**
```
GET/PUT    /api/settings/gib
GET/PUT    /api/settings/turmob
GET/PUT    /api/settings/notifications
GET/PUT    /api/settings/profile
GET        /api/settings/subscription
```

**Veritabanı:** `tenants` (settings JSON fields)

---

### 3.17 Güvenlik ve Uyumluluk

| Özellik | Açıklama | Durum |
|---------|----------|-------|
| AES-256-GCM Şifreleme | Hassas veriler | ✅ Aktif |
| Multi-Tenant Isolation | tenantId filtresi | ✅ Aktif |
| RLS (Row Level Security) | Veritabanı seviyesi | ✅ Aktif |
| Rate Limiting | API koruma (Upstash) | ✅ Aktif |
| Audit Logging | İşlem takibi | ✅ Aktif |
| KVKK Veri Export | Kullanıcı verilerini indir | ✅ Aktif |
| KVKK Silme Talebi | Veri silme isteği | ✅ Aktif |

**API Endpoints:**
```
GET        /api/kvkk/export
POST       /api/kvkk/delete-request
```

---

## 4. Teknik Mimari

### 4.1 Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7 |
| **Styling** | TailwindCSS 4, CVA |
| **UI Kit** | Radix UI (32+ component) |
| **Data Grid** | TanStack Table v8, Virtual |
| **Forms** | React Hook Form + Zod |
| **Backend** | Next.js API Routes |
| **Database** | Supabase PostgreSQL + Prisma 6.19 |
| **Auth** | Supabase Auth + NextAuth |
| **Storage** | Supabase Storage |
| **Real-time** | WebSocket |
| **Bot** | Puppeteer + Stealth + Electron |
| **PDF** | pdfjs-dist, Stirling PDF |
| **SMS** | NetGSM |
| **WhatsApp** | Whapi.cloud |
| **Captcha** | 2Captcha |

### 4.2 Veritabanı Modelleri

```
30+ Model:
├── tenants (organizasyon)
├── user_profiles (kullanıcılar)
├── customers (mükellefler)
├── customer_groups
├── documents (dosyalar)
├── beyanname_takip
├── beyanname_turleri
├── sgk_kontrol
├── kdv_kontrol
├── kdv2_kontrol
├── takip_satirlar
├── takip_kolonlar
├── tasks + task_*
├── reminders
├── email_oauth_connections
├── email_messages
├── announcement_*
├── bulk_send_logs
├── audit_logs
└── ...
```

### 4.3 API Yapısı

- **Total Endpoints:** 100+
- **Auth Guard:** Her endpoint'te `getUserWithProfile()`
- **Tenant Filter:** Her query'de `tenantId` kontrolü
- **Error Handling:** Custom error classes + apiHandler wrapper
- **Response Format:** `{ success: true/false, data/error }`

### 4.4 Güvenlik Mimarisi

```
┌─────────────────────────────────────────────────┐
│                   CLIENT                        │
├─────────────────────────────────────────────────┤
│         Rate Limiter (Upstash Redis)            │
├─────────────────────────────────────────────────┤
│         Auth Middleware (Supabase JWT)          │
├─────────────────────────────────────────────────┤
│      Tenant Isolation (tenantId filter)         │
├─────────────────────────────────────────────────┤
│         RLS (Row Level Security)                │
├─────────────────────────────────────────────────┤
│      Encryption (AES-256-GCM for creds)         │
├─────────────────────────────────────────────────┤
│         Audit Logging (all actions)             │
└─────────────────────────────────────────────────┘
```

---

## 5. Kullanıcı Hikayeleri (User Stories)

### 5.1 Mükelef Yönetimi

| ID | Story | Öncelik |
|----|-------|---------|
| US-001 | SMMM olarak, yeni mükelef ekleyebilmeliyim ki kayıtlarımı güncel tutabileyim | P0 |
| US-002 | SMMM olarak, Excel'den toplu mükelef aktarabilmeliyim ki zaman kazanayım | P0 |
| US-003 | SMMM olarak, mükelef bilgilerini düzenleyebilmeliyim ki güncel kalsın | P0 |
| US-004 | SMMM olarak, mükeleflerimi gruplandırabilmeliyim ki organize olayım | P1 |
| US-005 | SMMM olarak, pasif mükeleflerimi gizleyebilmeliyim ki listeyi sadeleştireyim | P1 |

### 5.2 Beyanname Takip

| ID | Story | Öncelik |
|----|-------|---------|
| US-010 | SMMM olarak, aylık beyanname durumunu görebilmeliyim ki eksik kalmasın | P0 |
| US-011 | SMMM olarak, beyanname durumunu "verildi" olarak işaretleyebilmeliyim | P0 |
| US-012 | SMMM olarak, bir önceki ayın beyannamelerini varsayılan görebilmeliyim | P0 |
| US-013 | SMMM olarak, verilmeyecek beyannameleri işaretleyebilmeliyim | P1 |

### 5.3 GİB Bot

| ID | Story | Öncelik |
|----|-------|---------|
| US-020 | SMMM olarak, GİB'den beyannameleri otomatik indirebilmeliyim | P0 |
| US-021 | SMMM olarak, bot ilerlemesini gerçek zamanlı görebilmeliyim | P0 |
| US-022 | SMMM olarak, indirilemeyen mükelefler hakkında rapor alabilmeliyim | P0 |
| US-023 | SMMM olarak, önceden indirilmiş dosyaları tekrar indirmemeli | P1 |

### 5.4 Dosya Yönetimi

| ID | Story | Öncelik |
|----|-------|---------|
| US-030 | SMMM olarak, mükelef dosyalarını klasör yapısında görebilmeliyim | P0 |
| US-031 | SMMM olarak, PDF'leri tarayıcıda görüntüleyebilmeliyim | P0 |
| US-032 | SMMM olarak, dosya yükleyebilmeliyim | P0 |
| US-033 | SMMM olarak, dosyaları dönem ve tipe göre filtreleyebilmeliyim | P1 |

### 5.5 SGK/KDV Kontrol

| ID | Story | Öncelik |
|----|-------|---------|
| US-040 | SMMM olarak, SGK belgelerini takip edebilmeliyim | P0 |
| US-041 | SMMM olarak, SGK PDF'lerinden veri çıkarabilmeliyim | P0 |
| US-042 | SMMM olarak, KDV tutarlarını takip edebilmeliyim | P0 |
| US-043 | SMMM olarak, toplu durum güncellemesi yapabilmeliyim | P1 |

---

## 6. Fonksiyonel Olmayan Gereksinimler (NFR)

### 6.1 Performans
| Metrik | Hedef |
|--------|-------|
| Sayfa Yüklenme | < 3 saniye |
| API Response | < 500ms |
| Bot İndirme/Mükelef | < 30 saniye |
| Virtual Scroll | 500+ satır sorunsuz |

### 6.2 Güvenlik
| Gereksinim | Uygulama |
|------------|----------|
| Veri Şifreleme | AES-256-GCM |
| Auth | JWT + Supabase Auth |
| Rate Limiting | Upstash Redis |
| SQL Injection | Prisma ORM |
| XSS | DOMPurify + React |

### 6.3 Ölçeklenebilirlik
| Metrik | Kapasite |
|--------|----------|
| Tenant | 1000+ |
| Mükelef/Tenant | 500+ |
| Eşzamanlı Kullanıcı | 100+ |

### 6.4 Erişilebilirlik
- WCAG 2.1 AA uyumu (hedef)
- Klavye navigasyonu
- Screen reader desteği (Radix UI)

### 6.5 Yasal Uyumluluk
- KVKK uyumu
- 5 yıl veri saklama (mali belgeler için 10 yıl)
- Audit log

---

## 7. Kapsam Dışı (Out of Scope)

Bu PRD'de yer almayan, gelecekte değerlendirilecek özellikler:

| Özellik | Açıklama | Neden Kapsam Dışı |
|---------|----------|-------------------|
| Mobil Uygulama | iOS/Android native | Phase 2 |
| E-Fatura Entegrasyonu | GİB e-fatura | Ayrı modül |
| Muhasebe Defteri | Entegre defter | Farklı ürün |
| Çoklu Dil | İngilizce, Almanca | Öncelik düşük |
| API Marketplace | Üçüncü parti entegrasyonlar | Phase 3 |

---

## 8. Başarı Metrikleri (KPI)

| Metrik | Tanım | Hedef |
|--------|-------|-------|
| **DAU** | Günlük aktif kullanıcı | 80%+ |
| **Bot Success Rate** | Başarılı PDF indirme oranı | 95%+ |
| **Beyanname Tracking** | Dönem atlama oranı | < 1% |
| **Response Time** | Ortalama API süresi | < 500ms |
| **Uptime** | Sistem erişilebilirliği | 99.5%+ |
| **NPS** | Net Promoter Score | > 50 |

---

## 9. Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| GİB Site Değişikliği | Yüksek | Yüksek | Selector'ları konfigüre edilebilir tut, hızlı güncelleme süreci |
| Veri Sızıntısı | Düşük | Kritik | Encryption, RLS, Audit Log, Penetration Test |
| Performans Sorunları | Orta | Orta | Virtual scrolling, DB index'ler, Cache |
| Bot Captcha Bloğu | Orta | Orta | 2Captcha, Rate limiting, Backoff |

---

## 10. Sözlük (Glossary)

| Terim | Açıklama |
|-------|----------|
| **SMMM** | Serbest Muhasebeci Mali Müşavir |
| **GİB** | Gelir İdaresi Başkanlığı |
| **SGK** | Sosyal Güvenlik Kurumu |
| **KDV** | Katma Değer Vergisi |
| **KVKK** | Kişisel Verilerin Korunması Kanunu |
| **Mükelef** | Vergi mükellefi, müşteri |
| **Beyanname** | Vergi beyannamesi |
| **Tenant** | Kiracı (multi-tenant'ta organizasyon) |
| **RLS** | Row Level Security |

---

## 11. Revizyon Geçmişi

| Versiyon | Tarih | Değişiklik | Yazar |
|----------|-------|------------|-------|
| 1.0.0 | 2026-01-29 | İlk versiyon - Mevcut sistem dokümantasyonu | BMAD |

---

> **Not:** Bu PRD mevcut SMMM-AI sisteminin tüm özelliklerini belgeler. Yeni özellikler için ayrı PRD'ler oluşturulacaktır.
