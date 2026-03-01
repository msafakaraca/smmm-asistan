---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
status: complete
completedAt: '2026-01-29'
classification:
  projectType: saas_b2b
  domain: fintech
  complexity: medium
  projectContext: brownfield
inputDocuments:
  - docs/project-overview.md
  - docs/architecture-main.md
  - docs/data-models.md
  - docs/development-guide.md
  - docs/hattat-musavir-analiz.md
  - docs/hattat-musavir-analiz-v2.md
  - _bmad-output/planning-artifacts/prd.md
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 7
featureName: 'Dashboard Task Summary'
projectType: 'brownfield'
---

# Product Requirements Document - Dashboard Task Summary

**Author:** Safa
**Date:** 2026-01-29
**Project:** smmm_asistan (Brownfield - Yeni Özellik)

---

## Executive Summary

Dashboard Task Summary, mevcut SMMM-AI platformundaki görev yönetimi verilerinin ana dashboard'ta zengin ve detaylı bir özet olarak gösterilmesini sağlayan bir özelliktir. Mali müşavirler, dashboard'a girdiklerinde görev durumlarını tek bakışta anlayabilecek, geciken görevleri hemen fark edebilecek ve hızlı aksiyonlar alabileceklerdir.

---

## Success Criteria

### User Success

| Kriter | Ölçüm | Hedef |
|--------|-------|-------|
| Durum Anlama Süresi | Dashboard'a girişten durumu anlamaya kadar | < 5 saniye |
| Geciken Görev Farkındalığı | Geciken görevleri fark etme oranı | %100 (görsel uyarı) |
| Hızlı Aksiyon | Dashboard'dan görev durumu değiştirme | Mümkün |
| İş Yükü Görünürlüğü | Atanan kişi bazlı özet görme | Tek bakışta |

**Kullanıcı "Aha!" Anı:** Mali müşavir sabah işe geldiğinde dashboard'a bakıp "Bugün 3 acil görevim var, 2'si gecikmiş" bilgisini 5 saniyede görüyor.

### Business Success

| Metrik | Mevcut | Hedef | Süre |
|--------|--------|-------|------|
| Görevler sayfasına gereksiz geçiş | Yüksek | %50 azalma | 3 ay |
| Geciken görev oranı | Bilinmiyor | %20 azalma | 3 ay |
| Dashboard kullanım süresi | Düşük | %30 artış | 1 ay |

### Technical Success

| Kriter | Hedef |
|--------|-------|
| Widget yüklenme süresi | < 2 saniye |
| API response time | < 500ms |
| Gerçek zamanlı güncelleme | Optimistic update |
| Mobile responsive | Tam uyumlu |
| Tenant isolation | %100 güvenli |

### Measurable Outcomes

1. **3 Ay Sonunda:**
   - Dashboard'dan görev tamamlama oranı > %30
   - Kullanıcı memnuniyeti (NPS) artışı
   - Geciken görev sayısında azalma

2. **6 Ay Sonunda:**
   - Görev yönetimi verimliliği ölçülebilir artış
   - Trend verilerinden insight elde edilebilmesi

---

## Product Scope

### MVP - Minimum Viable Product

Dashboard'ta görev özeti için **temel widget'lar**:

| Widget | Açıklama | Öncelik |
|--------|----------|---------|
| **Özet Kartları** | Toplam, Devam Eden, Tamamlanan, Geciken sayıları | P0 |
| **Öncelik Dağılımı** | Düşük/Orta/Yüksek pie veya bar chart | P0 |
| **Geciken Görevler** | Son 5 geciken görev listesi + uyarı | P0 |
| **Yaklaşan Görevler** | Önümüzdeki 7 gün içindeki görevler | P0 |
| **Hızlı Durum Değiştirme** | Dropdown ile durum güncelleme | P1 |

### Growth Features (Post-MVP)

| Özellik | Açıklama | Öncelik |
|---------|----------|---------|
| **Trend Grafikleri** | Haftalık/Aylık görev tamamlama trendi | P2 |
| **Atanan Kişi Özeti** | Kullanıcı bazlı iş yükü dağılımı | P2 |
| **Filtreleme** | Müşteri, öncelik, tarih filtresi | P2 |
| **Görev Detay Modal** | Dashboard'dan görev detayı görme | P2 |

### Vision (Future)

| Özellik | Açıklama |
|---------|----------|
| **AI Önerileri** | Akıllı görev önceliklendirme önerileri |
| **Predictive Analytics** | Gecikme riski tahmini |
| **Otomatik Atama** | İş yüküne göre görev atama önerisi |
| **Performans Skorları** | Kullanıcı/takım performans metrikleri |

---

## User Journeys

### Yolculuk 1: Ahmet - Sabah Günlük Kontrol (Admin - Başarılı Yol)

**Persona:** Ahmet, 45 yaşında, ofis sahibi SMMM, 120 mükelef

**Açılış Sahnesi:**
Ahmet sabah 08:30'da ofise gelir. Bilgisayarını açar ve SMMM-AI'ya giriş yapar. Aklında "Bugün ekipte kim ne yapıyor? Geciken iş var mı?" soruları var.

**Yükselen Aksiyon:**
1. Dashboard açılır, görev özet widget'ını görür
2. "3 Geciken Görev" kartı kırmızı renkte dikkatini çeker
3. Atanan kişi özetinde "Ayşe: 5, Mehmet: 3" görür
4. Geciken görevler listesinde müşteri isimlerini okur

**Doruk Noktası:**
Ahmet tek bakışta "Ayşe'nin KDV beyannamesi görevi 2 gün gecikmiş" bilgisini görür ve hemen Ayşe'yi arayabilir.

**Çözüm:**
Günlük kontrol 30 saniyede tamamlanır. Ahmet neyin acil olduğunu bilir ve gününü planlayabilir.

---

### Yolculuk 2: Ayşe - Kendi Görevlerini Takip (User - Başarılı Yol)

**Persona:** Ayşe, 28 yaşında, çalışan mali müşavir, 40 mükelef sorumluluğu

**Açılış Sahnesi:**
Ayşe öğleden sonra dashboard'a girer. Bugün hangi görevleri bitirmesi gerektiğini bilmek istiyor.

**Yükselen Aksiyon:**
1. Dashboard'da "Bana Atanan" filtresiyle kendi görevlerini görür
2. Öncelik dağılımında 2 yüksek öncelikli görev görür
3. Yaklaşan görevler listesinde bugün son tarihi olanları kontrol eder
4. Bir görevi tamamladığında hızlı durum değiştirme ile "Tamamlandı" yapar

**Doruk Noktası:**
Ayşe dashboard'dan ayrılmadan görevini tamamlandı olarak işaretler, widget anında güncellenir.

**Çözüm:**
Ayşe gününü verimli planlar, görevler sayfasına gitme ihtiyacı duymaz.

---

### Yolculuk 3: Ahmet - Haftalık Performans İnceleme (Admin - İleri Senaryo)

**Açılış Sahnesi:**
Cuma günü Ahmet haftalık durum değerlendirmesi yapmak istiyor.

**Yükselen Aksiyon:**
1. Dashboard'da trend grafiğini açar
2. Bu hafta tamamlanan vs geciken görev oranını görür
3. Atanan kişi bazlı performansı inceler
4. Kritik müşterilerin görev durumunu kontrol eder

**Doruk Noktası:**
Ahmet "Bu hafta %85 tamamlama oranı, geçen haftadan iyi" görür.

**Çözüm:**
Haftalık toplantı için hazırlık 2 dakikada tamamlanır.

---

### Yolculuk 4: Ayşe - Geciken Görev Uyarısı (User - Edge Case)

**Açılış Sahnesi:**
Ayşe dashboard'a girer ve kırmızı uyarı görür: "2 göreviniz gecikmiş!"

**Yükselen Aksiyon:**
1. Geciken görevler widget'ına tıklar
2. Hangi müşteri, hangi görev olduğunu görür
3. Hızlı aksiyonla görev detayına gider veya durumu günceller
4. Gerekirse not ekleyerek neden geciktiğini belirtir

**Doruk Noktası:**
Ayşe geciken görevleri önceliklendirir ve aksiyon alır.

**Çözüm:**
Gecikme fark edilir ve düzeltilir, müşteri mağdur olmaz.

---

### Journey Requirements Summary

| Yolculuk | Ortaya Çıkan Gereksinimler |
|----------|---------------------------|
| Ahmet - Günlük Kontrol | Özet kartlar, geciken görev listesi, atanan kişi özeti |
| Ayşe - Kendi Takibi | Kullanıcı filtresi, öncelik dağılımı, hızlı durum değiştirme |
| Ahmet - Haftalık İnceleme | Trend grafikleri, performans metrikleri |
| Ayşe - Gecikme Uyarısı | Görsel uyarılar, hızlı aksiyon butonları |

**Kritik Yetenekler:**
- Dashboard widget sistemi
- Gerçek zamanlı veri güncelleme
- Rol bazlı görünüm (Admin tüm ekibi, User kendini görür)
- Görsel uyarı sistemi (renk kodları)
- Hızlı aksiyon butonları

---

## SaaS B2B Specific Requirements

### Tenant Model

- Dashboard widget'ları tenant-isolated olacak
- Her tenant sadece kendi görevlerini görecek
- Mevcut `tenantId` filtresi kullanılacak
- API endpoint'lerinde `getUserWithProfile()` guard pattern zorunlu

### RBAC Matrix (Rol Bazlı Erişim)

| Widget | Admin/Owner | User |
|--------|-------------|------|
| Toplam Görevler | Tüm tenant | Kendine atanan |
| Geciken Görevler | Tüm tenant | Kendine atanan |
| Atanan Kişi Özeti | Görünür | Gizli |
| Trend Grafikleri | Tüm tenant | Kendine atanan |
| Hızlı Durum Değiştirme | Evet | Sadece kendi görevleri |

### Integration Requirements

| Entegrasyon | Detay |
|-------------|-------|
| **Mevcut API** | `/api/tasks`, `/api/tasks/stats` |
| **Yeni API** | `/api/dashboard/tasks-summary` |
| **Real-time** | Mevcut WebSocket altyapısı (opsiyonel) |
| **Optimistic Update** | Mevcut pattern korunacak |

### Technical Architecture Considerations

```
src/
├── app/api/dashboard/
│   └── tasks-summary/
│       └── route.ts          # Yeni API endpoint
├── components/dashboard/
│   └── tasks/
│       ├── task-summary-widget.tsx
│       ├── task-priority-chart.tsx
│       ├── overdue-tasks-list.tsx
│       ├── upcoming-tasks-list.tsx
│       └── assignee-summary.tsx
└── types/
    └── dashboard.ts          # Mevcut, genişletilecek
```

### Implementation Considerations

- **Chart Library:** Recharts (lightweight, React-native)
- **State Management:** React Query veya SWR
- **Styling:** TailwindCSS 4 + CVA (mevcut pattern)
- **Components:** Radix UI tabanlı (mevcut pattern)
- **Performance:** useMemo, useCallback, lazy loading

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Yaklaşımı:** Problem-Çözücü MVP
- "Bugün ne yapmalıyım?" sorusuna hızlı cevap
- Geciken görevlerin görünürlüğü
- Minimal ama işlevsel widget seti

**MVP Felsefesi:**
> "Dashboard'a bakan bir mali müşavir, 5 saniyede görev durumunu anlamalı ve acil olanları fark etmeli."

**Kaynak Gereksinimleri:**
- 1 Frontend developer (React, TailwindCSS)
- Mevcut API altyapısı yeterli
- Yeni API endpoint: 1 adet
- Tahmini Efor: 3-5 gün

### MVP Feature Set (Phase 1)

**Desteklenen Kullanıcı Yolculukları:**
- Ahmet - Sabah Günlük Kontrol
- Ayşe - Kendi Görevlerini Takip
- Ayşe - Geciken Görev Uyarısı

**Must-Have Özellikler:**

| Widget | Açıklama | Öncelik |
|--------|----------|---------|
| Stats Kartları | Toplam, Devam Eden, Tamamlanan, Geciken sayıları | P0 |
| Öncelik Dağılımı | Pie/Bar chart (Düşük/Orta/Yüksek) | P0 |
| Geciken Görevler | Son 5 geciken, kırmızı uyarı, müşteri bilgisi | P0 |
| Yaklaşan Görevler | Önümüzdeki 7 gün içindeki görevler | P0 |

### Post-MVP Features

**Phase 2 (Growth):**

| Özellik | Açıklama | Değer |
|---------|----------|-------|
| Trend Grafikleri | Haftalık/Aylık tamamlama trendi | Performans analizi |
| Atanan Kişi Özeti | Kullanıcı bazlı iş yükü dağılımı | Ekip yönetimi |
| Hızlı Durum Değiştirme | Dashboard'dan görev durumu güncelleme | Verimlilik |
| Görev Detay Modal | Tıklayınca detay görme | Navigasyon azaltma |
| Filtreleme | Müşteri, öncelik, tarih filtresi | Özelleştirme |

**Phase 3 (Vision):**

| Özellik | Açıklama |
|---------|----------|
| AI Önerileri | Akıllı görev önceliklendirme önerileri |
| Predictive Analytics | Gecikme riski tahmini |
| Otomatik Atama | İş yüküne göre görev atama önerisi |
| Performans Skorları | Kullanıcı/takım performans metrikleri |

### Risk Mitigation Strategy

**Teknik Riskler:**
| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Chart library performansı | Düşük | Orta | Recharts + lazy load |
| API response time | Orta | Orta | Paralel sorgular, cache |
| Widget render performansı | Düşük | Düşük | useMemo, useCallback |

**Kaynak Riskleri:**
- MVP minimal tutuldu (4 widget)
- Mevcut API altyapısı kullanılıyor
- Yeni bağımlılık minimal (sadece Recharts)

**UX Riskleri:**
- Widget karmaşıklığı: 4-5 widget ile sınırlı
- Bilgi yoğunluğu: Özet odaklı, detay için link

---

## Functional Requirements

### Dashboard Görev Özeti Görüntüleme

- **FR1:** Kullanıcı, dashboard'da görev istatistiklerini özet kartlar olarak görebilir
- **FR2:** Kullanıcı, toplam görev sayısını görebilir
- **FR3:** Kullanıcı, devam eden görev sayısını görebilir
- **FR4:** Kullanıcı, tamamlanan görev sayısını görebilir
- **FR5:** Kullanıcı, geciken görev sayısını görebilir
- **FR6:** Kullanıcı, görevlerin öncelik dağılımını görsel olarak görebilir

### Görev Listeleme

- **FR7:** Kullanıcı, geciken görevlerin listesini görebilir
- **FR8:** Kullanıcı, yaklaşan görevlerin listesini görebilir (7 gün içinde)
- **FR9:** Kullanıcı, görev listesinde müşteri bilgisini görebilir
- **FR10:** Kullanıcı, görev listesinde son tarih bilgisini görebilir
- **FR11:** Kullanıcı, görev listesinde öncelik bilgisini görebilir

### Görsel Uyarılar

- **FR12:** Sistem, geciken görevleri görsel olarak vurgular (renk kodu)
- **FR13:** Sistem, yüksek öncelikli görevleri görsel olarak ayırt eder
- **FR14:** Sistem, bugün son tarihi olan görevleri özel olarak işaretler

### Rol Bazlı Erişim

- **FR15:** Admin/Owner, tenant'taki tüm görevlerin özetini görebilir
- **FR16:** User, sadece kendine atanan görevlerin özetini görebilir
- **FR17:** Admin/Owner, atanan kişi bazlı iş yükü özetini görebilir

### Navigasyon ve Aksiyon

- **FR18:** Kullanıcı, görev listesinden görev detay sayfasına gidebilir
- **FR19:** Kullanıcı, "Tümünü Gör" ile görevler sayfasına gidebilir

### Growth Özellikleri (Phase 2)

- **FR20:** Kullanıcı, görev tamamlama trendini grafik olarak görebilir
- **FR21:** Kullanıcı, dashboard'dan görev durumunu değiştirebilir
- **FR22:** Kullanıcı, görev listesini önceliğe göre filtreleyebilir
- **FR23:** Kullanıcı, görev listesini tarihe göre filtreleyebilir

---

## Non-Functional Requirements

### Performans

| ID | Metrik | Hedef |
|----|--------|-------|
| **NFR1** | Dashboard widget yüklenme süresi | < 2 saniye |
| **NFR2** | API response time (`/api/dashboard/tasks-summary`) | < 500ms |
| **NFR3** | Chart render süresi | < 300ms |
| **NFR4** | Optimistic update latency | < 100ms (UI feedback) |

### Güvenlik

| ID | Gereksinim |
|----|------------|
| **NFR5** | Tüm API endpoint'leri `getUserWithProfile()` guard kullanmalı |
| **NFR6** | Tüm sorgular `tenantId` filtresi içermeli |
| **NFR7** | User rolü sadece kendi atandığı görevleri görebilmeli |
| **NFR8** | API response'lar başka tenant verisi içermemeli |

### Ölçeklenebilirlik

| ID | Metrik | Hedef |
|----|--------|-------|
| **NFR9** | Eşzamanlı kullanıcı desteği | 100+ kullanıcı |
| **NFR10** | Tenant başına görev sayısı | 1000+ görev performans kaybı olmadan |

### Erişilebilirlik

| ID | Gereksinim |
|----|------------|
| **NFR11** | Tüm widget'lar klavye ile navigasyon desteklemeli |
| **NFR12** | Renk kodları yanında metin/ikon alternatifi olmalı |
| **NFR13** | Screen reader uyumlu (Radix UI ile sağlanıyor) |

### Responsive Tasarım

| ID | Gereksinim |
|----|------------|
| **NFR14** | Widget'lar mobile görünümde düzgün görüntülenmeli |
| **NFR15** | Tablet ve desktop için optimize edilmiş layout |

