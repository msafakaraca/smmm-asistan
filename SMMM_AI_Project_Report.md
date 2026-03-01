# SMMM-AI Projesi - Kapsamlı Teknik Dokümantasyon

> **Amaç:** Bu rapor, SMMM-AI projesinin tüm teknik detaylarını içermektedir. Yeni bir AI asistanı ile bu projeyi ticari bir SaaS ürününe dönüştürmek için kullanılabilir.

---

## 📌 PROJE ÖZETİ

**SMMM-AI**, Türkiye'deki Serbest Muhasebeci Mali Müşavirler (SMMM) için geliştirilmiş kapsamlı bir **muhasebe ofis yönetim sistemi**dir.

| Özellik | Açıklama |
|---------|----------|
| **Proje Adı** | SMMM-AI (smmm-ai) |
| **Amaç** | Mali müşavirlik ofislerinin operasyonlarını dijitalleştirmek ve otomatize etmek |
| **Hedef Kitle** | SMMM'ler, Muhasebe Ofisleri, Mali Danışmanlar |
| **Mevcut Durum** | Tek kullanıcı için çalışır durumda, multi-tenant değil |

---

## 🛠️ TEKNOLOJİ STACK'İ

### Frontend
| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **React** | 19.2.0 | UI Framework |
| **TypeScript** | ~5.9.3 | Type Safety |
| **Vite** | 7.2.4 | Build Tool |
| **React Router DOM** | 7.11.0 | Sayfa Yönlendirme |
| **TailwindCSS** | 4.1.18 | Styling |
| **Lucide React** | 0.560.0 | İkonlar |
| **Framer Motion** | 12.23.26 | Animasyonlar |
| **Recharts** | 3.5.1 | Grafikler |
| **Socket.io Client** | 4.8.1 | Gerçek Zamanlı İletişim |
| **@azure/msal-react** | 3.0.23 | Microsoft OAuth (Outlook) |

### Backend
| Teknoloji | Versiyon | Kullanım Amacı |
|-----------|----------|----------------|
| **Node.js + Express** | 5.2.1 | API Server |
| **MongoDB + Mongoose** | 9.0.2 | Veritabanı |
| **Socket.io** | 4.8.1 | WebSocket (Gerçek Zamanlı) |
| **Google APIs** | 169.0.0 | Gmail API |
| **Puppeteer** | 24.34.0 | GİB Bot (Web Scraping) |
| **Node-Cron** | 4.2.1 | Zamanlanmış Görevler |
| **Multer** | 2.0.2 | Dosya Yükleme |

### Deployment
| Platform | Kullanım |
|----------|----------|
| **Render** | Backend Hosting |
| **Vercel** (opsiyonel) | Frontend Hosting |
| **MongoDB Atlas** | Cloud Database |
| **Docker** | Konteynerizasyon |

---

## 📁 DOSYA YAPISI

```
faturaai/
├── src/
│   ├── App.tsx                     # Ana uygulama + Routing
│   ├── main.tsx                    # Entry point + MSAL kurulumu
│   ├── index.css                   # Global stiller
│   ├── authConfig.ts               # Microsoft OAuth ayarları
│   ├── types.ts                    # TypeScript tip tanımları
│   ├── components/
│   │   ├── Navbar.tsx              # Navigasyon menüsü
│   │   ├── ChatBox.tsx             # Genel sohbet kutusu
│   │   ├── FileUpload.tsx          # Dosya yükleme bileşeni
│   │   ├── ProcessingView.tsx      # İşlem görüntüleme
│   │   ├── ui/
│   │   │   └── Tooltip.tsx         # Tooltip bileşeni
│   │   └── modules/                # ANA MODÜLLER (31 adet)
│   │       ├── KontrolModule.tsx           # Beyanname Kontrol
│   │       ├── AccountingTrackingModule.tsx # Takip Çizelgesi  
│   │       ├── MailGonderimModule.tsx      # Mail Gönderim
│   │       ├── ChatbotModule.tsx           # AI Asistan
│   │       ├── ReminderModule.tsx          # Hatırlatıcılar
│   │       ├── PasswordsModule.tsx         # Şifre Yönetimi
│   │       ├── MizanAnaliziModule.tsx      # Mizan Analizi
│   │       ├── OutlookInboxModule.tsx      # Outlook Entegrasyonu
│   │       └── [Z-Raporu ve Fatura modülleri...]
│   ├── context/
│   │   ├── SocketContext.tsx       # Socket.io Context
│   │   └── InvoiceContext.tsx      # Fatura Context
│   ├── hooks/
│   │   └── useKeepAlive.ts         # Server ping hook
│   └── services/
│       └── graphService.ts         # Microsoft Graph API
├── scripts/
│   └── gib-bot.js                  # GİB E-Beyanname Bot (Puppeteer)
├── server.js                       # Express Backend (1943 satır)
├── package.json                    # Bağımlılıklar
├── Dockerfile                      # Docker konfigürasyonu
├── .env.local                      # Ortam değişkenleri (GİZLİ)
└── db.json                         # Yerel veri yedekleri
```

---

## 🔗 API ENDPOINTS

### Takip Çizelgesi (Rows)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/rows` | Tüm takip satırlarını getir |
| GET | `/rows/:id` | Tek satır getir |
| POST | `/rows` | Yeni satır ekle |
| PUT | `/rows/:id` | Satırı güncelle |
| PATCH | `/rows/:id` | Kısmi güncelleme |
| DELETE | `/rows/:id` | Satır sil |
| POST | `/rows/reset-all` | Tüm tikleri sıfırla |

### Beyanname Kontrol (Kontrol)
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/kontrol` | Beyanname durumlarını getir |
| POST | `/kontrol/init` | Başlangıç verilerini yükle |
| PATCH | `/kontrol/:id` | Durumu güncelle |
| POST | `/kontrol/reset` | Tabloyu temizle |
| POST | `/kontrol/gib-trigger` | GİB Bot'u başlat |
| POST | `/kontrol/gib-sync` | Bot verilerini senkronize et |
| GET | `/kontrol/gib-logs` | Bot geçmişini getir |
| GET/POST | `/kontrol/gib-settings` | Otomatik sync ayarları |

### Mail Gönderim
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/mail` | Müşteri listesi |
| POST | `/mail/init` | Müşteri verilerini başlat |
| PATCH | `/mail/:id` | Müşteri bilgisi güncelle |
| DELETE | `/mail/:id` | Müşteri sil |
| POST | `/mail/add` | Yeni müşteri ekle |
| POST | `/mail/send` | Email gönder (Gmail/Outlook) |
| PUT | `/mail/reset` | Gönderim durumlarını sıfırla |

### Hatırlatıcılar
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/reminders` | Tüm hatırlatıcılar |
| POST | `/reminders` | Yeni ekle |
| PATCH | `/reminders/:id` | Güncelle |
| DELETE | `/reminders/:id` | Sil |

### Şifreler
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/passwords` | Tüm şifre kayıtları |
| GET | `/passwords/:customerId` | Müşteri şifresi |
| PUT | `/passwords/:customerId` | Şifre kaydet/güncelle |

### AI Chat
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/chat` | Gemini AI ile sohbet |

### Takip Günleri
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/tracking-days` | Önemli günler durumu |
| POST | `/tracking-days` | Durumları güncelle |

---

## 🗄️ VERİTABANI ŞEMALARI (MongoDB)

### Row (Takip Çizelgesi)
```javascript
{
    id: String | Number,        // Müşteri ID
    no: String,                 // Müşteri Numarası
    isim: String,               // Müşteri Adı
    platform: String,           // Muhasebe Platformu (LOGO, MİKRO, etc.)
    alis: Boolean | null,       // Alış Faturası durumu
    satis: Boolean | null,      // Satış Faturası durumu
    fis: Boolean | null,        // Fiş durumu
    zRaporu: Boolean | null,    // Z Raporu durumu
    muhtasar: String,           // Muhtasar notu
    vergiTA: Boolean | null,    // Vergi Tahakkuku
    puantaj: Boolean | null,    // Puantaj
    rapor: Boolean | null,      // Rapor
    sonDurum: Boolean,          // Tamamlandı mı?
    notlar: String              // Notlar
}
```

### Kontrol (Beyanname Durumları)
```javascript
{
    id: Number,
    no: String,                 // Müşteri No
    isim: String,               // Müşteri Adı
    vkn: String,                // Vergi Kimlik No (opsiyonel)
    kdv: 'bos' | 'gonderildi' | 'dilekce' | '3aylik' | 'yok',
    kdvMeta: { sentDate, beyannameTuru, donem },
    muh: DeclarationStatus,     // Muhtasar
    muhMeta: ColumnMeta,
    ssk: DeclarationStatus,     // SGK
    sskMeta: ColumnMeta,
    berat: DeclarationStatus,   // e-Defter Berat
    kurum: DeclarationStatus,   // Kurumlar
    gecici: DeclarationStatus,  // Geçici Vergi
    turz: DeclarationStatus,    // Turizm
    konk: DeclarationStatus,    // Konaklama
    poset: DeclarationStatus,   // Plastik Poşet
    kdv2: DeclarationStatus,    // KDV 2
    mail: DeclarationStatus     // Mail gönderildi mi?
}
```

### Mail (Müşteri Listesi)
```javascript
{
    id: Number,
    no: String,
    isim: String,
    unvan: String,              // Ticari Unvan
    email: String,
    telefon: String,
    mailSent: Boolean,          // Mail gönderildi mi?
    whatsappSent: Boolean       // WhatsApp gönderildi mi?
}
```

### GibBotLog (Bot Geçmişi)
```javascript
{
    timestamp: Date,
    status: 'running' | 'success' | 'error',
    totalFound: Number,
    matched: Number,
    unmatched: Number,
    skipped: Number,
    duration: Number,           // Saniye
    triggeredBy: 'manual' | 'auto',
    errorMessage: String,
    details: {
        matchedList: [{ firma, tur, kolonlar }],
        unmatchedList: [{ unvan, tur, sebep }],
        skippedList: [{ unvan, tur, sebep }]
    }
}
```

### PasswordEntry (Şifreler)
```javascript
{
    customerId: String,         // Unique
    customerNo: String,
    customerName: String,
    emuhurSafeWord: String,
    emuhurPin: String,
    gibUsername: String,
    gibPassword: String,
    otherPasswords: [{ label, value }],
    notes: String,
    updatedAt: Date
}
```

---

## 🎯 MODÜL DETAYLARI

### 1. KontrolModule (Beyanname Kontrol)
**Dosya:** `src/components/modules/KontrolModule.tsx` (1446 satır)

**Özellikler:**
- Müşteri bazlı beyanname durumu takibi (KDV, MUH, SSK, BERAT, KURUM, GEÇİCİ, TURZ, KONK, POŞET, KDV2, MAİL)
- GİB Bot entegrasyonu ile otomatik beyanname çekimi
- Gerçek zamanlı durum senkronizasyonu (Socket.io)
- Renk kodlu durum gösterimi (Boş, Gönderildi, Dilekçe, 3 Aylık, Yok)
- Tooltip ile meta bilgi görüntüleme (gönderim tarihi, beyanname türü)
- Tarih aralığı seçimi (Bot için)
- Terminal benzeri bot çıktı ekranı
- Senkronizasyon geçmişi ve detaylı log görüntüleme

**UI Etkileşimleri:**
- Sol tık: Durumu döngüsel değiştir (Boş ↔ Gönderildi)
- Sağ tık: "Yok" durumunu aç/kapat
- Tooltip hover: Meta bilgi göster

---

### 2. AccountingTrackingModule (Takip Çizelgesi)
**Dosya:** `src/components/modules/AccountingTrackingModule.tsx` (652 satır)

**Özellikler:**
- Aylık muhasebe iş takibi
- Boolean durum hücreleri (Bekliyor, Tamamlandı, Yapılmadı)
- Platform seçimi (LOGO, MİKRO, PARŞÜT, vs.)
- Dinamik satır ekleme/silme
- Önemli günler kartları (1, 5, 22, 26, 28. günler)
- Varsayılana döndürme (tüm tikleri sıfırlama)
- Satır bazlı not alanı

---

### 3. MailGonderimModule (Mail Gönderim Merkezi)
**Dosya:** `src/components/modules/MailGonderimModule.tsx` (1286 satır)

**Özellikler:**
- Gmail API ve Outlook (Microsoft Graph API) desteği
- Müşteri seçimi ve iletişim bilgisi yönetimi
- Beyanname türü seçimi (KDV, MUHSGK, KDV-2, TURİZM, GELİR, vs.)
- Banka modu (Banka evrakları için özel format)
- Otomatik mail şablonu oluşturma
- Dosya sürükle-bırak yükleme
- WhatsApp Web entegrasyonu
- Gönderim durumu takibi
- Müşteri ekleme/düzenleme/silme

**Mail Şablonu:**
```
Sayın [MÜŞTERİ UNVANI],

[YIL] yılı [AY] ayına ait [BEYANNAME TÜRLERİ] beyanname tahakkukunuz ekte sunulmuştur.

Bilgilerinize sunar, iyi çalışmalar dileriz.

Saygılarımızla;
İsmet Karaca Mali Müşavirlik Ofisi
```

---

### 4. ChatbotModule (AI Asistan)
**Dosya:** `src/components/modules/ChatbotModule.tsx` (411 satır)

**Özellikler:**
- Google Gemini Pro entegrasyonu
- Türkiye Vergi Mevzuatı, TTK, SGK, TDHP uzmanı persona
- Markdown tablo formatında muhasebe kaydı gösterimi
- Kod ve link formatlaması
- Örnek soru kartları
- Sohbet geçmişi

**Sistem Promptu:** Kapsamlı bir YMM/Bağımsız Denetçi rolü ile Türkçe vergi ve muhasebe mevzuatına uygun cevaplar üretiyor.

---

### 5. ReminderModule (Hatırlatıcılar)
**Dosya:** `src/components/modules/ReminderModule.tsx`

**Özellikler:**
- Zamanlanmış hatırlatıcılar
- Alarm bildirimleri (ses + popup)
- Ofis içi personel çağrı sistemi
- Tamamlanan/bekleyen görevler

---

### 6. PasswordsModule (Şifre Yönetimi)
**Dosya:** `src/components/modules/PasswordsModule.tsx`

**Özellikler:**
- Müşteri bazlı şifre saklama
- e-Mühür Safe Word ve PIN
- GİB kullanıcı adı/şifre
- Özel şifre alanları (dinamik)
- Not alanı

---

### 7. GIB Bot (Beyanname Çekici)
**Dosya:** `scripts/gib-bot.js` (1440 satır)

**Özellikler:**
- Puppeteer ile GİB Dijital Vergi Dairesi'ne giriş
- 2Captcha entegrasyonu (CAPTCHA çözümü)
- E-Beyanname uygulamasından onaylanmış beyannameleri çekme
- Tarih aralığı filtresi
- Progress raporlama (Socket.io üzerinden)
- Müşteri eşleştirme algoritması
- MongoDB'ye sonuç yazma

**Çalışma Akışı:**
1. GİB portalına giriş (kullanıcı adı + şifre + CAPTCHA)
2. E-Beyanname uygulamasını aç
3. "Onaylandı" durumlu beyannameleri ara
4. Sayfalama ile tüm sonuçları çek
5. Müşteri listesiyle eşleştir
6. KontrolModule tablosunu güncelle

---

## 🔐 ENVIRONMENT DEĞİŞKENLERİ

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Gmail API
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...

# Microsoft/Outlook
AZURE_CLIENT_ID=...

# GİB Bot
GIB_USERNAME=...
GIB_PASSWORD=...
TWOCAPTCHA_API_KEY=...

# Gemini AI
GEMINI_API_KEY=...

# API URL (Frontend)
VITE_API_URL=https://...
```

---

## 🌐 SOCKET.IO OLAYLARI

### Server → Client
| Olay | Veri | Açıklama |
|------|------|----------|
| `dataChange` | `{ type, data }` | Takip tablosu değişikliği |
| `kontrolChange` | `{ type, data }` | Kontrol tablosu değişikliği |
| `mailChange` | `{ type, data }` | Mail durumu değişikliği |
| `gibBotStatus` | `{ status, logId, message }` | Bot durumu |
| `gibBotProgress` | `{ percent, message, logId }` | Bot ilerlemesi |
| `gibLogsUpdate` | `Array<GibLogEntry>` | Log listesi güncelleme |
| `trackingDaysChange` | `TrackingDays` | Önemli günler değişikliği |
| `personnelCall` | `{ from, timestamp }` | Personel çağrısı |
| `reminderAlarm` | `Reminder` | Hatırlatıcı alarmı |

### Client → Server
| Olay | Veri | Açıklama |
|------|------|----------|
| `callPersonnel` | `{ from, timestamp }` | Personel çağır |

---

## 🎨 UI/UX ÖZELLİKLERİ

- **Tasarım Dili:** Modern, karanlık tema vurgulu, glassmorphism efektleri
- **Font:** Geist (system font fallback)
- **Renk Paleti:** Indigo, Slate, Emerald, Rose, Amber vurgular
- **Animasyonlar:** Framer Motion ile geçişler
- **Responsive:** Temel modüller için desktop optimize

---

## 🚀 TİCARİ DÖNÜŞÜM İÇİN GEREKLİ DEĞİŞİKLİKLER

### Kritik Eklenmesi Gerekenler:

1. **Authentication Sistemi**
   - JWT tabanlı login/register
   - Şifre sıfırlama
   - 2FA desteği

2. **Multi-Tenant Mimari**
   - Her veritabanı kaydına `tenant_id` eklenmesi
   - API middleware ile kullanıcı filtreleme
   - Veri izolasyonu

3. **Abonelik Sistemi**
   - iyzico/Stripe entegrasyonu
   - Paket yönetimi (Başlangıç, Pro, Kurumsal)
   - Kullanım limitleri

4. **Admin Paneli**
   - Kullanıcı yönetimi
   - Abonelik takibi
   - Sistem istatistikleri

5. **Güvenlik**
   - API rate limiting
   - Şifreleme (AES-256 for passwords)
   - HTTPS zorunluluğu
   - Audit logging

---

## 📝 ÖNEMLİ NOTLAR

1. **Hardcoded Veriler:** `KontrolModule.tsx` ve `MailGonderimModule.tsx` içinde örnek müşteri listesi hardcoded. Multi-tenant için bunlar dinamik olmalı.

2. **GIB Bot:** 2Captcha ücretli servis kullanıyor. Her müşteri için ayrı GİB hesabı gerekli olabilir.

3. **Outlook Entegrasyonu:** Microsoft Azure AD üzerinde uygulama kaydı gerekiyor.

4. **Gmail API:** OAuth2 refresh token süresi sınırlı, periyodik yenileme gerekebilir.

5. **Deployment:** Render free tier sleep'e geçebilir, production için ücretli plan önerilir.

---

## 📊 PROJE İSTATİSTİKLERİ

| Metrik | Değer |
|--------|-------|
| Toplam Modül Sayısı | 31 |
| Ana Modül Sayısı | 10 |
| Backend API Endpoint | ~30+ |
| MongoDB Collection | 8 |
| Total Lines of Code | ~15,000+ |
| Package Dependencies | 40+ |

---

> **Son Güncelleme:** 30 Aralık 2024
> **Hazırlayan:** SMMM-AI Geliştirme Ekibi
