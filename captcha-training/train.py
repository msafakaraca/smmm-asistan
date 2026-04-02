"""
GİB CAPTCHA OCR — Eğitim Scripti
==================================
CRNN modelini CTC loss ile eğitir.

Kullanım:
  python train.py                          # Varsayılan ayarlarla
  python train.py --epochs 200 --bs 128    # Özel ayarlarla
  python train.py --resume checkpoint.pt   # Devam et
"""

import argparse
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from config import (
    CHECKPOINT_DIR,
    BATCH_SIZE,
    LEARNING_RATE,
    NUM_EPOCHS,
    EARLY_STOP_PATIENCE,
    VAL_SPLIT,
    SAVE_EVERY_N_EPOCHS,
    IDX_TO_CHAR,
    BLANK_IDX,
)
from model import CRNN, count_parameters
from dataset import CaptchaDataset, collate_fn


# ═══════════════════════════════════════════════════════════════════════════
# CTC Decode
# ═══════════════════════════════════════════════════════════════════════════


def ctc_greedy_decode(log_probs: torch.Tensor) -> list[str]:
    """
    CTC greedy decoding — en yüksek olasılıklı karakter dizisini seç,
    tekrar edenleri ve blank'ları kaldır.

    Args:
        log_probs: (seq_len, batch, num_classes)

    Returns:
        Her batch elemanı için çözümlenmiş string listesi
    """
    # (seq_len, batch) — her zaman adımında en yüksek class
    _, max_indices = log_probs.max(dim=2)
    batch_size = max_indices.size(1)

    results = []
    for b in range(batch_size):
        indices = max_indices[:, b].tolist()
        # CTC: tekrar edenleri ve blank'ları kaldır
        decoded = []
        prev = None
        for idx in indices:
            if idx != BLANK_IDX and idx != prev:
                decoded.append(idx)
            prev = idx
        text = "".join(IDX_TO_CHAR.get(i, "?") for i in decoded)
        results.append(text)

    return results


# ═══════════════════════════════════════════════════════════════════════════
# Metrik hesaplama
# ═══════════════════════════════════════════════════════════════════════════


def compute_accuracy(predictions: list[str], labels: list[str]) -> tuple[float, float]:
    """
    Tam eşleşme doğruluğu ve karakter doğruluğu hesapla.

    Returns:
        (exact_match_accuracy, char_accuracy)
    """
    exact = sum(1 for p, l in zip(predictions, labels) if p == l)
    exact_acc = exact / len(labels) if labels else 0.0

    # Karakter bazlı doğruluk
    total_chars = 0
    correct_chars = 0
    for pred, label in zip(predictions, labels):
        total_chars += len(label)
        for i, ch in enumerate(label):
            if i < len(pred) and pred[i] == ch:
                correct_chars += 1

    char_acc = correct_chars / total_chars if total_chars > 0 else 0.0

    return exact_acc, char_acc


# ═══════════════════════════════════════════════════════════════════════════
# Eğitim döngüsü
# ═══════════════════════════════════════════════════════════════════════════


def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"  GİB CAPTCHA OCR Eğitimi")
    print(f"  Cihaz: {device}")
    print(f"{'='*60}\n")

    # Dataset
    full_dataset = CaptchaDataset(augment=False)
    if len(full_dataset) == 0:
        print("HATA: Dataset boş! Önce collect.py çalıştırın.")
        return

    # Train/Val split
    val_size = max(1, int(len(full_dataset) * VAL_SPLIT))
    train_size = len(full_dataset) - val_size

    train_dataset_base, val_dataset = random_split(
        full_dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )

    # Train dataset'e augmentasyon ekle (wrapper)
    train_dataset = CaptchaDataset(augment=True)
    # Aynı split indekslerini kullan
    train_indices = train_dataset_base.indices
    train_dataset.samples = [full_dataset.samples[i] for i in train_indices]

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,  # Windows uyumluluğu
        collate_fn=collate_fn,
        pin_memory=device.type == "cuda",
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        collate_fn=collate_fn,
        pin_memory=device.type == "cuda",
    )

    print(f"Train: {len(train_dataset)} | Val: {val_size}")

    # Model
    model = CRNN().to(device)
    print(f"Model parametreleri: {count_parameters(model):,}\n")

    # Loss, optimizer, scheduler
    criterion = nn.CTCLoss(blank=BLANK_IDX, reduction="mean", zero_infinity=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=5, min_lr=1e-6
    )

    # Sequence length (model çıktısının genişliği)
    seq_length = model.get_sequence_length()

    # Checkpoint'tan devam et
    start_epoch = 0
    best_val_acc = 0.0
    patience_counter = 0

    if args.resume:
        checkpoint = torch.load(args.resume, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        start_epoch = checkpoint.get("epoch", 0) + 1
        best_val_acc = checkpoint.get("best_val_acc", 0.0)
        print(f"Checkpoint'tan devam: epoch {start_epoch}, best_val_acc={best_val_acc:.4f}\n")

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    # ═══════════════════════════════════════════════════════════════
    # Eğitim döngüsü
    # ═══════════════════════════════════════════════════════════════

    for epoch in range(start_epoch, args.epochs):
        t0 = time.time()
        model.train()
        total_loss = 0.0
        train_preds, train_labels = [], []

        for batch in train_loader:
            images = batch["images"].to(device)
            targets = batch["targets"].to(device)
            target_lengths = batch["target_lengths"].to(device)

            # Forward
            log_probs = model(images)  # (seq_len, batch, num_classes)
            log_probs = log_probs.log_softmax(dim=2)

            # Input lengths — tüm örnekler aynı sequence uzunluğa sahip
            input_lengths = torch.full(
                (images.size(0),), seq_length, dtype=torch.long, device=device
            )

            # CTC Loss
            loss = criterion(log_probs, targets, input_lengths, target_lengths)

            # Backward
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
            optimizer.step()

            total_loss += loss.item()

            # Decode (eğitim metrikleri için)
            with torch.no_grad():
                preds = ctc_greedy_decode(log_probs)
                train_preds.extend(preds)
                train_labels.extend(batch["labels"])

        avg_loss = total_loss / len(train_loader)
        train_exact, train_char = compute_accuracy(train_preds, train_labels)

        # ═══════════════════════════════════════════════════════════════
        # Validation
        # ═══════════════════════════════════════════════════════════════

        model.eval()
        val_preds, val_labels = [], []

        with torch.no_grad():
            for batch in val_loader:
                images = batch["images"].to(device)
                log_probs = model(images).log_softmax(dim=2)
                preds = ctc_greedy_decode(log_probs)
                val_preds.extend(preds)
                val_labels.extend(batch["labels"])

        val_exact, val_char = compute_accuracy(val_preds, val_labels)

        # Scheduler
        scheduler.step(val_exact)
        current_lr = optimizer.param_groups[0]["lr"]
        elapsed = time.time() - t0

        # Loglama
        print(
            f"Epoch {epoch+1:3d}/{args.epochs} | "
            f"Loss: {avg_loss:.4f} | "
            f"Train: {train_exact*100:.1f}%/{train_char*100:.1f}% | "
            f"Val: {val_exact*100:.1f}%/{val_char*100:.1f}% | "
            f"LR: {current_lr:.2e} | "
            f"{elapsed:.1f}s"
        )

        # Bazı örnekleri göster
        if (epoch + 1) % 10 == 0 and val_preds:
            print("  Örnekler:")
            for i in range(min(5, len(val_preds))):
                status = "✓" if val_preds[i] == val_labels[i] else "✗"
                print(f"    {status} '{val_labels[i]}' → '{val_preds[i]}'")

        # ═══════════════════════════════════════════════════════════════
        # Checkpoint kaydetme
        # ═══════════════════════════════════════════════════════════════

        # En iyi model
        if val_exact > best_val_acc:
            best_val_acc = val_exact
            patience_counter = 0
            save_path = CHECKPOINT_DIR / "best_model.pt"
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "best_val_acc": best_val_acc,
                "val_char_acc": val_char,
                "train_exact_acc": train_exact,
            }, save_path)
            print(f"  ★ Yeni en iyi model kaydedildi: val_exact={best_val_acc*100:.1f}%")
        else:
            patience_counter += 1

        # Periyodik kayıt
        if (epoch + 1) % SAVE_EVERY_N_EPOCHS == 0:
            save_path = CHECKPOINT_DIR / f"epoch_{epoch+1}.pt"
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "best_val_acc": best_val_acc,
            }, save_path)

        # Early stopping
        if patience_counter >= EARLY_STOP_PATIENCE:
            print(f"\nEarly stopping: {EARLY_STOP_PATIENCE} epoch boyunca iyileşme yok.")
            break

    # ═══════════════════════════════════════════════════════════════
    # Sonuç
    # ═══════════════════════════════════════════════════════════════

    print(f"\n{'='*60}")
    print(f"  Eğitim Tamamlandı!")
    print(f"  En iyi validation doğruluğu: {best_val_acc*100:.1f}%")
    print(f"  Checkpoint: {CHECKPOINT_DIR / 'best_model.pt'}")
    print(f"{'='*60}\n")


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(description="GİB CAPTCHA OCR eğitimi")
    parser.add_argument("--epochs", type=int, default=NUM_EPOCHS, help=f"Epoch sayısı (varsayılan: {NUM_EPOCHS})")
    parser.add_argument("--bs", "--batch-size", type=int, default=BATCH_SIZE, dest="batch_size", help=f"Batch size (varsayılan: {BATCH_SIZE})")
    parser.add_argument("--lr", type=float, default=LEARNING_RATE, help=f"Öğrenme oranı (varsayılan: {LEARNING_RATE})")
    parser.add_argument("--resume", type=str, default=None, help="Devam etmek için checkpoint dosyası")

    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
