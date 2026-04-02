"""
GİB CAPTCHA OCR — ONNX Export
===============================
Eğitilmiş PyTorch modelini ONNX formatına dönüştürür.
ONNX modeli Electron Bot'ta onnxruntime-node ile çalışır.

Kullanım:
  python export_onnx.py                                    # Varsayılan best_model.pt
  python export_onnx.py --checkpoint checkpoints/epoch_50.pt
  python export_onnx.py --output ../electron-bot/models/gib-captcha.onnx
"""

import argparse
from pathlib import Path

import torch
import onnx
import onnxruntime as ort
import numpy as np

from config import CHECKPOINT_DIR, IMG_CHANNELS, IMG_HEIGHT, IMG_WIDTH, IDX_TO_CHAR, BLANK_IDX
from model import CRNN


def export(checkpoint_path: str, output_path: str, verify: bool = True):
    """PyTorch checkpoint → ONNX dönüşümü."""
    print(f"\n{'='*60}")
    print(f"  ONNX Export")
    print(f"  Checkpoint: {checkpoint_path}")
    print(f"  Çıktı: {output_path}")
    print(f"{'='*60}\n")

    # Model yükle
    device = torch.device("cpu")
    model = CRNN().to(device)

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    best_acc = checkpoint.get("best_val_acc", 0)
    epoch = checkpoint.get("epoch", "?")
    print(f"Model: epoch={epoch}, val_acc={best_acc*100:.1f}%")

    # Dummy input
    dummy_input = torch.randn(1, IMG_CHANNELS, IMG_HEIGHT, IMG_WIDTH, device=device)

    # Export
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={
            "image": {0: "batch_size"},
            "logits": {1: "batch_size"},
        },
    )

    # Dosya boyutu
    onnx_size = Path(output_path).stat().st_size
    print(f"ONNX dosya boyutu: {onnx_size / 1024 / 1024:.2f} MB")

    # ONNX model doğrulama
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model doğrulaması: OK")

    # ═══════════════════════════════════════════════════════════════
    # Doğrulama: PyTorch vs ONNX Runtime çıktı karşılaştırması
    # ═══════════════════════════════════════════════════════════════

    if verify:
        print("\nPyTorch vs ONNX Runtime doğrulaması...")

        # PyTorch inference
        with torch.no_grad():
            pt_output = model(dummy_input).numpy()

        # ONNX Runtime inference
        session = ort.InferenceSession(output_path)
        ort_output = session.run(None, {"image": dummy_input.numpy()})[0]

        # Karşılaştır
        max_diff = np.max(np.abs(pt_output - ort_output))
        mean_diff = np.mean(np.abs(pt_output - ort_output))
        print(f"Max fark: {max_diff:.8f}")
        print(f"Ortalama fark: {mean_diff:.8f}")

        if max_diff < 1e-4:
            print("Doğrulama: BAŞARILI (fark < 1e-4)")
        else:
            print("UYARI: Fark beklentinin üzerinde! Model çıktılarını kontrol edin.")

        # Çıktı şekli
        print(f"\nÇıktı şekli: {ort_output.shape}")
        # CTC decode testi
        log_probs = torch.from_numpy(ort_output).log_softmax(dim=2)
        _, max_indices = log_probs.max(dim=2)
        indices = max_indices[:, 0].tolist()
        decoded = []
        prev = None
        for idx in indices:
            if idx != BLANK_IDX and idx != prev:
                decoded.append(idx)
            prev = idx
        text = "".join(IDX_TO_CHAR.get(i, "?") for i in decoded)
        print(f"Test decode (rastgele input): '{text}'")

    print(f"\n{'='*60}")
    print(f"  Export tamamlandı: {output_path}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="ONNX export")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(CHECKPOINT_DIR / "best_model.pt"),
        help="Checkpoint dosyası",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(CHECKPOINT_DIR / "gib-captcha.onnx"),
        help="ONNX çıktı yolu",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Doğrulama adımını atla",
    )

    args = parser.parse_args()
    export(args.checkpoint, args.output, verify=not args.no_verify)


if __name__ == "__main__":
    main()
