---
title: 'Son Aktiviteler Paneli v2 - Detayli Audit Trail Sistemi'
slug: 'son-aktiviteler-v2'
created: '2026-02-07'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 15', 'React 19', 'Prisma 6', 'TailwindCSS 4', 'Radix UI', 'date-fns', 'Lucide Icons', 'SWR', 'WebSocket']
files_to_modify:
  - src/components/dashboard/activity-feed.tsx
  - src/app/api/dashboard/activity/route.ts
  - src/types/dashboard.ts
  - src/components/dashboard/dashboard-content.tsx
  - src/components/dashboard/hooks/use-dashboard-data.ts
  - src/lib/activity-descriptions.ts (NEW)
  - src/app/(dashboard)/dashboard/aktiviteler/page.tsx (NEW)
  - src/app/(dashboard)/dashboard/aktiviteler/aktiviteler-client.tsx (NEW)
  - src/components/dashboard/hooks/use-activities-data.ts (NEW)
code_patterns:
  - 'SWR data fetching with dedupingInterval'
  - 'React.memo + useMemo/useCallback'
  - 'Prisma separate query + Map for user_profiles (NO schema migration)'
  - 'date-fns tr locale for timestamps'
  - 'Direct import (barrel YASAK)'
  - 'Auth guard: getUserWithProfile() + tenantId'
  - 'WebSocket: broadcastToTenant for real-time'
  - 'Description Builder Pattern: primary + secondary + meta'
  - 'Timeline UI: gun bazli gruplama + kronolojik akis'
test_patterns: []
---

# Tech-Spec: Son Aktiviteler Paneli v2 - Detayli Audit Trail Sistemi

**Created:** 2026-02-07

## Overview

### Problem Statement

Dashboard'daki Son Aktiviteler paneli kullanicilara anlamli bilgi sunmuyor:
1. Kullanici adlari e-postadan parse ediliyor (`smmmkaraca@gmail.com` -> "Smmmkaraca") - gercek isimler gosterilmiyor
2. Ingilizce action/resource isimleri siziyor ("view_sensitive", "takip_kolonlar")
3. Aciklamalar genel ve baglamdan yoksun ("guncelledi (Musteri)" - hangi musteri? ne degisti?)
4. `audit_logs.details` alanindaki zengin veri (oldValue, newValue, field, customerName) hic kullanilmiyor
5. Tum gecmisi gorebilecek ayri bir sayfa yok - sadece son 10 kayit gorunuyor
6. `ActivityAction` type'inda 7 action eksik
7. `resourceLabels` haritasinda 9 resource eksik
8. Canli guncelleme yok - sayfa yenilemeden yeni aktiviteler gorunmuyor

### Solution

1. **API'de user_profiles ayri query + Map** - userId'ler uzerinden toplu user_profiles sorgusu (schema migration GEREKTIRMEZ - Amelia onerisi)
2. **Description Builder Pattern** - primary/secondary/meta katmanli zengin Turkce mesaj ureten motor (Winston onerisi). PURE FUNCTION - DB cagrisi YAPMAZ.
3. **3 Katmanli Bilgi Hiyerarsisi** - birincil aciklama, ikincil detay, ucuncul zaman (Sally onerisi). TUM aktivitelerde 3 katman da gosterilir.
4. **Timeline Gorunumu** - gun bazli gruplama ile kronolojik zaman cizgisi (Sally onerisi + kullanici tercihi)
5. **SWR 30sn Polling** - Canli guncelleme icin SWR `refreshInterval: 30000`. WebSocket broadcast bu fazda EKLENMEZ (Winston karari - karmasiklik azaltma).
6. **Ayri aktiviteler sayfasi** - `/dashboard/aktiviteler`, filtreleme + pagination
7. **Aksiyon Cesitlendirmesi** - Dashboard panelinde farkli action turlerinden gosterim (John onerisi). Kesin algoritma: son 50 kayit -> action bazli grupla -> her gruptan 1 -> kalan slotlari kronolojik doldur -> toplam 8.
8. **SMMM Prefix** - Yonetici (admin) kullanicilara "SMMM" prefix'i
9. **Kullanici Bazli Filtre Onceligi** - "Dilruba bugun ne yapti?" sorusunu tek tikla cevaplayabilme (John onerisi)
10. **Dashboard Layout Degisikligi** - ActivityFeed 4'lu grid'den cikarilip sayfanin sag tarafina tasiniyor. QuickActions altinda Charts+Panels ile yan yana, tall column olarak. Daha fazla yer = daha fazla detay.

### Scope

**In Scope:**
- API'de user_profiles ayri query + Map ile gercek isim + rol bazli SMMM prefix
- Tum 18 AuditAction icin Turkce label, semantik ikon, renk
- Tum 18 AuditResource icin Turkce label
- Description Builder Pattern: primary + secondary + meta (details alanini kullanarak). PURE FUNCTION, DB cagrisi YOK.
- 3 katmanli bilgi hiyerarsisi TUM aktivitelerde (birincil aciklama, ikincil detay, zaman)
- Dashboard layout degisikligi: ActivityFeed sag sutuna tasinir, tall column (Charts+Panels ile yan yana)
- Dashboard panelinde "Tumunu Gor" butonu (baslik + panel alti)
- Dashboard panelinde aksiyon cesitlendirmesi (8 kayit, kesin algoritma ile)
- `/dashboard/aktiviteler` sayfasi (navbar'da YOK, timeline gorunumu)
- Timeline: gun bazli gruplama, kronolojik akis + yeni aktivite animasyonu + "Yeni aktiviteler var" banner
- Filtreler: chip-based aktif filtreler + hizli preset butonlari (Bugun, Bu Hafta, Bu Ay) + kullanici avatari
- Filtre + pagination reset: filtre degistiginde sayfa 1'e donmeli
- Pagination (sayfa basina 25 kayit)
- SWR 30sn polling ile canli guncelleme (WebSocket bu fazda EKLENMEZ)
- ActivityAction TypeScript type guncellemesi (7 eksik action)
- API geriye uyumluluk: 3 response modu (eski array, diverse array, paginated object)

**Out of Scope:**
- audit.ts loglama mekanizmasinin temel yapisini degistirme
- Yeni event turleri ekleme
- E-posta/push bildirimleri
- Audit log silme/duzenleme
- Prisma schema migration (user_profiles relation ekleme YOK)
- WebSocket broadcast (bu fazda EKLENMEZ - sadece SWR polling)

## Context for Development

### Codebase Patterns

- **Auth guard:** Her API'de `getUserWithProfile()` + tenantId filtreleme
- **Data fetching:** SWR hooks (`use-dashboard-data.ts`)
- **Component memoization:** `React.memo` + `useMemo`/`useCallback`
- **UI:** Radix UI primitives, TailwindCSS 4, Lucide Icons
- **Timestamp format:** `date-fns` + `tr` locale ile `formatDistanceToNow` ve `format`
- **Barrel import YASAK:** Direkt import kullan
- **WebSocket:** `server.ts` icinde `broadcastToTenant(tenantId, { type, data })` mevcut
- **WS Client:** `global-bot-listener.tsx` pattern'i ile WS baglantisi mevcut

### Deep Investigation Bulgulari (Step 2)

#### KRITIK: Details Alani Veri Haritalamasi
Gercek auditLog cagrilari incelendi. Details alanina gonderilen veriler:

| API + Action | Details Icerigi |
|---|---|
| customers UPDATE | `{ unvan }` - SADECE unvan, degisen alan YOK |
| customers DELETE | `{ unvan, vknTckn }` |
| customers CREATE | `{ unvan, vknTckn }` (varsayim) |
| beyanname_turleri CREATE | `{ kod, aciklama }` |
| beyanname_turleri UPDATE | `{ kod, aktif }` |
| beyanname_takip UPDATE | `{ customerId, year, month, kod, status }` |
| beyanname_takip BULK_UPDATE | `{ action: "reset", year, month }` + count |
| beyanname_takip BULK_DELETE | `{ year, month }` + count |
| users UPDATE | `{ email, name, role, status }` |
| users DELETE | `{ email, name }` |
| credentials VIEW_SENSITIVE | `{ field }` (ornek: "credentials") |
| credentials UPDATE | `{ unvan }` |
| takip_kolonlar CREATE/UPDATE/DELETE | details YOK (sadece resourceId) |
| settings UPDATE | details YOK (sadece tenantId) |
| files CREATE/BULK_UPDATE/BULK_DELETE | minimal |
| customers IMPORT/BULK_DELETE/BULK_STATUS | `{ count }` + stats |
| reminders CREATE/UPDATE/DELETE | details YOK |
| tasks CREATE/UPDATE/DELETE | details YOK |

**SONUC:** Cogu kayit minimal details iceriyor. Description Builder sunu yapmali:
1. Details varsa -> zengin mesaj (unvan, kod, count vb. kullan)
2. Details yoksa -> genel mesaj + resourceId ile entity adi cekme (OPSIYONEL, fazladan query gerektirir)
3. Fallback -> "Kullanici, [resource] [action]" seklinde basit mesaj

#### WebSocket Altyapisi Detaylari
- **Auth:** URL parametresi ile JWT token: `ws://localhost:3001?token=JWT`
- **Client types:** `browser` vs `electron` (clientType parametresi)
- **broadcastToTenant:** Tenant bazli broadcast, `{ type, data }` formati
- **Mevcut message types:** ~15 farkli tur (bot:progress, bot:complete, gib:*, turmob:*, sgk:*, electron:status)
- **server.ts satir 601:** `export { broadcastToTenant, broadcastToAll, clients }` - DIS ERISIME ACIK

#### Canli Akis Stratejisi - KESINLESTIRME (Party Mode 3 - Winston Karari)

**KARAR: WebSocket broadcast bu fazda EKLENMEZ.**

audit.ts icinde `broadcastToTenant` dogrudan cagrilamaz (Next.js server-side'da server.ts import'u sorunlu).
Internal HTTP POST yaklasimi ise asiri karmasik ve kirilgan.

**Secilen yaklasim (basit ve guvenilir):**
- SWR `refreshInterval: 30000` (30 saniye polling) - TEK MEKANIZMA
- Yeterli yakinlik saglar (max 30sn gecikme)
- WebSocket entegrasyonu Faz B'de degerlendirilecek

**Dosya etki alani:**
- `audit.ts` -> DEGISMEZ (WS broadcast eklenmeyecek)
- `server.ts` -> DEGISMEZ (activity:new message type eklenmeyecek)
- `global-bot-listener.tsx` -> DEGISMEZ

#### Dashboard Layout
- 4 sutunlu grid: `md:grid-cols-2 xl:grid-cols-4`
- ActivityFeed: 3. panel (xl gorunumde)
- Min-height: `min-h-[350px] xl:min-h-[420px]`
- Diger paneller: TaskSummaryWidget, AlertsPanel, UpcomingPanel

#### Nav Yapisi
- `nav.tsx` satir 31-126: Static `navItems` array
- Aktiviteler sayfasi bu array'e EKLENMEYECEK -> navbar'da gorunmeyecek
- Sadece dashboard panelinden "Tumunu Gor" linki ile erisim

#### Users API - MEVCUT
- `/api/users` endpoint'i VAR (GET: kullanici listesi, POST: kullanici olustur)
- `/api/users/[id]` endpoint'i VAR (PUT: guncelle, DELETE: sil)
- Kullanici filtresi icin mevcut `/api/users` GET endpoint'i kullanilabilir
- YENI endpoint GEREKMEZ

#### SWR Config Detaylari
- periodIndependentConfig: 60s dedup, 120s refresh (activities icin kullaniliyor)
- periodDependentConfig: 30s dedup, 0 refresh (donem bazli veriler)
- `keepPreviousData: true` ile gecis sirasinda eski veri gosteriliyor

#### Sayfa Pattern'i
- Server component (page.tsx): metadata + client component import
- Client component (*-client.tsx): state management + rendering
- Layout: `(dashboard)/layout.tsx` -> DashboardClientLayout (SWRProvider + GlobalBotListener)

### Party Mode Kararlari (Oturum 1 - UI/UX)

#### Sally (UX Designer) - KABUL EDILDI
- 3 katmanli bilgi hiyerarsisi: birincil (zengin aciklama), ikincil (degisiklik detayi), ucuncul (zaman)
- Timeline gorunumu: gun bazli gruplama, kronolojik zaman cizgisi
- Kullanici timeline gorunumunu ONAYLADI

#### Winston (Architect) - KABUL EDILDI
- Description Builder Pattern: `buildDescription(action, resource, details, userName)` -> `{ primary, secondary, meta }`
- 3 katmanli fallback: userId->user_profiles.name, yoksa email parse, yoksa "Bilinmeyen Kullanici"
- Schema migration GEREKTIRMEYEN ayri query + Map yaklasimi

#### John (PM) - KABUL EDILDI
- Filtre onceligi: 1) Kullanici, 2) Tarih, 3) Islem turu, 4) Kaynak turu
- Dashboard panelinde aksiyon cesitlendirmesi (farkli action turlerinden gosterim)

#### Amelia (Dev) - KABUL EDILDI
- Schema migration yerine ayri query + Map (`userIds -> user_profiles.findMany -> Map`)
- ActivityAction type senkronizasyonu (audit.ts AuditAction ile eslestirme)

### Party Mode Kararlari (Oturum 2 - Audit Log Zenginlestirme)

#### IKI FAZLI YAKLASIM - ONAYLANDI
Kullanici tarafindan kabul edildi: Tech-spec 2 faza bolunuyor.

**Faz A (Bu tech-spec):** Son Aktiviteler UI + API + Aktiviteler sayfasi + Description Builder.
MEVCUT details verisini kullanarak mumkun olan en zengin mesaji uret. Details bossa graceful fallback.

**Faz B (Ayri tech-spec - sonra):** 40+ dosyada audit log zenginlestirme.
Katmanli yaklasim ile entityName, changedFields, oldValues/newValues, cascade counts ekleme.
Faz B tamamlandiginda Description Builder OTOMATIK olarak daha zengin mesajlar uretir.

#### Winston (Architect) - Audit Details Standart Semasi
```typescript
interface EnrichedAuditDetails {
  entityName?: string;       // Insan-okunur isim (unvan, title, baslik)
  changedFields?: string[];  // ["telefon1", "email"]
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  count?: number;            // BULK islemler icin
  affectedEntities?: string[]; // Etkilenen kayit adlari (max 10)
  relatedRecords?: Record<string, number>; // {"documents": 5}
  [key: string]: unknown;
}
```
Bu sema FAZ B'de uygulanacak. Faz A'da Description Builder mevcut farkli formatlari handle edecek.

#### Murat (Test Architect) - Guvenlik Kurallari
- ASLA loglanmayacak: sifreler, API key'ler, token'lar
- Credential alanlari icin sadece flag: `"gibSifreUpdated": true`
- affectedEntities max 10 kayit siniri
- Details JSON max boyut: 10KB

#### Amelia (Dev) - Katmanli Uygulama Plani (FAZ B icin)
- Katman 1: entityName ekleme (40+ dosya, hizli)
- Katman 2: changedFields + oldValues/newValues (UPDATE'ler, ~15 dosya)
- Katman 3: Cascade tracking (DELETE'ler, ~10 dosya)
- Katman 4: BULK zenginlestirme (~8 dosya)

#### Amelia (Dev) - Description Builder entityName Fallback Zinciri (FAZ A)
Mevcut details alanindaki veriyi su sirada arar:
1. `details.entityName` -> varsa kullan
2. `details.unvan` -> varsa kullan (customers kayitlarinda mevcut)
3. `details.title` -> varsa kullan (tasks, reminders)
4. `details.name` -> varsa kullan (users, customer_groups)
5. `details.kod` -> varsa kullan (beyanname_turleri)
6. `details.baslik` -> varsa kullan (takip_kolonlar)
7. `details.field` -> varsa kullan (VIEW_SENSITIVE: "credentials")
8. Hicbiri yoksa -> genel mesaj ("bir musteri kaydini guncelledi")

### Party Mode Kararlari (Oturum 3 - Spec Review)

#### Winston (Architect) - KABUL EDILDI
- WebSocket broadcast bu fazda EKLENMEZ. Karmasiklik azaltildi.
- Sadece SWR 30sn polling yeterli. audit.ts, server.ts, global-bot-listener.tsx DEGISMEZ.

#### Sally (UX Designer) - KABUL EDILDI
- Timeline'da yeni aktivite animasyonu: slide-in-from-top + dot pulse (2sn)
- "Yeni aktiviteler var" sticky banner (kullanici asagidayken)
- Chip-based aktif filtreler + hizli preset butonlari (Bugun, Bu Hafta, Bu Ay)
- Kullanici filtre dropdown'da renkli avatar (bas harf)

#### John (PM) - KISMI KABUL
- Dashboard panelinde 8 kayit (10'dan dusuruldu). ANCAK kullanici karari ile TUM 3 KATMAN HER AKTIVITEDE gosterilir (John'un "sadece ilk 3'te secondary" onerisi REDDEDILDI).
- Panel altinda "Daha fazla..." linki KABUL.

#### Amelia (Dev) - KABUL EDILDI
- diverse=true kesin algoritma: 50 kayit -> grupla -> 1'er tane -> kalan slotlari kronolojik -> 8 kayit
- API 3 response modu: eski array, diverse array, paginated object
- buildDescription PURE FUNCTION, DB cagrisi YOK

#### Murat (Test Architect) - KABUL EDILDI
- Eski kayitlar icin try-catch + fallback
- Filtre + pagination reset testi eklendi

#### Barry (Quick Flow) - KABUL EDILDI
- Gorev paralellesme: 1->2->3 sirayla, sonra 4||6, 5||7, son 8

#### Kullanici Ek Kararlari
- ActivityFeed dashboard'da sayfanin EN SAGINA tasinir, QuickActions altinda tall column
- TUM 3 detay katmani HER aktivitede gosterilir (John'un kisitlama onerisi reddedildi)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/dashboard/activity-feed.tsx` | Mevcut aktivite paneli - TAMAMEN YENIDEN YAZILACAK |
| `src/app/api/dashboard/activity/route.ts` | Mevcut aktivite API - user_profiles JOIN + filtreler eklenecek |
| `src/types/dashboard.ts` | ActivityItem, ActivityAction type tanimlari - guncellenecek |
| `src/lib/audit.ts` | AuditLogger sinifi - DEGISMEZ (WS broadcast yok) |
| `src/components/dashboard/hooks/use-dashboard-data.ts` | SWR hook - refreshInterval + diverse eklenir |
| `src/components/dashboard/dashboard-content.tsx` | Dashboard layout - BUYUK DEGISIKLIK: ActivityFeed sag sutuna tasinir |
| `server.ts` | WebSocket server - DEGISMEZ |
| `src/components/global-bot-listener.tsx` | DEGISMEZ |
| `prisma/schema.prisma` | audit_logs ve user_profiles modelleri (DEGISMEYECEK) |

### Technical Decisions

1. **User resolve: Ayri query + Map** (schema migration YOK)
   ```
   const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
   const users = await prisma.user_profiles.findMany({ where: { id: { in: userIds } } });
   const userMap = new Map(users.map(u => [u.id, { name: u.name, role: u.role }]));
   ```

2. **SMMM prefix:** `role === "admin"` -> "SMMM " + name. Ornek: "SMMM Ismet Karaca"

3. **Description Builder Pattern:**
   ```typescript
   interface ActivityDescription {
     primary: string;   // "SMMM Ismet Karaca, ABC Ticaret Ltd. musterisini guncelledi"
     secondary?: string; // "Telefon: 0532... -> 0544..."
     meta: { changedFields?: string[]; entityName?: string; }
   }
   ```

4. **3 katmanli fallback:**
   - userId varsa -> user_profiles.name + role
   - userId yoksa, userEmail varsa -> email parse (mevcut mantik)
   - Ikisi de yoksa -> "Bilinmeyen Kullanici"

5. **Canli akis (SWR Polling - WebSocket YOK):**
   - SWR `refreshInterval: 30000` (30 saniye) - TEK MEKANIZMA
   - `audit.ts`, `server.ts`, `global-bot-listener.tsx` DEGISMEZ
   - WebSocket broadcast Faz B'de degerlendirilecek
   - Aktiviteler sayfasinda: yeni kayitlar geldiginde "Yeni aktiviteler var" banner + pulse dot animasyonu

6. **Dashboard Layout Degisikligi:**
   - ActivityFeed 4'lu grid'den cikarilip sag sutuna tasinir
   - Sol 3 sutun: Charts + TaskSummary + Alerts + Upcoming
   - Sag 1 sutun: ActivityFeed (tall column, h-full)
   - Panel artik daha uzun -> 8 kayit + TUM 3 KATMAN her aktivitede

7. **Aktiviteler sayfasi:** `/dashboard/aktiviteler` - Next.js app router, navbar'da YOK
   - Server component (page.tsx) + client component (aktiviteler-client.tsx)
   - Timeline gorunumu: gun bazli gruplama (`Bugun`, `Dun`, `5 Subat 2026`, vb.)
   - Filtreler: ust bar + chip-based + hizli preset butonlari
   - Filtre degistiginde sayfa 1'e reset

8. **Aksiyon cesitlendirmesi (Dashboard paneli) - KESIN ALGORITMA:**
   - API'ye `diverse=true` parametresi ekle
   - Son 50 kaydi cek -> action bazli grupla -> her gruptan 1 -> kalan slotlari kronolojik doldur
   - Toplam 8 kayit goster (tall panel icin uygun)

9. **Pagination:** Offset-based, sayfa basina 25 kayit, total count ile sayfa numaralari. Filtre degisince sayfa 1'e reset.

10. **API Response Formatlari (3 Mod):**
    - `?limit=8` → `ActivityItem[]` (eski format)
    - `?limit=8&diverse=true` → `ActivityItem[]` (diverse, eski format)
    - `?page=1&pageSize=25` → `{ activities: ActivityItem[], total, page, pageSize }` (paginated)

## Implementation Plan

### Tasks

- [x] **Gorev 1: TypeScript Type Guncellemeleri**
  - File: `src/types/dashboard.ts`
  - Action: `ActivityAction` type'ina 7 eksik action ekle: `VIEW_SENSITIVE`, `LOGIN_FAILED`, `BULK_DELETE`, `BULK_UPDATE`, `SETTINGS_UPDATE`, `PASSWORD_CHANGE`, `PERMISSION_CHANGE`
  - Action: `ActivityItem` interface'ine `userRole?: string` ve `description?: ActivityDescription` ekle
  - Action: Yeni interface'ler olustur:
    ```typescript
    interface ActivityDescription { primary: string; secondary?: string; meta?: { entityName?: string; changedFields?: string[] } }
    interface ActivityFilter { userId?: string; action?: string; resource?: string; startDate?: string; endDate?: string }
    interface ActivityPageResponse { activities: ActivityItem[]; total: number; page: number; pageSize: number }
    ```
  - Notes: Bu gorev diger tum gorevler icin temel tip altyapisini olusturur. ILK yapilmali.

- [x] **Gorev 2: Zengin Aciklama Motoru**
  - File: `src/lib/activity-descriptions.ts` (YENI DOSYA)
  - Action: `buildDescription(action, resource, details, userName)` fonksiyonu olustur -> `ActivityDescription` dondurur
  - Action: `resolveEntityName(details)` helper: fallback zinciri ile entity adi cikar (entityName -> unvan -> title -> name -> kod -> baslik -> field -> null)
  - Action: Her action+resource kombinasyonu icin Turkce mesaj template'leri:
    - **customers:** CREATE -> "{userName}, {entityName} adli yeni mukellef ekledi", UPDATE -> "{userName}, {entityName} mukellefini guncelledi", DELETE -> "{userName}, {entityName} ({vknTckn}) mukellefini sildi"
    - **beyanname_takip:** UPDATE -> "{userName}, {entityName} {kod} durumunu {status} olarak guncelledi" (details.customerId, year, month, kod, status kullan)
    - **beyanname_turleri:** CREATE -> "{userName}, {kod} beyanname turunu ekledi", UPDATE -> "{userName}, {kod} beyanname turunu guncelledi"
    - **credentials:** VIEW_SENSITIVE -> "{userName}, {entityName} sirketinin sifre bilgilerini goruntuledi", UPDATE -> "{userName}, {entityName} sirketinin sifre bilgilerini guncelledi"
    - **users:** LOGIN -> "{userName} sisteme giris yapti" (secondary: IP adresi), LOGOUT -> "{userName} sistemden cikis yapti", CREATE -> "{userName}, {details.name} ({details.email}) kullanicisini olusturdu", UPDATE -> "{userName}, {details.name} kullanicisini guncelledi", DELETE -> "{userName}, {details.name} kullanicisini sildi"
    - **tasks:** CREATE -> "{userName}, {details.title} gorevini olusturdu", UPDATE -> "{userName}, {details.title} gorevini guncelledi", DELETE -> "{userName}, {details.title} gorevini sildi"
    - **reminders:** CREATE -> "{userName}, {details.title} hatirlaticisini olusturdu", DELETE -> "{userName}, {details.title} hatirlaticiyi sildi"
    - **takip_kolonlar:** CREATE -> "{userName}, {details.baslik} takip kolonu ekledi", UPDATE -> "{userName}, {details.baslik} takip kolonunu guncelledi", DELETE -> "{userName}, {details.baslik} takip kolonunu sildi"
    - **documents/files:** CREATE -> "{userName}, {details.name} dosyasini yukledi", DELETE -> "{userName}, dosya sildi"
    - **settings:** UPDATE -> "{userName}, {details.type} ayarlarini guncelledi"
    - **gib_bot:** BOT_START -> "{userName}, GIB Bot'u baslatti", BOT_COMPLETE -> "GIB Bot islemi tamamlandi", BOT_ERROR -> "GIB Bot hatasi" (secondary: details.error)
    - **turmob_bot:** Ayni pattern gib_bot ile
    - **customer_groups:** CREATE -> "{userName}, {details.name} grubunu olusturdu", UPDATE/DELETE ayni pattern
    - **BULK:** BULK_DELETE -> "{userName}, {count} kaydi toplu sildi", BULK_UPDATE -> "{userName}, {count} kaydi toplu guncelledi", IMPORT -> "{userName}, {count} kayit iceri aktardi"
  - Action: Graceful fallback: details bossa veya bilinmeyen action/resource ise genel mesaj -> "{userName}, {resourceLabel} {actionLabel}"
  - Notes: SMMM prefix'i bu fonksiyona VERILMEZ. userName zaten prefix'li olarak gelir (API tarafinda eklenir).

- [x] **Gorev 3: API Endpoint Guncelleme**
  - File: `src/app/api/dashboard/activity/route.ts`
  - Action: Prisma query'ye `userId` alanini ekle (select'e)
  - Action: `extractUserName` fonksiyonunu kaldir
  - Action: User resolve: ayri query + Map pattern'i ekle:
    ```typescript
    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
    const users = await prisma.user_profiles.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, role: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));
    ```
  - Action: Her log icin: userId varsa userMap'ten name+role al, yoksa email parse fallback
  - Action: role === "admin" ise userName'e "SMMM " prefix'i ekle
  - Action: `buildDescription()` cagir (PURE FUNCTION - DB cagrisi YOK), response'a `description` ve `userRole` ekle
  - Action: buildDescription icinde try-catch: eski kayitlarda details farkli formatta olabilir, her zaman fallback donmeli
  - Action: Filtreleme parametreleri ekle: `startDate`, `endDate`, `userId`, `action`, `resource` (query params)
  - Action: `diverse=true` parametresi icin KESIN ALGORITMA:
    1. Son 50 kaydi cek (ORDER BY timestamp DESC LIMIT 50)
    2. Action bazli grupla
    3. Her gruptan en son 1'er tane al (max 8 farkli action)
    4. Kalan slotlari (8 - unique_count) kronolojik sirayla doldur
    5. Tumunu timestamp'e gore sirala
    6. Ilk 8'i dondur
  - Action: Pagination response: `{ activities: [...], total: number, page: number, pageSize: number }` (total icin `prisma.audit_logs.count()`)
  - Action: **API Geriye Uyumluluk - 3 Response Modu:**
    - `?limit=8` → `ActivityItem[]` (eski format, geriye uyumlu)
    - `?limit=8&diverse=true` → `ActivityItem[]` (diverse, eski format)
    - `?page=1&pageSize=25` → `{ activities: ActivityItem[], total, page, pageSize }` (yeni paginated format)
  - Notes: Mevcut `/api/dashboard/activity?limit=10` cagrilari geriye uyumlu kalmali.

- [x] **Gorev 4: Dashboard Paneli Yeniden Tasarimi**
  - File: `src/components/dashboard/activity-feed.tsx`
  - Action: `actionConfig` Record'unu 18 action'a genislet:
    - LOGIN: KeyRound/mavi, LOGOUT: LogOut/gri, LOGIN_FAILED: ShieldAlert/kirmizi
    - CREATE: FilePlus/yesil, UPDATE: FileEdit/turuncu, DELETE: Trash2/kirmizi
    - VIEW: Eye/mor, VIEW_SENSITIVE: Lock/turuncu, EXPORT: FileDown/cyan
    - IMPORT: FileUp/indigo, BULK_DELETE: Trash2/koyu-kirmizi, BULK_UPDATE: RefreshCw/turuncu
    - BOT_START: Play/teal, BOT_COMPLETE: CheckCircle/yesil, BOT_ERROR: AlertTriangle/kirmizi
    - SETTINGS_UPDATE: Settings/slate, PASSWORD_CHANGE: KeyRound/amber, PERMISSION_CHANGE: Shield/mor
  - Action: `resourceLabels` Record'unu 18 resource'a genislet (eksik 9: takip_kolonlar, gib_bot, turmob_bot, email, announcements, sgk_kontrol, kdv_kontrol, customer_groups, beyanname_turleri)
  - Action: Render mantigi: TUM 3 KATMAN HER AKTIVITEDE GOSTERILIR:
    - 1. Katman (primary): `activity.description?.primary` (font-medium, text-sm)
    - 2. Katman (secondary): `activity.description?.secondary` (text-muted-foreground, text-xs) - her zaman goster, yoksa bos birak
    - 3. Katman (meta/timestamp): saat + tarih bilgisi (text-xs, text-muted-foreground/60)
  - Action: Panel basliginin yanina "Tumunu Gor" link butonu ekle -> `Link href="/dashboard/aktiviteler"`
  - Action: Panel ALTINA da kucuk "Daha fazla..." linki ekle (John onerisi)
  - Action: SWR call'a `diverse=true` parametresi ekle, 8 kayit goster (10'dan 8'e dustu - panel boyutuna uyum)
  - Action: Fade-in animasyon: yeni eklenen aktivite icin CSS transition (`animate-in fade-in slide-in-from-top-2 duration-300`)
  - Notes: Mevcut `details?.message` kontrolunu kaldir, yerine `description.primary` kullan. Panel artik tall column olacagi icin daha fazla alan var.

- [x] **Gorev 5: Dashboard Hook + Layout Degisikligi + Canli Akis**
  - File: `src/components/dashboard/hooks/use-dashboard-data.ts`
  - Action: Activities SWR key'ini guncelle: `"/api/dashboard/activity?limit=8&diverse=true"`
  - Action: `refreshInterval: 30000` (30 saniye) ekle - TEK CANLI AKIS MEKANIZMASI
  - File: `src/components/dashboard/dashboard-content.tsx`
  - Action: **LAYOUT DEGISIKLIGI - ActivityFeed sag sutuna tasinir:**
    - Mevcut 4'lu grid'den ActivityFeed'i cikar
    - Yeni layout: `xl:grid-cols-4` ustunden `xl:grid-cols-[1fr_1fr_1fr_minmax(300px,1fr)]` veya nested grid:
    ```
    <div className="grid gap-4 xl:grid-cols-4">
      {/* Sol 3 sutun: Charts + Alt paneller */}
      <div className="xl:col-span-3 space-y-4">
        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ChartsSection />
        </div>
        {/* Alt paneller: Task + Alerts + Upcoming */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TaskSummaryWidget />
          <AlertsPanel />
          <UpcomingPanel />
        </div>
      </div>
      {/* Sag 1 sutun: ActivityFeed (tall, spans both rows) */}
      <div className="xl:col-span-1 xl:row-span-2">
        <ActivityFeed className="h-full" />
      </div>
    </div>
    ```
  - Notes: WebSocket broadcast bu fazda EKLENMEZ. `global-bot-listener.tsx` ve `server.ts` DEGISMEZ. ActivityFeed artik daha uzun olacak icin 8 kayit + tam 3 katman gosterim mumkun.

- [x] **Gorev 6: Aktiviteler Sayfasi**
  - File: `src/app/(dashboard)/dashboard/aktiviteler/page.tsx` (YENI DOSYA)
  - Action: Server component, metadata: `{ title: "Son Aktiviteler" }`, `<AktivitelerClient />` import
  - File: `src/app/(dashboard)/dashboard/aktiviteler/aktiviteler-client.tsx` (YENI DOSYA)
  - Action: Client component ("use client"), filtre state'leri (userId, action, resource, startDate, endDate, page)
  - Action: **Timeline gorunumu:**
    - Gun bazli gruplama helper: `groupActivitiesByDay(activities)` -> `Map<string, ActivityItem[]>` (key: "Bugun", "Dun", "5 Subat 2026 Carsamba")
    - Her gun basligi: `<div className="sticky top-0 bg-background z-10 py-2 px-4 font-semibold text-sm border-b">`
    - Timeline cizgisi: sol tarafta `border-l-2 border-muted ml-4`
    - Her aktivite: `<div className="relative pl-8 pb-4">` + sol noktasi (dot: `absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-{color}`)
    - Aktivite karti icerigi: ikon + primary (bold) + secondary (muted) + saat (HH:mm, text-xs)
  - Action: **Filtreler (ust bar):**
    - Radix Select: Kullanici secimi (`/api/users` GET ile cek, `{ id, name, role }[]`) - kullanici isimlerinin yaninda renkli avatar (bas harf)
    - Radix Select: Islem turu (18 action, Turkce label)
    - Radix Select: Kaynak turu (18 resource, Turkce label)
    - Input type="date" x2: Baslangic-Bitis tarihi
    - **Hizli filtre presetleri:** "Bugun", "Bu Hafta", "Bu Ay" butonlari (tek tikla tarih araligini set eder)
    - **Chip-based aktif filtreler:** Secili filtreler ust kisimda chip olarak gorulur, her chip'te X ile kaldir butonu
    - Button: "Filtreleri Temizle" (tum chip'leri kaldirir)
    - Filtre degisikliklerinde URL search params guncellenir (`useSearchParams` + `router.push`)
    - **ONEMLI: Filtre degistiginde sayfa her zaman 1'e reset olur (Murat onerisi)**
  - Action: **Pagination:** Alt kisim, `<div className="flex items-center justify-between border-t pt-4">` + onceki/sonraki butonlari + sayfa bilgisi ("Sayfa 1 / 6")
  - Action: **Yeni aktivite animasyonu (Sally onerisi):**
    - Listenin basina kayarak eklenir (slide-in-from-top)
    - Timeline dot pulse: yeni aktivitenin noktasi 2sn boyunca pulse animasyonu yapar
    - **"Yeni aktiviteler var" banner:** Kullanici sayfa asagisindayken ustte sticky banner: "X yeni aktivite - Gormek icin tikla" -> tiklaninca scroll to top
  - Action: **Bos durum:** Filtre sonucunda kayit yoksa: "Bu filtrelere uygun aktivite bulunamadi" + Activity ikonu
  - Action: **Loading:** Skeleton loader (3-4 timeline placeholder)
  - Notes: `nav.tsx` dosyasina DOKUNMA. Bu sayfayi navItems'a EKLEME.

- [x] **Gorev 7: Aktiviteler Sayfasi SWR Hook**
  - File: `src/components/dashboard/hooks/use-activities-data.ts` (YENI DOSYA)
  - Action: `useActivitiesData(filters: ActivityFilter & { page: number })` hook'u olustur
  - Action: SWR key: `/api/dashboard/activity?page=${page}&pageSize=25&userId=${}&action=${}&resource=${}&startDate=${}&endDate=${}`
  - Action: Config: `{ revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 15000 }`
  - Action: Return: `{ activities, total, page, pageSize, isLoading, isValidating, mutate }`
  - Notes: Dashboard paneli icin AYRI hook (use-dashboard-data.ts). Bu hook sadece aktiviteler sayfasi icin.

- [x] **Gorev 8: Entegrasyon ve Son Kontroller**
  - File: `src/components/dashboard/dashboard-content.tsx`
  - Action: ActivityFeed prop'larinin guncel oldugunu dogrula (activities array + loading)
  - File: `src/types/dashboard.ts`
  - Action: Export edilen tiplerin dogru oldugunu dogrula
  - Action: Tum Lucide ikon import'larinin direkt import oldugunu dogrula (barrel YASAK)
  - Notes: Bu gorev entegrasyon testi + final dogrulama.

### Gorev Bagimliliklari (Barry onerisi)

```
Gorev 1 (Types) → Gorev 2 (Description Builder) → Gorev 3 (API)
                                                      ↓
                                              Gorev 4 ∥ Gorev 6 (PARALEL)
                                              Gorev 5 ∥ Gorev 7 (PARALEL)
                                                      ↓
                                                  Gorev 8 (Entegrasyon)
```

- Gorev 1 → 2 → 3: Sirayla (tip bagimliligi)
- Gorev 4 ve 6: Paralel (Dashboard paneli ve Aktiviteler sayfasi birbirinden bagimsiz)
- Gorev 5 ve 7: Paralel (Dashboard hook ve Aktiviteler hook birbirinden bagimsiz)
- Gorev 8: Son (hepsi bittikten sonra)

### Acceptance Criteria

- [ ] **AC1:** Given dashboard acikken ve audit_logs'da userId'li kayitlar varken, when Son Aktiviteler paneli yuklenir, then kullanici adlari user_profiles.name'den gelir. Yonetici icin "SMMM Ismet Karaca", normal kullanici icin "Dilruba Kandemir" gorunur.

- [ ] **AC2:** Given audit_logs'da userId null olan eski kayitlar varken, when panel yuklenir, then email adresi parse edilerek ad gosterilir (fallback). userId ve email ikisi de yoksa "Bilinmeyen Kullanici" gorunur.

- [ ] **AC3:** Given panel yuklendiginde, when herhangi bir aktivite karti incelenir, then Ingilizce metin YOKTUR. Tum action label'lari (18) ve resource label'lari (18) Turkce'dir.

- [ ] **AC4:** Given details alaninda unvan/title/name/kod/baslik verisi olan bir kayit varken, when o aktivite gosterilir, then zengin aciklama primary satiri entity adini icerir. Orn: "SMMM Ismet Karaca, ABC Ticaret Ltd. mukellefini guncelledi"

- [ ] **AC5:** Given details alani null veya bos olan bir kayit varken, when o aktivite gosterilir, then graceful fallback calisir: "{userName}, bir {resourceLabel} kaydini {actionLabel}" seklinde genel mesaj gosterilir.

- [ ] **AC6:** Given details alaninda secondary bilgi (count, status, year, month, error vb.) olan bir kayit varken, when o aktivite gosterilir, then secondary satir muted renkte gosterilir. Orn: "KDV1 -> verildi, Ocak 2026"

- [ ] **AC7:** Given dashboard panelinde 10+ aktivite varken, when "Tumunu Gor" butonuna tiklanir, then `/dashboard/aktiviteler` sayfasina yonlendirilir.

- [ ] **AC8:** Given aktiviteler sayfasi acikken, when sayfa yuklendiginde, then timeline gorunumu gorulur: gun bazli gruplar ("Bugun", "Dun", "5 Subat 2026"), sol tarafta dikey cizgi, her aktivitede renkli nokta + ikon.

- [ ] **AC9:** Given aktiviteler sayfasinda filtre alani varken, when kullanici secilir (orn: "Dilruba Kandemir"), then sadece o kullanicinin aktiviteleri gosterilir ve URL search params guncellenir.

- [ ] **AC10:** Given aktiviteler sayfasinda tarih filtresi varken, when baslangic ve bitis tarihi secilir, then sadece o tarih araligindaki aktiviteler gosterilir.

- [ ] **AC11:** Given aktiviteler sayfasinda islem turu filtresi varken, when "Silme" secilir, then sadece DELETE action'li aktiviteler gosterilir.

- [ ] **AC12:** Given aktiviteler sayfasinda 25+ kayit varken, when sayfa yuklendiginde, then ilk 25 kayit gosterilir ve alt kisimda pagination kontrolleri gorulur ("Sayfa 1 / 3", onceki/sonraki butonlari).

- [ ] **AC13:** Given navbar acikken, when tum menu oge'leri kontrol edilir, then "Aktiviteler" menu ogesi YOKTUR. Sayfaya sadece dashboard panelindeki "Tumunu Gor" linki ile ulasilir.

- [ ] **AC14:** Given dashboard acikken, when baska bir sekmede yeni bir islem yapilir (ornek: musteri ekleme), then 30 saniye icinde dashboard panelindeki aktivite akisi otomatik guncellenir (SWR 30sn polling).

- [ ] **AC15:** Given VIEW_SENSITIVE action'li bir kayit varken, when o aktivite gosterilir, then "SMMM Ismet Karaca, ABC Ticaret Ltd. sirketinin sifre bilgilerini goruntuledi" seklinde gosterilir.

- [ ] **AC16:** Given DELETE+takip_kolonlar action'li bir kayit varken ve details'da baslik alani varken, when o aktivite gosterilir, then "Dilruba Kandemir, KDV Durumu takip kolonunu sildi" seklinde kolon adi ile gosterilir.

- [ ] **AC17:** Given tum 18 AuditAction turu icin, when ilgili aktivite karti gosterilir, then her biri icin farkli semantik ikon ve renk kullanilir.

- [ ] **AC18:** Given dashboard panelinde diverse=true ile veri cekilirken, when son 50 kayidin 40'i VIEW_SENSITIVE ise, then panelde sadece VIEW_SENSITIVE degil, farkli action turlerinden de ornekler gosterilir.

- [ ] **AC19:** Given dashboard yuklendiginde, when sayfa render olur, then ActivityFeed sayfanin sag tarafinda tall column olarak gorulur (Charts ve diger paneller sol 3 sutunda). ActivityFeed QuickActions paneli ile ayni yukseklikte baslar.

- [ ] **AC20:** Given dashboard panelinde herhangi bir aktivite goruntulenir, when aktivite karti incelenir, then 3 katmanin HEPSI gosterilir: primary (zengin aciklama), secondary (detay/degisiklik bilgisi), meta (saat/tarih). Secondary yoksa bile bos alan birakilmaz, sadece primary + meta gosterilir.

- [ ] **AC21:** Given aktiviteler sayfasinda kullanici filtresi secilmis ve 2. sayfada iken, when islem turu filtresi degistirilir, then sayfa otomatik olarak 1'e reset olur.

- [ ] **AC22:** Given aktiviteler sayfasinda filtre uygulanmisken, when ust kisim kontrol edilir, then aktif filtreler chip olarak gorulur (orn: "Kullanici: Dilruba Kandemir" X butonu ile). Her chip tiklanarak kaldirilabilir.

- [ ] **AC23:** Given aktiviteler sayfasinda hizli filtre preset butonlari varken, when "Bugun" tiklanir, then tarih araligi bugunun 00:00-23:59 olarak set edilir ve sonuclar gosterilir.

## Additional Context

### Dependencies

- Mevcut: `date-fns`, `lucide-react`, `@radix-ui/*`, `swr`, `ws` (WebSocket)
- Mevcut: `/api/users` GET endpoint'i (kullanici listesi filtresi icin)
- Yeni dependency YOK

### Testing Strategy

**Manuel Test Plani:**
1. Dashboard paneli: 3 katmanli gorunum kontrolu (primary/secondary/timestamp)
2. Dashboard paneli: "Tumunu Gor" butonu -> aktiviteler sayfasina yonlendirme
3. Dashboard paneli: Aksiyon cesitlendirmesi (diverse=true) - hep ayni action gorunmuyor mu?
4. Aktiviteler sayfasi: Timeline gorunumu (gun bazli gruplama, dikey cizgi, noktalar)
5. Aktiviteler sayfasi: Kullanici filtresi -> dogru filtreleme
6. Aktiviteler sayfasi: Tarih araligi filtresi -> dogru filtreleme
7. Aktiviteler sayfasi: Islem turu filtresi -> dogru filtreleme
8. Aktiviteler sayfasi: Kaynak turu filtresi -> dogru filtreleme
9. Aktiviteler sayfasi: Filtreleri temizle -> tum kayitlar
10. Aktiviteler sayfasi: Pagination (2+ sayfa olacak kadar kayit varken)
11. Fallback: userId null kayitlar -> email parse
12. Fallback: details null kayitlar -> genel mesaj
13. Canli akis: Yeni islem yap, 30sn icinde dashboard'da gorunuyor mu?
14. Navbar: "Aktiviteler" menu ogesi YOKTUR
15. Her 18 action icin ikon + renk dogrulamasi
16. Dashboard layout: ActivityFeed sag sutunda mi? Tall column mu?
17. Dashboard paneli: TUM aktivitelerde 3 katman gosteriliyor mu?
18. Aktiviteler sayfasi: Chip-based filtreler goruluyor mu? X ile kaldiriliyor mu?
19. Aktiviteler sayfasi: "Bugun", "Bu Hafta", "Bu Ay" preset butonlari calisiyor mu?
20. Aktiviteler sayfasi: Filtre degisince sayfa 1'e reset oluyor mu?

**Edge Cases:**
- Hic aktivite yok -> bos durum mesaji
- Tek aktivite var -> pagination gorunmez
- Cok uzun entity adi (200+ karakter) -> truncate
- details alani gecersiz JSON (eski kayitlar) -> hata yok, fallback
- Kullanici silindiyse ama audit_logs'da userId hala varsa -> userMap'te bulunamaz, email fallback

### Notes

- **FAZ A (Bu spec):** UI + API + Description Builder. Mevcut details'le calisir.
- **FAZ B (Ayri spec):** 40+ dosyada audit log zenginlestirme. Tamamlandiginda Description Builder otomatik zenginlesir.
- `audit_logs.details` JSON - bazi eski kayitlarda eksik/farkli format olabilir. Description Builder her durumu handle etmeli.
- E-postadan parse fallback korunmali (geriye uyumluluk).
- `user_profiles.role`: "admin" veya "user".
- Timeline gorunumunde 500+ kayit icin virtual scrolling dusunulebilir (ileriki optimizasyon).
- WebSocket broadcast bu fazda EKLENMEZ. SWR 30sn polling TEK mekanizma. (Party Mode 3 - Winston karari)
- buildDescription() PURE FUNCTION - DB cagrisi YAPMAZ, sadece verilen veriden string uretir. (Party Mode 3 - Amelia karari)
- Eski kayitlar icin buildDescription icinde try-catch + fallback. (Party Mode 3 - Murat karari)
- Party Mode 3 oturum kararlari (Spec Review) dahil edildi.
- Dashboard layout degisikligi: ActivityFeed sag sutuna tasindi (kullanici tercihi).
- TUM 3 katman HER aktivitede gosterilir (kullanici tercihi - John'un kisitlama onerisi reddedildi).
