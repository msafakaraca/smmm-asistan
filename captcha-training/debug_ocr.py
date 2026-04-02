"""OCR.space debug — GİB captcha'larını test et."""
import base64
import requests
import sys
from pathlib import Path

RAW_DIR = Path(__file__).parent / "data" / "raw"

def test_ocrspace(img_path: str, api_key: str):
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    for engine in ["2", "1"]:
        params = {
            "apikey": api_key,
            "base64Image": f"data:image/png;base64,{b64}",
            "OCREngine": engine,
            "isOverlayRequired": "false",
            "language": "eng",
        }
        if engine == "2":
            params["isTable"] = "false"
        else:
            params["scale"] = "true"

        resp = requests.post("https://api.ocr.space/parse/image", data=params, timeout=15)
        result = resp.json()

        parsed = (result.get("ParsedResults") or [{}])[0].get("ParsedText", "")
        error = result.get("IsErroredOnProcessing", False)
        err_msg = result.get("ErrorMessage", [])

        print(f"Engine {engine}: parsed='{parsed.strip()}' error={error} err_msg={err_msg}")
        print(f"  Full ParsedResults: {result.get('ParsedResults', [])}")
        print()

if __name__ == "__main__":
    api_key = sys.argv[1] if len(sys.argv) > 1 else "K84584114188957"

    # İlk 3 captcha'yı test et
    files = sorted(RAW_DIR.glob("*.png"))[:3]
    for f in files:
        print(f"=== {f.name} ===")
        test_ocrspace(str(f), api_key)
