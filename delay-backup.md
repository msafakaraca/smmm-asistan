# GIB Bot Delay Backup - 2026-01-19

Bu dosya, delay değişikliği öncesi mevcut süreleri içerir.

## Config DELAYS (electron-bot/src/main/bot.ts)

```typescript
DELAYS: {
    SHORT: 100,
    MEDIUM: 500,
    LONG: 1000,
    PAGE_LOAD: 1000,
    HUMAN_MIN: 50,
    HUMAN_MAX: 200,
    LIST_LOAD: 1000,
    BETWEEN_OPERATIONS: 300,
    BETWEEN_DOWNLOADS: 2300,      // ← Değişti: 2000
    PAGE_CHANGE: 500,             // ← Değişti: 1500
    COOKIES_WAIT: 500,
    GIB_MIN_WAIT: 200,
    PRE_CLICK_WAIT: 1500,         // ← Değişti: 1000
    POPUP_OPEN_WAIT: 3000,        // ← Değişti: 1500
    TAB_LOAD_WAIT: 2500,
    AFTER_DOWNLOAD_WAIT: 1500,
    BEFORE_TAHAKKUK: 1500,
    BEFORE_SGK_POPUP: 2000,       // ← Değişti: 1500
    PAGE_TRANSITION: 1500,
}
```

## Kod İçi Sabit Delay'ler

| Konum | Eski Değer | Açıklama |
|-------|------------|----------|
| bot.ts:836 | 400ms | İkon tıklaması sonrası |
| bot.ts:1045 | 400ms | MUHSGK ikon tıklaması sonrası |
| bot.ts:1430 | 500ms | Popup kapanma sonrası → 750ms |

## Toplam Bekleme Süreleri (Eski)

### Normal Beyanname (~5.4 saniye)
- Beyanname PDF: 400 + 2300 = 2700ms
- Tahakkuk PDF: 400 + 2300 = 2700ms

### MUHSGK Beyanname (~16.4 saniye)
- Beyanname PDF: 2700ms
- Tahakkuk PDF: 2700ms
- MUHSGK Popup açılma: 3000ms
- SGK Tahakkuk #1: 200 + 2300 = 2500ms
- SGK Tahakkuk #2: 200 + 2300 = 2500ms
- Hizmet Listesi: 200 + 2300 = 2500ms
- Popup kapanma: 500ms

---

## Yeni Değerler (2026-01-19)

```
PRE_CLICK_WAIT: 1500 → 1000
BETWEEN_DOWNLOADS: 2300 → 2000
PAGE_CHANGE: 500 → 1500
POPUP_OPEN_WAIT: 3000 → 1500
BEFORE_SGK_POPUP: 2000 → 1500
Popup kapanma (sabit): 500 → 750
```

### Yeni MUHSGK Süreleri (~12 saniye)
- Beyanname PDF: 2100ms
- Tahakkuk PDF: 2100ms
- MUHSGK Popup açılma: 1500ms
- SGK Tahakkuk #1: 2000ms
- SGK Tahakkuk #2: 2000ms
- Hizmet Listesi: 2000ms
- Popup kapanma: 750ms
