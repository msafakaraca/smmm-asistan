/**
 * Electron Preload Script
 * =======================
 * Güvenli IPC köprüsü
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Kimlik doğrulama
    login: (email: string, password: string) =>
        ipcRenderer.invoke('auth:login', email, password),

    getStoredSession: () =>
        ipcRenderer.invoke('auth:getSession'),

    logout: () =>
        ipcRenderer.invoke('auth:logout'),

    // Chromium durumu ve indirme
    getChromiumStatus: () =>
        ipcRenderer.invoke('chromium:status'),

    retryChromiumDownload: () =>
        ipcRenderer.invoke('chromium:retry'),

    onChromiumProgress: (callback: (data: any) => void) => {
        ipcRenderer.on('chromium:progress', (_, data) => callback(data));
    },

    // WebSocket üzerinden gelen bot komutları
    onBotCommand: (callback: (data: any) => void) => {
        ipcRenderer.on('bot:command', (_, data) => callback(data));
    },

    // Web sitesine ilerleme bilgisi gönder
    sendProgress: (progress: number, message: string) => {
        ipcRenderer.send('bot:progress', { progress, message });
    },

    // Dashboard işlemleri
    dashboard: {
        getCustomers: () => ipcRenderer.invoke('dashboard:getCustomers'),
        launch: (params: { linkId: string; customerId?: string; credentialType: string; application?: string; targetPage?: string; vergiLevhasiYil?: string; vergiLevhasiDil?: string }) =>
            ipcRenderer.invoke('dashboard:launch', params),
        onLaunchProgress: (callback: (data: any) => void) => {
            ipcRenderer.removeAllListeners('dashboard:launch-progress');
            ipcRenderer.on('dashboard:launch-progress', (_, data) => callback(data));
        },
        onLaunchError: (callback: (data: any) => void) => {
            ipcRenderer.removeAllListeners('dashboard:launch-error');
            ipcRenderer.on('dashboard:launch-error', (_, data) => callback(data));
        },
        onLaunchComplete: (callback: (data: any) => void) => {
            ipcRenderer.removeAllListeners('dashboard:launch-complete');
            ipcRenderer.on('dashboard:launch-complete', (_, data) => callback(data));
        },
    },

    // Pencere kontrolleri
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
});
