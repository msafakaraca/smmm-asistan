---
title: 'SGK Sube Yonetimi'
slug: 'sgk-sube-yonetimi'
created: '2026-02-07'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
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
  - 'Auth: withAuth() wrapper (api-helpers.ts)'
  - 'Credentials: encrypt()/decrypt() from src/lib/crypto.ts'
  - 'Optimistic UI: kaydet -> toast -> arka plan API -> rollback on error'
  - 'Virtual scrolling: 100+ satir icin useVirtualizer'
  - 'Direct import: barrel YASAK'
  - 'Cascade delete: onDelete: Cascade'
  - 'Zod validation + UUID regex check'
  - 'Audit logging: auditLog.create/update/viewSensitive'
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
5. Sifreler > SGK tablosunda tree yapisi (chevron ile acilir/kapanir)
6. Dashboard SGK Islemleri panelinde subeli mukellef secildiginde sube secim dialog'u

### Scope

**In Scope:**
- Prisma `customer_branches` modeli (sube adi + 4 SGK alani, encrypted)
- `@@unique([tenantId, customerId, branchName])` - ayni isimde sube engelleme (tenant-safe)
- `onDelete: Cascade` - mukellef silinince subeler de silinir
- Sube CRUD API (GET, POST, PUT, DELETE)
- Mukellef detay panelinde "Sube Ekle" butonu + dialog + "Subeler" tab'i
- Sifreler > SGK tablosunda tree/chevron yapisi
- Dashboard SGK Islemleri panelinde sube secim dialog'u (RadioGroup)
- Sube credentials encrypt/decrypt

**Out of Scope:**
- SGK Kontrol modulu entegrasyonu
- Electron bot launch sistemi
- Diger portal sifreleri (GIB, TURMOB, e-Devlet)
- Excel ile sube toplu import

## Context for Development

### Kritik Is Kurali: Sube Ekleme ve Ana SGK Bilgileri

**ONEMLI:** Bir mukellefe sube eklendigi anda, mukellefin mevcut SGK bilgileri (sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi) DEVRE DISI kalir. Sadece subeler uzerinden SGK credential yonetimi yapilir.

- Sube eklendiginde: Onay dialog'u gosterilir ("Mevcut SGK bilgileri sube bilgilerine tasinacak. Devam?"). Mevcut SGK credential'lari ilk subeye kopyalanir, ardından ana mukellefin SGK alanlari null yapilir.
- Sifreler sayfasinda: Subeli mukellef icin sadece subeleri gosterilir
- Dashboard SGK dialog'unda: Sadece subeler listelenir ("Ana Sirket" secenegi OLMAZ). Her sube yaninda credential durumu badge gosterilir (Tamam/Eksik).
- Subesi olmayan mukellef: Mevcut yapi ile devam eder
- Maksimum sube limiti: 50 sube/mukellef

### Codebase Patterns

- **withAuth wrapper:** `export const GET = withAuth(async (req, user) => { ... })` - user: `{ id, email, tenantId, role }`
- **Encryption:** `encrypt(text)` -> JSON `{ v:2, iv, content, tag }`, `decrypt(json)` -> text, `safeDecrypt(val)`: null-safe
- **Summary API:** `findMany` + `safeDecrypt` per field + `hasXxx: boolean` flags
- **Customer Detail Panel:** Radix `Tabs` (profile/passwords), React Hook Form + Zod, `fetchCustomer()`/`fetchCredentials()`
- **SGK Table:** `CustomerPasswordSummary` interface, `FormState` per customer, grid layout, virtual scrolling, optimistic update
- **Quick Actions:** `selectedSgkMukellefId` state, `prefetchedCustomers`, `InlineCustomerSelect`, SGK_LINKS'e `onLinkClick` henuz verilmiyor

### Files to Reference

| File | Purpose | Degisiklik |
| ---- | ------- | ---------- |
| `prisma/schema.prisma` | Database modelleri | Yeni `customer_branches` model |
| `customer-detail-panel.tsx` | Mukellef detay | Sube Ekle butonu + Subeler tab |
| `sgk-passwords-table.tsx` | SGK sifre tablosu | Tree yapisi |
| `summary/route.ts` | Sifre ozeti API | branches include + decrypt |
| `credentials/route.ts` | Credential CRUD | Pattern referansi (degismez) |
| `quick-actions-panel.tsx` | SGK Islemleri | SGK handler + sube dialog |
| `crypto.ts` | encrypt/decrypt | Degismez |

### Technical Decisions

1. `customer_branches` ayri tablo (JSON degil) - genisletilebilir
2. `@@unique([tenantId, customerId, branchName])` - tenant-safe duplicate engelleme
3. `onDelete: Cascade` - otomatik silme
4. Ilk sube eklenince mevcut SGK bilgileri ilk subeye kopyalanir, sonra ana alanlar null yapilir (onay dialog'u ile)
5. Dashboard'dan sadece `branchId` gecirilir
6. Ayni `encrypt()`/`decrypt()` fonksiyonlari
7. Sube Ekle: tab bar sagi, outline variant, size="sm", `+ Sube Ekle`
8. Dialog: sube adi + "Kaydet ve Yeni Ekle", alt liste
9. Tree: chevron expand/collapse, pl-6 girinti, subesi yoksa chevron yok
10. Dashboard dialog: RadioGroup, sadece subeler, "Sec ve Devam Et"

## Implementation Plan

### Tasks

- [ ] Task 1: Prisma `customer_branches` modeli olustur
  - File: `prisma/schema.prisma`
  - Action: Yeni model ekle:
    ```prisma
    model customer_branches {
      id                String    @id @default(uuid()) @db.Uuid
      branchName        String
      sgkKullaniciAdi   String?
      sgkIsyeriKodu     String?
      sgkSistemSifresi  String?
      sgkIsyeriSifresi  String?
      customerId        String    @db.Uuid
      tenantId          String    @db.Uuid
      createdAt         DateTime  @default(now())
      updatedAt         DateTime  @updatedAt
      customers         customers @relation(fields: [customerId], references: [id], onDelete: Cascade)
      tenants           tenants   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      @@unique([tenantId, customerId, branchName])
      @@index([customerId])
      @@index([tenantId])
    }
    ```
  - `customers` modeline `customer_branches customer_branches[]` relation ekle
  - `tenants` modeline `customer_branches customer_branches[]` relation ekle
  - `npx prisma db push && npx prisma generate` calistir

- [ ] Task 2: Sube CRUD API endpoint'i olustur
  - File: `src/app/api/customers/[id]/branches/route.ts` (NEW)
  - **GET:** Musterinin tum subelerini don (tenantId filtreli). Query param: `?fields=minimal` -> sadece `{ id, branchName, hasCompleteCredentials }` doner (Dashboard icin). Default: tam decrypt edilmis response: `Array<{ id, branchName, sgk: { kullaniciAdi, isyeriKodu, sistemSifresi, isyeriSifresi, hasKullaniciAdi, hasIsyeriKodu, hasSistemSifresi, hasIsyeriSifresi } }>`
  - **POST:** Yeni sube ekle. Body: `{ branchName, sgkKullaniciAdi?, sgkIsyeriKodu?, sgkSistemSifresi?, sgkIsyeriSifresi?, copyFromCustomer?: boolean }`. Zod validation (branchName trim + min 1 + max 100). Case-insensitive duplicate pre-check (P2002 fallback da var). Max 50 sube limiti. KRITIK: `copyFromCustomer: true` ise (ilk sube ve UI'dan onay alinmis), musterinin mevcut SGK bilgilerini bu subeye kopyala, ardindan customers tablosundaki SGK alanlarini null yap. Ilk sube degilse sadece olustur.
  - **PUT:** Sube guncelle. Zod schema: `{ branchId: z.string().uuid(), branchName?: z.string().trim().min(1).max(100), sgkKullaniciAdi?: z.string().max(50), sgkIsyeriKodu?: z.string().max(20), sgkSistemSifresi?: z.string().max(100), sgkIsyeriSifresi?: z.string().max(100) }`. Credential alanlari encrypt et. Tenant + ownership check.
  - **DELETE:** Sube sil. Query: `?branchId=uuid`. Tenant + ownership check.
  - Pattern: `withAuth` wrapper, Zod schema, UUID regex, audit logging (CREATE_BRANCH, UPDATE_BRANCH_CREDENTIALS, DELETE_BRANCH)

- [ ] Task 3: Sifreler summary API'sine sube destegi ekle
  - File: `src/app/api/sifreler/summary/route.ts`
  - Action: `findMany`'ye `include: { customer_branches: { select: { id, branchName, sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi } } }` ekle
  - `PasswordSummary` interface'ine ekle:
    ```typescript
    branches: Array<{
      id: string;
      branchName: string;
      sgk: {
        kullaniciAdi: string | null;
        isyeriKodu: string | null;
        sistemSifresi: string | null;
        isyeriSifresi: string | null;
        hasKullaniciAdi: boolean;
        hasIsyeriKodu: boolean;
        hasSistemSifresi: boolean;
        hasIsyeriSifresi: boolean;
      };
    }>;
    ```
  - Her sube icin `safeDecrypt` uygula

- [ ] Task 4: Mukellef detay paneline "Sube Ekle" butonu ve "Subeler" tab'i ekle
  - File: `src/app/(dashboard)/dashboard/mukellefler/components/customer-detail-panel.tsx`
  - Action:
    1. Tab bar div'i `flex items-center justify-between` yap. TabsList sola, "Sube Ekle" butonu saga.
    2. Buton: `<Button variant="outline" size="sm" onClick={() => setBranchDialogOpen(true)}>` + Plus icon + "Sube Ekle"
    3. `BranchAddDialog` component: Radix Dialog
       - Input: sube adi (zorunlu, min 1 karakter)
       - "Kaydet ve Yeni Ekle" butonu: POST -> basari -> input temizle, listeye ekle
       - "Kapat" butonu
       - Alt kisi: eklenen subelerin listesi (sube adi + kucuk X sil butonu)
    4. Yeni `TabsTrigger value="branches"` -> "Subeler"
    5. `TabsContent value="branches"`:
       - Sube yoksa: "Henuz sube eklenmemis" + Sube Ekle butonu
       - Subeler varsa: Kart listesi. Her kart: sube adi, 4 SGK alani (masked, eye toggle), duzenle/sil butonlari
       - Duzenle: inline edit (input'lar editable olur, kaydet butonu)
       - Sil: onay dialog'u -> DELETE API
    6. `fetchCustomer` sonucuna branches dahil et (customers GET API'sine `include: { customer_branches: true }` ekle)
  - `activeTab` type: `"profile" | "passwords" | "branches"`

- [ ] Task 5: SGK sifreler tablosuna tree yapisi ekle
  - File: `src/components/sifreler/sgk-passwords-table.tsx`
  - Action:
    1. `CustomerPasswordSummary` interface'ine `branches` array ekle
    2. State: `expandedCustomers: Record<string, boolean>`
    3. Subeli musterilerde sirket hucresine chevron icon ekle (ChevronRight kapali, ChevronDown acik)
    4. Expand: mukellef altina her sube icin girintili satir (pl-6). Sube satirlari: sube adi + badge + 4 SGK input + kaydet butonu
    5. Subeli mukellefin kendi satirinda SGK input'lari OLMAZ (null, cunku ilk sube eklenmesinde temizlendi)
    6. Sube satirlarinda form state + save: `PUT /api/customers/{customerId}/branches`
    7. Subesi olmayan musteriler: chevron yok, mevcut yapi aynen devam
    8. Virtual scrolling: expanded subeleri row count'a dahil et
  - Satir yuksekligi: ana 64px, sube 56px. Sube arka plan: muted/30.

- [ ] Task 6: Dashboard SGK Islemleri paneline sube secim dialog'u ekle
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action:
    1. `SGK_LINKS.map`'e `onLinkClick={handleSgkLink}` prop'u ekle
    2. `handleSgkLink(linkId)`: mukellef secili mi kontrol et -> loading toast goster -> `GET /api/customers/{id}/branches?fields=minimal` -> subesi varsa dialog ac, yoksa toast
    3. State: `sgkBranchDialogOpen`, `sgkBranches`, `selectedBranchId`, `sgkPendingLinkId`, `fetchingBranches`
    4. `SgkBranchSelectDialog`: Radix Dialog + RadioGroup
       - Baslik: "SGK Subesi Secin"
       - Alt baslik: secili mukellef adi
       - RadioGroup: sube listesi (branchName + credential durum badge: Tamam/Eksik)
       - "Sec ve Devam Et" butonu (disabled: sube secilmemisse)
       - Sec: selectedBranchId kaydet, dialog kapat, toast.info("Sube secildi - Bot baglantisi hazirlaniyor...")
    5. `Customer` interface'ine `branchCount?: number` ekle
    6. Subesi olmayan mukellef: dialog acilmaz, toast.info("Yakin zamanda...")

### Acceptance Criteria

- [ ] AC 1: Given mukellef detay paneli acik, when tab bar goruntulendiginde, then Profil, Sifreler tab'lari ve sagda "Sube Ekle" butonu gorunur.

- [ ] AC 2: Given "Sube Ekle" butonuna tiklanip sube adi girilip kaydedildiginde, then sube DB'de olusturulur ve dialog alt listesinde gorunur. Baska sube eklemek icin "Kaydet ve Yeni Ekle" kullanilabilir.

- [ ] AC 3: Given ilk sube eklendigi anda, then onay dialog'u gosterilir. Onay sonrasi mevcut SGK bilgileri ilk subeye kopyalanir ve customers tablosundaki SGK alanlari null yapilir.

- [ ] AC 4: Given ayni isimde sube mevcut (case-insensitive), when ayni isimle sube eklenmeye calisildiginda, then "Bu isimde bir sube zaten mevcut" hatasi gosterilir.

- [ ] AC 4b: Given mukellefin 50 subesi var, when yeni sube eklenmeye calisildiginda, then "Maksimum 50 sube eklenebilir" hatasi gosterilir.

- [ ] AC 5: Given subeli mukellef, when Sifreler > SGK tablosu yuklendigi, then mukellef satirinda chevron ikonu gorunur. Chevron tiklaninca altinda subeler girintili acilir.

- [ ] AC 6: Given sube satirinda SGK bilgileri girilip kaydedildiginde, then credentials encrypted olarak DB'ye kaydedilir.

- [ ] AC 7: Given subesi olmayan mukellef, when SGK tablosunda gosterildiginde, then chevron olmaz ve mevcut SGK input alanlari dogrudan gorunur.

- [ ] AC 8: Given Dashboard SGK panelinde subeli mukellef secili, when SGK linkine tiklandiginda, then sube secim dialog'u acilir ve RadioGroup ile subeler listelenir.

- [ ] AC 9: Given Dashboard SGK panelinde subesi olmayan mukellef secili, when SGK linkine tiklandiginda, then sube dialog'u ACILMAZ.

- [ ] AC 10: Given subeli mukellef silindiginde, then tum subeleri de DB'den cascade silinir.

- [ ] AC 11: Given mukellef detayda "Subeler" tab'i, then subeler listelenir, her subenin SGK bilgileri gorunur, duzenlenebilir ve silinebilir.

- [ ] AC 12: Given sube credentials, then DB'de AES-256-GCM ile encrypted, UI'da decrypted gosterilir.

## Additional Context

### Dependencies

- Prisma migration: `npx prisma db push`
- customers + tenants modellerine relation eklenmesi
- customers GET API'sine `include: { customer_branches: true }`
- Yeni dependency YOK

### Testing Strategy

- Manuel: Sube CRUD (ekle, duzenle, sil)
- Manuel: Sifreler tree gorunum
- Manuel: Dashboard sube secim
- Manuel: Encryption dogrulama
- Edge: Ayni isim -> hata
- Edge: Cascade delete
- Edge: Subesi olmayan -> eski davranis
- Edge: Ilk sube -> ana SGK null
- Edge: Tum subeler silinince -> SGK alanlari bos kalir

### Notes

- Task sirasi kritik: 1 (DB) -> 2 (API) -> 3 (Summary) -> 4 (Detail Panel) -> 5 (SGK Table) -> 6 (Dashboard)
- Bot launch henuz yok - dashboard'da sube secimi + toast'a kadar
- SGK Kontrol modulu entegrasyonu kapsam disi
- Tum subeler silindiginde ana SGK alanlari otomatik geri yuklenmez (bos kalir)
