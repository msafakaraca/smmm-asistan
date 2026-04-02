/**
 * WebSocket Client
 * ================
 * Website ile real-time iletişim
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface QueuedMessage {
    type: string;
    data: unknown;
    critical?: boolean; // Critical messages (like bot:complete) get retry
}

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private url: string;
    private token: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isConnected = false;

    /** WebSocket bağlantı durumu (earsiv:query ve diğer handler'lar tarafından kullanılır) */
    get connected(): boolean {
        return this.isConnected;
    }

    // Reconnect tracking
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 20; // Max 20 deneme (~100 saniye)

    // Message queue for when WebSocket is disconnected
    private messageQueue: QueuedMessage[] = [];
    private readonly MAX_QUEUE_SIZE = 100;

    constructor(url: string, token: string) {
        super();
        this.url = url;
        this.token = token;
        this.connect();
    }

    private connect() {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[WS] 🔌 WebSocket bağlantısı başlatılıyor...');
        console.log('[WS] URL:', this.url);
        console.log('[WS] Token (ilk 50 karakter):', this.token?.substring(0, 50) + '...');
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            // Token + clientType query parameter olarak ekle
            const wsUrl = `${this.url}?token=${this.token}&clientType=electron`;
            console.log('[WS] Full URL with token:', wsUrl.substring(0, 100) + '...');

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('═══════════════════════════════════════════════════════════════');
                console.log('[WS] ✅ WebSocket bağlantısı kuruldu!');
                console.log('[WS] Sunucu URL:', this.url);
                console.log('[WS] Token mevcut:', !!this.token);
                console.log('═══════════════════════════════════════════════════════════════');
                this.isConnected = true;
                this.reconnectAttempts = 0; // Başarılı bağlantıda sıfırla
                this.emit('connected');

                // Clear reconnect timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }

                // Kuyrukta bekleyen mesajları gönder
                if (this.messageQueue.length > 0) {
                    console.log(`[WS] 📤 ${this.messageQueue.length} kuyrukta bekleyen mesaj gönderiliyor...`);
                    const queueCopy = [...this.messageQueue];
                    this.messageQueue = [];
                    for (const msg of queueCopy) {
                        this.send(msg.type, msg.data);
                    }
                    console.log('[WS] ✅ Kuyruk temizlendi');
                }
            });

            this.ws.on('message', (rawData: WebSocket.RawData) => {
                try {
                    const message = JSON.parse(rawData.toString());
                    console.log('[WS] 📨 Mesaj alındı:', message.type);

                    if (message.type === 'bot:start') {
                        console.log('[WS] 🤖 BOT:START komutu alındı!');
                        console.log('[WS] Data:', JSON.stringify(message.data, null, 2));
                    }

                    // Emit specific event
                    this.emit(message.type, message.data);
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            });

            this.ws.on('close', (code: number, reason: Buffer) => {
                const reasonStr = reason?.toString() || '';
                console.log(`[WS] Disconnected (code: ${code}, reason: ${reasonStr})`);
                this.isConnected = false;
                this.ws = null;
                this.emit('disconnected');

                // 1008 = Policy Violation → token geçersiz/expired
                if (code === 1008) {
                    console.error('[WS] ❌ Token geçersiz veya süresi dolmuş, yeniden giriş gerekiyor');
                    this.emit('auth-failed', reasonStr);
                    return; // Reconnect deneme - aynı token ile bağlanamaz
                }

                this.scheduleReconnect();
            });

            this.ws.on('error', (err: Error) => {
                // EPIPE hataları normal, ignore et
                if (err.message.includes('EPIPE') || err.message.includes('broken pipe')) {
                    console.log('[WS] Connection closed');
                    return;
                }
                console.error('[WS] Error:', err.message);
            });
        } catch (err) {
            console.error('[WS] Connection error:', err);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;

        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
            console.error(`[WS] ❌ Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) aşıldı!`);
            this.emit('max-reconnect-reached');
            return;
        }

        console.log(`[WS] Reconnecting in 5s... (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 5000);
    }

    send(type: string, data: unknown, queueIfDisconnected = true) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // WebSocket kapalı - mesajı kuyruğa ekle
            if (queueIfDisconnected && this.messageQueue.length < this.MAX_QUEUE_SIZE) {
                this.messageQueue.push({ type, data });
                console.warn(`[WS] ⏳ Mesaj kuyruğa eklendi (${this.messageQueue.length}): ${type}`);
            } else if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
                console.error(`[WS] ❌ Kuyruk dolu! Mesaj kaybedildi: ${type}`);
            }
            return;
        }

        try {
            this.ws.send(JSON.stringify({ type, data }));
        } catch (err: any) {
            // EPIPE hatalarını ignore et
            if (!err.message?.includes('EPIPE') && !err.message?.includes('broken pipe')) {
                console.error('[WS] Send error:', err.message);
                // Hatada kuyruğa ekle
                if (queueIfDisconnected && this.messageQueue.length < this.MAX_QUEUE_SIZE) {
                    this.messageQueue.push({ type, data });
                    console.warn(`[WS] ⏳ Hata sonrası kuyruğa eklendi: ${type}`);
                }
            }
        }
    }

    sendProgress(progress: number, message: string) {
        this.send('bot:progress', { progress, message });
    }

    sendComplete(result: unknown, maxRetries = 3) {
        const attemptSend = (retryCount: number) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                if (retryCount < maxRetries) {
                    console.warn(`[WS] ⏳ bot:complete gönderilemiyor, ${retryCount + 1}. deneme 2s sonra...`);
                    setTimeout(() => attemptSend(retryCount + 1), 2000);
                } else {
                    console.error('[WS] ❌ bot:complete gönderilemedi! Max retry aşıldı.');
                    // Kuyruğa ekle - bağlantı kurulunca gönderilecek
                    if (this.messageQueue.length < this.MAX_QUEUE_SIZE) {
                        this.messageQueue.push({ type: 'bot:complete', data: result, critical: true });
                        console.warn('[WS] ⏳ bot:complete kuyruğa eklendi');
                    }
                    this.emit('send-failed', { type: 'bot:complete', data: result });
                }
                return;
            }
            this.send('bot:complete', result, false); // Retry içinde tekrar kuyruğa ekleme
            console.log('[WS] ✅ bot:complete başarıyla gönderildi');
        };

        attemptSend(0);
    }

    sendError(error: string, errorCode?: string, errorDetails?: object) {
        this.send('bot:error', {
            error,
            errorCode: errorCode || 'UNKNOWN',
            errorDetails,
            timestamp: new Date().toISOString()
        });
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close();
                }
            } catch (err) {
                // Ignore cleanup errors
            }
            this.ws = null;
        }

        this.isConnected = false;
    }
}
