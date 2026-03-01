/**
 * 2Captcha Service
 * CAPTCHA çözme servisini yönetir
 */

export async function solveCaptcha(base64Image: string, apiKey: string): Promise<string | null> {
    if (!apiKey) {
        console.log("[CAPTCHA] API key tanımlı değil");
        return null;
    }

    console.log("[CAPTCHA] 2captcha'ya gönderiliyor...");

    try {
        // Base64 prefix'i kaldır (eğer varsa)
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // 1. CAPTCHA'yı gönder
        const submitResponse = await fetch("https://2captcha.com/in.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                key: apiKey,
                method: "base64",
                body: cleanBase64,
                json: "1",
            }),
        });

        const submitResult = await submitResponse.json();

        if (submitResult.status !== 1) {
            console.log(`[CAPTCHA] Gönderme hatası: ${submitResult.request}`);
            return null;
        }

        const captchaId = submitResult.request;
        console.log(`[CAPTCHA] ID: ${captchaId} - Çözülüyor...`);

        // 2. Sonucu bekle (polling) - max 60 saniye
        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise((r) => setTimeout(r, 3000)); // 3 saniye bekle

            const resultResponse = await fetch(
                `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
            );
            const resultData = await resultResponse.json();

            if (resultData.status === 1) {
                console.log(`[CAPTCHA] Çözüldü: ${resultData.request}`);
                return resultData.request;
            }

            if (resultData.request !== "CAPCHA_NOT_READY") {
                console.log(`[CAPTCHA] Çözme hatası: ${resultData.request}`);
                return null;
            }

            console.log(`[CAPTCHA] Bekleniyor... (${attempt + 1}/20)`);
        }

        console.log("[CAPTCHA] Timeout - 60 saniye içinde çözülemedi");
        return null;
    } catch (error) {
        console.log(`[CAPTCHA] Bağlantı hatası: ${(error as Error).message}`);
        return null;
    }
}
