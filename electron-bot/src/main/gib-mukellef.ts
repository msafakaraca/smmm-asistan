/**
 * GİB Mükellef Listesi Bot - Electron Version
 * e-beyan.gib.gov.tr'den mükellef listesi çeker
 */

import puppeteer from "puppeteer-extra";
import { Browser, Page } from "puppeteer";
import { solveCaptcha } from "./captcha";

// CONFIG
export const GIB_MUKELLEF_CONFIG = {
    PORTAL_URL: "https://dijital.gib.gov.tr/portal",
    MUKELLEFLER_URL: "https://ebeyan.gib.gov.tr/kullanici/mukellefler",

    SELECTORS: {
        // Login selectors
        USERID: "form#loginForm input#userid",
        PASSWORD: "form#loginForm input#sifre",
        CAPTCHA_INPUT: ".captcha input#dk",
        CAPTCHA_IMAGE: '.captcha img[alt="captchaImg"]',
        LOGIN_BUTTON: "form#loginForm button[type='submit']",

        // E-Beyan button
        EBEYAN_BUTTON: 'img[src*="YeniEBeyanname"]',
        EBEYAN_TEXT: 'p.MuiTypography-body1:contains("e-Beyan")',

        // Redirect popup
        ONAYLA_BUTTON: 'button[title="ONAYLA"]',

        // Mükellefler page

        // Mükellefler page
        // MUI Select için güncellenmiş selector'lar
        ROWS_PER_PAGE_SELECT: '.MuiTablePagination-select', // MUI Select trigger
        TABLE_ROWS: 'tbody tr',
        POPOVER: '.reactour__popover',
        POPOVER_CLOSE: '.reactour__close-button',
        NEXT_PAGE_BUTTON: 'button[aria-label="Go to next page"]',
        PAGINATION_INFO: '.MuiTablePagination-displayedRows',
    },

    TIMEOUTS: {
        PAGE_LOAD: 60000,
        ELEMENT_WAIT: 30000,
        CAPTCHA_WAIT: 120000, // 2 minutes for manual CAPTCHA
    },

    DELAYS: {
        SHORT: 500,
        MEDIUM: 1000,
        LONG: 2000,
        POPOVER: 1500
    }
};

export interface GibMukellefOptions {
    username: string;
    password: string;
    captchaApiKey?: string;
    onProgress: (type: string, data: any) => void;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function syncGibTaxpayers(options: GibMukellefOptions) {
    const { username, password, captchaApiKey, onProgress } = options;

    const report = (percent: number, message: string) => {
        console.log(`[GİB-MÜKELLEF] %${percent} - ${message}`);
        onProgress?.('progress', { progress: percent, message });
    };

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        report(5, "Tarayıcı başlatılıyor...");

        browser = await puppeteer.launch({
            headless: false, // Debug modu - tarayıcı görünür
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
            defaultViewport: { width: 1366, height: 900 },
        });

        page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Go to GİB Portal
        // ═══════════════════════════════════════════════════════════════════
        report(10, "GİB portalına gidiliyor...");
        await page.goto(GIB_MUKELLEF_CONFIG.PORTAL_URL, {
            waitUntil: 'networkidle0',
            timeout: GIB_MUKELLEF_CONFIG.TIMEOUTS.PAGE_LOAD
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Login
        // ═══════════════════════════════════════════════════════════════════
        report(15, "Giriş bilgileri giriliyor...");

        await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.USERID, {
            visible: true,
            timeout: GIB_MUKELLEF_CONFIG.TIMEOUTS.ELEMENT_WAIT
        });

        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.USERID, username, { delay: 50 });
        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.PASSWORD, password, { delay: 50 });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Solve CAPTCHA (Auto with Retry)
        // ═══════════════════════════════════════════════════════════════════

        let captchaSolved = false;
        const MAX_CAPTCHA_RETRIES = 3;

        if (!captchaApiKey) {
            throw new Error("Headless modda CAPTCHA API key gerekli! electron-bot/.env dosyasına CAPTCHA_API_KEY ekleyin.");
        }

        for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES && !captchaSolved; attempt++) {
            report(20, `🤖 CAPTCHA çözülüyor (Deneme ${attempt}/${MAX_CAPTCHA_RETRIES})...`);

            try {
                // CAPTCHA görselinin yüklenmesini bekle
                await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.CAPTCHA_IMAGE, {
                    visible: true,
                    timeout: 10000
                });

                await delay(500); // Görselin tam yüklenmesi için bekle

                // CAPTCHA görselini base64 olarak al
                const captchaBase64 = await page.evaluate((selector) => {
                    const img = document.querySelector(selector) as HTMLImageElement;
                    if (!img) return null;

                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return null;

                    ctx.drawImage(img, 0, 0);
                    return canvas.toDataURL('image/png');
                }, GIB_MUKELLEF_CONFIG.SELECTORS.CAPTCHA_IMAGE);

                if (!captchaBase64) {
                    console.log(`[CAPTCHA] ⚠️ Deneme ${attempt}: Görsel alınamadı`);
                    if (attempt < MAX_CAPTCHA_RETRIES) {
                        await page.reload({ waitUntil: 'networkidle0' });
                        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.USERID, username, { delay: 50 });
                        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.PASSWORD, password, { delay: 50 });
                    }
                    continue;
                }

                report(25, `📤 CAPTCHA 2Captcha'ya gönderildi (Deneme ${attempt})...`);
                const captchaResult = await solveCaptcha(captchaBase64, captchaApiKey);

                if (!captchaResult) {
                    console.log(`[CAPTCHA] ⚠️ Deneme ${attempt}: 2Captcha çözemedi`);
                    if (attempt < MAX_CAPTCHA_RETRIES) {
                        // Yeni captcha için sayfayı yenile
                        await page.reload({ waitUntil: 'networkidle0' });
                        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.USERID, username, { delay: 50 });
                        await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.PASSWORD, password, { delay: 50 });
                    }
                    continue;
                }

                report(30, `✅ CAPTCHA çözüldü: ${captchaResult}`);

                // CAPTCHA input'una yaz
                await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.CAPTCHA_INPUT, {
                    visible: true,
                    timeout: 5000
                });

                // Önce mevcut değeri temizle (retry durumunda)
                await page.$eval(GIB_MUKELLEF_CONFIG.SELECTORS.CAPTCHA_INPUT, (el: any) => el.value = '');
                await page.type(GIB_MUKELLEF_CONFIG.SELECTORS.CAPTCHA_INPUT, captchaResult, { delay: 50 });
                await delay(500);

                // Giriş butonuna tıkla
                report(35, "🔐 Giriş yapılıyor...");
                await page.click(GIB_MUKELLEF_CONFIG.SELECTORS.LOGIN_BUTTON);

                // Giriş başarılı mı kontrol et
                try {
                    await page.waitForFunction(
                        () => !window.location.href.includes('/login'),
                        { timeout: 10000 }
                    );
                    captchaSolved = true;
                    report(40, "✅ Otomatik giriş başarılı!");
                } catch {
                    console.log(`[CAPTCHA] ⚠️ Deneme ${attempt}: Giriş başarısız (yanlış captcha?)`);
                    if (attempt < MAX_CAPTCHA_RETRIES) {
                        // Sayfa hala login'de, yeni captcha yüklenmiş olmalı
                        await delay(1000);
                        // Input'ları tekrar doldur (sayfa yenilenmemişse bile captcha değişmiş olabilir)
                        const isStillLogin = await page.evaluate(() => window.location.href.includes('/login'));
                        if (isStillLogin) {
                            // Kullanıcı adı ve şifre hala dolu olabilir, sadece captcha'yı tekrar çöz
                            console.log(`[CAPTCHA] Yeni captcha için bekleniyor...`);
                            await delay(1000);
                        }
                    }
                }
            } catch (e) {
                console.log(`[CAPTCHA] ⚠️ Deneme ${attempt} hatası:`, (e as Error).message);
                if (attempt < MAX_CAPTCHA_RETRIES) {
                    await delay(2000);
                }
            }
        }

        if (!captchaSolved) {
            throw new Error(`CAPTCHA ${MAX_CAPTCHA_RETRIES} denemede çözülemedi. Lütfen daha sonra tekrar deneyin.`);
        }

        await delay(GIB_MUKELLEF_CONFIG.DELAYS.LONG);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3.5: Close Tour Popover (If exists)
        // ═══════════════════════════════════════════════════════════════════
        try {
            const popover = await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.POPOVER, {
                visible: true,
                timeout: 5000
            });
            if (popover) {
                console.log("Tour popover detected, closing...");
                const closeBtn = await page.$(GIB_MUKELLEF_CONFIG.SELECTORS.POPOVER_CLOSE);
                if (closeBtn) {
                    await closeBtn.click();
                    await delay(GIB_MUKELLEF_CONFIG.DELAYS.MEDIUM);
                }
            }
        } catch (e) {
            // Popover yoksa devam et
            console.log("Tour popover yok veya zaman aşımı, devam ediliyor...");
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Click e-Beyan Button
        // ═══════════════════════════════════════════════════════════════════
        report(50, "E-Beyan Portalı'na yönlendiriliyor...");

        // Find and click e-Beyan button (JavaScript click to avoid visibility issues)
        await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.EBEYAN_BUTTON, {
            visible: true,
            timeout: GIB_MUKELLEF_CONFIG.TIMEOUTS.ELEMENT_WAIT
        });

        // JavaScript click - daha güvenilir
        await page.evaluate((selector) => {
            const btn = document.querySelector(selector) as HTMLElement;
            if (btn) {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                btn.click();
            }
        }, GIB_MUKELLEF_CONFIG.SELECTORS.EBEYAN_BUTTON);

        await delay(GIB_MUKELLEF_CONFIG.DELAYS.MEDIUM);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5 & 6: Handle Redirect & Switch Tab
        // ═══════════════════════════════════════════════════════════════════
        report(55, "E-Beyanname sekmesine geçiş bekleniyor...");

        // Mevcut sayfaları kaydet
        const pagesBefore = await browser.pages();
        const initialPageCount = pagesBefore.length;

        // "ONAYLA" butonu varsa tıkla
        try {
            await page.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.ONAYLA_BUTTON, {
                visible: true,
                timeout: 10000 // 10 sn bekle
            });

            console.log("Onayla butonu bulundu, tıklanıyor...");
            // JavaScript click - daha güvenilir
            await page.evaluate((selector) => {
                const btn = document.querySelector(selector) as HTMLElement;
                if (btn) btn.click();
            }, GIB_MUKELLEF_CONFIG.SELECTORS.ONAYLA_BUTTON);

            await delay(GIB_MUKELLEF_CONFIG.DELAYS.MEDIUM);
        } catch (e) {
            console.log("Onayla butonu görülmedi veya zaman aşımı, devam ediliyor...");
        }

        // Yeni sekmenin açılmasını bekle
        report(60, "Yeni sekme aranıyor...");

        let ebeyanPage: Page | null = null;
        for (let i = 0; i < 20; i++) { // Max 20 saniye bekle
            const pages = await browser.pages();

            // 1. Durum: Sayfa sayısı arttıysa yeni sayfayı bul
            if (pages.length > initialPageCount) {
                ebeyanPage = pages[pages.length - 1]; // Genelde son açılan
                break;
            }

            // 2. Durum: URL kontrolü (ebeyan veya intvrg içeren sayfa)
            for (const p of pages) {
                const url = p.url();
                if ((url.includes('ebeyan') || url.includes('intvrg')) && p !== page) {
                    ebeyanPage = p;
                    break;
                }
            }

            if (ebeyanPage) break;
            await delay(1000);
        }

        if (ebeyanPage) {
            console.log(`Yeni sekme yakalandı: ${ebeyanPage.url()}`);
            await ebeyanPage.bringToFront();
            console.log("Sayfa yüklenmesi için 2 saniye bekleniyor...");
            await delay(2000);
        } else {
            console.log("Yeni sekme tespit edilemedi, mevcut sayfa üzerinden devam ediliyor...");
            ebeyanPage = page;
        }

        // Mükellefler sayfasına git (Eğer zaten orada değilsek)
        if (!ebeyanPage.url().includes('mukellefler')) {
            report(65, "Mükellefler listesi yükleniyor...");
            await ebeyanPage.goto(GIB_MUKELLEF_CONFIG.MUKELLEFLER_URL, {
                waitUntil: 'networkidle0',
                timeout: GIB_MUKELLEF_CONFIG.TIMEOUTS.PAGE_LOAD
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 7: Set rows per page to 100 (MUI Select) - FAST METHOD
        // ═══════════════════════════════════════════════════════════════════
        report(70, "Sayfa başına satır sayısı 100 olarak ayarlanıyor...");

        try {
            // Select elementinin yüklenmesini bekle
            await ebeyanPage.waitForSelector(GIB_MUKELLEF_CONFIG.SELECTORS.ROWS_PER_PAGE_SELECT, {
                visible: true,
                timeout: 10000
            });

            // Select'e tıkla - dropdown açılacak
            await ebeyanPage.click(GIB_MUKELLEF_CONFIG.SELECTORS.ROWS_PER_PAGE_SELECT);

            // Polling ile 100 option'ını bekle ve tıkla (max 2 saniye)
            const success = await ebeyanPage.evaluate(() => {
                return new Promise<boolean>((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 20; // 20 x 100ms = 2 saniye

                    const tryClick = () => {
                        attempts++;

                        // Farklı selector'ları dene
                        const selectors = [
                            'li[role="option"]',
                            '.MuiMenuItem-root',
                            '[data-value="100"]',
                            '.MuiMenu-list li'
                        ];

                        for (const selector of selectors) {
                            const options = document.querySelectorAll(selector);
                            const option100 = Array.from(options).find(
                                opt => opt.textContent?.trim() === '100'
                            ) as HTMLElement;

                            if (option100) {
                                option100.click();
                                resolve(true);
                                return;
                            }
                        }

                        if (attempts < maxAttempts) {
                            setTimeout(tryClick, 100);
                        } else {
                            resolve(false);
                        }
                    };

                    // İlk denemeyi hemen yap
                    tryClick();
                });
            });

            if (success) {
                // Tablo verilerinin yüklenmesi için kısa bekle
                await delay(800);
                report(72, "✅ Satır sayısı 100 olarak ayarlandı");
            } else {
                console.log("⚠️ 100 seçeneği bulunamadı, varsayılan değerle devam ediliyor");
            }

        } catch (e) {
            console.log("⚠️ Row count ayarlanamadı, mevcut değerle devam ediliyor:", (e as Error).message);
            // Hata durumunda da devam et (25 satır ile çalışır)
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 8: Extract taxpayer data from table (WITH PAGINATION)
        // ═══════════════════════════════════════════════════════════════════
        report(80, "Mükellef verileri çekiliyor...");

        // Wait for table to be fully loaded
        await ebeyanPage.waitForSelector('tbody tr', {
            visible: true,
            timeout: GIB_MUKELLEF_CONFIG.TIMEOUTS.ELEMENT_WAIT
        });

        await delay(GIB_MUKELLEF_CONFIG.DELAYS.MEDIUM);

        // Extract all taxpayers from all pages
        const allTaxpayers: any[] = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            report(80 + (currentPage * 2), `Sayfa ${currentPage} okunuyor...`);

            // Extract data from current page
            const pageTaxpayers = await ebeyanPage.evaluate(() => {
                const rows = document.querySelectorAll('tbody tr');
                const data: any[] = [];

                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 6) {
                        // Column indices based on GİB table structure:
                        // 0: Adı Soyadı/Ünvanı
                        // 1: T.C. Kimlik No
                        // 2: Vergi Kimlik No
                        // 3: Sözleşme Tipi
                        // 4: Sözleşme Başlangıç Tarihi
                        // 5: Sözleşme Bitiş Tarihi
                        // 6: Mükellef Seç (button)

                        const unvan = cells[0]?.textContent?.trim() || '';
                        const tckn = cells[1]?.textContent?.trim() || '';
                        const vkn = cells[2]?.textContent?.trim() || '';
                        const sozlesmeTipi = cells[3]?.textContent?.trim() || '';
                        const sozlesmeTarihi = cells[4]?.textContent?.trim() || '';

                        // Skip empty rows
                        if (!unvan || !vkn) return;

                        // Determine sirketTipi based on presence of TCKN
                        // - Has TCKN (11 digits) + VKN → sahis (Şahıs)
                        // - Only VKN (no TCKN or empty) → firma (Firma)
                        let sirketTipi = 'firma';
                        if (tckn && tckn.length === 11 && /^\d+$/.test(tckn)) {
                            sirketTipi = 'sahis';
                        }

                        data.push({
                            unvan,
                            tcKimlikNo: tckn || null,
                            vergiKimlikNo: vkn,
                            vknTckn: vkn, // Legacy field - use VKN as primary identifier
                            sirketTipi,
                            sozlesmeTipi,
                            sozlesmeTarihi
                        });
                    }
                });

                return data;
            });

            allTaxpayers.push(...pageTaxpayers);

            console.log(`[PAGE ${currentPage}] ${pageTaxpayers.length} mükellef okundu (Toplam: ${allTaxpayers.length})`);

            // Check if there's a next page button and if it's enabled
            try {
                const nextButton = await ebeyanPage.$(GIB_MUKELLEF_CONFIG.SELECTORS.NEXT_PAGE_BUTTON);
                if (nextButton) {
                    const isDisabled = await ebeyanPage.evaluate(btn => btn.hasAttribute('disabled'), nextButton);
                    if (!isDisabled) {
                        // Click next page
                        await nextButton.click();
                        await delay(GIB_MUKELLEF_CONFIG.DELAYS.LONG);
                        currentPage++;
                    } else {
                        hasNextPage = false;
                    }
                } else {
                    hasNextPage = false;
                }
            } catch (e) {
                console.log("Pagination kontrolü hatası, tek sayfa varsayılıyor...");
                hasNextPage = false;
            }
        }

        const taxpayers = allTaxpayers;

        // Calculate stats
        const stats = {
            total: taxpayers.length,
            sahis: taxpayers.filter(t => t.sirketTipi === 'sahis').length,
            firma: taxpayers.filter(t => t.sirketTipi === 'firma').length,
            basit_usul: 0
        };

        report(90, `${taxpayers.length} mükellef verisi çekildi. İşleniyor...`);

        // Send data to backend via WebSocket
        onProgress?.('mukellef-data', {
            taxpayers,
            stats
        });

        await delay(GIB_MUKELLEF_CONFIG.DELAYS.MEDIUM);

        report(100, `✅ İşlem tamamlandı! ${taxpayers.length} mükellef bulundu (${stats.sahis} Şahıs, ${stats.firma} Firma).`);

        onProgress?.('complete', {
            stats,
            taxpayers
        });

        return { success: true, taxpayers };

    } catch (error) {
        console.error("[GİB-MÜKELLEF] Error:", error);
        onProgress?.('error', { message: (error as Error).message });
        return { success: false, error: (error as Error).message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
