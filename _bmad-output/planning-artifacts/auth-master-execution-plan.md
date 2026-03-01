# Auth Sistemi — Master Yürütme Planı

**Proje:** SMMM-AI Auth Sistemi Güncellemesi
**PRD Referansı:** `_bmad-output/planning-artifacts/prd-auth-system.md`
**Oluşturma Tarihi:** 2026-02-08
**Durum:** Faz 2 — Planlama tamamlandı, Faz 3 — Çözümleme başlıyor

---

## Genel Bakış

Bu dosya, Auth Sistemi PRD'si sonrasında tüm BMAD adımlarını (Mimari → Epic/Story → Hazırlık Kontrolü → Sprint Planlama → Story Geliştirme → Retrospective) tek bir referans noktasında toplar. Her yeni session'da bu dosya referans verilerek sırayla ilerlenecektir.

**Kural:** Her adım yeni bir Claude Code session'ında çalıştırılmalıdır. Bir adım tamamlanınca bu dosyadaki durum güncellenmelidir.

---

## Adım Durumu Özeti

| # | Adım | Komut | Durum | Çıktı Dosyası |
|---|------|-------|-------|----------------|
| 1 | Mimari | `/bmad-bmm-create-architecture` | ✅ Tamamlandı | `_bmad-output/planning-artifacts/architecture-auth.md` |
| 2 | Epic & Story | `/bmad-bmm-create-epics-and-stories` | ✅ Tamamlandı | `_bmad-output/planning-artifacts/epics-and-stories-auth.md` |
| 3 | Hazırlık Kontrolü | `/bmad-bmm-check-implementation-readiness` | ✅ Tamamlandı | (inline — HAZIR) |
| 4 | Sprint Planlama | `/bmad-bmm-sprint-planning` | ✅ Tamamlandı | `_bmad-output/implementation-artifacts/sprint-status-auth.yaml` |
| 5+ | Story Döngüsü | Create → Dev → Review | 🔄 Devam Ediyor | `_bmad-output/implementation-artifacts/stories/auth/` |
| Son | Retrospective | `/bmad-bmm-retrospective` | ⬜ Bekliyor | `_bmad-output/planning-artifacts/retrospective-auth.md` |

**Durum simgeleri:** ⬜ Bekliyor | 🔄 Devam Ediyor | ✅ Tamamlandı | ❌ Başarısız

> **Güncelleme kuralı:** Her session'da bu tabloyu güncelleyin. Başlayan adımı 🔄 yapın, tamamlanan adımı ✅ yapın, başarısız adımları ❌ yapıp sebebini notlara ekleyin.

---

## Adım 1: Mimari

### Komut
```
/bmad-bmm-create-architecture
```

### Girdiler
- **PRD:** `_bmad-output/planning-artifacts/prd-auth-system.md`
- **Mevcut Mimari:** `_bmad-output/planning-artifacts/architecture.md`
- **Proje Dokümantasyonu:**
  - `docs/architecture-main.md`
  - `docs/data-models.md`
  - `docs/development-guide.md`

### Session Başlangıç Promptu
```
Auth sistemi için mimari oluşturmamız gerekiyor.

Referans dosyalar:
- PRD: _bmad-output/planning-artifacts/prd-auth-system.md
- Mevcut mimari: _bmad-output/planning-artifacts/architecture.md
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-create-architecture komutunu çalıştır.
Çıktıyı _bmad-output/planning-artifacts/architecture-auth.md olarak kaydet.
```

### Beklenen Çıktı
- `_bmad-output/planning-artifacts/architecture-auth.md`

### İçerik Beklentileri
- Supabase Auth entegrasyon mimarisi (OAuth + Email/Şifre)
- Auth akış diyagramları (kayıt, giriş, şifre sıfırlama, email doğrulama)
- Middleware ve route koruma stratejisi
- Veritabanı şema değişiklikleri (user_profiles, accounts temizliği)
- KVKK veri saklama ve işleme mimarisi
- Google OAuth PKCE akışı
- Session yönetimi (Supabase SSR cookies)
- Brownfield temizlik planı (NextAuth kalıntıları)
- Tenant oluşturma akışı
- Rate limiting stratejisi

### Doğrulama Kontrol Listesi
- [ ] PRD'deki tüm fonksiyonel gereksinimler (FR1-FR39) mimaride karşılık buluyor mu?
- [ ] Mevcut `architecture.md` ile çelişen kararlar var mı?
- [ ] Multi-tenant modeli ve tenantId filtresi korunuyor mu?
- [ ] KVKK gereksinimleri (aydınlatma, onay, veri saklama) adreslenmiş mi?
- [ ] Brownfield temizlik öğeleri belirlenmiş mi?
- [ ] Güvenlik gereksinimleri (rate limiting, CSRF, PKCE) tanımlanmış mı?

### Geçiş Kuralı
Mimari dosyası oluşturulup doğrulama listesi geçildiyse → **Adım 2'ye geç**.

---

## Adım 2: Epic & Story

### Komut
```
/bmad-bmm-create-epics-and-stories
```

### Girdiler
- **PRD:** `_bmad-output/planning-artifacts/prd-auth-system.md`
- **Mimari:** `_bmad-output/planning-artifacts/architecture-auth.md` (Adım 1 çıktısı)
- **Master Plan:** `_bmad-output/planning-artifacts/auth-master-execution-plan.md`

### Session Başlangıç Promptu
```
Auth sistemi için epic ve story'leri oluşturmamız gerekiyor.

Referans dosyalar:
- PRD: _bmad-output/planning-artifacts/prd-auth-system.md
- Mimari: _bmad-output/planning-artifacts/architecture-auth.md
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-create-epics-and-stories komutunu çalıştır.
Çıktıyı _bmad-output/planning-artifacts/epics-and-stories-auth.md olarak kaydet.
```

### Beklenen Çıktı
- `_bmad-output/planning-artifacts/epics-and-stories-auth.md`

### İçerik Beklentileri
Öngörülen epic'ler (PRD kapsamına göre):

| Epic | Açıklama | Tahmini Story Sayısı |
|------|----------|---------------------|
| E1: Altyapı & Temizlik | NextAuth kalıntıları, Supabase Auth yapılandırma, middleware | 3-4 |
| E2: Kayıt Akışı | Email/şifre kayıt, Google OAuth kayıt, tenant oluşturma | 3-4 |
| E3: Giriş Akışı | Email/şifre giriş, Google giriş, session yönetimi | 2-3 |
| E4: Email Doğrulama | Doğrulama akışı, bekleme sayfası, callback | 2-3 |
| E5: Şifre Kurtarma | Şifremi unuttum, sıfırlama sayfası | 2 |
| E6: KVKK Uyumluluk | Aydınlatma metni, gizlilik, çerez politikası, onay kutusu | 2-3 |
| E7: Güvenlik & Polish | Rate limiting, hata mesajları, erişilebilirlik | 2-3 |

### Doğrulama Kontrol Listesi
- [ ] PRD'deki tüm FR'ler (FR1-FR39) en az bir story'de karşılanıyor mu?
- [ ] Her story'nin acceptance criteria'sı var mı?
- [ ] Story'ler arası bağımlılıklar doğru tanımlanmış mı?
- [ ] Mimari kararları story'lere doğru yansımış mı?
- [ ] KVKK gereksinimleri ayrı story'lere bölünmüş mü?
- [ ] Brownfield temizlik story'si var mı?

### Geçiş Kuralı
Epic & Story dosyası oluşturulup doğrulama listesi geçildiyse → **Adım 3'e geç**.

---

## Adım 3: Hazırlık Kontrolü

### Komut
```
/bmad-bmm-check-implementation-readiness
```

### Girdiler
- **PRD:** `_bmad-output/planning-artifacts/prd-auth-system.md`
- **Mimari:** `_bmad-output/planning-artifacts/architecture-auth.md`
- **Epic & Story:** `_bmad-output/planning-artifacts/epics-and-stories-auth.md`
- **Master Plan:** `_bmad-output/planning-artifacts/auth-master-execution-plan.md`

### Session Başlangıç Promptu
```
Auth sistemi için hazırlık kontrolü yapmamız gerekiyor.

Referans dosyalar:
- PRD: _bmad-output/planning-artifacts/prd-auth-system.md
- Mimari: _bmad-output/planning-artifacts/architecture-auth.md
- Epic & Story: _bmad-output/planning-artifacts/epics-and-stories-auth.md
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-check-implementation-readiness komutunu çalıştır.
Çıktıyı _bmad-output/planning-artifacts/implementation-readiness-check-auth.md olarak kaydet.
```

### Beklenen Çıktı
- `_bmad-output/planning-artifacts/implementation-readiness-check-auth.md`

### Bu Adımda Ne Olur?
Adversarial review yaklaşımıyla şunlar kontrol edilir:
1. PRD ↔ Mimari tutarlılığı
2. Mimari ↔ Epic/Story tutarlılığı
3. Story'lerin uygulama hazırlığı (acceptance criteria yeterliliği)
4. Eksik veya belirsiz alanlar
5. Teknik riskler ve bağımlılıklar
6. KVKK uyumluluk boşlukları

### Doğrulama Kontrol Listesi
- [ ] Hazırlık raporu "HAZIR" veya "KOŞULLU HAZIR" sonucu veriyor mu?
- [ ] Kritik bulgular var mı? Varsa çözüm önerileri uygulandı mı?
- [ ] Eksik kararlar tespit edildiyse mimari/story güncellendi mi?

### Geçiş Kuralı
- **HAZIR** → Adım 4'e geç
- **KOŞULLU HAZIR** → Koşulları çöz, tekrar kontrol et
- **HAZIR DEĞİL** → İlgili adıma (1 veya 2) geri dön, sorunları düzelt

---

## Adım 4: Sprint Planlama

### Komut
```
/bmad-bmm-sprint-planning
```

### Girdiler
- **Epic & Story:** `_bmad-output/planning-artifacts/epics-and-stories-auth.md`
- **Hazırlık Raporu:** `_bmad-output/planning-artifacts/implementation-readiness-check-auth.md`
- **Master Plan:** `_bmad-output/planning-artifacts/auth-master-execution-plan.md`

### Session Başlangıç Promptu
```
Auth sistemi için sprint planlaması yapmamız gerekiyor.

Referans dosyalar:
- Epic & Story: _bmad-output/planning-artifacts/epics-and-stories-auth.md
- Hazırlık raporu: _bmad-output/planning-artifacts/implementation-readiness-check-auth.md
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-sprint-planning komutunu çalıştır.
Çıktıyı _bmad-output/implementation-artifacts/sprint-status-auth.yaml olarak kaydet.
```

### Beklenen Çıktı
- `_bmad-output/implementation-artifacts/sprint-status-auth.yaml`

### İçerik Beklentileri
- Epic bazında story sıralaması (bağımlılıklara göre)
- Her story için durum takibi (pending → in_progress → done)
- Önerilen uygulama sırası

### Doğrulama Kontrol Listesi
- [ ] Tüm story'ler sprint planında yer alıyor mu?
- [ ] Bağımlılık sırası doğru mu? (altyapı önce, UI sonra)
- [ ] Sprint status dosyası YAML formatında geçerli mi?

### Geçiş Kuralı
Sprint planı oluşturulduysa → **Adım 5'e geç (Story Döngüsü)**.

---

## Adım 5+: Story Döngüsü (Her Story İçin Tekrarla)

Her story için 3 alt adım uygulanır. Her story **ayrı bir session**'da çalıştırılır.

### 5a. Story Oluştur

#### Komut
```
/bmad-bmm-create-story
```

#### Session Başlangıç Promptu
```
Auth sistemi sprint'inden sıradaki story'yi detaylandırmamız gerekiyor.

Referans dosyalar:
- Epic & Story: _bmad-output/planning-artifacts/epics-and-stories-auth.md
- Sprint durumu: _bmad-output/implementation-artifacts/sprint-status-auth.yaml
- Mimari: _bmad-output/planning-artifacts/architecture-auth.md
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-create-story komutunu çalıştır.
Sprint planındaki sıradaki "pending" story'yi al.
Çıktıyı _bmad-output/implementation-artifacts/stories/auth/ klasörüne kaydet.
```

#### Beklenen Çıktı
- `_bmad-output/implementation-artifacts/stories/auth/E{X}-S{Y}-{story-slug}.md`

#### Doğrulama Kontrol Listesi
- [ ] Story dosyası oluşturuldu mu?
- [ ] Acceptance criteria detaylı ve test edilebilir mi?
- [ ] Teknik tasklar ve alt görevler tanımlı mı?
- [ ] Bağımlılıklar doğru referanslanmış mı?

---

### 5b. Story Geliştir

#### Komut
```
/bmad-bmm-dev-story
```

#### Session Başlangıç Promptu
```
Auth sistemi story'sini geliştirmemiz gerekiyor.

Story dosyası: _bmad-output/implementation-artifacts/stories/auth/E{X}-S{Y}-{story-slug}.md
Mimari: _bmad-output/planning-artifacts/architecture-auth.md
Sprint durumu: _bmad-output/implementation-artifacts/sprint-status-auth.yaml
Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-dev-story komutunu çalıştır.
```

#### Doğrulama Kontrol Listesi
- [ ] Story'deki tüm acceptance criteria karşılanıyor mu?
- [ ] Kod CLAUDE.md kurallarına uyuyor mu? (tenant filter, encryption, barrel import yasağı vb.)
- [ ] TypeScript strict mode hataları yok mu?
- [ ] Yeni API endpoint'lerinde auth guard var mı?
- [ ] KVKK gereksinimleri (varsa) uygulanmış mı?

---

### 5c. Kod Review

#### Komut
```
/bmad-bmm-code-review
```

#### Session Başlangıç Promptu
```
Auth sistemi story'sinin kod review'ını yapmamız gerekiyor.

Story dosyası: _bmad-output/implementation-artifacts/stories/auth/E{X}-S{Y}-{story-slug}.md
Mimari: _bmad-output/planning-artifacts/architecture-auth.md
Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-code-review komutunu çalıştır.
```

#### Doğrulama Kontrol Listesi
- [ ] Review'da bulunan sorunlar düzeltildi mi?
- [ ] Güvenlik açıkları kontrol edildi mi?
- [ ] Sprint status güncellendi mi? (story → done)

---

### Story Döngüsü Geçiş Kuralı
- Review geçildiyse → Sprint status'ta story'yi `done` olarak işaretle
- Sprint'te bekleyen story varsa → **5a'ya geri dön** (sıradaki story)
- Tüm story'ler tamamlandıysa → **Adım Son'a geç**

---

## Adım Son: Retrospective

### Komut
```
/bmad-bmm-retrospective
```

### Session Başlangıç Promptu
```
Auth sistemi epic'i tamamlandı. Retrospective yapmamız gerekiyor.

Referans dosyalar:
- PRD: _bmad-output/planning-artifacts/prd-auth-system.md
- Mimari: _bmad-output/planning-artifacts/architecture-auth.md
- Epic & Story: _bmad-output/planning-artifacts/epics-and-stories-auth.md
- Sprint durumu: _bmad-output/implementation-artifacts/sprint-status-auth.yaml
- Story dosyaları: _bmad-output/implementation-artifacts/stories/auth/
- Master plan: _bmad-output/planning-artifacts/auth-master-execution-plan.md

Lütfen /bmad-bmm-retrospective komutunu çalıştır.
```

### Beklenen Çıktı
- `_bmad-output/planning-artifacts/retrospective-auth.md`

### İçerik Beklentileri
- Ne iyi gitti?
- Ne kötü gitti?
- Öğrenilen dersler
- Sonraki epic/faz için öneriler
- PRD'deki başarı kriterleri karşılandı mı?

---

## Dosya Haritası

```
_bmad-output/
├── planning-artifacts/
│   ├── prd-auth-system.md                          ← PRD (MEVCUT ✅)
│   ├── auth-master-execution-plan.md               ← BU DOSYA
│   ├── architecture-auth.md                        ← Adım 1 çıktısı
│   ├── epics-and-stories-auth.md                   ← Adım 2 çıktısı
│   ├── implementation-readiness-check-auth.md      ← Adım 3 çıktısı
│   └── retrospective-auth.md                       ← Adım Son çıktısı
└── implementation-artifacts/
    ├── sprint-status-auth.yaml                     ← Adım 4 çıktısı
    └── stories/
        └── auth/                                   ← Adım 5+ çıktıları
            ├── E1-S1-{story-slug}.md
            ├── E1-S2-{story-slug}.md
            └── ...
```

---

## Notlar

1. **Her adım yeni session:** BMAD kuralı gereği her workflow temiz context'te çalışır
2. **Bu dosyayı her session başında referans ver:** Session'a bu dosyanın yolunu vererek bağlam sağla
3. **Durum güncelle:** Her adım tamamlandığında bu dosyadaki "Adım Durumu Özeti" tablosunu güncelle
4. **Hazırlık kontrolü başarısızsa geri dön:** Adım 3 sorun bulursa Adım 1 veya 2'ye geri dönülür
5. **Story sırası sprint planına göre:** Story'ler sprint-status-auth.yaml'daki sıraya göre alınır
6. **CLAUDE.md kuralları geçerli:** Her adımda tenant filter, encryption, barrel import yasağı vb. kurallar geçerlidir
