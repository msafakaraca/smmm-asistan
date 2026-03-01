---
description: Global Terminal kullanarak herhangi bir işleme canlı log ekranı ekleme
---

# Global Terminal Kullanım Rehberi

Bu projede tüm bot ve uzun süren işlemler için merkezi bir terminal sistemi bulunmaktadır. Herhangi bir component'e terminal eklemek için aşağıdaki adımları takip edin.

## 1. Hook'u Import Et

```tsx
import { useTerminal } from "@/context/terminal-context";
```

## 2. Component İçinde Kullan

```tsx
export function MyComponent() {
    const terminal = useTerminal();
    
    const handleMyOperation = async () => {
        // Terminali başlat (başlık ver)
        terminal.showTerminal("İşlem Adı Terminal");
        
        try {
            // Log ekle (mesaj, yüzde)
            terminal.addLog("🚀 İşlem başlatılıyor...", 0);
            
            // İşlemlerini yap...
            await someAsyncOperation();
            
            terminal.addLog("📦 Veriler yükleniyor...", 25);
            terminal.setProgress(50);
            
            // Daha fazla işlem...
            await anotherOperation();
            
            terminal.addLog("💾 Kaydediliyor...", 75);
            
            // Tamamlandı
            terminal.addLog("✅ İşlem tamamlandı!", 100);
            terminal.setLoading(false);
            terminal.autoClose(3000); // 3 saniye sonra kapan
            
        } catch (error) {
            terminal.addLog(`❌ Hata: ${error.message}`, 100);
            terminal.setLoading(false);
            terminal.autoClose(5000); // Hata durumunda 5 saniye bekle
        }
    };
    
    return <button onClick={handleMyOperation}>İşlemi Başlat</button>;
}
```

## 3. SSE (Server-Sent Events) ile Gerçek Zamanlı Loglar

Backend'den canlı log akışı için API endpoint'ini SSE destekleyecek şekilde yaz:

### Backend API (route.ts):
```typescript
export async function POST(request: Request) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };
            
            try {
                send({ percent: 0, message: "🚀 İşlem başlatılıyor..." });
                
                // İşlemleri yap ve her adımda log gönder
                await step1();
                send({ percent: 25, message: "📦 Adım 1 tamamlandı" });
                
                await step2();
                send({ percent: 50, message: "🔄 Adım 2 tamamlandı" });
                
                await step3();
                send({ percent: 75, message: "💾 Adım 3 tamamlandı" });
                
                // Tamamlandı
                send({ 
                    complete: true, 
                    stats: { total: 100, duration: 5 }
                });
                
                controller.close();
            } catch (error) {
                send({ error: error.message });
                controller.close();
            }
        }
    });
    
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
```

### Frontend SSE Dinleyici:
```tsx
const handleSync = async () => {
    terminal.showTerminal("İşlem Terminal");
    
    try {
        const response = await fetch("/api/my-endpoint", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            body: JSON.stringify({ /* data */ }),
        });
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";
            
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.error) {
                        terminal.addLog(`❌ Hata: ${data.error}`, 100);
                        terminal.setLoading(false);
                        terminal.autoClose(5000);
                        return;
                    } else if (data.complete) {
                        terminal.addLog("✅ Tamamlandı!", 100);
                        terminal.setLoading(false);
                        terminal.autoClose(3000);
                    } else {
                        terminal.addLog(data.message, data.percent);
                        terminal.setProgress(data.percent);
                    }
                }
            }
        }
    } catch (error) {
        terminal.addLog(`❌ Hata: ${error.message}`, 100);
        terminal.setLoading(false);
        terminal.autoClose(5000);
    }
};
```

## 4. Terminal Metodları Referansı

| Metod | Açıklama | Örnek |
|-------|----------|-------|
| `showTerminal(title)` | Terminali açar ve başlık verir | `terminal.showTerminal("GİB Bot")` |
| `hideTerminal()` | Terminali hemen kapatır | `terminal.hideTerminal()` |
| `addLog(message, percent?)` | Log satırı ekler | `terminal.addLog("İşlem yapılıyor...", 50)` |
| `setProgress(percent)` | İlerleme çubuğunu günceller | `terminal.setProgress(75)` |
| `setLoading(boolean)` | Yükleme animasyonunu kontrol eder | `terminal.setLoading(false)` |
| `autoClose(ms)` | Belirli süre sonra otomatik kapatır | `terminal.autoClose(3000)` |
| `reset()` | Tüm state'i sıfırlar | `terminal.reset()` |
| `state` | Mevcut terminal durumunu okur | `terminal.state.progress` |

## 5. Emoji Referansı

```
🚀 Başlatma
📦 Yükleme/Paketleme
💾 Kaydetme
🔄 Senkronizasyon
🔐 Giriş/Auth
📊 İstatistik
✅ Başarı
❌ Hata
⚠️ Uyarı
🎉 Tamamlandı
📅 Tarih
📄 Sayfa
🔍 Arama
