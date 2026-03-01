# LUCA PROXY (Luca Bağlantı Merkezi) - Kapsamlı Tersine Mühendislik Raporu

**Tarih:** 2026-02-04
**Analiz Yöntemi:** CFR 0.152 Java Decompiler ile JAR decompile + kaynak kod analizi
**Toplam Analiz Edilen Dosya:** 70+ Java sınıfı
**Uygulama Sürümü:** 20250710001 (10 Temmuz 2025)

---

## 1. GENEL BAKIŞ

### 1.1. Uygulama Tanımı

| Özellik | Değer |
|---------|-------|
| **Uygulama Adı** | Luca Bağlantı Merkezi (Luca Proxy) |
| **Geliştirici** | AGEM Bilgi Teknolojileri (`tr.com.agem`) |
| **Maven Artifact** | `tr.com.agem:luca-proxy:1.0.0` |
| **Platform** | Java 11 (Swing masaüstü uygulaması) |
| **Çalışma Portu** | `localhost:15822` (HTTP) |
| **Ana JAR** | `LucaProxy.jar` (481 KB) |
| **Bağımlılık Sayısı** | 130+ JAR dosyası (`lib/` dizininde) |
| **JRE** | Gömülü OpenJDK 11.0.14+9 |
| **Derleme** | Maven 3.9.9, JDK 17.0.15 ile derlenmiş |
| **Derleyen** | `Oner` (Built-By manifest değeri) |

### 1.2. Tek Cümle Özet

Luca Proxy, **Luca muhasebe yazılımının** tarayıcıda çalışan web arayüzünden, kullanıcının bilgisayarında `localhost:15822` portunda çalışarak Türkiye'deki devlet kurumlarına (GİB, SGK, Defter Beyan) erişimi sağlayan yerel bir HTTP reverse proxy uygulamasıdır.

### 1.3. Neden Gerekli?

Tarayıcılar, CORS (Cross-Origin Resource Sharing) güvenlik politikası nedeniyle farklı alan adlarındaki devlet portallerine doğrudan istek yapamaz. Luca Proxy bu kısıtlamayı aşarak:

1. Luca web arayüzünden gelen istekleri devlet portallerine iletir
2. Yanıttaki HTML/JS içeriklerini Luca iframe'i içinde çalışabilir hale getirir (URL rewriting)
3. USB e-imza tokeni, OCR motoru, dosya sistemi gibi yerel kaynaklara erişim sağlar
4. SMTP üzerinden e-posta gönderimi yapar

---

## 2. MİMARİ YAPI

### 2.1. Genel Akış Diyagramı

```
  ┌─────────────────────────────────────────┐
  │     LUCA WEB UYGULAMASI (Tarayıcı)     │
  │  https://app.luca.com.tr (varsayılan)   │
  └────────────────┬────────────────────────┘
                   │ HTTP istekleri
                   │ (localhost:15822)
                   ▼
  ┌─────────────────────────────────────────┐
  │         LUCA PROXY SUNUCUSU             │
  │     (Java Desktop - Port 15822)         │
  │                                         │
  │  ┌─────────┐ ┌──────────┐ ┌─────────┐  │
  │  │  Ajax   │ │  Action  │ │  HTTP   │  │
  │  │ Handler │ │ Handler  │ │ Handler │  │
  │  │ /op*    │ │ /Luca/*  │ │ *       │  │
  │  └────┬────┘ └────┬─────┘ └────┬────┘  │
  │       │           │            │        │
  │       │     ┌─────▼──────┐     │        │
  │       │     │  Request   │     │        │
  │       │     │  Factory   │     │        │
  │       │     │ (100+ rota)│     │        │
  │       │     └─────┬──────┘     │        │
  └───────┼───────────┼────────────┼────────┘
          │           │            │
   Session        ┌───┼───┐     Statik
   Yönetimi       │   │   │     Dosya
              ┌───▼┐ ┌▼──┐▼───┐
              │GİB │ │SGK│KEP │ +E-posta, OCR, Selenium...
              └──┬─┘ └─┬─┘└─┬─┘
                 │     │    │
    ┌────────────▼─────▼────▼──────────────┐
    │        DEVLET KURUMLARI              │
    │  intvd.gib.gov.tr                    │
    │  intvrg.gib.gov.tr                   │
    │  ivd.gib.gov.tr                      │
    │  ebeyanname.gib.gov.tr               │
    │  earsivportal.efatura.gov.tr         │
    │  ebildirge.sgk.gov.tr               │
    │  uyg.sgk.gov.tr                      │
    │  net.sgk.gov.tr                      │
    │  api.defterbeyan.gov.tr              │
    └──────────────────────────────────────┘
```

### 2.2. Sınıf Hiyerarşisi

| Katman | Sınıf | Görev |
|--------|-------|-------|
| **Giriş Noktası** | `App.java` | `main()` metodu, alt sistemleri başlatır |
| **HTTP Sunucu** | `Proxy.java` | Apache HttpCore ile yerel HTTP sunucu |
| **İstek Yönlendirme** | `ActionHandler.java` | Ana reverse proxy mekanizması |
| **Rota Tanımları** | `RequestFactory.java` | 100+ endpoint tanımlayan rota fabrikası |
| **Rota Konfigürasyonu** | `RequestBean.java` | Tek bir proxy rotasının yapılandırması |
| **Oturum Yönetimi** | `ProxySession.java` | Thread-safe anahtar-değer deposu (Hashtable) |
| **Ajax İşlemleri** | `AjaxHandler.java` | Session görüntüleme/temizleme |
| **Proxy Komutları** | `LucaProxyRequestHandler.java` | Güncelleme ve modül yükleme |

---

## 3. BAŞLATMA SÜRECİ

### 3.1. BAT Dosyaları (Başlatma Modları)

| Dosya | Komut | Açıklama |
|-------|-------|----------|
| `lucaproxy.bat` | `javaw -jar LucaProxy.jar --tray` | Normal mod (sistem tepsisi) |
| `lucaproxydebug.bat` | `java -jar LucaProxy.jar --tray --debug` | Debug mod (konsol görünür) |
| `lucaproxynotray.bat` | `javaw -jar LucaProxy.jar` | Tepsisiz mod |
| `lucaproxystartup.bat` | `javaw -jar LucaProxy.jar --tray --startup` | Windows başlangıcında otomatik |

### 3.2. Başlatma Sırası (App.main)

| Sıra | İşlem | Açıklama |
|------|-------|----------|
| 1 | `params(args)` | `--tray`, `--debug`, `--update`, `--repair`, `--test` parametreleri |
| 2 | `initLog()` | Log dosyası oluştur, eski logu ZIP olarak arşivle |
| 3 | `initProps()` | `LucaProxy.properties` dosyasından kullanıcı tercihlerini oku |
| 4 | `init()` | Swing görünüm teması (Windows > GTK > Nimbus) |
| 5 | `certs()` | SGK ve DBS SSL sertifikalarını Java keystore'a yükle |
| 6 | `AppWindow` | Ana pencereyi oluştur ("Luca Bağlantı Merkezi") |
| 7 | `Constants` | Uygulama sabitlerini yükle |
| 8 | `info()` | Versiyon bilgisini pencerede göster |
| 9 | `Proxy.start()` | HTTP sunucuyu port 15822'de başlat |

### 3.3. Komut Satırı Parametreleri

| Parametre | Açıklama |
|-----------|----------|
| `--tray` | Sistem tepsisinde çalıştır |
| `--startup` | Windows ile otomatik başlatıldı |
| `--update` | Güncelleme modunda başla |
| `--repair` | Onarım modunda başla |
| `--debug` | Debug modu (log konsola da yazılır) |
| `--test` | Test modu (test property'leri kullanılır) |

---

## 4. HTTP SUNUCU DETAYLARI

### 4.1. Temel Yapılandırma

| Parametre | Değer |
|-----------|-------|
| Port | 15822 |
| Sunucu Adı | `AgemHttpServer/1.1` |
| SO_TIMEOUT | 1000 ms |
| SO_LINGER | 1000 ms |
| SO_KEEPALIVE | Açık |
| TCP_NODELAY | Açık |

### 4.2. İstek Yönlendirme

| URL Pattern | Handler | Açıklama |
|-------------|---------|----------|
| `/op*` | `AjaxHandler` | Oturum yönetimi (temizle, sorgula, sil) |
| `/Luca/*` | `ActionHandler` | Ana proxy istekleri (devlet sitelerine) |
| `*` | `HttpHandler` | Statik dosya sunumu (HTML, JS, CSS, resim) |

### 4.3. CORS Başlıkları (Tüm yanıtlara eklenir)

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: *
Access-Control-Allow-Methods: GET, POST, PUT
```

### 4.4. Taklit Edilen HTTP Başlıkları

```
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)
            Ubuntu Chromium/45.0.2454.101 Chrome/45.0.2454.101 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: tr,en-US;q=0.8,en;q=0.6
Referer: https://www.google.com.tr (varsayılan)
```

### 4.5. Bağlantı Parametreleri

| Parametre | Değer |
|-----------|-------|
| Connection Timeout | 300.000 ms (5 dakika) |
| Socket Timeout | 300.000 ms (5 dakika) |
| Yeniden Deneme | 10 kez |
| SSL Protokolü | TLSv1.2 zorunlu |

---

## 5. ANA İSTEK PARAMETRELERİ

Ana endpoint: `http://localhost:15822/Luca/jqRequest.do`

| Parametre | Zorunlu | Açıklama |
|-----------|---------|----------|
| `_u` | Evet | İşlem tanımlayıcısı (ör: `ebeyanname:dispatch`, `gibSirket:ana`) |
| `_ld` | Evet | Session izolasyon anahtarı (her mükellef için farklı) |
| `_luca_url` | Hayır | Luca sunucu URL'sini dinamik değiştir |
| `_reset` | Hayır | HTTP istemcisini sıfırla |
| `_page` | Hayır | Alt sayfa adı (dinamik rota) |
| `_x` | Hayır | URL eki |
| `_c` | Hayır | Content-Type geçersiz kılma |
| `_save` | Hayır | PDF kaydetme modu |
| `_o` | Hayır | İşlem operasyonu türü |
| `_fn` | Hayır | İndirilen dosyanın adı |

**Kural:** `_` ile başlayan parametreler proxy'nin kontrol parametreleridir, hedefe iletilmez. `__` (çift alt çizgi) ile başlayanlar bu filtreden muaftır.

---

## 6. MODÜL DETAYLARI

### 6.1. GİB (Gelir İdaresi Başkanlığı) Modülleri

#### 6.1.1. İnternet Vergi Dairesi (gibResen)
- **Hedef:** `https://intvd.gib.gov.tr`
- **İşlemler:** Vergi sorgulamaları, E-YEKS kimlik doğrulama, dispatch
- **Özel:** Şifre otomatik doldurma callback'i enjekte eder

#### 6.1.2. İnteraktif Vergi Dairesi - Şirket (gibSirket)
- **Hedef:** `https://intvrg.gib.gov.tr`
- **İşlemler:** Captcha, tebligat PDF indirme, e-tebligat, dispatch
- **Endpoint Sayısı:** 10+

#### 6.1.3. E-Beyanname - Şirket (ebeyannameSirket)
- **Hedef:** `https://intvd.gib.gov.tr`
- **İşlemler:** Giriş, E-YEKS, dispatch, vergi levhası PDF

#### 6.1.4. E-Beyanname - Genel (ebeyanname)
- **Hedef:** `https://ebeyanname.gib.gov.tr`
- **İşlemler:** Giriş, E-YEKS, dispatch, TOKEN yakalama, dosya yükleme
- **Özel:** `TokenHandler` ile hidden TOKEN input parse edilir, beyanname paket gönderme formu modifiye edilir

#### 6.1.5. İnteraktif Vergi Dairesi - Yeni (ivd)
- **Hedef:** `https://ivd.gib.gov.tr`
- **İşlemler:** ASSOS login, CLM10, captcha, PDF, tebligat indirme, Excel export
- **Endpoint Sayısı:** 14+

#### 6.1.6. E-Arşiv Portal (ea530)
- **Hedef:** `https://earsivportal.efatura.gov.tr`
- **Protokol:** HTTP REST API (OkHttp + Apache HttpClient)
- **Tarayıcı otomasyonu kullanmaz!**

| Komut | İşlem |
|-------|-------|
| `ea530:list530` | Tarih aralığındaki fatura listesi |
| `ea530:view` | Fatura HTML önizleme |
| `ea530:download` | Tek fatura ZIP indirme |
| `ea530:save` | Çoklu fatura ZIP indirme |
| `ea530:detail` | Fatura kalem detayları (UBL XML parse) |
| `ea530:xml` | Fatura XML (Base64) |
| `ea530:iptalItirazSorgula` | İptal/itiraz durumu |
| `ea530:adimaDuzenlenenBelgeler` | Adına düzenlenen belgeler |

**E-Arşiv API URL'leri:**

| URL | İşlev |
|-----|-------|
| `/earsiv-services/assos-login` | Giriş/Çıkış |
| `/earsiv-services/dispatch` | Komut gönderme merkezi |
| `/earsiv-services/download` | Belge indirme |

**E-Arşiv API Komutları:**

| cmd Parametresi | Rapor Kodu | İşlev |
|----------------|-----------|-------|
| `EARSIV_PORTAL_TASLAKLARI_GETIR` | `RG_BASITTASLAKLAR` | Fatura taslakları listele |
| `EARSIV_PORTAL_BELGE_INDIR` | -- | Fatura belgesi indir |
| `EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR` | `RG_IPTALITIRAZTASLAKLAR` | İptal/itiraz talepleri |
| `EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR` | `RG_ALICI_TASLAKLAR` | Adına kesilen belgeler |

**UBL Fatura XML Parse Detayları:**

Faturalardan çıkarılan bilgiler:
- Belge numarası, ETTN, tarih, fatura türü (SATIŞ, İADE, TEVKİFAT, İSTİSNA, ÖZELMATRAH)
- Müşteri bilgileri (VKN/TCKN, unvan, ad, soyad, adres, vergi dairesi)
- Fatura kalemleri (miktar, birim fiyat, tutar, KDV oranı, KDV tutarı)
- Tevkifat kodları ve açıklamaları
- İstisna kodları
- Döviz kuru ve para birimi

---

### 6.2. SGK (Sosyal Güvenlik Kurumu) Modülleri

#### 6.2.1. E-Bildirge Eski (ebildirge)
- **Hedef:** `https://ebildirge.sgk.gov.tr`
- **İşlemler:** LDAP giriş, ana menü, hesap fişi, bildirge giriş/iptal, bordro, captcha
- **Endpoint Sayısı:** 18+
- **Özel:** Captcha OCR ile çözülür, session'a yazılır

#### 6.2.2. E-Bildirge WPEB (WPEB)
- **Hedef:** `https://ebildirge.sgk.gov.tr`
- **İşlemler:** Giriş, captcha, AMP işlemleri, dosya transfer, PDF indirme
- **Özel:** XML bildirge dosyası yükleme, Tahakkuk Fişi ve Hizmet Listesi PDF

#### 6.2.3. E-Bildirge V2 (EBildirgeV2)
- **Hedef:** `https://ebildirge.sgk.gov.tr`
- **İşlemler:** Ana sayfa, captcha, Struts action, JSP
- **Özel:** PDF'ler geçici dosya olarak kaydedilir, tip parametresine göre tahakkuk/hizmet listesi

#### 6.2.4. Sigortalı Tescil (sigortaliTescil)
- **Hedef:** `https://uyg.sgk.gov.tr`
- **İşlemler:** Giriş, captcha, tescil sorgu, işe giriş
- **Özel:** Tüm işlemler `sync=true` (senkron), `confirm`/`alert` fonksiyonları override edilir

#### 6.2.5. İşveren Sistemi (IsverenSistemi)
- **Hedef:** `https://uyg.sgk.gov.tr` + `https://net.sgk.gov.tr`
- **İşlemler:** Giriş, captcha, Struts action, JSP, JSF, ASP.NET (TK4447)
- **Özel:** `window.open()` → `window.location` dönüşümü, PrimeFaces JS desteği

#### 6.2.6. E-Vizite (evizite)
- **Hedef:** `https://uyg.sgk.gov.tr`
- **İşlemler:** Giriş, tarih girişi, rapor listeleme/onaylama, GOO işlemleri, captcha
- **Endpoint Sayısı:** 20+

#### 6.2.7. Vizite SOAP Servisi (viziteGonder)
- **Hedef:** `https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder`
- **Protokol:** SOAP (JAX-WS)
- **WSDL:** `https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder/wsdl/ViziteGonder.wsdl`

| SOAP Operasyonu | İşlev |
|-----------------|-------|
| `wsLogin` | SGK'ya giriş, wsToken al |
| `raporAramaTarihile` | Tarih ile rapor ara |
| `onayliRaporlarTarihile` | Onaylı raporlar listele |
| `raporOnay` | Rapor onayla |

#### 6.2.8. Yersiz Teşvik (yersizTesvik)
- **Hedef:** `https://uyg.sgk.gov.tr/Sigortali_Tesvik_4447_15`
- **İşlemler:** Giriş, ActionMultiplexer, captcha

#### 6.2.9. KHK 687 (Khk687)
- **Hedef:** `https://uyg.sgk.gov.tr/Sigortali_Tesvik_687_KHK`
- **İşlemler:** JSP, ActionMultiplexer, JS, captcha

#### 6.2.10. İşveren Borç Sorgu (mufredatKarti)
- **Hedef:** `https://uyg.sgk.gov.tr/IsverenBorcSorgu`
- **İşlemler:** Giriş, müfredat kartı, dönemsel borç, captcha

---

### 6.3. Defter Beyan Sistemi (dbs)
- **Hedef:** `https://api.defterbeyan.gov.tr`
- **Protokol:** REST API (JSON)
- **Kimlik Doğrulama:** `Token` HTTP header'ı ile
- **Timeout:** 30.000 ms
- **Özel:** Token rotasyonu (her yanıtta yeni token alınır)

---

### 6.4. KEP (Kayıtlı Elektronik Posta) Modülü
- **Endpoint'ler:** `kep:pdf_sign`, `kep:eml_sign`
- **Kütüphane:** TurkkepESignClient (Türkkep firmasının özel kütüphanesi)
- **İmzalama Uygulaması:** `sign-client-api-int_suite.jar` (ayrı Java süreci, JDK 8)

**Çalışma Akışı:**
```
Luca Web → JSON {pdf/eml: Base64, pin: "1234"} → Proxy
Proxy → USB Token (PIN ile erişim) → İmzalama
Proxy → JSON {pdf/eml: Base64 (imzalı)} → Luca Web
```

- Token algılama başarısızsa 10 denemeye kadar tekrar (her denemede 4sn bekleme)

---

### 6.5. E-Posta Modülü (email:send)
- **Protokol:** SMTP (JavaMail API)
- **Desteklenen:** SSL, STARTTLS, kimlik doğrulama
- **İçerik:** HTML formatı
- **Ekler:** Base64'ten decode edilir, geçici dosyaya yazılır, gönderim sonrası silinir

---

### 6.6. OCR / Captcha Modülü
- **Motor:** Tesseract 4J (tess4j-5.1.0)
- **Veri Dosyaları:** `tessdata/eng.traineddata`, `tessdata/osd.traineddata`
- **Karakter Beyaz Listesi:** Opsiyonel (sadece rakam tanıma vb.)

**Captcha Çözülen Sistemler:**

| Sistem | URL | Oturum Anahtarı |
|--------|-----|-----------------|
| E-Bildirge | `ebildirge.sgk.gov.tr/WPEB/PG` | `guvenlikKodu` |
| E-Vizite | `uyg.sgk.gov.tr/vizite/Captcha.jpg` | `ebildirge_resim_<key>` |

---

### 6.7. Selenium Tarayıcı Otomasyon Modülü

#### 6.7.1. IVD Yeni Sistem Girişi (selenium:interaktifvd_open)
- **URL:** `https://ivd.gib.gov.tr/`
- **Selector'ler:** `[rel='userid'] input`, `[rel='password'] input`, `[rel='securityCode'] input`
- **CAPTCHA:** Kullanıcı elle girer (5 dakika bekleme)

#### 6.7.2. IVD Eski Sistem Girişi (selenium:ivd_open)
- **URL:** `https://intvrg.gib.gov.tr/`
- **Selector'ler:** `#loginSifreli`, `#kullaniciKodu`, `#sifre`
- **CAPTCHA:** Kullanıcı elle girer

#### 6.7.3. Vergi Levhası İndirme (selenium:vergi_levhasi)
- **URL:** `https://intvrg.gib.gov.tr/`
- **Çoklu şirket desteği:** VKN/TCKN listesi ile döngü
- **CAPTCHA Bekleme:** 2 GÜN (`Duration.ofDays(2L)`)
- **Akış:** Giriş → CAPTCHA bekle → "E-Vergi Levhası" menü → Her şirket için VKN gir → Yıl seç → PDF indir

#### 6.7.4. Selenium Komut Çalıştırıcı (selenium:command)
- Luca sunucusundan gelen Selenium komutlarını JSON listesi olarak alır
- Sırayla çalıştırır, captcha görüntülerini OCR ile çözer
- `SeleniumCommandUtil` + `SeleniumCaptchaUtil` + `TesseractUtil` zinciri

#### 6.7.5. Dosya Sunma (selenium:file_download)
- İndirilen dosyaları HTTP yanıt olarak sunar
- ZIP modu (çoklu dosya) veya tek dosya modu

---

### 6.8. Güncelleme Modülü (app:update)

**URL Yapısı:**
```
{version.control.url}/version.json            → Sürüm bilgisi
{version.control.url}/V{sürüm}{beta}.json     → Tam güncelleme
{version.control.url}/V{sürüm}{beta}.{modül}.json → Modül güncelleme
```

- Güncelleme sunucusu: `https://auygs.luca.com.tr/Luca/LucaProxy/`
- OkHttp ile indirme ilerleme takibi
- Onarım modu: Dosyaları sıfırdan yeniden yükler
- Geçici dizin: `TEMP/{sürüm}{beta}/LucaProxy`

---

## 7. İÇERİK MANİPÜLASYONU (URL Rewriting)

Proxy'nin en kritik işlevi, devlet portallerinden gelen HTML/JS yanıtlarını Luca iframe'i içinde çalışabilir hale getirmektir.

### 7.1. Metin Değişiklikleri (replace)

- Portal URL'lerini proxy URL'lerine çevirir
- Statik kaynakları (CSS, JS, resim) orijinal sunucuya yönlendirir
- `window.open()` → `window.location` dönüşümü
- `window.opener == null` kontrollerini devre dışı bırakır
- `contextOff()` (sağ tık engelleme) fonksiyonlarını kaldırır
- Form target'larını `_blank` yerine `_self` yapar
- `confirm()` ve `alert()` fonksiyonlarını özel versiyonlarla değiştirir
- `</html>` öncesine Luca callback JavaScript'leri enjekte eder

### 7.2. Regex Değişiklikleri (regreplace)

- `.action`, `.jsp`, `.jsf`, `.aspx` uzantılı URL'leri proxy rotalarına dönüştürür
- Resim URL'leri orijinal sunucuya yönlendirilir
- `window.open('URL')` → `setTimeout(function() {window.parent.location='URL'}, 1000)`

### 7.3. Enjekte Edilen JavaScript Callback'leri

| Callback | Portal | Amaç |
|----------|--------|------|
| `parent.fill_password()` | GİB, SGK | Şifre alanlarını otomatik doldurma |
| `parent.handle()` | İVD, SGK | Sayfa yükleme tamamlandı bildirimi |
| `parent.goto_giris()` | gibSirket | Giriş ekranına yönlendirme |
| `parent.guvenliCikis()` | gibSirket | Güvenli çıkış |
| `parent.fill_tarih()` | evizite | Tarih alanı doldurma |
| `parent.personel_say()` | evizite | Personel sayısı bildirimi |
| `parent.giris_kontrol()` | evizite | Giriş kontrol sonucu |
| `parent.parent.next()` | EBildirgeV2 | Sonraki adıma geçiş |
| `parent.parent.stop()` | EBildirgeV2 | Hata durumunda durma |
| `parent.fill_pass()` | yersizTesvik | Şifre doldurma |

---

## 8. SSL/TLS GÜVENLİK YAPISI

### 8.1. CustomHttpsSocketFactory
- Yalnızca **TLSv1.2** protokolüne izin verir
- SSLv3, TLS 1.0, TLS 1.1 engellenmiş

### 8.2. InstallCert (Sertifika Yükleyici)
- Uygulama başlangıcında çalışır
- Hedef sunucuların SSL sertifikalarını Java keystore'a otomatik ekler
- Varsayılan keystore şifresi: `changeit`

**Otomatik Eklenen Sertifikalar:**
- `uyg.sgk.gov.tr` (SGK uygulama sunucusu)
- `api.defterbeyan.gov.tr` (Defter Beyan API)

---

## 9. HEDEF SUNUCU HARİTASI

| Sunucu | Protokol | Modül Sayısı | Açıklama |
|--------|----------|-------------|----------|
| `intvd.gib.gov.tr` | HTTPS Proxy | 2 | İnternet Vergi Dairesi |
| `intvrg.gib.gov.tr` | HTTPS Proxy + Selenium | 1 | İnteraktif Vergi Dairesi (Şirket) |
| `ivd.gib.gov.tr` | HTTPS Proxy + Selenium | 1 | İnteraktif Vergi Dairesi (Yeni) |
| `ebeyanname.gib.gov.tr` | HTTPS Proxy | 1 | E-Beyanname Portalı |
| `earsivportal.efatura.gov.tr` | HTTPS REST API | 1 | E-Arşiv Fatura Portalı |
| `ebildirge.sgk.gov.tr` | HTTPS Proxy | 3 | E-Bildirge (Eski, WPEB, V2) |
| `uyg.sgk.gov.tr` | HTTPS Proxy + SOAP | 7 | SGK Uygulamaları |
| `net.sgk.gov.tr` | HTTPS Proxy | 1 | SGK .NET (TK4447) |
| `api.defterbeyan.gov.tr` | HTTPS REST | 1 | Defter Beyan Sistemi |

**Toplam:** 100+ kayıtlı rota, 19 ana modül

---

## 10. KİMLİK DOĞRULAMA MEKANİZMALARI

| Portal | Yöntem | Kimlik Bilgisi | Token | CAPTCHA |
|--------|--------|----------------|-------|---------|
| GİB E-Arşiv | HTTP POST | userid + sifre (query string) | JSON token | Yok |
| GİB İVD (yeni) | Selenium form | kullanıcıKodu + sifre | Tarayıcı cookie | Elle girilir |
| GİB İVD (eski) | Selenium form | kullanıcıKodu + sifre | Tarayıcı cookie | Elle girilir |
| GİB E-Beyanname | HTTP Proxy | E-YEKS | SESSION cookie | Yok |
| SGK E-Bildirge | HTTP Proxy + OCR | LDAP kullanıcı + şifre | SESSION cookie | OCR ile çözülür |
| SGK Vizite SOAP | JAX-WS | kullanıcıAdı + işyeriKodu + şifre | wsToken | Yok |
| Defter Beyan | REST API | Token header | Token rotasyonu | Yok |
| KEP | USB Token | PIN kodu | - | Yok |

---

## 11. GÜVENLİK DEĞERLENDİRMESİ

### 11.1. Genel Sonuç

**Bu uygulama zararlı yazılım DEĞİLDİR.** Meşru bir ticari muhasebe entegrasyon yazılımıdır.

Doğrulamalar:
- Tüm bağlantı hedefleri bilinen Türk devlet kurumları (`.gov.tr` alan adları)
- Veri sızıntısı veya exfiltration davranışı yok
- Keylogger, kripto madenci veya backdoor pattern'ı yok
- `eval()`, `Function()` constructor veya dinamik kod yürütüsü yok

### 11.2. Risk Tablosu

| Risk | Seviye | Detay |
|------|--------|-------|
| Yerel proxy'de kimlik doğrulama yok | ORTA | localhost:15822'ye herhangi bir uygulama erişebilir |
| CORS: `Allow-Origin: *` | ORTA | Tüm kaynaklardan erişime izin verir |
| Şifreler query string'de (E-Arşiv) | ORTA | Log dosyalarında görünebilir |
| Captcha bypass (OCR) | ORTA | SGK captcha'ları Tesseract ile çözülüyor |
| Uzaktan komut çalıştırma (Selenium) | ORTA | Selenium komutları sunucudan geliyor |
| Güncelleme bütünlük kontrolü yok | ORTA | İndirilen güncellemelerde imza/checksum yok |
| Sabit keystore şifresi | DÜŞÜK | `changeit` - Java varsayılanı |
| Tek oturum nesnesi | DÜŞÜK | Eşzamanlı işlemlerde session karışabilir |
| Eski User-Agent | DÜŞÜK | Chrome 45 - uyumluluk sorunu olabilir |
| TLS 1.3 desteği yok | DÜŞÜK | Sadece TLS 1.2 |

### 11.3. Olumlu Güvenlik Pratikleri

- TLS 1.2 zorunlu, eski protokoller engellenmiş
- Her e-Arşiv işleminden sonra `finally` bloklarında `logout()` çağrılır
- CAPTCHA bypass yok (GİB Selenium - kullanıcı elle girer)
- Geçici dosyalar işlem sonrası siliniyor
- Oturum verileri bellekte, diske yazılmıyor
- Token rotasyonu uygulanmış (Defter Beyan)
- Thread-safe session (Hashtable)

---

## 12. TEKNİK ÖZELLİKLER ÖZETİ

| Özellik | Değer |
|---------|-------|
| Programlama Dili | Java 11 |
| GUI Framework | Swing (JFrame, JTextPane, MigLayout) |
| HTTP Sunucu | Apache HttpCore (Bootstrap) |
| HTTP İstemci | Apache Commons HttpClient 3.x + OkHttp 4.9.1 |
| Tarayıcı Otomasyon | Selenium WebDriver 4.6.0 + WebDriverManager 5.5.3 |
| JSON İşlemci | Jackson 2.9.2 + Gson 2.10.1 |
| SOAP | Apache CXF 3.5.1 (JAX-WS) |
| PDF İşleme | PDFBox 2.0.25 + iText 2.1.7 |
| OCR | Tesseract 4J (tess4j 5.1.0) |
| Kriptografi | BouncyCastle 1.75 |
| E-İmza | TurkkepESignClient 1.0.0 |
| E-Posta | JavaMail 1.6.2 |
| Arşivleme | Apache Commons Compress 1.22 |
| Loglama | Log4j 1.2.17 |
| Güncelleme | Agem Updater 1.0.0 |
| Varsayılan Port | 15822 |
| Varsayılan Tarayıcı | Chrome/Chromium |

---

## 13. SMMM-AI PROJESİ İÇİN ÇIKARIMLAR

Bu analiz, SMMM-AI projesinin GİB bot modülü için değerli bilgiler sağlamaktadır:

### 13.1. E-Arşiv Entegrasyonu
- Portal API'si REST tabanlıdır, 4 ana endpoint var
- Login: `assoscmd=anologin` (üretim), `assoscmd=login` (test)
- Fatura listeleme: `EARSIV_PORTAL_TASLAKLARI_GETIR` komutu, `RG_BASITTASLAKLAR` rapor kodu
- Faturalar ZIP formatında indirilir, içinde UBL XML var
- Token bazlı oturum yönetimi

### 13.2. İVD/İnternet Vergi Dairesi
- İki farklı portal: `ivd.gib.gov.tr` (yeni, ExtJS) ve `intvrg.gib.gov.tr` (eski, klasik HTML)
- CAPTCHA/doğrulama kodu elle girilmeli
- CSS selector'ler detaylı olarak belgelenmiş

### 13.3. SGK Vizite
- SOAP web servisi
- WSDL: `https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder/wsdl/ViziteGonder.wsdl`
- Rapor arama ve onaylama işlemleri mevcut

### 13.4. SGK E-Bildirge
- Captcha OCR ile otomatik çözülebilir (Tesseract)
- Session izolasyonu `_ld` parametresi ile sağlanır
- Tahakkuk fişi ve hizmet listesi PDF olarak indirilebilir

---

## 14. DOSYA LİSTESİ

### 14.1. Kök Dizin Dosyaları

| Dosya | Boyut | Açıklama |
|-------|-------|----------|
| `LucaProxy.jar` | 481 KB | Ana uygulama |
| `lucaproxy.bat` | 97 B | Normal başlatma |
| `lucaproxydebug.bat` | 95 B | Debug başlatma |
| `lucaproxynotray.bat` | 90 B | Tepsisiz başlatma |
| `lucaproxystartup.bat` | 107 B | Otomatik başlatma |
| `lucaproxy.ico` | 24 KB | Uygulama ikonu |
| `unins000.exe` | 3.1 MB | Kaldırma programı |
| `unins000.dat` | 105 KB | Kaldırma verileri |

### 14.2. JAR İçi Yapılandırma Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `luca.proxy.properties` | Port (15822), sürüm, güncelleme URL'si |
| `log4j.xml` | Loglama yapılandırması (DEBUG seviye) |
| `html/index.html` | Karşılama sayfası |
| `html/test.json` | Modül sürüm bilgileri |
| `logo.png` | Uygulama logosu |

### 14.3. Java Paket Yapısı

| Paket | Dosya Sayısı | Açıklama |
|-------|-------------|----------|
| `tr.com.agem.luca.proxy` | 45+ | Ana proxy sınıfları |
| `tr.com.agem.luca.proxy.selenium.gib` | 7 | GİB Selenium otomasyonu |
| `tr.com.agem.luca.proxy.kep` | 3 | KEP e-imza |
| `tr.com.agem.gib.earsiv` | 15 | E-Arşiv modelleri |
| `tr.com.agem.sgk.vizite.gonder` | 4 | SGK vizite istemcisi |
| `tr.com.agem.vizite.gonder.*` | 30+ | SGK vizite SOAP modelleri |

---

> **Rapor Sonu** | Analiz: Claude Code | Yöntem: CFR 0.152 Decompiler | Tarih: 2026-02-04
