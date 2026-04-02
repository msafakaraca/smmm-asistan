"""
ddddocr ile GİB Captcha Test Scripti
=====================================
GİB captcha görsellerini ddddocr'un hazır modeliyle test eder.
Canlı captcha'ları indirir, sonucu dosya adına yazar — manuel kontrol için.

Kullanım:
  pip install ddddocr
  python test_ddddocr.py
"""

import base64
import time
from pathlib import Path

import requests

try:
    import ddddocr
except ImportError:
    print("HATA: ddddocr kurulu değil. Şu komutu çalıştır:")
    print("  pip install ddddocr")
    exit(1)

# GİB captcha karakter seti
GIB_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789-"

RAW_DIR = Path(__file__).parent / "data" / "raw"
TEST_DIR = Path(__file__).parent / "data" / "ddddocr_test"


def test_existing_images():
    """Mevcut captcha görselleri ile varsayılan ve beta model karşılaştırması."""
    images = sorted(RAW_DIR.glob("*.png"))
    # live_test_ dosyalarını çıkar
    images = [p for p in images if not p.name.startswith("live_test_")]

    if not images:
        print("  Mevcut captcha görseli bulunamadı, atlanıyor.")
        return

    print("=" * 70)
    print("  MEVCUT GÖRSELLER TESTİ")
    print("=" * 70)

    ocr_default = ddddocr.DdddOcr(show_ad=False)
    ocr_default.set_ranges(GIB_CHARSET)

    ocr_beta = ddddocr.DdddOcr(show_ad=False, beta=True)
    ocr_beta.set_ranges(GIB_CHARSET)

    print(f"\n  {'Dosya':<40} {'Varsayılan':<15} {'Beta':<15}")
    print(f"  {'-'*40} {'-'*15} {'-'*15}")

    for img_path in images:
        img_bytes = img_path.read_bytes()
        r1 = ocr_default.classification(img_bytes)
        r2 = ocr_beta.classification(img_bytes)
        match = "AYNI" if r1 == r2 else "FARKLI"
        print(f"  {img_path.name:<40} {r1:<15} {r2:<15} {match}")

    print(f"\n  Sonuçları yukarıdaki görselleri açarak doğrulayın.")


def test_live_captchas(count: int = 20):
    """
    GİB'den canlı captcha indir, ddddocr ile çöz.
    Görseli 'sonuç_cid.png' adıyla kaydet — manuel kontrol için.
    """
    TEST_DIR.mkdir(parents=True, exist_ok=True)

    # Eski test dosyalarını temizle
    for old in TEST_DIR.glob("*.png"):
        old.unlink()

    print("\n" + "=" * 70)
    print(f"  CANLI GİB CAPTCHA TESTİ ({count} adet)")
    print("=" * 70)

    ocr = ddddocr.DdddOcr(show_ad=False)
    ocr.set_ranges(GIB_CHARSET)

    url = "https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
        "Cookie": "i18next=tr",
        "Origin": "https://dijital.gib.gov.tr",
        "Referer": "https://dijital.gib.gov.tr/",
    }

    print(f"\n  {'#':<5} {'ddddocr Sonuç':<15} {'Süre':>8}  {'Dosya'}")
    print(f"  {'-'*5} {'-'*15} {'-'*8}  {'-'*30}")

    total_time = 0
    success = 0

    for i in range(count):
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            data = resp.json()
            cid = data.get("cid", "unknown")[:8]
            img_b64 = data.get("captchaImgBase64", "")

            clean = img_b64.split(",", 1)[-1] if "," in img_b64 else img_b64
            img_bytes = base64.b64decode(clean)

            t0 = time.perf_counter()
            result = ocr.classification(img_bytes)
            elapsed = (time.perf_counter() - t0) * 1000
            total_time += elapsed

            # Dosya adı: sıra_sonuç_cid.png → görselı açınca sonucu kontrol et
            filename = f"{i+1:02d}_{result}_{cid}.png"
            save_path = TEST_DIR / filename
            save_path.write_bytes(img_bytes)

            print(f"  {i+1:<5} {result:<15} {elapsed:>6.1f}ms  {filename}")
            success += 1

            time.sleep(1)  # GİB rate limit
        except Exception as e:
            print(f"  {i+1:<5} HATA: {e}")

    if success > 0:
        avg = total_time / success
        print(f"\n  Ortalama: {avg:.1f}ms/captcha | Toplam: {total_time:.0f}ms")

    print(f"\n  Görseller kaydedildi: {TEST_DIR.resolve()}")
    print(f"  Dosya adı formatı: sıra_sonuç_cid.png")
    print(f"  Gorseli ac, dosya adindaki sonucla karsilastir.")
    print(f"  Dogru/yanlis sayisini raporla.")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  ddddocr GİB CAPTCHA Test Aracı")
    print("  Karakter seti: a-z, 0-9, -")
    print("=" * 70)

    # Test 1: Mevcut görseller (varsayılan vs beta)
    test_existing_images()

    # Test 2: 20 canlı captcha indir ve test et
    test_live_captchas(20)

    print("\n  Test tamamlandı!\n")
