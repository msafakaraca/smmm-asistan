#!/usr/bin/env node
/**
 * Electron Starter Script
 * ========================
 * Bu script ELECTRON_RUN_AS_NODE ortam degiskenini temizler
 * ve Electron'u dogru sekilde baslatir.
 */

const { spawn } = require('child_process');
const path = require('path');

// ELECTRON_RUN_AS_NODE'u kaldir
delete process.env.ELECTRON_RUN_AS_NODE;

// Electron executable path
const electronPath = require('electron');

// Uygulama path (dist/main/index.js)
const appPath = path.join(__dirname, '..');

console.log('[Starter] Starting Electron...');
console.log('[Starter] Electron path:', electronPath);
console.log('[Starter] App path:', appPath);
console.log('[Starter] ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);

// Electron'u spawn et
const child = spawn(electronPath, [appPath], {
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined  // Kesinlikle kaldir
    }
});

child.on('close', (code) => {
    process.exit(code);
});

child.on('error', (err) => {
    console.error('[Starter] Failed to start Electron:', err);
    process.exit(1);
});
