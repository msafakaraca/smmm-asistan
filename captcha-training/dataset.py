"""
GİB CAPTCHA OCR — Dataset & Augmentasyon
==========================================
PyTorch Dataset sınıfı. Etiketlenmiş captcha görüntülerini yükler,
ön işleme yapar ve opsiyonel augmentasyon uygular.
"""

import json
import random
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from config import (
    RAW_DIR,
    LABELED_DIR,
    IMG_HEIGHT,
    IMG_WIDTH,
    MAX_LABEL_LENGTH,
    CHAR_TO_IDX,
    CHARSET,
)


# ═══════════════════════════════════════════════════════════════════════════
# Augmentasyon fonksiyonları (hafif — captcha varyasyonlarını simüle eder)
# ═══════════════════════════════════════════════════════════════════════════


def augment_image(img: np.ndarray) -> np.ndarray:
    """
    Hafif augmentasyon uygula. GİB captcha'larının doğal varyasyonlarını taklit eder.
    img: grayscale (H, W) uint8
    """
    # %50 ihtimalle rotation (-5 ile +5 derece)
    if random.random() < 0.5:
        angle = random.uniform(-5, 5)
        h, w = img.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderValue=255)

    # %40 ihtimalle Gaussian blur
    if random.random() < 0.4:
        ksize = random.choice([3, 5])
        img = cv2.GaussianBlur(img, (ksize, ksize), 0)

    # %30 ihtimalle Gaussian noise
    if random.random() < 0.3:
        noise = np.random.normal(0, random.uniform(5, 15), img.shape).astype(np.float32)
        img = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)

    # %30 ihtimalle parlaklık/kontrast değişimi
    if random.random() < 0.3:
        alpha = random.uniform(0.8, 1.2)  # kontrast
        beta = random.uniform(-20, 20)    # parlaklık
        img = np.clip(img.astype(np.float32) * alpha + beta, 0, 255).astype(np.uint8)

    # %20 ihtimalle erosion veya dilation (karakter kalınlığı değişimi)
    if random.random() < 0.2:
        kernel = np.ones((2, 2), np.uint8)
        if random.random() < 0.5:
            img = cv2.erode(img, kernel, iterations=1)
        else:
            img = cv2.dilate(img, kernel, iterations=1)

    return img


# ═══════════════════════════════════════════════════════════════════════════
# Dataset
# ═══════════════════════════════════════════════════════════════════════════


class CaptchaDataset(Dataset):
    """
    GİB CAPTCHA dataset.

    labels.json formatı:
    {
      "1234567890_abc12345.png": {"label": "x7k2m", "confidence": "high"},
      ...
    }
    """

    def __init__(
        self,
        labels_file: str | Path | None = None,
        image_dir: str | Path | None = None,
        augment: bool = False,
        confidence_filter: str | None = None,
    ):
        """
        Args:
            labels_file: Etiket JSON dosyası yolu (varsayılan: data/labeled/labels.json)
            image_dir: Görüntü dizini (varsayılan: data/raw/)
            augment: Augmentasyon uygulansın mı
            confidence_filter: Sadece belirli güven seviyesindeki örnekleri al
                               ("high", "ocr_only", "2captcha_only" veya None=hepsi)
        """
        self.image_dir = Path(image_dir) if image_dir else RAW_DIR
        self.augment = augment

        labels_path = Path(labels_file) if labels_file else LABELED_DIR / "labels.json"
        with open(labels_path, "r", encoding="utf-8") as f:
            all_labels = json.load(f)

        # Filtreleme ve doğrulama
        self.samples: list[tuple[str, str]] = []
        skipped = 0

        for filename, info in all_labels.items():
            label = info["label"]
            conf = info.get("confidence", "unknown")

            # Güven filtresi
            if confidence_filter and conf != confidence_filter:
                continue

            # Etiket doğrulama: charset'te olmayan karakter varsa atla
            if not all(ch in CHARSET for ch in label):
                skipped += 1
                continue

            # Uzunluk kontrolü
            if len(label) < 1 or len(label) > MAX_LABEL_LENGTH:
                skipped += 1
                continue

            # Dosya var mı kontrol
            if not (self.image_dir / filename).exists():
                skipped += 1
                continue

            self.samples.append((filename, label))

        if skipped > 0:
            print(f"[Dataset] {skipped} örnek atlandı (geçersiz etiket/dosya)")
        print(f"[Dataset] {len(self.samples)} örnek yüklendi (augment={augment})")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict:
        filename, label = self.samples[idx]

        # Görüntüyü yükle (grayscale)
        img_path = str(self.image_dir / filename)
        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)

        if img is None:
            # Fallback: boş görüntü
            img = np.full((IMG_HEIGHT, IMG_WIDTH), 255, dtype=np.uint8)

        # Resize (aspect ratio koru, padding ile)
        img = self._resize_pad(img)

        # Augmentasyon
        if self.augment:
            img = augment_image(img)

        # Normalize: [0, 255] → [0.0, 1.0] → [-1.0, 1.0]
        img = img.astype(np.float32) / 255.0
        img = (img - 0.5) / 0.5

        # Tensor (1, H, W)
        tensor = torch.from_numpy(img).unsqueeze(0)

        # Etiket → index dizisi
        target = [CHAR_TO_IDX[ch] for ch in label]
        target_length = len(target)

        return {
            "image": tensor,
            "target": torch.tensor(target, dtype=torch.long),
            "target_length": target_length,
            "label": label,
        }

    def _resize_pad(self, img: np.ndarray) -> np.ndarray:
        """
        Görüntüyü IMG_HEIGHT x IMG_WIDTH boyutuna getir.
        Aspect ratio koruyarak ölçekle, kalan alanı beyaz ile doldur.
        """
        h, w = img.shape[:2]

        # Hedef boyuta ölçekle (aspect ratio koru)
        scale = min(IMG_WIDTH / w, IMG_HEIGHT / h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        # Beyaz padding
        canvas = np.full((IMG_HEIGHT, IMG_WIDTH), 255, dtype=np.uint8)
        y_offset = (IMG_HEIGHT - new_h) // 2
        x_offset = (IMG_WIDTH - new_w) // 2
        canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized

        return canvas


def collate_fn(batch: list[dict]) -> dict:
    """
    CTC loss için özel collate. Farklı uzunluktaki targetları birleştirir.
    """
    images = torch.stack([item["image"] for item in batch])
    targets = torch.cat([item["target"] for item in batch])
    target_lengths = torch.tensor([item["target_length"] for item in batch], dtype=torch.long)
    labels = [item["label"] for item in batch]

    return {
        "images": images,
        "targets": targets,
        "target_lengths": target_lengths,
        "labels": labels,
    }


if __name__ == "__main__":
    # Test: dataset istatistikleri
    try:
        ds = CaptchaDataset(augment=False)
        print(f"\nToplam örnek: {len(ds)}")

        if len(ds) > 0:
            sample = ds[0]
            print(f"Görüntü şekli: {sample['image'].shape}")
            print(f"Etiket: {sample['label']}")
            print(f"Target: {sample['target']}")
            print(f"Target uzunluk: {sample['target_length']}")

            # Etiket uzunluk dağılımı
            lengths = [len(s[1]) for s in ds.samples]
            from collections import Counter
            print(f"\nEtiket uzunluk dağılımı:")
            for length, count in sorted(Counter(lengths).items()):
                print(f"  {length} karakter: {count} ({count/len(ds)*100:.1f}%)")

            # Karakter frekansı
            all_chars = "".join(s[1] for s in ds.samples)
            print(f"\nKarakter frekansı (top 10):")
            for ch, count in Counter(all_chars).most_common(10):
                print(f"  '{ch}': {count}")

    except FileNotFoundError:
        print("labels.json bulunamadı. Önce collect.py çalıştırın.")
