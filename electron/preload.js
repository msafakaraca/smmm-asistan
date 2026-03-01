/**
 * SMMM Asistan - Electron Preload Script
 * ========================================
 * Güvenli IPC köprüsü: Renderer process'e kontrollü API sunar
 */
import { contextBridge, ipcRenderer } from 'electron';
// Güvenli API'yi renderer'a aç
contextBridge.exposeInMainWorld('electron', {
    // Pencere kontrolleri
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    },
    // Dosya sistemi
    dialog: {
        openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    },
    shell: {
        openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
    },
    // Uygulama bilgileri
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        getPath: (name) => ipcRenderer.invoke('app:getPath', name),
    },
    // Bot işlemleri
    bot: {
        runGib: (options) => ipcRenderer.invoke('bot:runGib', options),
        runTurmob: (options) => ipcRenderer.invoke('bot:runTurmob', options),
        stop: (tenantId) => ipcRenderer.invoke('bot:stop', tenantId),
        onProgress: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('bot:progress', handler);
            // Cleanup fonksiyonu döndür
            return () => {
                ipcRenderer.removeListener('bot:progress', handler);
            };
        },
    },
});
// Platform bilgisi
contextBridge.exposeInMainWorld('platform', {
    isElectron: true,
    os: process.platform,
});
console.log('[PRELOAD] Electron API hazır');
//# sourceMappingURL=preload.js.map