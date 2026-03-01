---
title: 'SGK Şube Yönetimi'
slug: 'sgk-sube-yonetimi'
created: '2026-02-07'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: ['Prisma', 'Next.js 15', 'React 19', 'Radix UI', 'TailwindCSS 4']
files_to_modify:
  - prisma/schema.prisma
  - src/app/api/customers/[id]/branches/route.ts
  - src/app/api/sifreler/summary/route.ts
  - src/components/sifreler/sgk-passwords-table.tsx
  - src/components/dashboard/quick-actions-panel.tsx
  - src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx
code_patterns:
  - 'Multi-tenant: her query tenantId ile filtrelenmeli'
  - 'Credentials: AES-256-GCM ile encrypt/decrypt'
  - 'Optimistic UI: kaydet -> toast -> arka plan API'
  - 'Virtual scrolling: 100+ satir icin useVirtualizer'
test_patterns: []
---

# Tech-Spec: SGK Şube Yönetimi

**Created:** 2026-02-07

## Overview

### Problem Statement

Mükelleflerin birden fazla SGK şubesi olabiliyor ve her şubenin farklı SGK kullanıcı adı, işyeri kodu, sistem şifresi ve işyeri şifresi var. Mevcut yapıda tek mükellef = tek SGK kaydı olduğu için şube bazlı credential yönetimi yapılamıyor. Ayrıca Dashboard'daki SGK İşlemleri panelinde bir link tıklandığında, şubeli mükelleflerde hangi şubenin credentials'ı ile işlem yapılacağı belirlenemiyor.

### Solution

1. Yeni `customer_branches` Prisma modeli ile şube veritabanı yapısı
2. Şube CRUD API endpoint'leri (`/api/customers/[id]/branches`)
3. Mükellef detay panelinde tab bar'ın sağ tarafına "Şube Ekle" butonu + dialog
4. Mükellef detay panelinde "Şubeler" tab'ı (şubeleri görüntüleme/düzenleme/silme)
5. Şifreler > SGK tablosunda tree yapısı (ana mükellef altında şubeler)
6. Dashboard SGK İşlemleri panelinde şubeli mükellef seçildiğinde şube seçim dialog'u

### Scope

**In Scope:**
- Prisma `customer_branches` modeli (şube adı + 4 SGK alanı, encrypted)
- Şube CRUD API endpoint'leri (GET, POST, PUT, DELETE)
- Mükellef detay panelinde "Şube Ekle" butonu (tab bar sağında) + şube ekleme dialog'u
- Mükellef detay panelinde "Şubeler" tab'ı
- Şifreler > SGK tablosunda tree/accordion yapısı ile şubelerin gösterimi
- Dashboard SGK İşlemleri panelinde şube seçim dialog'u (link tıklanınca → şubesi varsa dialog → şube seç → credentials al)
- Şube credentials'larının encrypt/decrypt edilmesi

**Out of Scope:**
- SGK Kontrol modülü entegrasyonu
- Electron bot launch sistemi (henüz kodlanmadı)
- Diğer portal şifreleri (GİB, TÜRMOB, e-Devlet)
- Excel ile şube toplu import

## Context for Development

### Codebase Patterns

- **Multi-tenant:** Her query'de `tenantId` filtresi zorunlu
- **Encryption:** `src/lib/crypto.ts` - AES-256-GCM ile encrypt/decrypt
- **Optimistic UI:** Kaydet → toast.success → arka plan API → hata durumunda rollback
- **Virtual Scrolling:** 100+ satır için `@tanstack/react-virtual` kullanılıyor
- **Form Pattern:** Her müşteri için ayrı form state (`formStates` Record)
- **Direct Import:** Barrel import yasak, her component ayrı import
- **Customer Detail Panel:** Profil ve Şifreler tab'ları mevcut, sheet/panel olarak açılıyor
- **SGK İşlemleri:** `selectedSgkMukellefId` state'i var ama link handler'lar henüz aktif değil (`onLinkClick` prop SGK_LINKS'e verilmiyor)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `prisma/schema.prisma` | Database modelleri - yeni `customer_branches` modeli eklenecek |
| `src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx` | Mükellef detay paneli - Şube Ekle butonu + Şubeler tab'ı eklenecek |
| `src/components/sifreler/sgk-passwords-table.tsx` | SGK şifre tablosu - tree yapısı eklenecek |
| `src/app/api/sifreler/summary/route.ts` | Şifre özeti API - şube bilgilerini de döndürecek |
| `src/app/api/customers/[id]/credentials/route.ts` | Mevcut credential API - pattern referansı |
| `src/components/dashboard/quick-actions-panel.tsx` | Dashboard SGK İşlemleri - şube seçim dialog'u eklenecek |
| `src/lib/crypto.ts` | Encrypt/Decrypt fonksiyonları |
| `src/lib/supabase/auth.ts` | `getUserWithProfile` auth guard |

### Technical Decisions

- Şube credentials'ları aynı crypto.ts fonksiyonları ile encrypt edilecek
- Şubeler `customer_branches` ayrı tablo olarak tutulacak (customers tablosuna ek alan değil)
- Ana mükellefin mevcut SGK bilgileri korunacak, şubeler ekstra olacak
- SGK İşlemleri panelinde şubesi olmayan mükellef için direkt devam, şubesi olan için dialog açılacak

## Implementation Plan

### Tasks

*Step 2'de doldurulacak*

### Acceptance Criteria

*Step 2'de doldurulacak*

## Additional Context

### Dependencies

- Prisma migration gerekecek (`npx prisma db push` veya `migrate dev`)
- Mevcut `customers` ilişkisine `customer_branches` relation eklenecek

### Testing Strategy

- Manuel test: Şube ekleme, düzenleme, silme
- Şifreler sayfasında tree görünümü doğrulama
- Dashboard SGK panelinde şube seçim akışı
- Encryption doğrulama (DB'de encrypted, UI'da decrypted)

### Notes

- Electron bot SGK launch sistemi henüz kodlanmadı, bu yüzden dashboard'da sadece şube seçimi + credentials alımına kadar kodlanacak
- SGK Kontrol modülü şube entegrasyonu bu spec'in dışında
