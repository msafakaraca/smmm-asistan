/**
 * Electron Preload Script
 * =======================
 * Güvenli IPC köprüsü
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Auth
    login: (email: string, password: string) =>
        ipcRenderer.invoke('auth:login', email, password),

    getStoredSession: () =>
        ipcRenderer.invoke('auth:getSession'),

    logout: () =>
        ipcRenderer.invoke('auth:logout'),

    // Bot commands from WebSocket
    onBotCommand: (callback: (data: any) => void) => {
        ipcRenderer.on('bot:command', (_, data) => callback(data));
    },

    // Send progress to website
    sendProgress: (progress: number, message: string) => {
        ipcRenderer.send('bot:progress', { progress, message });
    },

    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
});
