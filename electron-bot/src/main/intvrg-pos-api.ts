/**
 * INTVRG POS Sorgulama API Modülü
 * ================================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden POS (kredi kartı) satış bilgileri sorgulama.
 *
 * Akış: GİB Dijital VD Login → IVD Token → INTVRG Dispatch → POS Sorgusu
 *
 * Referans: intvrg-tahsilat-api.ts pattern'i
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient } from './intvrg-tahsilat-api';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** POS bilgisi satırı */
export interface PosBilgisi {
  pos_banka_adi: string;
  pos_banka_vkn: string;
  pos_uye_isy: string;
  toplam: string;
}

/** POS sorgu sonucu */
export interface PosQueryResult {
  success: boolean;
  vkntckn: string;
  ay: string;
  yil: string;
  toplamGenel: string;
  posListeSize: number;
  posBilgileri: PosBilgisi[];
  error?: string;
}

/** Sorgulama parametreleri */
interface PosQueryParams {
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
 * POS bilgileri sorgulaması ana fonksiyonu.
 *
 * 1. GİB Dijital VD'ye login
 * 2. IVD token al
 * 3. POS sorgusunu çalıştır (tek istek — bağlı VD gerekmez)
 */
export async function queryPosBilgileri(
  params: PosQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (posBilgileri: PosBilgisi[], meta: {
    toplamGenel: string;
    posListeSize: number;
    ay: string;
    yil: string;
  }) => void,
): Promise<PosQueryResult> {
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

    // 4. POS sorgusunu çalıştır
    onProgress?.('POS bilgileri sorgulanıyor...');
    const result = await client.callDispatch<{
      data: {
        toplam_genel: string;
        posListeSize: string;
        pageNo: string;
        ay: string;
        yil: string;
        posBilgileriTable: Array<{
          toplam: string;
          pos_banka_adi: string;
          pos_uye_isy: string;
          pos_banka_vkn: string;
        }>;
      };
    }>('posBilgileriIslemleri_posSonuc', {
      ay1: params.ay,
      yil1: params.yil,
      vkn: params.vkn,
      sayfa: 1,
    });

    const data = result.data;
    const posBilgileri: PosBilgisi[] = (data?.posBilgileriTable || []).map((item) => ({
      pos_banka_adi: item.pos_banka_adi || '',
      pos_banka_vkn: item.pos_banka_vkn || '',
      pos_uye_isy: item.pos_uye_isy || '',
      toplam: item.toplam || '0',
    }));

    const toplamGenel = data?.toplam_genel || '0';
    const posListeSize = parseInt(data?.posListeSize || '0', 10);

    console.log(`[INTVRG-POS] ${posBilgileri.length} POS kaydı bulundu, toplam: ${toplamGenel}`);

    const queryResult: PosQueryResult = {
      success: true,
      vkntckn: params.vkn,
      ay: params.ay,
      yil: params.yil,
      toplamGenel,
      posListeSize,
      posBilgileri,
    };

    onResults?.(posBilgileri, {
      toplamGenel,
      posListeSize,
      ay: params.ay,
      yil: params.yil,
    });

    return queryResult;

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[INTVRG-POS] POS sorgulama hatası: ${error.message}`);
    return {
      success: false,
      vkntckn: params.vkn,
      ay: params.ay,
      yil: params.yil,
      toplamGenel: '0',
      posListeSize: 0,
      posBilgileri: [],
      error: error.message,
    };
  }
}
