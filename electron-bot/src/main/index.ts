/**
 * SMMM Asistan - Electron Main Process
 * =====================================
 * Ana süreç: Pencere yönetimi, system tray, WebSocket client
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import jwt from 'jsonwebtoken';
import { WebSocketClient } from './ws-client';
import { runEbeyannamePipeline, stopBot } from './ebeyanname-api';
import { syncGibTaxpayers } from './gib-mukellef';
import { initDatabase, getSession, saveSession, clearSession } from './db';

// Internal API token helper
function getInternalHeaders(tenantId: string): Record<string, string> {
    const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('[ELECTRON] INTERNAL_API_SECRET veya JWT_SECRET yapılandırılmamış');
    }
    const token = jwt.sign({ tenantId, purpose: 'internal-api' }, secret, { expiresIn: '1h' });
    return {
        'Content-Type': 'application/json',
        'X-Internal-Token': token,
    };
}
// NOT: API bot kaldırıldı - Puppeteer yöntemi kullanılıyor

// GPU cache hatalarını önle (Windows'ta "Unable to move the cache" hatası)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.disableHardwareAcceleration();

// Globals
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wsClient: WebSocketClient | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV !== 'production';

interface LoginResponse {
    success: boolean;
    user?: unknown;
    token?: string;
    error?: string;
}

/**
 * Create main window
 */
/**
 * Create main window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 650,
        resizable: false,
        frame: true,            // Çerçeveyi geri getiriyoruz ama menüyü gizleyeceğiz
        autoHideMenuBar: true,  // Menü çubuğunu gizle
        center: true,
        show: false,
        backgroundColor: '#ffffff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
    });

    // Menü çubuğunu tamamen kaldır
    mainWindow.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);

    // Load content
    if (isDev) {
        // Poll for dev server
        const loadURL = async () => {
            try {
                await mainWindow?.loadURL('http://localhost:5173');
            } catch (e) {
                console.log('Waiting for dev server...');
                setTimeout(loadURL, 1000);
            }
        };
        loadURL();
        // DevTools'u gizle - production'a yakın görünüm
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Create system tray
 */
function createTray() {
    const icon = nativeImage.createFromPath(
        path.join(__dirname, '../../assets/icon.png')
    ).resize({ width: 16, height: 16 });

    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'SMMM Asistan',
            enabled: false,
        },
        { type: 'separator' },
        {
            label: 'Göster',
            click: () => mainWindow?.show()
        },
        { type: 'separator' },
        {
            label: 'Çıkış',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        },
    ]);

    tray.setToolTip('SMMM Asistan');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow?.show();
    });
}

/**
 * Bot tamamlandığında native bildirim göster (pencere gizli/minimize ise)
 */
function showCompletionNotification(stats: {
    downloaded: number;
    skipped: number;
    failed: number;
    duration: number;
    newCustomers?: number;
}) {
    if (!Notification.isSupported()) return;

    const parts = [
        `${stats.downloaded} dosya indirildi`,
        stats.skipped > 0 ? `${stats.skipped} atlandı` : null,
        stats.failed > 0 ? `${stats.failed} hata` : null,
        `Süre: ${stats.duration}s`
    ].filter(Boolean);

    const notification = new Notification({
        title: 'GİB Bot Tamamlandı',
        body: parts.join(' | '),
        icon: path.join(__dirname, '../../assets/icon.png'),
        silent: false
    });

    notification.on('click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });

    notification.show();
}

// ═══════════════════════════════════════════════════════════════════
// IPC HANDLERS - Moved to setupIpcHandlers() to run after app.whenReady()
// ═══════════════════════════════════════════════════════════════════

function setupIpcHandlers() {
    // Login
    ipcMain.handle('auth:login', async (_, email: string, password: string) => {
        try {
            console.log('[AUTH] 🔐 Giriş denemesi:', email);
            const apiUrl = process.env.API_URL || 'http://localhost:3000';
            console.log('[AUTH] API URL:', apiUrl);

            // Call website API to authenticate
            const response = await fetch(`${apiUrl}/api/auth/electron-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json() as LoginResponse;

            if (data.success && data.user && data.token) {
                console.log('[AUTH] ✅ Giriş başarılı!');

                // Save to local storage
                saveSession(data.user, data.token);

                // Connect to WebSocket
                console.log('[AUTH] 🔌 WebSocket bağlantısı kuruluyor...');
                connectWebSocket(data.token);

                return { success: true, user: data.user, token: data.token };
            }

            console.log('[AUTH] ❌ Giriş başarısız:', data.error);
            return { success: false, error: data.error || 'Giriş başarısız' };
        } catch (error) {
            console.error('[AUTH] ❌ Bağlantı hatası:', error);
            return { success: false, error: 'Sunucuya bağlanılamadı' };
        }
    });

    // Get stored session
    ipcMain.handle('auth:getSession', async () => {
        return getSession();
    });

    // Logout
    ipcMain.handle('auth:logout', async () => {
        clearSession();
        wsClient?.disconnect();
        wsClient = null;
    });

    // Window controls
    ipcMain.handle('window:minimize', () => {
        mainWindow?.hide();
    });

    ipcMain.handle('window:close', () => {
        isQuitting = true;
        app.quit();
    });

    // NOT: GİB API test handlers kaldırıldı - Puppeteer yöntemi kullanılıyor
}

// ═══════════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════════

interface BotCommandData {
    type: string;
    progress?: number;
    message?: string;
    [key: string]: unknown;
}

function connectWebSocket(token: string) {
    const wsUrl = process.env.WS_URL || 'ws://localhost:3001';

    wsClient = new WebSocketClient(wsUrl, token);



    wsClient.on('bot:start', async (data: BotCommandData) => {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🚀 BOT:START - E-Beyanname HTTP API Pipeline Başlatılıyor');
        console.log('[MAIN] Parametreler:', {
            tenantId: data.tenantId,
            username: data.username,
            hasPassword: !!data.password,
            hasParola: !!data.parola,
            startDate: data.startDate,
            endDate: data.endDate
        });
        console.log('═══════════════════════════════════════════════════════════════');

        // Notify renderer
        mainWindow?.webContents.send('bot:command', { ...data, type: 'start' });

        // Minimize to tray
        mainWindow?.hide();

        // Token'ı session'dan al
        const session = getSession();
        const captchaApiKey = (data.captchaApiKey as string) || process.env.CAPTCHA_API_KEY;
        const ocrSpaceApiKey = (data.ocrSpaceApiKey as string) || process.env.OCR_SPACE_API_KEY;

        // Progress callback
        const onProgress = (type: string, payload: any) => {
            if (wsClient) {
                if (type === 'progress') {
                    wsClient.sendProgress(payload.progress, payload.message);
                    mainWindow?.webContents.send('bot:command', { type: 'progress', ...payload });
                } else if (type === 'complete') {
                    wsClient.sendComplete({ ...payload, tenantId: data.tenantId, startDate: data.startDate });
                    mainWindow?.webContents.send('bot:command', { type: 'complete', ...payload });

                    // Pencere gizli/minimize ise native bildirim göster (pencereyi açma!)
                    const isWindowHidden = !mainWindow?.isVisible() || mainWindow?.isMinimized();
                    if (isWindowHidden && payload.stats) {
                        showCompletionNotification(payload.stats);
                        // Pencereyi AÇMA - kullanıcı bildirime tıklarsa açılacak
                    } else {
                        // Pencere zaten görünürse öne getir
                        mainWindow?.show();
                    }
                } else if (type === 'batch-results') {
                    wsClient.send('bot:batch-results', payload);
                } else if (type === 'error') {
                    const errorMsg = payload.error || payload.message || 'Bilinmeyen hata';
                    const errorCode = payload.errorCode || payload.gibError?.code || 'UNKNOWN';
                    wsClient.sendError(errorMsg, errorCode, payload.gibError);
                    mainWindow?.webContents.send('bot:command', { type: 'error', ...payload });
                    mainWindow?.show();
                }
            }
        };

        try {
            // ═══════════════════════════════════════════════════════════════
            // E-BEYANNAME HTTP API PIPELINE
            // ═══════════════════════════════════════════════════════════════
            console.log('[MAIN] 🌐 E-Beyanname HTTP API Pipeline çalıştırılıyor...');

            await runEbeyannamePipeline({
                tenantId: data.tenantId as string,
                username: data.username as string,
                password: data.password as string,
                parola: data.parola as string,
                startDate: data.startDate as string,
                endDate: data.endDate as string,
                captchaKey: captchaApiKey,
                ocrSpaceApiKey,
                token: session?.token,
                vergiNo: data.vergiNo as string | undefined,
                tcKimlikNo: data.tcKimlikNo as string | undefined,
                beyannameTuru: data.beyannameTuru as string | undefined,
                onProgress
            });

        } catch (e: any) {
            console.error('[MAIN] Bot error:', e);
            if (wsClient) wsClient.sendError(e.message);
            mainWindow?.webContents.send('bot:command', { type: 'error', message: e.message });
            mainWindow?.show();
        }
    });

    // Bot Stop Handler
    wsClient.on('bot:stop', () => {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🛑 BOT:STOP - Bot durdurma komutu alındı!');
        console.log('═══════════════════════════════════════════════════════════════');

        // Bot'u durdur
        stopBot();

        // Renderer'a bildir
        mainWindow?.webContents.send('bot:command', { type: 'stopped', message: 'Bot durduruldu' });

        // Pencereyi göster
        mainWindow?.show();
    });

    // GİB Mükellef Listesi Sync Handler
    wsClient.on('gib:sync-taxpayers', async (data: BotCommandData) => {
        mainWindow?.webContents.send('bot:command', { ...data, type: 'start' });
        mainWindow?.hide();

        // Captcha API key: WebSocket'ten gelen veya env'den al
        const captchaApiKey = (data.captchaApiKey as string) || process.env.CAPTCHA_API_KEY;

        console.log('[MAIN] GİB Mükellef sync starting with data:', data);
        console.log('[MAIN] Captcha API Key:', captchaApiKey ? 'Mevcut (' + captchaApiKey.substring(0, 6) + '...)' : 'Yok');

        try {
            await syncGibTaxpayers({
                username: data.username as string,
                password: data.password as string,
                captchaApiKey: captchaApiKey,
                onProgress: (type: string, payload: any) => {
                    if (wsClient) {
                        if (type === 'progress') {
                            wsClient.sendProgress(payload.progress, payload.message);
                            mainWindow?.webContents.send('bot:command', { type: 'progress', ...payload });
                        } else if (type === 'mukellef-data') {
                            // Send mükellef data to import API
                            console.log(`[MAIN] Sending ${payload.taxpayers?.length || 0} taxpayers to import API...`);
                            wsClient.send('bot:mukellef-data', { ...payload, tenantId: data.tenantId });
                        } else if (type === 'complete') {
                            wsClient.sendComplete({ ...payload, tenantId: data.tenantId });
                            mainWindow?.webContents.send('bot:command', { type: 'complete', ...payload });
                            mainWindow?.show();
                        } else if (type === 'error') {
                            const errorMsg = payload.error || payload.message || 'Bilinmeyen hata';
                            const errorCode = payload.errorCode || payload.gibError?.code || 'UNKNOWN';
                            wsClient.sendError(errorMsg, errorCode, payload.gibError);
                            mainWindow?.webContents.send('bot:command', { type: 'error', ...payload });
                            mainWindow?.show();
                        }
                    }
                }
            });
        } catch (e: any) {
            console.error('[MAIN] GİB Mükellef sync error:', e);
            if (wsClient) wsClient.sendError(e.message);
            mainWindow?.webContents.send('bot:command', { type: 'error', message: e.message });
            mainWindow?.show();
        }
    });

    // SGK Parse Files Handler - Supabase'den dosyaları çek ve parse et
    wsClient.on('sgk:parse-files', async (data: BotCommandData) => {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📊 SGK:PARSE-FILES - SGK Dosyaları Parse Ediliyor');
        console.log('[MAIN] Dönem:', data.year, '/', data.month);
        console.log('[MAIN] Tenant:', data.tenantId);
        if (data.groupId) console.log('[MAIN] Grup:', data.groupId);
        console.log('═══════════════════════════════════════════════════════════════');

        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        const tenantId = data.tenantId as string;
        const year = data.year as number;
        const month = data.month as number;
        const groupId = data.groupId as string | undefined;

        // Notify renderer
        mainWindow?.webContents.send('bot:command', {
            type: 'sgk-parse-start',
            message: 'SGK dosyaları parse ediliyor...',
            year,
            month
        });

        // Progress callback
        const sendProgress = (progress: number, message: string) => {
            if (wsClient) {
                wsClient.sendProgress(progress, message);
            }
            mainWindow?.webContents.send('bot:command', { type: 'progress', progress, message });
        };

        try {
            sendProgress(5, 'Dosya listesi alınıyor...');

            // 1. API'den dosya listesini al
            const groupQuery = groupId ? `&groupId=${groupId}` : '';
            const filesResponse = await fetch(
                `${apiUrl}/api/sgk-kontrol/files?year=${year}&month=${month}${groupQuery}`,
                {
                    headers: getInternalHeaders(tenantId),
                }
            );

            if (!filesResponse.ok) {
                throw new Error('Dosya listesi alınamadı');
            }

            const filesData = await filesResponse.json();
            const customers = filesData.customers || [];

            if (customers.length === 0) {
                sendProgress(100, 'Bu dönemde SGK dosyası bulunamadı');
                if (wsClient) {
                    wsClient.send('sgk:parse-complete', {
                        success: true,
                        message: 'Bu dönemde SGK dosyası bulunamadı',
                        parsed: 0
                    });
                }
                return;
            }

            console.log(`[MAIN] ${customers.length} müşteri için dosya bulundu`);
            sendProgress(10, `${customers.length} müşteri bulundu, dosyalar işleniyor...`);

            // 2. Her müşteri için dosyaları indir ve parse et
            // NOT: Birden fazla SGK tahakkuku/hizmet listesi olan mükellefler için
            // tüm dosyalar parse edilip değerler TOPLANIR
            const { parseHizmetListesi, parseTahakkukFisi } = await import('./sgk-parser');
            const results: Array<{
                customerId: string;
                year: number;
                month: number;
                hizmet?: { isciSayisi: number; onayTarihi: string | null; documentId: string; dosyaSayisi: number };
                tahakkuk?: { isciSayisi: number; gunSayisi: number; netTutar: number; kabulTarihi: string | null; documentId: string; dosyaSayisi: number };
            }> = [];

            let processed = 0;
            for (const customer of customers) {
                try {
                    const result: typeof results[0] = {
                        customerId: customer.customerId,
                        year,
                        month,
                    };

                    // === HİZMET LİSTELERİ PARSE (ÇOKLU DOSYA DESTEĞİ) ===
                    const hizmetler = customer.hizmetler || (customer.hizmet ? [customer.hizmet] : []);
                    if (hizmetler.length > 0) {
                        let toplamIsciSayisi = 0;
                        let sonOnayTarihi: string | null = null;
                        const documentIds: string[] = [];
                        let basariliParseSayisi = 0;

                        console.log(`[MAIN] ${customer.customerUnvan}: ${hizmetler.length} hizmet listesi dosyası bulundu`);

                        for (const hizmetDoc of hizmetler) {
                            if (!hizmetDoc?.url) continue;
                            try {
                                const hizmetRes = await fetch(hizmetDoc.url);
                                if (hizmetRes.ok) {
                                    const blob = await hizmetRes.blob();
                                    const buffer = await blob.arrayBuffer();
                                    const base64 = Buffer.from(buffer).toString('base64');

                                    const parsed = await parseHizmetListesi(base64);
                                    if (parsed) {
                                        toplamIsciSayisi += parsed.isciSayisi;
                                        if (parsed.onayTarihi) sonOnayTarihi = parsed.onayTarihi;
                                        documentIds.push(hizmetDoc.documentId);
                                        basariliParseSayisi++;
                                        console.log(`[MAIN]   -> Hizmet listesi parse: ${parsed.isciSayisi} işçi`);
                                    }
                                }
                            } catch (hizmetError) {
                                console.error(`[MAIN] Hizmet parse hatası (${customer.customerUnvan}):`, hizmetError);
                            }
                        }

                        if (basariliParseSayisi > 0) {
                            result.hizmet = {
                                isciSayisi: toplamIsciSayisi,
                                onayTarihi: sonOnayTarihi,
                                documentId: documentIds.join(','), // Birden fazla ID virgülle ayrılır
                                dosyaSayisi: basariliParseSayisi,
                            };
                            console.log(`[MAIN]   => TOPLAM HİZMET: ${toplamIsciSayisi} işçi (${basariliParseSayisi} dosya)`);
                        }
                    }

                    // === TAHAKKUK FİŞLERİ PARSE (ÇOKLU DOSYA DESTEĞİ) ===
                    const tahakkuklar = customer.tahakkuklar || (customer.tahakkuk ? [customer.tahakkuk] : []);
                    if (tahakkuklar.length > 0) {
                        let toplamIsciSayisi = 0;
                        let toplamGunSayisi = 0;
                        let toplamNetTutar = 0;
                        let sonKabulTarihi: string | null = null;
                        const documentIds: string[] = [];
                        let basariliParseSayisi = 0;

                        console.log(`[MAIN] ${customer.customerUnvan}: ${tahakkuklar.length} tahakkuk fişi dosyası bulundu`);

                        for (const tahakkukDoc of tahakkuklar) {
                            if (!tahakkukDoc?.url) continue;
                            try {
                                const tahakkukRes = await fetch(tahakkukDoc.url);
                                if (tahakkukRes.ok) {
                                    const blob = await tahakkukRes.blob();
                                    const buffer = await blob.arrayBuffer();
                                    const base64 = Buffer.from(buffer).toString('base64');

                                    const parsed = await parseTahakkukFisi(base64);
                                    if (parsed) {
                                        toplamIsciSayisi += parsed.isciSayisi;
                                        toplamGunSayisi += parsed.gunSayisi;
                                        toplamNetTutar += parsed.netTutar;
                                        if (parsed.kabulTarihi) sonKabulTarihi = parsed.kabulTarihi;
                                        documentIds.push(tahakkukDoc.documentId);
                                        basariliParseSayisi++;
                                        console.log(`[MAIN]   -> Tahakkuk parse: ${parsed.isciSayisi} kişi, ${parsed.gunSayisi} gün, ${parsed.netTutar.toLocaleString('tr-TR')} TL`);
                                    }
                                }
                            } catch (tahakkukError) {
                                console.error(`[MAIN] Tahakkuk parse hatası (${customer.customerUnvan}):`, tahakkukError);
                            }
                        }

                        if (basariliParseSayisi > 0) {
                            result.tahakkuk = {
                                isciSayisi: toplamIsciSayisi,
                                gunSayisi: toplamGunSayisi,
                                netTutar: toplamNetTutar,
                                kabulTarihi: sonKabulTarihi,
                                documentId: documentIds.join(','), // Birden fazla ID virgülle ayrılır
                                dosyaSayisi: basariliParseSayisi,
                            };
                            console.log(`[MAIN]   => TOPLAM TAHAKKUK: ${toplamIsciSayisi} kişi, ${toplamGunSayisi} gün, ${toplamNetTutar.toLocaleString('tr-TR')} TL (${basariliParseSayisi} dosya)`);
                        }
                    }

                    // TÜM mükellefleri ekle (dosyası olsun/olmasın)
                    // save-results API'si hizmet ve tahakkuk yoksa "eksik" olarak kaydedecek
                    results.push(result);

                    // Dosya durumunu logla
                    if (!result.hizmet && !result.tahakkuk) {
                        console.log(`[MAIN] ⚠️ ${customer.customerUnvan}: Dosya bulunamadı - EKSİK olarak işaretlenecek`);
                    }

                    processed++;
                    const progress = 10 + Math.floor((processed / customers.length) * 70);
                    sendProgress(progress, `${customer.customerUnvan} işlendi (${processed}/${customers.length})`);

                } catch (customerError) {
                    console.error(`[MAIN] Müşteri hatası (${customer.customerUnvan}):`, customerError);
                    processed++;
                }
            }

            sendProgress(85, 'Sonuçlar kaydediliyor...');

            // 3. Sonuçları API'ye gönder
            if (results.length > 0) {
                const saveResponse = await fetch(`${apiUrl}/api/sgk-kontrol/save-results`, {
                    method: 'POST',
                    headers: getInternalHeaders(tenantId),
                    body: JSON.stringify({ results }),
                });

                if (!saveResponse.ok) {
                    console.error('[MAIN] Sonuçlar kaydedilemedi:', await saveResponse.text());
                }
            }

            sendProgress(100, `${results.length} müşteri için SGK verileri parse edildi`);

            // Tamamlandı bildirimi
            if (Notification.isSupported()) {
                const notification = new Notification({
                    title: 'SGK Parse Tamamlandı',
                    body: `${month}/${year} dönemi için ${results.length} müşteri işlendi.`,
                    icon: path.join(__dirname, '../../assets/icon.png'),
                });
                notification.show();
            }

            // WebSocket bildirimi
            if (wsClient) {
                wsClient.send('sgk:parse-complete', {
                    success: true,
                    message: `${results.length} müşteri için SGK verileri parse edildi`,
                    parsed: results.length,
                    total: customers.length
                });
            }

            mainWindow?.webContents.send('bot:command', {
                type: 'sgk-parse-complete',
                message: `${results.length} müşteri için SGK verileri parse edildi`,
                parsed: results.length
            });

        } catch (error: any) {
            console.error('[MAIN] SGK parse hatası:', error);

            if (wsClient) {
                wsClient.sendError(error.message || 'SGK parse hatası');
            }

            mainWindow?.webContents.send('bot:command', {
                type: 'error',
                message: error.message || 'SGK parse hatası'
            });

            mainWindow?.show();
        }
    });

    // GİB Uygulama Hızlı Giriş Handler (İVD, E-Beyanname, Vergi Levhası, vs.)
    wsClient.on('gib:launch', async (data: BotCommandData) => {
        const application = (data.application as string) || 'ivd';
        const targetPage = data.targetPage as string | undefined;
        const customerName = data.customerName as string | undefined;
        const vergiLevhasiYil = data.vergiLevhasiYil as string | undefined;
        const vergiLevhasiDil = data.vergiLevhasiDil as string | undefined;

        const appNames: Record<string, string> = {
            ivd: 'İnternet Vergi Dairesi',
            ebeyanname: 'E-Beyanname',
        };
        const appName = appNames[application] || application;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`[MAIN] 🌐 GİB ${appName} Hızlı Giriş başlatılıyor...`);
        // Güvenlik: Userid maskeleniyor
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        console.log('[MAIN] Uygulama:', application);
        if (targetPage) console.log('[MAIN] Hedef Sayfa:', targetPage);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        if (vergiLevhasiYil) console.log('[MAIN] Vergi Levhası Yılı:', vergiLevhasiYil);
        if (vergiLevhasiDil) console.log('[MAIN] Vergi Levhası Dili:', vergiLevhasiDil);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'gib-launch-start', application, targetPage, customerName });

        // NOT: Electron penceresi ön plana getirilmiyor - kullanıcı simge durumunda çalışabilir
        // Chrome penceresi gib-launcher.ts'de CDP ile maximize edilip ön plana getiriliyor

        try {
            const { launchGibApplication } = await import('./gib-launcher');

            const result = await launchGibApplication({
                userid: data.userid as string,
                password: data.password as string,
                application: application as 'ivd' | 'ebeyanname',
                targetPage: targetPage as 'borc-sorgulama' | 'odemelerim' | 'emanet-defterim' | 'e-tebligat' | 'vergi-levhasi' | undefined,
                customerName,
                vergiLevhasiYil: vergiLevhasiYil as '2023' | '2024' | '2025' | '2026' | undefined,
                vergiLevhasiDil: vergiLevhasiDil as 'tr' | 'en' | undefined,
                onProgress: (status: string) => {
                    console.log(`[GIB-LAUNCHER] ${status}`);
                    wsClient?.send('gib:launch-progress', { status, application, targetPage, customerName });
                    mainWindow?.webContents.send('bot:command', { type: 'gib-launch-progress', status, application });
                }
            });

            if (result.success) {
                wsClient?.send('gib:launch-complete', { success: true, application, targetPage, customerName });
                mainWindow?.webContents.send('bot:command', { type: 'gib-launch-complete', success: true, application });
            } else {
                wsClient?.sendError(result.error || `${appName} başlatılamadı`);
                mainWindow?.webContents.send('bot:command', { type: 'gib-launch-error', error: result.error, application });
            }
        } catch (e: any) {
            console.error(`[MAIN] ${appName} hatası:`, e);
            wsClient?.sendError(e.message || `${appName} hatası`);
            mainWindow?.webContents.send('bot:command', { type: 'gib-launch-error', error: e.message, application });
        }
    });

    // Backward compatibility: gib:launch-ivd handler (eski API için)
    wsClient.on('gib:launch-ivd', async (data: BotCommandData) => {
        console.log('[MAIN] ⚠️ Deprecated: gib:launch-ivd kullanıldı, gib:launch\'a yönlendiriliyor...');
        // Eski handler'ı yeni handler'a yönlendir
        wsClient?.emit('gib:launch', { ...data, application: 'ivd' });
    });

    // E-Arşiv Portal (GİB 5000/2000) Hızlı Giriş Handler
    wsClient.on('earsiv:launch', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📄 E-Arşiv Portal (GİB 5000/2000) Hızlı Giriş başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'earsiv-launch-start', customerName });

        try {
            const { launchEarsivPortal } = await import('./earsiv-launcher');

            const result = await launchEarsivPortal({
                userid: data.userid as string,
                password: data.password as string,
                customerName,
                onProgress: (status: string) => {
                    console.log(`[EARSIV-LAUNCHER] ${status}`);
                    wsClient?.send('earsiv:launch-progress', { status, customerName });
                    mainWindow?.webContents.send('bot:command', { type: 'earsiv-launch-progress', status });
                }
            });

            if (result.success) {
                wsClient?.send('earsiv:launch-complete', { success: true, customerName });
                mainWindow?.webContents.send('bot:command', { type: 'earsiv-launch-complete', success: true });
            } else {
                wsClient?.sendError(result.error || 'E-Arşiv Portal başlatılamadı');
                mainWindow?.webContents.send('bot:command', { type: 'earsiv-launch-error', error: result.error });
            }
        } catch (e: any) {
            console.error('[MAIN] E-Arşiv Portal hatası:', e);
            wsClient?.sendError(e.message || 'E-Arşiv Portal hatası');
            mainWindow?.webContents.send('bot:command', { type: 'earsiv-launch-error', error: e.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // E-Arşiv Dijital VD Fatura Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    // Aktif sorgu tracking — aynı mükellef çift sorgu engelleme (WI-4)
    const activeEarsivQueries = new Map<string, boolean>();

    wsClient.on('earsiv:query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined; // PM-3: requesterId

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📄 E-Arşiv Dijital VD Fatura Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', data.startDate, '-', data.endDate);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'earsiv-query-start', customerName });

        // WI-4: Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `${data.userid}-${data.startDate}-${data.endDate}`;
        if (activeEarsivQueries.has(queryKey)) {
            wsClient?.send('earsiv:query-error', {
                error: 'Bu mükellef için zaten bir sorgulama devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeEarsivQueries.set(queryKey, true);

        // 5 dakika global timeout (F6)
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { gibDijitalLogin, queryEarsivAliciList } = await import('./earsiv-dijital-api');

            const queryWork = async () => {
                // PM-2: WS bağlantı kontrolü
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                // 1. Login
                wsClient?.send('earsiv:query-progress', {
                    status: 'GİB Dijital VD\'ye giriş yapılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                const captchaApiKey = data.captchaApiKey as string;
                const ocrSpaceApiKey = data.ocrSpaceApiKey as string | undefined;

                const token = await gibDijitalLogin(
                    data.userid as string,
                    data.password as string,
                    captchaApiKey,
                    ocrSpaceApiKey,
                    (status) => {
                        wsClient?.send('earsiv:query-progress', {
                            status, customerName, phase: 'login', requesterId,
                        });
                    },
                );

                // 2. Query with streaming
                return await queryEarsivAliciList(
                    token,
                    { startDate: data.startDate as string, endDate: data.endDate as string },
                    captchaApiKey,
                    ocrSpaceApiKey,
                    { userid: data.userid as string, sifre: data.password as string },
                    (status) => {
                        // PM-2: Her progress'te WS bağlantı kontrolü
                        if (wsClient?.connected) {
                            wsClient.send('earsiv:query-progress', {
                                status, customerName, phase: 'query', requesterId,
                            });
                        }
                    },
                    (invoices, progress) => {
                        if (wsClient?.connected) {
                            wsClient.send('earsiv:query-results', {
                                invoices, progress, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./earsiv-dijital-api').EarsivQueryResult;

            // Complete — failedChunks varsa partial success uyarısı (F3)
            wsClient?.send('earsiv:query-complete', {
                success: true,
                totalCount: result.totalCount,
                customerName,
                completedChunks: result.completedChunks,
                failedChunks: result.failedChunks,
                sessionRefreshed: result.sessionRefreshed,
                requesterId,
            });
        } catch (e: any) {
            // Yapılandırılmış hata kodları (F12)
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'E-Arşiv sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez. Lütfen birkaç dakika sonra tekrar deneyin.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('GIB_API_CHANGED')) {
                errorCode = 'GIB_API_CHANGED';
                errorMessage = 'GİB API yanıt formatı değişmiş olabilir. Lütfen uygulama güncellemesini kontrol edin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            } else if (e.message?.includes('rate') || e.message?.includes('429') || e.message?.includes('RATE_LIMIT')) {
                errorCode = 'RATE_LIMIT';
                errorMessage = 'GİB istek limiti aşıldı. Birkaç dakika bekleyip tekrar deneyin.';
            } else if (e.message?.startsWith('INVALID_DATE_RANGE')) {
                errorCode = 'INVALID_DATE_RANGE';
                errorMessage = e.message.replace('INVALID_DATE_RANGE: ', '');
            }

            wsClient?.send('earsiv:query-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            // WI-4: Aktif sorgu kaydını temizle
            activeEarsivQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Vergi Tahsil Alındıları Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    const activeIntrvrgQueries = new Map<string, boolean>();

    wsClient.on('intvrg:tahsilat-query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🧾 INTVRG Vergi Tahsil Alındıları Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-tahsilat-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
        if (activeIntrvrgQueries.has(queryKey)) {
            wsClient?.send('intvrg:tahsilat-error', {
                error: 'Bu mükellef için zaten bir tahsilat sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeIntrvrgQueries.set(queryKey, true);

        // 5 dakika global timeout
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { queryTahsilatlar } = await import('./intvrg-tahsilat-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:tahsilat-progress', {
                    status: 'Tahsilat sorgulaması başlatılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                return await queryTahsilatlar(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        vkn: data.vkn as string,
                        basAy: data.basAy as string,
                        basYil: data.basYil as string,
                        bitAy: data.bitAy as string,
                        bitYil: data.bitYil as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:tahsilat-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                    (tahsilatlar, meta) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:tahsilat-results', {
                                tahsilatlar, meta, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./intvrg-tahsilat-api').TahsilatQueryResult;

            if (result.success) {
                wsClient?.send('intvrg:tahsilat-complete', {
                    success: true,
                    totalCount: result.tahsilatlar.length,
                    customerName,
                    vergidairesi: result.vergidairesi,
                    adsoyadunvan: result.adsoyadunvan,
                    sorgudonemi: result.sorgudonemi,
                    requesterId,
                });
            } else {
                wsClient?.send('intvrg:tahsilat-error', {
                    error: result.error || 'Tahsilat sorgulaması başarısız',
                    errorCode: 'QUERY_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Tahsilat sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) {
                errorCode = 'IVD_ERROR';
                errorMessage = 'İnternet Vergi Dairesi oturumu açılamadı. Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('NO_VD')) {
                errorCode = 'NO_VD';
                errorMessage = 'Mükellefin bağlı vergi dairesi bulunamadı.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('intvrg:tahsilat-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeIntrvrgQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Beyanname — IVD Token Cache (PDF görüntüleme için)
    // ═══════════════════════════════════════════════════════════════
    // Key: VKN, Value: { token, timestamp }
    const ivdTokenCache = new Map<string, { token: string; timestamp: number }>();
    const IVD_TOKEN_TTL = 25 * 60 * 1000; // 25 dakika (GİB oturumu ~30 dk)

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Beyanname Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════
    const activeBeyannameQueries = new Map<string, boolean>();

    wsClient.on('intvrg:beyanname-query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📋 INTVRG Beyanname Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-beyanname-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `beyanname-${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
        if (activeBeyannameQueries.has(queryKey)) {
            wsClient?.send('intvrg:beyanname-error', {
                error: 'Bu mükellef için zaten bir beyanname sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeBeyannameQueries.set(queryKey, true);

        // 5 dakika global timeout
        const BEYANNAME_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), BEYANNAME_TIMEOUT_MS)
        );

        try {
            const { queryBeyannameler } = await import('./intvrg-beyanname-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:beyanname-progress', {
                    status: 'Beyanname sorgulaması başlatılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                return await queryBeyannameler(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        vkn: data.vkn as string,
                        basAy: data.basAy as string,
                        basYil: data.basYil as string,
                        bitAy: data.bitAy as string,
                        bitYil: data.bitYil as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                    (beyannameler) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-results', {
                                beyannameler, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./intvrg-beyanname-api').BeyannameQueryResult;

            if (result.success) {
                // IVD token'ı PDF görüntüleme için cache'le
                if (result.ivdToken && data.vkn) {
                    ivdTokenCache.set(data.vkn as string, {
                        token: result.ivdToken,
                        timestamp: Date.now(),
                    });
                    console.log(`[INTVRG-TOKEN] IVD token cache'lendi: VKN=${(data.vkn as string).substring(0, 4)}***`);
                }

                wsClient?.send('intvrg:beyanname-complete', {
                    success: true,
                    totalCount: result.beyannameler.length,
                    customerName,
                    sorgudonemi: result.sorgudonemi,
                    requesterId,
                });
            } else {
                wsClient?.send('intvrg:beyanname-error', {
                    error: result.error || 'Beyanname sorgulaması başarısız',
                    errorCode: 'QUERY_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Beyanname sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) {
                errorCode = 'IVD_ERROR';
                errorMessage = 'İnternet Vergi Dairesi oturumu açılamadı. Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('intvrg:beyanname-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeBeyannameQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Beyanname Çoklu Yıl Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════
    wsClient.on('intvrg:beyanname-multi-query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📋 INTVRG Beyanname ÇOKLU YIL Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-beyanname-multi-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `beyanname-multi-${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
        if (activeBeyannameQueries.has(queryKey)) {
            wsClient?.send('intvrg:beyanname-error', {
                error: 'Bu mükellef için zaten bir beyanname sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeBeyannameQueries.set(queryKey, true);

        // Chunk sayısına göre dinamik timeout: chunk başına 3 dakika
        const startYear = parseInt(data.basYil as string, 10);
        const endYear = parseInt(data.bitYil as string, 10);
        const chunkCount = endYear - startYear + 1;
        const MULTI_TIMEOUT_MS = chunkCount * 3 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), MULTI_TIMEOUT_MS)
        );

        try {
            const { queryBeyannamelerMultiYear } = await import('./intvrg-beyanname-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:beyanname-multi-progress', {
                    chunkIndex: 0,
                    totalChunks: chunkCount,
                    year: String(startYear),
                    status: 'Çoklu yıl sorgulaması başlatılıyor...',
                    customerName,
                    requesterId,
                });

                return await queryBeyannamelerMultiYear(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        vkn: data.vkn as string,
                        basAy: data.basAy as string,
                        basYil: data.basYil as string,
                        bitAy: data.bitAy as string,
                        bitYil: data.bitYil as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    {
                        onChunkProgress: (chunkIndex, totalChunks, year, status) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-progress', {
                                    chunkIndex, totalChunks, year, status,
                                    customerName, requesterId,
                                });
                            }
                        },
                        onChunkResults: (chunkIndex, totalChunks, year, beyannameler) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-chunk-results', {
                                    chunkIndex, totalChunks, year, beyannameler,
                                    customerName, requesterId,
                                });
                            }
                        },
                        onAllComplete: (allItems, ivdToken) => {
                            // IVD token'ı PDF görüntüleme için cache'le
                            if (ivdToken && data.vkn) {
                                ivdTokenCache.set(data.vkn as string, {
                                    token: ivdToken,
                                    timestamp: Date.now(),
                                });
                                console.log(`[INTVRG-TOKEN] IVD token cache'lendi (multi): VKN=${(data.vkn as string).substring(0, 4)}***`);
                            }

                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-complete', {
                                    success: true,
                                    totalCount: allItems.length,
                                    customerName,
                                    requesterId,
                                });
                            }
                        },
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            await Promise.race([queryWork(), timeoutPromise]);

        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Çoklu yıl beyanname sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = `Sorgulama zaman aşımına uğradı (${chunkCount * 3} dakika). Lütfen tekrar deneyin.`;
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) {
                errorCode = 'IVD_ERROR';
                errorMessage = 'İnternet Vergi Dairesi oturumu açılamadı. Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('intvrg:beyanname-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeBeyannameQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Beyanname PDF Görüntüleme Handler
    // ═══════════════════════════════════════════════════════════════
    wsClient.on('intvrg:beyanname-pdf', async (data: BotCommandData) => {
        const beyoid = data.beyoid as string;
        const vkn = data.vkn as string;
        const requesterId = data.userId as string | undefined;
        const turAdi = data.turAdi as string | undefined;

        console.log(`[INTVRG-PDF] PDF görüntüleme isteği: beyoid=${beyoid?.substring(0, 8)}..., tür=${turAdi || 'N/A'}`);

        if (!beyoid || !vkn) {
            wsClient?.send('intvrg:beyanname-pdf-error', {
                error: 'beyoid ve vkn parametreleri zorunludur',
                requesterId,
            });
            return;
        }

        // Cache'den IVD token al
        const cached = ivdTokenCache.get(vkn);
        if (!cached || (Date.now() - cached.timestamp) > IVD_TOKEN_TTL) {
            ivdTokenCache.delete(vkn);
            wsClient?.send('intvrg:beyanname-pdf-error', {
                error: 'GİB oturumu süresi dolmuş. Lütfen önce beyanname sorgulaması yapın.',
                errorCode: 'TOKEN_EXPIRED',
                requesterId,
            });
            return;
        }

        try {
            const { fetchBeyannamePdf } = await import('./intvrg-beyanname-api');

            wsClient?.send('intvrg:beyanname-pdf-progress', {
                status: 'PDF indiriliyor...',
                requesterId,
            });

            const result = await fetchBeyannamePdf(cached.token, beyoid);

            if (result.success && result.pdfBase64) {
                wsClient?.send('intvrg:beyanname-pdf-result', {
                    success: true,
                    pdfBase64: result.pdfBase64,
                    turAdi,
                    requesterId,
                });
                console.log(`[INTVRG-PDF] PDF başarıyla gönderildi: ${turAdi || beyoid}`);
            } else {
                // Token geçersiz olabilir, cache'den temizle
                if (result.error?.includes('oturum') || result.error?.includes('401')) {
                    ivdTokenCache.delete(vkn);
                }
                wsClient?.send('intvrg:beyanname-pdf-error', {
                    error: result.error || 'PDF indirilemedi',
                    requesterId,
                });
            }
        } catch (e: any) {
            console.error(`[INTVRG-PDF] PDF hatası: ${e.message}`);
            wsClient?.send('intvrg:beyanname-pdf-error', {
                error: e.message || 'PDF indirme hatası',
                requesterId,
            });
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG POS Bilgileri Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    const activePosQueries = new Map<string, boolean>();

    wsClient.on('intvrg:pos-query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 💳 INTVRG POS Bilgileri Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.ay}/${data.yil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-pos-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `pos-${data.userid}-${data.ay}${data.yil}`;
        if (activePosQueries.has(queryKey)) {
            wsClient?.send('intvrg:pos-error', {
                error: 'Bu mükellef için zaten bir POS sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activePosQueries.set(queryKey, true);

        // 5 dakika global timeout
        const POS_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), POS_TIMEOUT_MS)
        );

        try {
            const { queryPosBilgileri } = await import('./intvrg-pos-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:pos-progress', {
                    status: 'POS sorgulaması başlatılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                return await queryPosBilgileri(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        vkn: data.vkn as string,
                        ay: data.ay as string,
                        yil: data.yil as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:pos-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                    (posBilgileri, meta) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:pos-results', {
                                posBilgileri, meta, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./intvrg-pos-api').PosQueryResult;

            if (result.success) {
                wsClient?.send('intvrg:pos-complete', {
                    success: true,
                    totalCount: result.posBilgileri.length,
                    toplamGenel: result.toplamGenel,
                    customerName,
                    requesterId,
                });
            } else {
                wsClient?.send('intvrg:pos-error', {
                    error: result.error || 'POS sorgulaması başarısız',
                    errorCode: 'QUERY_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'POS sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) {
                errorCode = 'IVD_ERROR';
                errorMessage = 'İnternet Vergi Dairesi oturumu açılamadı. Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('intvrg:pos-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activePosQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // ÖKC Bildirim Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    const activeOkcQueries = new Map<string, boolean>();

    wsClient.on('intvrg:okc-query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] ÖKC Bildirim Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.ay}/${data.yil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-okc-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `okc-${data.userid}-${data.ay}${data.yil}`;
        if (activeOkcQueries.has(queryKey)) {
            wsClient?.send('intvrg:okc-error', {
                error: 'Bu mükellef için zaten bir ÖKC sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeOkcQueries.set(queryKey, true);

        // 5 dakika global timeout
        const OKC_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), OKC_TIMEOUT_MS)
        );

        try {
            const { queryOkcBildirimler } = await import('./intvrg-okc-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:okc-progress', {
                    status: 'ÖKC bildirim sorgulaması başlatılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                return await queryOkcBildirimler(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        vkn: data.vkn as string,
                        ay: data.ay as string,
                        yil: data.yil as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:okc-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                    (bildirimler, meta) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:okc-results', {
                                bildirimler, meta, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./intvrg-okc-api').OkcQueryResult;

            if (result.success) {
                wsClient?.send('intvrg:okc-complete', {
                    success: true,
                    totalCount: result.bildirimler.length,
                    customerName,
                    requesterId,
                });
            } else {
                wsClient?.send('intvrg:okc-error', {
                    error: result.error || 'ÖKC sorgulaması başarısız',
                    errorCode: 'QUERY_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'ÖKC sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) {
                errorCode = 'IVD_ERROR';
                errorMessage = 'İnternet Vergi Dairesi oturumu açılamadı. Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('intvrg:okc-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeOkcQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // E-Tebligat Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    const activeEtebligatQueries = new Map<string, boolean>();
    // Token cache — zarf detay ve PDF için (TTL: 25dk)
    const etebligatTokenCache = new Map<string, { token: string; expires: number }>();

    wsClient.on('etebligat:query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📬 E-Tebligat Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'etebligat-query-start', customerName });

        // Çift sorgu engelleme
        const queryKey = `etebligat-${data.userid}`;
        if (activeEtebligatQueries.has(queryKey)) {
            wsClient?.send('etebligat:query-error', {
                error: 'Bu mükellef için zaten bir e-Tebligat sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName, requesterId,
            });
            return;
        }
        activeEtebligatQueries.set(queryKey, true);

        // 5 dakika global timeout
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { gibDijitalLogin, queryEtebligatlar } = await import('./etebligat-dijital-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                // 1. Login
                wsClient?.send('etebligat:query-progress', {
                    status: 'GİB Dijital VD\'ye giriş yapılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                const captchaApiKey = data.captchaApiKey as string;
                const ocrSpaceApiKey = data.ocrSpaceApiKey as string | undefined;

                const token = await gibDijitalLogin(
                    data.userid as string,
                    data.password as string,
                    captchaApiKey,
                    ocrSpaceApiKey,
                    (status) => {
                        wsClient?.send('etebligat:query-progress', {
                            status, customerName, phase: 'login', requesterId,
                        });
                    },
                );

                // Token cache'e kaydet (25dk TTL)
                const customerId = data.customerId as string || queryKey;
                etebligatTokenCache.set(customerId, {
                    token,
                    expires: Date.now() + 25 * 60 * 1000,
                });

                // 2. Tebligat sorgula
                return await queryEtebligatlar(
                    token,
                    { userid: data.userid as string, sifre: data.password as string },
                    captchaApiKey,
                    ocrSpaceApiKey,
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('etebligat:query-progress', {
                                status, customerName, phase: 'query', requesterId,
                            });
                        }
                    },
                    (tebligatlar, progress) => {
                        if (wsClient?.connected) {
                            wsClient.send('etebligat:query-results', {
                                tebligatlar, progress, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./etebligat-dijital-api').EtebligatQueryResult;

            wsClient?.send('etebligat:query-complete', {
                success: result.success,
                totalCount: result.totalCount,
                sayilar: result.sayilar,
                aktivasyon: result.aktivasyon,
                customerName, requesterId,
                error: result.error,
            });
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'E-Tebligat sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('etebligat:query-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeEtebligatQueries.delete(queryKey);
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // E-Tebligat Zarf Detay Handler (OKUNDU İŞARETLEME!)
    // ═══════════════════════════════════════════════════════════════

    wsClient.on('etebligat:zarf-detay', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log(`[MAIN] 📬 E-Tebligat zarf detay — tarafId: ${data.tarafId}`);

        try {
            const { zarfDetaySorgula } = await import('./etebligat-dijital-api');

            // Token cache'den al
            const customerId = data.customerId as string;
            const cached = etebligatTokenCache.get(customerId);
            if (!cached || cached.expires < Date.now()) {
                wsClient?.send('etebligat:zarf-detay-error', {
                    error: 'Oturum süresi doldu. Lütfen önce tebligatları tekrar sorgulayın.',
                    errorCode: 'TOKEN_EXPIRED',
                    customerName, requesterId,
                });
                return;
            }

            const result = await zarfDetaySorgula(
                cached.token,
                data.tarafId as string,
                data.tarafSecureId as string,
            );

            wsClient?.send('etebligat:zarf-detay-result', {
                success: result.success,
                data: result.data,
                tarafId: data.tarafId,
                customerName, requesterId,
            });
        } catch (e: any) {
            wsClient?.send('etebligat:zarf-detay-error', {
                error: e.message || 'Zarf detay sorgulama hatası',
                errorCode: e.message?.includes('TOKEN_EXPIRED') ? 'TOKEN_EXPIRED' : 'UNKNOWN_ERROR',
                tarafId: data.tarafId,
                customerName, requesterId,
            });
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // E-Tebligat PDF İndirme Handler
    // ═══════════════════════════════════════════════════════════════

    wsClient.on('etebligat:pdf', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log(`[MAIN] 📬 E-Tebligat PDF indirme — tebligId: ${data.tebligId}`);

        try {
            const { belgeGetirVeIndir } = await import('./etebligat-dijital-api');

            // Token cache'den al
            const customerId = data.customerId as string;
            const cached = etebligatTokenCache.get(customerId);
            if (!cached || cached.expires < Date.now()) {
                wsClient?.send('etebligat:pdf-error', {
                    error: 'Oturum süresi doldu. Lütfen önce tebligatları tekrar sorgulayın.',
                    errorCode: 'TOKEN_EXPIRED',
                    customerName, requesterId,
                });
                return;
            }

            const result = await belgeGetirVeIndir(
                cached.token,
                data.tebligId as string,
                data.tebligSecureId as string,
                data.tarafId as string,
                data.tarafSecureId as string,
            );

            if (result.success && result.pdfBase64) {
                wsClient?.send('etebligat:pdf-result', {
                    pdfBase64: result.pdfBase64,
                    tebligId: data.tebligId,
                    customerName, requesterId,
                });
            } else {
                wsClient?.send('etebligat:pdf-error', {
                    error: result.error || 'PDF indirilemedi',
                    tebligId: data.tebligId,
                    customerName, requesterId,
                });
            }
        } catch (e: any) {
            wsClient?.send('etebligat:pdf-error', {
                error: e.message || 'PDF indirme hatası',
                errorCode: e.message?.includes('TOKEN_EXPIRED') ? 'TOKEN_EXPIRED' : 'UNKNOWN_ERROR',
                tebligId: data.tebligId,
                customerName, requesterId,
            });
        }
    });

    // TÜRMOB Luca E-Entegratör Hızlı Giriş Handler
    wsClient.on('turmob:launch', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🔗 TÜRMOB Luca E-Entegratör Hızlı Giriş başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'turmob-launch-start', customerName });

        try {
            const { launchTurmobLuca } = await import('./turmob-launcher');

            const result = await launchTurmobLuca({
                userid: data.userid as string,
                password: data.password as string,
                customerName,
                onProgress: (status: string) => {
                    console.log(`[TURMOB-LAUNCHER] ${status}`);
                    wsClient?.send('turmob:launch-progress', { status, customerName });
                    mainWindow?.webContents.send('bot:command', { type: 'turmob-launch-progress', status });
                }
            });

            if (result.success) {
                wsClient?.send('turmob:launch-complete', { success: true, customerName });
                mainWindow?.webContents.send('bot:command', { type: 'turmob-launch-complete', success: true });
            } else {
                wsClient?.sendError(result.error || 'TÜRMOB Luca başlatılamadı');
                mainWindow?.webContents.send('bot:command', { type: 'turmob-launch-error', error: result.error });
            }
        } catch (e: any) {
            console.error('[MAIN] TÜRMOB Luca hatası:', e);
            wsClient?.sendError(e.message || 'TÜRMOB Luca hatası');
            mainWindow?.webContents.send('bot:command', { type: 'turmob-launch-error', error: e.message });
        }
    });

    // e-Devlet Kapısı Hızlı Giriş Handler
    wsClient.on('edevlet:launch', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🏛️ e-Devlet Kapısı Hızlı Giriş başlatılıyor...');
        const maskedTckn = data.tckn ? `${String(data.tckn).slice(0, 3)}***${String(data.tckn).slice(-2)}` : 'N/A';
        console.log('[MAIN] TCKN:', maskedTckn);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'edevlet-launch-start', customerName });

        try {
            const { launchEdevletKapisi } = await import('./edevlet-launcher');

            const result = await launchEdevletKapisi({
                tckn: data.tckn as string,
                password: data.password as string,
                customerName,
                onProgress: (status: string) => {
                    console.log(`[EDEVLET-LAUNCHER] ${status}`);
                    wsClient?.send('edevlet:launch-progress', { status, customerName });
                    mainWindow?.webContents.send('bot:command', { type: 'edevlet-launch-progress', status });
                }
            });

            if (result.success) {
                wsClient?.send('edevlet:launch-complete', { success: true, customerName });
                mainWindow?.webContents.send('bot:command', { type: 'edevlet-launch-complete', success: true });
            } else {
                wsClient?.sendError(result.error || 'e-Devlet Kapısı başlatılamadı');
                mainWindow?.webContents.send('bot:command', { type: 'edevlet-launch-error', error: result.error });
            }
        } catch (e: any) {
            console.error('[MAIN] e-Devlet Kapısı hatası:', e);
            wsClient?.sendError(e.message || 'e-Devlet Kapısı hatası');
            mainWindow?.webContents.send('bot:command', { type: 'edevlet-launch-error', error: e.message });
        }
    });

    // İŞKUR İşveren Sistemi Handler
    wsClient.on('iskur:launch', async (data: BotCommandData) => {
        const loginMethod = data.loginMethod as 'iskur' | 'edevlet';
        const customerName = data.customerName as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`[MAIN] 🏢 İŞKUR İşveren Sistemi başlatılıyor (${loginMethod})...`);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

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
                mainWindow?.webContents.send('bot:command', { type: 'iskur-launch-error', error: result.error });
            }
        } catch (e: any) {
            console.error('[MAIN] İŞKUR hatası:', e);
            wsClient?.sendError(e.message || 'İŞKUR hatası');
            mainWindow?.webContents.send('bot:command', { type: 'iskur-launch-error', error: e.message });
        }
    });

    // Diğer İşlemler URL Launcher Handler
    wsClient.on('diger-islemler:launch', async (data: BotCommandData) => {
        const actionId = data.actionId as string;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`[MAIN] 🔗 Diğer İşlemler: ${actionId} başlatılıyor...`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', {
            type: 'diger-islemler-launch-start',
            actionId
        });

        try {
            const { launchDigerIslem } = await import('./diger-islemler-launch');

            const result = await launchDigerIslem({
                actionId,
                onProgress: (status: string) => {
                    console.log(`[DIGER-ISLEMLER] ${status}`);
                    wsClient?.send('diger-islemler:launch-progress', { status, actionId });
                    mainWindow?.webContents.send('bot:command', { type: 'diger-islemler-launch-progress', status, actionId });
                }
            });

            if (result.success) {
                wsClient?.send('diger-islemler:launch-complete', { success: true, actionId, url: result.url });
                mainWindow?.webContents.send('bot:command', { type: 'diger-islemler-launch-complete', success: true, actionId });
            } else {
                wsClient?.sendError(result.error || 'İşlem başlatılamadı');
                mainWindow?.webContents.send('bot:command', { type: 'diger-islemler-launch-error', error: result.error, actionId });
            }
        } catch (e: any) {
            console.error('[MAIN] Diğer İşlemler hatası:', e);
            wsClient?.sendError(e.message || 'Diğer İşlemler hatası');
            mainWindow?.webContents.send('bot:command', { type: 'diger-islemler-launch-error', error: e.message, actionId });
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // E-Defter Paket Kontrol Handler
    // ═══════════════════════════════════════════════════════════════

    const activeEdefterQueries = new Map<string, boolean>();

    wsClient.on('edefter:query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📗 E-Defter Paket Kontrol başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Yıl:', data.yil, 'Ay aralığı:', data.basAy, '-', data.bitAy);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'edefter-query-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `${data.userid}-${data.yil}-${data.basAy}-${data.bitAy}`;
        if (activeEdefterQueries.has(queryKey)) {
            wsClient?.send('edefter:query-error', {
                error: 'Bu mükellef için zaten bir sorgulama devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeEdefterQueries.set(queryKey, true);

        // 5 dakika global timeout
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { queryEdefterKontrol } = await import('./edefter-api');

            const queryWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                return await queryEdefterKontrol(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        basAy: data.basAy as number,
                        bitAy: data.bitAy as number,
                        yil: data.yil as number,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    (status) => {
                        if (wsClient?.connected) {
                            wsClient.send('edefter:query-progress', {
                                status, customerName, requesterId,
                            });
                        }
                    },
                    (aylar) => {
                        if (wsClient?.connected) {
                            wsClient.send('edefter:query-results', {
                                aylar, customerName, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as import('./edefter-api').EdefterKontrolResult;

            wsClient?.send('edefter:query-complete', {
                success: true,
                yil: result.yil,
                aylar: result.aylar,
                tamamlanan: result.tamamlanan,
                eksik: result.eksik,
                kismenEksik: result.kismenEksik,
                customerName,
                requesterId,
            });
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'E-Defter sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.startsWith('AUTH_FAILED')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', '');
            } else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = e.message.includes('SERVICE_DOWN')
                    ? 'Captcha çözüm servisleri şu anda erişilemez. Lütfen birkaç dakika sonra tekrar deneyin.'
                    : 'Captcha çözülemedi: ' + e.message.replace('CAPTCHA_FAILED: ', '');
            } else if (e.message?.startsWith('GIB_MAINTENANCE')) {
                errorCode = 'GIB_MAINTENANCE';
                errorMessage = 'GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin.';
            } else if (e.message?.startsWith('EDEFTER_TOKEN_FAILED')) {
                errorCode = 'EDEFTER_TOKEN_FAILED';
                errorMessage = 'E-Defter portalına bağlanılamadı: ' + e.message.replace('EDEFTER_TOKEN_FAILED: ', '');
            } else if (e.message?.startsWith('EDEFTER_SESSION_EXPIRED')) {
                errorCode = 'EDEFTER_SESSION_EXPIRED';
                errorMessage = 'E-Defter oturumu sona erdi. Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('edefter:query-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeEdefterQueries.delete(queryKey);
        }
    });

    wsClient.on('connected', () => {
        console.log('[MAIN] WebSocket connected');
    });

    wsClient.on('disconnected', () => {
        console.log('[MAIN] WebSocket disconnected');
    });
}

// ═══════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[SMMM-ASISTAN] 🚀 Electron uygulama başlatılıyor...');
    console.log('[SMMM-ASISTAN] Platform:', process.platform);
    console.log('[SMMM-ASISTAN] Node version:', process.version);
    console.log('[SMMM-ASISTAN] Electron version:', process.versions.electron);
    console.log('═══════════════════════════════════════════════════════════════');

    // Setup IPC handlers first (must be after app.whenReady)
    setupIpcHandlers();

    initDatabase();
    createWindow();
    createTray();

    // Try to restore session
    const session = getSession();
    if (session?.token) {
        console.log('[SMMM-ASISTAN] 🔐 Kaydedilmiş oturum bulundu, WebSocket bağlanıyor...');
        connectWebSocket(session.token);
    } else {
        console.log('[SMMM-ASISTAN] ℹ️ Kaydedilmiş oturum yok, giriş bekleniyor...');
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});

console.log('[SMMM-ASISTAN] Main process started');
