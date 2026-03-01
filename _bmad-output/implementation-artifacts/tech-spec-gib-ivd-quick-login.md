---
title: 'GİB İnternet Vergi Dairesi Hızlı Giriş'
slug: 'gib-ivd-quick-login'
created: '2026-01-31'
completed: '2026-01-31'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
review_notes: |
  - Adversarial review tamamlandı (11 bulgu)
  - 9 "real" bulgu otomatik düzeltildi (F1-F9)
  - 2 "noise" bulgu atlandı (F10-F11)
  - Resolution approach: auto-fix
tech_stack: ['Playwright', 'Electron', 'WebSocket', 'Next.js API', 'TypeScript']
files_to_modify:
  - 'electron-bot/package.json'
  - 'electron-bot/src/main/ivd-launcher.ts'
  - 'electron-bot/src/main/index.ts'
  - 'src/app/api/bot/launch-ivd/route.ts'
  - 'src/components/dashboard/quick-actions-panel.tsx'
  - 'server.ts'
code_patterns: ['WebSocket event-based', 'Playwright headed browser', 'decrypt credentials']
test_patterns: ['Manual E2E']
---

# Tech-Spec: GİB İnternet Vergi Dairesi Hızlı Giriş

**Created:** 2026-01-31

## Overview

### Problem Statement

Mali müşavir her seferinde GİB Dijital Portal'a manuel giriş yapıp, captcha çözüp, ardından "İnternet Vergi Dairesi" uygulamasına geçiş yapmak zorunda kalıyor. Bu işlem her giriş için 1-2 dakika sürebiliyor ve tekrarlayan bir iş yükü oluşturuyor.

### Solution

Dashboard'daki "Meslek Mensubu ile Giriş" panelinde "Yeni İnternet Vergi Dairesi" linkine tıklandığında:
1. Electron Bot'a WebSocket üzerinden sinyal gönderilir
2. Playwright (headed mode) ile GİB portal login sayfası açılır
3. Kullanıcı adı ve şifre otomatik doldurulur
4. Captcha gösterilir ve kullanıcı manuel girer
5. Login sonrası otomatik olarak İVD'ye geçiş yapılır
6. Tarayıcı açık kalır, kontrol kullanıcıya bırakılır

### Scope

**In Scope:**
- "Meslek Mensubu ile Giriş" → "Yeni İnternet Vergi Dairesi" linki
- Playwright ile headed browser açma
- Otomatik form doldurma (userid, sifre)
- Manuel captcha girişi için bekleme
- İVD'ye otomatik geçiş (API ile token alıp redirect)
- Tarayıcı kontrolünü kullanıcıya bırakma

**Out of Scope:**
- Diğer hızlı işlem linkleri (E-Beyanname, E-Tebligat, vb.)
- Mükellef ile giriş işlemleri
- Otomatik captcha çözümü (2Captcha)
- Headless mode

## Context for Development

### Codebase Patterns

1. **WebSocket İletişim Pattern'i:**
   - Web App → `POST /api/bot/launch-ivd` → `/_internal/bot-command` → WebSocket broadcast
   - Electron `wsClient.on('gib:launch-ivd', handler)` ile dinler
   - Progress/Complete geri bildirim

2. **GİB Credentials Storage:**
   - `Tenants.gibSettings` JSON field
   - `gibCode` (VKN/TCKN), `gibPassword` (encrypted)
   - Decrypt için `decrypt()` fonksiyonu: `src/lib/crypto.ts`

3. **Mevcut Bot Pattern (bot.ts):**
   - HTTP API tabanlı, headless
   - `runElectronBot()` → e-beyanname için
   - **Dokunulmayacak** - yeni modül oluşturulacak

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/dashboard/quick-actions-panel.tsx` | Dashboard UI - mm-ivd linki |
| `electron-bot/src/main/index.ts` | Electron ana süreç - WebSocket handler |
| `electron-bot/src/main/ws-client.ts` | WebSocket client |
| `electron-bot/src/main/bot.ts` | Mevcut GİB bot (referans, dokunma) |
| `server.ts` | WebSocket server + `/_internal/bot-command` |
| `src/app/api/settings/gib/route.ts` | GİB ayarları API |
| `src/lib/crypto.ts` | `encrypt()` / `decrypt()` |

### Technical Decisions

1. **Ayrı Modül:** `ivd-launcher.ts` oluştur, `bot.ts`'e dokunma
2. **Playwright:** Puppeteer yerine - daha hızlı, modern, headed için ideal
3. **Manuel Captcha:** 2Captcha kullanılmayacak - kullanıcı kendisi girecek
4. **Browser Persist:** `browser.close()` çağrılmayacak - tarayıcı açık kalacak

## GİB API Bilgileri

### Base URL
`https://dijital.gib.gov.tr`

### Endpoints

#### 1. Login Sayfası
```
URL: https://dijital.gib.gov.tr/portal/login
```

#### 2. Captcha Al (API)
```
GET /apigateway/captcha/getnewcaptcha
Response: { cid: string, captchaImgBase64: string }
```

#### 3. Login (API)
```
POST /apigateway/auth/tdvd/login
Content-Type: application/json
Body: {
  "userid": "50500087",
  "sifre": "xxxxx",
  "dk": "captcha_solution",
  "imageId": "cid"
}
Response: { token: "xxx..." }
```

#### 4. İVD Geçiş (API)
```
GET /apigateway/auth/tdvd/intvrg-login
Authorization: Bearer {token}
Response: { redirectUrl: "https://ivd.gib.gov.tr/tvd_side/index.jsp?token=xxx&appName=tdvd" }
```

## Implementation Plan

### Tasks

#### Task 1: Playwright Dependency Ekle
- **File:** `electron-bot/package.json`
- **Action:** dependencies'e `playwright` ekle
- **Command:** `cd electron-bot && npm install playwright`

#### Task 2: IVD Launcher Modülü Oluştur
- **File:** `electron-bot/src/main/ivd-launcher.ts` (NEW)
- **Action:** Playwright ile IVD login akışını implement et

```typescript
// Exports:
export async function launchIvdBrowser(options: {
  userid: string;
  password: string;
  onProgress: (status: string) => void;
}): Promise<{ success: boolean; error?: string }>

// Akış:
// 1. Playwright chromium.launch({ headless: false })
// 2. page.goto('https://dijital.gib.gov.tr/portal/login')
// 3. userid ve sifre input'larını doldur
// 4. Captcha için bekle:
//    - page.waitForURL() ile URL değişimini dinle
//    - VEYA page.waitForSelector() ile dashboard elementi bekle
// 5. Login başarılı olunca:
//    - page.evaluate() ile fetch('/apigateway/auth/tdvd/intvrg-login')
//    - redirectUrl al
//    - page.goto(redirectUrl)
// 6. return { success: true }
// 7. browser.close() ÇAĞIRMA - açık kalsın
```

#### Task 3: GİB Config Güncelle
- **File:** `electron-bot/src/main/bot.ts`
- **Action:** `GIB_CONFIG.DIJITAL_GIB`'e IVD endpoint ekle

```typescript
DIJITAL_GIB: {
  // ... mevcut ...
  IVD_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/intvrg-login',
}
```

#### Task 4: WebSocket Handler Ekle
- **File:** `electron-bot/src/main/index.ts`
- **Action:** `gib:launch-ivd` event handler ekle

```typescript
wsClient.on('gib:launch-ivd', async (data: { userid: string; password: string }) => {
  console.log('[MAIN] 🌐 GİB İVD başlatılıyor...');

  mainWindow?.webContents.send('bot:command', { type: 'ivd-start' });

  const { launchIvdBrowser } = await import('./ivd-launcher');

  try {
    const result = await launchIvdBrowser({
      userid: data.userid,
      password: data.password,
      onProgress: (status) => {
        wsClient?.send('gib:ivd-progress', { status });
      }
    });

    if (result.success) {
      wsClient?.send('gib:ivd-complete', { success: true });
    } else {
      wsClient?.sendError(result.error || 'İVD başlatılamadı');
    }
  } catch (e: any) {
    wsClient?.sendError(e.message);
  }
});
```

#### Task 5: API Endpoint Oluştur
- **File:** `src/app/api/bot/launch-ivd/route.ts` (NEW)
- **Action:** Dashboard'dan bot'a sinyal göndermek için endpoint

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  // 2. Tenant'ın GİB credentials'ını al
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { gibSettings: true }
  });

  const gibSettings: any = tenant?.gibSettings || {};

  if (!gibSettings.gibCode || !gibSettings.gibPassword) {
    return NextResponse.json({
      error: "GİB giriş bilgileri ayarlardan girilmeli"
    }, { status: 400 });
  }

  // 3. Şifreleri decrypt et
  const userid = gibSettings.gibCode;
  const password = decrypt(gibSettings.gibPassword);

  // 4. Internal API ile bot'a sinyal gönder
  const port = process.env.PORT || '3000';
  await fetch(`http://localhost:${port}/_internal/bot-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      type: 'gib:launch-ivd',
      data: { userid, password }
    })
  });

  return NextResponse.json({ success: true, message: "İVD başlatılıyor..." });
}
```

#### Task 6: Dashboard UI Güncelle
- **File:** `src/components/dashboard/quick-actions-panel.tsx`
- **Action:** mm-ivd onClick handler ekle

```typescript
// QuickLinkItem bileşenini güncelle
function QuickLinkItem({ link, onLinkClick }: { link: QuickLink; onLinkClick?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onLinkClick?.(link.id)}
      className="flex items-center gap-1.5 ..."
    >
      {/* ... */}
    </button>
  );
}

// QuickActionsPanel içinde handler ekle
const handleMeslekMensubuLink = async (linkId: string) => {
  if (linkId === 'mm-ivd') {
    try {
      toast.loading("GİB İnternet Vergi Dairesi açılıyor...", { id: "ivd-launch" });

      const res = await fetch('/api/bot/launch-ivd', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        toast.success("Tarayıcı açılıyor, captcha'yı girin", { id: "ivd-launch" });
      } else {
        toast.error(data.error || "Hata oluştu", { id: "ivd-launch" });
      }
    } catch (e) {
      toast.error("Bağlantı hatası", { id: "ivd-launch" });
    }
  }
};

// MESLEK_MENSUBU_LINKS map'inde onLinkClick prop'u ekle
```

#### Task 7: Server WebSocket Handler (Opsiyonel)
- **File:** `server.ts`
- **Action:** `gib:ivd-complete` ve `gib:ivd-progress` mesajlarını relay et

```typescript
case 'gib:ivd-progress':
case 'gib:ivd-complete':
  broadcastToTenant(client.tenantId, message);
  break;
```

## Acceptance Criteria

### AC1: Link Tıklama
- **Given:** Kullanıcı dashboard'da, GİB credentials ayarlarda kayıtlı
- **When:** "Meslek Mensubu ile Giriş" → "Yeni İnternet Vergi Dairesi" tıklar
- **Then:** Toast "GİB İnternet Vergi Dairesi açılıyor..." gösterilir

### AC2: Tarayıcı Açılması
- **Given:** API çağrısı başarılı
- **When:** Electron bot sinyali alır
- **Then:** Playwright tarayıcı (headed) açılır ve `dijital.gib.gov.tr/portal/login` yüklenir

### AC3: Otomatik Form Doldurma
- **Given:** Tarayıcı login sayfasında
- **When:** Sayfa yüklenir
- **Then:** userid ve sifre alanları otomatik doldurulur, focus captcha'da

### AC4: Captcha Bekleme
- **Given:** Form doldurulmuş, captcha görünür
- **When:** Kullanıcı captcha'yı girer ve login'e tıklar
- **Then:** Bot URL değişimini algılar ve sonraki adıma geçer

### AC5: İVD Geçişi
- **Given:** Login başarılı, token mevcut
- **When:** Bot `/apigateway/auth/tdvd/intvrg-login` çağırır
- **Then:** `redirectUrl` alınır ve tarayıcı İVD sayfasına yönlendirilir

### AC6: Kontrol Devri
- **Given:** İVD sayfası açıldı
- **When:** Geçiş tamamlanır
- **Then:** Bot "tamamlandı" bildirir, tarayıcı açık kalır, kullanıcı manuel devam eder

### AC7: Credentials Eksik
- **Given:** GİB credentials ayarlarda YOK
- **When:** Link tıklanır
- **Then:** Toast hata: "GİB giriş bilgileri ayarlardan girilmeli"

### AC8: Electron Bot Kapalı
- **Given:** Electron Bot çalışmıyor
- **When:** Link tıklanır
- **Then:** Toast bilgi: "Bot bağlantısı yok, Electron uygulamasını başlatın"

## Additional Context

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `playwright` | `^1.40.0` | Headed browser automation |
| (existing) `ws` | `^8.18.0` | WebSocket |
| (existing) `electron` | `^34.0.0` | Desktop app |

### Testing Strategy

**Manuel E2E Test:**
1. Ayarlar → GİB Giriş Bilgileri'ne userid/password gir
2. Dashboard'a git
3. "Meslek Mensubu ile Giriş" → "Yeni İnternet Vergi Dairesi" tıkla
4. Toast mesajını doğrula
5. Playwright tarayıcısının açıldığını doğrula
6. Form'un doldurulduğunu doğrula
7. Captcha'yı gir, login ol
8. İVD sayfasına yönlendirildiğini doğrula
9. Tarayıcının açık kaldığını doğrula

**Edge Cases:**
- Credentials eksik → Hata mesajı
- Yanlış şifre → GİB hata sayfası (kullanıcı görür)
- Network hatası → Toast ile bildir
- Electron kapalı → Bilgilendirme mesajı

### Notes

**Kritik:**
- `browser.close()` ÇAĞIRILMAYACAK - tarayıcı kullanıcıya bırakılacak
- `context.close()` da çağrılmayacak
- Mevcut `bot.ts` dosyasına DOKUNULMAYACAK

**Bilinen Limitasyonlar:**
- Tek seferde bir İVD oturumu açılabilir
- Tarayıcı manuel kapatılmalı

**Gelecek İyileştirmeler (Out of Scope):**
- Diğer linkler (E-Beyanname, E-Tebligat, vb.)
- Mükellef ile giriş
- Birden fazla tarayıcı yönetimi
