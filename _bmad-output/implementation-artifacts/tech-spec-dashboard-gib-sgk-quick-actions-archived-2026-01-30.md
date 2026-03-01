---
title: 'Dashboard GİB/SGK Hızlı İşlemler Paneli'
slug: 'dashboard-gib-sgk-quick-actions'
created: '2026-01-29'
status: 'review'
stepsCompleted: [1, 2, 3]
tech_stack: ['Next.js 15', 'React 19', 'TypeScript', 'TailwindCSS 4', 'Radix UI', 'Lucide Icons']
files_to_modify: ['src/components/dashboard/dashboard-content.tsx', 'src/components/dashboard/quick-actions-panel.tsx (new)']
code_patterns: ['memo components', 'Card-based UI', 'TaxpayerSelect pattern', 'Lucide icons']
test_patterns: []
---

# Tech-Spec: Dashboard GİB/SGK Hızlı İşlemler Paneli

**Created:** 2026-01-29

## Overview

### Problem Statement

Mali müşavirler, mükellefleri ve kendi hesapları için GİB/SGK portallarına hızlı erişim istiyorlar. Şu an her işlem için farklı sayfalara gitmek gerekiyor. Dashboard'dan tek tıkla ilgili portallara erişim sağlanması gerekiyor.

### Solution

Dashboard'a 3 bölümlü, yatay kaplayan bir hızlı işlemler paneli eklemek. Stats Grid altında, Charts Section üstünde konumlanacak. Panel: Mükellef İşlemleri (Mavi), Meslek Mensubu İşlemleri (Yeşil), SGK İşlemleri (Turuncu) olmak üzere 3 bölümden oluşacak.

### Scope

**In Scope:**
- 3 bölümlü panel: Mükellef İşlemleri | Meslek Mensubu | SGK İşlemleri
- Mükellef & SGK bölümlerinde TaxpayerSelect ile müşteri seçimi (sadece unvan gösterilecek)
- Tüm linkler disabled durumda (ileride electron bot entegrasyonu için hazır)
- Her linkte ikon kullanımı
- Renkli bölüm başlıkları (Mükellef: Mavi, Meslek Mensubu: Yeşil, SGK: Turuncu)
- Yükseklik: Stats kartlarından biraz yüksek (~100-120px), Charts'tan düşük
- Mükellef Linkleri (11): Yeni İVD, E-Beyanname, Digital.gib, E-Tebligat, İnteraktif VD, GİB 5000/2000, Vergi Levhası, TÜRMOB Luca, Nette Fatura, GİB E-Defter, Nette Arşiv
- Meslek Mensubu Linkleri (8): Yeni İVD, E-Beyanname, Digital.gib, E-Tebligat, İnteraktif VD, Defter Beyan, İşte Defterim, E-Beyan
- SGK Linkleri (6): E-Bildirge, E-Bildirge V2, İşveren Sistemi, Sigortalı İşe Giriş/Çıkış, E-Borcu Yoktur, İş Kazası E-Bildirim

**Out of Scope:**
- Diğer İşlemler bölümü (E-Fatura İptal, İŞKUR, Ticaret Sicili, TÜRMOB E-Birlik)
- Electron bot entegrasyonu
- Şifre çekme işlemleri
- Link tıklama fonksiyonları (disabled kalacak)

## Context for Development

### Codebase Patterns

1. **Component Pattern**: Dashboard bileşenleri `memo()` ile optimize edilmiş, `"use client"` direktifi kullanıyor
2. **Card UI**: Tüm paneller `Card` bileşeni kullanıyor (`@/components/ui/card`)
3. **Stats Grid Yüksekliği**: `grid gap-3 grid-cols-2 lg:grid-cols-4` - kartlar ~80px
4. **Charts Section Yüksekliği**: `h-[420px]` sabit
5. **TaxpayerSelect**: Mevcut bileşen Dialog tabanlı, tek/çoklu seçim destekliyor
6. **İkon Kullanımı**: Lucide icons (`lucide-react`)
7. **Renk Vurguları**: Tailwind renk sınıfları (blue, emerald, orange)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/dashboard/dashboard-content.tsx` | Ana dashboard layout - panel eklenecek |
| `src/components/dashboard/stats-grid.tsx` | Stats kartları - yükseklik referansı |
| `src/components/dashboard/charts/charts-section.tsx` | Charts bölümü - panel bunun üstüne gelecek |
| `src/components/reminders/taxpayer-select.tsx` | Mükellef seçim bileşeni - yeniden kullanılacak |
| `src/components/ui/card.tsx` | Card bileşeni |
| `src/components/ui/badge.tsx` | Badge bileşeni (seçili mükellef gösterimi) |

### Technical Decisions

1. **TaxpayerSelect Kullanımı**: Mevcut `TaxpayerSelect` bileşeni kullanılacak (yeniden yazılmayacak)
2. **Seçilen Mükellef Gösterimi**: Sadece unvan (kisaltma veya unvan) - VKN gizli
3. **Link State**: Tüm linkler `disabled` + `cursor-not-allowed` + `opacity-50`
4. **İkonlar**: Her link yanında küçük ikon (ExternalLink veya spesifik ikonlar)
5. **Renkli Başlıklar**:
   - Mükellef: `bg-blue-500/10 border-blue-500/20 text-blue-700`
   - Meslek Mensubu: `bg-emerald-500/10 border-emerald-500/20 text-emerald-700`
   - SGK: `bg-orange-500/10 border-orange-500/20 text-orange-700`
6. **Responsive**: Desktop'ta 3 kolon (`lg:grid-cols-3`), tablet/mobilde stack

## Implementation Plan

### Tasks

- [ ] **Task 1: QuickActionsPanel bileşeni oluştur**
  - File: `src/components/dashboard/quick-actions-panel.tsx` (NEW)
  - Action: Yeni bileşen oluştur
  - Details:
    - "use client" direktifi
    - memo() ile optimize et
    - 3 bölümlü grid layout (`grid lg:grid-cols-3 gap-4`)
    - Her bölüm Card içinde
    - Renkli başlıklar (Mavi/Yeşil/Turuncu)
    - Props: `className?: string`

- [ ] **Task 2: Mükellef İşlemleri bölümü**
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action: Mükellef bölümünü implemente et
  - Details:
    - TaxpayerSelect ile mükellef seçimi (tek seçim modu)
    - Seçili mükellef badge ile gösterilsin
    - 11 link listesi (disabled)
    - Her link: ikon + metin + disabled state
    - Linkler 2 kolonda gösterilebilir

- [ ] **Task 3: Meslek Mensubu bölümü**
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action: Meslek mensubu bölümünü implemente et
  - Details:
    - Mükellef seçimi YOK
    - 8 link listesi (disabled)
    - Her link: ikon + metin + disabled state

- [ ] **Task 4: SGK İşlemleri bölümü**
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action: SGK bölümünü implemente et
  - Details:
    - TaxpayerSelect ile mükellef seçimi (tek seçim modu)
    - Seçili mükellef badge ile gösterilsin
    - 6 link listesi (disabled)
    - Her link: ikon + metin + disabled state

- [ ] **Task 5: Dashboard'a paneli entegre et**
  - File: `src/components/dashboard/dashboard-content.tsx`
  - Action: QuickActionsPanel'i import et ve ekle
  - Details:
    - Stats Grid altına, Charts Section üstüne yerleştir
    - Import: `import { QuickActionsPanel } from "./quick-actions-panel";`
    - JSX: `<QuickActionsPanel className="mt-4" />`

### Link Listesi (Referans)

**Mükellef İşlemleri (11 link):**
1. Yeni İnternet Vergi Dairesi
2. E-Beyanname Sistemi
3. Digital.gib.gov.tr / Borç Sorgulama
4. E-Tebligat Sorgulama
5. İnteraktif Vergi Dairesi
6. GİB 5000/2000
7. Vergi Levhası İndir
8. TÜRMOB Luca E-Entegratör
9. Nette Fatura
10. GİB E-Defter Sistemi
11. Nette Arşiv Sistemi

**Meslek Mensubu İşlemleri (8 link):**
1. Yeni İnternet Vergi Dairesi
2. E-Beyanname Sistemi
3. Digital.gib.gov.tr / Borç Sorgulama
4. E-Tebligat Sorgulama
5. İnteraktif Vergi Dairesi
6. Defter Beyan Sistemi
7. İşte Defterim Sistemi
8. E-Beyan Sistemi

**SGK İşlemleri (6 link):**
1. E-Bildirge
2. E-Bildirge V2
3. İşveren Sistemi
4. Sigortalı İşe Giriş ve İşten Ayrılış Bildirgeleri
5. E-Borcu Yoktur
6. İş Kazası Meslek Hastalığı E-Bildirim

### Acceptance Criteria

- [ ] **AC1**: Given dashboard sayfası açıldığında, when sayfa yüklendiğinde, then Stats Grid altında ve Charts Section üstünde 3 bölümlü panel görüntülenir
- [ ] **AC2**: Given panel görüntülendiğinde, when bölüm başlıkları incelendiğinde, then Mükellef (mavi), Meslek Mensubu (yeşil), SGK (turuncu) renk kodları görülür
- [ ] **AC3**: Given Mükellef bölümünde, when mükellef seçici tıklandığında, then TaxpayerSelect dialog'u açılır ve mükellef seçilebilir
- [ ] **AC4**: Given mükellef seçildiğinde, when seçim yapıldıktan sonra, then sadece mükellef unvanı görüntülenir (VKN gizli)
- [ ] **AC5**: Given herhangi bir link, when tıklanmaya çalışıldığında, then link disabled olduğu için tıklanamaz (cursor-not-allowed, opacity-50)
- [ ] **AC6**: Given SGK bölümünde, when mükellef seçici tıklandığında, then TaxpayerSelect dialog'u açılır ve mükellef seçilebilir
- [ ] **AC7**: Given Meslek Mensubu bölümünde, when bölüm incelendiğinde, then mükellef seçici YOKTUR (sadece linkler var)
- [ ] **AC8**: Given mobil cihazda, when panel görüntülendiğinde, then 3 bölüm dikey olarak stack edilir

## Additional Context

### Dependencies

- `@/components/reminders/taxpayer-select` - Mevcut TaxpayerSelect bileşeni
- `@/components/ui/card` - Card bileşeni
- `@/components/ui/badge` - Badge bileşeni (seçili mükellef gösterimi)
- `lucide-react` - İkonlar

### Testing Strategy

**Manuel Test:**
1. Dashboard sayfasını aç
2. Panel'in doğru konumda olduğunu kontrol et (Stats altı, Charts üstü)
3. 3 bölümün renkli başlıklarını kontrol et
4. Mükellef bölümünde mükellef seç, unvan göründüğünü doğrula
5. SGK bölümünde mükellef seç, unvan göründüğünü doğrula
6. Tüm linklerin disabled olduğunu doğrula (tıklanamaz)
7. Mobil görünümde stack layout'u kontrol et

### Notes

- **İleride Eklenecek**: Electron bot entegrasyonu - linkler aktif edilecek ve tıklandığında bot ilgili sayfaya yönlendirilecek
- **Şifre Çekme**: Mükellef seçildiğinde, ileride Şifreler sayfasından ilgili GİB/SGK şifresi çekilecek
- **Performans**: TaxpayerSelect lazy loading yapıyor, müşteri listesi sadece dialog açıldığında yükleniyor
- **Responsive**: Panel mobilde tam genişlik, tablet'te 2 kolon düşünülebilir ama şimdilik stack yeterli
