/**
 * SMMM Asistan - Electron Main Process
 * =====================================
 * Ana süreç: Pencere yönetimi, IPC işleyicileri ve sistem entegrasyonu
 */
import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import serve from 'electron-serve';
import { fileURLToPath } from 'url';
// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Production modda statik dosyaları sun
const isProd = process.env.NODE_ENV === 'production';
const loadURL = isProd ? serve({ directory: 'out' }) : null;
// Ana pencere referansı
let mainWindow = null;
/**
 * Ana pencereyi oluştur
 */
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 320,
        minWidth: 420,
        minHeight: 320,
        maxWidth: 420,
        maxHeight: 320,
        resizable: false,
        backgroundColor: '#0f172a', // Slate koyu arkaplan
        frame: true, // Normal pencere çerçevesi
        titleBarStyle: 'default',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Puppeteer için gerekli
        },
        icon: path.join(__dirname, '../public/icon.png'),
        show: false, // Hazır olana kadar gösterme
        center: true, // Ekranın ortasında aç
    });
    // Pencere hazır olunca göster (smooth açılış için)
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    // Harici linkleri varsayılan tarayıcıda aç
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    // URL'yi yükle
    if (isProd && loadURL) {
        await loadURL(mainWindow);
    }
    else {
        // Development modda Next.js dev server'ı kullan
        const port = process.env.PORT || 3000;
        await mainWindow.loadURL(`http://localhost:${port}`);
        // DevTools'u aç (geliştirme için)
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    // Pencere kapatıldığında referansı temizle
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ═══════════════════════════════════════════════════════════════════
// IPC HANDLERS - Frontend ile iletişim
// ═══════════════════════════════════════════════════════════════════
// Pencere kontrolleri
ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});
ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
    return mainWindow?.isMaximized();
});
ipcMain.handle('window:close', () => {
    mainWindow?.close();
});
ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
});
// Dosya sistemi işlemleri
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
});
ipcMain.handle('shell:openPath', async (_, filePath) => {
    return shell.openPath(filePath);
});
// Uygulama bilgileri
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});
ipcMain.handle('app:getPath', (_, name) => {
    return app.getPath(name);
});
// ═══════════════════════════════════════════════════════════════════
// BOT IPC HANDLERS - GİB ve TÜRMOB Bot İşlemleri
// Not: Electron paketlenmiş halinde bu importlar çalışmayacak.
// Çözüm: Bot kodunu ayrı bir modül olarak paketlemek gerekir.
// Şimdilik development modunda çalışır.
// ═══════════════════════════════════════════════════════════════════
// GİB Bot - Çalıştırma (Puppeteer Main Process'te çalışır)
ipcMain.handle('bot:runGib', async (event, options) => {
    try {
        // Bot modülünü dinamik import et (relative path)
        const botPath = path.join(__dirname, '..', 'src', 'lib', 'gib', 'bot.js');
        const botModule = await import(`file://${botPath}`);
        const { runGibBot } = botModule;
        // Progress callback'i frontend'e ilet
        const result = await runGibBot({
            ...options,
            onProgress: (percent, message) => {
                event.sender.send('bot:progress', { percent, message });
            }
        });
        return result;
    }
    catch (error) {
        console.error('[ELECTRON] GİB Bot hatası:', error);
        return {
            success: false,
            error: error.message || 'Bilinmeyen hata',
            beyannameler: [],
            stats: { total: 0, pages: 0, duration: 0, downloaded: 0, skipped: 0, failed: 0, newCustomers: 0 }
        };
    }
});
// TÜRMOB Bot - Çalıştırma
ipcMain.handle('bot:runTurmob', async (event, options) => {
    try {
        const botPath = path.join(__dirname, '..', 'src', 'lib', 'turmob', 'bot.js');
        const botModule = await import(`file://${botPath}`);
        const { runTurmobBot } = botModule;
        const result = await runTurmobBot({
            ...options,
            onProgress: (percent, message) => {
                event.sender.send('bot:progress', { percent, message });
            }
        });
        return result;
    }
    catch (error) {
        console.error('[ELECTRON] TÜRMOB Bot hatası:', error);
        return {
            success: false,
            error: error.message || 'Bilinmeyen hata'
        };
    }
});
// Bot durdurma
ipcMain.handle('bot:stop', async (_, tenantId) => {
    try {
        const controllerPath = path.join(__dirname, '..', 'src', 'lib', 'gib', 'bot-controller.js');
        const controllerModule = await import(`file://${controllerPath}`);
        const { stopBotSession } = controllerModule;
        stopBotSession(tenantId);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// ═══════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════
// Uygulama hazır olduğunda
app.whenReady().then(async () => {
    await createWindow();
    // macOS: Dock'tan açıldığında pencere yeniden oluştur
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Tüm pencereler kapandığında (macOS hariç)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Güvenlik: Remote modülünü devre dışı bırak
app.on('web-contents-created', (_, contents) => {
    contents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });
});
console.log('[ELECTRON] Ana süreç başlatıldı');
//# sourceMappingURL=main.js.map