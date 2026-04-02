"""
GİB CAPTCHA OCR — CRNN Model
==============================
CNN (özellik çıkarma) + BiLSTM (dizi modelleme) + CTC (çözümleme)

Mimari:
  Input (1, 64, 200)
  → CNN bloğu (7 katman, BatchNorm, MaxPool)
  → Reshape (sequence_length, channels)
  → BiLSTM (2 katman, 128 hidden)
  → Linear → NUM_CLASSES
  → CTC Decode
"""

import torch
import torch.nn as nn

from config import (
    IMG_HEIGHT,
    IMG_WIDTH,
    IMG_CHANNELS,
    NUM_CLASSES,
    CNN_OUTPUT_CHANNELS,
    RNN_HIDDEN_SIZE,
    RNN_NUM_LAYERS,
    DROPOUT,
)


class CRNN(nn.Module):
    """
    CRNN (Convolutional Recurrent Neural Network) — CTC tabanlı captcha çözücü.

    Akış:
      image → CNN → map → BiLSTM → projection → CTC decode
    """

    def __init__(self):
        super().__init__()

        # ═══════════════════════════════════════════════════════════════
        # CNN — Özellik çıkarma
        # ═══════════════════════════════════════════════════════════════
        self.cnn = nn.Sequential(
            # Block 1: 1 → 64, H/2, W/2
            nn.Conv2d(IMG_CHANNELS, 64, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 64 → 32, 200 → 100

            # Block 2: 64 → 128, H/2, W/2
            nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 32 → 16, 100 → 50

            # Block 3: 128 → 256
            nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),

            # Block 4: 256 → 256, H/2, W sadece H pool
            nn.Conv2d(256, 256, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1)),  # 16 → 8, 50 → 50

            # Block 5: 256 → 512
            nn.Conv2d(256, 512, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True),

            # Block 6: 512 → 512, H/2
            nn.Conv2d(512, 512, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(512),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=(2, 1), stride=(2, 1)),  # 8 → 4, 50 → 50

            # Block 7: 512 → CNN_OUTPUT_CHANNELS, H → 1
            nn.Conv2d(512, CNN_OUTPUT_CHANNELS, kernel_size=(4, 1), stride=1, padding=0),
            nn.BatchNorm2d(CNN_OUTPUT_CHANNELS),
            nn.ReLU(inplace=True),
            # Çıktı: (batch, 256, 1, 50)
        )

        # ═══════════════════════════════════════════════════════════════
        # RNN — Dizi modelleme (BiLSTM)
        # ═══════════════════════════════════════════════════════════════
        self.rnn = nn.LSTM(
            input_size=CNN_OUTPUT_CHANNELS,
            hidden_size=RNN_HIDDEN_SIZE,
            num_layers=RNN_NUM_LAYERS,
            bidirectional=True,
            dropout=DROPOUT if RNN_NUM_LAYERS > 1 else 0,
            batch_first=False,
        )

        # ═══════════════════════════════════════════════════════════════
        # Projeksiyon — RNN çıktısı → karakter sınıfları
        # ═══════════════════════════════════════════════════════════════
        self.dropout = nn.Dropout(DROPOUT)
        self.projection = nn.Linear(RNN_HIDDEN_SIZE * 2, NUM_CLASSES)  # *2 bidirectional

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, 1, 64, 200) grayscale görüntü

        Returns:
            (seq_len, batch, num_classes) — CTC input formatı
        """
        # CNN
        conv = self.cnn(x)  # (batch, 256, 1, 50)

        # Reshape: (batch, C, 1, W) → (W, batch, C) — CTC sequence formatı
        b, c, h, w = conv.size()
        assert h == 1, f"CNN çıktı yüksekliği 1 olmalı, aldı: {h}"
        conv = conv.squeeze(2)        # (batch, C, W)
        conv = conv.permute(2, 0, 1)  # (W, batch, C) = (50, batch, 256)

        # RNN
        rnn_out, _ = self.rnn(conv)   # (50, batch, 256)

        # Projeksiyon
        out = self.dropout(rnn_out)
        out = self.projection(out)    # (50, batch, NUM_CLASSES)

        return out

    def get_sequence_length(self) -> int:
        """CNN çıktısının genişliği (sequence length) — CTC için gerekli."""
        return IMG_WIDTH // 4  # 200 / 4 = 50 (2 adet stride=2 MaxPool genişlikte)


def count_parameters(model: nn.Module) -> int:
    """Eğitilebilir parametre sayısı."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    # Test: model boyutu ve çıktı şekli
    model = CRNN()
    print(f"Model parametreleri: {count_parameters(model):,}")
    print(f"Tahmini boyut: ~{count_parameters(model) * 4 / 1024 / 1024:.1f} MB (float32)")

    dummy = torch.randn(2, IMG_CHANNELS, IMG_HEIGHT, IMG_WIDTH)
    output = model(dummy)
    print(f"Input şekli:  {dummy.shape}")
    print(f"Output şekli: {output.shape}")
    print(f"Sequence length: {model.get_sequence_length()}")
    print(f"Num classes: {NUM_CLASSES}")
