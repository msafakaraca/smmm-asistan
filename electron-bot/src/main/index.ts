/**
 * SMMM Asistan - Electron Main Process
 * =====================================
 * Ana süreç: Pencere yönetimi, system tray, WebSocket client
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, session } from 'electron';
import path from 'path';
import { WebSocketClient } from './ws-client';
import { runEbeyannamePipeline, stopBot } from './ebeyanname-api';
import { runIntrvrgBeyannamePipeline, stopIntrvrgTest } from './intvrg-beyanname-kontrol-api';
import { syncMukellefsViaApi } from './ebeyan-mukellef-api';
import { initDatabase, getSession, saveSession, clearSession } from './db';
import { getApiUrl, getWsUrl } from './config';
import { isChromiumInstalled, downloadChromium } from './chromium-downloader';

// Login token ile API çağrısı yapmak için yardımcı fonksiyon
function getBearerHeaders(): Record<string, string> {
    const session = getSession();
    if (!session?.token) {
        throw new Error('[ELECTRON] Oturum bulunamadı — lütfen tekrar giriş yapın');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
    };
}
// GPU cache hatalarını önle (Windows'ta "Unable to move the cache" hatası)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.disableHardwareAcceleration();

// Global değişkenler
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let wsClient: WebSocketClient | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

interface LoginResponse {
    success: boolean;
    user?: unknown;
    token?: string;
    error?: string;
}

/**
 * Ana pencereyi oluştur
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
        backgroundColor: '#e8ecf1',
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

    // Cache temizle — eski renderer dosyalarının gösterilmesini önle
    session.defaultSession.clearCache();

    // İçerik yükle
    if (isDev) {
        // Önce dev server'ı dene, yoksa build edilmiş dosyaları yükle
        let retryCount = 0;
        const maxRetries = 3;
        const loadURL = async () => {
            try {
                await mainWindow?.loadURL('http://localhost:5173');
            } catch (e) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`[ELECTRON] Dev server bekleniyor... (${retryCount}/${maxRetries})`);
                    setTimeout(loadURL, 1000);
                } else {
                    // Dev server yok, build edilmiş dosyaları yükle
                    console.log('[ELECTRON] Dev server bulunamadı, build dosyaları yükleniyor...');
                    mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
                }
            }
        };
        loadURL();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Hazır olduğunda göster
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Kapatma yerine sistem tepsisine küçült
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
 * Sistem tepsisi oluştur
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
// IPC HANDLER'LAR — app.whenReady() sonrası çalışmak üzere setupIpcHandlers()'a taşındı
// ═══════════════════════════════════════════════════════════════════

function setupIpcHandlers() {
    // Giriş
    ipcMain.handle('auth:login', async (_, email: string, password: string) => {
        try {
            console.log('[AUTH] 🔐 Giriş denemesi:', email);
            const apiUrl = getApiUrl();
            console.log('[AUTH] API URL:', apiUrl);

            // Kimlik doğrulama için web API'sine istek gönder
            const response = await fetch(`${apiUrl}/api/auth/electron-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json() as LoginResponse;

            if (data.success && data.user && data.token) {
                console.log('[AUTH] ✅ Giriş başarılı!');

                // Yerel veritabanına kaydet
                saveSession(data.user, data.token);

                // WebSocket'e bağlan
                console.log('[AUTH] 🔌 WebSocket bağlantısı kuruluyor...');
                connectWebSocket(data.token);

                return { success: true, user: data.user, token: data.token };
            }

            console.log('[AUTH] ❌ Giriş başarısız:', data.error);
            return { success: false, error: data.error || 'E-posta adresi veya şifre hatalı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.' };
        } catch (error) {
            console.error('[AUTH] ❌ Bağlantı hatası:', error);
            return { success: false, error: 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin veya birkaç dakika sonra tekrar deneyin.' };
        }
    });

    // Kayıtlı oturumu getir
    ipcMain.handle('auth:getSession', async () => {
        return getSession();
    });

    // Çıkış yap
    ipcMain.handle('auth:logout', async () => {
        clearSession();
        wsClient?.disconnect();
        wsClient = null;
    });

    // Pencere kontrolleri
    ipcMain.handle('window:minimize', () => {
        mainWindow?.hide();
    });

    ipcMain.handle('window:close', () => {
        isQuitting = true;
        app.quit();
    });

    // Chromium durumu
    ipcMain.handle('chromium:status', () => {
        return { installed: isChromiumInstalled() };
    });

    // Chromium tekrar indirme
    ipcMain.handle('chromium:retry', async () => {
        try {
            await downloadChromium((progress) => {
                mainWindow?.webContents.send('chromium:progress', progress);
            });
            mainWindow?.webContents.send('chromium:progress', {
                percent: 100, downloadedMB: 0, totalMB: 0, status: 'done',
            });
            return { success: true };
        } catch (err: any) {
            mainWindow?.webContents.send('chromium:progress', {
                percent: -1, downloadedMB: 0, totalMB: 0,
                status: `Chromium indirilemedi: ${err.message}`,
            });
            return { success: false, error: err.message };
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // DASHBOARD IPC HANDLERS
    // ═══════════════════════════════════════════════════════════════

    // Dashboard: Müşteri listesi al
    ipcMain.handle('dashboard:getCustomers', async () => {
        try {
            const headers = getBearerHeaders();
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/bot/dashboard-customers`, { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { success: false, error: (err as any).error || 'Mükellef listesi yüklenemedi. Oturumunuz sona ermiş olabilir, lütfen tekrar giriş yapın.' };
            }
            const data = await res.json();
            return { success: true, customers: (data as any).customers };
        } catch (e: any) {
            console.error('[DASHBOARD] Müşteri listesi hatası:', e);
            return { success: false, error: e.message || 'Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edin.' };
        }
    });

    // Dashboard: Link launch — credential al ve launcher'ı başlat
    ipcMain.handle('dashboard:launch', async (_, params: {
        linkId: string;
        customerId?: string;
        credentialType: string;
        application?: string;
        targetPage?: string;
        vergiLevhasiYil?: string;
        vergiLevhasiDil?: string;
    }) => {
        const { linkId, customerId, credentialType, application, targetPage, vergiLevhasiYil, vergiLevhasiDil } = params;
        console.log(`[DASHBOARD] Launch: ${linkId} (credentialType: ${credentialType})`);

        // Diğer işlemler — credential gerekmez, direkt launcher çağır
        if (credentialType === 'diger') {
            try {
                const { launchDigerIslem } = await import('./diger-islemler-launch');
                const result = await launchDigerIslem({
                    actionId: linkId,
                    onProgress: (status: string) => {
                        mainWindow?.webContents.send('dashboard:launch-progress', { status, linkId });
                    },
                });
                if (result.success) {
                    mainWindow?.webContents.send('dashboard:launch-complete', { linkId });
                    return { success: true };
                }
                mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: result.error });
                return { success: false, error: result.error };
            } catch (e: any) {
                mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: e.message });
                return { success: false, error: e.message };
            }
        }

        // API'den credential al
        try {
            const headers = getBearerHeaders();
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/bot/dashboard-launch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ linkId, customerId, credentialType }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const errorMsg = (err as any).error || 'Giriş bilgileri sunucudan alınamadı. Oturumunuzun aktif olduğundan emin olun.';
                mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: errorMsg });
                return { success: false, error: errorMsg };
            }

            const data = await res.json() as { success: boolean; credentials?: any };
            if (!data.credentials) {
                const noCredMsg = 'Bu mükellef için giriş bilgisi tanımlanmamış. Lütfen mükellef bilgilerinden ilgili şifreleri ekleyin.';
                mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: noCredMsg });
                return { success: false, error: noCredMsg };
            }

            const creds = data.credentials;
            const customerName = creds.customerName;
            const onProgress = (status: string) => {
                mainWindow?.webContents.send('dashboard:launch-progress', { status, linkId });
            };

            // linkId'ye göre doğru launcher'ı seç
            let result: { success: boolean; error?: string };

            // GİB uygulamaları (MM ve Mükellef)
            if (application && ['ivd', 'ebeyanname', 'interaktifvd', 'defter-beyan', 'ebeyan', 'edefter'].includes(application)) {
                const { launchGibApplication } = await import('./gib-launcher');
                result = await launchGibApplication({
                    userid: creds.userid,
                    password: creds.password,
                    application: application as any,
                    targetPage: targetPage as any,
                    customerName,
                    vergiLevhasiYil: targetPage === 'vergi-levhasi' ? (vergiLevhasiYil || '2025') as any : undefined,
                    vergiLevhasiDil: targetPage === 'vergi-levhasi' ? (vergiLevhasiDil || 'tr') as any : undefined,
                    onProgress,
                });
            }
            // E-Arşiv (GİB 5000/2000)
            else if (linkId === 'gib-5000') {
                const { launchEarsivPortal } = await import('./earsiv-launcher');
                result = await launchEarsivPortal({
                    userid: creds.userid,
                    password: creds.password,
                    customerName,
                    onProgress,
                });
            }
            // E-Devlet
            else if (linkId === 'edevlet' || linkId === 'edevlet-mukellef') {
                const { launchEdevletKapisi } = await import('./edevlet-launcher');
                result = await launchEdevletKapisi({
                    tckn: creds.tckn,
                    password: creds.password,
                    customerName,
                    onProgress,
                });
            }
            // TÜRMOB Luca
            else if (linkId === 'turmob-luca') {
                const { launchTurmobLuca } = await import('./turmob-launcher');
                result = await launchTurmobLuca({
                    userid: creds.userid,
                    password: creds.password,
                    customerName,
                    onProgress,
                });
            }
            // İŞKUR (E-Devlet ile giriş)
            else if (linkId === 'iskur') {
                const { launchIskurWithEdevlet } = await import('./iskur-launcher');
                result = await launchIskurWithEdevlet({
                    tckn: creds.tckn,
                    password: creds.password,
                    loginMethod: 'edevlet',
                    customerName,
                    onProgress,
                });
            }
            else {
                result = { success: false, error: `Bu işlem henüz desteklenmiyor: ${linkId}` };
            }

            if (result.success) {
                mainWindow?.webContents.send('dashboard:launch-complete', { linkId });
                return { success: true };
            } else {
                mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: result.error });
                return { success: false, error: result.error };
            }
        } catch (e: any) {
            console.error(`[DASHBOARD] Launch hatası (${linkId}):`, e);
            mainWindow?.webContents.send('dashboard:launch-error', { linkId, error: e.message });
            return { success: false, error: e.message || 'Uygulama başlatılamadı. Lütfen tekrar deneyin veya bilgisayarınızı yeniden başlatın.' };
        }
    });
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
    const wsUrl = getWsUrl();

    wsClient = new WebSocketClient(wsUrl, token);

    // Token expired/invalid → session temizle, renderer'a bildir
    wsClient.on('auth-failed', () => {
        console.log('[MAIN] 🔒 Token süresi dolmuş, oturum temizleniyor...');
        clearSession();
        wsClient?.disconnect();
        wsClient = null;
        mainWindow?.webContents.send('bot:command', {
            type: 'session-expired',
            message: 'Oturum süreniz doldu. Güvenliğiniz için lütfen tekrar giriş yapın.'
        });
        // Pencereyi göster ki kullanıcı login yapabilsin
        mainWindow?.show();
    });

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

        // Renderer'a bildir
        mainWindow?.webContents.send('bot:command', { ...data, type: 'start' });

        // Sistem tepsisine küçült
        mainWindow?.hide();

        // Token'ı session'dan al
        const session = getSession();
        const captchaApiKey = (data.captchaApiKey as string) || '';
        const ocrSpaceApiKey = (data.ocrSpaceApiKey as string) || '';

        // İlerleme geri bildirimi
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
                    const errorMsg = payload.error || payload.message || 'E-Beyanname işlemi sırasında beklenmeyen bir hata oluştu.';
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
            console.error('[MAIN] ❌ Bot hatası:', e);
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
        stopIntrvrgTest();

        // Renderer'a bildir
        mainWindow?.webContents.send('bot:command', { type: 'stopped', message: 'Bot durduruldu' });

        // Pencereyi göster
        mainWindow?.show();
    });

    // ═══════════════════════════════════════════════════════════════
    // INTVRG Beyanname Kontrol Test Handler
    // ═══════════════════════════════════════════════════════════════
    wsClient.on('bot:start-intvrg-test', async (data: BotCommandData) => {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 🧪 INTVRG Beyanname Test Pipeline Başlatılıyor');
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { ...data, type: 'intvrg-test-start' });

        const onProgress = (type: string, payload: any) => {
            if (!wsClient) return;
            if (type === 'progress') {
                wsClient.send('intvrg-test:progress', payload);
            } else if (type === 'results') {
                wsClient.send('intvrg-test:results', payload);
            } else if (type === 'complete') {
                wsClient.send('intvrg-test:complete', payload);
            } else if (type === 'error') {
                wsClient.send('intvrg-test:error', payload);
            }
        };

        try {
            await runIntrvrgBeyannamePipeline({
                tenantId: data.tenantId as string,
                username: data.username as string,
                password: data.password as string,
                captchaKey: (data.captchaApiKey as string) || '',
                ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                baslangicTarihi: data.baslangicTarihi as string,
                bitisTarihi: data.bitisTarihi as string,
                donemBasAy: data.donemBasAy as string,
                donemBasYil: data.donemBasYil as string,
                donemBitAy: data.donemBitAy as string,
                donemBitYil: data.donemBitYil as string,
                durumFiltresi: data.durumFiltresi as 'onaylandi' | 'hatali' | 'tumu' | undefined,
                downloadBeyanname: data.downloadBeyanname as boolean | undefined,
                downloadTahakkuk: data.downloadTahakkuk as boolean | undefined,
                downloadSgk: data.downloadSgk as boolean | undefined,
                onProgress,
            });
        } catch (e: any) {
            console.error('[MAIN] ❌ INTVRG Test hatası:', e);
            if (wsClient) wsClient.send('intvrg-test:error', { error: e.message });
        }
    });

    // GİB Mükellef Listesi Sync Handler
    wsClient.on('gib:sync-taxpayers', async (data: BotCommandData) => {
        mainWindow?.webContents.send('bot:command', { ...data, type: 'start' });
        mainWindow?.hide();

        // Captcha API key: WebSocket'ten gelen veya env'den al
        const captchaApiKey = (data.captchaApiKey as string) || '';

        console.log('[MAIN] GİB Mükellef sync başlatılıyor, veriler:', data);
        console.log('[MAIN] Captcha API Key:', captchaApiKey ? 'Mevcut (' + captchaApiKey.substring(0, 6) + '...)' : 'Yok');

        try {
            const ocrSpaceApiKey = (data.ocrSpaceApiKey as string) || '' || '';

            await syncMukellefsViaApi({
                username: data.username as string,
                password: data.password as string,
                captchaApiKey: captchaApiKey,
                ocrSpaceApiKey: ocrSpaceApiKey,
                onProgress: (type: string, payload: any) => {
                    if (wsClient) {
                        if (type === 'progress') {
                            wsClient.sendProgress(payload.progress, payload.message);
                            mainWindow?.webContents.send('bot:command', { type: 'progress', ...payload });
                        } else if (type === 'mukellef-data') {
                            // Mükellef verilerini import API'sine gönder
                            console.log(`[MAIN] ${payload.taxpayers?.length || 0} mükellef import API'sine gönderiliyor...`);
                            wsClient.send('bot:mukellef-data', { ...payload, tenantId: data.tenantId });
                        } else if (type === 'complete') {
                            wsClient.sendComplete({ ...payload, tenantId: data.tenantId });
                            mainWindow?.webContents.send('bot:command', { type: 'complete', ...payload });
                            mainWindow?.show();
                        } else if (type === 'error') {
                            const errorMsg = payload.error || payload.message || 'Mükellef listesi senkronizasyonunda beklenmeyen bir hata oluştu.';
                            const errorCode = payload.errorCode || payload.gibError?.code || 'UNKNOWN';
                            wsClient.sendError(errorMsg, errorCode, payload.gibError);
                            mainWindow?.webContents.send('bot:command', { type: 'error', ...payload });
                            mainWindow?.show();
                        }
                    }
                }
            });
        } catch (e: any) {
            console.error('[MAIN] ❌ GİB Mükellef sync hatası:', e);
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

        const apiUrl = getApiUrl();
        const tenantId = data.tenantId as string;
        const year = data.year as number;
        const month = data.month as number;
        const groupId = data.groupId as string | undefined;

        // Renderer'a bildir
        mainWindow?.webContents.send('bot:command', {
            type: 'sgk-parse-start',
            message: 'SGK dosyaları parse ediliyor...',
            year,
            month
        });

        // İlerleme geri bildirimi
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
                    headers: getBearerHeaders(),
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
                    headers: getBearerHeaders(),
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

    // ⚡ GİB Prepare Handler — Puppeteer'ı ANINDA başlat (credentials beklenmeden)
    // Frontend WebSocket ile gönderir, API'den önce gelir
    wsClient.on('gib:prepare', async () => {
        console.log('[MAIN] ⚡ gib:prepare alındı — Puppeteer önceden başlatılıyor...');
        try {
            const { prepareGibBrowser } = await import('./gib-launcher');
            await prepareGibBrowser((status: string) => {
                console.log(`[GIB-PREPARE] ${status}`);
                wsClient?.send('gib:launch-progress', { status, application: 'ivd' });
                mainWindow?.webContents.send('bot:command', { type: 'gib-launch-progress', status });
            });
        } catch (e: any) {
            console.error('[MAIN] gib:prepare hatası:', e);
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
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        console.log('[MAIN] Uygulama:', application);
        if (targetPage) console.log('[MAIN] Hedef Sayfa:', targetPage);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'gib-launch-start', application, targetPage, customerName });

        const onProgress = (status: string) => {
            console.log(`[GIB-LAUNCHER] ${status}`);
            wsClient?.send('gib:launch-progress', { status, application, targetPage, customerName });
            mainWindow?.webContents.send('bot:command', { type: 'gib-launch-progress', status, application });
        };

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
                onProgress,
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
    // INTVRG Beyanname Pipeline — Sorgu + PDF İndirme (Tek Yıl)
    // ═══════════════════════════════════════════════════════════════
    wsClient.on('intvrg:beyanname-query-and-download', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📋 INTVRG Beyanname PIPELINE başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-beyanname-pipeline-start', customerName });

        // Duplicate guard
        const queryKey = `pipeline-${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
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

        // 5 dakika timeout
        const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), PIPELINE_TIMEOUT_MS)
        );

        const skipBeyoids = (data.savedBeyoids as string[]) || [];

        try {
            const { queryAndDownloadPipeline } = await import('./intvrg-beyanname-api');

            const pipelineWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:beyanname-progress', {
                    status: 'Beyanname pipeline başlatılıyor...',
                    customerName, phase: 'login', requesterId,
                });

                return await queryAndDownloadPipeline(
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
                    skipBeyoids,
                    {
                        onProgress: (status) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-progress', { status, customerName, requesterId });
                            }
                        },
                        onResults: (beyannameler) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-results', { beyannameler, customerName, requesterId });
                                wsClient.send('intvrg:beyanname-complete', {
                                    success: true,
                                    totalCount: beyannameler.length,
                                    customerName,
                                    requesterId,
                                });
                            }
                        },
                        onPdfResult: (pdfData) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-bulk-pdf-result', { ...pdfData, customerName, requesterId });
                            }
                        },
                        onPdfSkip: (skipData) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-bulk-pdf-skip', { ...skipData, customerName, requesterId });
                            }
                        },
                        onComplete: (stats) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-pipeline-complete', { ...stats, customerName, requesterId });
                            }
                        },
                    },
                );
            };

            const result = await Promise.race([pipelineWork(), timeoutPromise]) as Awaited<ReturnType<typeof queryAndDownloadPipeline>>;

            // IVD token cache
            if (result.ivdToken && data.vkn) {
                ivdTokenCache.set(data.vkn as string, {
                    token: result.ivdToken,
                    timestamp: Date.now(),
                });
                console.log(`[INTVRG-TOKEN] IVD token cache'lendi (pipeline): VKN=${(data.vkn as string).substring(0, 4)}***`);
            }

            if (!result.success) {
                wsClient?.send('intvrg:beyanname-error', {
                    error: result.error || 'Pipeline başarısız',
                    errorCode: 'PIPELINE_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Beyanname pipeline hatası';

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
    // INTVRG Beyanname Pipeline — Çoklu Yıl Sorgu + PDF İndirme
    // ═══════════════════════════════════════════════════════════════
    wsClient.on('intvrg:beyanname-multi-query-and-download', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📋 INTVRG Beyanname ÇOKLU YIL PIPELINE başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'intvrg-beyanname-multi-pipeline-start', customerName });

        // Duplicate guard
        const queryKey = `pipeline-multi-${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
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

        // Dinamik timeout: chunk başına 3 dakika
        const startYear = parseInt(data.basYil as string, 10);
        const endYear = parseInt(data.bitYil as string, 10);
        const chunkCount = endYear - startYear + 1;
        const MULTI_PIPELINE_TIMEOUT_MS = chunkCount * 3 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), MULTI_PIPELINE_TIMEOUT_MS)
        );

        const skipBeyoids = (data.savedBeyoids as string[]) || [];

        try {
            const { queryAndDownloadPipelineMultiYear } = await import('./intvrg-beyanname-api');

            const pipelineWork = async () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                wsClient?.send('intvrg:beyanname-multi-progress', {
                    chunkIndex: 0,
                    totalChunks: chunkCount,
                    year: String(startYear),
                    status: 'Çoklu yıl pipeline başlatılıyor...',
                    customerName,
                    requesterId,
                });

                return await queryAndDownloadPipelineMultiYear(
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
                    skipBeyoids,
                    {
                        onProgress: (status) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-progress', { status, customerName, requesterId });
                            }
                        },
                        onResults: () => {
                            // Multi-year'da her chunk results geldiğinde onChunkResults ile tablo güncellenir
                        },
                        onChunkProgress: (ci, tc, year, status) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-progress', {
                                    chunkIndex: ci, totalChunks: tc, year, status,
                                    customerName, requesterId,
                                });
                            }
                        },
                        onChunkResults: (ci, tc, year, beyannameler) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-chunk-results', {
                                    chunkIndex: ci, totalChunks: tc, year, beyannameler,
                                    customerName, requesterId,
                                });
                            }
                        },
                        onPdfResult: (pdfData) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-bulk-pdf-result', { ...pdfData, customerName, requesterId });
                            }
                        },
                        onPdfSkip: (skipData) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-bulk-pdf-skip', { ...skipData, customerName, requesterId });
                            }
                        },
                        onComplete: (stats) => {
                            if (wsClient?.connected) {
                                wsClient.send('intvrg:beyanname-multi-complete', {
                                    success: true,
                                    totalCount: stats.totalQueried,
                                    customerName,
                                    requesterId,
                                });
                                wsClient.send('intvrg:beyanname-pipeline-complete', { ...stats, customerName, requesterId });
                            }
                        },
                    },
                );
            };

            const result = await Promise.race([pipelineWork(), timeoutPromise]) as Awaited<ReturnType<typeof queryAndDownloadPipelineMultiYear>>;

            // IVD token cache
            if (result.ivdToken && data.vkn) {
                ivdTokenCache.set(data.vkn as string, {
                    token: result.ivdToken,
                    timestamp: Date.now(),
                });
                console.log(`[INTVRG-TOKEN] IVD token cache'lendi (multi-pipeline): VKN=${(data.vkn as string).substring(0, 4)}***`);
            }

            if (!result.success) {
                wsClient?.send('intvrg:beyanname-error', {
                    error: result.error || 'Çoklu yıl pipeline başarısız',
                    errorCode: 'PIPELINE_FAILED',
                    customerName,
                    requesterId,
                });
            }
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Çoklu yıl beyanname pipeline hatası';

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
    // INTVRG Toplu Beyanname Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    let isBulkRunning = false;

    wsClient.on('intvrg:beyanname-bulk-start', async (data: BotCommandData) => {
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📦 INTVRG Toplu Beyanname Sorgulama başlatılıyor...');
        const customers = data.customers as Array<{
            customerId: string; customerName: string;
            userid: string; password: string; vkn: string;
            savedBeyoids: string[];
        }>;
        console.log(`[MAIN] ${customers?.length || 0} mükellef`);
        console.log(`[MAIN] Dönem: ${data.basAy}/${data.basYil} - ${data.bitAy}/${data.bitYil}`);
        console.log('═══════════════════════════════════════════════════════════════');

        if (isBulkRunning) {
            wsClient?.send('intvrg:beyanname-bulk-error', {
                error: 'Zaten bir toplu sorgulama devam ediyor',
                errorCode: 'BULK_IN_PROGRESS',
                requesterId,
            });
            return;
        }

        if (!customers || customers.length === 0) {
            wsClient?.send('intvrg:beyanname-bulk-error', {
                error: 'Sorgulanacak mükellef bulunamadı',
                errorCode: 'NO_CUSTOMERS',
                requesterId,
            });
            return;
        }

        isBulkRunning = true;
        mainWindow?.webContents.send('bot:command', {
            type: 'intvrg-beyanname-bulk-start',
            totalCustomers: customers.length,
        });

        try {
            const { queryBeyannamelerBulk } = await import('./intvrg-beyanname-api');

            await queryBeyannamelerBulk(
                customers,
                {
                    basAy: data.basAy as string,
                    basYil: data.basYil as string,
                    bitAy: data.bitAy as string,
                    bitYil: data.bitYil as string,
                },
                data.captchaApiKey as string,
                data.ocrSpaceApiKey as string | undefined,
                {
                    onProgress: (current, total, status) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-progress', {
                                current, total, status, requesterId,
                            });
                        }
                    },
                    onCustomerStart: (customerId, customerName, index, total) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-customer-start', {
                                customerId, customerName, index, total, requesterId,
                            });
                        }
                        mainWindow?.webContents.send('bot:command', {
                            type: 'intvrg-beyanname-bulk-customer',
                            customerName, index, total,
                        });
                    },
                    onCustomerResults: (customerId, customerName, beyannameler) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-customer-results', {
                                customerId, customerName,
                                beyannameCount: beyannameler.length,
                                requesterId,
                            });
                        }
                    },
                    onPdfResult: (customerId, pdfData) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-customer-pdf', {
                                customerId, ...pdfData, requesterId,
                            });
                        }
                    },
                    onCustomerComplete: (customerId, customerName, stats) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-customer-complete', {
                                customerId, customerName, ...stats, requesterId,
                            });
                        }
                    },
                    onCustomerError: (customerId, customerName, error) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-customer-error', {
                                customerId, customerName, error, requesterId,
                            });
                        }
                    },
                    onAllComplete: (summary) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:beyanname-bulk-all-complete', {
                                ...summary, requesterId,
                            });
                        }
                        mainWindow?.webContents.send('bot:command', {
                            type: 'intvrg-beyanname-bulk-complete',
                            ...summary,
                        });
                    },
                },
            );
        } catch (e: any) {
            console.error('[MAIN] Toplu beyanname sorgulama hatası:', e.message);
            wsClient?.send('intvrg:beyanname-bulk-error', {
                error: e.message || 'Toplu sorgulama hatası',
                errorCode: 'BULK_ERROR',
                requesterId,
            });
        } finally {
            isBulkRunning = false;
        }
    });

    wsClient.on('intvrg:beyanname-bulk-cancel', async () => {
        console.log('[MAIN] 🛑 Toplu beyanname sorgulama iptal ediliyor...');
        const { cancelBulkQuery } = await import('./intvrg-beyanname-api');
        cancelBulkQuery();
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

    // ═══════════════════════════════════════════════════════════════
    // Vergi Levhası Sorgulama Handler
    // ═══════════════════════════════════════════════════════════════

    const activeVergiLevhasiQueries = new Map<string, boolean>();

    wsClient.on('intvrg:vergi-levhasi-query', async (data: BotCommandData) => {
        const requesterId = data.userId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] 📜 Vergi Levhası Sorgulama başlatılıyor...');
        const maskedUserid = data.userid ? `${String(data.userid).slice(0, 3)}***${String(data.userid).slice(-2)}` : 'N/A';
        console.log('[MAIN] Userid:', maskedUserid);
        console.log(`[MAIN] Mükellef sayısı: ${(data.mukellefler as unknown[])?.length || 0}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'vergi-levhasi-query-start' });

        const queryKey = `vergi-levhasi-${data.userid}`;
        if (activeVergiLevhasiQueries.has(queryKey)) {
            wsClient?.send('intvrg:vergi-levhasi-error', {
                error: 'Zaten bir vergi levhası sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                requesterId,
            });
            return;
        }
        activeVergiLevhasiQueries.set(queryKey, true);

        const TIMEOUT_MS = 10 * 60 * 1000; // 10 dakika
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
        );

        try {
            const { queryVergiLevhalari } = await import('./intvrg-vergi-levhasi-api');

            const mukellefler = (data.mukellefler as Array<{
                customerId: string;
                vknTckn: string;
                tcKimlikNo: string | null;
                unvan: string;
                sirketTipi: string;
            }>) || [];

            if (!wsClient?.connected) {
                throw new Error('WebSocket bağlantısı kopmuş');
            }

            wsClient?.send('intvrg:vergi-levhasi-progress', {
                status: 'Vergi levhası sorgulaması başlatılıyor...',
                current: 0, total: mukellefler.length, requesterId,
            });

            const queryWork = async () => {
                return await queryVergiLevhalari(
                    {
                        userid: data.userid as string,
                        password: data.password as string,
                        captchaApiKey: data.captchaApiKey as string,
                        ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    },
                    mukellefler,
                    (status, current, total, customerId) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:vergi-levhasi-progress', {
                                status, current, total, customerId, requesterId,
                            });
                        }
                    },
                    (result) => {
                        if (wsClient?.connected) {
                            wsClient.send('intvrg:vergi-levhasi-result', {
                                ...result, requesterId,
                            });
                        }
                    },
                );
            };

            const result = await Promise.race([queryWork(), timeoutPromise]) as {
                success: boolean;
                totalQueried: number;
                totalDownloaded: number;
                totalFailed: number;
            };

            wsClient?.send('intvrg:vergi-levhasi-complete', {
                ...result, requesterId,
            });
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'Vergi levhası sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (10 dakika). Lütfen tekrar deneyin.';
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

            wsClient?.send('intvrg:vergi-levhasi-error', {
                error: errorMessage, errorCode, requesterId,
            });
        } finally {
            activeVergiLevhasiQueries.delete(queryKey);
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
    // SGK E-Bildirge Sorgulama + PDF İndirme Handler
    // ═══════════════════════════════════════════════════════════════

    const activeSgkEbildirgeQueries = new Map<string, boolean>();

    wsClient.on('sgk:ebildirge-query-and-download', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        const requesterId = data.requesterId as string | undefined;

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[MAIN] SGK E-Bildirge sorgulama + PDF indirme başlatılıyor...');
        const maskedUser = data.credentials
            ? `${String((data.credentials as any).kullaniciAdi).slice(0, 3)}***`
            : 'N/A';
        console.log('[MAIN] Kullanıcı:', maskedUser);
        if (customerName) console.log('[MAIN] Mükellef:', customerName);
        console.log('[MAIN] Dönem:', `${data.startMonth}/${data.startYear} - ${data.endMonth}/${data.endYear}`);
        console.log('═══════════════════════════════════════════════════════════════');

        mainWindow?.webContents.send('bot:command', { type: 'sgk-ebildirge-start', customerName });

        // Aynı mükellef için aktif sorgu kontrolü
        const queryKey = `sgk-ebildirge-${(data.credentials as any)?.kullaniciAdi}-${data.startMonth}${data.startYear}-${data.endMonth}${data.endYear}`;
        if (activeSgkEbildirgeQueries.has(queryKey)) {
            wsClient?.send('sgk:ebildirge-error', {
                error: 'Bu işyeri için zaten bir SGK E-Bildirge sorgulaması devam ediyor',
                errorCode: 'QUERY_IN_PROGRESS',
                customerName,
                requesterId,
            });
            return;
        }
        activeSgkEbildirgeQueries.set(queryKey, true);

        // 5 dakika global timeout
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { sgkEbildirgeQueryAndDownload } = await import('./sgk-ebildirge-api');

            const queryWork = () => {
                if (!wsClient?.connected) {
                    throw new Error('WebSocket bağlantısı kopmuş');
                }

                return sgkEbildirgeQueryAndDownload({
                    credentials: data.credentials as any,
                    startMonth: data.startMonth as number,
                    startYear: data.startYear as number,
                    endMonth: data.endMonth as number,
                    endYear: data.endYear as number,
                    captchaApiKey: data.captchaApiKey as string | undefined,
                    downloadPdfs: data.downloadPdfs !== false,
                    onProgress: (progressData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-progress', {
                                ...progressData, customerName, requesterId,
                            });
                        }
                    },
                    onResults: (resultsData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-results', {
                                ...resultsData, customerName, requesterId,
                            });
                        }
                    },
                    onPdfResult: (pdfData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-pdf-result', {
                                ...pdfData, customerName, requesterId,
                            });
                        }
                    },
                    onPdfSkip: (skipData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-pdf-skip', {
                                ...skipData, customerName, requesterId,
                            });
                        }
                    },
                    onComplete: (completeData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-pipeline-complete', {
                                ...completeData, customerName, requesterId,
                            });
                        }
                    },
                    onError: (errorData) => {
                        if (wsClient?.connected) {
                            wsClient.send('sgk:ebildirge-error', {
                                ...errorData, customerName, requesterId,
                            });
                        }
                    },
                });
            };

            await Promise.race([queryWork(), timeoutPromise]);
        } catch (e: any) {
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'SGK E-Bildirge sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'SGK sorgulaması zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'SGK sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }

            wsClient?.send('sgk:ebildirge-error', {
                error: errorMessage, errorCode, customerName, requesterId,
            });
        } finally {
            activeSgkEbildirgeQueries.delete(queryKey);
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

app.whenReady().then(async () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[SMMM-ASISTAN] Electron uygulama başlatılıyor...');
    console.log('[SMMM-ASISTAN] Platform:', process.platform);
    console.log('[SMMM-ASISTAN] Node version:', process.version);
    console.log('[SMMM-ASISTAN] Electron version:', process.versions.electron);
    console.log('═══════════════════════════════════════════════════════════════');

    // Setup IPC handlers first (must be after app.whenReady)
    setupIpcHandlers();

    initDatabase();
    createWindow();
    createTray();

    // ─── Chromium kontrol & indirme ───────────────────────────────
    if (!isChromiumInstalled()) {
        console.log('[SMMM-ASISTAN] Chromium bulunamadı, indirme başlatılıyor...');
        mainWindow?.webContents.send('chromium:progress', {
            percent: 0, downloadedMB: 0, totalMB: 0,
            status: 'Chromium hazırlanıyor...',
        });

        try {
            await downloadChromium((progress) => {
                mainWindow?.webContents.send('chromium:progress', progress);
            });
            console.log('[SMMM-ASISTAN] Chromium indirme tamamlandı!');
            mainWindow?.webContents.send('chromium:progress', {
                percent: 100, downloadedMB: 0, totalMB: 0,
                status: 'done',
            });
        } catch (err: any) {
            console.error('[SMMM-ASISTAN] Chromium indirme hatası:', err);
            mainWindow?.webContents.send('chromium:progress', {
                percent: -1, downloadedMB: 0, totalMB: 0,
                status: `Chromium indirilemedi: ${err.message}`,
            });
        }
    } else {
        console.log('[SMMM-ASISTAN] Chromium mevcut.');
    }

    // ─── Oturum kontrolü ──────────────────────────────────────────
    const session = getSession();
    if (session?.token) {
        try {
            const parts = session.token.split('.');
            const decoded = parts.length === 3
                ? JSON.parse(Buffer.from(parts[1], 'base64').toString()) as { exp?: number }
                : null;
            if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
                console.log('[SMMM-ASISTAN] Token süresi dolmuş, oturum temizleniyor...');
                clearSession();
            } else {
                console.log('[SMMM-ASISTAN] Kaydedilmiş oturum bulundu, WebSocket bağlanıyor...');
                connectWebSocket(session.token);
            }
        } catch {
            console.log('[SMMM-ASISTAN] Token okunamadı, oturum temizleniyor...');
            clearSession();
        }
    } else {
        console.log('[SMMM-ASISTAN] Kaydedilmiş oturum yok, giriş bekleniyor...');
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
