---
title: 'İŞKUR İşveren Sistemi Entegrasyonu'
slug: 'iskur-isveren-entegrasyonu'
created: '2026-02-08'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 15', 'React 19', 'TypeScript 5.7', 'Prisma 6.19', 'Puppeteer + Stealth', 'Electron', 'WebSocket', 'Zod', 'Radix UI', 'TailwindCSS 4']
files_to_modify:
  - 'prisma/schema.prisma'
  - 'src/components/dashboard/quick-actions-panel.tsx'
  - 'src/components/dashboard/iskur-giris-dialog.tsx (NEW)'
  - 'src/components/sifreler/sifreler-module.tsx'
  - 'src/components/sifreler/sidebar-menu.tsx'
  - 'src/components/sifreler/iskur-passwords-table.tsx (NEW)'
  - 'src/app/api/sifreler/summary/route.ts'
  - 'src/app/api/customers/route.ts'
  - 'src/app/api/customers/[id]/credentials/route.ts'
  - 'src/app/api/bot/launch-iskur/route.ts (NEW)'
  - 'electron-bot/src/main/iskur-launcher.ts (NEW)'
  - 'electron-bot/src/main/index.ts'
  - 'public/images/edevlet-giris.png (NEW)'
code_patterns:
  - 'VergiLevhasiDialog: Dialog + seçim kartları + Button → API call'
  - 'EdevletPasswordsTable: Virtual scroll + search + optimistic update + encrypted CRUD'
  - 'launch-edevlet API: Auth → credential fetch → decrypt → bot check → internal signal'
  - 'edevlet-launcher.ts: Puppeteer headed → navigate → fill form → devret'
  - 'Customer prefetch: /api/customers?fields=minimal → hasXCredentials boolean flags'
  - 'Bot command flow: API → _internal/bot-command → broadcastToTenant() → WS → Electron emit(type) → handler'
test_patterns: ['Manuel test - no automated tests for bot/UI flows']
---

# Tech-Spec: İŞKUR İşveren Sistemi Entegrasyonu

**Created:** 2026-02-08

## Overview

### Problem Statement

İŞKUR İşveren Sistemi'ne giriş şu an Dashboard'daki "Diğer İşlemler" panelinde, credential bilgisi olmadan basit bir link olarak duruyor. Mali müşavirlerin mükellefleri adına İŞKUR'a iki yöntemle (İŞKUR bilgileri veya E-Devlet) giriş yapabilmesi gerekiyor.

### Solution

- İŞKUR linkini "Mükellef ile Giriş" paneline taşı
- Şifreler sayfasına İŞKUR tab'ı ekle (T.C. Kimlik No + Şifre, encrypted)
- Tıklandığında Vergi Levhası Dialog'una benzer bir dialog aç - iki görsel seçim kartı ile (İŞKUR Bilgileriyle Bağlan / E-Devlet ile Bağlan)
- E-Devlet kartında kullanıcının sağladığı `indir.png` logosu görüntülenecek
- Electron bot ile İŞKUR portalına (https://esube.iskur.gov.tr/) otomatik giriş yap
- Tek API endpoint (`/api/bot/launch-iskur`) üzerinden `loginMethod` parametresi ile iki yolu yönet

### Scope

**In Scope:**
- Customer modeline `iskurTckn`, `iskurSifre` alanları (encrypted)
- Şifreler sayfasına İŞKUR tab'ı (SGK ile TÜRMOB arası sırada)
- Dashboard'da İŞKUR'u "Diğer İşlemler"den "Mükellef ile Giriş" paneline taşı
- İŞKUR giriş yöntemi seçim dialog'u (iki seçim kartı + "Bağlan" butonu)
- Ayrı `iskur-launcher.ts` Electron bot dosyası (iki export fonksiyon)
- Tek API endpoint: `/api/bot/launch-iskur` (`loginMethod: "iskur" | "edevlet"` parametresi)
- Sifreler summary API'sine İŞKUR alanlarını ekle
- Credentials API'sine İŞKUR desteği ekle
- Customer prefetch'e `hasIskurCredentials` flag'i ekle
- Her giriş yöntemi için ayrı credential check + yönlendirici toast mesajı

**Out of Scope:**
- İŞKUR portal içi otomasyon (giriş sonrası işlemler)
- Meslek Mensubu ile İŞKUR girişi
- İŞKUR şube desteği

## Context for Development

### Codebase Patterns

1. **Dialog Pattern (Vergi Levhası referans):** `VergiLevhasiDialog` bileşeni Dialog + RadioGroup + Button yapısı kullanıyor. İŞKUR dialog'u aynı compact yapıda olacak ama RadioGroup yerine iki büyük görsel seçim kartı olacak (üst: İŞKUR bilgileri ikonu + açıklama, alt: E-Devlet `indir.png` logosu). Dialog `selectedMukellefId && selectedCustomer` koşuluyla conditional render edilecek.

2. **Şifreler Tab Pattern:** `EdevletPasswordsTable` bileşeni referans. Virtual scrolling (`useVirtualizer`, threshold: 100), search, optimistic update, encrypted credential CRUD pattern'i takip edilecek. API: `/api/sifreler/summary` (GET) + `/api/customers/[id]/credentials` (PUT).

3. **Bot Launcher API Pattern:** `launch-edevlet/route.ts` referans. Auth check (`getUserWithProfile`) → credential fetch (prisma) → decrypt → bot connection check (`/_internal/clients`) → internal API signal (`/_internal/bot-command`).

4. **Bot Command Flow:** API POST → `server.ts:/_internal/bot-command` → `broadcastToTenant(tenantId, {type, data})` → WebSocket → Electron `ws-client.ts` emits `type` event → `index.ts` handler.

5. **Electron Bot Pattern:** Ayrı `iskur-launcher.ts` dosyası. Dynamic import ile lazy loading. İki export: `launchIskurWithCredentials()` ve `launchIskurWithEdevlet()`. Progress callback + completion reporting via `wsClient.send()`.

6. **Customer Prefetch Pattern:** `/api/customers?status=active&fields=minimal` → Server-side boolean flags: `hasXCredentials: !!(c.field1 && c.field2)`. Client-side: prefetched array'den find ile check.

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `src/components/dashboard/vergi-levhasi-dialog.tsx` | Dialog yapısı referansı | 1-191 |
| `src/components/dashboard/quick-actions-panel.tsx` | Panel, links, handlers | MUKELLEF_LINKS: 62-72, DIGER_LINKS: 97-102, state: 275-286, handleMukellefLink: 599-1114, handleDigerLink: 1117-1171, render: 1256-1323 |
| `src/components/sifreler/sifreler-module.tsx` | Şifreler modülü | 1-33 |
| `src/components/sifreler/sidebar-menu.tsx` | Sidebar menü | menuItems: 11-36 |
| `src/components/sifreler/edevlet-passwords-table.tsx` | Credential table | 1-446 |
| `src/app/api/sifreler/summary/route.ts` | Şifre özeti API | select: 81-115, mapping: 128-178 |
| `src/app/api/customers/route.ts` | Customer prefetch | fields=minimal: 46-82, flags: 71-80 |
| `src/app/api/customers/[id]/credentials/route.ts` | Credential CRUD | schema: 41-53, PUT handler: 112-209 |
| `src/app/api/bot/launch-edevlet/route.ts` | E-Devlet launch API | 1-252 |
| `electron-bot/src/main/edevlet-launcher.ts` | E-Devlet Puppeteer | config: 39-60, launch: 249-422 |
| `electron-bot/src/main/index.ts` | Command handlers | edevlet: 819-857, diger: 860-896 |
| `electron-bot/src/main/diger-islemler-launch.ts` | URL opener | İŞKUR commented-out: 22-39 |
| `server.ts` | WebSocket + internal API | bot-command: 477-507, broadcast: 73-84 |
| `prisma/schema.prisma` | Customer model | 196-256 |

### Technical Decisions

1. **Credential Saklama:** Customer modeline `iskurTckn String?` ve `iskurSifre String?` alanları. `edevletSifre` altına eklenir. DB'de AES-256-GCM encrypted, UI'da decrypt edilmiş görünür.
2. **Dialog Tasarım:** Vergi Levhası Dialog benzeri compact dialog (`sm:max-w-[380px]`). İki seçim kartı: üstte İŞKUR bilgileri (Users ikonu + açıklama text), altta E-Devlet (`indir.png` logosu ile `next/image`). Seçim yapıldıktan sonra "Bağlan" butonuna basılır. State: `iskurDialogOpen` + `iskurLoginMethod`.
3. **Tab Sırası:** SGK'dan sonra, TÜRMOB'dan önce (index: 2).
4. **Ayrı Bot Launcher:** `iskur-launcher.ts` ayrı dosya. `edevlet-launcher.ts` tekrar kullanılmayacak çünkü İŞKUR E-Devlet akışı farklı (önce İŞKUR sitesi → modal → E-Devlet butonu → yönlendirme → e-Devlet form).
5. **Tek API Endpoint:** `/api/bot/launch-iskur` → `loginMethod: "iskur" | "edevlet"` parametresi. İŞKUR yönteminde `iskurTckn + iskurSifre`, E-Devlet yönteminde `edevletTckn + edevletSifre` kullanılır.
6. **Credential Check (İki Katmanlı):** Client-side prefetch flags ile hızlı check + Server-side decrypt ile kesin check. Her yöntem için ayrı hata kodu ve yönlendirici toast.
7. **WebSocket Command:** Type: `iskur:launch`. Data: `{ tckn, password, loginMethod, customerName }`. Handler: `electron-bot/src/main/index.ts` → dynamic import `iskur-launcher.ts`.
8. **Bot Akışı - İŞKUR Credentials:** `esube.iskur.gov.tr` → `a[href="#modalIsverenGiris"]` tıkla → modal açılır → `#ctl02_userLoginIsveren_ctlEmployerUserId` TC doldur → `#ctl02_userLoginIsveren_ctlEmployerPassword` şifre doldur → `#ctl02_userLoginIsveren_ctlEmployerFirmaAra` tıkla.
9. **Bot Akışı - E-Devlet:** `esube.iskur.gov.tr` → `a[href="#modalIsverenGiris"]` tıkla → modal açılır → `#ctl02_userLoginIsveren_ctlEDevletIleGirisIsveren` E-Devlet butonu tıkla → `giris.turkiye.gov.tr` yönlenme bekle (`waitForNavigation`) → `input#tridField` TC doldur → `input#egpField` şifre doldur → kullanıcıya devret (giriş butonuna basmaz).

## Implementation Plan

### Tasks

#### Katman 1: Veritabanı (Temel)

- [x] Task 1: Prisma schema'ya İŞKUR credential alanları ekle
  - File: `prisma/schema.prisma`
  - Action: `customers` modeline `edevletSifre` satırının altına ekle:
    ```prisma
    // İŞKUR İşveren Sistemi
    iskurTckn                String?
    iskurSifre               String?
    ```
  - Action: `npx prisma migrate dev --name add-iskur-credentials` çalıştır
  - Action: `npx prisma generate` çalıştır

#### Katman 2: Backend API'ler

- [x] Task 2: Şifreler summary API'sine İŞKUR alanları ekle
  - File: `src/app/api/sifreler/summary/route.ts`
  - Action: `select` nesnesine (satır ~100 civarı, edevlet alanlarının altına) ekle:
    ```typescript
    // İŞKUR alanları
    iskurTckn: true,
    iskurSifre: true,
    ```
  - Action: `PasswordSummary` interface'ine `iskur` bloğu ekle:
    ```typescript
    iskur: {
      tckn: string | null;
      sifre: string | null;
      hasTckn: boolean;
      hasSifre: boolean;
    };
    ```
  - Action: Mapping fonksiyonuna (satır ~128) `iskur` bloğu ekle:
    ```typescript
    iskur: {
      tckn: safeDecrypt(c.iskurTckn),
      sifre: safeDecrypt(c.iskurSifre),
      hasTckn: !!c.iskurTckn,
      hasSifre: !!c.iskurSifre,
    },
    ```

- [x] Task 3: Credentials API'sine İŞKUR desteği ekle
  - File: `src/app/api/customers/[id]/credentials/route.ts`
  - Action: `credentialsUpdateSchema` Zod schema'ya ekle:
    ```typescript
    iskurTckn: z.string().refine(
      (val) => !val || isValidTCKN(val),
      { message: "Geçersiz T.C. Kimlik No" }
    ).optional(),
    iskurSifre: z.string().max(100).optional(),
    ```
  - Action: `type` field'ına `"iskur"` değerini kabul et
  - Action: Destructuring'e `iskurTckn, iskurSifre` ekle (satır ~140)
  - Action: `updateData` tipine ve mapping'ine ekle:
    ```typescript
    iskurTckn?: string | null;
    iskurSifre?: string | null;
    ```
    ```typescript
    if (iskurTckn !== undefined) {
      updateData.iskurTckn = iskurTckn ? encrypt(iskurTckn) : null;
    }
    if (iskurSifre !== undefined) {
      updateData.iskurSifre = iskurSifre ? encrypt(iskurSifre) : null;
    }
    ```

- [x] Task 4: Customer prefetch'e hasIskurCredentials ekle
  - File: `src/app/api/customers/route.ts`
  - Action: `fields=minimal` select'ine ekle (satır ~54 civarı):
    ```typescript
    iskurTckn: true,
    iskurSifre: true,
    ```
  - Action: `customersWithFlags` mapping'ine ekle (satır ~71 civarı):
    ```typescript
    hasIskurCredentials: !!(c.iskurTckn && c.iskurSifre),
    ```

- [x] Task 5: İŞKUR bot launch API endpoint'i oluştur
  - File: `src/app/api/bot/launch-iskur/route.ts` (NEW)
  - Action: `launch-edevlet/route.ts` referans alarak oluştur
  - Zod schema:
    ```typescript
    const launchRequestSchema = z.object({
      customerId: z.string().uuid(),
      loginMethod: z.enum(["iskur", "edevlet"]),
    });
    ```
  - Akış:
    1. Auth check (`getUserWithProfile`)
    2. Request body validate (`customerId` + `loginMethod`)
    3. Customer fetch (prisma, `tenantId` filtreli)
    4. `loginMethod === "iskur"` → `iskurTckn` + `iskurSifre` decrypt et
    5. `loginMethod === "edevlet"` → `edevletTckn` + `edevletSifre` decrypt et
    6. Credential yoksa hata kodu dön: `CUSTOMER_MISSING_ISKUR_CREDENTIALS` veya `CUSTOMER_MISSING_EDEVLET_CREDENTIALS`
    7. TCKN format validation
    8. Bot bağlantı kontrolü (`/_internal/clients`)
    9. Internal API signal: `type: "iskur:launch"`, `data: { tckn, password, loginMethod, customerName }`

#### Katman 3: Şifreler Sayfası (UI)

- [x] Task 6: Sidebar menüye İŞKUR tab ekle
  - File: `src/components/sifreler/sidebar-menu.tsx`
  - Action: `SidebarMenuProps` interface'inde `activeTab` union type'a `"iskur"` ekle
  - Action: `menuItems` array'ine SGK'dan sonra (index 2'ye) ekle:
    ```typescript
    {
      id: "iskur" as const,
      label: "İŞKUR İşveren Sistemi",
      description: "İŞKUR Portal Girişleri",
      icon: "solar:case-round-bold",
    },
    ```

- [x] Task 7: İŞKUR passwords table bileşeni oluştur
  - File: `src/components/sifreler/iskur-passwords-table.tsx` (NEW)
  - Action: `edevlet-passwords-table.tsx` klonla ve şu değişiklikleri yap:
    - `CustomerPasswordSummary` interface'inde `edevlet` yerine `iskur` bloğu kullan
    - Form state field'ları: `iskurTckn`, `iskurSifre`
    - Payload'da `type: "iskur"`
    - Başlık: "İŞKUR İşveren Sistemi Giriş Bilgileri"
    - Placeholder'lar: "T.C. Kimlik No girin", "İŞKUR şifresi girin"
    - İkon: `solar:case-round-bold`
    - getStatus: `customer.iskur.hasTckn && customer.iskur.hasSifre`

- [x] Task 8: Şifreler modülüne İŞKUR tab'ını entegre et
  - File: `src/components/sifreler/sifreler-module.tsx`
  - Action: Import ekle: `import { IskurPasswordsTable } from "./iskur-passwords-table";`
  - Action: `activeTab` state type'ına `"iskur"` ekle: `"gib" | "sgk" | "iskur" | "turmob" | "edevlet"`
  - Action: Render'a ekle (sgk ile turmob arası):
    ```tsx
    {activeTab === "iskur" && <IskurPasswordsTable />}
    ```

#### Katman 4: Dashboard (UI + Dialog)

- [x] Task 9: E-Devlet giriş logosunu kopyala
  - File: `public/images/edevlet-giris.png` (NEW)
  - Action: `C:\Users\msafa\Desktop\indir.png` dosyasını `public/images/edevlet-giris.png` olarak kopyala

- [x] Task 10: İŞKUR giriş dialog bileşeni oluştur
  - File: `src/components/dashboard/iskur-giris-dialog.tsx` (NEW)
  - Action: `vergi-levhasi-dialog.tsx` referans alarak oluştur
  - Props: `open`, `onOpenChange`, `customerId`, `customerName`, `hasIskurCredentials`, `hasEdevletCredentials`
  - State: `loginMethod: "iskur" | "edevlet"` (default: `"iskur"`), `loading`
  - UI yapısı:
    - DialogTitle: "İŞKUR İşveren Sistemi"
    - İki seçim kartı (border-2 ile selected state):
      - Kart 1: Users ikonu + "İŞKUR Bilgileriyle Bağlan" + "T.C. ve şifre ile giriş" açıklama
      - Kart 2: `<Image src="/images/edevlet-giris.png" />` logosu + "E-Devlet ile Bağlan" açıklama
    - "Bağlan" butonu (loading state'li)
    - "İptal" butonu
  - handleConnect fonksiyonu:
    1. Seçilen yönteme göre credential check: `hasIskurCredentials` veya `hasEdevletCredentials`
    2. Credential yoksa warning toast + return
    3. `POST /api/bot/launch-iskur` → `{ customerId, loginMethod }`
    4. Success: dialog kapat
    5. Error: hata koduna göre toast göster

- [x] Task 11: Quick actions panel'i güncelle
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action 1 - Import: `import { IskurGirisDialog } from "./iskur-giris-dialog";`
  - Action 2 - Customer interface'e ekle: `hasIskurCredentials?: boolean;`
  - Action 3 - `MUKELLEF_LINKS` array'ine ekle (edefter'den sonra veya uygun yere):
    ```typescript
    { id: "iskur", label: "İŞKUR İşveren Sistemi", icon: <Briefcase className="h-3 w-3 shrink-0" /> },
    ```
  - Action 4 - `DIGER_LINKS` array'inden İŞKUR satırını kaldır (satır 99)
  - Action 5 - State ekle:
    ```typescript
    const [iskurDialogOpen, setIskurDialogOpen] = useState(false);
    ```
  - Action 6 - `handleMukellefLink` fonksiyonuna İŞKUR handler ekle (vergi-levhasi pattern'i gibi):
    ```typescript
    else if (linkId === "iskur") {
      if (!selectedMukellefId) {
        toast.warning("Mükellef seçilmedi", {
          description: "Lütfen önce bir mükellef seçin.",
        });
        return;
      }
      setIskurDialogOpen(true);
    }
    ```
  - Action 7 - `handleDigerLink` fonksiyonundaki `linkLabels` objesinden `iskur` key'ini kaldır
  - Action 8 - Render'da VergiLevhasiDialog'un altına ekle:
    ```tsx
    {selectedMukellefId && selectedCustomer && (
      <IskurGirisDialog
        open={iskurDialogOpen}
        onOpenChange={setIskurDialogOpen}
        customerId={selectedMukellefId}
        customerName={selectedCustomer.kisaltma || selectedCustomer.unvan}
        hasIskurCredentials={selectedCustomer.hasIskurCredentials ?? false}
        hasEdevletCredentials={selectedCustomer.hasEdevletCredentials ?? false}
      />
    )}
    ```

#### Katman 5: Electron Bot

- [x] Task 12: İŞKUR Puppeteer launcher oluştur
  - File: `electron-bot/src/main/iskur-launcher.ts` (NEW)
  - Action: `edevlet-launcher.ts` referans alarak oluştur
  - Config:
    ```typescript
    const ISKUR_CONFIG = {
      URL: 'https://esube.iskur.gov.tr/',
      TIMEOUTS: { PAGE_LOAD: 30000, ELEMENT_WAIT: 10000, NAVIGATION_WAIT: 15000 },
      DELAYS: { FORM_READY: 500, BETWEEN_INPUTS: 100 },
      SELECTORS: {
        GIRIS_BUTTON: 'a[href="#modalIsverenGiris"]',
        TC_INPUT: '#ctl02_userLoginIsveren_ctlEmployerUserId',
        PASSWORD_INPUT: '#ctl02_userLoginIsveren_ctlEmployerPassword',
        ISVEREN_GIRIS_BUTTON: '#ctl02_userLoginIsveren_ctlEmployerFirmaAra',
        EDEVLET_BUTTON: '#ctl02_userLoginIsveren_ctlEDevletIleGirisIsveren',
        EDEVLET_TC_INPUT: 'input#tridField',
        EDEVLET_PASSWORD_INPUT: 'input#egpField',
      },
    };
    ```
  - Export 1: `launchIskurWithCredentials(options: IskurLaunchOptions): Promise<IskurLaunchResult>`
    - Akış: navigate → waitForSelector(GIRIS_BUTTON) → click → waitForSelector(TC_INPUT) → fill TC → fill password → click ISVEREN_GIRIS_BUTTON
  - Export 2: `launchIskurWithEdevlet(options: IskurLaunchOptions): Promise<IskurLaunchResult>`
    - Akış: navigate → waitForSelector(GIRIS_BUTTON) → click → waitForSelector(EDEVLET_BUTTON) → click → waitForNavigation(giris.turkiye.gov.tr) → waitForSelector(EDEVLET_TC_INPUT) → fill TC → fill password → kullanıcıya devret (giriş butonuna BASMA)
  - Interface'ler:
    ```typescript
    export interface IskurLaunchOptions {
      tckn: string;
      password: string;
      loginMethod: "iskur" | "edevlet";
      customerName?: string;
      onProgress: (status: string) => void;
    }
    export interface IskurLaunchResult {
      success: boolean;
      browserOpen?: boolean;
      error?: string;
    }
    ```
  - Puppeteer: headed browser, stealth plugin, `bringBrowserWindowToFront()` helper'ı `edevlet-launcher.ts`'den kopyala

- [x] Task 13: Electron bot'a İŞKUR command handler kaydet
  - File: `electron-bot/src/main/index.ts`
  - Action: `connectWebSocket()` fonksiyonu içinde, `edevlet:launch` handler'ının altına ekle:
    ```typescript
    wsClient.on('iskur:launch', async (data: BotCommandData) => {
      const loginMethod = data.loginMethod as 'iskur' | 'edevlet';
      const customerName = data.customerName as string | undefined;

      console.log(`[MAIN] 🏢 İŞKUR başlatılıyor (${loginMethod})...`);
      mainWindow?.webContents.send('bot:command', { type: 'iskur-launch-start', loginMethod, customerName });

      try {
        const { launchIskurWithCredentials, launchIskurWithEdevlet } = await import('./iskur-launcher');

        const launcher = loginMethod === 'iskur' ? launchIskurWithCredentials : launchIskurWithEdevlet;
        const result = await launcher({
          tckn: data.tckn as string,
          password: data.password as string,
          loginMethod,
          customerName,
          onProgress: (status: string) => {
            console.log(`[ISKUR-LAUNCHER] ${status}`);
            wsClient?.send('iskur:launch-progress', { status, customerName });
            mainWindow?.webContents.send('bot:command', { type: 'iskur-launch-progress', status });
          }
        });

        if (result.success) {
          wsClient?.send('iskur:launch-complete', { success: true, customerName });
          mainWindow?.webContents.send('bot:command', { type: 'iskur-launch-complete', success: true });
        } else {
          wsClient?.sendError(result.error || 'İŞKUR başlatılamadı');
        }
      } catch (e: any) {
        console.error('[MAIN] İŞKUR hatası:', e);
        wsClient?.sendError(e.message || 'İŞKUR hatası');
      }
    });
    ```

#### Katman 6: Temizlik

- [x] Task 14: Diğer İşlemler'den İŞKUR referanslarını temizle
  - File: `electron-bot/src/main/diger-islemler-launch.ts`
  - Action: Commented-out İŞKUR entry'yi tamamen kaldır (satır ~25-28)
  - File: `src/components/dashboard/quick-actions-panel.tsx`
  - Action: `handleDigerLink` içindeki `linkLabels` objesinden `'iskur': 'İŞKUR İşveren Sistemi'` satırını kaldır

### Acceptance Criteria

#### Happy Path

- [ ] AC-1: Given şifreler sayfası açıldığında, when İŞKUR tab'ına tıklandığında, then tüm aktif mükelleflerin İŞKUR credential durumları listelenir (T.C. Kimlik No + Şifre alanları).

- [ ] AC-2: Given bir mükelleflef için İŞKUR T.C. ve şifre girilip "Kaydet" basıldığında, when sayfa yenilendiğinde, then bilgiler korunmuş ve yeşil durum göstergesi aktif olur.

- [ ] AC-3: Given Dashboard'da "Mükellef ile Giriş" panelinde, when İŞKUR İşveren Sistemi linkine tıklandığında ve mükellef seçili ise, then İŞKUR giriş yöntemi seçim dialog'u açılır.

- [ ] AC-4: Given İŞKUR dialog'unda "İŞKUR Bilgileriyle Bağlan" seçilip "Bağlan" basıldığında ve mükellefin İŞKUR bilgileri varsa, then Electron bot esube.iskur.gov.tr açar, "Giriş" butonu tıklar, TC ve şifreyi doldurur ve "İşveren Giriş" butonuna tıklar.

- [ ] AC-5: Given İŞKUR dialog'unda "E-Devlet ile Bağlan" seçilip "Bağlan" basıldığında ve mükellefin e-Devlet bilgileri varsa, then Electron bot esube.iskur.gov.tr açar, "Giriş" tıklar, E-Devlet butonu tıklar, giris.turkiye.gov.tr'ye yönlendirmeyi bekler, TC ve şifreyi doldurur ve kullanıcıya devreir.

- [ ] AC-6: Given "Diğer İşlemler" paneli görüntülendiğinde, then İŞKUR İşveren Sistemi linki artık bu panelde yer almaz.

#### Error Handling

- [ ] AC-7: Given mükellef seçilmeden İŞKUR linkine tıklandığında, then "Mükellef seçilmedi" uyarı toast'u gösterilir.

- [ ] AC-8: Given İŞKUR yöntemi seçilip "Bağlan" basıldığında ama mükellefin İŞKUR bilgileri yoksa, then "Şifreler > İŞKUR İşveren Sistemi'nden bilgileri girin" uyarı toast'u gösterilir.

- [ ] AC-9: Given E-Devlet yöntemi seçilip "Bağlan" basıldığında ama mükellefin e-Devlet bilgileri yoksa, then "Şifreler > e-Devlet Kapısı'ndan bilgileri girin" uyarı toast'u gösterilir.

- [ ] AC-10: Given Electron bot bağlı değilken "Bağlan" basıldığında, then "SMMM Asistan Masaüstü Uygulamasını Çalıştırın" uyarı toast'u gösterilir.

#### Edge Cases

- [ ] AC-11: Given İŞKUR T.C. Kimlik No alanına geçersiz TCKN girildiğinde (11 hane olmayan veya algoritma geçmeyen), then API "Geçersiz T.C. Kimlik No" hatası döner.

- [ ] AC-12: Given şifreler sayfasında 100'den fazla mükellef varsa, when İŞKUR tab'ına geçildiğinde, then virtual scrolling aktif olur ve performans düşmez.

## Additional Context

### Dependencies

- Mevcut Electron bot altyapısı (WebSocket bağlantısı)
- Puppeteer + Stealth Plugin
- AES-256-GCM şifreleme (`src/lib/crypto.ts`)
- Prisma migration gerekecek (`npx prisma migrate dev --name add-iskur-credentials`)
- `indir.png` → `public/images/edevlet-giris.png` kopyalanacak

### Testing Strategy

- Manuel test: Dashboard'dan İŞKUR linkine tıklama → dialog açılması
- Manuel test: Şifreler sayfasından İŞKUR credentials kaydetme/görüntüleme
- Manuel test: İŞKUR bilgileriyle giriş bot akışı (esube.iskur.gov.tr → form doldur → giriş)
- Manuel test: E-Devlet ile İŞKUR giriş bot akışı (esube.iskur.gov.tr → E-Devlet butonu → giris.turkiye.gov.tr → form doldur)
- Manuel test: Credential eksikliği durumlarında doğru uyarı mesajları
- Manuel test: İŞKUR credentials olmadan İŞKUR yöntemi seçme → warning toast
- Manuel test: E-Devlet credentials olmadan E-Devlet yöntemi seçme → warning toast

### Notes

- İŞKUR İşveren Giriş Selectors (esube.iskur.gov.tr):
  - Giriş Modal Trigger: `a[href="#modalIsverenGiris"]`
  - TC Input: `#ctl02_userLoginIsveren_ctlEmployerUserId`
  - Şifre Input: `#ctl02_userLoginIsveren_ctlEmployerPassword`
  - İşveren Giriş Butonu: `#ctl02_userLoginIsveren_ctlEmployerFirmaAra`
  - E-Devlet Butonu: `#ctl02_userLoginIsveren_ctlEDevletIleGirisIsveren`
- E-Devlet Giriş Selectors (giris.turkiye.gov.tr):
  - TC Input: `input#tridField`
  - Şifre Input: `input#egpField`
  - Giriş Butonu: `button[name="submitButton"]`
- E-Devlet ile Giriş butonu için `indir.png` logosu kullanılacak (`public/images/edevlet-giris.png` olarak kopyalanacak)
- E-Devlet ile giriş akışında İŞKUR sitesinden E-Devlet'e yönlendirme olduğu için `page.waitForNavigation()` ile URL değişimini kontrol et
- Electron bot handler kayıt yeri: `electron-bot/src/main/index.ts` → `connectWebSocket()` fonksiyonu içinde `wsClient.on('iskur:launch', ...)` olarak eklenecek
- Progress reporting: `wsClient.send('iskur:launch-progress', { status, customerName })` + `wsClient.send('iskur:launch-complete', { success, customerName })`
- `DIGER_LINKS`'ten İŞKUR satırını kaldır, `diger-islemler-launch.ts`'deki commented-out İŞKUR entry de temizlenebilir

## Review Notes
- Adversarial review completed (10 findings)
- Findings: 10 total, 1 fixed, 9 skipped (noise/mevcut pattern)
- Resolution approach: auto-fix
- F1 (CRITICAL): TCKN log'dan kaldırıldı - FIXED
- F2-F10: Mevcut mimari pattern ile uyumlu, bu scope dışında - SKIPPED
