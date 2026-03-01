import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { TURMOB_CONFIG, TurmobCredentials } from './config';
import { solveCaptcha } from '@/lib/captcha';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

puppeteer.use(StealthPlugin());

type ProgressCallback = (percent: number, message: string) => void;

export interface TurmobBotOptions {
    tenantId: string;
    username: string;
    password: string;
    captchaKey?: string;
    onProgress?: ProgressCallback;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTurmobBot(options: TurmobBotOptions) {
    const { tenantId, username, password, captchaKey, onProgress } = options;
    const startTime = Date.now();

    const report = (percent: number, message: string) => {
        console.log(`[TURMOB-BOT] %${percent} - ${message}`);
        onProgress?.(percent, message);
    };

    let browser = null;
    let page = null;

    // Unique download path for this session
    const downloadPath = path.resolve(process.cwd(), 'downloads', tenantId);

    // Clean/Create directory
    if (fs.existsSync(downloadPath)) {
        fs.rmSync(downloadPath, { recursive: true, force: true });
    }
    fs.mkdirSync(downloadPath, { recursive: true });

    try {
        report(5, "Tarayıcı başlatılıyor...");

        // Force headless mode (always true)
        const isHeadless = true;

        browser = await puppeteer.launch({
            headless: isHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--start-maximized',
                '--ignore-certificate-errors'
            ],
            defaultViewport: isHeadless ? { width: 1920, height: 1080 } : null,
            timeout: 120000
        });

        page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        // Configure download behavior
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════════════
        report(10, "Giriş sayfasına gidiliyor...");
        await page.goto(TURMOB_CONFIG.LOGIN_URL, { waitUntil: 'networkidle0', timeout: TURMOB_CONFIG.TIMEOUTS.PAGE_LOAD });
        await delay(TURMOB_CONFIG.DELAYS.PAGE_LOAD);

        let loginSuccessful = false;
        let captchaRetryCount = 0;

        while (!loginSuccessful && captchaRetryCount < TURMOB_CONFIG.MAX_CAPTCHA_RETRIES) {
            report(15, "Kullanıcı bilgileri giriliyor...");

            // Wait for TÜRMOB tab and click it
            await page.waitForSelector(TURMOB_CONFIG.SELECTORS.TAB_TURMOB, { visible: true, timeout: 10000 });
            await page.click(TURMOB_CONFIG.SELECTORS.TAB_TURMOB);
            await delay(TURMOB_CONFIG.DELAYS.SHORT);

            // Fill username
            await page.waitForSelector(TURMOB_CONFIG.SELECTORS.USERNAME, { visible: true });
            await page.click(TURMOB_CONFIG.SELECTORS.USERNAME);
            await page.type(TURMOB_CONFIG.SELECTORS.USERNAME, username, { delay: 50 });

            // Fill password
            await page.waitForSelector(TURMOB_CONFIG.SELECTORS.PASSWORD, { visible: true });
            await page.click(TURMOB_CONFIG.SELECTORS.PASSWORD);
            await page.type(TURMOB_CONFIG.SELECTORS.PASSWORD, password, { delay: 50 });

            report(20, "CAPTCHA çözülüyor...");

            // Handle CAPTCHA
            await delay(TURMOB_CONFIG.DELAYS.MEDIUM);
            const captchaImg = await page.$(TURMOB_CONFIG.SELECTORS.CAPTCHA_IMAGE);

            if (captchaImg) {
                const captchaBase64 = await captchaImg.screenshot({ encoding: "base64" });
                const captchaSolution = captchaKey ? await solveCaptcha(captchaBase64 as string, captchaKey) : null;

                if (captchaSolution) {
                    await page.waitForSelector(TURMOB_CONFIG.SELECTORS.CAPTCHA_INPUT, { timeout: 10000 });

                    await page.evaluate((solution: string) => {
                        const input = document.querySelector('input#guvenlik') as HTMLInputElement;
                        if (!input) return false;

                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype,
                            "value"
                        )?.set;

                        nativeInputValueSetter?.call(input, solution);
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                        return true;
                    }, captchaSolution);
                } else {
                    throw new Error("CAPTCHA çözülemedi");
                }
            }

            report(40, "Giriş yapılıyor...");

            // Submit login
            await page.waitForSelector(TURMOB_CONFIG.SELECTORS.LOGIN_BUTTON, { visible: true });
            await page.click(TURMOB_CONFIG.SELECTORS.LOGIN_BUTTON);

            try {
                await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 });
            } catch {
                // Navigation might not trigger
            }

            await delay(TURMOB_CONFIG.DELAYS.LONG);

            // Check login success
            const currentUrl = page.url();
            if (!currentUrl.includes('/sign') && !currentUrl.includes('login')) {
                loginSuccessful = true;
                report(50, "Giriş başarılı!");
            } else {
                captchaRetryCount++;
                if (captchaRetryCount < TURMOB_CONFIG.MAX_CAPTCHA_RETRIES) {
                    report(15, `CAPTCHA yeniden deneniyor (${captchaRetryCount}/${TURMOB_CONFIG.MAX_CAPTCHA_RETRIES})...`);
                    await page.goto(TURMOB_CONFIG.LOGIN_URL, { waitUntil: 'networkidle0' });
                    await delay(TURMOB_CONFIG.DELAYS.MEDIUM);
                }
            }
        }

        if (!loginSuccessful) {
            throw new Error(`Giriş ${TURMOB_CONFIG.MAX_CAPTCHA_RETRIES} denemede başarısız oldu`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Navigate to Contracts List
        // ═══════════════════════════════════════════════════════════════════
        report(60, "Sözleşmeler sayfasına gidiliyor...");
        await page.goto(TURMOB_CONFIG.CONTRACTS_URL, { waitUntil: 'networkidle2' });
        await delay(TURMOB_CONFIG.DELAYS.MEDIUM);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Open Export Modal
        // ═══════════════════════════════════════════════════════════════════
        report(70, "Dışa aktarma menüsü açılıyor...");
        await page.waitForSelector(TURMOB_CONFIG.SELECTORS.EXPORT_BTN, { visible: true });
        await page.click(TURMOB_CONFIG.SELECTORS.EXPORT_BTN);
        await delay(TURMOB_CONFIG.DELAYS.MEDIUM);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Set Filters and Download
        // ═══════════════════════════════════════════════════════════════════
        report(75, "Filtreler ayarlanıyor...");

        await page.waitForSelector(TURMOB_CONFIG.SELECTORS.PERIOD_SELECT);
        await page.select(TURMOB_CONFIG.SELECTORS.PERIOD_SELECT, '2025');

        await page.waitForSelector(TURMOB_CONFIG.SELECTORS.STATUS_SELECT);
        await page.select(TURMOB_CONFIG.SELECTORS.STATUS_SELECT, '1');

        report(80, "Excel dosyası indiriliyor...");
        await page.click(TURMOB_CONFIG.SELECTORS.EXCEL_BTN);

        // Wait for file download
        let newFile = '';
        const startWait = Date.now();

        while (Date.now() - startWait < TURMOB_CONFIG.TIMEOUTS.DOWNLOAD_WAIT) {
            const currentFiles = fs.readdirSync(downloadPath);
            const diff = currentFiles.filter(f =>
                (f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls')) &&
                !f.toLowerCase().endsWith('.crdownload') &&
                !f.toLowerCase().endsWith('.tmp')
            );

            if (diff.length > 0) {
                newFile = path.join(downloadPath, diff[0]);
                await delay(2000); // Wait for file to stabilize

                try {
                    const stats = fs.statSync(newFile);
                    if (stats.size > 0) {
                        break;
                    }
                } catch (e) { /* ignore */ }
            }
            await delay(1000);
        }

        if (!newFile) {
            throw new Error('Dosya indirilemedi veya zaman aşımı');
        }

        report(90, "Dosya işleniyor...");

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Parse Excel
        // ═══════════════════════════════════════════════════════════════════
        const workbook = new ExcelJS.Workbook();
        let retryCount = 0;
        let loadSuccess = false;

        while (retryCount < 5 && !loadSuccess) {
            try {
                await workbook.xlsx.readFile(newFile);
                loadSuccess = true;
            } catch (e) {
                console.log(`Okuma başarısız (deneme ${retryCount + 1})...`, e);
                await delay(2000);
                retryCount++;
            }
        }

        if (!loadSuccess) {
            throw new Error("Excel dosyası okunamadı");
        }

        // Close browser after reading
        if (browser) {
            await browser.close();
            browser = null;
        }

        if (workbook.worksheets.length === 0) {
            throw new Error('Excel dosyası boş');
        }

        const worksheet = workbook.worksheets[0];

        // Find header row and extract data
        let headerRowIndex = 1;
        const rawData: any[][] = [];

        worksheet.eachRow((row, rowNumber) => {
            const rowValues = row.values as any[];
            // row.values[0] is always undefined in exceljs
            rawData.push(rowValues.slice(1));

            if (rowNumber <= 20) {
                const rowStr = JSON.stringify(rowValues).toLowerCase();
                if (rowStr.includes('ünvan') || rowStr.includes('vkn') || rowStr.includes('vergi no')) {
                    headerRowIndex = rowNumber;
                }
            }
        });

        // Convert to JSON format with headers
        const headers = rawData[headerRowIndex - 1] || [];
        const data: Record<string, any>[] = [];

        for (let i = headerRowIndex; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const obj: Record<string, any> = {};
            headers.forEach((header: any, index: number) => {
                if (header) {
                    obj[String(header)] = row[index] ?? '';
                }
            });
            data.push(obj);
        }

        // Cleanup
        try {
            fs.rmSync(downloadPath, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error("Cleanup warning:", cleanupError);
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        report(100, `İşlem tamamlandı (${duration} saniye)`);

        return { success: true, data };

    } catch (error) {
        console.error('TÜRMOB Bot Error:', error);

        if (browser && page) {
            try {
                const errorScreenshotPath = path.join(process.cwd(), 'downloads', `turmob_error_${Date.now()}.png`);
                await page.screenshot({ path: errorScreenshotPath });
            } catch (screenshotError) { /* ignore */ }
        }

        return { success: false, error: (error as Error).message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
