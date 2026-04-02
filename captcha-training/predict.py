"""
GİB CAPTCHA OCR — Tahmin & Test Scripti
=========================================
Eğitilmiş model ile captcha çöz. ONNX veya PyTorch model destekler.

Kullanım:
  # Tek dosya
  python predict.py --image data/raw/sample.png

  # Klasör (toplu test)
  python predict.py --dir data/raw/ --limit 100

  # ONNX model ile
  python predict.py --image sample.png --onnx checkpoints/gib-captcha.onnx

  # GİB'den canlı captcha çek ve çöz
  python predict.py --live --count 10
"""

import argparse
import base64
import time
from pathlib import Path

import cv2
import numpy as np
import torch

from config import (
    CHECKPOINT_DIR,
    IMG_CHANNELS,
    IMG_HEIGHT,
    IMG_WIDTH,
    IDX_TO_CHAR,
    BLANK_IDX,
    LABELED_DIR,
    GIB_CAPTCHA_URL,
)
from model import CRNN


# ═══════════════════════════════════════════════════════════════════════════
# Görüntü İşleme
# ═══════════════════════════════════════════════════════════════════════════


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """
    Grayscale görüntüyü model input formatına dönüştür.
    (H, W) → (1, 1, H', W') float32 normalized
    """
    h, w = img.shape[:2]
    scale = min(IMG_WIDTH / w, IMG_HEIGHT / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    canvas = np.full((IMG_HEIGHT, IMG_WIDTH), 255, dtype=np.uint8)
    y_off = (IMG_HEIGHT - new_h) // 2
    x_off = (IMG_WIDTH - new_w) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized

    arr = canvas.astype(np.float32) / 255.0
    arr = (arr - 0.5) / 0.5
    return arr.reshape(1, 1, IMG_HEIGHT, IMG_WIDTH)


def preprocess_base64(b64_str: str) -> np.ndarray:
    """Base64 string → preprocessed input array."""
    clean = b64_str.split(",", 1)[-1] if "," in b64_str else b64_str
    img_bytes = base64.b64decode(clean)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    return preprocess_image(img)


# ═══════════════════════════════════════════════════════════════════════════
# CTC Decode
# ═══════════════════════════════════════════════════════════════════════════


def ctc_decode(logits: np.ndarray) -> str:
    """
    CTC greedy decode. logits: (seq_len, 1, num_classes) veya (seq_len, num_classes)
    """
    if logits.ndim == 3:
        logits = logits[:, 0, :]  # Batch boyutunu kaldır

    indices = logits.argmax(axis=1).tolist()
    decoded = []
    prev = None
    for idx in indices:
        if idx != BLANK_IDX and idx != prev:
            decoded.append(idx)
        prev = idx
    return "".join(IDX_TO_CHAR.get(i, "?") for i in decoded)


# ═══════════════════════════════════════════════════════════════════════════
# Tahmin — PyTorch
# ═══════════════════════════════════════════════════════════════════════════


def predict_pytorch(model: CRNN, input_arr: np.ndarray) -> str:
    """PyTorch model ile tahmin."""
    tensor = torch.from_numpy(input_arr)
    with torch.no_grad():
        logits = model(tensor).numpy()
    return ctc_decode(logits)


# ═══════════════════════════════════════════════════════════════════════════
# Tahmin — ONNX Runtime
# ═══════════════════════════════════════════════════════════════════════════


def predict_onnx(session, input_arr: np.ndarray) -> str:
    """ONNX Runtime ile tahmin."""
    logits = session.run(None, {"image": input_arr})[0]
    return ctc_decode(logits)


# ═══════════════════════════════════════════════════════════════════════════
# Canlı Test (GİB'den captcha çek ve çöz)
# ═══════════════════════════════════════════════════════════════════════════


def live_test(predictor_fn, count: int):
    """GİB endpoint'inden canlı captcha çekip çöz."""
    import requests

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Cookie": "i18next=tr",
        "Origin": "https://dijital.gib.gov.tr",
        "Referer": "https://dijital.gib.gov.tr/",
    }

    print(f"\n{'='*60}")
    print(f"  Canlı Test: GİB'den {count} captcha çözülecek")
    print(f"{'='*60}\n")

    for i in range(count):
        try:
            resp = requests.get(GIB_CAPTCHA_URL, headers=headers, timeout=15)
            data = resp.json()
            b64 = data.get("captchaImgBase64", "")
            if not b64:
                print(f"  [{i+1}] Captcha alınamadı")
                continue

            input_arr = preprocess_base64(b64)
            t0 = time.time()
            result = predictor_fn(input_arr)
            elapsed = (time.time() - t0) * 1000

            print(f"  [{i+1}] Çözüm: '{result}' ({elapsed:.1f}ms)")
            time.sleep(1)
        except Exception as e:
            print(f"  [{i+1}] Hata: {e}")

    print()


# ═══════════════════════════════════════════════════════════════════════════
# Toplu Test (etiketli veriyle doğruluk ölçme)
# ═══════════════════════════════════════════════════════════════════════════


def batch_test(predictor_fn, image_dir: Path, limit: int):
    """Etiketli veriyle toplu test — doğruluk hesapla."""
    import json

    labels_file = LABELED_DIR / "labels.json"
    if not labels_file.exists():
        print("labels.json bulunamadı! Önce collect.py çalıştırın.")
        return

    with open(labels_file, "r") as f:
        labels = json.load(f)

    correct = 0
    total = 0
    errors = []

    items = list(labels.items())[:limit]

    print(f"\n{'='*60}")
    print(f"  Toplu Test: {len(items)} captcha")
    print(f"{'='*60}\n")

    for filename, info in items:
        img_path = image_dir / filename
        if not img_path.exists():
            continue

        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue

        input_arr = preprocess_image(img)
        prediction = predictor_fn(input_arr)
        label = info["label"]

        total += 1
        if prediction == label:
            correct += 1
        else:
            errors.append((filename, label, prediction))

    acc = correct / total * 100 if total > 0 else 0
    print(f"Doğruluk: {correct}/{total} ({acc:.1f}%)\n")

    if errors:
        print("Yanlış tahminler (ilk 20):")
        for fn, lbl, pred in errors[:20]:
            print(f"  '{lbl}' → '{pred}'  ({fn})")

    print()


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(description="GİB CAPTCHA OCR tahmin")
    parser.add_argument("--image", type=str, help="Tek görüntü dosyası")
    parser.add_argument("--dir", type=str, help="Toplu test dizini")
    parser.add_argument("--limit", type=int, default=100, help="Toplu testte max örnek sayısı")
    parser.add_argument("--live", action="store_true", help="GİB'den canlı captcha çöz")
    parser.add_argument("--count", type=int, default=10, help="Canlı testte captcha sayısı")
    parser.add_argument("--onnx", type=str, default=None, help="ONNX model dosyası")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(CHECKPOINT_DIR / "best_model.pt"),
        help="PyTorch checkpoint",
    )

    args = parser.parse_args()

    # Model yükle
    if args.onnx:
        import onnxruntime as ort
        session = ort.InferenceSession(args.onnx)
        predictor_fn = lambda x: predict_onnx(session, x)
        print(f"ONNX model yüklendi: {args.onnx}")
    else:
        model = CRNN()
        checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        predictor_fn = lambda x: predict_pytorch(model, x)
        acc = checkpoint.get("best_val_acc", 0)
        print(f"PyTorch model yüklendi: {args.checkpoint} (val_acc={acc*100:.1f}%)")

    # Çalıştır
    if args.image:
        img = cv2.imread(args.image, cv2.IMREAD_GRAYSCALE)
        if img is None:
            print(f"Görüntü okunamadı: {args.image}")
            return
        input_arr = preprocess_image(img)
        t0 = time.time()
        result = predictor_fn(input_arr)
        elapsed = (time.time() - t0) * 1000
        print(f"Sonuç: '{result}' ({elapsed:.1f}ms)")

    elif args.dir:
        from config import RAW_DIR
        image_dir = Path(args.dir) if args.dir else RAW_DIR
        batch_test(predictor_fn, image_dir, args.limit)

    elif args.live:
        live_test(predictor_fn, args.count)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
