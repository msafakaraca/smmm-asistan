/**
 * Storage
 * ========
 * File-based JSON storage (no native modules needed)
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface StoreData {
    session?: {
        user: unknown;
        token: string;
    };
    cache?: Record<string, { value: unknown; expiresAt?: string }>;
}

let store: StoreData = {};
let storeFilePath = '';

function loadStore() {
    try {
        if (fs.existsSync(storeFilePath)) {
            const data = fs.readFileSync(storeFilePath, 'utf-8');
            store = JSON.parse(data);
        }
    } catch (err) {
        console.error('[STORE] Load error:', err);
        store = {};
    }
}

function saveStore() {
    try {
        fs.writeFileSync(storeFilePath, JSON.stringify(store, null, 2));
    } catch (err) {
        console.error('[STORE] Save error:', err);
    }
}

export function initDatabase() {
    storeFilePath = path.join(app.getPath('userData'), 'smmm-bot-data.json');
    loadStore();
    console.log('[STORE] Initialized:', storeFilePath);
}

export function saveSession(user: unknown, token: string) {
    store.session = { user, token };
    saveStore();
}

export function getSession(): { user: unknown; token: string } | null {
    return store.session || null;
}

export function clearSession() {
    delete store.session;
    saveStore();
}

// Cache helpers
export function setCache(key: string, value: unknown, ttlSeconds?: number) {
    if (!store.cache) store.cache = {};
    const expiresAt = ttlSeconds
        ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
        : undefined;

    store.cache[key] = { value, expiresAt };
    saveStore();
}

export function getCache<T>(key: string): T | null {
    if (!store.cache) return null;
    const item = store.cache[key];

    if (!item) return null;

    // Check expiration
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
        delete store.cache[key];
        saveStore();
        return null;
    }

    return item.value as T;
}

export function clearCache() {
    delete store.cache;
    saveStore();
}
