# SMMM-AI Sprint Planı

**Planlama Tarihi:** 2026-01-29
**Sprint Süresi:** 2 Hafta
**Takım Kapasitesi:** ~40 SP/Sprint

---

## Sprint Takvimi

```
S1: Altyapı İyileştirmeleri    [01-14 Şub 2026]  ████████████████░░░░ 39 SP
S2: Bot & Performans           [15-28 Şub 2026]  ████████████████░░░░ 37 SP
S3: Entegrasyonlar             [01-14 Mar 2026]  █████████████████░░░ 34 SP
S4: E-Fatura MVP               [15-28 Mar 2026]  ███████████████░░░░░ 29 SP
```

---

## Sprint 1: Altyapı İyileştirmeleri

**Tarih:** 01-14 Şubat 2026
**Hedef:** Test altyapısı ve API dokümantasyonu kurulumu
**Toplam SP:** 39

| ID | Story | SP | Öncelik | Açıklama |
|----|-------|----|---------|---------|
| E11-S16 | Test Altyapısı Kurulumu | 13 | P1 | Jest + Testing Library, kritik API testleri |
| E11-S1 | API Dokümantasyonu | 8 | P2 | Swagger/OpenAPI entegrasyonu |
| E9-S11 | Key Rotation Mekanizması | 8 | P2 | Encryption key rotation script'leri |
| E11-S10 | Bulk Import İyileştirme | 5 | P2 | Excel import hata mesajları |
| E11-S8 | Keyboard Shortcuts | 5 | P3 | Hızlı navigasyon kısayolları |

### Sprint 1 Çıktıları
- [ ] Jest + Testing Library kurulu
- [ ] Kritik API'ler için 20+ unit test
- [ ] Swagger UI aktif (`/api/docs`)
- [ ] Key rotation script'leri hazır
- [ ] Import hataları kullanıcı dostu
- [ ] Ctrl+K search modal çalışıyor

---

## Sprint 2: Bot & Performans

**Tarih:** 15-28 Şubat 2026
**Hedef:** Bot queue sistemi ve performans iyileştirmeleri
**Toplam SP:** 37

| ID | Story | SP | Öncelik | Açıklama |
|----|-------|----|---------|---------|
| E11-S11 | Bot Queue System | 13 | P2 | GİB bot kuyruk yönetimi |
| E11-S6 | Dashboard Analytics | 8 | P2 | Kullanım istatistikleri |
| E11-S12 | PDF OCR İyileştirme | 8 | P2 | Türkçe OCR doğruluğu |
| E11-S2 | APM Monitoring | 8 | P2 | Sentry entegrasyonu |

### Sprint 2 Çıktıları
- [ ] Bot işlemleri kuyruğa alınabiliyor
- [ ] Kuyruk durumu UI'da görünüyor
- [ ] Dashboard'da aktif mükelef, beyanname grafikleri
- [ ] OCR Türkçe karakterlerde %95+ doğruluk
- [ ] Sentry hata takibi aktif

---

## Sprint 3: Entegrasyonlar

**Tarih:** 01-14 Mart 2026
**Hedef:** Webhook ve dış sistem entegrasyonları
**Toplam SP:** 34

| ID | Story | SP | Öncelik | Açıklama |
|----|-------|----|---------|---------|
| E11-S14 | Webhook Entegrasyonları | 13 | P2 | 3. parti webhook desteği |
| E11-S3 | Backup Stratejisi | 8 | P2 | Otomatik yedekleme |
| E11-S15 | Advanced Reporting | 13 | P2 | Gelişmiş raporlama |

### Sprint 3 Çıktıları
- [ ] Webhook endpoint'leri tanımlı
- [ ] Event bazlı webhook tetikleme
- [ ] Günlük otomatik backup
- [ ] Restore mekanizması test edilmiş
- [ ] Dönemsel raporlar (PDF export)

---

## Sprint 4: E-Fatura MVP

**Tarih:** 15-28 Mart 2026
**Hedef:** E-Fatura entegrasyonu planlama ve MVP
**Toplam SP:** 29

| ID | Story | SP | Öncelik | Açıklama |
|----|-------|----|---------|---------|
| E11-S4-PLAN | E-Fatura Planlama | 8 | P1 | API araştırma, mimari |
| E11-S4-MVP | E-Fatura MVP | 21 | P1 | Temel fatura listeleme |

### Sprint 4 Çıktıları
- [ ] GİB e-fatura API dokümante
- [ ] E-fatura modülü PRD
- [ ] E-fatura listeleme ekranı
- [ ] Fatura detay görüntüleme
- [ ] PDF export

---

## Backlog (Gelecek Sprintler)

| ID | Story | SP | Öncelik | Not |
|----|-------|----|---------|----|
| E11-S5 | Mobil Uygulama | 34 | P2 | Ayrı proje olarak değerlendirilmeli |
| E11-S9 | Dark Mode | 8 | P3 | UX iyileştirmesi |
| E11-S7 | PDF Merge İyileştirme | 5 | P3 | Minor enhancement |
| E11-S13 | Multi-Language | 13 | P3 | i18n altyapısı |

---

## Öncelik Tanımları

| Öncelik | Açıklama | Aksiyon |
|---------|----------|---------|
| **P0** | Kritik/Blocker | Hemen yapılmalı |
| **P1** | Yüksek | Sprint içinde tamamlanmalı |
| **P2** | Orta | Planlanan sprint'te |
| **P3** | Düşük | Backlog'da bekleyebilir |

---

## Story Point Ölçeği

| SP | Effort | Süre (tahmini) |
|----|--------|----------------|
| 1 | Trivial | < 1 saat |
| 2 | Kolay | 1-2 saat |
| 3 | Basit | 2-4 saat |
| 5 | Orta | 4-8 saat |
| 8 | Büyük | 1-2 gün |
| 13 | Çok Büyük | 3-5 gün |
| 21 | Epic | 1 hafta+ |

---

## Sprint Kuralları

1. **Daily Standup:** Her gün 5 dakika (ne yaptım, ne yapacağım, blocker var mı)
2. **Sprint Review:** Sprint sonunda demo
3. **Retrospective:** Ne iyi gitti, ne geliştirilmeli
4. **Definition of Done:**
   - Kod yazıldı ve type-check geçiyor
   - Unit test yazıldı (kritik fonksiyonlar)
   - Code review yapıldı
   - Dokümantasyon güncellendi
   - Production'a deploy edildi

---

## Başlangıç Önerisi

**Hemen başlamak için:** Sprint 1'in ilk story'si `E11-S16: Test Altyapısı Kurulumu`

Bu story ile:
1. Jest + Testing Library kurulumu
2. Test script'leri package.json'a eklenir
3. İlk örnek testler yazılır
4. CI/CD pipeline'a test adımı eklenir

**Komut:** `/bmad-bmm-create-story E11-S16` ile story detaylandırılabilir.

---

## Dosyalar

- Sprint Status (YAML): `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Sprint Plan (MD): `_bmad-output/implementation-artifacts/sprint-plan.md`
- Story Dosyaları: `_bmad-output/implementation-artifacts/stories/`

---

**Revizyon:** v1.0.0 | 2026-01-29
