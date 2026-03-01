---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture-main.md'
  - 'docs/data-models.md'
  - 'docs/development-guide.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 5
  planningArtifacts: 3
classification:
  projectType: 'saas_b2b'
  domain: 'fintech'
  complexity: 'high'
  projectContext: 'brownfield'
---

# PRD: Auth Sistemi Güncellemesi — SMMM-AI

**Yazar:** Safa
**Tarih:** 2026-02-08
**Proje:** smmm_asistan
**Tür:** SaaS B2B | Fintech | Brownfield

## Yönetici Özeti

SMMM-AI, Türkiye'deki mali müşavirlik ofisleri için multi-tenant muhasebe ve otomasyon platformudur. Mevcut authentication sistemi **tamamen kırıktır** — kayıt akışı Supabase Auth kullanıcısı oluşturmadan yalnızca Prisma'ya yazıyor, bu nedenle ne kayıt ne giriş çalışıyor.

Bu PRD, auth sisteminin Supabase Auth merkezli modern bir yapıya dönüştürülmesini kapsar:
- **Google OAuth + Email/Şifre** ile kayıt ve giriş
- **Zorunlu email doğrulama** (dashboard erişimi doğrulamaya bağlı)
- **Şifremi Unuttum** akışı (email → sıfırlama → yeni şifre)
- **KVKK uyumluluğu** (aydınlatma metni, onay kutuları, gizlilik sayfaları)

**Hedef Kullanıcı:** Türkiye'deki SMMM'ler (mali müşavirler) ve muhasebe bürosu çalışanları.
**MVP Yaklaşımı:** Problem-Çözme MVP'si — kırık sistemi düzelt, temel auth akışlarını çalıştır.

## Başarı Kriterleri

### Kullanıcı Başarısı

- Google ile kayıt + şifre belirleme + email doğrulama: **< 2 dakika** → dashboard
- Email/şifre ile kayıt + doğrulama: **< 3 dakika** → dashboard
- Giriş (Google veya email/şifre): **< 3 saniye** → dashboard
- Şifremi unuttum (email → sıfırlama → giriş): **< 5 dakika** → dashboard
- Email doğrulama maili teslimi: **< 30 saniye**
- Her ekranda net yönlendirme — kullanıcı hiçbir aşamada kaybolmaz

### İş Başarısı

| Metrik | Hedef | Ölçüm Yöntemi |
|--------|-------|---------------|
| Kayıt funnel tamamlama | > %80 | Supabase Auth analytics |
| Google OAuth kayıt oranı | > %50 | Analytics event tracking |
| Email doğrulama tamamlama | > %90 | SMTP + auth logs |
| Şifremi unuttum başarı oranı | > %95 | Auth logs |
| Güvenlik ihlali | 0 | Audit logs |

### Teknik Başarı

- Supabase Auth tek kaynak (single source of truth) — çift auth sistemi ortadan kalkar
- Auth endpoint'leri: **< 500ms** yanıt süresi (p95)
- KVKK uyumlu: aydınlatma metni + onay kutusu her auth ekranında
- Rate limiting aktif: 5 başarısız giriş → geçici kilitleme
- Session: Supabase SSR cookies (HttpOnly, Secure, SameSite)

## Kullanıcı Yolculukları

### Yolculuk 1: Ayşe — İlk Kayıt (Google OAuth + Şifre)

**Persona:** Ayşe Kaya, 38 yaşında, İstanbul'da 15 yıllık deneyimli SMMM. 45 mükellefin beyannamelerini takip ediyor.

**Akış:**
1. "Google ile Kayıt Ol" butonuna tıklıyor
2. Google hesabını seçiyor (smmm.ayse@gmail.com)
3. Google onay verdikten sonra **şifre belirleme ekranına** yönlendiriliyor
4. Platform için güçlü bir şifre oluşturuyor
5. KVKK aydınlatma metnini onaylıyor
6. Ofis adını giriyor: "SMMM Ayşe Kaya Mali Müşavirlik"
7. "Kayıt Ol" butonuna basıyor
8. "Email doğrulama linki gönderildi" mesajı çıkıyor
9. Gmail'ini açıyor — doğrulama maili gelmiş
10. "Email Adresimi Doğrula" butonuna tıklıyor
11. Otomatik olarak dashboard'a yönlendiriliyor

**Sonuç:** 2 dakika içinde dashboard'a ulaşır.

### Yolculuk 2: Mehmet — Email/Şifre ile Kayıt

**Persona:** Mehmet Demir, 52 yaşında, Ankara'da küçük muhasebe bürosu. Teknolojiye mesafeli, Google hesabını iş için kullanmıyor.

**Akış:**
1. Kayıt formunda ofis adı, ad-soyad, email ve şifre giriyor
2. KVKK onay kutusunu işaretliyor
3. "Kayıt Ol" butonuna basıyor
4. "Email doğrulama linki gönderildi" ekranı
5. Outlook'unu açıyor — mail gelmiş
6. Doğrulama linkine tıklıyor
7. Dashboard'a yönlendiriliyor

**Sonuç:** 3 dakika içinde dashboard'a ulaşır.

### Yolculuk 3: Ayşe — Şifremi Unuttum

**Tetikleyici:** 3 ay sonra şifresini unutmuş, yanlış giriyor.

**Akış:**
1. "Şifrenizi mi Unuttunuz?" linkine tıklıyor
2. Email adresini giriyor
3. "Şifre Sıfırlama Linki Gönder" butonuna basıyor
4. Gmail'de sıfırlama maili gelmiş
5. "Şifremi Sıfırla" butonuna tıklıyor
6. Yeni şifre belirliyor + tekrar giriyor
7. "Şifre Güncellendi" mesajı
8. Login sayfasına yönlendiriliyor
9. Yeni şifresiyle giriş → dashboard

**Sonuç:** 4 dakika içinde dashboard'a ulaşır.

### Yolculuk 4: Ayşe — Günlük Giriş (Google)

1. "Google ile Giriş Yap" butonuna tıklıyor
2. Google hesabını seçiyor (zaten giriş yapılı)
3. 2-3 saniye içinde dashboard'a yönlendiriliyor

### Yolculuk 5: Mehmet — Günlük Giriş (Email/Şifre)

1. Email ve şifresini giriyor
2. "Giriş Yap" butonuna basıyor
3. 2-3 saniye içinde dashboard'a ulaşıyor

### Yolculuk → Gereksinim Eşleştirmesi

| Yolculuk | Ortaya Çıkan Gereksinimler |
|----------|---------------------------|
| Google ile Kayıt | OAuth provider, şifre belirleme ekranı, tenant oluşturma, email doğrulama, KVKK onayı |
| Email/Şifre ile Kayıt | Kayıt formu, Zod validation, Supabase signUp, email doğrulama, KVKK onayı |
| Şifremi Unuttum | Sıfırlama email gönderimi, yeni şifre belirleme sayfası, login'e yönlendirme |
| Google ile Giriş | OAuth login, session cookie, hızlı redirect |
| Email/Şifre ile Giriş | signInWithPassword, session cookie, hızlı redirect |

**Ek Gereksinimler:**
- Email doğrulama bekleme sayfası (Tekrar Gönder butonu)
- Hata mesajları Türkçe ve anlaşılır
- KVKK aydınlatma metni sayfası
- Tüm formlar mobil uyumlu

## Domain Gereksinimleri — KVKK (6698 Sayılı Kanun)

### A. Aydınlatma Yükümlülüğü (Madde 10)

Aydınlatma metni **zorunlu** içerik:
1. Veri sorumlusunun kimliği (şirket unvanı, adresi, iletişim)
2. Kişisel verilerin hangi amaçla işleneceği
3. İşlenen verilerin kimlere ve hangi amaçla aktarılabileceği (Supabase, Google)
4. Veri toplama yöntemi ve hukuki sebebi
5. İlgili kişinin KVKK Madde 11 kapsamındaki hakları

**Uygulama — Katmanlı bilgilendirme:**
- **Kayıt formunda:** Kısa özet + "Aydınlatma Metninin tamamı için tıklayın" linki
- **Ayrı sayfa:** `/kvkk-aydinlatma-metni` rotasında detaylı metin
- **Footer:** Her sayfada gizlilik politikası linki

### B. Onay Kutuları (Kayıt Formu)

Kurul Kararı 2018/90: Aydınlatma ve açık rıza **ayrı ayrı** işlenmelidir.

| Checkbox | Zorunlu | Önceden İşaretli | Açıklama |
|----------|---------|-------------------|----------|
| Aydınlatma Metni | **EVET** | **HAYIR** | "KVKK Aydınlatma Metni'ni okudum ve anladım" + link |
| Açık Rıza | Duruma göre | **HAYIR** | Açık rızaya dayanan işlemler varsa |
| Ticari İleti | **HAYIR** | **HAYIR** | İleride email pazarlama yapılırsa (IYS kapsamı) |

**Kritik:** Önceden işaretli kutucuklar veya "devam ederseniz kabul etmiş sayılırsınız" ifadeleri **geçersiz** rıza sayılır.

### C. Hukuki Dayanaklar

| Veri | Hukuki Dayanak | Açık Rıza Gerekli mi? |
|------|---------------|----------------------|
| Email | Md. 5/2-c (Sözleşme ifası) | Hayır |
| Ad-Soyad | Md. 5/2-c (Sözleşme ifası) | Hayır |
| Şifre (hash) | Md. 5/2-c (Sözleşme ifası) | Hayır |
| Ofis Adı | Md. 5/2-c (Sözleşme ifası) | Hayır |
| IP Adresi | Md. 5/2-e (Hukuki yükümlülük - 5651 s.K.) | Hayır |
| Google profil bilgisi | Md. 5/2-c veya Md. 5/1 | Duruma göre |
| Tarayıcı/Cihaz bilgisi | Md. 5/2-f (Meşru menfaat) | Hayır |

**Veri minimizasyonu (Md. 4/1-c):** Kayıt formunda sadece gerekli alanlar. Telefon, adres gibi veriler kayıt aşamasında istenmemeli.

### D. Çerez Politikası

| Çerez Türü | Onay Gerekli mi? | Durum |
|-------------|-----------------|-------|
| Auth/Oturum çerezleri | **HAYIR** (zorunlu) | Supabase session |
| CSRF güvenlik çerezleri | **HAYIR** (teknik) | Mevcut |
| Analitik | **EVET** | Kullanılıyorsa banner gerekir |
| Pazarlama | **EVET** | Yok |

### E. Yurt Dışına Veri Aktarımı (Madde 9)

- **Google OAuth:** KVKK Kurulu onay vermiştir. Aydınlatma metninde belirtilmeli.
- **Supabase:** EU bölgesindeyse standart sözleşme yeterli. DPA imzalanmalı.

### F. Kullanıcı Hakları ve Hesap Silme (Madde 11)

- Hesap silme talep hakkı — **30 gün** içinde yanıt
- Periyodik imha süresi: en fazla **6 ay**

**Veri saklama süreleri:**

| Veri | Süre | Dayanak |
|------|------|---------|
| Hesap bilgileri | Hesap aktif + 10 yıl | 6102 TTK |
| İşlem logları (IP, erişim) | 2 yıl | 5651 s.K. |
| Pazarlama onayları | Geri çekilene kadar | 6563 s.K. |

### G. KVKK Sayfaları

| Sayfa | Rota | MVP'de mi? |
|-------|------|-----------|
| KVKK Aydınlatma Metni | `/kvkk-aydinlatma-metni` | **EVET** |
| Gizlilik Politikası | `/gizlilik-politikasi` | **EVET** |
| Çerez Politikası | `/cerez-politikasi` | **EVET** |
| KVKK Başvuru Formu | `/kvkk-basvuru` | Büyüme |
| Hesap Silme | Ayarlar sayfasında | Büyüme |

### H. Cezai Yaptırımlar (2026 Güncel)

| İhlal Türü | Madde | Alt Sınır (TL) | Üst Sınır (TL) |
|------------|-------|----------------|-----------------|
| Aydınlatma eksikliği | Md. 10 | 85.437 | 1.709.200 |
| Veri güvenliği ihlali | Md. 12 | 256.357 | 17.092.242 |
| Kurul kararlarına aykırılık | Md. 15 | 427.263 | 17.092.242 |
| VERBİS kayıt eksikliği | Md. 16 | 341.809 | 17.092.242 |

## SaaS B2B Gereksinimleri

### Multi-Tenant Modeli

- Her mali müşavirlik ofisi bir **Tenant**
- `tenantId` her veritabanı sorgusunda zorunlu filtre
- Kayıt sırasında yeni Tenant otomatik oluşturulur
- Auth zinciri: Supabase Auth user → `user_profiles` → `tenants`
- RLS politikaları tenant bazlı, cross-tenant erişim **sıfır tolerans**
- API Guard Pattern: Her endpoint'te `getUserWithProfile()` + `tenantId`

### Yetki Matrisi (RBAC)

**MVP — Tek Rol:**

| Rol | Yetkiler |
|-----|----------|
| owner | Tam yetki — tüm CRUD, ayarlar |

Her kayıt eden kişi kendi ofisinin owner'ı olur. Tek kullanıcılı tenant modeli.

**Büyüme — Genişletilmiş RBAC:**

| Rol | Yetkiler |
|-----|----------|
| owner | Tam yetki + kullanıcı davet/silme |
| accountant | Beyanname, mükellef yönetimi |
| assistant | Salt okunur + sınırlı işlemler |

### Abonelik Katmanları

**MVP:** Tek plan — Geliştirme/Beta, tüm özellikler açık, ücretsiz.

**Büyüme (planlanıyor):**

| Katman | Mükellef | Kullanıcı | Özellikler |
|--------|----------|-----------|------------|
| Başlangıç | 25 | 1 | Temel modüller |
| Profesyonel | 100 | 3 | Tüm modüller + bot |
| Kurumsal | Sınırsız | 10+ | Özel entegrasyonlar + SLA |

Auth sistemi abonelikten bağımsız tasarlanmalı.

### Entegrasyonlar

**Auth ile Doğrudan İlgili:**

| Entegrasyon | Durum | Protokol |
|-------------|-------|----------|
| Supabase Auth | **MVP** | REST API + SSR cookies |
| Google OAuth (GCP) | **MVP** | OAuth 2.0 + PKCE |
| Supabase Email (varsayılan SMTP) | **MVP** | SMTP (30/saat limiti) |
| Custom SMTP (Resend/SendGrid) | Büyüme | SMTP + API |

**Platform Entegrasyonları (Auth Bağımlı):**

| Entegrasyon | Auth İlişkisi |
|-------------|---------------|
| GİB Portal | Mükellef credentials (tenant-scoped, AES-256-GCM) |
| TÜRMOB Portal | Ofis credentials (tenant-scoped) |
| Supabase Storage | Auth session ile erişim kontrolü |
| WebSocket Server | Auth token doğrulama |

### Brownfield Uygulama Hususları

**Temizlenecek:**
- Mevcut `hashedPassword` alanı `user_profiles`'dan kaldırılacak
- `accounts` tablosu (NextAuth kalıntısı) temizlenecek
- `[...nextauth]/route.ts` silinecek
- `auth-supabase.ts` dosyasındaki doğru pattern'ler ana akışa taşınacak

**Korunacak:**
- Mevcut kullanıcı yok — migrasyon gerekmez
- `user_profiles` ilişkileri korunacak
- API Guard Pattern değişmeyecek, sadece auth kaynağı güncellenecek

## Proje Kapsamı ve Aşamalı Geliştirme

### MVP Stratejisi

**Yaklaşım:** Problem-Çözme MVP'si
**Gerekçe:** Mevcut auth tamamen kırık. Acil ihtiyaç: çalışan kimlik doğrulama.
**Kaynak:** 1 Full-stack geliştirici
**Desteklenen Yolculuklar:** 5/5

### Faz 1 — MVP

1. Supabase Auth entegrasyonu (signUp, signIn, signOut)
2. Google OAuth kayıt + sonrasında şifre belirleme ekranı
3. Email/şifre ile kayıt (Zod validation + Supabase signUp)
4. Zorunlu email doğrulama (doğrulamadan dashboard erişimi yok)
5. Email/şifre ile giriş
6. Google ile giriş
7. Şifremi Unuttum akışı (email → sıfırlama linki → yeni şifre → giriş)
8. Auth callback route (/auth/callback)
9. KVKK sayfaları: Aydınlatma Metni, Gizlilik Politikası, Çerez Politikası
10. KVKK onay kutusu (önceden işaretli olmayan)
11. Middleware güncellemesi (yeni route'lar)
12. Dead code temizliği (NextAuth kalıntıları)

### Faz 2 — Büyüme

- MFA/2FA (TOTP authenticator app)
- Welcome email serisi (Gün 0, 1, 3, 7)
- Oturum yönetimi (aktif oturumları görüntüleme/sonlandırma)
- Login audit log (detaylı giriş geçmişi)
- Şifre güçlülük göstergesi
- "Beni hatırla" seçeneği
- Custom SMTP entegrasyonu (Resend/SendGrid)
- Genişletilmiş RBAC (owner, accountant, assistant)
- Kullanıcı davet sistemi
- KVKK Başvuru Formu + Hesap silme

### Faz 3 — Vizyon

- SSO (Single Sign-On)
- Passkey/WebAuthn
- SMS ile OTP doğrulama
- IP bazlı beyaz liste
- Custom Access Token Hook (JWT'de tenant_id + role)
- Abonelik katmanları

### Risk Azaltma

| Risk | Etki | Azaltma |
|------|------|---------|
| KVKK aydınlatma eksikliği | Hukuki (85K-1.7M TL) | Aydınlatma metni + checkbox MVP'de |
| Veri güvenliği ihlali | Hukuki (256K-17M TL) | Şifreleme + audit log |
| Yurt dışı aktarım güvencesi eksik | Hukuki (256K-17M TL) | Supabase DPA + aydınlatma |
| OAuth callback hataları | Teknik | PKCE flow + detaylı error handling |
| Email delivery gecikmeleri | Operasyonel | "Tekrar Gönder" butonu + 30/saat limit bilgisi |
| GCP consent screen onay gecikmesi | Süreç | Başvuruyu erkenden başlatma |
| Mali müşavirlerin Google hesabı olmaması | Pazar | Email/şifre alternatifi her zaman mevcut |

## Fonksiyonel Gereksinimler

### Hesap Oluşturma

- **FR1:** Kullanıcı, email adresi ve şifre ile yeni hesap oluşturabilir
- **FR2:** Kullanıcı, Google hesabı ile yeni hesap oluşturabilir
- **FR3:** Google ile kayıt olan kullanıcı, platform şifresi belirleyebilir
- **FR4:** Kayıt sırasında kullanıcı, ofis adı ve ad-soyad bilgilerini girebilir
- **FR5:** Kayıt sırasında kullanıcı için otomatik olarak bir tenant oluşturulur
- **FR6:** Şifre belirleme sırasında sistem, minimum güvenlik kurallarını uygular (min 8 karakter)
- **FR7:** Sistem, aynı email adresiyle mükerrer kayıt oluşturulmasını engeller

### Email Doğrulama

- **FR8:** Kayıt sonrası sistem, kullanıcının email adresine doğrulama linki gönderir
- **FR9:** Kullanıcı, email doğrulamasını tamamlamadan korumalı sayfalara erişemez
- **FR10:** Kullanıcı, doğrulama emailinin tekrar gönderilmesini talep edebilir
- **FR11:** Kullanıcı, doğrulama linkine tıklayarak email adresini onaylayabilir
- **FR12:** Doğrulama tamamlandığında kullanıcı otomatik olarak dashboard'a yönlendirilir

### Oturum Yönetimi

- **FR13:** Kullanıcı, email ve şifre ile giriş yapabilir
- **FR14:** Kullanıcı, Google hesabı ile giriş yapabilir
- **FR15:** Sistem, başarılı giriş sonrası kullanıcıyı dashboard'a yönlendirir
- **FR16:** Kullanıcı, oturumunu sonlandırabilir
- **FR17:** Sistem, oturum bilgilerini güvenli çerezlerde saklar
- **FR18:** Doğrulanmamış kullanıcılar korumalı sayfalara erişmeye çalışırsa giriş sayfasına yönlendirilir

### Şifre Kurtarma

- **FR19:** Kullanıcı, giriş sayfasından şifre sıfırlama akışını başlatabilir
- **FR20:** Sistem, şifre sıfırlama linki içeren email gönderir
- **FR21:** Kullanıcı, sıfırlama linkiyle yeni şifre belirleyebilir
- **FR22:** Şifre güncellendikten sonra kullanıcı giriş sayfasına yönlendirilir

### Güvenlik ve Erişim Kontrolü

- **FR23:** Sistem, ardışık başarısız giriş denemelerinde geçici erişim kısıtlaması uygular
- **FR24:** Sistem, tüm giriş ve çıkış denemelerini loglar
- **FR25:** Her API isteğinde oturum geçerliliği ve tenant yetkisi doğrulanır
- **FR26:** Bir tenant'ın verileri başka tenant'lar tarafından erişilemez

### KVKK Uyumluluk

- **FR27:** Kayıt formunda kullanıcı, KVKK Aydınlatma Metni'ni okuduğunu ayrı onay kutusuyla belirtir
- **FR28:** Onay kutusu önceden işaretli olmadan sunulur
- **FR29:** KVKK Aydınlatma Metni'ne kayıt formundan erişilebilir
- **FR30:** Gizlilik Politikası sayfası tüm sayfalardan erişilebilir
- **FR31:** Çerez Politikası sayfası tüm sayfalardan erişilebilir
- **FR32:** Kullanıcının KVKK onay tarihi ve versiyonu kayıt altına alınır

### Hata Yönetimi

- **FR33:** Tüm auth hata mesajları Türkçe ve anlaşılır
- **FR34:** Geçersiz email/şifre durumunda bilgilendirici mesaj gösterilir
- **FR35:** Email doğrulama bekleme ekranında süreç hakkında bilgi verilir
- **FR36:** Şifre sıfırlama email gönderiminden sonra onay mesajı gösterilir

### Sistem Bakımı

- **FR37:** NextAuth kalıntıları (dead code) temizlenir
- **FR38:** Kırık kayıt akışı Supabase Auth merkezli yapıya dönüştürülür
- **FR39:** Auth callback route, OAuth ve email doğrulama redirect'lerini yönetir

## Fonksiyonel Olmayan Gereksinimler

### Performans

| Metrik | Hedef | Ölçüm |
|--------|-------|-------|
| Auth API yanıt süresi | < 500ms (p95) | Server monitoring |
| Google OAuth toplam akış | < 3 saniye | E2E timing |
| Email doğrulama linki teslimi | < 30 saniye | SMTP log |
| Dashboard yönlendirme (giriş sonrası) | < 2 saniye | Client-side timing |
| Şifre sıfırlama email teslimi | < 60 saniye | SMTP log |
| Client-side form validation | < 100ms | UX hissedilebilirlik |
| Auth sayfaları LCP | < 2 saniye | Lighthouse |
| Eş zamanlı auth işlemleri | Min 10 concurrent | Load test |

### Güvenlik

- HTTPS/TLS zorunlu — tüm iletişim şifreli
- Şifreler Supabase bcrypt ile hash'lenir — plain text saklanmaz
- Oturum çerezleri: HttpOnly, Secure, SameSite=Lax
- CSRF koruması aktif
- Rate limiting: 5 başarısız giriş → 15 dakika kilitleme
- Auth token'lar yalnızca HttpOnly cookie'de — localStorage yasak
- Giriş/çıkış logları: IP, tarih, sonuç (5651 s.K. gereği 2 yıl)
- OWASP Top 10 korumaları (SQL Injection, XSS, CSRF)
- Google OAuth: PKCE flow

### Güvenilirlik

- Auth sistemi %99.5 uptime (Supabase SLA'e bağlı)
- Supabase erişilemez → anlaşılır hata mesajı
- Email delivery başarısız → "Tekrar Gönder" butonu
- Google OAuth erişilemez → email/şifre alternatifi kullanılabilir
- Session süresi dolduğunda zarif redirect (veri kaybı olmadan)

### Entegrasyon SLA

| Entegrasyon | Protokol | SLA |
|-------------|----------|-----|
| Supabase Auth | REST API + SSR cookies | %99.9 |
| Google OAuth | OAuth 2.0 + PKCE | %99.9 |
| Supabase SMTP | SMTP | 30 email/saat |
| Custom SMTP (gelecek) | SMTP + API | Provider SLA |

- Kesintilerde graceful degradation
- Secrets yalnızca server-side environment variable'larda

### Erişilebilirlik (Temel)

- Auth formları klavye ile kullanılabilir (Tab, Enter, Escape)
- Form alanlarında uygun label ve aria-label
- Hata mesajları görsel + metin (yalnızca renk bağımlı değil)
- Renk kontrastı WCAG 2.1 AA (min 4.5:1)
- Ekran okuyucu uyumlu form yapısı
