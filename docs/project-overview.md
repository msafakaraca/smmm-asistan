# SMMM-AI Proje Genel Bakışı

> **Son Güncelleme:** 2026-01-29
> **Proje Sürümü:** 0.1.0
> **Durum:** Aktif Geliştirme

---

## 📌 Yönetici Özeti

**SMMM-AI**, Türkiye'deki Serbest Muhasebeci Mali Müşavirler (SMMM) için geliştirilmiş, multi-tenant SaaS muhasebe ve otomasyon platformudur.

| Özellik | Değer |
|---------|-------|
| **Proje Adı** | smmm-asistan |
| **Amaç** | Mali müşavirlik ofislerinin operasyonlarını dijitalleştirmek ve otomatize etmek |
| **Hedef Kitle** | SMMM'ler, Muhasebe Ofisleri, Mali Danışmanlar |
| **Mimari** | Multi-tenant SaaS + Electron Bot |
| **Durum** | Multi-tenant çalışır durumda |

---

## 🏗️ Proje Yapısı

Bu proje **multi-part** bir monorepo yapısındadır:

### Parçalar

| Parça | Dizin | Tip | Açıklama |
|-------|-------|-----|----------|
| **main** | `/` (kök) | Web Uygulaması | Next.js 15 tabanlı ana web uygulaması |
| **electron-bot** | `/electron-bot` | Masaüstü Uygulama | GİB/TÜRMOB otomasyon botu |

---

## 🛠️ Teknoloji Yığını

### Main (Web Uygulaması)

| Kategori | Teknoloji | Sürüm | Açıklama |
|----------|-----------|-------|----------|
| **Framework** | Next.js | 15.3.0 | React framework (App Router) |
| **UI Library** | React | 19.0.0 | Component-based UI |
| **Dil** | TypeScript | 5.7.2 | Tip güvenliği |
| **Styling** | TailwindCSS | 4.0.0 | Utility-first CSS |
| **UI Bileşenleri** | Radix UI | Latest | Erişilebilir headless bileşenler |
| **ORM** | Prisma | 6.19.0 | PostgreSQL ORM |
| **Veritabanı** | Supabase PostgreSQL | - | Cloud PostgreSQL + RLS |
| **Auth** | Supabase Auth | 2.90.1 | Kimlik doğrulama |
| **Storage** | Supabase Storage | - | Dosya depolama |
| **Real-time** | WebSocket (ws) | 8.18.3 | Bot iletişimi |
| **Tablo** | TanStack Table | 8.21.3 | Gelişmiş tablo |
| **Virtualization** | TanStack Virtual | 3.13.18 | Büyük liste performansı |
| **Form** | React Hook Form | 7.69.0 | Form yönetimi |
| **Validation** | Zod | 3.25.76 | Schema validation |
| **Icons** | Lucide React | 0.556.0 | İkon kütüphanesi |
| **Toast** | Sonner | 2.0.7 | Bildirimler |
| **Animation** | Framer Motion | 12.28.1 | Animasyonlar |
| **Excel** | ExcelJS | 4.4.0 | Excel import/export |
| **PDF** | pdf-parse, pdfjs-dist | Latest | PDF işleme |

### Electron Bot (Masaüstü Uygulama)

| Kategori | Teknoloji | Sürüm | Açıklama |
|----------|-----------|-------|----------|
| **Framework** | Electron | 34.0.0 | Masaüstü uygulama |
| **Build Tool** | Vite | 6.0.5 | Hızlı build |
| **UI** | React | 19.0.0 | Renderer UI |
| **Styling** | TailwindCSS | 4.0.0 | CSS framework |
| **Automation** | Puppeteer | 24.0.0 | Browser otomasyon |
| **Stealth** | Puppeteer Stealth | 2.11.2 | Bot algılama bypass |
| **WebSocket** | ws | 8.18.0 | Server iletişimi |
| **PDF Parse** | pdf-parse | 1.1.4 | PDF okuma |

---

## 📊 Veritabanı Özeti

**30+ Prisma modeli** ile kapsamlı multi-tenant yapı:

### Ana Modeller

| Model | Açıklama | İlişkiler |
|-------|----------|-----------|
| `tenants` | Kiracı (ofis) bilgileri | Tüm verinin sahibi |
| `user_profiles` | Kullanıcı profilleri | Tenant'a bağlı |
| `customers` | Mükellefler | Documents, BeyannameTakip, Tasks |
| `beyanname_takip` | Aylık beyanname durumları | Customer'a bağlı |
| `documents` | Dosya yönetimi | Hiyerarşik yapı, Customer |
| `reminders` | Hatırlatıcılar | Customer, User |
| `tasks` | Görev yönetimi | Assignees, Comments, Attachments |

### Kontrol Çizelgeleri

| Model | Açıklama |
|-------|----------|
| `sgk_kontrol` | SGK hizmet/tahakkuk takibi |
| `kdv_kontrol` | KDV beyanname takibi |
| `kdv2_kontrol` | KDV2 (tevkifat) takibi |
| `takip_kolonlar` | Dinamik takip kolonları |
| `takip_satirlar` | Takip satır verileri |

### İletişim Modelleri

| Model | Açıklama |
|-------|----------|
| `email_oauth_connections` | Gmail/Outlook OAuth bağlantıları |
| `email_messages` | Email mesajları |
| `announcement_templates` | Duyuru şablonları |
| `scheduled_announcements` | Zamanlanmış duyurular |
| `bulk_send_logs` | Toplu gönderim logları |

---

## 🔌 API Özeti

**100+ API endpoint** ile kapsamlı REST API:

### Endpoint Grupları

| Grup | Endpoint Prefix | Endpoint Sayısı | Açıklama |
|------|-----------------|-----------------|----------|
| **Auth** | `/api/auth/*` | 4 | Kimlik doğrulama |
| **Customers** | `/api/customers/*` | 8 | Mükellef yönetimi |
| **Beyanname** | `/api/beyanname-takip/*` | 2 | Beyanname takibi |
| **Files** | `/api/files/*` | 10 | Dosya yönetimi |
| **Documents** | `/api/documents/*` | 3 | Doküman işlemleri |
| **GİB** | `/api/gib/*` | 5 | GİB bot işlemleri |
| **Email** | `/api/email/*` | 12 | Email yönetimi |
| **Tasks** | `/api/tasks/*` | 6 | Görev yönetimi |
| **Reminders** | `/api/reminders/*` | 4 | Hatırlatıcılar |
| **Settings** | `/api/settings/*` | 5 | Ayarlar |
| **SGK Kontrol** | `/api/sgk-kontrol/*` | 5 | SGK takibi |
| **KDV Kontrol** | `/api/kdv-kontrol/*` | 4 | KDV takibi |
| **Bulk Send** | `/api/bulk-send/*` | 8 | Toplu gönderim |
| **PDF Tools** | `/api/pdf-tools/*` | 8 | PDF işlemleri |
| **Users** | `/api/users/*` | 4 | Kullanıcı yönetimi |

---

## 🎨 UI Bileşen Özeti

**100+ React bileşeni** ile modüler UI yapısı:

### Bileşen Kategorileri

| Kategori | Dizin | Bileşen Sayısı | Açıklama |
|----------|-------|----------------|----------|
| **UI Primitives** | `components/ui/` | 28 | Radix tabanlı temel bileşenler |
| **Auth** | `components/auth/` | 2 | Login, Register formları |
| **Dashboard** | `components/dashboard/` | 3 | Dashboard bileşenleri |
| **Kontrol** | `components/kontrol/` | 3 | Beyanname kontrol |
| **SGK Kontrol** | `components/sgk-kontrol/` | 5+ | SGK takip çizelgesi |
| **KDV Kontrol** | `components/kdv-kontrol/` | 5+ | KDV takip çizelgesi |
| **Dosyalar** | `components/dosyalar/` | 7 | Dosya yönetimi |
| **Mail** | `components/mail/` | 8 | Email modülü |
| **Reminders** | `components/reminders/` | 14 | Hatırlatıcılar |
| **Tasks** | `components/tasks/` | 12 | Görev yönetimi |
| **Takip** | `components/takip/` | 3 | Takip çizelgesi |
| **Users** | `components/users/` | 6 | Kullanıcı yönetimi |
| **Settings** | `components/settings/` | 3 | Ayarlar |
| **Bulk Send** | `components/bulk-send/` | 4 | Toplu gönderim |

---

## 🔐 Güvenlik Özellikleri

| Özellik | Uygulama |
|---------|----------|
| **Multi-tenant Isolation** | Her query'de `tenantId` filtresi |
| **Row Level Security** | Supabase RLS politikaları |
| **Encryption** | AES-256-GCM ile hassas veri şifreleme |
| **Auth** | Supabase Auth + JWT |
| **Session** | Cookie-based secure sessions |
| **API Protection** | Middleware ile auth kontrolü |

---

## 📁 Dizin Yapısı

```
smmm_asistan/
├── prisma/                    # Veritabanı şeması
│   └── schema.prisma          # 30+ model
├── server.ts                  # WebSocket server
├── electron-bot/              # Electron bot uygulaması
│   ├── src/
│   │   ├── main/              # Electron main process
│   │   ├── renderer/          # React UI
│   │   └── bots/              # Puppeteer botları
│   └── package.json
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login, Register
│   │   ├── (dashboard)/       # Protected routes
│   │   │   └── dashboard/
│   │   │       ├── mukellefler/
│   │   │       ├── kontrol/
│   │   │       ├── dosyalar/
│   │   │       ├── takip/
│   │   │       └── ...
│   │   └── api/               # 100+ API endpoint
│   ├── components/            # 100+ React bileşen
│   │   ├── ui/                # Radix primitives
│   │   ├── kontrol/           # Beyanname kontrol
│   │   ├── dosyalar/          # Dosya yönetimi
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/          # Auth clients
│   │   ├── crypto.ts          # AES-256-GCM
│   │   └── db.ts              # Prisma client
│   ├── hooks/                 # Custom hooks
│   ├── context/               # React contexts
│   ├── providers/             # Global providers
│   └── types/                 # TypeScript types
├── docs/                      # Dokümantasyon
├── public/                    # Statik dosyalar
└── package.json
```

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js >= 20.x
- PostgreSQL (Supabase)
- npm veya yarn

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Prisma client oluştur
npm run db:generate

# Development server başlat
npm run dev
```

### Ortam Değişkenleri

```env
# Database
DATABASE_URL=
DIRECT_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Security
ENCRYPTION_KEY=
JWT_SECRET=
```

---

## 📚 İlgili Dokümantasyon

- [Mimari](./architecture-main.md)
- [API Kontratları](./api-contracts.md)
- [Veri Modelleri](./data-models.md)
- [Bileşen Envanteri](./component-inventory.md)
- [Geliştirme Kılavuzu](./development-guide.md)
- [Electron Bot Mimarisi](./architecture-electron-bot.md)

---

> **SMMM-AI** - Mali Müşavirler için Akıllı Otomasyon Platformu
