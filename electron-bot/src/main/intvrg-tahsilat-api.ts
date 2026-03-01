/**
 * INTVRG Tahsilat API Modülü
 * ==========================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden vergi tahsil alındıları sorgulama.
 *
 * Akış: GİB Dijital VD Login → IVD Token → INTVRG Dispatch → Tahsilat Sorgusu
 *
 * Referans: earsiv-dijital-api.ts pattern'i
 */

import { gibDijitalLogin } from './earsiv-dijital-api';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';
export const INTVRG_BASE = 'https://intvrg.gib.gov.tr';
const INTVRG_DISPATCH = `${INTVRG_BASE}/intvrg_server/dispatch`;
const IVD_LOGIN_URL = `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/intvrg-login`;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_BETWEEN_DETAIL_REQUESTS = 0; // Batch'ler arası bekleme yok
const MAX_DETAIL_BATCH_SIZE = 20; // Paralel detay sorgu limiti
const MAX_RETRY_COUNT = 2; // Hata durumunda yeniden deneme sayısı
const RETRY_DELAY = 500; // Retry arası bekleme (ms)

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Bağlı vergi dairesi */
interface BagliVD {
  vdKodu: string;
  vdTuru: number;
  isyeriTuru: number;
  faalKodu: number;
}

/** Vergi mükellefiyet türü */
interface VergiMukellefiyet {
  vergiAdi: string;
  vergiKodu: string;
}

/** Tahsilat ana satır (fişler) */
export interface TahsilatFis {
  odemetarihi: string;
  vergidonem: string;
  tahsilatoid: string;
  thsfisno: string;
  thkfisno: string;
  vergikodu: string;
  detaylar?: TahsilatDetay[];
  toplam?: TahsilatToplam;
}

/** Tahsilat detay satırı */
export interface TahsilatDetay {
  taksitno: string;
  thsodenen: string;
  detayvergikodu: string;
  thsgzammi: string;
  thskesinlesengz: string;
}

/** Tahsilat toplam satırı */
export interface TahsilatToplam {
  toplamgzammi: string;
  toplamodenen: string;
  toplamkesinlesengz: string;
}

/** Tahsilat sorgu sonucu */
export interface TahsilatQueryResult {
  success: boolean;
  vergituru: string;
  vkntckn: string;
  sorgudonemi: string;
  vergidairesi: string;
  adsoyadunvan: string;
  toplamtahsilatsayisi: string;
  tahsilatlar: TahsilatFis[];
  error?: string;
}

/** Sorgulama parametreleri */
interface TahsilatQueryParams {
  userid: string;
  password: string;
  vkn: string;
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
  captchaApiKey: string;
  ocrSpaceApiKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// IVD Token Alma
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB Dijital VD Bearer token ile INTVRG IVD token'ı al.
 * intvrg-login endpoint'i redirectUrl döndürür, bu URL'den token parse edilir.
 */
export async function getIvdToken(bearerToken: string): Promise<string> {
  console.log('[INTVRG] IVD token alınıyor...');

  const response = await fetch(IVD_LOGIN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': USER_AGENT,
      'Origin': DIJITAL_GIB_BASE,
      'Referer': `${DIJITAL_GIB_BASE}/`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('IVD_TOKEN_FAILED: Bearer token geçersiz veya süresi dolmuş');
    }
    throw new Error(`IVD_TOKEN_FAILED: HTTP ${response.status}`);
  }

  const data = await response.json();
  const redirectUrl = data.redirectUrl;

  if (!redirectUrl) {
    throw new Error('IVD_TOKEN_FAILED: redirectUrl alınamadı');
  }

  // URL'den token parametresini parse et
  const url = new URL(redirectUrl);
  const ivdToken = url.searchParams.get('token');

  if (!ivdToken) {
    throw new Error('IVD_TOKEN_FAILED: Token parametresi bulunamadı');
  }

  console.log(`[INTVRG] IVD token alındı: ${ivdToken.substring(0, 20)}...`);
  return ivdToken;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTVRG Client
// ═══════════════════════════════════════════════════════════════════════════

export class IntrvrgClient {
  private token: string;
  private vkn: string;
  private sessionId: string;
  private callCounter: number;

  constructor(ivdToken: string, vkn: string) {
    this.token = ivdToken;
    this.vkn = vkn;
    this.sessionId = `intvrg_${Date.now()}`;
    this.callCounter = 1;
  }

  /**
   * INTVRG dispatch endpoint'ine POST isteği gönder
   */
  async callDispatch<T>(cmd: string, jp: Record<string, unknown>): Promise<T> {
    const body = new URLSearchParams({
      cmd,
      callid: `${this.sessionId}-${this.callCounter++}`,
      token: this.token,
      jp: JSON.stringify(jp),
    });

    const response = await fetch(INTVRG_DISPATCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': USER_AGENT,
        'Origin': INTVRG_BASE,
        'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp?token=${this.token}&appName=tdvd`,
      },
      body,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('IVD_SESSION_EXPIRED: INTVRG oturumu sona erdi');
      }
      throw new Error(`INTVRG_ERROR: HTTP ${response.status} (cmd: ${cmd})`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Bağlı vergi daireleri listesini al
   */
  async loadBagliVD(): Promise<BagliVD[]> {
    console.log('[INTVRG] Bağlı vergi daireleri alınıyor...');
    const result = await this.callDispatch<{ data: BagliVD[] }>(
      'sicilIslemleri_loadBagliVD',
      { vergiNo: this.vkn },
    );
    return result.data || [];
  }

  /**
   * Vergi mükellefiyet türleri listesini al
   */
  async loadVergiMukellefiyetleri(): Promise<VergiMukellefiyet[]> {
    console.log('[INTVRG] Vergi mükellefiyet türleri alınıyor...');
    const result = await this.callDispatch<{ data: VergiMukellefiyet[] }>(
      'sicilIslemleri_loadVergiMukellefiyetleri',
      { vergiNo: this.vkn },
    );
    return result.data || [];
  }

  /**
   * Tahsilat ana sorgusunu çalıştır
   */
  async thsSorgula(vdKodu: string, vergiKodu: string, basAy: string, basYil: string, bitAy: string, bitYil: string): Promise<{
    vergituru: string;
    vkntckn: string;
    sorgudonemi: string;
    vergidairesi: string;
    toplamtahsilatsayisi: string;
    adsoyadunvan: string;
    tahsilatlar: Array<Record<string, string>>;
  }> {
    console.log(`[INTVRG] Tahsilat sorgusu: VD=${vdKodu}, ${basAy}/${basYil} - ${bitAy}/${bitYil}`);
    const result = await this.callDispatch<{ data: {
      vergituru: string;
      vkntckn: string;
      sorgudonemi: string;
      vergidairesi: string;
      toplamtahsilatsayisi: string;
      adsoyadunvan: string;
      tahsilatlar: Array<Record<string, string>>;
    }}>(
      'tahsilatIslemleri_thsSorgula',
      { vkn: this.vkn, vd: vdKodu, vergiKodu, basAy, basYil, bitAy, bitYil },
    );
    return result.data;
  }

  /**
   * Tahsilat detay sorgusunu çalıştır
   */
  async thsSatirSorgula(vdKodu: string, tahsilatOid: string): Promise<{
    detaylar: TahsilatDetay[];
    toplam: TahsilatToplam | null;
  }> {
    const result = await this.callDispatch<{ data: { ths: Array<Record<string, string>> } }>(
      'tahsilatIslemleri_thsSatirSorgula',
      { vdKodu, tahsilatOid: tahsilatOid, vkn: this.vkn },
    );

    const rows = result.data?.ths || [];
    const detaylar: TahsilatDetay[] = [];
    let toplam: TahsilatToplam | null = null;

    for (const row of rows) {
      if ('toplamodenen' in row) {
        // Toplam satırı
        toplam = {
          toplamgzammi: row.toplamgzammi || '0.00',
          toplamodenen: row.toplamodenen || '0.00',
          toplamkesinlesengz: row.toplamkesinlesengz || '0.00',
        };
      } else if ('taksitno' in row) {
        // Detay satırı
        detaylar.push({
          taksitno: row.taksitno || '',
          thsodenen: row.thsodenen || '0.00',
          detayvergikodu: row.detayvergikodu || '',
          thsgzammi: row.thsgzammi || '0.00',
          thskesinlesengz: row.thskesinlesengz || '0.00',
        });
      }
    }

    return { detaylar, toplam };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Orchestration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tahsilat sorgulaması ana fonksiyonu.
 *
 * 1. GİB Dijital VD'ye login
 * 2. IVD token al
 * 3. Bağlı vergi dairelerini al → FAAL olanı seç
 * 4. Tahsilat sorgusunu çalıştır
 * 5. Her tahsilat için detay sorgusunu çalıştır
 */
export async function queryTahsilatlar(
  params: TahsilatQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (tahsilatlar: TahsilatFis[], meta: {
    vergituru: string;
    vkntckn: string;
    sorgudonemi: string;
    vergidairesi: string;
    adsoyadunvan: string;
    toplamtahsilatsayisi: string;
  }) => void,
): Promise<TahsilatQueryResult> {
  try {
    // 1. GİB Dijital VD Login
    onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      params.userid,
      params.password,
      params.captchaApiKey,
      params.ocrSpaceApiKey,
      onProgress,
    );

    // 2. IVD Token al
    onProgress?.('İnternet Vergi Dairesi oturumu açılıyor...');
    const ivdToken = await getIvdToken(bearerToken);

    // 3. INTVRG Client oluştur
    const client = new IntrvrgClient(ivdToken, params.vkn);

    // 4. Bağlı vergi daireleri — FAAL olanı bul
    onProgress?.('Vergi dairesi bilgileri alınıyor...');
    const bagliVDler = await client.loadBagliVD();

    if (bagliVDler.length === 0) {
      throw new Error('NO_VD: Mükellefin bağlı vergi dairesi bulunamadı');
    }

    // FAAL (faalKodu: 1) olanı seç, yoksa ilkini al
    const faalVD = bagliVDler.find(vd => vd.faalKodu === 1) || bagliVDler[0];
    console.log(`[INTVRG] Seçilen VD: ${faalVD.vdKodu} (faalKodu: ${faalVD.faalKodu})`);

    // 5. Tahsilat ana sorgusunu çalıştır
    onProgress?.('Tahsilat bilgileri sorgulanıyor...');
    const queryResult = await client.thsSorgula(
      faalVD.vdKodu,
      'hepsi', // Tüm vergi türleri
      params.basAy,
      params.basYil,
      params.bitAy,
      params.bitYil,
    );

    // Response'taki tahsilatları filtrele — separator öğeleri kaldır
    const rawTahsilatlar = queryResult.tahsilatlar || [];
    const gercekTahsilatlar = rawTahsilatlar.filter(
      (item) => 'tahsilatoid' in item && item.tahsilatoid
    );

    console.log(`[INTVRG] ${gercekTahsilatlar.length} tahsilat bulundu (${rawTahsilatlar.length} ham kayıt)`);

    if (gercekTahsilatlar.length === 0) {
      const result: TahsilatQueryResult = {
        success: true,
        vergituru: queryResult.vergituru || '',
        vkntckn: queryResult.vkntckn || '',
        sorgudonemi: queryResult.sorgudonemi || '',
        vergidairesi: queryResult.vergidairesi || '',
        adsoyadunvan: queryResult.adsoyadunvan || '',
        toplamtahsilatsayisi: '0',
        tahsilatlar: [],
      };
      onResults?.([], {
        vergituru: result.vergituru,
        vkntckn: result.vkntckn,
        sorgudonemi: result.sorgudonemi,
        vergidairesi: result.vergidairesi,
        adsoyadunvan: result.adsoyadunvan,
        toplamtahsilatsayisi: result.toplamtahsilatsayisi,
      });
      return result;
    }

    // 6. Detay sorgularını çalıştır (batch halinde)
    onProgress?.(`${gercekTahsilatlar.length} tahsilat için detay bilgileri alınıyor...`);

    const tahsilatlar: TahsilatFis[] = [];

    for (let i = 0; i < gercekTahsilatlar.length; i += MAX_DETAIL_BATCH_SIZE) {
      const batch = gercekTahsilatlar.slice(i, i + MAX_DETAIL_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          // Retry mekanizmalı detay sorgusu
          for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
            try {
              const detay = await client.thsSatirSorgula(faalVD.vdKodu, item.tahsilatoid);
              return {
                odemetarihi: item.odemetarihi || '',
                vergidonem: item.vergidonem || '',
                tahsilatoid: item.tahsilatoid,
                thsfisno: item.thsfisno || '',
                thkfisno: item.thkfisno || '',
                vergikodu: item.vergikodu || '',
                detaylar: detay.detaylar,
                toplam: detay.toplam || undefined,
              } as TahsilatFis;
            } catch (e) {
              if (attempt < MAX_RETRY_COUNT) {
                console.log(`[INTVRG] Detay sorgu retry ${attempt + 1}/${MAX_RETRY_COUNT} (OID: ${item.tahsilatoid})`);
                await sleep(RETRY_DELAY * (attempt + 1));
                continue;
              }
              console.log(`[INTVRG] Detay sorgu başarısız (OID: ${item.tahsilatoid}): ${(e as Error).message}`);
              // Tüm retry'lar başarısız — ana bilgileri döndür
              return {
                odemetarihi: item.odemetarihi || '',
                vergidonem: item.vergidonem || '',
                tahsilatoid: item.tahsilatoid,
                thsfisno: item.thsfisno || '',
                thkfisno: item.thkfisno || '',
                vergikodu: item.vergikodu || '',
              } as TahsilatFis;
            }
          }
          // TypeScript için unreachable ama gerekli
          return {
            odemetarihi: item.odemetarihi || '',
            vergidonem: item.vergidonem || '',
            tahsilatoid: item.tahsilatoid,
            thsfisno: item.thsfisno || '',
            thkfisno: item.thkfisno || '',
            vergikodu: item.vergikodu || '',
          } as TahsilatFis;
        })
      );

      tahsilatlar.push(...batchResults);

      const completed = Math.min(i + MAX_DETAIL_BATCH_SIZE, gercekTahsilatlar.length);
      onProgress?.(`Detay bilgileri alınıyor (${completed}/${gercekTahsilatlar.length})...`);

      // Batch'ler arası bekleme (rate limiting)
      if (DELAY_BETWEEN_DETAIL_REQUESTS > 0 && i + MAX_DETAIL_BATCH_SIZE < gercekTahsilatlar.length) {
        await sleep(DELAY_BETWEEN_DETAIL_REQUESTS);
      }
    }

    const result: TahsilatQueryResult = {
      success: true,
      vergituru: queryResult.vergituru || '',
      vkntckn: queryResult.vkntckn || '',
      sorgudonemi: queryResult.sorgudonemi || '',
      vergidairesi: queryResult.vergidairesi || '',
      adsoyadunvan: queryResult.adsoyadunvan || '',
      toplamtahsilatsayisi: queryResult.toplamtahsilatsayisi || String(tahsilatlar.length),
      tahsilatlar,
    };

    onResults?.(tahsilatlar, {
      vergituru: result.vergituru,
      vkntckn: result.vkntckn,
      sorgudonemi: result.sorgudonemi,
      vergidairesi: result.vergidairesi,
      adsoyadunvan: result.adsoyadunvan,
      toplamtahsilatsayisi: result.toplamtahsilatsayisi,
    });

    console.log(`[INTVRG] Tahsilat sorgulaması tamamlandı: ${tahsilatlar.length} tahsilat`);
    return result;

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[INTVRG] Tahsilat sorgulama hatası: ${error.message}`);
    return {
      success: false,
      vergituru: '',
      vkntckn: params.vkn,
      sorgudonemi: `${params.basAy}/${params.basYil} - ${params.bitAy}/${params.bitYil}`,
      vergidairesi: '',
      adsoyadunvan: '',
      toplamtahsilatsayisi: '0',
      tahsilatlar: [],
      error: error.message,
    };
  }
}
