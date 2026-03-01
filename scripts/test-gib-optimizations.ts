/**
 * GİB API Optimizasyon Test Script
 *
 * Kullanım:
 *   npx ts-node scripts/test-gib-optimizations.ts
 *
 * Environment:
 *   OCR_SPACE_API_KEY=xxx
 *   CAPTCHA_API_KEY=xxx (2Captcha)
 *   GIB_KODU=xxx
 *   GIB_SIFRE=xxx
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import {
  // Captcha
  checkOcrSpaceStatus,
  check2CaptchaBalance,
  createCaptchaProvider,

  // Session
  SessionManager,

  // INTVRG
  IntVrgService,

  // Pipeline
  DownloadPipeline,

  // Logger
  createLogger,

  // Error Handler
  GibApiError,
  detectErrorCodeExtended,
  getErrorInfo,

  // Services
  ETebligatService,
  BorcService,
} from '../src/lib/gib-api/index';

// ═══════════════════════════════════════════════════════════════════════════
// Test Logger
// ═══════════════════════════════════════════════════════════════════════════

const logger = createLogger('TEST', { minLevel: 'debug' });

// ═══════════════════════════════════════════════════════════════════════════
// Test: OCR.space Status
// ═══════════════════════════════════════════════════════════════════════════

async function testOcrSpaceStatus() {
  logger.info('=== OCR.space Status Test ===');

  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    logger.warn('OCR_SPACE_API_KEY tanımlı değil, test atlanıyor');
    return false;
  }

  const result = await checkOcrSpaceStatus(apiKey);
  logger.info('OCR.space Status', { ...result });

  return result.available;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: 2Captcha Balance
// ═══════════════════════════════════════════════════════════════════════════

async function test2CaptchaBalance() {
  logger.info('=== 2Captcha Balance Test ===');

  const apiKey = process.env.CAPTCHA_API_KEY;

  if (!apiKey) {
    logger.warn('CAPTCHA_API_KEY tanımlı değil, test atlanıyor');
    return false;
  }

  const balance = await check2CaptchaBalance(apiKey);
  logger.info('2Captcha Balance', { balance: balance ? `$${balance.toFixed(2)}` : 'N/A' });

  return balance !== null && balance > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Unified Captcha Provider
// ═══════════════════════════════════════════════════════════════════════════

async function testCaptchaProvider() {
  logger.info('=== Captcha Provider Test ===');

  const provider = createCaptchaProvider({
    provider: 'auto',
    ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY,
    twoCaptchaApiKey: process.env.CAPTCHA_API_KEY,
  });

  const available = provider.getAvailableProviders();
  logger.info('Kullanılabilir Provider\'lar', { providers: available });

  // Stats kontrol
  const stats = provider.getStats();
  logger.info('Provider Stats', { ...stats });

  return available.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Session Manager
// ═══════════════════════════════════════════════════════════════════════════

async function testSessionManager() {
  logger.info('=== Session Manager Test ===');

  const manager = new SessionManager({
    captchaApiKey: process.env.CAPTCHA_API_KEY,
    ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY,
    sessionTimeout: 30 * 60 * 1000,
    autoRefreshInterval: 25 * 60 * 1000,
  });

  // Stats kontrol
  const stats = manager.getStats();
  logger.info('Session Manager Stats', { ...stats });

  // Cache status
  const cacheStatus = manager.getCacheStatus();
  logger.info('Cache Status', { count: cacheStatus.length });

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Error Handler
// ═══════════════════════════════════════════════════════════════════════════

function testErrorHandler() {
  logger.info('=== Error Handler Test ===');

  const testCases = [
    'Kullanıcı adı veya şifre hatalı',
    'Session timeout - oturum sona erdi',
    'Captcha doğrulaması başarısız',
    'HTTP 401 Unauthorized',
    'Rate limit exceeded - too many requests',
    '148 byte PDF error',
    'ECONNREFUSED - bağlantı reddedildi',
  ];

  for (const msg of testCases) {
    const code = detectErrorCodeExtended(msg);
    const info = getErrorInfo(code);
    logger.debug(`"${msg}"`, {
      code,
      isCritical: info.isCritical,
      shouldRetry: info.shouldRetry,
      userMessage: info.userMessage,
    });
  }

  // GibApiError test
  try {
    throw new GibApiError('Test: Session timeout error');
  } catch (err) {
    if (err instanceof GibApiError) {
      logger.info('GibApiError Test', err.toLogObject());
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Download Pipeline (Mock)
// ═══════════════════════════════════════════════════════════════════════════

async function testDownloadPipeline() {
  logger.info('=== Download Pipeline Test ===');

  const pipeline = new DownloadPipeline({
    concurrency: 3,
    delayBetween: 100, // Test için kısa
    downloadTimeout: 5000,
    retryCount: 1,
  });

  // Mock items
  const mockItems = [
    { beyanname: { oid: 'test1', beyannameTuru: 'KDV1', beyannameTuruAd: 'KDV', tcVkn: '1234567890', adSoyadUnvan: 'Test 1', vergiDairesi: 'Test VD', vergilendirmeDonemi: '2024/01', yuklemeZamani: '2024-01-15', durumu: 'ONAYLANDI' as const, rowIndex: 0 }, downloadTypes: ['beyanname' as const] },
    { beyanname: { oid: 'test2', beyannameTuru: 'KDV1', beyannameTuruAd: 'KDV', tcVkn: '1234567891', adSoyadUnvan: 'Test 2', vergiDairesi: 'Test VD', vergilendirmeDonemi: '2024/02', yuklemeZamani: '2024-02-15', durumu: 'ONAYLANDI' as const, rowIndex: 1 }, downloadTypes: ['beyanname' as const] },
  ];

  pipeline.addItems(mockItems);

  // Mock download function
  const mockDownload = async (oid: string, type: string) => {
    await new Promise(r => setTimeout(r, 50));
    return { success: true, base64: 'dGVzdA==' }; // "test" in base64
  };

  // Progress callback
  const onProgress = (progress: { percent: number; processedCount: number; status: string }) => {
    logger.debug('Pipeline Progress', { percent: progress.percent, processed: progress.processedCount, status: progress.status });
  };

  const result = await pipeline.start(mockDownload, onProgress);

  logger.info('Pipeline Result', {
    success: result.success,
    downloaded: result.stats.downloaded,
    failed: result.stats.failed,
    duration: result.stats.totalDuration,
  });

  return result.success;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Logger
// ═══════════════════════════════════════════════════════════════════════════

function testLogger() {
  logger.info('=== Logger Test ===');

  const testLogger = createLogger('TEST-LOGGER', { minLevel: 'debug' });

  testLogger.debug('Debug mesajı', { key: 'value' });
  testLogger.info('Info mesajı', { count: 42 });
  testLogger.warn('Warning mesajı');
  testLogger.error('Error mesajı', new Error('Test error'));

  // Timer test
  const timer = testLogger.startTimer('test-operation');
  // Simulate work
  const start = Date.now();
  while (Date.now() - start < 50) { /* busy wait */ }
  timer.end('İşlem tamamlandı', { result: 'success' });

  // Child logger
  const childLogger = testLogger.child({ tenantId: 'tenant-123' });
  childLogger.info('Child logger mesajı');

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: INTVRG Service (Structure only)
// ═══════════════════════════════════════════════════════════════════════════

function testIntVrgService() {
  logger.info('=== INTVRG Service Test (Structure) ===');

  const service = new IntVrgService();

  // Method varlığı kontrolü
  const methods = ['loginWithToken', 'loginWithSession', 'searchBeyannameler', 'downloadPdf', 'convertToStandard'];
  const available = methods.filter(m => typeof (service as any)[m] === 'function');

  logger.info('INTVRG Methods', { available, total: methods.length });

  return available.length === methods.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test: Gateway Services (Structure only)
// ═══════════════════════════════════════════════════════════════════════════

function testGatewayServices() {
  logger.info('=== Gateway Services Test (Structure) ===');

  // Mock session
  const mockSession = {
    sessionId: 'test',
    jsessionId: 'test',
    cookies: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    isValid: true,
    userId: 'test',
    token: 'test-token',
  };

  // E-Tebligat
  const etebligat = new ETebligatService(mockSession);
  const etebligatMethods = ['listeTebligatlar', 'listeEkler', 'indirBelge', 'indirEk'];
  logger.info('ETebligatService', { methods: etebligatMethods.length });

  // Borç
  const borc = new BorcService(mockSession);
  const borcMethods = ['sorgula', 'getDetay', 'getOzet', 'getVadesiGecmisBorclar'];
  logger.info('BorcService', { methods: borcMethods.length });

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n🧪 GİB API Optimizasyon Testleri\n');
  console.log('='.repeat(60));

  const results: { name: string; passed: boolean }[] = [];

  // Unit Tests (API key gerektirmeyen)
  results.push({ name: 'Error Handler', passed: testErrorHandler() });
  results.push({ name: 'Logger', passed: testLogger() });
  results.push({ name: 'INTVRG Service (Structure)', passed: testIntVrgService() });
  results.push({ name: 'Gateway Services (Structure)', passed: testGatewayServices() });
  results.push({ name: 'Session Manager', passed: await testSessionManager() });
  results.push({ name: 'Download Pipeline (Mock)', passed: await testDownloadPipeline() });
  results.push({ name: 'Captcha Provider', passed: await testCaptchaProvider() });

  // API Tests (API key gerektirir)
  results.push({ name: 'OCR.space Status', passed: await testOcrSpaceStatus() });
  results.push({ name: '2Captcha Balance', passed: await test2CaptchaBalance() });

  // Sonuçları göster
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Sonuçları:\n');

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.passed) passed++;
    else failed++;
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  Toplam: ${results.length} | Başarılı: ${passed} | Başarısız: ${failed}`);
  console.log('='.repeat(60) + '\n');

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
