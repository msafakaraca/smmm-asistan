/**
 * GİB API Hızlı Test
 *
 * Kullanım: node scripts/quick-test.js
 *
 * NOT: Dev server çalışıyor olmalı (npm run dev)
 */

const BASE_URL = 'http://localhost:3000';

async function test() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('       GİB API HIZLI TEST');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Ayar kontrolü
  console.log('1️⃣  Ayarlar kontrol ediliyor...');
  try {
    const res = await fetch(`${BASE_URL}/api/gib-api/login`);
    const data = await res.json();

    console.log('   GİB Credentials:', data.hasCredentials ? '✅' : '❌');
    console.log('   Captcha Key:', data.hasCaptchaKey ? '✅' : '❌');

    if (!data.hasCredentials || !data.hasCaptchaKey) {
      console.log('\n❌ Ayarlar eksik! Dashboard > Ayarlar > GİB Ayarları\'nı kontrol edin.\n');
      return;
    }
  } catch (e) {
    console.log('   ❌ Hata:', e.message);
    console.log('   Dev server çalışıyor mu? (npm run dev)\n');
    return;
  }

  // 2. GİB Login
  console.log('\n2️⃣  GİB\'e giriş yapılıyor (30-60 saniye)...');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/gib-api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const loginData = await loginRes.json();

    if (loginData.success) {
      console.log('   ✅ GİB girişi başarılı!');
      console.log('   Session:', loginData.session?.sessionId);
    } else {
      console.log('   ❌ Giriş başarısız:', loginData.error);
      return;
    }
  } catch (e) {
    console.log('   ❌ Hata:', e.message);
    return;
  }

  // 3. Beyanname Ara
  console.log('\n3️⃣  Beyannameler aranıyor...');
  try {
    const now = new Date();
    const endDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
    const startDate = `01.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

    const searchRes = await fetch(`${BASE_URL}/api/gib-api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baslangicTarihi: startDate,
        bitisTarihi: endDate,
        sadeceonayli: true
      })
    });
    const searchData = await searchRes.json();

    if (searchData.success) {
      console.log('   ✅ Arama başarılı!');
      console.log('   Bulunan:', searchData.totalCount, 'beyanname');

      if (searchData.data && searchData.data.length > 0) {
        console.log('\n   İlk 3 beyanname:');
        searchData.data.slice(0, 3).forEach((b, i) => {
          console.log(`   ${i+1}. ${b.beyannameTuruAd} | ${b.tcVkn} | ${b.vergilendirmeDonemi}`);
        });
      }
    } else {
      console.log('   ❌ Arama başarısız:', searchData.error);
    }
  } catch (e) {
    console.log('   ❌ Hata:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('Test tamamlandı!');
  console.log('═══════════════════════════════════════════════\n');
}

test();
