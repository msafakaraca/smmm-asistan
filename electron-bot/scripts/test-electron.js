#!/usr/bin/env node
/**
 * Electron Test Script
 * =====================
 * Bu script Electron'un dogru kuruldugundan emin olur.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('=== Electron Installation Test ===\n');

// Test 1: Check if electron package exists
try {
    const electronPath = require('electron');
    console.log('[OK] Electron package found:', electronPath);
} catch (e) {
    console.error('[FAIL] Electron package not found:', e.message);
    process.exit(1);
}

// Test 2: Run a simple test in Electron context
const testScript = `
console.log('\\n=== Running in Electron Context ===');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron);
console.log('process.type:', process.type);

const electron = require('electron');
console.log('require("electron") type:', typeof electron);

if (typeof electron === 'object' && electron.app) {
    console.log('\\n[SUCCESS] Electron is working correctly!');
    console.log('  - electron.app:', typeof electron.app);
    console.log('  - electron.BrowserWindow:', typeof electron.BrowserWindow);
    console.log('  - electron.ipcMain:', typeof electron.ipcMain);
    process.exit(0);
} else {
    console.log('\\n[FAIL] Electron API not available');
    console.log('  - This usually means ELECTRON_RUN_AS_NODE is set');
    process.exit(1);
}
`;

const electronPath = require('electron');

// Remove ELECTRON_RUN_AS_NODE from env
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['-e', testScript], {
    stdio: 'inherit',
    env
});

child.on('close', (code) => {
    console.log('\n=== Test Complete ===');
    if (code === 0) {
        console.log('All tests passed! Electron is configured correctly.');
    } else {
        console.log('Some tests failed. Check the output above.');
    }
    process.exit(code);
});
