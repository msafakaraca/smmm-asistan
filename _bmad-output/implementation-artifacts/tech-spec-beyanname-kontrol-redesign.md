---
title: 'Beyanname Kontrol Sayfa Yeniden Tasarımı'
slug: 'beyanname-kontrol-redesign'
created: '2026-03-01'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4, 5]
tech_stack:
  - Next.js 15
  - React 19
  - TypeScript 5.7
  - TailwindCSS 4
  - Radix UI (Collapsible - YENİ KURULACAK)
  - Lucide Icons (mevcut)
  - Iconify (kaldırılacak - bu sayfa kapsamında)
files_to_modify:
  - src/components/beyanname-kontrol/smmm-asistan-page.tsx (YENİDEN YAZILACAK)
  - src/components/beyanname-kontrol/bot-control-panel.tsx (REFACTOR - ikiye bölünecek)
  - src/components/beyanname-kontrol/bot-progress-area.tsx (YENİ DOSYA)
  - src/components/ui/collapsible.tsx (YENİ DOSYA)
  - src/components/beyanname-kontrol/tabs/bulunan-tab.tsx (GÜNCELLEME - Iconify→Lucide)
  - src/components/beyanname-kontrol/tabs/eslesmeyenler-tab.tsx (GÜNCELLEME - Iconify→Lucide)
  - src/components/beyanname-kontrol/tabs/taramalar-tab.tsx (GÜNCELLEME - Iconify→Lucide)
  - src/components/beyanname-kontrol/bot-terminal-panel.tsx (SİLİNECEK)
code_patterns:
  - Tek kolon layout (flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto)
  - Collapsible sections (Radix Collapsible + ChevronDown rotate animation)
  - Inline progress (div role=progressbar + width transition)
  - Step list (ul aria-label + durum bazlı ikon/renk)
  - Badge composition (Badge variant=secondary filtre chip'leri)
  - State-based adaptive UI (syncStatus → idle/running/success/error)
  - Controlled component pattern (tüm state parent'ta)
  - React.memo + useCallback optimizasyon
  - Dynamic import (BotReportModal)
test_patterns:
  - Manuel test (state geçişleri)
  - Responsive viewport testi
  - Dark mode renk testi
  - Keyboard navigasyon testi
---

# Tech-Spec: Beyanname Kontrol Sayfa Yeniden Tasarımı

**Created:** 2026-03-01

## Overview

### Problem Statement

Mevcut `SmmmAsistanPage` split-panel (2fr/1fr grid) + Mac-style terminal UI + 5 sekmeli yapısı kullanıyor. Bu tasarım mali müşavirlerin sadelik beklentisini karşılamıyor: terminal UI teknik ve yabancı görünüyor, sekmeler bağlam kaybına yol açıyor, split panel ekranı gereksiz bölerek karmaşıklık yaratıyor.

### Solution

Terminal UI kaldırılıp, beyanname sorgulama sayfası (`beyanname-client.tsx`) referans alınarak tek kolon layout + minimal inline progress (progress bar + step list) + collapsible section'lar ile yeniden tasarlanacak. Tüm mevcut fonksiyonellik (bot ayarları, filtreler, sonuçlar) korunacak, sadece sunum şekli değişecek.

### Scope

**In Scope:**
- `SmmmAsistanPage` yeniden yazılması — tek kolon, durum bazlı adaptive layout
- `BotControlPanel` refactoring → temel ayarlar (GİB bilgileri + tarih aralığı, her zaman görünür) + gelişmiş seçenekler (VKN, tür, dönem, indirme — collapsible)
- `BotProgressArea` yeni component — progress bar + step list + collapsible log
- `@radix-ui/react-collapsible` kurulumu + `ui/collapsible.tsx` oluşturulması
- `BotTerminalPanel` kaldırılması (sadece SmmmAsistanPage tarafından kullanılıyor)
- Tab bileşenlerinde Iconify → Lucide Icons geçişi
- Filtre özet chip'leri, GİB status badge, özet kartı (inline JSX composition)

**Out of Scope:**
- `kontrol-page.tsx` (takip çizelgesi sayfası) — dokunulmayacak
- `TerminalContext` — orphan DEĞİL, 4 dosya hâlâ kullanıyor, ayrı temizlik görevi
- Backend API değişiklikleri — yok
- `useBotConnection` hook — korunacak, interface değişmeyecek
- `BotLogContext`, `BotResultContext` — korunacak
- `BotReportModal` — korunacak

## Context for Development

### Codebase Patterns

**Layout & Styling:**
- Referans sayfa `flex flex-col gap-6 p-4 md:p-6` kullanıyor — aynı pattern
- `max-w-4xl mx-auto` ile container genişliği sınırlanacak (UX spec)
- Card'lar: `rounded-lg border bg-card p-4 shadow-sm`
- Dark mode: tüm durum renkleri `dark:` variant'lı

**State Yönetimi:**
- `useBotConnection` hook → `syncStatus`, `beyannameler`, `unmatchedDeclarations`, `startBot`, `stopBot`
- `syncStatus` tipi: `"idle" | "running" | "success" | "error"` (SyncStatus type'ı `kontrol/types.ts`'den)
- Tüm filtre state'leri parent'ta (`useState`) — `BotControlPanel`'e prop olarak geçiliyor
- `BotLogContext` → `logs: BotLogEntry[]`, `botStatus`, `electronConnected`, `isBotRunning`
- `BotLogEntry` tipi: `{ id, timestamp, type: 'progress'|'success'|'error'|'warning'|'batch', message, details?, progress? }`
- `BotResultContext` → `pendingResult`, `consumeResult()` (cross-page persistence, 30dk TTL)
- Scan history → `localStorage` (max 5 kayıt, `SMMM_SCAN_HISTORY_KEY`)

**BotControlPanel Mevcut Yapısı (464 satır):**
- Tamamen controlled component — tüm state parent'tan geliyor (25+ prop)
- `React.memo` ile wrap edilmiş
- Bölümler (yukarıdan aşağı):
  1. GİB Giriş Bilgileri (gibCode, gibPassword, gibParola, hasCredentials)
  2. Tarih Aralığı (startDate, endDate — DatePickerInput)
  3. Mükellef Filtresi (vergiNo, tcKimlikNo — Input, mutual exclusion)
  4. Beyanname Türü Filtresi (checkbox + select, 12 tür)
  5. Dönem Filtresi (checkbox + başlangıç/bitiş ay+yıl select)
  6. İndirme Seçeneği (checkbox)
  7. Başlat/Durdur Butonu (syncStatus'e göre)
- UX spec'e göre bölünme:
  - **Temel (her zaman görünür):** GİB bilgileri + Tarih Aralığı
  - **Gelişmiş Seçenekler (collapsible):** Mükellef, Tür, Dönem, İndirme
  - **Başlat/Durdur:** Üst seviyeye çıkacak (BotControlPanel'den alınacak)

**Tab Bileşenleri (korunacak, collapsible'a dönüşecek):**
- `BulunanTab` — beyannameler tablosu (max 100 satır gösteriyor), boş durum mesajı
- `EslesmeyenlerTab` — amber uyarı + tablo, boş durum mesajı
- `TaramalarTab` — tarih + stat kartları listesi, boş durum mesajı
- Hepsi `React.memo` ile wrap edilmiş, Iconify kullanıyor

**Bot Connection Akışı:**
1. `startBot(params)` → `POST /api/gib/sync` → SSE stream veya delegated mod
2. SSE stream: `data.percent`, `data.message` → `addLog()` → BotLogContext
3. Delegated mod: `data.delegated: true` → GlobalBotListener WS dinliyor → `bot:complete`
4. Tamamlanma: `data.complete` → `setBeyannameler()`, `setPendingResult()`, `onComplete()`
5. Stop: `POST /api/gib/stop` + UI state reset + `stopBotContext()`

### Files to Reference

| File | Purpose | Satır |
| ---- | ------- | ----- |
| `src/components/beyanname-kontrol/smmm-asistan-page.tsx` | Mevcut sayfa — yeniden yazılacak | 455 |
| `src/components/beyanname-kontrol/bot-control-panel.tsx` | Ayar paneli — bölünecek | 464 |
| `src/components/beyanname-kontrol/bot-terminal-panel.tsx` | Terminal — silinecek | ~100 |
| `src/components/beyanname-kontrol/tabs/bulunan-tab.tsx` | Bulunan tablo — collapsible'a sarılacak | 80 |
| `src/components/beyanname-kontrol/tabs/eslesmeyenler-tab.tsx` | Eşleşmeyenler — collapsible'a sarılacak | 71 |
| `src/components/beyanname-kontrol/tabs/taramalar-tab.tsx` | Tarama geçmişi — collapsible'a sarılacak | 123 |
| `src/components/kontrol/hooks/use-bot-connection.ts` | Bot hook — korunacak | 234 |
| `src/context/bot-log-context.tsx` | Log context — BotProgressArea tüketecek | 166 |
| `src/context/bot-result-context.tsx` | Sonuç persistence — korunacak | ~50 |
| `src/components/beyannameler/beyanname-client.tsx` | Referans sayfa — layout + progress pattern | ~400 |
| `src/components/kontrol/types.ts` | SyncStatus, BeyannameData, BotInfo type'ları | ~30 |

### Technical Decisions

| Karar | Gerekçe | Alternatif |
|-------|---------|-----------|
| Radix Collapsible | Projede zaten Radix kullanılıyor, shadcn/ui pattern ile tutarlı | HTML `<details>` — daha basit ama animation/kontrol yok |
| Lucide Icons | Referans sayfa ile tutarlı, tree-shakeable | Iconify devam — tutarsızlık, büyük bundle |
| BotControlPanel refactor | UX spec: temel/gelişmiş ayırımı gerekiyor | Wrapper composition — prop drilling karmaşıklığı artar |
| Tab → Collapsible dönüşüm | UX spec: tek akış, sekme yok | Tab yapısını korumak — UX spec'e aykırı |
| Progress bar + Step list | Referans sayfadaki çoklu yıl progress pattern'i | Terminal UI — UX spec tarafından reddedildi |
| Başlat/Durdur butonu üst seviyede | UX spec: scroll gerekmeden erişilebilir | BotControlPanel içinde — mevcut sorun |
| TerminalContext kaldırılmayacak | 4 dosya hâlâ kullanıyor — scope dışı, ayrı temizlik görevi | Kaldırmak — diğer sayfalar bozulur |

## Implementation Plan

### Tasks

#### Görev 1: Radix Collapsible kurulumu + `ui/collapsible.tsx` oluşturma
- **Dosya:** `src/components/ui/collapsible.tsx` (YENİ)
- **Aksiyon:**
  - `npm install @radix-ui/react-collapsible` çalıştır
  - shadcn/ui pattern ile `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` bileşenlerini export eden wrapper dosyasını oluştur
  - Radix primitive'lerini re-export et (shadcn/ui'daki diğer bileşenlerle aynı pattern)
- **Notlar:** `src/components/ui/accordion.tsx` veya benzeri bir dosya varsa pattern'ini referans al. Yoksa Radix'in standart re-export pattern'ini kullan:
  ```typescript
  import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
  const Collapsible = CollapsiblePrimitive.Root
  const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
  const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent
  export { Collapsible, CollapsibleTrigger, CollapsibleContent }
  ```

#### Görev 2: `BotProgressArea` component oluşturma
- **Dosya:** `src/components/beyanname-kontrol/bot-progress-area.tsx` (YENİ)
- **Aksiyon:** UX spec'teki progress area tasarımını implement et:
  - `useBotLog()` context'ini tüket — `logs`, `botStatus`, `isBotRunning` oku
  - Progress bar: `div role="progressbar"` + `aria-valuenow` + `aria-valuemin=0` + `aria-valuemax=100` + `aria-label`
  - Progress bar genişliği: `style={{ width: \`${progress}%\` }}` + `transition-all duration-300`
  - Renk: running → mavi (`bg-blue-500`), completed → yeşil (`bg-green-500`), error → kırmızı (`bg-red-500`)
  - Step list: 4 sabit adım — "GİB'e bağlanıldı", "Beyannameler sorgulanıyor", "Eşleştirme yapılıyor", "Tamamlanıyor"
  - Her adım durumu: `done` (✓ yeşil), `running` (Loader2 spin mavi), `pending` (○ gri), `error` (✕ kırmızı)
  - Step durum logic'i: `logs` dizisinden son log mesajına ve `progress` değerine göre hesapla
  - Collapsible detaylı log alanı: varsayılan kapalı, `useBotLog().logs` dizisini monospace text olarak göster
  - `React.memo` ile wrap et
- **Props interface:**
  ```typescript
  interface BotProgressAreaProps {
    progress: number       // 0-100 (logs dizisindeki son progress değeri)
    syncStatus: SyncStatus // 'idle' | 'running' | 'success' | 'error'
  }
  ```
- **Notlar:**
  - `progress` değeri `useBotLog().logs` dizisindeki son `progress` değerli log entry'den alınacak — parent bunu hesaplayıp prop olarak geçecek
  - Step durumlarını log mesajlarından derive et: "bağlanılıyor" → step 1 running, "sorgulanıyor" → step 2 running, vb.
  - `beyanname-client.tsx`'teki çoklu yıl progress pattern'ini referans al

#### Görev 3: `BotControlPanel` refactoring — ikiye bölme
- **Dosya:** `src/components/beyanname-kontrol/bot-control-panel.tsx` (DÜZENLEME)
- **Aksiyon:** Mevcut tek component'i iki bölüme ayır:
  - **`BotBasicSettings`** (export) — GİB bilgileri gösterimi + Tarih aralığı. Her zaman görünür.
    - GİB bilgileri tanımlıysa: tek satır `"GİB: Kaydedildi ✓"` + `"Ayarları Düzenle →"` link (UX spec)
    - GİB bilgileri eksikse: amber uyarı banner (mevcut pattern korunacak)
    - Tarih aralığı: başlangıç/bitiş DatePickerInput (mevcut JSX korunacak)
    - Props: `gibCode`, `gibPassword`, `gibParola`, `hasCredentials`, `startDate`, `setStartDate`, `endDate`, `setEndDate`, `isRunning`
  - **`BotAdvancedSettings`** (export) — Mükellef filtresi + Beyanname türü + Dönem + İndirme. Collapsible içinde.
    - Mevcut JSX bölümleri korunacak (Mükellef filtresi, Beyanname türü, Dönem, İndirme checkbox)
    - Props: kalan tüm filtre prop'ları + `isRunning`
  - **Başlat/Durdur butonu** bu component'ten çıkarılacak — `SmmmAsistanPage`'de üst seviyede render edilecek
  - Iconify import'larını Lucide Icons ile değiştir:
    - `solar:lock-password-bold` → `KeyRound`
    - `solar:calendar-bold` → `Calendar`
    - `solar:user-id-bold` → `UserSearch`
    - `solar:danger-triangle-bold` → `AlertTriangle`
    - `solar:refresh-bold` → `RefreshCw`
    - `solar:stop-bold` → `Square`
  - `React.memo` her iki component'te de korunsun
  - `beyannameSecenekleri` dizisi ve `aylar` dizisi dosyada kalsın
- **Notlar:** `BotControlPanelProps` interface'ini kaldır, yerine `BotBasicSettingsProps` ve `BotAdvancedSettingsProps` oluştur. Aynı dosyada iki export.

#### Görev 4: Tab bileşenlerinde Iconify → Lucide Icons geçişi
- **Dosya:** `src/components/beyanname-kontrol/tabs/bulunan-tab.tsx`
- **Aksiyon:**
  - `import { Icon } from "@iconify/react"` → `import { FileText } from "lucide-react"`
  - `<Icon icon="solar:document-text-bold-duotone" className="h-12 w-12 ..." />` → `<FileText className="h-12 w-12 ..." />`
- **Dosya:** `src/components/beyanname-kontrol/tabs/eslesmeyenler-tab.tsx`
- **Aksiyon:**
  - `import { Icon } from "@iconify/react"` → `import { CheckCircle2, AlertTriangle } from "lucide-react"`
  - `<Icon icon="solar:check-circle-bold-duotone" ...` → `<CheckCircle2 ...`
  - `<Icon icon="solar:danger-triangle-bold" ...` → `<AlertTriangle ...`
- **Dosya:** `src/components/beyanname-kontrol/tabs/taramalar-tab.tsx`
- **Aksiyon:**
  - `import { Icon } from "@iconify/react"` → `import { History, CheckCircle2, XCircle, Calendar, FileText, Download, Clock } from "lucide-react"`
  - Her `<Icon icon="solar:..." ...` → karşılık gelen Lucide component
    - `solar:history-bold-duotone` → `History`
    - `solar:check-circle-bold` → `CheckCircle2`
    - `solar:close-circle-bold` → `XCircle`
    - `solar:calendar-bold` → `Calendar`
    - `solar:document-text-bold` → `FileText`
    - `solar:download-bold` → `Download`
    - `solar:clock-circle-bold` → `Clock`

#### Görev 5: `SmmmAsistanPage` yeniden yazma
- **Dosya:** `src/components/beyanname-kontrol/smmm-asistan-page.tsx` (YENİDEN YAZILACAK)
- **Aksiyon:** Mevcut 455 satırlık dosyayı UX spec'e göre tek kolon layout ile yeniden yaz.
- **Korunacak logic (mevcut dosyadan):**
  - Tüm `useState` tanımları (filtre state'leri, botInfo, gibCode/Password/Parola, scanHistory)
  - `useEffect` → botInfo fetch (`/api/settings/gib`)
  - `useEffect` → scanHistory `localStorage` load
  - `useEffect` → `consumeResult()` pending check
  - `useBotConnection` hook çağrısı (`onComplete`, `onError` callback'leri)
  - `handleSync`, `handleStopBot`, `handleReportClose`, `handleAddCustomer` handler'ları
  - `LastScanInfo` interface, `loadScanHistory`, `saveScanToHistory` yardımcı fonksiyonları
  - `BotReportModal` dynamic import
  - `AddCustomerDialog` import
- **Kaldırılacak:**
  - `import { BotTerminalPanel }` — silinecek
  - `import { Tabs, TabsContent, TabsList, TabsTrigger }` — silinecek
  - `import { Icon } from "@iconify/react"` — Lucide Icons ile değiştirilecek
  - Split-panel grid layout (`grid grid-cols-1 lg:grid-cols-[2fr_1fr]`)
  - 5 sekmeli Tabs yapısı
  - Ayarlar sekmesi içindeki GİB bilgileri + hızlı bağlantılar (BotBasicSettings'e taşındı)
- **Yeni JSX yapısı (UX spec wireframe'lerine göre):**
  ```
  <div className="flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto">
    {/* 1. Header + Status Badge */}
    Header: "Beyanname Kontrol" başlığı + syncStatus badge (Lucide Icons ile)
    Badge renkleri: idle→gri, running→mavi+Loader2, success→yeşil+Check, error→kırmızı+AlertCircle

    {/* 2. GİB Bilgileri + Tarih (her zaman görünür, running'de daraltılmış) */}
    {syncStatus !== 'running' && syncStatus !== 'success' ? (
      <BotBasicSettings ... />  // Tam görünüm
    ) : (
      // Daraltılmış özet: "GİB ✓ · Tarih: 01.02—01.03"
      <div>özet satır</div>
    )}

    {/* 3. Gelişmiş Seçenekler (collapsible, running/success'te gizli) */}
    {syncStatus === 'idle' || syncStatus === 'error' ? (
      <Collapsible>
        <CollapsibleTrigger>"Gelişmiş Seçenekler" + ChevronDown</CollapsibleTrigger>
        <CollapsibleContent>
          <BotAdvancedSettings ... />
        </CollapsibleContent>
      </Collapsible>
    ) : null}

    {/* 4. Filtre Özet Chip'leri */}
    Badge'ler: tarih aralığı · mükellef filtresi · beyanname türü · indirme durumu

    {/* 5. Başlat/Durdur Butonu (üst seviye) */}
    running → "Botu Durdur" (destructive, lg, w-full)
    idle/error → "Senkronizasyonu Başlat" (primary, lg, w-full, disabled=!hasCredentials)
    success → "Yeni Tarama Başlat" (primary, lg, w-full)

    {/* 6. Hata Banner (syncStatus === 'error') */}
    Alert role="alert": hata mesajı + "Tekrar Dene" butonu

    {/* 7. Progress Area (running/success/error'da görünür) */}
    {syncStatus !== 'idle' && <BotProgressArea progress={currentProgress} syncStatus={syncStatus} />}

    {/* 8. Özet Kartı (success'te görünür) */}
    3'lü grid: Bulundu (mavi) / Eşleşti (yeşil) / Eşleşmedi (amber) + süre
    role="status" aria-live="polite"

    {/* 9. Bulunan Beyannameler (collapsible, success'te otomatik açık) */}
    {beyannameler.length > 0 && (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>"Bulunan Beyannameler ({count})" + Badge + ChevronDown</CollapsibleTrigger>
        <CollapsibleContent><BulunanTab ... /></CollapsibleContent>
      </Collapsible>
    )}

    {/* 10. Eşleşmeyenler (collapsible, varsa amber badge ile dikkat çekici) */}
    {unmatchedDeclarations.length > 0 && (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>"Eşleşmeyenler ({count})" + amber Badge + ChevronDown</CollapsibleTrigger>
        <CollapsibleContent>
          <EslesmeyenlerTab ... />
          <Button variant="outline" onClick={() => setShowAddModal(true)}>Mükellef Ekle</Button>
        </CollapsibleContent>
      </Collapsible>
    )}

    {/* 11. Son Taramalar (collapsible, varsayılan kapalı) */}
    {scanHistory.length > 0 && (
      <Collapsible>
        <CollapsibleTrigger>"Son Taramalar ({count})" + Badge + ChevronDown</CollapsibleTrigger>
        <CollapsibleContent><TaramalarTab ... /></CollapsibleContent>
      </Collapsible>
    )}

    {/* Modallar */}
    <BotReportModal ... />
    <AddCustomerDialog ... />
  </div>
  ```
- **Yeni import'lar:**
  - `import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"`
  - `import { BotProgressArea } from "./bot-progress-area"`
  - `import { BotBasicSettings, BotAdvancedSettings } from "./bot-control-panel"`
  - `import { Check, Loader2, AlertCircle, Bot, ChevronDown, Play, Square, RefreshCw, Settings } from "lucide-react"`
  - `import { useBotLog } from "@/context/bot-log-context"` (progress hesaplama için)
- **currentProgress hesaplama:**
  ```typescript
  const { logs } = useBotLog()
  const currentProgress = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].progress !== undefined) return logs[i].progress!
    }
    return 0
  }, [logs])
  ```
- **Filtre özet chip'leri hesaplama:**
  ```typescript
  const filterChips = useMemo(() => {
    const chips: string[] = []
    // Tarih aralığı
    chips.push(`${new Date(startDate).toLocaleDateString('tr-TR')} — ${new Date(endDate).toLocaleDateString('tr-TR')}`)
    // Mükellef
    if (vergiNo) chips.push(`VKN: ${vergiNo}`)
    else if (tcKimlikNo) chips.push(`TC: ${tcKimlikNo}`)
    else chips.push('Tüm mükellefler')
    // Beyanname türü
    if (useBeyannameTuruFilter) chips.push(selectedBeyannameTuru)
    else chips.push('Tüm türler')
    // İndirme
    chips.push(shouldDownloadFiles ? 'İndirme: Açık' : 'İndirme: Kapalı')
    return chips
  }, [startDate, endDate, vergiNo, tcKimlikNo, useBeyannameTuruFilter, selectedBeyannameTuru, shouldDownloadFiles])
  ```

#### Görev 6: `BotTerminalPanel` dosyasını sil
- **Dosya:** `src/components/beyanname-kontrol/bot-terminal-panel.tsx` (SİLİNECEK)
- **Aksiyon:** Dosyayı sil. Sadece `smmm-asistan-page.tsx` tarafından import ediliyordu, Görev 5'te bu import kaldırıldı.
- **Notlar:** Silmeden önce başka import olmadığını `grep` ile doğrula.

### Acceptance Criteria

- [ ] AC 1: Given sayfa ilk yüklendiğinde, when GİB bilgileri tanımlıysa, then "GİB: Kaydedildi ✓" tek satır gösterilir ve tarih aralığı önceki ayın 1'i — bugün olarak ayarlıdır
- [ ] AC 2: Given sayfa ilk yüklendiğinde, when GİB bilgileri eksikse, then amber uyarı banner gösterilir ve "Senkronizasyonu Başlat" butonu disabled olur
- [ ] AC 3: Given idle durumda, when "Gelişmiş Seçenekler" tıklanır, then collapsible açılır ve VKN/TC, beyanname türü, dönem, indirme filtreleri görünür olur
- [ ] AC 4: Given idle durumda, when filtre ayarları değiştirilir, then filtre özet chip'leri (tarih aralığı, mükellef, tür, indirme) güncellenir
- [ ] AC 5: Given idle durumda ve GİB bilgileri tanımlı, when "Senkronizasyonu Başlat" tıklanır, then buton "Botu Durdur" (destructive) olur, progress area görünür olur, progress bar %0'dan başlar, ayarlar bölümü daraltılmış özete döner
- [ ] AC 6: Given running durumda, when bot ilerleme mesajları gelir (SSE/WS), then progress bar yüzde değeri güncellenir ve step list'te aktif adım Loader2 spinner ile gösterilir
- [ ] AC 7: Given running durumda, when "Botu Durdur" tıklanır, then bot durdurulur ve sayfa idle durumuna döner
- [ ] AC 8: Given bot başarıyla tamamlandığında, when sonuçlar gelir, then progress bar %100 yeşil olur, 3'lü özet kartı gösterilir (Bulundu/Eşleşti/Eşleşmedi + süre), "Bulunan Beyannameler" collapsible'ı otomatik açık render edilir
- [ ] AC 9: Given bot tamamlandığında, when eşleşmeyen beyanname varsa, then "Eşleşmeyenler" collapsible'ı amber badge ile açık gösterilir ve "Mükellef Ekle" butonu mevcut olur
- [ ] AC 10: Given bot hata ile tamamlandığında, when hata oluşur, then amber hata banner `role="alert"` ile gösterilir, "Tekrar Dene" butonu mevcut olur, progress step list'te hatalı adım kırmızı ✕ ile işaretlenir
- [ ] AC 11: Given success durumda, when "Yeni Tarama Başlat" tıklanır, then sayfa idle durumuna döner, önceki sonuçlar temizlenir, ayarlar tekrar görünür olur
- [ ] AC 12: Given bot tamamlandığında, when scan history güncellenir, then "Son Taramalar" collapsible'ında yeni kayıt görünür (max 5 kayıt, localStorage)
- [ ] AC 13: Given herhangi bir durumda, when sayfa dark mode'a geçer, then tüm durum renkleri (mavi/yeşil/amber/kırmızı) dark variant'ları ile doğru render edilir
- [ ] AC 14: Given herhangi bir durumda, when 768px viewport'ta görüntülenir, then layout kırılmaz, tüm elementler tek kolonda stack olur
- [ ] AC 15: Given herhangi bir durumda, when Tab tuşu ile navigasyon yapılır, then tüm interaktif elementlere (butonlar, collapsible trigger'lar, form elementleri) erişilebilir
- [ ] AC 16: Given delegated modda (Electron bot), when bot tamamlanır, then sonuçlar aynı şekilde gösterilir (SSE modundaki ile aynı UI davranışı)

## Additional Context

### Dependencies

- `@radix-ui/react-collapsible` — npm install gerekli (YENİ)
- Mevcut Radix UI bileşenleri: Button, Badge, Select, Input, Checkbox, Label, DatePickerInput, Alert
- Lucide Icons paketleri: `lucide-react` (zaten yüklü)
- `useBotConnection` hook interface'i değişmeyecek
- `BotLogContext` interface'i değişmeyecek — `useBotLog()` ile tüketim

### Testing Strategy

- **State geçişleri (manuel):** idle → running → completed → error, her geçişte UI bölümlerinin görünürlüğünü kontrol et (UX spec State Management tablosuna göre)
- **Delegated mod:** Electron Bot bağlantısı ile senkronizasyon testi
- **Responsive:** 1280px, 1024px, 768px viewport'larında layout kontrolü
- **Dark mode:** Tüm durum renkleri (mavi/yeşil/amber/kırmızı) dark variant'ta okunabilirlik
- **Keyboard:** Tab navigasyonu, Enter/Space ile collapsible aç/kapa, buton tetikleme
- **Accessibility:** `role="progressbar"` + `aria-valuenow`, step list `aria-label`, hata `role="alert"`, başarı `role="status"` + `aria-live="polite"`
- **Edge case'ler:**
  - GİB bilgileri eksik → başlat butonu disabled + uyarı banner
  - Bot yarıda kesildi → kısmi sonuçlar gösterilir
  - 0 beyanname bulundu → boş durum mesajı
  - Eşleşmeyen beyanname yok → eşleşmeyenler bölümü render edilmez
  - Sayfa yeniden yüklendiğinde running durumdaysa → BotLogContext localStorage'dan logları yükler

### Notes

- **UX spec referansı:** `_bmad-output/planning-artifacts/ux-design-specification.md` — wireframe'ler, renk sistemi, collapsible pattern, state management tablosu burada
- **UX handoff:** `_bmad-output/handoffs/2026-03-01-beyanname-kontrol-ux-redesign.md`
- `BotTerminalPanel` sadece `smmm-asistan-page.tsx` tarafından import ediliyor — güvenle silinebilir
- `TerminalContext` orphan DEĞİL — 4 dosya kullanıyor, kaldırılmayacak, ayrı temizlik görevi olarak planlandı
- Tab bileşenleri korunacak, collapsible section'lara sarılacak — render logic'leri değişmeyecek
- `Collapsible defaultOpen` prop'u: Radix Collapsible bunu destekler
- SmmmAsistanPage'deki `getStatusBadge()` fonksiyonu Iconify'dan Lucide'a geçirilecek
- Mevcut `LastScanInfo` interface, `loadScanHistory`, `saveScanToHistory` fonksiyonları aynen korunacak
- **Görev sırası kritik:** 1 → 2 → 3 → 4 → 5 → 6 (her görev bir öncekine bağımlı)
