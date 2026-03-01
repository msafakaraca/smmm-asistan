---
title: 'SGK Sube Yonetimi'
slug: 'sgk-sube-yonetimi'
created: '2026-02-07'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['Prisma 6', 'Next.js 15', 'React 19', 'Radix UI (Tabs, Dialog, ScrollArea, Select, RadioGroup)', 'TailwindCSS 4', 'AES-256-GCM', 'React Hook Form + Zod', 'Lucide Icons', '@iconify/react', '@tanstack/react-virtual']
files_to_modify:
  - prisma/schema.prisma
  - src/app/api/customers/[id]/branches/route.ts (NEW)
  - src/app/api/sifreler/summary/route.ts
  - src/components/sifreler/sgk-passwords-table.tsx
  - src/components/dashboard/quick-actions-panel.tsx
  - src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx
code_patterns:
  - 'Multi-tenant: her query tenantId ile filtrelenmeli'
  - 'Auth: withAuth() wrapper (api-helpers.ts) veya auth() (lib/auth.ts)'
  - 'Credentials: encrypt()/decrypt() from src/lib/crypto.ts - AES-256-GCM'
  - 'Optimistic UI: kaydet -> toast -> arka plan API -> rollback on error'
  - 'Virtual scrolling: 100+ satir icin useVirtualizer (@tanstack/react-virtual)'
  - 'Direct import: barrel YASAK'
  - 'Cascade delete: onDelete: Cascade'
  - 'Zod validation: API input, form validation'
  - 'Audit logging: auditLog.create/update/viewSensitive'
  - 'UUID validation: regex check before DB query'
  - 'safeDecrypt: try/catch wrapper returning null on failure'
  - 'Customer detail panel: Tabs (Radix), React Hook Form, ScrollArea'
  - 'SGK table: CustomerPasswordSummary interface, FormState per customer'
  - 'Quick Actions: InlineCustomerSelect (Popover + search), prefetchedCustomers'
test_patterns: []
---

# Tech-Spec: SGK Sube Yonetimi

**Created:** 2026-02-07

## Overview

### Problem Statement

Mukelleflerin birden fazla SGK subesi olabiliyor ve her subenin farkli SGK kullanici adi, isyeri kodu, sistem sifresi ve isyeri sifresi var. Mevcut yapida tek mukellef = tek SGK kaydi oldugu icin sube bazli credential yonetimi yapilamiyor. Ayrica Dashboard'daki SGK Islemleri panelinde bir link tiklandiginda, subeli mukelleflerde hangi subenin credentials'i ile islem yapilacagi belirlenemiyor.

### Solution

1. Yeni `customer_branches` Prisma modeli ile sube veritabani yapisi
2. Sube CRUD API endpoint'leri (`/api/customers/[id]/branches`)
3. Mukellef detay panelinde tab bar'in sag tarafina "Sube Ekle" butonu + dialog
4. Mukellef detay panelinde "Subeler" tab'i (subeleri goruntuleme/duzenleme/silme)
5. Sifreler > SGK tablosunda tree yapisi (ana mukellef altinda subeler, chevron ile acilir/kapanir)
6. Dashboard SGK Islemleri panelinde subeli mukellef secildiginde sube secim dialog'u

### Scope

**In Scope:**
- Prisma `customer_branches` modeli (sube adi + 4 SGK alani, encrypted)
- `@@unique([customerId, branchName])` ile ayni isimde sube engelleme
- `onDelete: Cascade` ile mukellef silindiginde tum subeler otomatik silinir
- Sube CRUD API endpoint'leri (GET, POST, PUT, DELETE)
- Mukellef detay panelinde "Sube Ekle" butonu (tab bar saginda, outline variant) + sube ekleme dialog'u
- Mukellef detay panelinde "Subeler" tab'i (liste, duzenleme, silme)
- Sifreler > SGK tablosunda tree/chevron yapisi (subesi olan mukelleflerde chevron, tiklaninca subeler girintili acilir)
- Dashboard SGK Islemleri panelinde sube secim dialog'u (RadioGroup ile sube listesi)
- Sube credentials'larinin encrypt/decrypt edilmesi (ayni crypto.ts fonksiyonlari)

**Out of Scope:**
- SGK Kontrol modulu entegrasyonu
- Electron bot launch sistemi (henuz kodlanmadi)
- Diger portal sifreleri (GIB, TURMOB, e-Devlet)
- Excel ile sube toplu import

## Context for Development

### Kritik Is Kurali: Sube Ekleme ve Ana SGK Bilgileri

**ONEMLI:** Bir mukellefe sube eklendigi anda, mukellefin mevcut SGK bilgileri (sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi) DEVRE DISI kalir. Artik sadece subeler uzerinden SGK credential yonetimi yapilir.

- Sube eklendiginde: Ana mukellefin SGK alanlari temizlenir (null yapilir)
- Sifreler sayfasinda: Subeli mukellefin kendi SGK satiri yerine sadece subeleri gosterilir
- Dashboard SGK dialog'unda: Sadece subeler listelenir ("Ana Sirket" secenegi OLMAZ)
- Subesi olmayan mukellef: Mevcut yapi ile devam eder (customers tablosundaki SGK alanlari)

### Codebase Patterns (Deep Investigation Bulgulari)

#### Auth Patterns
- **withAuth wrapper** (`src/lib/api-helpers.ts`): `export const GET = withAuth(async (req, user) => { ... })` - user objesi `{ id, email, tenantId, role }` icerir
- **auth() session** (`src/lib/auth.ts`): `const session = await auth(); session?.user?.tenantId`
- Her API'de tenant filtreleme ZORUNLU

#### Encryption Pattern
- `encrypt(text)` -> JSON string `{ v: 2, iv, content, tag }`
- `decrypt(encryptedJson)` -> plain text (hata durumunda empty string)
- `safeDecrypt(value)`: null-safe wrapper, try/catch ile
- Tum credential alanlari DB'de encrypted tutulur

#### Summary API Pattern (`/api/sifreler/summary`)
- `prisma.customers.findMany` ile tum musterileri cek
- Her musteri icin `safeDecrypt` ile credential degerlerini coz
- `hasXxx: boolean` flag'leri ile durum bilgisi don
- Sube destegiyle: `customer_branches` include edilecek, her sube icin ayni decrypt pattern

#### Customer Detail Panel Pattern
- Radix `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent`
- `activeTab` state: `"profile" | "passwords"` -> `"profile" | "passwords" | "branches"` olacak
- Tab bar: `div.border-b.px-4.py-2` icinde `TabsList`
- Sube Ekle butonu bu div'in icinde TabsList'in yanina eklenecek (flex justify-between)
- React Hook Form + Zod validation mevcut
- `fetchCustomer()` ile musteri verisi cekilir, `fetchCredentials()` ile sifreler on-demand

#### SGK Passwords Table Pattern
- `CustomerPasswordSummary` interface - `sgk: { kullaniciAdi, isyeriKodu, ... }` yapisi
- `FormState` per customer: `{ sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi, isDirty }`
- `formStates: Record<string, FormState>` ile state yonetimi
- Grid layout: `grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto]`
- Virtual scrolling: `useVirtualizer` ile 100+ satir icin
- Optimistic update pattern: UI guncelle -> toast -> API -> hata: rollback
- Sube destegiyle: `branches` array eklenecek, tree yapisi icin expand/collapse state

#### Quick Actions Panel Pattern
- `selectedSgkMukellefId` state mevcut
- `prefetchedCustomers` ile on-yükleme
- `InlineCustomerSelect` component ile musteri secimi (Popover + search)
- SGK_LINKS.map'e `onLinkClick` prop VERILMIYOR (henuz handler yok)
- Sube destegiyle: SGK link handler eklenecek, subeli mukellef icin Dialog acilacak

### Files to Reference

| File | Purpose | Degisiklik |
| ---- | ------- | ---------- |
| `prisma/schema.prisma` | Database modelleri | Yeni `customer_branches` model + customers relation |
| `src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx` | Mukellef detay | "Sube Ekle" butonu + "Subeler" tab'i |
| `src/components/sifreler/sgk-passwords-table.tsx` | SGK sifre tablosu | Tree yapisi + sube satirlari |
| `src/app/api/sifreler/summary/route.ts` | Sifre ozeti API | customer_branches include + sube decrypt |
| `src/app/api/customers/[id]/credentials/route.ts` | Credential CRUD | Pattern referansi (degismeyecek) |
| `src/components/dashboard/quick-actions-panel.tsx` | SGK Islemleri panel | SGK link handler + sube secim dialog |
| `src/lib/crypto.ts` | encrypt/decrypt | Degismeyecek - ayni fonksiyonlar kullanilacak |
| `src/lib/api-helpers.ts` | withAuth wrapper | Degismeyecek - ayni pattern kullanilacak |
| `src/lib/audit.ts` | Audit logging | Degismeyecek - sube islemleri de loglanacak |

### Technical Decisions

1. **Ayri tablo:** `customer_branches` ayri tablo olarak (JSON array degil) - ileride SGK Kontrol entegrasyonu, raporlama icin genisletilebilir
2. **Unique constraint:** `@@unique([customerId, branchName])` - ayni mukellefe ayni isimde sube eklenemez. Hata mesaji: "Bu isimde bir sube zaten mevcut"
3. **Cascade delete:** `onDelete: Cascade` - mukellef silindiginde tum subeler otomatik silinir
4. **Sube eklenince ana SGK iptal:** Ilk sube eklendigi anda customers tablosundaki SGK alanlari null yapilir (API tarafinda)
5. **branchId tasinmasi:** Dashboard SGK dialog'undan sadece `branchId` gecirilecek
6. **Sifreleme:** Sube credentials'lari da ayni `encrypt()` / `decrypt()` fonksiyonlari ile
7. **Sube Ekle butonu:** customer-detail-panel tab bar'inin sag tarafinda, `outline` variant + `size="sm"`, `+ Sube Ekle` metni
8. **Sube ekleme dialog'u:** Radix Dialog. Sube adi input + "Kaydet ve Yeni Ekle" butonu. Eklenen subeler dialog altinda liste. SGK sifreleri sonradan sifreler sayfasindan girilecek.
9. **Tree yapisi:** Subeli mukelleflerin solunda chevron icon (ChevronRight/ChevronDown), tiklaninca altina subeler pl-6 girintili acilir. Subesi olmayanlarda chevron yok, dogrudan mevcut satir.
10. **Dashboard SGK dialog:** Radix Dialog + RadioGroup ile sube listesi. Sadece subeler gosterilir (ana sirket secenegi yok). "Sec ve Devam Et" butonu.
11. **API pattern:** `withAuth` wrapper kullanilacak (summary route ile tutarli). Zod validation. UUID check. Audit logging.

## Implementation Plan

### Tasks

*Step 3'te doldurulacak*

### Acceptance Criteria

*Step 3'te doldurulacak*

## Additional Context

### Dependencies

- Prisma migration gerekecek (`npx prisma db push`)
- Mevcut `customers` iliskisine `customer_branches` relation eklenecek
- Yeni dependency YOK - mevcut stack yeterli (Radix Dialog, RadioGroup zaten yuklu)

### Testing Strategy

- Manuel test: Sube ekleme, duzenleme, silme
- Sifreler sayfasinda tree gorunumu dogrulama
- Dashboard SGK panelinde sube secim akisi
- Encryption dogrulama (DB'de encrypted, UI'da decrypted)
- Edge case: Ayni isimle sube ekleme denemesi -> hata mesaji
- Edge case: Subeli mukellef silindiginde cascade calisma dogrulamasi
- Edge case: Subesi olmayan mukellef icin SGK dialog acilMAMALI, direkt devam
- Edge case: Sube eklendiginde ana mukellefin SGK alanlari temizleniyor mu
- Edge case: Tum subeler silindiginde ana mukellefin SGK alanlari tekrar aktif mi (karar: hayir, bos kalir)

### Notes

- Electron bot SGK launch sistemi henuz kodlanmadi, bu yuzden dashboard'da sadece sube secimi + credentials alimina kadar kodlanacak
- SGK Kontrol modulu sube entegrasyonu bu spec'in disinda
- Party Mode kararlari dahil edildi (Winston, Sally, Amelia, Murat onerileri)
- credentials PUT API'si su an SGK alanlarini Zod schema'da tanimlamamis - sube API'si icin ayri endpoint olacak
