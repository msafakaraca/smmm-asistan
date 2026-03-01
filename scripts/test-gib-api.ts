/**
 * GİB API Test Script
 *
 * Kullanım:
 *   npx tsx scripts/test-gib-api.ts
 *
 * Veya adım adım:
 *   npx tsx scripts/test-gib-api.ts --step=1  (Ayarları kontrol et)
 *   npx tsx scripts/test-gib-api.ts --step=2  (2Captcha test)
 *   npx tsx scripts/test-gib-api.ts --step=3  (GİB Login test)
 *   npx tsx scripts/test-gib-api.ts --step=4  (Beyanname ara)
 */

import { PrismaClient } from '@prisma/client';
import {
  createGibApi,
  check2CaptchaBalance,
  GIB_ENDPOINTS,
  BEYANNAME_TURLERI
} from '../src/lib/gib-api';
import { decrypt } from '../src/lib/crypto';

const prisma = new PrismaClient();

// Renkli console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  step: (msg: string) => console.log(`${colors.cyan}▶️  ${msg}${colors.reset}`),
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Ayarları Kontrol Et
// ═══════════════════════════════════════════════════════════════════════════
async function step1_checkSettings(): Promise<{
  tenantId: string;
  gibKodu: string;
  gibSifre: string;
  captchaKey: string;
} | null> {
  console.log('\n' + '═'.repeat(60));
  log.step('ADIM 1: Tenant Ayarlarını Kontrol Et');
  console.log('═'.repeat(60) + '\n');

  const tenants = await prisma.tenants.findMany({
    select: {
      id: true,
      name: true,
      gibSettings: true,
      captchaKey: true,
    },
  });

  if (tenants.length === 0) {
    log.error('Hiç tenant bulunamadı!');
    return null;
  }

  console.log(`Toplam ${tenants.length} tenant bulundu:\n`);

  let validTenant = null;

  for (const tenant of tenants) {
    const settings = (tenant.gibSettings as Record<string, string>) || {};
    const hasGibCode = !!settings.gibCode;
    const hasGibPassword = !!settings.gibPassword;
    const hasCaptcha = !!(settings.captchaKey || tenant.captchaKey || process.env.CAPTCHA_API_KEY);

    console.log(`📁 ${tenant.name}`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   GİB Kodu: ${hasGibCode ? colors.green + settings.gibCode + colors.reset : colors.red + '(tanımlı değil)' + colors.reset}`);
    console.log(`   GİB Şifre: ${hasGibPassword ? colors.green + 'VAR' + colors.reset : colors.red + '(tanımlı değil)' + colors.reset}`);
    console.log(`   Captcha Key: ${hasCaptcha ? colors.green + 'VAR' + colors.reset : colors.red + '(tanımlı değil)' + colors.reset}`);
    console.log('');

    if (hasGibCode && hasGibPassword && hasCaptcha && !validTenant) {
      let decryptedPassword = settings.gibPassword;
      if (decryptedPassword.startsWith('{')) {
        try {
          decryptedPassword = decrypt(decryptedPassword);
        } catch (e) {
          log.warn('Şifre decrypt edilemedi');
        }
      }

      validTenant = {
        tenantId: tenant.id,
        gibKodu: settings.gibCode,
        gibSifre: decryptedPassword,
        captchaKey: settings.captchaKey || tenant.captchaKey || process.env.CAPTCHA_API_KEY || '',
      };
    }
  }

  if (validTenant) {
    log.success('Test için uygun tenant bulundu!');
    return validTenant;
  } else {
    log.error('Hiçbir tenant\'ta GİB ayarları tam değil!');
    console.log('\n📝 GİB ayarlarını yapmak için:');
    console.log('   1. Dashboard > Ayarlar > GİB Ayarları sayfasına gidin');
    console.log('   2. GİB Kodu, Şifre ve 2Captcha API Key girin');
    console.log('   3. Veya .env dosyasına CAPTCHA_API_KEY ekleyin\n');
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: 2Captcha Test
// ═══════════════════════════════════════════════════════════════════════════
async function step2_testCaptcha(apiKey: string): Promise<boolean> {
  console.log('\n' + '═'.repeat(60));
  log.step('ADIM 2: 2Captcha Bağlantı Testi');
  console.log('═'.repeat(60) + '\n');

  log.info('2Captcha bakiyesi kontrol ediliyor...');

  const balance = await check2CaptchaBalance(apiKey);

  if (balance !== null) {
    log.success(`2Captcha bağlantısı başarılı!`);
    console.log(`   💰 Bakiye: $${balance.toFixed(2)}`);

    if (balance < 0.5) {
      log.warn('Bakiye düşük! Captcha çözümü için yeterli olmayabilir.');
    }

    return true;
  } else {
    log.error('2Captcha bağlantısı başarısız!');
    console.log('   API key\'i kontrol edin.');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: GİB Login Test
// ═══════════════════════════════════════════════════════════════════════════
async function step3_testLogin(settings: {
  gibKodu: string;
  gibSifre: string;
  captchaKey: string;
}): Promise<ReturnType<typeof createGibApi> | null> {
  console.log('\n' + '═'.repeat(60));
  log.step('ADIM 3: GİB Portal Giriş Testi');
  console.log('═'.repeat(60) + '\n');

  log.info(`GİB\'e giriş yapılıyor...`);
  console.log(`   Kullanıcı: ${settings.gibKodu}`);
  console.log(`   Portal: ${GIB_ENDPOINTS.PORTAL.LOGIN_PAGE}`);
  console.log('');

  const gibApi = createGibApi(settings.captchaKey);

  console.log('   [1/3] Captcha alınıyor...');
  console.log('   [2/3] Captcha çözülüyor (bu 30-60 saniye sürebilir)...');

  const startTime = Date.now();

  const loginResult = await gibApi.login({
    gibKodu: settings.gibKodu,
    gibSifre: settings.gibSifre,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (loginResult.success) {
    log.success(`GİB girişi başarılı! (${duration}s)`);
    console.log(`   Session ID: ${loginResult.session?.sessionId}`);
    console.log(`   Geçerlilik: ${loginResult.session?.expiresAt}`);
    return gibApi;
  } else {
    log.error(`GİB girişi başarısız! (${duration}s)`);
    console.log(`   Hata: ${loginResult.error}`);
    console.log(`   Kod: ${loginResult.errorCode}`);

    if (loginResult.errorCode === 'AUTH_FAILED') {
      console.log('\n   💡 GİB kullanıcı kodu veya şifre yanlış olabilir.');
      console.log('   Dashboard > Ayarlar > GİB Ayarları\'nı kontrol edin.');
    } else if (loginResult.errorCode === 'CAPTCHA_FAILED') {
      console.log('\n   💡 Captcha çözülemedi. 2Captcha bakiyenizi kontrol edin.');
    }

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Beyanname Arama Test
// ═══════════════════════════════════════════════════════════════════════════
async function step4_testSearch(gibApi: ReturnType<typeof createGibApi>): Promise<boolean> {
  console.log('\n' + '═'.repeat(60));
  log.step('ADIM 4: Beyanname Arama Testi');
  console.log('═'.repeat(60) + '\n');

  // Son 3 ayı ara
  const now = new Date();
  const endDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

  const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
  const startDate = `01.${(threeMonthsAgo.getMonth() + 1).toString().padStart(2, '0')}.${threeMonthsAgo.getFullYear()}`;

  log.info(`Beyannameler aranıyor...`);
  console.log(`   Tarih Aralığı: ${startDate} - ${endDate}`);
  console.log(`   Filtre: Sadece Onaylı\n`);

  const searchResult = await gibApi.searchBeyannameler({
    baslangicTarihi: startDate,
    bitisTarihi: endDate,
    sadeceonayli: true,
  });

  if (searchResult.success) {
    log.success(`Arama başarılı!`);
    console.log(`   Bulunan: ${searchResult.totalCount} beyanname\n`);

    if (searchResult.beyannameler.length > 0) {
      console.log('   İlk 5 beyanname:');
      console.log('   ' + '-'.repeat(50));

      searchResult.beyannameler.slice(0, 5).forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.beyannameTuruAd}`);
        console.log(`      VKN: ${b.tcVkn} | ${b.adSoyadUnvan}`);
        console.log(`      Dönem: ${b.vergilendirmeDonemi}`);
        console.log(`      OID: ${b.oid}`);
        console.log('');
      });

      // Beyanname türlerine göre dağılım
      const byType: Record<string, number> = {};
      searchResult.beyannameler.forEach(b => {
        byType[b.beyannameTuru] = (byType[b.beyannameTuru] || 0) + 1;
      });

      console.log('   Beyanname Türlerine Göre Dağılım:');
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`      ${type}: ${count}`);
      });
    }

    return true;
  } else {
    log.error('Arama başarısız!');
    console.log(`   Hata: ${searchResult.error}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: PDF İndirme Test (opsiyonel)
// ═══════════════════════════════════════════════════════════════════════════
async function step5_testDownload(gibApi: ReturnType<typeof createGibApi>, oid: string): Promise<boolean> {
  console.log('\n' + '═'.repeat(60));
  log.step('ADIM 5: PDF İndirme Testi');
  console.log('═'.repeat(60) + '\n');

  log.info(`PDF indiriliyor...`);
  console.log(`   OID: ${oid}\n`);

  const result = await gibApi.downloadPdf(oid, 'beyanname');

  if (result.success && result.base64) {
    log.success('PDF başarıyla indirildi!');
    console.log(`   Boyut: ${(result.fileSize! / 1024).toFixed(1)} KB`);
    console.log(`   Base64 uzunluk: ${result.base64.length} karakter`);
    return true;
  } else {
    log.error('PDF indirilemedi!');
    console.log(`   Hata: ${result.error}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + '          GİB API TEST SCRIPT                            '.substring(0, 58) + '║');
  console.log('║' + '          SMMM Asistan - Beyanname İndirme Sistemi       '.substring(0, 58) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const args = process.argv.slice(2);
  const stepArg = args.find(a => a.startsWith('--step='));
  const step = stepArg ? parseInt(stepArg.split('=')[1]) : 0;

  try {
    // STEP 1: Ayarları kontrol et
    if (step === 0 || step === 1) {
      const settings = await step1_checkSettings();

      if (!settings) {
        console.log('\n⛔ Test durduruluyor: GİB ayarları eksik.\n');
        return;
      }

      if (step === 1) {
        console.log('\n✅ Adım 1 tamamlandı.\n');
        return;
      }

      // STEP 2: 2Captcha test
      if (step === 0 || step === 2) {
        const captchaOk = await step2_testCaptcha(settings.captchaKey);

        if (!captchaOk) {
          console.log('\n⛔ Test durduruluyor: 2Captcha bağlantısı başarısız.\n');
          return;
        }

        if (step === 2) {
          console.log('\n✅ Adım 2 tamamlandı.\n');
          return;
        }
      }

      // STEP 3: GİB Login
      if (step === 0 || step === 3) {
        console.log('\n⚠️  UYARI: GİB girişi gerçek bir oturum açacaktır.');
        console.log('   Devam etmek için 5 saniye bekleniyor...\n');
        await new Promise(r => setTimeout(r, 5000));

        const gibApi = await step3_testLogin(settings);

        if (!gibApi) {
          console.log('\n⛔ Test durduruluyor: GİB girişi başarısız.\n');
          return;
        }

        if (step === 3) {
          await gibApi.logout();
          console.log('\n✅ Adım 3 tamamlandı. Oturum kapatıldı.\n');
          return;
        }

        // STEP 4: Beyanname Arama
        if (step === 0 || step === 4) {
          const searchOk = await step4_testSearch(gibApi);

          // Çıkış yap
          await gibApi.logout();
          log.info('GİB oturumu kapatıldı.');

          if (searchOk) {
            console.log('\n' + '═'.repeat(60));
            log.success('TÜM TESTLER BAŞARILI!');
            console.log('═'.repeat(60));
            console.log('\n📝 Sonraki Adımlar:');
            console.log('   1. Frontend\'den /api/gib-api/* endpoint\'lerini kullanabilirsiniz');
            console.log('   2. Toplu indirme için /api/gib-api/bulk-download endpoint\'ini kullanın');
            console.log('   3. Electron bot ile paralel çalışabilir\n');
          }
        }
      }
    }
  } catch (error) {
    log.error(`Beklenmeyen hata: ${(error as Error).message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
