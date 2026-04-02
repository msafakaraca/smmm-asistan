"""
GİB CAPTCHA Veri Toplama Scripti
=================================
GİB Dijital VD captcha endpoint'inden toplu görüntü indirir ve
OCR.space / 2Captcha servisleri ile otomatik etiketler.

Kullanım:
  python collect.py --count 5000 --ocr-key YOUR_KEY --captcha-key YOUR_KEY

İki servis de aynı sonucu veriyorsa "yüksek güven" olarak işaretlenir.
Tek servis çözdüyse "düşük güven" olarak kaydedilir.
"""

import argparse
import base64
import json
import time
import sys
from pathlib import Path

import requests
from tqdm import tqdm

from config import (
    GIB_CAPTCHA_URL,
    COLLECT_DELAY_SECONDS,
    RAW_DIR,
    LABELED_DIR,
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "User-Agent": USER_AGENT,
    "Cookie": "i18next=tr",
    "Origin": "https://dijital.gib.gov.tr",
    "Referer": "https://dijital.gib.gov.tr/",
}


# ═══════════════════════════════════════════════════════════════════════════
# OCR Servisleri
# ═══════════════════════════════════════════════════════════════════════════


def solve_ocrspace(clean_b64: str, api_key: str) -> str | None:
    """OCR.space Engine 2 ile çöz (captcha'lar için en iyi)."""
    try:
        resp = requests.post(
            "https://api.ocr.space/parse/image",
            data={
                "apikey": api_key,
                "base64Image": f"data:image/png;base64,{clean_b64}",
                "OCREngine": "2",
                "isOverlayRequired": "false",
                "language": "eng",
            },
            timeout=15,
        )
        result = resp.json()
        if result.get("IsErroredOnProcessing"):
            return None
        text = (result.get("ParsedResults") or [{}])[0].get("ParsedText", "")
        text = text.strip().replace(" ", "").lower()
        return text if len(text) >= 4 else None
    except Exception as e:
        print(f"  OCR.space hatası: {e}")
        return None


def solve_2captcha(clean_b64: str, api_key: str) -> str | None:
    """2Captcha ile çöz (daha yavaş ama güvenilir)."""
    try:
        # Gönder
        resp = requests.post(
            "https://2captcha.com/in.php",
            data={
                "key": api_key,
                "method": "base64",
                "body": clean_b64,
                "json": "1",
                "numeric": "0",
                "min_len": "4",
                "max_len": "7",
                "language": "2",
                "textinstructions": "Captcha may contain dash (-) character. Include all characters.",
            },
            timeout=15,
        )
        submit = resp.json()
        if submit.get("status") != 1:
            return None

        captcha_id = submit["request"]

        # Polling — 2s aralıkla max 10 deneme
        time.sleep(2)
        for _ in range(10):
            resp = requests.get(
                "https://2captcha.com/res.php",
                params={"key": api_key, "action": "get", "id": captcha_id, "json": "1"},
                timeout=10,
            )
            data = resp.json()
            if data.get("status") == 1:
                return data["request"].lower()
            if data.get("request") != "CAPCHA_NOT_READY":
                return None
            time.sleep(2)
        return None
    except Exception as e:
        print(f"  2Captcha hatası: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# GİB'den Captcha İndirme
# ═══════════════════════════════════════════════════════════════════════════


def fetch_captcha() -> tuple[str, str] | None:
    """GİB endpoint'inden bir captcha indir. (cid, base64) döner."""
    try:
        resp = requests.get(GIB_CAPTCHA_URL, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        cid = data.get("cid", "")
        img_b64 = data.get("captchaImgBase64", "")
        if not img_b64 or len(img_b64) < 100:
            return None
        # data:image prefix varsa kaldır
        clean = img_b64.split(",", 1)[-1] if "," in img_b64 else img_b64
        return cid, clean
    except Exception as e:
        print(f"  GİB captcha indirme hatası: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Ana Toplama Döngüsü
# ═══════════════════════════════════════════════════════════════════════════


def collect(
    count: int,
    ocr_key: str | None,
    captcha_key: str | None,
    label_mode: str,
):
    """
    count adet captcha indir ve etiketle.

    label_mode:
      - "both": İki servis de çözer, eşleşenler yüksek güven
      - "ocr": Sadece OCR.space
      - "2captcha": Sadece 2Captcha
      - "none": Etiketsiz indir (sonra manuel etiketleme için)
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    LABELED_DIR.mkdir(parents=True, exist_ok=True)

    # Mevcut etiket dosyasını yükle veya oluştur
    labels_file = LABELED_DIR / "labels.json"
    if labels_file.exists():
        with open(labels_file, "r", encoding="utf-8") as f:
            labels = json.load(f)
    else:
        labels = {}

    stats = {"downloaded": 0, "labeled": 0, "high_conf": 0, "failed": 0, "skipped": 0}

    print(f"\n{'='*60}")
    print(f"  GİB CAPTCHA Veri Toplama")
    print(f"  Hedef: {count} captcha | Mod: {label_mode}")
    print(f"{'='*60}\n")

    pbar = tqdm(total=count, desc="Toplama", unit="captcha")

    i = 0
    while i < count:
        # 1. GİB'den captcha indir
        result = fetch_captcha()
        if result is None:
            stats["failed"] += 1
            time.sleep(COLLECT_DELAY_SECONDS)
            continue

        cid, clean_b64 = result

        # 2. Görseli kaydet
        filename = f"{int(time.time()*1000)}_{cid[:8]}.png"
        img_path = RAW_DIR / filename
        img_bytes = base64.b64decode(clean_b64)
        img_path.write_bytes(img_bytes)
        stats["downloaded"] += 1

        # 3. Etiketle
        label = None
        confidence = "none"

        if label_mode == "none":
            pass
        elif label_mode == "both" and ocr_key and captcha_key:
            ocr_result = solve_ocrspace(clean_b64, ocr_key)
            cap_result = solve_2captcha(clean_b64, captcha_key)

            if ocr_result and cap_result and ocr_result == cap_result:
                label = ocr_result
                confidence = "high"
                stats["high_conf"] += 1
            elif ocr_result:
                label = ocr_result
                confidence = "ocr_only"
            elif cap_result:
                label = cap_result
                confidence = "2captcha_only"
        elif label_mode == "ocr" and ocr_key:
            label = solve_ocrspace(clean_b64, ocr_key)
            if label:
                confidence = "ocr_only"
        elif label_mode == "2captcha" and captcha_key:
            label = solve_2captcha(clean_b64, captcha_key)
            if label:
                confidence = "2captcha_only"

        if label:
            labels[filename] = {"label": label, "confidence": confidence}
            stats["labeled"] += 1
        else:
            if label_mode != "none":
                stats["skipped"] += 1

        i += 1
        pbar.update(1)

        # Periyodik kaydet (her 50 captcha'da)
        if i % 50 == 0:
            with open(labels_file, "w", encoding="utf-8") as f:
                json.dump(labels, f, ensure_ascii=False, indent=2)

        time.sleep(COLLECT_DELAY_SECONDS)

    pbar.close()

    # Son kayıt
    with open(labels_file, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"  Toplama Tamamlandı!")
    print(f"  İndirilen: {stats['downloaded']}")
    print(f"  Etiketlenen: {stats['labeled']}")
    print(f"  Yüksek güven: {stats['high_conf']}")
    print(f"  Başarısız: {stats['failed']}")
    print(f"  Çözülemedi: {stats['skipped']}")
    print(f"  Etiket dosyası: {labels_file}")
    print(f"{'='*60}\n")


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(description="GİB CAPTCHA veri toplama")
    parser.add_argument("--count", type=int, default=5000, help="Toplanacak captcha sayısı (varsayılan: 5000)")
    parser.add_argument("--ocr-key", type=str, default=None, help="OCR.space API anahtarı")
    parser.add_argument("--captcha-key", type=str, default=None, help="2Captcha API anahtarı")
    parser.add_argument(
        "--mode",
        choices=["both", "ocr", "2captcha", "none"],
        default="both",
        help="Etiketleme modu (varsayılan: both)",
    )

    args = parser.parse_args()

    # Validasyon
    if args.mode == "both" and (not args.ocr_key or not args.captcha_key):
        print("HATA: 'both' modu için --ocr-key ve --captcha-key gerekli")
        sys.exit(1)
    if args.mode == "ocr" and not args.ocr_key:
        print("HATA: 'ocr' modu için --ocr-key gerekli")
        sys.exit(1)
    if args.mode == "2captcha" and not args.captcha_key:
        print("HATA: '2captcha' modu için --captcha-key gerekli")
        sys.exit(1)

    collect(args.count, args.ocr_key, args.captcha_key, args.mode)


if __name__ == "__main__":
    main()
