"""
ddddocr model extraction script.
Extracts ONNX model, charset, preprocessing/postprocessing details for Node.js reimplementation.
"""
import os
import sys
import json
import shutil
import inspect
import importlib
import numpy as np

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── 1. Find ddddocr installation and model files ──
import ddddocr
ddddocr_dir = os.path.dirname(ddddocr.__file__)
print("=" * 80)
print("1. DDDDOCR INSTALLATION INFO")
print("=" * 80)
try:
    print(f"ddddocr version: {ddddocr.__version__}")
except AttributeError:
    try:
        from importlib.metadata import version as get_version
        print(f"ddddocr version: {get_version('ddddocr')}")
    except Exception:
        print("ddddocr version: unknown")
print(f"ddddocr package dir: {ddddocr_dir}")
print()

# List all files in ddddocr directory
print("Files in ddddocr package:")
for f in sorted(os.listdir(ddddocr_dir)):
    fpath = os.path.join(ddddocr_dir, f)
    size = os.path.getsize(fpath) if os.path.isfile(fpath) else 0
    print(f"  {f} ({size:,} bytes)" if os.path.isfile(fpath) else f"  {f}/ (dir)")

# Find ONNX files
print("\nSearching for ONNX files...")
onnx_files = []
for root, dirs, files in os.walk(ddddocr_dir):
    for f in files:
        if f.endswith('.onnx'):
            full = os.path.join(root, f)
            onnx_files.append(full)
            print(f"  Found: {full} ({os.path.getsize(full):,} bytes)")

# ── 2. Inspect ddddocr source code for preprocessing details ──
print("\n" + "=" * 80)
print("2. DDDDOCR SOURCE CODE ANALYSIS")
print("=" * 80)

# Get the source of the DdddOcr class
src = inspect.getsource(ddddocr.DdddOcr)

# Print the __init__ method to understand initialization
print("\n--- DdddOcr.__init__ relevant sections ---")
init_src = inspect.getsource(ddddocr.DdddOcr.__init__)
print(init_src[:5000])
if len(init_src) > 5000:
    print(f"\n... (truncated, total {len(init_src)} chars)")

# Print the classification method
print("\n--- classification method ---")
try:
    cls_src = inspect.getsource(ddddocr.DdddOcr.classification)
    print(cls_src)
except:
    print("classification method not found, looking for alternatives...")
    for name, method in inspect.getmembers(ddddocr.DdddOcr, predicate=inspect.isfunction):
        if 'classif' in name.lower() or 'predict' in name.lower() or 'ocr' in name.lower():
            print(f"\n--- {name} ---")
            print(inspect.getsource(method))

# ── 3. Create DdddOcr instance and extract internal state ──
print("\n" + "=" * 80)
print("3. DDDDOCR INTERNAL STATE")
print("=" * 80)

ocr = ddddocr.DdddOcr(show_ad=False)

# Extract charset
print("\n--- Character set (charset) ---")
charset = None
for attr_name in dir(ocr):
    if 'char' in attr_name.lower() or 'word' in attr_name.lower() or 'label' in attr_name.lower() or 'vocab' in attr_name.lower():
        val = getattr(ocr, attr_name)
        if isinstance(val, (list, dict, str)) and not attr_name.startswith('__'):
            print(f"  {attr_name}: type={type(val).__name__}, len={len(val) if hasattr(val, '__len__') else 'N/A'}")
            if isinstance(val, list) and len(val) < 200:
                print(f"    value: {val}")
            elif isinstance(val, list):
                print(f"    first 20: {val[:20]}")
                print(f"    last 20: {val[-20:]}")

# Look at all attributes
print("\n--- All instance attributes ---")
for attr_name in sorted(dir(ocr)):
    if attr_name.startswith('_') and not attr_name.startswith('__'):
        val = getattr(ocr, attr_name)
        t = type(val).__name__
        if isinstance(val, (list, tuple)):
            print(f"  {attr_name}: {t}, len={len(val)}")
            if len(val) <= 30:
                print(f"    value: {val}")
        elif isinstance(val, (int, float, str, bool)):
            print(f"  {attr_name}: {t} = {val}")
        elif isinstance(val, np.ndarray):
            print(f"  {attr_name}: ndarray, shape={val.shape}, dtype={val.dtype}")
        else:
            print(f"  {attr_name}: {t}")

# Also check non-underscore attributes
print("\n--- Public attributes (non-method) ---")
for attr_name in sorted(dir(ocr)):
    if not attr_name.startswith('_') and not callable(getattr(ocr, attr_name)):
        val = getattr(ocr, attr_name)
        t = type(val).__name__
        if isinstance(val, (list, tuple)):
            print(f"  {attr_name}: {t}, len={len(val)}")
        elif isinstance(val, (int, float, str, bool, type(None))):
            print(f"  {attr_name}: {t} = {val}")
        else:
            print(f"  {attr_name}: {t}")

# ── 4. ONNX Model inspection ──
print("\n" + "=" * 80)
print("4. ONNX MODEL DETAILS")
print("=" * 80)

import onnxruntime as ort

# Find the default model path from ocr instance
print("\n--- Session info from ocr instance ---")
if hasattr(ocr, '_DdddOcr__ort_session') or hasattr(ocr, 'ort_session'):
    sess = getattr(ocr, '_DdddOcr__ort_session', None) or getattr(ocr, 'ort_session', None)
    if sess:
        for inp in sess.get_inputs():
            print(f"  Input: name='{inp.name}', shape={inp.shape}, type={inp.type}")
        for out in sess.get_outputs():
            print(f"  Output: name='{out.name}', shape={out.shape}, type={out.type}")

# Also load common_old.onnx directly
for onnx_path in onnx_files:
    print(f"\n--- Model: {os.path.basename(onnx_path)} ---")
    sess = ort.InferenceSession(onnx_path)
    for inp in sess.get_inputs():
        print(f"  Input: name='{inp.name}', shape={inp.shape}, type={inp.type}")
    for out in sess.get_outputs():
        print(f"  Output: name='{out.name}', shape={out.shape}, type={out.type}")

# ── 5. Extract the FULL charset/charmap ──
print("\n" + "=" * 80)
print("5. FULL CHARACTER SET EXTRACTION")
print("=" * 80)

# ddddocr stores charset in a json or pickled format
# Let's find it by inspecting the __init__ more carefully
charset_data = None

# Check for json files
for f in os.listdir(ddddocr_dir):
    if f.endswith('.json'):
        print(f"\nFound JSON file: {f}")
        with open(os.path.join(ddddocr_dir, f), 'r', encoding='utf-8') as jf:
            data = json.load(jf)
            if isinstance(data, list):
                print(f"  Type: list, length: {len(data)}")
                print(f"  First 30 items: {data[:30]}")
                charset_data = data
            elif isinstance(data, dict):
                print(f"  Type: dict, keys: {list(data.keys())[:20]}")

# Check for charsets file
for f in os.listdir(ddddocr_dir):
    if 'char' in f.lower() or 'label' in f.lower() or 'word' in f.lower():
        print(f"\nFound charset-related file: {f} ({os.path.getsize(os.path.join(ddddocr_dir, f)):,} bytes)")

# Look at __init__ source for charset loading
print("\n--- Searching init source for charset loading pattern ---")
for line in init_src.split('\n'):
    if any(kw in line.lower() for kw in ['charset', 'char', 'json', 'load', 'word', 'label', 'vocab', 'open']):
        print(f"  {line.strip()}")

# ── 6. Deep inspection - find charset via ocr object's __dict__ ──
print("\n" + "=" * 80)
print("6. DEEP OBJECT INSPECTION")
print("=" * 80)

for key, val in ocr.__dict__.items():
    t = type(val).__name__
    if isinstance(val, list) and len(val) > 10:
        print(f"  {key}: list[{len(val)}], first 5: {val[:5]}, last 5: {val[-5:]}")
        # This is likely the charset - save it
        if len(val) > 50:
            charset_data = val
            print(f"  ^^^ This looks like the charset! Saving...")
    elif isinstance(val, dict) and len(val) > 10:
        keys_sample = list(val.keys())[:5]
        print(f"  {key}: dict[{len(val)}], sample keys: {keys_sample}")
    elif isinstance(val, (int, float, str, bool, type(None))):
        print(f"  {key}: {t} = {repr(val)}")
    elif isinstance(val, np.ndarray):
        print(f"  {key}: ndarray shape={val.shape} dtype={val.dtype}")
    elif isinstance(val, (list, tuple)):
        print(f"  {key}: {t}[{len(val)}] = {val}")
    else:
        print(f"  {key}: {t}")

# ── 7. Save charset to JSON ──
print("\n" + "=" * 80)
print("7. SAVING CHARSET")
print("=" * 80)

output_dir = r"C:\Users\msafa\Desktop\Projeler\SMMM Asistan Güncel\electron-bot\models"
os.makedirs(output_dir, exist_ok=True)

if charset_data:
    charset_path = os.path.join(output_dir, "ddddocr_charset.json")
    with open(charset_path, 'w', encoding='utf-8') as f:
        json.dump(charset_data, f, ensure_ascii=False, indent=2)
    print(f"Charset saved to: {charset_path}")
    print(f"Charset length: {len(charset_data)}")
    print(f"First 50 chars: {charset_data[:50]}")
else:
    print("WARNING: Could not find charset data!")

# ── 8. Copy model ──
print("\n" + "=" * 80)
print("8. COPYING MODEL")
print("=" * 80)

# Find common_old.onnx
src_model = None
for p in onnx_files:
    if 'common_old' in p:
        src_model = p
        break

if not src_model and onnx_files:
    # If no common_old, use the first one
    src_model = onnx_files[0]
    print(f"common_old.onnx not found, using: {os.path.basename(src_model)}")

if src_model:
    dst_model = os.path.join(output_dir, "ddddocr.onnx")
    shutil.copy2(src_model, dst_model)
    print(f"Copied: {src_model}")
    print(f"    To: {dst_model}")
    print(f"  Size: {os.path.getsize(dst_model):,} bytes")
else:
    print("ERROR: No ONNX model found!")

# ── 9. Test inference ──
print("\n" + "=" * 80)
print("9. TEST INFERENCE")
print("=" * 80)

test_img = r"C:\Users\msafa\Desktop\Projeler\SMMM Asistan Güncel\captcha-training\data\ddddocr_test\01_kwm2b_639f92e9.png"

# First, use ddddocr's own classification
with open(test_img, 'rb') as f:
    img_bytes = f.read()
result = ocr.classification(img_bytes)
print(f"ddddocr classification result: '{result}'")
print(f"Expected: 'kwm2b' (from filename)")

# ── 10. Trace the FULL preprocessing pipeline ──
print("\n" + "=" * 80)
print("10. FULL PREPROCESSING PIPELINE")
print("=" * 80)

# Read and trace step by step
from PIL import Image
import io

img = Image.open(io.BytesIO(img_bytes))
print(f"Original image: size={img.size}, mode={img.mode}")

# Now let's trace what ddddocr does internally
# We'll read the classification source carefully
print("\n--- Full classification source ---")
cls_src = inspect.getsource(ddddocr.DdddOcr.classification)
print(cls_src)

# ── 11. Manually replicate preprocessing ──
print("\n" + "=" * 80)
print("11. MANUAL PREPROCESSING REPLICATION")
print("=" * 80)

# Based on source code analysis, replicate the preprocessing
img = Image.open(io.BytesIO(img_bytes))
print(f"Step 1 - Load image: size={img.size}, mode={img.mode}")

# Convert to grayscale (ddddocr uses 'L' mode for old model)
img_gray = img.convert('L')
print(f"Step 2 - Convert to grayscale: size={img_gray.size}, mode={img_gray.mode}")

# Check what resize target ddddocr uses
# Look at the ocr object for resize info
print(f"\nResize target height (from source): checking...")
for key, val in ocr.__dict__.items():
    if 'height' in key.lower() or 'width' in key.lower() or 'size' in key.lower() or 'resize' in key.lower():
        print(f"  {key} = {val}")

# Typical ddddocr: resize to height=64, keep aspect ratio
# Let's check by reading the source more carefully
print("\n--- Searching for resize logic in source ---")
full_src = inspect.getsource(ddddocr.DdddOcr)
for i, line in enumerate(full_src.split('\n')):
    if any(kw in line.lower() for kw in ['resize', 'height', 'width', '64', 'ratio', 'scale']):
        print(f"  Line {i}: {line.strip()}")

# ── 12. Run raw inference and show output ──
print("\n" + "=" * 80)
print("12. RAW INFERENCE OUTPUT")
print("=" * 80)

# Replicate preprocessing exactly
img = Image.open(io.BytesIO(img_bytes)).convert('L')
w, h = img.size
print(f"Image after grayscale: {w}x{h}")

# Resize: height=64, width proportional
target_h = 64
ratio = target_h / h
target_w = int(w * ratio)
# Make width multiple of something? Let's check
print(f"Resize ratio: {ratio}, target: {target_w}x{target_h}")

img_resized = img.resize((target_w, target_h))
print(f"After resize: {img_resized.size}")

# Convert to numpy
img_arr = np.array(img_resized, dtype=np.float32)
print(f"Numpy array shape: {img_arr.shape}, dtype: {img_arr.dtype}")
print(f"Value range: [{img_arr.min()}, {img_arr.max()}]")

# Normalize: /255.0 and then (x - 0.5) / 0.5 = (x / 255 - 0.5) / 0.5
img_norm = (img_arr / 255.0 - 0.5) / 0.5
print(f"After normalization: range=[{img_norm.min():.4f}, {img_norm.max():.4f}]")

# Reshape for ONNX: [1, 1, H, W]
img_input = img_norm.reshape(1, 1, target_h, target_w).astype(np.float32)
print(f"Input tensor shape: {img_input.shape}")

# Run inference
sess = ort.InferenceSession(src_model)
input_name = sess.get_inputs()[0].name
output_name = sess.get_outputs()[0].name

output = sess.run([output_name], {input_name: img_input})
raw_output = output[0]
print(f"\nRaw output shape: {raw_output.shape}")
print(f"Raw output dtype: {raw_output.dtype}")

if len(raw_output.shape) == 3:
    print(f"Interpretation: [batch={raw_output.shape[0]}, time_steps={raw_output.shape[1]}, classes={raw_output.shape[2]}]")
    print(f"Number of time steps (max possible chars): {raw_output.shape[1]}")
    print(f"Number of classes (charset size + blank): {raw_output.shape[2]}")

    # CTC decode
    print(f"\n--- CTC Decoding ---")
    # Get argmax at each timestep
    pred_indices = np.argmax(raw_output[0], axis=1)
    print(f"Predicted indices (argmax per timestep): {pred_indices.tolist()}")

    # CTC decode: remove blanks (index 0) and remove repeats
    decoded = []
    prev = -1
    for idx in pred_indices:
        if idx != 0 and idx != prev:  # 0 is blank
            decoded.append(int(idx))
        prev = idx

    print(f"After CTC decode (remove blanks + repeats): {decoded}")

    if charset_data:
        text = ''.join([charset_data[i] if i < len(charset_data) else '?' for i in decoded])
        print(f"Decoded text: '{text}'")

        # Also show what ddddocr gets
        print(f"\nddddocr result: '{result}'")
        print(f"Match: {text.lower() == result.lower()}")

# ── 13. Summary for Node.js implementation ──
print("\n" + "=" * 80)
print("13. SUMMARY FOR NODE.JS IMPLEMENTATION")
print("=" * 80)

print("""
PREPROCESSING PIPELINE:
1. Read image bytes
2. Convert to grayscale (single channel)
3. Resize: height=64, width=proportional (maintain aspect ratio)
4. Convert to float32 numpy array
5. Normalize: (pixel / 255.0 - 0.5) / 0.5
   - This maps [0, 255] -> [-1.0, 1.0]
6. Reshape to [1, 1, 64, width] (NCHW format)

INFERENCE:
- Input: float32 tensor [1, 1, 64, W]
- Output: float32 tensor [1, T, C]
  - T = number of time steps (depends on width)
  - C = charset size + 1 (index 0 = CTC blank)

POSTPROCESSING (CTC DECODE):
1. For each time step, get argmax index
2. Remove consecutive duplicates
3. Remove blank tokens (index 0)
4. Map remaining indices to characters using charset

CHARACTER MAPPING:
- Index 0 = CTC blank (no character)
- Index 1+ = charset characters
""")

print(f"Model file: {os.path.join(output_dir, 'ddddocr.onnx')}")
print(f"Charset file: {os.path.join(output_dir, 'ddddocr_charset.json')}")
print(f"Charset size: {len(charset_data) if charset_data else 'UNKNOWN'}")

print("\nDone!")
