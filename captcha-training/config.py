"""
GİB CAPTCHA OCR — Konfigürasyon
================================
Tüm sabitler ve ayarlar burada tanımlı.
"""

import string
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# Dizinler
# ═══════════════════════════════════════════════════════════════════════════

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
LABELED_DIR = DATA_DIR / "labeled"
CHECKPOINT_DIR = ROOT_DIR / "checkpoints"

# ═══════════════════════════════════════════════════════════════════════════
# Karakter seti
# ═══════════════════════════════════════════════════════════════════════════

# GİB captcha'larında görülen karakterler: küçük harf + rakam + tire
CHARSET = string.ascii_lowercase + string.digits + "-"
# CTC blank token index 0, gerçek karakterler 1'den başlar
BLANK_IDX = 0
NUM_CLASSES = len(CHARSET) + 1  # +1 blank token için

# Karakter ↔ index dönüşüm tabloları
CHAR_TO_IDX = {ch: i + 1 for i, ch in enumerate(CHARSET)}
IDX_TO_CHAR = {i + 1: ch for i, ch in enumerate(CHARSET)}

# ═══════════════════════════════════════════════════════════════════════════
# Görüntü boyutları
# ═══════════════════════════════════════════════════════════════════════════

IMG_HEIGHT = 64
IMG_WIDTH = 200
IMG_CHANNELS = 1  # Grayscale

# ═══════════════════════════════════════════════════════════════════════════
# Model
# ═══════════════════════════════════════════════════════════════════════════

CNN_OUTPUT_CHANNELS = 256
RNN_HIDDEN_SIZE = 128
RNN_NUM_LAYERS = 2
DROPOUT = 0.3

# ═══════════════════════════════════════════════════════════════════════════
# Eğitim
# ═══════════════════════════════════════════════════════════════════════════

MAX_LABEL_LENGTH = 7
BATCH_SIZE = 64
LEARNING_RATE = 1e-3
NUM_EPOCHS = 100
EARLY_STOP_PATIENCE = 15
VAL_SPLIT = 0.1  # %10 validation
SAVE_EVERY_N_EPOCHS = 5

# ═══════════════════════════════════════════════════════════════════════════
# Veri toplama
# ═══════════════════════════════════════════════════════════════════════════

GIB_CAPTCHA_URL = "https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha"
COLLECT_DELAY_SECONDS = 1.0  # İstekler arası bekleme (GİB rate-limit)
