/**
 * SMMM-AI WebSocket Server
 *
 * Next.js + WebSocket server entegrasyonu.
 * Bot progress reporting ve real-time updates için kullanılır.
 */

import { createServer } from 'http';
import { existsSync } from 'fs';
import { join } from 'path';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Environment
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.WS_HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const wsPort = parseInt(process.env.WS_PORT || '3001', 10);

// Internal API base URL (WebSocket server -> Next.js API arası iletişim)
const internalApiBaseUrl = `http://${hostname}:${port}`;

// Turbopack desteği (--turbo argümanı veya TURBOPACK env)
const turbo = process.env.TURBOPACK === 'true' || process.argv.includes('--turbo');

// Next.js app
const app = next({ dev, hostname, port, turbopack: turbo });
const handle = app.getRequestHandler();

// Types
interface DecodedToken {
  id: string;
  email: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

interface Client {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  clientType: 'browser' | 'electron';
}

interface WSMessage {
  type: string;
  data?: unknown;
  payload?: unknown;
}

// Connected clients
const clients = new Map<string, Client>();

// ═══════════════════════════════════════════════════════════════════
// BATCH TRACKING — bot:complete'i tüm batch'ler bitene kadar beklet
// process-results zaten BeyannameTakip'i upsert ediyor, sync gereksiz.
// Sorun: Electron bot:complete gönderdiğinde server'da hâlâ batch işleniyor olabiliyor.
// Çözüm: Pending batch sayısını takip et, 0 olunca complete'i relay et.
// ═══════════════════════════════════════════════════════════════════
interface PendingBotState {
  pendingBatches: number;
  completeMessage?: unknown;   // bot:complete data (bekletiliyorsa)
  clientTenantId?: string;
}
const pendingBotStates = new Map<string, PendingBotState>(); // tenantId → state

function getOrCreateBotState(tenantId: string): PendingBotState {
  if (!pendingBotStates.has(tenantId)) {
    pendingBotStates.set(tenantId, { pendingBatches: 0 });
  }
  return pendingBotStates.get(tenantId)!;
}

function tryRelayBotComplete(tenantId: string) {
  const state = pendingBotStates.get(tenantId);
  if (!state || state.pendingBatches > 0 || !state.completeMessage) return;

  // Tüm batch'ler bitti ve complete mesajı bekliyor — relay et
  console.log(`[WS] ✅ Tüm batch'ler tamamlandı, bot:complete relay ediliyor (tenant: ${tenantId})`);
  broadcastToTenant(tenantId, {
    type: 'bot:complete',
    data: state.completeMessage
  });
  broadcastDashboardInvalidation(tenantId, ['stats', 'declaration-stats', 'activity']);

  // State temizle
  pendingBotStates.delete(tenantId);
}

// Internal API token helper (internal-auth.ts ile aynı mantık)
function getInternalHeaders(tenantId: string): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[WS] INTERNAL_API_SECRET veya JWT_SECRET yapılandırılmamış');
  }
  const token = jwt.sign({ tenantId, purpose: 'internal-api' }, secret, { expiresIn: '1h' });
  return {
    'Content-Type': 'application/json',
    'X-Internal-Token': token,
  };
}

// JWT verification
function verifyToken(token: string): DecodedToken | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[WS] JWT_SECRET not configured');
      return null;
    }
    return jwt.verify(token, secret) as DecodedToken;
  } catch (error) {
    console.error('[WS] Token verification failed:', error);
    return null;
  }
}

// Broadcast to specific tenant
function broadcastToTenant(tenantId: string, data: WSMessage): void {
  let sent = 0;
  clients.forEach((client) => {
    if (client.tenantId === tenantId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
      sent++;
    }
  });
  if (sent > 0) {
    console.log(`[WS] Broadcast to tenant ${tenantId}: ${data.type} (${sent} clients)`);
  }
}

// Broadcast to all clients
function broadcastToAll(data: WSMessage): void {
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
}

// Dashboard invalidation — belirli tenant'ın browser client'larına SWR revalidation sinyali gönderir
function broadcastDashboardInvalidation(tenantId: string, keys: string[]): void {
  broadcastToTenant(tenantId, {
    type: 'dashboard:invalidate',
    data: { keys }
  });
}

// Check if tenant has an active Electron client
function hasElectronClient(tenantId: string): boolean {
  let found = false;
  clients.forEach((client) => {
    if (client.tenantId === tenantId && client.clientType === 'electron' && client.ws.readyState === WebSocket.OPEN) {
      found = true;
    }
  });
  return found;
}

// Notify tenant browsers about Electron bot connection status
function broadcastElectronStatus(tenantId: string): void {
  const connected = hasElectronClient(tenantId);
  clients.forEach((client) => {
    if (client.tenantId === tenantId && client.clientType === 'browser' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'electron:status', data: { connected } }));
    }
  });
  console.log(`[WS] Electron status for tenant ${tenantId}: ${connected ? 'connected' : 'disconnected'}`);
}

// Handle incoming messages
async function handleMessage(ws: WebSocket, client: Client, message: WSMessage): Promise<void> {
  console.log(`[WS] Message from ${client.userId}:`, message.type);

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'BOT_PROGRESS':
      // Relay bot progress to tenant
      broadcastToTenant(client.tenantId, {
        type: 'BOT_PROGRESS',
        payload: message.payload || message.data
      });
      break;

    case 'bot:progress':
      // Relay bot progress to tenant (from Electron bot via ws-client.sendProgress)
      console.log('[WS] 📡 Bot progress from Electron:', (message.data as any)?.message || 'progress');
      console.log('[WS] Broadcasting to tenant:', client.tenantId);
      broadcastToTenant(client.tenantId, {
        type: 'bot:progress',
        data: message.data
      });
      break;

    case 'bot:mukellef-data':
      // Handle mükellef import from Electron bot - Call API endpoint (includes folder creation)
      try {
        const data = message.data as any;
        const taxpayers = data?.taxpayers || [];
        const tenantId = client.tenantId;

        if (taxpayers.length > 0) {
          console.log(`[WS] 💾 Importing ${taxpayers.length} taxpayers via API endpoint...`);

          // Call internal API endpoint which handles both database import and folder creation
          const response = await fetch(`${internalApiBaseUrl}/api/gib/mukellefler/import`, {
            method: 'POST',
            headers: getInternalHeaders(tenantId),
            body: JSON.stringify({ taxpayers })
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();

          console.log(`[WS] ✅ API Import completed:`, result.stats);

          // Notify tenant clients
          broadcastToTenant(tenantId, {
            type: 'gib:mukellef-import-complete',
            data: {
              success: result.success,
              count: result.stats.created,
              total: result.stats.total,
              stats: result.stats,
              message: result.message,
              taxpayers: result.taxpayers || []
            }
          });
        } else {
          console.log('[WS] No taxpayers to import');
        }
      } catch (error: any) {
        console.error('[WS] Error importing taxpayers:', error?.message || error);
        console.error('[WS] Full error:', JSON.stringify(error, null, 2));

        broadcastToTenant(client.tenantId, {
          type: 'gib:mukellef-import-error',
          data: { error: error?.message || 'Unknown error' }
        });
      }
      break;

    case 'bot:complete': {
      // bot:complete geldi ama server'da hâlâ batch işleniyor olabilir
      // Tüm batch'ler bitene kadar beklet, sonra relay et
      const completeState = getOrCreateBotState(client.tenantId);
      completeState.completeMessage = message.data;

      if (completeState.pendingBatches === 0) {
        // Tüm batch'ler zaten bitti — hemen relay et
        console.log('[WS] Bot complete event, tüm batch\'ler zaten tamamlanmış — relay ediliyor');
        tryRelayBotComplete(client.tenantId);
      } else {
        console.log(`[WS] Bot complete event bekletiliyor — ${completeState.pendingBatches} batch hâlâ işleniyor`);
      }
      break;
    }

    case 'bot:error':
      // Relay bot error to tenant with error code
      console.log('[WS] Bot error event:', message.data);
      broadcastToTenant(client.tenantId, {
        type: 'bot:error',
        data: {
          error: (message.data as any)?.error || (message.data as any)?.message,
          errorCode: (message.data as any)?.errorCode || 'UNKNOWN',
          errorDetails: (message.data as any)?.errorDetails,
          isCritical: (message.data as any)?.isCritical || (message.data as any)?.errorDetails?.isCritical,
          timestamp: new Date().toISOString()
        }
      });
      break;

    case 'bot:batch-results': {
      // Process batch results from Electron bot - Call API endpoint to save files and update BeyannameTakip
      const batchState = getOrCreateBotState(client.tenantId);
      batchState.pendingBatches++;

      try {
        const batchData = message.data as { beyannameler?: unknown[]; startDate?: string; tenantId?: string };
        const beyannameler = batchData?.beyannameler || [];
        const startDate = batchData?.startDate;
        const tenantId = client.tenantId;

        if (beyannameler.length > 0) {
          console.log(`[WS] 📥 Processing ${beyannameler.length} beyanname(s) via API endpoint...`);

          // DEBUG: Buffer durumlarını logla
          for (const b of beyannameler as any[]) {
            console.log(`[WS-DEBUG] ${b.tcVkn} - beyannameBuffer: ${b.beyannameBuffer ? 'VAR' : 'YOK'}, tahakkukBuffer: ${b.tahakkukBuffer ? 'VAR' : 'YOK'}`);
          }

          // Call internal API endpoint which handles file saving and BeyannameTakip update
          // 429 rate limit hatası için retry mekanizması
          let response: Response | null = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            response = await fetch(`${internalApiBaseUrl}/api/gib/process-results`, {
              method: 'POST',
              headers: getInternalHeaders(tenantId),
              body: JSON.stringify({ beyannameler, startDate })
            });

            if (response.status === 429 && attempt < 3) {
              const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10);
              console.warn(`[WS] ⚠️ Rate limit (429), ${retryAfter}s sonra yeniden denenecek (${attempt}/3)`);
              await new Promise(r => setTimeout(r, retryAfter * 1000));
              continue;
            }
            break;
          }

          if (!response!.ok) {
            const errorText = await response!.text();
            throw new Error(`API error: ${response!.status} ${response!.statusText} - ${errorText}`);
          }

          const result = await response!.json();

          console.log(`[WS] ✅ Batch processing completed:`, {
            matched: result.stats?.matched || 0,
            unmatched: result.stats?.unmatched || 0,
            filesProcessed: result.stats?.filesProcessed || 0
          });

          // ═══════════════════════════════════════════════════════════════════
          // OTOMATİK MÜKELLEF OLUŞTURMA - Eşleşmeyen mükellefleri otomatik ekle
          // ═══════════════════════════════════════════════════════════════════
          const unmatchedDetails = result.unmatchedDetails || [];
          let createdCustomers: Array<{ id: string; unvan: string; vknTckn: string }> = [];

          if (unmatchedDetails.length > 0) {
            console.log(`[WS] 🆕 ${unmatchedDetails.length} eşleşmeyen mükellef, otomatik oluşturuluyor...`);

            // Format: taxpayer array'e çevir
            // NOT: Bot "adSoyadUnvan" gönderiyor, process-results "unvan" olarak kaydediyor
            const taxpayersToCreate = unmatchedDetails.map((d: any) => ({
              unvan: d.unvan || d.adSoyadUnvan || "İsimsiz Mükellef",
              vergiKimlikNo: d.tcVkn,
              tcKimlikNo: d.tcVkn?.length === 11 ? d.tcVkn : null,
              vergiDairesi: d.vergiDairesi || null
            }));

            // Import API çağır
            const importResponse = await fetch(`${internalApiBaseUrl}/api/gib/mukellefler/import`, {
              method: 'POST',
              headers: getInternalHeaders(tenantId),
              body: JSON.stringify({ taxpayers: taxpayersToCreate })
            });

            if (importResponse.ok) {
              const importResult = await importResponse.json();
              createdCustomers = (importResult.taxpayers || []).map((t: any) => ({
                id: t.id,
                unvan: t.unvan,
                vknTckn: t.vergiKimlikNo || t.vknTckn
              }));
              console.log(`[WS] ✅ ${createdCustomers.length} mükellef oluşturuldu`);

              // RE-PROCESSING: Yeni mükelleflerin beyannamelerini işle
              if (createdCustomers.length > 0) {
                const createdVkns = new Set(createdCustomers.map(c => c.vknTckn));
                const toReprocess = (beyannameler as any[]).filter((b: any) => createdVkns.has(b.tcVkn));

                if (toReprocess.length > 0) {
                  await new Promise(r => setTimeout(r, 500)); // DB yazımı bekle

                  console.log(`[WS] 🔄 ${toReprocess.length} beyanname yeniden işleniyor...`);

                  const reprocessRes = await fetch(`${internalApiBaseUrl}/api/gib/process-results`, {
                    method: 'POST',
                    headers: getInternalHeaders(tenantId),
                    body: JSON.stringify({ beyannameler: toReprocess, startDate })
                  });

                  if (reprocessRes.ok) {
                    const reprocessResult = await reprocessRes.json();
                    // Stats güncelle
                    result.stats.matched = (result.stats.matched || 0) + (reprocessResult.stats?.matched || 0);
                    result.stats.filesProcessed = (result.stats.filesProcessed || 0) + (reprocessResult.stats?.filesProcessed || 0);
                    result.stats.unmatched = (result.stats.unmatched || 0) - createdCustomers.length;

                    console.log(`[WS] ✅ Re-processing tamamlandı: +${reprocessResult.stats?.matched || 0} eşleşme, +${reprocessResult.stats?.filesProcessed || 0} dosya`);
                  }
                }
              }
            } else {
              console.error(`[WS] ❌ Mükellef import hatası: ${importResponse.status}`);
            }
          }

          // NOT: Sync artık her batch'te değil, bot:complete'te tek sefer çalışır

          // Notify tenant clients about processed batch (createdCustomers ile)
          broadcastToTenant(tenantId, {
            type: 'bot:batch-processed',
            data: {
              success: true,
              stats: result.stats,
              createdCustomers,
              unmatchedCount: unmatchedDetails.length,
              message: `${beyannameler.length} beyanname işlendi`
            }
          });

          // NOT: Dashboard invalidation artık bot:complete'te tek sefer gönderiliyor
        } else {
          console.log('[WS] No beyannameler in batch to process');
        }
      } catch (error) {
        console.error('[WS] Error processing batch results:', error);

        broadcastToTenant(client.tenantId, {
          type: 'bot:batch-error',
          data: { error: (error as Error).message }
        });
      } finally {
        // Batch bitti (başarılı veya hatalı) — counter'ı azalt
        batchState.pendingBatches = Math.max(0, batchState.pendingBatches - 1);
        console.log(`[WS] Batch tamamlandı, kalan: ${batchState.pendingBatches}`);

        // Tüm batch'ler bittiyse ve bot:complete bekliyorsa → relay et
        if (batchState.pendingBatches === 0 && batchState.completeMessage) {
          tryRelayBotComplete(client.tenantId);
        }
      }
      break;
    }

    case 'gib:mukellef-import-complete':
      // Relay import completion to tenant
      broadcastToTenant(client.tenantId, {
        type: 'gib:mukellef-import-complete',
        data: message.data
      });
      break;

    case 'sgk:parse-complete':
      // Relay SGK parse completion to tenant (from Electron bot)
      console.log('[WS] SGK parse complete event, relaying to tenant:', client.tenantId);
      broadcastToTenant(client.tenantId, {
        type: 'sgk:parse-complete',
        data: message.data
      });
      break;

    case 'bot:stop':
      // Bot durdurma komutu - tüm Electron client'lara ilet
      console.log('[WS] 🛑 Bot stop command, broadcasting to tenant:', client.tenantId);
      broadcastToTenant(client.tenantId, {
        type: 'bot:stop',
        data: message.data
      });
      break;

    case 'gib:prepare':
      // ⚡ Tarayıcı hazırla sinyali — frontend'den Electron'a direkt relay
      console.log(`[WS] ⚡ GİB prepare sinyali: ${(message.data as Record<string, unknown>)?.application || 'ivd'}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'gib:ivd-progress':
    case 'gib:ivd-complete':
    case 'gib:launch-progress':
    case 'gib:launch-complete':
    case 'gib:vergi-levhasi-progress':
    case 'gib:vergi-levhasi-ready':
    case 'gib:vergi-levhasi-error':
      // GİB progress ve complete mesajlarını relay et
      console.log(`[WS] GİB event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'turmob:launch-progress':
    case 'turmob:launch-complete':
      // TÜRMOB Luca progress ve complete mesajlarını relay et
      console.log(`[WS] TÜRMOB event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'diger-islemler:launch-progress':
    case 'diger-islemler:launch-complete':
      // Diğer İşlemler progress ve complete mesajlarını relay et
      console.log(`[WS] Diğer İşlemler event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'earsiv:query-progress':
    case 'earsiv:query-results':
    case 'earsiv:query-complete':
    case 'earsiv:query-error':
      // E-Arşiv fatura sorgulama mesajlarını relay et
      console.log(`[WS] E-Arşiv query event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'intvrg:pos-progress':
    case 'intvrg:pos-results':
    case 'intvrg:pos-complete':
    case 'intvrg:pos-error':
      // POS sorgulama mesajlarını relay et
      console.log(`[WS] POS event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'intvrg:okc-progress':
    case 'intvrg:okc-results':
    case 'intvrg:okc-complete':
    case 'intvrg:okc-error':
      // ÖKC bildirim sorgulama mesajlarını relay et
      console.log(`[WS] OKC event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'etebligat:query-progress':
    case 'etebligat:query-results':
    case 'etebligat:query-complete':
    case 'etebligat:query-error':
    case 'etebligat:zarf-detay-result':
    case 'etebligat:zarf-detay-error':
    case 'etebligat:pdf-result':
    case 'etebligat:pdf-error':
      // E-Tebligat sorgulama mesajlarını relay et
      console.log(`[WS] E-Tebligat event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'sgk:ebildirge-progress':
    case 'sgk:ebildirge-results':
    case 'sgk:ebildirge-error':
    case 'sgk:ebildirge-pdf-result':
    case 'sgk:ebildirge-pdf-skip':
    case 'sgk:ebildirge-pipeline-complete':
      // SGK E-Bildirge mesajlarını relay et
      console.log(`[WS] SGK E-Bildirge event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    case 'intvrg-test:progress':
    case 'intvrg-test:results':
    case 'intvrg-test:complete':
    case 'intvrg-test:error':
      // INTVRG Beyanname Test mesajlarını relay et
      console.log(`[WS] INTVRG Test event: ${message.type}`);
      broadcastToTenant(client.tenantId, message);
      break;

    default:
      // Relay unknown messages to tenant
      broadcastToTenant(client.tenantId, message);
  }
}

// Start server
app.prepare().then(() => {
  // HTTP Server for Next.js + Internal API
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url!, `http://${req.headers.host || `${hostname}:${port}`}`);

      // Internal API endpoints for Electron delegation
      if (parsedUrl.pathname === '/_internal/clients' && req.method === 'GET') {
        // Return connected clients grouped by userId
        const clientsByUser = new Map<string, number>();
        let electronCount = 0;
        clients.forEach((client) => {
          const count = clientsByUser.get(client.userId) || 0;
          clientsByUser.set(client.userId, count + 1);
          if (client.clientType === 'electron') {
            electronCount++;
          }
        });

        const clientsArray = Array.from(clientsByUser.entries()).map(([userId, count]) => ({
          userId,
          count
        }));

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          clients: clientsArray,
          totalUsers: clientsByUser.size,
          totalConnections: clients.size,
          electronConnections: electronCount
        }));
        return;
      }

      if (parsedUrl.pathname === '/_internal/bot-command' && req.method === 'POST') {
        // Read POST body
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            const { userId, tenantId, type, data } = payload;

            if (!tenantId || !type) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'tenantId and type required' }));
              return;
            }

            console.log(`[INTERNAL-API] Broadcasting bot command to tenant ${tenantId}: ${type}`);

            // Broadcast to tenant (all connected Electron clients)
            broadcastToTenant(tenantId, { type, data });

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Command broadcast to tenant' }));
          } catch (e) {
            console.error('[INTERNAL-API] Parse error:', e);
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      // Dashboard invalidation endpoint (Next.js API route'larından çağrılır)
      if (parsedUrl.pathname === '/_internal/dashboard-invalidate' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { tenantId, keys } = JSON.parse(body);
            if (tenantId && Array.isArray(keys) && keys.length) {
              broadcastDashboardInvalidation(tenantId, keys);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 400;
              res.end('Missing tenantId or keys');
            }
          } catch {
            res.statusCode = 400;
            res.end('Invalid JSON');
          }
        });
        return;
      }

      // Dev modda derleme sırasında manifest dosyaları henüz hazır olmayabilir
      // handle() çağrılmadan önce kontrol edip 503 dönüyoruz
      if (dev) {
        const manifestPath = join(process.cwd(), '.next', 'routes-manifest.json');
        if (!existsSync(manifestPath)) {
          res.setHeader('Retry-After', '2');
          res.statusCode = 503;
          res.end('Derleniyor, lütfen bekleyin...');
          return;
        }
      }

      // Default: Next.js handler
      await handle(req, res);
    } catch (err: unknown) {
      const errObj = err as { code?: string; path?: string };
      // Derleme sırasında manifest/build dosyaları geçici olarak silinebilir
      if (errObj?.code === 'ENOENT' && errObj?.path?.includes('.next')) {
        if (!res.headersSent) {
          res.setHeader('Retry-After', '2');
          res.statusCode = 503;
          res.end('Derleniyor, lütfen bekleyin...');
        }
        return;
      }
      console.error('[HTTP] Error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws, req) => {
    try {
      // Parse URL and get token
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log('[WS] Connection rejected: No token');
        ws.close(1008, 'Token required');
        return;
      }

      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        console.log('[WS] Connection rejected: Invalid token');
        ws.close(1008, 'Invalid token');
        return;
      }

      // Register client - Her bağlantı için benzersiz ID kullan
      // Aynı kullanıcı birden fazla bağlantı açabilir (browser + Electron)
      const clientType = (url.searchParams.get('clientType') === 'electron' ? 'electron' : 'browser') as 'browser' | 'electron';
      const clientId = `${decoded.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const client: Client = {
        ws,
        tenantId: decoded.tenantId,
        userId: decoded.id,
        clientType
      };
      clients.set(clientId, client);

      console.log(`[WS] Client connected: ${clientId} (tenant: ${decoded.tenantId}, type: ${clientType})`);

      // Electron bot bağlandığında tarayıcı client'lara bildir
      if (clientType === 'electron') {
        broadcastElectronStatus(decoded.tenantId);
      }

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established'
      }));

      // Browser client'a mevcut Electron bağlantı durumunu bildir
      if (clientType === 'browser') {
        ws.send(JSON.stringify({
          type: 'electron:status',
          data: { connected: hasElectronClient(decoded.tenantId) }
        }));
      }

      // Handle messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          await handleMessage(ws, client, message);
        } catch (error) {
          console.error('[WS] Message parse error:', error);
        }
      });

      // Handle close
      ws.on('close', () => {
        const disconnectedClient = clients.get(clientId);
        clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId}`);

        // Electron bot koptuysa tarayıcı client'lara bildir
        if (disconnectedClient?.clientType === 'electron') {
          broadcastElectronStatus(disconnectedClient.tenantId);
        }
      });

      // Handle error
      ws.on('error', (error) => {
        console.error(`[WS] Client error (${clientId}):`, error);
        const errorClient = clients.get(clientId);
        clients.delete(clientId);

        // Electron bot hata verdiyse tarayıcı client'lara bildir
        if (errorClient?.clientType === 'electron') {
          broadcastElectronStatus(errorClient.tenantId);
        }
      });

    } catch (error) {
      console.error('[WS] Connection error:', error);
      ws.close(1011, 'Server error');
    }
  });

  wss.on('error', (error) => {
    console.error('[WS Server] Error:', error);
  });

  // Start HTTP server
  server.listen(port, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SMMM-AI SERVER                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 HTTP Server:      http://${hostname}:${port}                 ║`);
    console.log(`║  🔌 WebSocket Server: ws://${hostname}:${wsPort}                  ║`);
    console.log(`║  📦 Mode:             ${dev ? 'Development' : 'Production'}                      ║`);
    console.log(`║  ⚡ Turbopack:        ${turbo ? 'Enabled' : 'Disabled'}                       ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down...');
    await prisma.$disconnect();
    wss.close();
    server.close(() => {
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('[Server] SIGINT received, shutting down...');
    await prisma.$disconnect();
    wss.close();
    server.close(() => {
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });
  });
});

// Export for external use (e.g., from API routes)
export { broadcastToTenant, broadcastToAll, broadcastDashboardInvalidation, clients };
