---
title: 'Canlı Bot Log Paneli'
slug: 'live-bot-log-panel'
created: '2026-01-30'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 15', 'React 19', 'TypeScript', 'TailwindCSS 4', 'Radix UI', 'WebSocket', 'localStorage']
files_to_modify: ['src/context/bot-log-context.tsx (new)', 'src/components/beyanname-kontrol/bot-log-panel.tsx (new)', 'src/components/beyanname-kontrol/beyanname-kontrol-page.tsx', 'src/components/dashboard/header.tsx', 'src/app/layout.tsx']
code_patterns: ['Context API + localStorage', 'React.memo', 'useCallback/useMemo', 'Radix ScrollArea', 'Radix Progress', 'Auto-scroll pattern']
test_patterns: ['Manuel test']
---

# Tech-Spec: Canlı Bot Log Paneli

**Created:** 2026-01-30

## Overview

### Problem Statement

GİB Bot çalışırken kullanıcılar detaylı ilerleme bilgisi göremiyorlar. Mevcut terminal popup'ı sadece basit mesajlar gösteriyor. Ayrıca sayfa değiştirildiğinde tüm loglar kayboluyor ve kullanıcı bota ne olduğunu takip edemiyor.

### Solution

1. `/dashboard/beyanname-kontrol` sayfasına Bot Ayarları kartının altına inline log paneli eklemek
2. `bot-log-context` ile logları localStorage'da persist etmek (sayfa değişse bile korunur)
3. Header'da "Bot çalışıyor" badge'i göstermek (başka sayfadayken)
4. Detaylı log formatı: Beyanname türü, mükellef adı, SGK bilgileri (işçi sayısı, gün, tutar)

### Scope

**In Scope:**
- Bot Ayarları kartı altına canlı log paneli (Card bileşeni)
- Detaylı log formatı: `✓ MUHSGK - ABC LTD ŞTİ - 5 işçi, 30 gün, 12.500 TL`
- `bot-log-context` ile localStorage persist
- Header'da "Bot çalışıyor" badge (tıklanınca beyanname-kontrol sayfasına yönlendirme)
- Bot tamamlandığında "Tamamlandı" mesajı
- Magic MCP ile modern log panel tasarımı

**Out of Scope:**
- Mevcut terminal popup'ı değiştirme/kaldırma
- Bot mantığı değişiklikleri
- Yeni WebSocket event'leri ekleme

## Context for Development

### Codebase Patterns

1. **Context API Pattern**:
   - `terminal-context.tsx`: useState + useCallback, showTerminal/hideTerminal/addLog pattern
   - `bot-result-context.tsx`: localStorage persist with TTL (30 min), consumeResult pattern

2. **Provider Hiyerarşisi**:
   ```
   RootLayout (src/app/layout.tsx)
   ├── ThemeProvider
   │   └── BotResultProvider (localStorage persist - root level) ← bot-log-context buraya
   │       └── ToastProviderWithGlobal
   │           └── DashboardLayout
   │               └── DashboardClientLayout
   │                   ├── SWRProvider
   │                   │   └── TerminalProvider
   │                   │       └── children
   │                   └── GlobalTerminal
   ```

3. **Component Patterns**:
   - `React.memo` kullanımı (DashboardHeader, vs.)
   - `useCallback` / `useMemo` optimizasyonları
   - Direct imports (barrel imports YASAK)

4. **UI Components**:
   - `ScrollArea` - Radix UI based (`@/components/ui/scroll-area`)
   - `Progress` - Radix UI based (`@/components/ui/progress`)
   - `Card` - Standart card pattern (`@/components/ui/card`)
   - `Badge` - Status badges (`@/components/ui/badge`)

5. **WebSocket Events** (from `use-bot-connection.ts`):
   - `bot:progress` → `{ message, progress }` - Genel ilerleme
   - `bot:batch-results` → `{ beyannameler[], stats }` - Her 10 mükellefde batch
   - `bot:complete` → `{ stats, beyannameler, unmatchedBeyannameler }` - Tamamlandı
   - `bot:error` → `{ error, errorCode, errorDetails, isCritical }` - Hata

6. **BeyannameData Tipi** (zengin veri):
   ```typescript
   {
     beyannameTuru: string;       // KDV1, KDV2, MUHSGK
     tcVkn: string;               // VKN/TCKN
     adSoyadUnvan: string;        // Mükellef adı
     vergiDairesi: string;
     vergilendirmeDonemi: string;
     sgkTahakkukParsed?: {        // SGK için parse edilmiş veri
       isciSayisi: number;
       gunSayisi: number;
       netTutar: number;
     };
     kdvTahakkukParsed?: {...};   // KDV1 için
     kdv2TahakkukParsed?: {...};  // KDV2 için
   }
   ```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/context/terminal-context.tsx` | Context pattern referansı |
| `src/context/bot-result-context.tsx` | localStorage persist pattern - KOPYALANACAK |
| `src/components/kontrol/hooks/use-bot-connection.ts` | WebSocket event handling - LOG KAYNAĞI |
| `src/components/beyanname-kontrol/beyanname-kontrol-page.tsx` | Ana sayfa - LOG PANEL EKLENECEK |
| `src/components/dashboard/header.tsx` | Header - BADGE EKLENECEK |
| `src/components/dashboard/client-layout.tsx` | Provider sarmalama referansı |
| `src/app/layout.tsx` | Root layout - BOT-LOG-CONTEXT EKLENECEK |
| `src/components/ui/scroll-area.tsx` | ScrollArea bileşeni |
| `src/components/ui/progress.tsx` | Progress bileşeni |
| `electron-bot/src/main/bot.ts` | Bot veri yapısı (BeyannameData tipi) |

### Technical Decisions

1. **Context Konumu**: `BotLogProvider` root layout'a eklenecek (`BotResultProvider` yanına) - tüm sayfalarda erişilebilir olmalı
2. **Log Entry Tipi**:
   ```typescript
   interface BotLogEntry {
     id: string;
     timestamp: string;
     type: 'progress' | 'success' | 'error' | 'warning' | 'batch';
     message: string;
     details?: {
       beyannameTuru?: string;
       mukellefAdi?: string;
       sgkInfo?: { isciSayisi: number; gunSayisi: number; netTutar: number };
       kdvInfo?: { ... };
     };
     progress?: number;
   }
   ```
3. **Max Log Count**: Son 500 log (performans için)
4. **TTL**: 2 saat (bot uzun sürebilir)
5. **Auto-scroll**: `useEffect` ile viewport scrollTop = scrollHeight
6. **Badge Konumu**: Header sağ tarafta, ThemeToggle'dan önce
7. **Log Formatı**:
   - Progress: `[10:30:45] 🔄 Sayfa 1/5 yükleniyor...`
   - Batch: `[10:30:50] ✓ MUHSGK - ABC LTD ŞTİ - 5 işçi, 30 gün, 12.500 TL`
   - Error: `[10:31:00] ❌ [GIB_SESSION_EXPIRED] GİB oturumu sona erdi`
   - Complete: `[10:35:00] ✅ Bot tamamlandı! 50 beyanname işlendi.`

## Implementation Plan

### Tasks

- [x] **Task 1: BotLogContext oluştur**
  - File: `src/context/bot-log-context.tsx` (NEW)
  - Action: Context + localStorage persist
  - Details:
    - `bot-result-context.tsx` pattern'ini kopyala
    - `BotLogEntry` interface tanımla
    - `addLog`, `clearLogs`, `setBotRunning` fonksiyonları
    - localStorage key: `smmm-bot-logs`
    - TTL: 2 saat
    - Max: 500 log

- [x] **Task 2: Root Layout'a provider ekle**
  - File: `src/app/layout.tsx`
  - Action: BotLogProvider import ve wrap
  - Details:
    - BotResultProvider yanına ekle
    - Import: `import { BotLogProvider } from "@/context/bot-log-context"`

- [x] **Task 3: BotLogPanel bileşeni oluştur**
  - File: `src/components/beyanname-kontrol/bot-log-panel.tsx` (NEW)
  - Action: Canlı log panel bileşeni
  - Details:
    - Card wrapper
    - Progress bar (Radix)
    - ScrollArea (Radix) - max-h-[400px]
    - Auto-scroll useEffect
    - Renk kodlu loglar (yeşil/kırmızı/sarı/mavi)
    - Timestamp + icon + message format
    - "Henüz log yok" empty state
    - "X log kaydı" footer

- [x] **Task 4: use-bot-connection hook'u güncelle**
  - File: `src/components/kontrol/hooks/use-bot-connection.ts`
  - Action: Bot log context'e log yaz
  - Details:
    - `useBotLog` hook import
    - `bot:progress` → addLog('progress', message)
    - `bot:batch-results` → her beyanname için addLog('batch', formatMessage)
    - `bot:complete` → addLog('success', 'Bot tamamlandı')
    - `bot:error` → addLog('error', errorMessage)
    - Bot başladığında `setBotRunning(true)`
    - Bot bittiğinde `setBotRunning(false)`

- [x] **Task 5: Beyanname-kontrol sayfasına panel ekle**
  - File: `src/components/beyanname-kontrol/beyanname-kontrol-page.tsx`
  - Action: BotLogPanel import ve ekle
  - Details:
    - Bot Ayarları Card'ından sonra ekle
    - Sadece bot çalışıyorsa VEYA loglar varsa göster
    - Import: `import { BotLogPanel } from "./bot-log-panel"`

- [x] **Task 6: Header'a bot badge ekle**
  - File: `src/components/dashboard/header.tsx`
  - Action: "Bot çalışıyor" badge ekle
  - Details:
    - `useBotLog` hook import
    - `isBotRunning` state kontrol
    - ThemeToggle'dan önce badge göster
    - Badge: spinning icon + "Bot Çalışıyor" text
    - Tıklanınca `/dashboard/beyanname-kontrol` sayfasına yönlendir
    - `next/link` kullan

### Acceptance Criteria

- [x] **AC1**: Given bot başlatıldığında, when beyanname-kontrol sayfasındayken, then Bot Ayarları altında log paneli görüntülenir
- [x] **AC2**: Given log paneli görüntülendiğinde, when loglar akarken, then her log satırında timestamp, ikon ve mesaj görülür
- [x] **AC3**: Given MUHSGK beyannamesi işlendiğinde, when log paneline yazıldığında, then `✓ MUHSGK - ABC LTD ŞTİ - 5 işçi, 30 gün, 12.500 TL` formatında görülür
- [x] **AC4**: Given bot çalışırken, when başka sayfaya gidildiğinde, then header'da "Bot Çalışıyor" badge'i görülür
- [x] **AC5**: Given header badge'i, when tıklandığında, then beyanname-kontrol sayfasına yönlendirilir
- [x] **AC6**: Given başka sayfadayken, when beyanname-kontrol sayfasına geri dönüldüğünde, then tüm loglar korunmuş olarak görülür
- [x] **AC7**: Given bot tamamlandığında, when log paneli incelendiğinde, then "Bot tamamlandı! X beyanname işlendi." mesajı görülür
- [x] **AC8**: Given hata oluştuğunda, when log panelinde gösterildiğinde, then kırmızı renkte ve hata kodu ile gösterilir

## Additional Context

### Dependencies

- `@/components/ui/card` - Card bileşeni (MEVCUT)
- `@/components/ui/badge` - Badge bileşeni (MEVCUT)
- `@/components/ui/scroll-area` - Scroll area (MEVCUT)
- `@/components/ui/progress` - Progress bar (MEVCUT)
- `lucide-react` - İkonlar (MEVCUT)
- `next/link` - Navigation (MEVCUT)

### Testing Strategy

**Manuel Test:**
1. Bot başlat, log panelinin göründüğünü doğrula
2. Detaylı log formatının doğru olduğunu kontrol et (beyanname türü, mükellef, SGK bilgileri)
3. Başka sayfaya git, header'da badge göründüğünü doğrula
4. Badge'e tıkla, beyanname-kontrol sayfasına yönlendirildiğini doğrula
5. Beyanname-kontrol sayfasına geri dön, logların korunduğunu doğrula
6. Bot tamamlandığında "Tamamlandı" mesajının göründüğünü doğrula
7. Hata durumunda kırmızı log göründüğünü doğrula
8. 500+ log oluştuğunda eski logların silindiğini doğrula

### Notes

- Mevcut `terminal-context` ve popup korunacak (paralel çalışacak)
- `use-bot-connection` hook'u hem terminal hem log context'e yazacak
- Header badge'i sadece bot çalışırken görünecek
- Log panel sadece bot çalışıyorsa VEYA loglar varsa görünecek (boş durumda gizli)

---

## Review Notes

- Adversarial review completed
- Findings: 5 total, 3 fixed, 2 skipped (noise)
- Resolution approach: auto-fix

### Fixed Issues:
- F1: Stale closure in setBotRunning - useEffect'e bırakıldı
- F2: Unused Bot import removed from header.tsx
- F5: Deprecated substr replaced with substring

### Skipped (noise):
- F3: Potential race condition (not an issue in single-threaded JS)
- F4: Empty state momentary flash (minor UX detail)
