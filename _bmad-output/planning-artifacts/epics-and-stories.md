# SMMM-AI Epic ve Story Kataloğu

**Version:** 1.0.0
**Tarih:** 2026-01-29
**PRD Referansı:** prd.md
**Mimari Referansı:** architecture.md

---

## Genel Bakış

Bu doküman SMMM-AI platformunun tüm Epic ve Story'lerini içerir. Mevcut sistemdeki özellikler ve gelecekteki iyileştirmeler kategorize edilmiştir.

### Epic Özeti

| Epic ID | Başlık | Story Sayısı | Durum |
|---------|--------|--------------|-------|
| E1 | Mükelef Yönetimi | 12 | ✅ Aktif |
| E2 | Beyanname Takip | 8 | ✅ Aktif |
| E3 | Kontrol Çizelgeleri | 15 | ✅ Aktif |
| E4 | Dosya Yönetimi | 10 | ✅ Aktif |
| E5 | GİB Bot Entegrasyonu | 12 | ✅ Aktif |
| E6 | Görev Yönetimi | 8 | ✅ Aktif |
| E7 | Hatırlatıcılar | 6 | ✅ Aktif |
| E8 | İletişim Modülü | 14 | ✅ Aktif |
| E9 | Güvenlik & Altyapı | 10 | ✅ Aktif |
| E10 | Ayarlar & Yönetim | 6 | ✅ Aktif |
| E11 | İyileştirmeler (Backlog) | 15 | 📋 Planlanan |

**Toplam:** 116 Story

---

## E1: Mükelef Yönetimi

**Açıklama:** Mükelef (müşteri) kayıtlarının oluşturulması, düzenlenmesi, gruplandırılması ve toplu işlemleri.

**Modül:** `/dashboard/mukellefler`

**Bağımlılıklar:** E9 (Auth, Tenant Isolation)

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E1-S1 | Mükelef Listesi Görüntüleme | P0 | ✅ Done | Kullanıcı tüm mükelleflerini listede görebilmeli |
| E1-S2 | Mükelef Ekleme | P0 | ✅ Done | Yeni mükelef kaydı oluşturabilmeli |
| E1-S3 | Mükelef Düzenleme | P0 | ✅ Done | Mevcut mükelef bilgilerini güncelleyebilmeli |
| E1-S4 | Mükelef Silme | P0 | ✅ Done | Mükelef kaydını silebilmeli |
| E1-S5 | Excel Import | P1 | ✅ Done | CSV/Excel dosyasından toplu mükelef aktarabilmeli |
| E1-S6 | Toplu Silme | P1 | ✅ Done | Seçili mükellefleri toplu silebilmeli |
| E1-S7 | Toplu Durum Güncelleme | P1 | ✅ Done | Seçili mükelleflerin durumunu toplu değiştirebilmeli |
| E1-S8 | Mükelef Grupları | P2 | ✅ Done | Mükellefleri gruplara ayırabilmeli |
| E1-S9 | Grup Üyelik Yönetimi | P2 | ✅ Done | Mükellefleri gruplara ekleyip çıkarabilmeli |
| E1-S10 | Firma Tipi Filtreleme | P2 | ✅ Done | Şahıs/Firma/Basit Usul filtrelemesi |
| E1-S11 | Durum Filtreleme | P2 | ✅ Done | Aktif/Pasif/Beklemede filtrelemesi |
| E1-S12 | Verilmeyecek Beyanname Ayarı | P2 | ✅ Done | Mükelef bazlı verilmeyecek beyannameleri belirleyebilmeli |

### Kabul Kriterleri (E1-S1 Örnek)

```gherkin
Feature: Mükelef Listesi Görüntüleme

Scenario: Kullanıcı mükelef listesini görüntüler
  Given Kullanıcı oturum açmış
  When Mükelefler sayfasına gider
  Then Sadece kendi tenant'ındaki mükelefler listelenir
  And Liste VKN, Unvan, Durum sütunlarını içerir
  And 500+ satır için virtual scrolling aktif

Scenario: Boş mükelef listesi
  Given Kullanıcı oturum açmış
  And Hiç mükelef kaydı yok
  When Mükelefler sayfasına gider
  Then "Henüz mükelef eklenmemiş" mesajı gösterilir
  And "Mükelef Ekle" butonu görünür
```

---

## E2: Beyanname Takip

**Açıklama:** Aylık beyanname durumlarının takibi ve yönetimi.

**Modül:** `/dashboard/kontrol`, `/api/beyanname-takip`

**Bağımlılıklar:** E1 (Mükelefler), E5 (GİB Bot)

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E2-S1 | Dönem Bazlı Takip Görünümü | P0 | ✅ Done | Ay/Yıl bazlı beyanname durumlarını görebilmeli |
| E2-S2 | Durum Güncelleme | P0 | ✅ Done | Beyanname durumunu değiştirebilmeli (boş/verildi/verilmeyecek) |
| E2-S3 | Varsayılan Dönem Kuralı | P0 | ✅ Done | Varsayılan olarak bir önceki ay görünmeli |
| E2-S4 | Çoklu Beyanname Tipi | P0 | ✅ Done | KDV, SGK, Muhasebe, vb. ayrı ayrı takip edilebilmeli |
| E2-S5 | Beyanname Türleri Yönetimi | P1 | ✅ Done | Beyanname türlerini ekleyip düzenleyebilmeli |
| E2-S6 | GİB Bot Senkronizasyonu | P1 | ✅ Done | Bot indirdiği PDF'leri otomatik eşleştirmeli |
| E2-S7 | Toplu Durum Güncelleme | P2 | ✅ Done | Birden fazla mükelefin durumunu toplu değiştirebilmeli |
| E2-S8 | Dönem Geçmişi | P2 | ✅ Done | Geçmiş dönemleri görüntüleyebilmeli |

### İş Kuralları

```
KURAL-001: Dönem Kuralı
  - Ocak ayında varsayılan dönem: Aralık (önceki yıl)
  - Şubat ayında varsayılan dönem: Ocak (aynı yıl)
  - vb.

KURAL-002: Durum Değerleri
  - "bos": Henüz işlem yapılmamış
  - "verildi": Beyanname verildi
  - "verilmeyecek": Bu dönem verilmeyecek
  - "bekliyor": Bot işlemi bekliyor
```

---

## E3: Kontrol Çizelgeleri

**Açıklama:** SGK, KDV, KDV2 ve genel takip çizelgeleri.

**Modül:** `/dashboard/sgk-kontrol`, `/dashboard/kontrol`, `/dashboard/takip`

**Bağımlılıklar:** E1, E4 (Dosyalar)

### Story'ler

#### SGK Kontrol

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E3-S1 | SGK Hizmet Listesi Takibi | P0 | ✅ Done | İşçi sayısı, onay tarihi, dosya sayısı görüntüleme |
| E3-S2 | SGK Tahakkuk Takibi | P0 | ✅ Done | İşçi, gün sayısı, net tutar, kabul tarihi görüntüleme |
| E3-S3 | SGK PDF Parse | P1 | ✅ Done | SGK belgelerinden otomatik veri çıkarma |
| E3-S4 | SGK Toplu Parse | P1 | ✅ Done | Tüm dönem için otomatik parse |
| E3-S5 | SGK Dosya İlişkilendirme | P2 | ✅ Done | Mükelef-dönem-dosya bağlantısı |

#### KDV Kontrol

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E3-S6 | KDV Matrah Takibi | P0 | ✅ Done | Vergi matrahını görüntüleme |
| E3-S7 | KDV Tutarları | P0 | ✅ Done | Tahakkuk, Mahsup, Ödenecek, Devreden görüntüleme |
| E3-S8 | KDV Dosya İlişkilendirme | P2 | ✅ Done | KDV belgesi ile eşleştirme |

#### KDV2 Kontrol

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E3-S9 | KDV2 Tevkifat Takibi | P1 | ✅ Done | Stopaj beyanname tutarları |
| E3-S10 | KDV2 Dosya İlişkilendirme | P2 | ✅ Done | KDV2 belgesi ile eşleştirme |

#### Genel Takip Çizelgesi

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E3-S11 | Dinamik Kolon Yönetimi | P1 | ✅ Done | Özel kolonlar ekleyip düzenleyebilmeli |
| E3-S12 | Sistem Kolonları | P1 | ✅ Done | Varsayılan kontrol alanları |
| E3-S13 | Virtual Scrolling | P0 | ✅ Done | 500+ satır performanslı görüntüleme |
| E3-S14 | Otomatik Mükelef Senkronizasyonu | P2 | ✅ Done | Yeni mükelefler otomatik eklenmeli |
| E3-S15 | Toplu Durum Güncelleme | P1 | ✅ Done | Çoklu satır güncelleme |

---

## E4: Dosya Yönetimi

**Açıklama:** Beyanname PDF'leri ve diğer dokümanların yönetimi.

**Modül:** `/dashboard/dosyalar`

**Bağımlılıklar:** E1, Supabase Storage

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E4-S1 | Klasör Yapısı Görüntüleme | P0 | ✅ Done | VKN/Yıl/Ay/Beyanname hiyerarşisi |
| E4-S2 | Dosya Yükleme | P0 | ✅ Done | PDF ve diğer dosyaları yükleyebilmeli |
| E4-S3 | PDF Görüntüleme | P0 | ✅ Done | Tarayıcı içi PDF viewer |
| E4-S4 | Dosya İndirme | P0 | ✅ Done | Dosyaları indirebilmeli |
| E4-S5 | Breadcrumb Navigasyon | P1 | ✅ Done | Klasör geçmişi ile gezinme |
| E4-S6 | Dosya Filtreleme | P1 | ✅ Done | Dönem ve tip bazlı filtreleme |
| E4-S7 | Klasör Senkronizasyonu | P2 | ✅ Done | Otomatik klasör oluşturma |
| E4-S8 | OCR Desteği | P2 | ✅ Done | PDF'den metin çıkarma |
| E4-S9 | Dosya Silme | P1 | ✅ Done | Dosya ve klasör silme |
| E4-S10 | Ağaç Görünümü | P2 | ✅ Done | Tüm yapıyı ağaç olarak görme |

---

## E5: GİB Bot Entegrasyonu

**Açıklama:** GİB portalından otomatik beyanname indirme.

**Modül:** `src/lib/gib/`, Electron App, `/api/gib/`

**Bağımlılıklar:** E1, E4, WebSocket Server

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E5-S1 | GİB Portal Login | P0 | ✅ Done | SMMM kullanıcı adı/şifre ile giriş |
| E5-S2 | Mükelef Seçimi | P0 | ✅ Done | İndirilecek mükelef seçimi |
| E5-S3 | Beyanname PDF İndirme | P0 | ✅ Done | Seçili beyannameleri indir |
| E5-S4 | Cookie Session Yönetimi | P0 | ✅ Done | Oturum sürekliliği |
| E5-S5 | Captcha Çözümü | P1 | ✅ Done | 2Captcha entegrasyonu |
| E5-S6 | WebSocket Progress | P0 | ✅ Done | Gerçek zamanlı ilerleme |
| E5-S7 | Toplu İndirme | P0 | ✅ Done | Tüm mükelefler için sıralı indirme |
| E5-S8 | Pre-Download Kontrolü | P1 | ✅ Done | Önceden indirilmiş dosya kontrolü |
| E5-S9 | Hata Yönetimi ve Retry | P1 | ✅ Done | Başarısız indirmeler için yeniden deneme |
| E5-S10 | İndirme Raporu | P1 | ✅ Done | Başarılı/başarısız özet |
| E5-S11 | Mükelef Listesi Senkronizasyonu | P2 | ✅ Done | GİB'den mükelef listesi çekme |
| E5-S12 | Bot Ayarları | P2 | ✅ Done | Timeout, delay konfigürasyonu |

### Teknik Detaylar

```
Bot Mimarisi:
┌─────────────────┐     WebSocket     ┌─────────────────┐
│   Next.js App   │◄──────────────────►│  Electron Bot   │
│   (Frontend)    │                    │  (Puppeteer)    │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ REST API                             │ GİB Portal
         │                                      │
    ┌────▼────┐                           ┌─────▼─────┐
    │ Backend │                           │    GİB    │
    │  APIs   │                           │  Website  │
    └─────────┘                           └───────────┘
```

---

## E6: Görev Yönetimi

**Açıklama:** Ofis içi görev oluşturma, atama ve takibi.

**Modül:** `/dashboard/gorevler`

**Bağımlılıklar:** E1, E9 (Users)

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E6-S1 | Görev Oluşturma | P0 | ✅ Done | Başlık, açıklama, öncelik, son tarih |
| E6-S2 | Görev Listesi | P0 | ✅ Done | Tüm görevleri görüntüleme |
| E6-S3 | Görev Düzenleme | P0 | ✅ Done | Görev bilgilerini güncelleme |
| E6-S4 | Görev Durumu Değiştirme | P0 | ✅ Done | Yapılacak/Devam/Tamamlandı |
| E6-S5 | Kullanıcıya Atama | P1 | ✅ Done | Görevi ekip üyesine atama |
| E6-S6 | Görev Yorumları | P2 | ✅ Done | Göreve yorum ekleme |
| E6-S7 | Dosya Ekleme | P2 | ✅ Done | Göreve dosya iliştirme |
| E6-S8 | Mükelef İlişkilendirme | P2 | ✅ Done | Görevi mükelefe bağlama |

---

## E7: Hatırlatıcılar

**Açıklama:** Etkinlik ve görev hatırlatıcıları.

**Modül:** `/dashboard/animsaticilar`

**Bağımlılıklar:** E1, E8 (WhatsApp)

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E7-S1 | Hatırlatıcı Oluşturma | P0 | ✅ Done | Tarih, saat, başlık belirleme |
| E7-S2 | Hatırlatıcı Listesi | P0 | ✅ Done | Yaklaşan hatırlatıcıları görme |
| E7-S3 | Tekrarlayan Hatırlatıcılar | P1 | ✅ Done | Günlük/haftalık/aylık tekrar |
| E7-S4 | WhatsApp Bildirimi | P1 | ✅ Done | Otomatik WhatsApp mesajı |
| E7-S5 | Mükelef Bağlantısı | P2 | ✅ Done | Hatırlatıcıyı mükelefe bağlama |
| E7-S6 | Toplu Hatırlatıcı | P2 | ✅ Done | Birden fazla mükelefe hatırlatıcı |

---

## E8: İletişim Modülü

**Açıklama:** Email, SMS ve WhatsApp entegrasyonları.

**Modül:** `/dashboard/mail`, `/dashboard/toplu-gonderim`, `/dashboard/duyurular`

**Bağımlılıklar:** E1

### Story'ler

#### Email

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E8-S1 | Google OAuth Bağlantısı | P1 | ✅ Done | Gmail hesabı bağlama |
| E8-S2 | Microsoft OAuth Bağlantısı | P1 | ✅ Done | Outlook hesabı bağlama |
| E8-S3 | Email Senkronizasyonu | P1 | ✅ Done | Gelen kutusunu çekme |
| E8-S4 | Email Görüntüleme | P1 | ✅ Done | Email içeriğini okuma |
| E8-S5 | Email Gönderme | P1 | ✅ Done | Platform üzerinden email |
| E8-S6 | Email Şablonları | P2 | ✅ Done | Hazır mesaj şablonları |

#### SMS & WhatsApp

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E8-S7 | SMS Gönderimi | P1 | ✅ Done | NetGSM entegrasyonu |
| E8-S8 | WhatsApp Gönderimi | P1 | ✅ Done | Whapi.cloud entegrasyonu |

#### Toplu Gönderim

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E8-S9 | Toplu Email | P1 | ✅ Done | Çoklu mükelefe email |
| E8-S10 | Toplu SMS | P1 | ✅ Done | Çoklu mükelefe SMS |
| E8-S11 | Toplu WhatsApp | P1 | ✅ Done | Çoklu mükelefe WhatsApp |
| E8-S12 | Gönderim Durumu Takibi | P2 | ✅ Done | Başarılı/başarısız rapor |

#### Duyurular

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E8-S13 | Duyuru Şablonları | P2 | ✅ Done | Hazır duyuru metinleri |
| E8-S14 | Zamanlanmış Duyurular | P2 | ✅ Done | İleri tarihli gönderim |

---

## E9: Güvenlik & Altyapı

**Açıklama:** Kimlik doğrulama, yetkilendirme, şifreleme ve altyapı.

**Modül:** Tüm sistem geneli

**Bağımlılıklar:** Supabase, Upstash

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E9-S1 | Kullanıcı Kayıt | P0 | ✅ Done | Email/şifre ile kayıt |
| E9-S2 | Kullanıcı Giriş | P0 | ✅ Done | Email/şifre ile giriş |
| E9-S3 | Multi-Tenant Isolation | P0 | ✅ Done | tenantId filtresi |
| E9-S4 | RLS (Row Level Security) | P0 | ✅ Done | Veritabanı seviyesi izolasyon |
| E9-S5 | Credential Şifreleme | P0 | ✅ Done | AES-256-GCM |
| E9-S6 | API Rate Limiting | P1 | ✅ Done | Upstash Ratelimit |
| E9-S7 | Audit Logging | P1 | ✅ Done | İşlem kaydı tutma |
| E9-S8 | KVKK Veri Export | P1 | ✅ Done | Kullanıcı verilerini indirme |
| E9-S9 | KVKK Silme Talebi | P1 | ✅ Done | Veri silme isteği |
| E9-S10 | Error Handling | P0 | ✅ Done | Standart hata yönetimi |

---

## E10: Ayarlar & Yönetim

**Açıklama:** Sistem ve kullanıcı ayarları.

**Modül:** `/dashboard/ayarlar`

**Bağımlılıklar:** E9

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E10-S1 | GİB Bot Ayarları | P1 | ✅ Done | Bot konfigürasyonu |
| E10-S2 | TÜRMOB Ayarları | P2 | ✅ Done | TÜRMOB entegrasyon ayarları |
| E10-S3 | Bildirim Tercihleri | P2 | ✅ Done | Email/SMS/WhatsApp ayarları |
| E10-S4 | Profil Yönetimi | P1 | ✅ Done | Kullanıcı bilgileri |
| E10-S5 | Abonelik Bilgisi | P2 | ✅ Done | Plan ve kullanım |
| E10-S6 | API Anahtarları | P2 | ✅ Done | WhatsApp, SMS API keys |

---

## E11: İyileştirmeler (Backlog)

**Açıklama:** Gelecekte yapılacak iyileştirmeler ve yeni özellikler.

### Story'ler

| Story ID | Başlık | Öncelik | Durum | Açıklama |
|----------|--------|---------|-------|----------|
| E11-S1 | API Dokümantasyonu | P2 | 📋 Backlog | Swagger/OpenAPI |
| E11-S2 | APM Monitoring | P2 | 📋 Backlog | Performans izleme |
| E11-S3 | Backup Stratejisi | P2 | 📋 Backlog | Otomatik yedekleme |
| E11-S4 | E-Fatura Entegrasyonu | P1 | 📋 Backlog | GİB e-fatura |
| E11-S5 | Mobil Uygulama | P2 | 📋 Backlog | iOS/Android |
| E11-S6 | Dashboard Analytics | P2 | 📋 Backlog | Kullanım istatistikleri |
| E11-S7 | PDF Merge İyileştirme | P3 | 📋 Backlog | Çoklu PDF birleştirme |
| E11-S8 | Keyboard Shortcuts | P3 | 📋 Backlog | Hızlı navigasyon |
| E11-S9 | Dark Mode | P3 | 📋 Backlog | Karanlık tema |
| E11-S10 | Bulk Import İyileştirme | P2 | 📋 Backlog | Daha iyi hata mesajları |
| E11-S11 | Bot Queue System | P2 | 📋 Backlog | Kuyruk yönetimi |
| E11-S12 | PDF OCR İyileştirme | P2 | 📋 Backlog | Türkçe OCR doğruluğu |
| E11-S13 | Multi-Language | P3 | 📋 Backlog | İngilizce desteği |
| E11-S14 | Webhook Entegrasyonları | P2 | 📋 Backlog | 3. parti sistemler |
| E11-S15 | Advanced Reporting | P2 | 📋 Backlog | Gelişmiş raporlama |

---

## Story Template

Yeni story oluşturmak için kullanılacak şablon:

```markdown
## [Story ID]: [Başlık]

**Epic:** [Epic ID - Epic Adı]
**Öncelik:** P0/P1/P2/P3
**Durum:** 📋 Backlog | 🔄 In Progress | ✅ Done
**Tahmini Effort:** S/M/L/XL

### Açıklama
[Kullanıcı hikayesi formatında açıklama]

Bir [kullanıcı rolü] olarak,
[özellik/işlev] yapabilmeliyim,
böylece [fayda/değer] elde edebilirim.

### Kabul Kriterleri
- [ ] Kriter 1
- [ ] Kriter 2
- [ ] Kriter 3

### Teknik Notlar
- [İlgili API endpoint'leri]
- [Veritabanı değişiklikleri]
- [UI component'leri]

### Bağımlılıklar
- [Bağımlı olduğu story'ler]

### Riskler
- [Potansiyel riskler]
```

---

## Sprint Planning Önerisi

### Sprint 1 (Maintenance)
- Bug fixes
- Performance optimizations
- E11-S1: API Dokümantasyonu

### Sprint 2 (Enhancement)
- E11-S6: Dashboard Analytics
- E11-S10: Bulk Import İyileştirme

### Sprint 3 (New Feature)
- E11-S4: E-Fatura Entegrasyonu (Planning)
- E11-S14: Webhook Entegrasyonları

---

## Referanslar

- **PRD:** `_bmad-output/planning-artifacts/prd.md`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **CLAUDE.md:** Proje kuralları ve standartları

---

## Revizyon Geçmişi

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 1.0.0 | 2026-01-29 | İlk versiyon - Mevcut sistem belgeleme |
