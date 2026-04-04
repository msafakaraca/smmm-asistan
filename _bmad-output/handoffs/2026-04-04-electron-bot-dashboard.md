# Handoff: Electron Bot Dashboard — Quick Actions

**Tarih:** 2026-04-04 11:00
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı

> Electron bot uygulamasına giriş yaptıktan sonra gösterilen "Bot Çalışıyor" sayfası yerine
> Dashboard ekranı ekle. Web sitesindeki quick actions (Meslek Mensubu, Mükellef, SGK, Diğer)
> linklerini Electron bot içinde de çalıştır. Linklere tıklandığında Chromium açılıp ilgili
> portala bağlansın.

## Tasarım

Tasarım dosyası: `c:\Users\msafa\Desktop\Yeni Metin Belgesi.txt`

Layout:
- 900x650 sabit pencere
- Üst header: Kullanıcı adı + bağlantı durumu + çıkış butonu
- Sol kolon (scrollable): 4 kart (Meslek Mensubu, Mükellef, SGK, Diğer)
- Sağ sidebar: Bot durumu + son işlemler + versiyon

## Araştırma Bulguları

### Mimari Karar: API Üzerinden Credential → Direkt Launcher

Electron bot Bearer token'ı (`JWT_SECRET` ile imzalı) mevcut launch API'lerini çağıramıyor
çünkü onlar `getUserWithProfile()` kullanıyor (Supabase session-only).

**Çözüm:** Yeni Bearer-auth destekli API route'ları oluştur:
1. `/api/bot/dashboard-customers` → Müşteri listesi (credential flag'ları ile)
2. `/api/bot/dashboard-launch` → Credential'ları decrypt edip döndür

Main process API'den credential alır ve launcher fonksiyonlarını doğrudan çağırır (WS roundtrip yok).

### Auth Mekanizması

- `verifyBearerOrInternal()` fonksiyonu (`src/lib/internal-auth.ts:98`) Bearer token destekliyor
- Electron bot login token'ı `JWT_SECRET` ile imzalı, `tenantId` içeriyor
- Bu fonksiyon zaten var, sadece yeni API'lerde kullanılacak

### Mevcut Launcher Fonksiyonları (electron-bot/src/main/)

| Launcher | Fonksiyon | Parametreler |
|----------|-----------|-------------|
| gib-launcher.ts | `launchGibApplication()` | userid, password, application, targetPage, customerName, vergiLevhasiYil/Dil, onProgress |
| gib-launcher.ts | `prepareGibBrowser()` | onProgress (browser'ı önceden hazırlar) |
| earsiv-launcher.ts | `launchEarsivPortal()` | userid, password, customerName, onProgress |
| edevlet-launcher.ts | `launchEdevletKapisi()` | tckn, password, customerName, onProgress |
| turmob-launcher.ts | `launchTurmobLuca()` | userid, password, customerName, onProgress |
| iskur-launcher.ts | `launchIskurWithCredentials()` | tckn, password, loginMethod, customerName, onProgress |
| iskur-launcher.ts | `launchIskurWithEdevlet()` | tckn, password, loginMethod, customerName, onProgress |
| diger-islemler-launch.ts | `launchDigerIslem()` | actionId, onProgress |

### Link → Launcher Mapping

**Meslek Mensubu Linkleri** (credential kaynağı: `tenant.gibSettings` veya `tenant.edevletSettings`)

| Link ID | Application | Target Page | Launcher | Credential Type |
|---------|-------------|-------------|----------|-----------------|
| mm-ivd | ivd | — | launchGibApplication | gib (MM) |
| mm-ebeyanname | ebeyanname | — | launchGibApplication | gib (MM) |
| mm-digital-gib | ivd | borc-sorgulama | launchGibApplication | gib (MM) |
| mm-etebligat | ivd | e-tebligat | launchGibApplication | gib (MM) |
| mm-interaktif-vd | interaktifvd | — | launchGibApplication | gib (MM) |
| defter-beyan | defter-beyan | — | launchGibApplication | gib (MM) |
| edevlet | — | — | launchEdevletKapisi | edevlet (MM) |
| ebeyan | ebeyan | — | launchGibApplication | gib (MM) |

**Mükellef Linkleri** (credential kaynağı: `customer.gibKodu/gibSifre` vb.)

| Link ID | Application | Target Page | Launcher | Credential Type |
|---------|-------------|-------------|----------|-----------------|
| ivd | ivd | — | launchGibApplication | gib |
| ebeyanname | ebeyanname | — | launchGibApplication | gib |
| digital-gib | ivd | borc-sorgulama | launchGibApplication | gib |
| etebligat | ivd | e-tebligat | launchGibApplication | gib |
| edevlet-mukellef | — | — | launchEdevletKapisi | edevlet |
| gib-5000 | earsiv | — | launchEarsivPortal | gib |
| vergi-levhasi | ivd | vergi-levhasi | launchGibApplication | gib |
| turmob-luca | — | — | launchTurmobLuca | turmob |
| edefter | edefter | — | launchGibApplication | gib |
| iskur | — | — | launchIskurWithCredentials / launchIskurWithEdevlet | iskur/edevlet |

**SGK Linkleri** (henüz aktif değil - web'de "Yakında..." toast gösteriyor)

| Link ID | Durum |
|---------|-------|
| ebildirge, ebildirge-v2, isveren, sigortali-giris-cikis, eborcu-yoktur, is-kazasi | Yakında (toast göster) |

**Diğer Linkleri** (credential gerekmez)

| Link ID | actionId | Durum |
|---------|----------|-------|
| efatura-iptal | efatura-iptal | Aktif - shell.openExternal |
| ticaret-sicil | ticaret-sicil | URL yok (yakında) |
| turmob-ebirlik | turmob-ebirlik | URL yok (yakında) |

### Credential Decrypt Akışı

API route'unda `decrypt()` fonksiyonu (`src/lib/crypto.ts`) kullanılacak:

**GİB (Mükellef):**
```
customer.gibKodu → decrypt → userid
customer.gibSifre → decrypt → password
```

**GİB (Meslek Mensubu):**
```
tenant.gibSettings → JSON parse → gibCode/gibPassword
```

**E-Devlet (Mükellef):**
```
customer.edevletTckn → decrypt → tckn
customer.edevletSifre → decrypt → password
```

**TÜRMOB:**
```
customer.turmobKullaniciAdi → decrypt → userid
customer.turmobSifre → decrypt → password
```

### Mevcut Dosya Durumları

- `electron-bot/src/renderer/pages/Status.tsx` → Mevcut bot durumu sayfası (basit animasyonlu). Dashboard ile DEĞİŞTİRİLECEK.
- `electron-bot/src/renderer/App.tsx:342` → Login sonrası `<Status />` gösteriyor. `<Dashboard />` olacak.
- `electron-bot/src/main/preload.ts` → 44 satır, mevcut IPC bridge. Yeni channel'lar eklenecek.
- `electron-bot/src/main/index.ts` → ~2950 satır, setupIpcHandlers() fonksiyonu ~190. satırda. Yeni handler'lar eklenecek.
- `electron-bot/src/renderer/index.css` → Tailwind + bot animasyonları. Custom scrollbar eklenecek.

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/api/bot/dashboard-customers/route.ts` | YENİ | Bearer-auth müşteri listesi API |
| `src/app/api/bot/dashboard-launch/route.ts` | YENİ | Bearer-auth credential decrypt API |
| `electron-bot/src/renderer/pages/Dashboard.tsx` | YENİ | Ana dashboard bileşeni |
| `electron-bot/src/renderer/App.tsx` | Düzenleme | Dashboard import + routing |
| `electron-bot/src/main/preload.ts` | Düzenleme | Yeni IPC channel'lar |
| `electron-bot/src/main/index.ts` | Düzenleme | Yeni IPC handler'lar |
| `electron-bot/src/renderer/index.css` | Düzenleme | Custom scrollbar stilleri |

## Uygulama Planı

### Adım 1: API Route'ları Oluştur

#### 1a. `/api/bot/dashboard-customers/route.ts`
- [ ] `verifyBearerOrInternal(req.headers)` ile auth
- [ ] `prisma.customer.findMany({ where: { tenantId }, select: { id, unvan, kisaltma, sirketTipi, gibKodu, gibSifre, edevletTckn, edevletSifre, turmobKullaniciAdi, turmobSifre, hasIskurCredentials_flag } })`
- [ ] Credential varlığını bool flag olarak dön (gibKodu varsa hasGibCredentials: true gibi, decrypt etme)
- [ ] Response: `{ customers: Array<{id, unvan, kisaltma, sirketTipi, hasGibCredentials, hasEdevletCredentials, hasTurmobCredentials, hasIskurCredentials}> }`

#### 1b. `/api/bot/dashboard-launch/route.ts`
- [ ] `verifyBearerOrInternal(req.headers)` ile auth
- [ ] Body: `{ linkId, customerId?, credentialType: 'gib'|'gib-mm'|'edevlet'|'edevlet-mm'|'turmob'|'iskur'|'diger' }`
- [ ] Credential type'a göre decrypt et ve dön
- [ ] GİB MM: `tenant.gibSettings` parse + decrypt
- [ ] GİB Mükellef: `customer.gibKodu` + `customer.gibSifre` decrypt
- [ ] E-Devlet MM: `tenant.edevletSettings` parse + decrypt
- [ ] E-Devlet Mükellef: `customer.edevletTckn` + `customer.edevletSifre` decrypt
- [ ] TÜRMOB: `customer.turmobKullaniciAdi` + `customer.turmobSifre` decrypt
- [ ] Diğer: Sadece `{ success: true }` dön (credential gerekmez)

### Adım 2: IPC Bridge Güncelle

#### 2a. `preload.ts` → Yeni channel'lar
- [ ] `dashboard: { getCustomers, launch, onLaunchProgress, onLaunchError, onLaunchComplete }`

#### 2b. `index.ts` → Yeni IPC handler'lar
- [ ] `dashboard:getCustomers` → API çağır, müşteri listesi dön
- [ ] `dashboard:launch` → API'den credential al → ilgili launcher'ı çağır
  - linkId'ye göre doğru launcher seç
  - application/targetPage mapping uygula
  - Hata durumlarını renderer'a bildir

### Adım 3: Dashboard UI Oluştur

#### 3a. `Dashboard.tsx`
- [ ] Tasarım dosyasından layout'u uygula (Tailwind)
- [ ] `useEffect` ile müşteri listesi fetch et (IPC)
- [ ] Müşteri seçici dropdown (Mükellef + SGK kartları)
- [ ] Link click handler'ları (IPC çağrıları)
- [ ] Bot durumu gösterimi (onBotCommand dinle)
- [ ] İşlem geçmişi (son 10 işlem, localStorage'da tut)
- [ ] Loading state ve hata yönetimi
- [ ] SGK linkleri için "Yakında..." toast

#### 3b. `App.tsx` güncelle
- [ ] `import Dashboard from './pages/Dashboard'` ekle
- [ ] `state === 'status'` → `<Dashboard user={user} onLogout={handleLogout} />` olarak değiştir

#### 3c. `index.css` güncelle
- [ ] Custom scrollbar stilleri ekle

### Adım 4: Test

- [ ] Login → Dashboard görüntülenir
- [ ] Müşteri listesi yüklenir
- [ ] Meslek mensubu linkleri çalışır (Chromium açılır)
- [ ] Mükellef seçip link tıklama çalışır
- [ ] Diğer İşlemler default tarayıcıda açılır
- [ ] SGK linkleri "Yakında" toast gösterir
- [ ] Bot durumu doğru gösterilir

## Teknik Notlar

1. **Tailwind Desteği:** Electron renderer'da `@import "tailwindcss"` zaten var, Tailwind sınıfları kullanılabilir
2. **Pencere boyutu:** 900x650 sabit, `resizable: false`
3. **Custom scrollbar:** Tasarımdaki `.custom-scrollbar` class'ı CSS'e eklenecek
4. **Müşteri seçici:** Basit dropdown yeterli. Web'deki gibi Popover/Combobox yerine basit select + search
5. **GİB Prepare:** gib:prepare WS mesajı göndermek gerekiyor mu? Dashboard'dan launch yapılırken main process doğrudan launcher çağıracak, gib:prepare gereksiz
6. **İŞKUR özel:** İki giriş yöntemi var (İŞKUR credentials vs E-Devlet). Electron dashboard'da şimdilik sadece E-Devlet ile giriş destekle (daha yaygın kullanım)
7. **Vergi Levhası:** Yıl/dil seçimi gerekiyor. Default: 2025, tr
8. **Hata yönetimi:** Credential eksik ise toast ile bildir, API hatası ise detaylı mesaj göster

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Yeni API route (Bearer auth) | Mevcut API'ler Supabase session istiyor | WS roundtrip (karmaşık), API'leri dual-auth yap (riskli) |
| Direkt launcher çağrısı | WS roundtrip gereksiz, bot zaten main process'te | WS üzerinden gönder (fazla katman) |
| Basit dropdown (combobox değil) | Electron'da Radix UI yok, basit tutmak en iyisi | React Select (dependency), Radix (uyumsuz) |
| SGK "Yakında" toast | Web'de de henüz aktif değil | SGK launcher yazmak (scope dışı) |
