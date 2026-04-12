/**
 * INTVRG Vergi Levhası API Modülü
 * ================================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden vergi levhası sorgulama ve PDF indirme.
 *
 * Akış: Mali Müşavir GİB Login (TEK LOGIN) → IVD Token → PARALEL Sorgulama → PDF İndir
 *
 * Önemli Fark: Diğer INTVRG modüllerinden farklı olarak, her mükellef için ayrı login YAPILMAZ.
 * Mali müşavirin kendi GİB bilgileriyle tek login yapılır, ardından tüm mükellefler sorgulanır.
 *
 * VKN/TCKN Kuralı:
 * - sirketTipi === "sahis" veya "basit_usul" → TCKN (mukellefTCKimlikNo) gönder
 * - sirketTipi === "firma" → VKN (mukellefVergiNo) gönder
 * - vknTckn.length ile değil, sirketTipi ile karar ver!
 *
 * Referans: intvrg-tahsilat-api.ts (IntrvrgClient, getIvdToken)
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const GORUNTULEME_URL = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
const TOKEN_REFRESH_MS = 15 * 60 * 1000; // 15 dakika
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PARALLEL_BATCH_SIZE = 10; // Aynı anda sorgulanacak mükellef sayısı

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface VergiLevhasiQueryParams {
  userid: string;
  password: string;
  captchaApiKey?: string;
  ocrSpaceApiKey?: string;
}

interface MukellefInfo {
  customerId: string;
  vknTckn: string;
  tcKimlikNo: string | null;
  unvan: string;
  sirketTipi: string; // "sahis" | "firma" | "basit_usul"
}

interface VergiLevhasiOlusturResult {
  ceEVergiLevhaVergiTur: string;
  ceEVergiLevhaVknTx: string;
  ceEVergiLevhaVdTx: string;
  ceEVergiLevhaOnayKoduTx: string;
  ceEVergiLevhaAdSoyadUnvanTx: string;
  ceEVergiLevhaTcknTx: string;
  ceEVergiLevhaOnayZamanTx: string;
  message: string;
}

export interface MukellefResult {
  customerId: string;
  success: boolean;
  onayKodu?: string;
  onayZamani?: string;
  vergiTuru?: string;
  vergiDairesi?: string;
  unvan?: string;
  pdfBase64?: string;
  error?: string;
  alreadyExists?: boolean;
}

interface PipelineTokenState {
  ivdToken: string;
  bearerToken: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tek Mükellef Sorgulama
// ═══════════════════════════════════════════════════════════════════════════

async function queryOneMukellef(
  client: IntrvrgClient,
  ivdToken: string,
  m: MukellefInfo,
): Promise<MukellefResult> {
  // VKN/TCKN ayrımı:
  // Şahıs/Basit Usul → TCKN gerekiyor (tcKimlikNo veya 11 haneli vknTckn)
  // Firma → VKN gerekiyor (vknTckn)
  const isGercek = m.sirketTipi === 'sahis' || m.sirketTipi === 'basit_usul';

  console.log(`[VERGI-LEVHASI] Mükellef veri: customerId=${m.customerId}, vknTckn=${m.vknTckn}, tcKimlikNo=${m.tcKimlikNo}, sirketTipi=${m.sirketTipi}`);

  // VKN/TCKN belirleme
  let listeleJp: { mukellefVergiNo: string; mukellefTCKimlikNo: string };

  if (isGercek) {
    // Şahıs: listele'de TCKN kullanılır, olustur'da VKN kullanılır
    const tckn = m.tcKimlikNo || (m.vknTckn.length === 11 ? m.vknTckn : null);
    if (!tckn) {
      return {
        customerId: m.customerId,
        success: false,
        error: 'Şahıs mükellefin TC Kimlik No eksik. Mükellef kartını güncelleyin.',
      };
    }
    listeleJp = { mukellefVergiNo: '', mukellefTCKimlikNo: tckn };
    console.log(`[VERGI-LEVHASI] Şahıs → listele: TCKN=${tckn}, olustur: VKN=${m.vknTckn}`);
  } else {
    // Firma: VKN gönder
    listeleJp = { mukellefVergiNo: m.vknTckn, mukellefTCKimlikNo: '' };
    console.log(`[VERGI-LEVHASI] Firma → VKN=${m.vknTckn}`);
  }

  // a) Mevcut vergi levhalarını listele
  const listResult = await client.callDispatch<{
    data?: { vrglvh?: unknown[]; vrglvhListeSize?: number };
    error?: string;
    messages?: Array<{ text: string; type: string }>;
  }>('vergiLevhasiDetay_kayitlariListele', listeleJp);

  if (listResult.error === '1' || listResult.messages?.length) {
    const errorMsg = listResult.messages?.[0]?.text || 'Bilinmeyen hata';
    return { customerId: m.customerId, success: false, error: errorMsg };
  }

  // b) Vergi levhası oluştur (islemTip: 0 → güncel varsa döner, yoksa oluşturur)
  // HAR analizi: olustur her zaman VKN ile çağrılır (şahıs dahil)
  const olusturResult = await client.callDispatch<{
    data?: VergiLevhasiOlusturResult;
    error?: string;
    messages?: Array<{ text: string; type: string }>;
  }>('vergiLevhasiDetay_olustur', {
    mukellefVkn: m.vknTckn,
    islemTip: 0,
  });

  if (olusturResult.error === '1' || !olusturResult.data?.ceEVergiLevhaOnayKoduTx) {
    const errorMsg = olusturResult.messages?.[0]?.text || 'Vergi levhası oluşturulamadı';
    return { customerId: m.customerId, success: false, error: errorMsg };
  }

  const onayKodu = olusturResult.data.ceEVergiLevhaOnayKoduTx;
  const onayZamani = olusturResult.data.ceEVergiLevhaOnayZamanTx;

  // c) PDF indir
  const pdfBase64 = await downloadVergiLevhasiPdf(ivdToken, onayKodu);

  return {
    customerId: m.customerId,
    success: true,
    onayKodu,
    onayZamani,
    vergiTuru: olusturResult.data.ceEVergiLevhaVergiTur,
    vergiDairesi: olusturResult.data.ceEVergiLevhaVdTx,
    unvan: olusturResult.data.ceEVergiLevhaAdSoyadUnvanTx,
    pdfBase64,
    alreadyExists: !!olusturResult.data.message,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Sorgulama Fonksiyonu — PARALEL BATCH
// ═══════════════════════════════════════════════════════════════════════════

export async function queryVergiLevhalari(
  params: VergiLevhasiQueryParams,
  mukellefler: MukellefInfo[],
  onProgress: (status: string, current: number, total: number, customerId?: string) => void,
  onResult: (result: MukellefResult) => void,
): Promise<{ success: boolean; totalQueried: number; totalDownloaded: number; totalFailed: number }> {

  // 1. TEK LOGIN — Mali müşavir bilgileriyle
  onProgress('GİB\'e giriş yapılıyor...', 0, mukellefler.length);
  console.log('[VERGI-LEVHASI] GİB login başlatılıyor...');

  const bearerToken = await gibDijitalLogin(
    params.userid,
    params.password,
    params.captchaApiKey || '',
    params.ocrSpaceApiKey,
  );

  console.log('[VERGI-LEVHASI] Bearer token alındı, IVD token alınıyor...');
  const ivdToken = await getIvdToken(bearerToken);

  const tokenState: PipelineTokenState = {
    ivdToken,
    bearerToken,
    timestamp: Date.now(),
  };

  let client = new IntrvrgClient(ivdToken, '');
  let totalDownloaded = 0;
  let totalFailed = 0;
  let completedCount = 0;

  // 2. SESSION KURULUMU — GİB INTVRG'de API çağrıları öncesinde session başlatılmalı
  console.log('[VERGI-LEVHASI] INTVRG session kurulumu yapılıyor...');
  onProgress('INTVRG oturumu başlatılıyor...', 0, mukellefler.length);

  await client.callDispatch<unknown>('userSessionService_getUserSessionInfo', {
    token: ivdToken,
    rfDataInfo: [],
  });
  console.log('[VERGI-LEVHASI] Session kurulumu tamamlandı');

  console.log(`[VERGI-LEVHASI] ${mukellefler.length} mükellef ${PARALLEL_BATCH_SIZE}'lu batch'lerle paralel sorgulanacak`);

  // 2. PARALEL BATCH SORGULAMA
  for (let batchStart = 0; batchStart < mukellefler.length; batchStart += PARALLEL_BATCH_SIZE) {
    // Token refresh kontrolü (15 dk)
    if (Date.now() - tokenState.timestamp > TOKEN_REFRESH_MS) {
      console.log('[VERGI-LEVHASI] Token süresi doldu, yenileniyor...');
      onProgress('Token yenileniyor...', completedCount, mukellefler.length);
      const newBearer = await gibDijitalLogin(
        params.userid,
        params.password,
        params.captchaApiKey || '',
        params.ocrSpaceApiKey,
      );
      const newIvd = await getIvdToken(newBearer);
      tokenState.ivdToken = newIvd;
      tokenState.bearerToken = newBearer;
      tokenState.timestamp = Date.now();
      client = new IntrvrgClient(newIvd, '');
      await client.callDispatch<unknown>('userSessionService_getUserSessionInfo', {
        token: newIvd,
        rfDataInfo: [],
      });
      console.log('[VERGI-LEVHASI] Token yenilendi, session kuruldu');
    }

    const batch = mukellefler.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);

    onProgress(
      `${batch.length} mükellef paralel sorgulanıyor...`,
      completedCount,
      mukellefler.length,
    );

    // Batch'teki tüm mükellefleri paralel sorgula
    const batchResults = await Promise.allSettled(
      batch.map((m) => queryOneMukellef(client, tokenState.ivdToken, m))
    );

    // Sonuçları işle
    for (let i = 0; i < batchResults.length; i++) {
      const m = batch[i];
      const settled = batchResults[i];
      completedCount++;

      if (settled.status === 'fulfilled') {
        const result = settled.value;
        onResult(result);
        if (result.success) {
          totalDownloaded++;
          console.log(`[VERGI-LEVHASI] ✅ ${m.unvan} — Onay: ${result.onayKodu}`);
        } else {
          totalFailed++;
          console.warn(`[VERGI-LEVHASI] ⚠️ ${m.unvan}: ${result.error}`);
        }
      } else {
        totalFailed++;
        const errorMsg = settled.reason?.message || 'Bilinmeyen hata';
        console.error(`[VERGI-LEVHASI] ❌ ${m.unvan}: ${errorMsg}`);
        onResult({
          customerId: m.customerId,
          success: false,
          error: errorMsg,
        });
      }

      onProgress(
        `${m.unvan} tamamlandı`,
        completedCount,
        mukellefler.length,
        m.customerId,
      );
    }
  }

  console.log(`[VERGI-LEVHASI] Tamamlandı: ${totalDownloaded} başarılı, ${totalFailed} başarısız`);

  return {
    success: true,
    totalQueried: mukellefler.length,
    totalDownloaded,
    totalFailed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF İndirme
// ═══════════════════════════════════════════════════════════════════════════

async function downloadVergiLevhasiPdf(ivdToken: string, onayKodu: string): Promise<string> {
  const url = new URL(GORUNTULEME_URL);
  url.searchParams.set('cmd', 'IMAJ');
  url.searchParams.set('subcmd', 'IVD_VRG_LVH_GORUNTULE');
  url.searchParams.set('onayKodu', onayKodu);
  url.searchParams.set('vrgLvhBoyut', 'buyuk');
  url.searchParams.set('vrgLvhRenk', 'gri');
  url.searchParams.set('goruntuTip', '2');
  url.searchParams.set('token', ivdToken);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/pdf, */*',
      'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp?token=${ivdToken}&appName=tdvd`,
    },
  });

  if (!response.ok) {
    throw new Error(`PDF indirilemedi: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}
