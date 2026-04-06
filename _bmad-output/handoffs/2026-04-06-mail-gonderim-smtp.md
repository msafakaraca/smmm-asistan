# Handoff: Mail Gönderim Sistemi (SMTP Entegrasyonu)
**Tarih:** 2026-04-06
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> Mali müşavirlerin kendi mail adreslerinden (Gmail, Outlook/Hotmail) müşterilerine toplu mail gönderebileceği bir sistem tasarlanacak. Bizim domain'den atılan mailler spam'e düşeceği için kullanıcının kendi SMTP hesabı kullanılmalı.

## Karar: Neden SMTP?

| Yöntem | Maliyet | Kullanıcı Adresi? | Kapsam |
|--------|---------|-------------------|--------|
| **SMTP (Seçilen)** | Ücretsiz | ✅ Evet | Tüm provider'lar |
| Gmail OAuth API | Ücretsiz | ✅ Evet | Sadece Gmail |
| Resend/SendGrid | Ücretli (~$20/ay) | ❌ Bizim domain | Tüm provider'lar |

**SMTP seçildi çünkü:**
- Tamamen ücretsiz (nodemailer açık kaynak)
- Gmail, Outlook/Hotmail, özel domain — hepsi çalışır
- Mail gerçekten kullanıcının adresinden gider → spam riski yok
- SPF/DKIM/DMARC → Google/Microsoft zaten hallediyor
- Reply geldiğinde kullanıcının inbox'ına düşer
- Mevcut AES-256-GCM altyapısı SMTP şifreleri için kullanılabilir

## SMTP Provider Bilgileri

| Provider | SMTP Host | Port | Auth Yöntemi |
|----------|-----------|------|-------------|
| Gmail | smtp.gmail.com | 587 | Uygulama Şifresi (App Password) — 2FA zorunlu |
| Outlook/Hotmail | smtp-mail.outlook.com | 587 | Normal şifre |
| Yandex | smtp.yandex.com | 465 | Normal şifre |
| Özel Domain | Kullanıcıdan alınır | 587/465 | Kullanıcıdan alınır |

**Gmail özel durumu:** Google normal şifreyle SMTP'ye izin vermiyor. Kullanıcı 2FA açıp "Uygulama Şifresi" (App Password) oluşturması gerekiyor. UI'da adım adım rehber gösterilmeli.

## Rate Limiting (Kritik)

| Provider | Günlük Limit | Önerilen Bekleme |
|----------|-------------|-----------------|
| Gmail (kişisel) | 500 mail/gün | 2-3 sn arası |
| Gmail (Workspace) | 2000 mail/gün | 1-2 sn arası |
| Outlook/Hotmail | 300 mail/gün | 3-4 sn arası |

- Toplu gönderimde mailler arası bekleme süresi uygulanmalı
- UI'da gönderilen/kalan sayacı gösterilmeli
- Günlük limit aşılırsa kullanıcıya uyarı verilmeli

## Uygulama Planı

### Adım 1: Prisma Model — MailSettings
```prisma
model MailSettings {
  id         String  @id @default(uuid()) @db.Uuid
  provider   String  // "gmail", "outlook", "yandex", "custom"
  smtpHost   String
  smtpPort   Int     @default(587)
  email      String  // Gönderen mail adresi
  password   String  // AES-256-GCM encrypted
  tenantId   String  @unique @db.Uuid
  tenant     Tenant  @relation(fields: [tenantId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([tenantId])
}
```

### Adım 2: API Endpoints
- `POST /api/settings/mail` — SMTP ayarlarını kaydet (şifre encrypt edilecek)
- `GET /api/settings/mail` — Mevcut ayarları getir (şifre masked)
- `POST /api/settings/mail/test` — Test maili gönder
- `POST /api/mail/send` — Tekli mail gönder
- `POST /api/mail/bulk-send` — Toplu mail gönder (rate limiting ile)

### Adım 3: Mail Servisi
- `src/lib/mail/smtp-client.ts` — nodemailer wrapper
  - Provider'a göre otomatik SMTP config
  - Şifre decrypt → bağlan → gönder
  - Rate limiting logic
  - Hata yönetimi (auth hatası, limit aşımı vb.)

### Adım 4: Ayarlar → Mail Ayarları Sayfası
```
┌──────────────────────────────────────────┐
│  Mail Sağlayıcı:  [Gmail ▼]             │ ← Seçince host/port otomatik dolar
│  E-posta Adresi:  info@firma.com         │
│  Şifre:           ••••••••               │ ← AES-256-GCM ile encrypt
│                                          │
│  ℹ️ Gmail kullanıyorsanız "Uygulama      │
│     Şifresi" oluşturmanız gerekiyor.     │
│     [Nasıl yapılır? →]                   │
│                                          │
│  [Test Maili Gönder]     [Kaydet]        │
└──────────────────────────────────────────┘
```

### Adım 5: Toplu Gönderim Sayfası / Dialog
```
┌──────────────────────────────────────────┐
│  Alıcılar:                               │
│  [✓] Tüm Aktif Müşteriler (45)          │
│  [ ] Seçili Müşteriler                   │
│  [ ] Belirli Şirket Tipi                 │
│                                          │
│  Konu: KDV Beyanname Hatırlatması        │
│                                          │
│  İçerik:                                 │
│  ┌────────────────────────────────────┐  │
│  │ (Zengin metin editörü)            │  │
│  │ Sayın {{unvan}},                  │  │
│  │ ...                               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  📊 45 müşteriye gönderilecek            │
│  ⏱️ Tahmini süre: ~2 dakika              │
│                                          │
│  [Gönder]                                │
└──────────────────────────────────────────┘
```

### Adım 6: Mail Şablonları (Opsiyonel - Sonraki Faz)
- Hazır şablonlar: Beyanname hatırlatma, ödeme hatırlatma, duyuru
- `{{unvan}}`, `{{vknTckn}}` gibi değişkenler
- Şablon kaydetme/düzenleme

## Bağımlılıklar
- `nodemailer` npm paketi
- Mevcut `src/lib/crypto.ts` (encrypt/decrypt)
- Mevcut `getUserWithProfile()` auth guard

## Teknik Notlar
- SMTP şifreleri mevcut AES-256-GCM altyapısıyla encrypt edilecek (GİB şifreleriyle aynı pattern)
- Toplu gönderimde WebSocket üzerinden progress bildirimi yapılabilir
- Mail gönderim logları tutulmalı (başarılı/başarısız, tarih, alıcı)
- Gmail App Password rehberi Türkçe olarak UI'da gösterilmeli
