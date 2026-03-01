/**
 * INTVRG ÖKC Bildirim Sorgulama API Modülü
 * ==========================================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden Yeni Nesil ÖKC
 * aylık satış rapor bildirimlerini sorgulama.
 *
 * Akış: GİB Dijital VD Login → IVD Token → INTVRG Dispatch → ÖKC Sorgusu
 *
 * Referans: intvrg-pos-api.ts pattern'i
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient } from './intvrg-tahsilat-api';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** ÖKC Detay bilgisi — API response field mapping */
export interface OkcDetayBilgi {
  aylikSatisRaporNo: string;
  // KDV'ye göre satışlar
  satisKdv0: string;
  satisKdv20: string;
  kdvToplam: string;
  // Belge türleri (tutar)
  okcfistutartutar: string;
  faturatutartutar: string;
  smmtutartutar: string;
  muhtasiltutartutar: string;
  gybilettutartutar: string;
  gpusulatutartutar: string;
  // Ödeme türleri (tutar)
  nakitodemetutar: string;
  bkkartodemetutar: string;
  yemekkcodemetutar: string;
  digerodemetutar: string;
  // Bilgi fişleri (tutar + adet)
  faturabfistutar: string;
  faturabfisadet: string;
  yemekkcbfistutar: string;
  yemekkcbfisadet: string;
  avansbfistutar: string;
  avansbfisadet: string;
  faturatahsilatbfistutar: string;
  faturatahsilatbfisadet: string;
  otoparkbfistutar: string;
  otoparkbfisadet: string;
  carihesapbfistutar: string;
  carihesapbfisadet: string;
  digerbfistutar: string;
  digerbfisadet: string;
}

/** ÖKC Bildirim satırı (liste + detay birlikte) */
export interface OkcBildirim {
  firmaKodu: string;
  firmaAdi: string;
  marka: string;
  model: string;
  sicilNo: string;
  bildirimTarih: string;
  bildirimYontem: string;
  detayBilgi: OkcDetayBilgi;
}

/** Sorgu sonucu */
export interface OkcQueryResult {
  success: boolean;
  vkntckn: string;
  ay: string;
  yil: string;
  toplamKayit: number;
  bildirimler: OkcBildirim[];
  error?: string;
}

/** Sorgulama parametreleri */
interface OkcQueryParams {
  userid: string;
  password: string;
  vkn: string;
  ay: string;
  yil: string;
  captchaApiKey: string;
  ocrSpaceApiKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Orchestration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ÖKC bildirim sorgulaması ana fonksiyonu.
 *
 * 1. GİB Dijital VD'ye login
 * 2. IVD token al
 * 3. ÖKC sorgusunu çalıştır (detay bilgi liste ile birlikte gelir)
 */
export async function queryOkcBildirimler(
  params: OkcQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (bildirimler: OkcBildirim[], meta: {
    toplamKayit: number;
    ay: string;
    yil: string;
  }) => void,
): Promise<OkcQueryResult> {
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

    // 4. ÖKC sorgusunu çalıştır
    onProgress?.('ÖKC bildirim bilgileri sorgulanıyor...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.callDispatch<{ data: { donemOKCBildirimleri: any[] } }>(
      'OKCIslemleriService_goruntule',
      {
        vkn: params.vkn,
        donemAy: params.ay,
        donemYil: params.yil,
        goruntuleTip: '1',
        okcTip: '2',
      },
    );

    const rawList = result.data?.donemOKCBildirimleri || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bildirimler: OkcBildirim[] = rawList.map((item: any) => {
      const detay = item.detayBilgi || {};
      return {
        firmaKodu: item.firmaKodu || '',
        firmaAdi: item.firmaAdi || '',
        marka: item.marka || '',
        model: item.model || '',
        sicilNo: item.sicilNo || '',
        bildirimTarih: item.bildirimTarih || '',
        bildirimYontem: item.bildirimYontem || '',
        detayBilgi: {
          aylikSatisRaporNo: detay.aylikSatisRaporNo || '',
          satisKdv0: detay.satisKdv0 || '0',
          satisKdv20: detay.satisKdv20 || '0',
          kdvToplam: detay.kdvToplam || '0',
          okcfistutartutar: detay.okcfistutartutar || '0',
          faturatutartutar: detay.faturatutartutar || '0',
          smmtutartutar: detay.smmtutartutar || '0',
          muhtasiltutartutar: detay.muhtasiltutartutar || '0',
          gybilettutartutar: detay.gybilettutartutar || '0',
          gpusulatutartutar: detay.gpusulatutartutar || '0',
          nakitodemetutar: detay.nakitodemetutar || '0',
          bkkartodemetutar: detay.bkkartodemetutar || '0',
          yemekkcodemetutar: detay.yemekkcodemetutar || '0',
          digerodemetutar: detay.digerodemetutar || '0',
          faturabfistutar: detay.faturabfistutar || '0',
          faturabfisadet: detay.faturabfisadet || '0',
          yemekkcbfistutar: detay.yemekkcbfistutar || '0',
          yemekkcbfisadet: detay.yemekkcbfisadet || '0',
          avansbfistutar: detay.avansbfistutar || '0',
          avansbfisadet: detay.avansbfisadet || '0',
          faturatahsilatbfistutar: detay.faturatahsilatbfistutar || '0',
          faturatahsilatbfisadet: detay.faturatahsilatbfisadet || '0',
          otoparkbfistutar: detay.otoparkbfistutar || '0',
          otoparkbfisadet: detay.otoparkbfisadet || '0',
          carihesapbfistutar: detay.carihesapbfistutar || '0',
          carihesapbfisadet: detay.carihesapbfisadet || '0',
          digerbfistutar: detay.digerbfistutar || '0',
          digerbfisadet: detay.digerbfisadet || '0',
        },
      };
    });

    const toplamKayit = bildirimler.length;

    console.log(`[INTVRG-OKC] ${toplamKayit} ÖKC bildirim kaydı bulundu`);

    const queryResult: OkcQueryResult = {
      success: true,
      vkntckn: params.vkn,
      ay: params.ay,
      yil: params.yil,
      toplamKayit,
      bildirimler,
    };

    onResults?.(bildirimler, {
      toplamKayit,
      ay: params.ay,
      yil: params.yil,
    });

    return queryResult;

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[INTVRG-OKC] ÖKC sorgulama hatası: ${error.message}`);
    return {
      success: false,
      vkntckn: params.vkn,
      ay: params.ay,
      yil: params.yil,
      toplamKayit: 0,
      bildirimler: [],
      error: error.message,
    };
  }
}
