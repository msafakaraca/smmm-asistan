"""
ddddocr model extraction v2 - focused on charset extraction and correct inference.
"""
import os
import sys
import json
import shutil
import numpy as np
from PIL import Image
import io
import onnxruntime as ort

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── 1. Extract charset from ddddocr ──
print("=" * 80)
print("1. EXTRACTING CHARSET FROM DDDDOCR")
print("=" * 80)

import ddddocr

# Create OCR instance with old=True (default model is common_old.onnx)
ocr = ddddocr.DdddOcr(show_ad=False, old=True)

# Access charset via ocr_engine -> charset_manager
engine = ocr.ocr_engine
charset_manager = engine.charset_manager
charset = charset_manager.get_charset()

print(f"Charset length: {len(charset)}")
print(f"First 30 chars: {charset[:30]}")
print(f"Index 0 (blank): '{charset[0]}'")
print(f"Index 1: '{charset[1]}'")

# Find common ASCII characters in charset
ascii_chars = {}
for i, c in enumerate(charset):
    if c.isascii() and c.isalnum():
        ascii_chars[c] = i

print(f"\nASCII alphanumeric chars found: {len(ascii_chars)}")
# Sort and show
for c in sorted(ascii_chars.keys()):
    print(f"  '{c}' -> index {ascii_chars[c]}")

# ── 2. Engine configuration ──
print("\n" + "=" * 80)
print("2. ENGINE CONFIGURATION")
print("=" * 80)
print(f"word: {engine.word}")
print(f"resize: {engine.resize}")
print(f"channel: {engine.channel}")
print(f"old: {engine.old}")
print(f"beta: {engine.beta}")

# ── 3. Model I/O details ──
print("\n" + "=" * 80)
print("3. MODEL I/O DETAILS")
print("=" * 80)

sess = engine.session
for inp in sess.get_inputs():
    print(f"Input: name='{inp.name}', shape={inp.shape}, type={inp.type}")
for out in sess.get_outputs():
    print(f"Output: name='{out.name}', shape={out.shape}, type={out.type}")

# ── 4. Trace preprocessing step by step ──
print("\n" + "=" * 80)
print("4. TRACING PREPROCESSING STEP BY STEP")
print("=" * 80)

test_img_path = r"C:\Users\msafa\Desktop\Projeler\SMMM Asistan Güncel\captcha-training\data\ddddocr_test\01_kwm2b_639f92e9.png"
with open(test_img_path, 'rb') as f:
    img_bytes = f.read()

# Step 1: Load image
img = Image.open(io.BytesIO(img_bytes))
print(f"Step 1 - Original: size={img.size} (WxH), mode={img.mode}")

# Step 2: Resize (height=64, width proportional)
target_height = 64
target_width = int(img.size[0] * (target_height / img.size[1]))
img_resized = img.resize((target_width, target_height), Image.LANCZOS)
print(f"Step 2 - Resize to height=64: new size={img_resized.size}")

# Step 3: Convert to grayscale
img_gray = img_resized.convert('L')
print(f"Step 3 - Grayscale: size={img_gray.size}, mode={img_gray.mode}")

# Step 4: To numpy float32
img_array = np.array(img_gray).astype(np.float32)
print(f"Step 4 - To numpy: shape={img_array.shape}, dtype={img_array.dtype}")
print(f"         Value range: [{img_array.min()}, {img_array.max()}]")

# Step 5: Normalize to [0,1]
img_norm = img_array / 255.0
print(f"Step 5 - Normalize /255: range=[{img_norm.min():.4f}, {img_norm.max():.4f}]")

# Step 6: Add channel dim (H,W) -> (1,H,W)
img_ch = np.expand_dims(img_norm, axis=0)
print(f"Step 6 - Add channel dim: shape={img_ch.shape}")

# Step 7: Add batch dim -> (1,1,H,W)
img_batch = np.expand_dims(img_ch, axis=0)
print(f"Step 7 - Add batch dim: shape={img_batch.shape}")

# ── 5. Run inference with our manual preprocessing ──
print("\n" + "=" * 80)
print("5. INFERENCE WITH MANUAL PREPROCESSING")
print("=" * 80)

input_name = sess.get_inputs()[0].name
outputs = sess.run(None, {input_name: img_batch})
raw = outputs[0]
print(f"Raw output shape: {raw.shape}")
print(f"Raw output dtype: {raw.dtype}")

# The output is (seq_len, 1, num_classes) - i.e. (T, batch, C)
# Not (batch, T, C)!
print(f"\nOutput layout: (seq_len={raw.shape[0]}, batch={raw.shape[1]}, num_classes={raw.shape[2]})")

# CTC decode
predicted_indices = np.argmax(raw[:, 0, :], axis=1)
print(f"Argmax indices per timestep: {predicted_indices.tolist()}")

# Remove blanks and consecutive duplicates
decoded = []
prev = None
for idx in predicted_indices:
    idx = int(idx)
    if idx != prev:
        if idx != 0:
            decoded.append(idx)
    prev = idx

print(f"After CTC decode: {decoded}")
text = ''.join([charset[i] for i in decoded])
print(f"Decoded text: '{text}'")

# ── 6. Verify with ddddocr's own result ──
print("\n" + "=" * 80)
print("6. VERIFICATION WITH DDDDOCR")
print("=" * 80)

ddddocr_result = ocr.classification(img_bytes)
print(f"ddddocr result: '{ddddocr_result}'")
print(f"Our result:     '{text}'")
print(f"Match: {ddddocr_result == text}")

# ── 7. Check if normalization matters ──
# The source code says img / 255.0 NOT (img / 255.0 - 0.5) / 0.5
# Let's verify by trying the alternative
print("\n" + "=" * 80)
print("7. NORMALIZATION COMPARISON")
print("=" * 80)

# Method A: Just /255.0 (what the source code says)
img_a = img_array / 255.0
img_a = np.expand_dims(np.expand_dims(img_a, 0), 0)
out_a = sess.run(None, {input_name: img_a})[0]
pred_a = np.argmax(out_a[:, 0, :], axis=1)
decoded_a = []
prev = None
for idx in pred_a:
    idx = int(idx)
    if idx != prev and idx != 0:
        decoded_a.append(idx)
    prev = idx
text_a = ''.join([charset[i] for i in decoded_a])
print(f"Method A (/255.0):                       '{text_a}'")

# Method B: (x/255.0 - 0.5) / 0.5
img_b = (img_array / 255.0 - 0.5) / 0.5
img_b = np.expand_dims(np.expand_dims(img_b, 0), 0)
out_b = sess.run(None, {input_name: img_b})[0]
pred_b = np.argmax(out_b[:, 0, :], axis=1)
decoded_b = []
prev = None
for idx in pred_b:
    idx = int(idx)
    if idx != prev and idx != 0:
        decoded_b.append(idx)
    prev = idx
text_b = ''.join([charset[i] for i in decoded_b])
print(f"Method B ((x/255 - 0.5) / 0.5):         '{text_b}'")

print(f"\nExpected: 'kwm2b'")
print(f"ddddocr:  '{ddddocr_result}'")

# ── 8. Test on multiple images ──
print("\n" + "=" * 80)
print("8. BATCH TEST ON ALL TEST IMAGES")
print("=" * 80)

test_dir = r"C:\Users\msafa\Desktop\Projeler\SMMM Asistan Güncel\captcha-training\data\ddddocr_test"
correct = 0
total = 0
for fname in sorted(os.listdir(test_dir)):
    if not fname.endswith('.png'):
        continue
    # Extract expected from filename like "01_kwm2b_639f92e9.png"
    parts = fname.split('_')
    if len(parts) >= 2:
        expected = parts[1]
    else:
        continue

    fpath = os.path.join(test_dir, fname)
    with open(fpath, 'rb') as f:
        data = f.read()

    result = ocr.classification(data)
    match = result.lower() == expected.lower()
    if match:
        correct += 1
    total += 1

    if not match or total <= 5:
        print(f"  {fname}: expected='{expected}', got='{result}' {'✓' if match else '✗'}")

print(f"\nAccuracy: {correct}/{total} ({100*correct/total:.1f}%)")

# ── 9. Save charset and model ──
print("\n" + "=" * 80)
print("9. SAVING ARTIFACTS")
print("=" * 80)

output_dir = r"C:\Users\msafa\Desktop\Projeler\SMMM Asistan Güncel\electron-bot\models"
os.makedirs(output_dir, exist_ok=True)

# Save charset
charset_path = os.path.join(output_dir, "ddddocr_charset.json")
with open(charset_path, 'w', encoding='utf-8') as f:
    json.dump(charset, f, ensure_ascii=False)
print(f"Charset saved: {charset_path} ({len(charset)} chars)")

# Verify model was already copied
model_path = os.path.join(output_dir, "ddddocr.onnx")
if os.path.exists(model_path):
    print(f"Model already exists: {model_path} ({os.path.getsize(model_path):,} bytes)")
else:
    src_model = os.path.join(os.path.dirname(ddddocr.__file__), 'common_old.onnx')
    shutil.copy2(src_model, model_path)
    print(f"Model copied: {model_path} ({os.path.getsize(model_path):,} bytes)")

# ── 10. FINAL SUMMARY ──
print("\n" + "=" * 80)
print("10. COMPLETE IMPLEMENTATION GUIDE FOR NODE.JS")
print("=" * 80)

print(f"""
=== MODEL ===
File: ddddocr.onnx (common_old.onnx, {os.path.getsize(model_path):,} bytes)
Input:  name='input1', shape=[1, 1, 64, dynamic_width], type=float32
Output: name='387',    shape=[seq_len, 1, {len(charset)}], type=float32

IMPORTANT: Output is (seq_len, batch=1, num_classes), NOT (batch, seq_len, num_classes)!

=== CHARSET ===
File: ddddocr_charset.json
Length: {len(charset)}
Index 0: '' (empty string = CTC blank token)
Index 1+: actual characters

=== PREPROCESSING ===
1. Load image (any format: PNG, JPEG, etc.)
2. Resize to height=64, width proportional (maintain aspect ratio)
   - new_width = Math.round(original_width * (64 / original_height))
   - Use LANCZOS/bicubic resampling
3. Convert to grayscale (single channel)
4. Convert to float32 array
5. Normalize: pixel / 255.0
   - Maps [0, 255] -> [0.0, 1.0]
   - DO NOT use (x - 0.5) / 0.5!
6. Reshape to [1, 1, 64, width] (NCHW: batch, channels, height, width)

=== INFERENCE ===
- Run ONNX model
- Output shape: [T, 1, {len(charset)}]
  where T = seq_len (depends on input width)

=== POSTPROCESSING (CTC DECODE) ===
1. For each timestep t in [0, T):
   - Get argmax of output[t][0] -> predicted_index
2. CTC decode:
   - Skip if predicted_index == previous_index (consecutive duplicate)
   - Skip if predicted_index == 0 (blank token)
   - Otherwise, append charset[predicted_index] to result
3. Join characters -> final text

=== TYPESCRIPT PSEUDOCODE ===

```typescript
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';  // or Jimp

async function recognizeCaptcha(imageBuffer: Buffer): Promise<string> {{
  const charset: string[] = JSON.parse(fs.readFileSync('ddddocr_charset.json', 'utf-8'));

  // 1. Load and preprocess
  const metadata = await sharp(imageBuffer).metadata();
  const targetHeight = 64;
  const targetWidth = Math.round(metadata.width! * (targetHeight / metadata.height!));

  const grayPixels = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, {{ fit: 'fill' }})
    .grayscale()
    .raw()
    .toBuffer();

  // 2. Normalize
  const float32 = new Float32Array(targetHeight * targetWidth);
  for (let i = 0; i < grayPixels.length; i++) {{
    float32[i] = grayPixels[i] / 255.0;
  }}

  // 3. Create tensor [1, 1, 64, width]
  const tensor = new ort.Tensor('float32', float32, [1, 1, targetHeight, targetWidth]);

  // 4. Run inference
  const session = await ort.InferenceSession.create('ddddocr.onnx');
  const results = await session.run({{ input1: tensor }});
  const output = results['387'];

  // 5. CTC decode
  // output.dims = [T, 1, numClasses]
  const T = output.dims[0];
  const numClasses = output.dims[2];
  const data = output.data as Float32Array;

  let result = '';
  let prevIndex = -1;

  for (let t = 0; t < T; t++) {{
    // Find argmax for this timestep
    let maxVal = -Infinity;
    let maxIdx = 0;
    for (let c = 0; c < numClasses; c++) {{
      const val = data[t * numClasses + c];  // output is [T, 1, C], batch=1
      if (val > maxVal) {{
        maxVal = val;
        maxIdx = c;
      }}
    }}

    // CTC decode: skip blanks and consecutive duplicates
    if (maxIdx !== prevIndex) {{
      if (maxIdx !== 0) {{
        result += charset[maxIdx];
      }}
    }}
    prevIndex = maxIdx;
  }}

  return result;
}}
```
""")

print("Done!")
