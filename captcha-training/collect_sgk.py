"""
SGK CAPTCHA Veri Toplama Scripti — Paralel 2Captcha
=====================================================
SGK E-Bildirge captcha'larını toplu indirir, 2Captcha ile paralel etiketler.

Kullanım:
  python collect_sgk.py --count 650 --captcha-key YOUR_KEY

Strateji:
  1. SGK'dan captcha indir (300ms aralık, rate-limit koruması)
  2. Her captcha'yı anında 2Captcha'ya gönder (non-blocking submit)
  3. Sonuçları paralel olarak topla
  4. Etiketli görselleri data/sgk_labeled/ altına kaydet

Maliyet: ~$2 / 670 captcha (2Captcha normal captcha fiyatı)
"""

import argparse
import base64
import json
import time
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from tqdm import tqdm

# ═══════════════════════════════════════════════════════════════════════════
# Ayarlar
# ═══════════════════════════════════════════════════════════════════════════

SGK_CAPTCHA_URL = "https://ebildirge.sgk.gov.tr/EBildirgeV2/PG"
SGK_REFERER = "https://ebildirge.sgk.gov.tr/EBildirgeV2/"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
SGK_RAW_DIR = DATA_DIR / "sgk_raw"
SGK_LABELED_DIR = DATA_DIR / "sgk_labeled"

FETCH_DELAY = 0.3        # SGK'dan indirme aralığı (saniye)
CAPTCHA_POLL_DELAY = 2.0  # 2Captcha polling aralığı
CAPTCHA_POLL_MAX = 12     # Max polling denemesi (~24s)
PARALLEL_WORKERS = 10     # Paralel 2Captcha polling thread sayısı


# ═══════════════════════════════════════════════════════════════════════════
# SGK Captcha İndirme
# ═══════════════════════════════════════════════════════════════════════════

def fetch_sgk_captcha(session: requests.Session) -> bytes | None:
    """SGK'dan JPEG captcha indir."""
    try:
        resp = session.get(
            SGK_CAPTCHA_URL,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "tr-TR,tr;q=0.9",
                "Referer": SGK_REFERER,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        if len(resp.content) < 500:  # Çok küçükse geçersiz
            return None
        return resp.content
    except Exception as e:
        print(f"  SGK indirme hatası: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
# 2Captcha — Submit + Poll (thread-safe)
# ═══════════════════════════════════════════════════════════════════════════

def submit_to_2captcha(image_b64: str, api_key: str) -> str | None:
    """2Captcha'ya captcha gönder, task ID döndür."""
    try:
        resp = requests.post(
            "https://2captcha.com/in.php",
            data={
                "key": api_key,
                "method": "base64",
                "body": image_b64,
                "json": "1",
                "numeric": "0",       # alfanümerik
                "min_len": "4",
                "max_len": "8",
                "language": "2",      # Latin
                "textinstructions": "SGK captcha, alphanumeric, uppercase letters and digits, 5-6 characters.",
            },
            timeout=15,
        )
        result = resp.json()
        if result.get("status") == 1:
            return result["request"]
        else:
            print(f"  2Captcha submit hatası: {result}")
            return None
    except Exception as e:
        print(f"  2Captcha submit exception: {e}")
        return None


def poll_2captcha(task_id: str, api_key: str) -> str | None:
    """2Captcha sonucunu polling ile al."""
    try:
        time.sleep(CAPTCHA_POLL_DELAY)  # İlk bekleme
        for _ in range(CAPTCHA_POLL_MAX):
            resp = requests.get(
                "https://2captcha.com/res.php",
                params={"key": api_key, "action": "get", "id": task_id, "json": "1"},
                timeout=10,
            )
            data = resp.json()
            if data.get("status") == 1:
                return data["request"]
            if data.get("request") != "CAPCHA_NOT_READY":
                return None
            time.sleep(CAPTCHA_POLL_DELAY)
        return None
    except Exception as e:
        print(f"  2Captcha poll exception: {e}")
        return None


def solve_single(args: tuple) -> tuple[int, str | None]:
    """Tek bir captcha'nın 2Captcha sonucunu al. (ThreadPool worker)"""
    idx, task_id, api_key = args
    result = poll_2captcha(task_id, api_key)
    return idx, result


# ═══════════════════════════════════════════════════════════════════════════
# Ana Toplama
# ═══════════════════════════════════════════════════════════════════════════

def collect(count: int, captcha_key: str):
    SGK_RAW_DIR.mkdir(parents=True, exist_ok=True)
    SGK_LABELED_DIR.mkdir(parents=True, exist_ok=True)

    labels_file = SGK_LABELED_DIR / "labels.json"
    if labels_file.exists():
        with open(labels_file, "r", encoding="utf-8") as f:
            labels = json.load(f)
    else:
        labels = {}

    existing_count = len(labels)
    print(f"\n{'='*60}")
    print(f"  SGK CAPTCHA Veri Toplama (Paralel 2Captcha)")
    print(f"  Hedef: {count} yeni captcha")
    print(f"  Mevcut etiketli: {existing_count}")
    print(f"  Paralel worker: {PARALLEL_WORKERS}")
    print(f"{'='*60}\n")

    session = requests.Session()
    stats = {"downloaded": 0, "submitted": 0, "labeled": 0, "failed": 0}

    # Batch bazlı çalış: PARALLEL_WORKERS kadar indir, submit et, sonuçları topla
    batch_size = PARALLEL_WORKERS
    total_batches = (count + batch_size - 1) // batch_size
    global_idx = existing_count

    pbar = tqdm(total=count, desc="Toplama", unit="captcha")

    remaining = count
    while remaining > 0:
        current_batch = min(batch_size, remaining)
        batch_items = []  # (index, filename, task_id)

        # ─── Aşama 1: İndir + Submit ─────────────────────────────────
        for b in range(current_batch):
            jpeg_data = fetch_sgk_captcha(session)
            if jpeg_data is None:
                stats["failed"] += 1
                time.sleep(FETCH_DELAY)
                continue

            global_idx += 1
            filename = f"sgk_{int(time.time()*1000)}_{global_idx:05d}.jpg"
            filepath = SGK_RAW_DIR / filename
            filepath.write_bytes(jpeg_data)
            stats["downloaded"] += 1

            # Etiketli dizine de kopyala (sonra adı değişecek)
            labeled_path = SGK_LABELED_DIR / filename
            labeled_path.write_bytes(jpeg_data)

            # 2Captcha'ya gönder
            img_b64 = base64.b64encode(jpeg_data).decode()
            task_id = submit_to_2captcha(img_b64, captcha_key)

            if task_id:
                batch_items.append((len(batch_items), filename, task_id))
                stats["submitted"] += 1
            else:
                stats["failed"] += 1

            time.sleep(FETCH_DELAY)

        # ─── Aşama 2: Paralel Polling ────────────────────────────────
        if batch_items:
            poll_args = [(idx, task_id, captcha_key) for idx, _, task_id in batch_items]

            with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
                futures = {executor.submit(solve_single, arg): arg for arg in poll_args}

                for future in as_completed(futures):
                    idx, result = future.result()
                    _, filename, _ = batch_items[idx]

                    if result and len(result) >= 4:
                        # Etiketi kaydet (lowercase normalize)
                        label = result.strip().upper()  # SGK captcha'ları uppercase
                        labels[filename] = {
                            "label": label,
                            "confidence": "2captcha",
                        }
                        stats["labeled"] += 1
                    else:
                        stats["failed"] += 1

            pbar.update(current_batch)
            remaining -= current_batch

        # Periyodik kaydet
        if stats["downloaded"] % 50 == 0 or remaining <= 0:
            with open(labels_file, "w", encoding="utf-8") as f:
                json.dump(labels, f, ensure_ascii=False, indent=2)

    pbar.close()

    # Son kayıt
    with open(labels_file, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)

    # ─── Dosyaları etiketle (label_filename.jpg olarak rename) ────────
    print("\nDosyalar yeniden adlandırılıyor...")
    renamed = 0
    for filename, info in labels.items():
        old_path = SGK_LABELED_DIR / filename
        if old_path.exists():
            label = info["label"]
            # Dosya adı: LABEL_originalname.jpg
            new_name = f"{label}_{filename}"
            new_path = SGK_LABELED_DIR / new_name
            if not new_path.exists():
                old_path.rename(new_path)
                renamed += 1

    print(f"\n{'='*60}")
    print(f"  Toplama Tamamlandı!")
    print(f"  İndirilen:    {stats['downloaded']}")
    print(f"  Submit:       {stats['submitted']}")
    print(f"  Etiketlenen:  {stats['labeled']}")
    print(f"  Başarısız:    {stats['failed']}")
    print(f"  Rename:       {renamed}")
    print(f"  Etiket:       {labels_file}")
    print(f"  Ham görseller: {SGK_RAW_DIR}")
    print(f"  Etiketli:     {SGK_LABELED_DIR}")
    print(f"{'='*60}\n")

    # Başarı oranı
    if stats["downloaded"] > 0:
        rate = stats["labeled"] / stats["downloaded"] * 100
        print(f"  Etiketleme başarı oranı: {rate:.1f}%")
        cost_per = 2.99 / 1000  # $ per captcha
        estimated_cost = stats["submitted"] * cost_per
        print(f"  Tahmini maliyet: ${estimated_cost:.2f}")


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="SGK CAPTCHA veri toplama (paralel 2Captcha)")
    parser.add_argument("--count", type=int, default=650, help="Toplanacak captcha sayısı (varsayılan: 650)")
    parser.add_argument("--captcha-key", type=str, required=True, help="2Captcha API anahtarı")
    args = parser.parse_args()

    if args.count < 1:
        print("HATA: count en az 1 olmalı")
        sys.exit(1)

    collect(args.count, args.captcha_key)


if __name__ == "__main__":
    main()
