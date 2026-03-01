/**
 * useBotConnection Hook
 *
 * GIB Bot işlemlerini yönetir: başlatma, durdurma ve SSE stream okuma.
 * WebSocket bağlantısı GlobalBotListener tarafından merkezi olarak yönetilir.
 * Bu hook yalnızca API çağrıları ve local state yönetimi için kullanılır.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useBotResult } from "@/context/bot-result-context";
import { useBotLog } from "@/context/bot-log-context";
import type { BeyannameData, SyncStatus } from "../types";
import type { GibBotResult } from "@/types/gib";

interface UseBotConnectionOptions {
  onComplete?: (data: GibBotResult) => void;
  onError?: (error: string, errorCode?: string) => void;
  onBeyannamelerUpdate?: (beyannameler: BeyannameData[]) => void;
  onUnmatchedUpdate?: (unmatched: BeyannameData[]) => void;
}

export function useBotConnection(options: UseBotConnectionOptions = {}) {
  const { setPendingResult, pendingResult } = useBotResult();
  const { addLog, setLiveMessage, clearLogs, setBotRunning, setBotStatus, botStatus, stopBot: stopBotContext } = useBotLog();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [beyannameler, setBeyannameler] = useState<BeyannameData[]>([]);
  const [unmatchedDeclarations, setUnmatchedDeclarations] = useState<
    BeyannameData[]
  >([]);
  // Delegated modda olup olmadığımızı takip et
  const isDelegatedRef = useRef(false);

  // Callback'leri ref ile stabilize et (her render'da yeni obje oluşmasını engelle)
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // botStatus context değişimini izle - delegated modda syncStatus'ü güncelle
  // GlobalBotListener bot:complete mesajını aldığında botStatus'ü günceller
  useEffect(() => {
    if (!isDelegatedRef.current) return;

    if (botStatus === 'completed') {
      setSyncStatus("success");

      // Pending result varsa onComplete callback'ini çağır
      if (pendingResult) {
        if (pendingResult.beyannameler) {
          setBeyannameler(pendingResult.beyannameler as BeyannameData[]);
          optionsRef.current.onBeyannamelerUpdate?.(pendingResult.beyannameler as BeyannameData[]);
        }
        if (pendingResult.unmatchedBeyannameler) {
          setUnmatchedDeclarations(pendingResult.unmatchedBeyannameler as BeyannameData[]);
          optionsRef.current.onUnmatchedUpdate?.(pendingResult.unmatchedBeyannameler as BeyannameData[]);
        }
        optionsRef.current.onComplete?.(pendingResult);
      }

      isDelegatedRef.current = false;
    } else if (botStatus === 'error') {
      setSyncStatus("error");
      isDelegatedRef.current = false;
    } else if (botStatus === 'idle' && syncStatus === 'running') {
      // Bot durduruldu (stopBot çağrıldı)
      setSyncStatus("idle");
      isDelegatedRef.current = false;
    }
  }, [botStatus, pendingResult, syncStatus]);

  // Bot'u durdur - API üzerinden stop komutu gönder
  const stopBot = useCallback(async () => {
    try {
      // Stop API çağrısı yap
      const response = await fetch('/api/gib/stop', { method: 'POST' });
      if (response.ok) {
        console.log('[BOT] Stop command sent via API');
      }
    } catch (e) {
      console.error('[BOT] Stop API error:', e);
    }

    // UI state'lerini sıfırla
    setSyncStatus("idle");
    setBeyannameler([]);
    setUnmatchedDeclarations([]);
    isDelegatedRef.current = false;
    stopBotContext();
  }, [stopBotContext]);

  // Bot'u başlat
  const startBot = useCallback(
    async (params: {
      startDate: string;
      endDate: string;
      donemBasAy?: number;
      donemBasYil?: number;
      donemBitAy?: number;
      donemBitYil?: number;
      downloadFiles?: boolean;
      vergiNo?: string;
      tcKimlikNo?: string;
      beyannameTuru?: string;
    }) => {
      setSyncStatus("running");
      setBeyannameler([]);
      setUnmatchedDeclarations([]);

      // Önceki logları temizle ve yeni bot oturumunu başlat
      clearLogs();
      setBotRunning(true);

      try {
        const res = await fetch("/api/gib/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Bot başlatılamadı");
        }

        // SSE stream okuma
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream okunamadı");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE eventlerini parse et
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.percent !== undefined) {
                  // Bot log paneline detaylı yaz
                  let logType: 'progress' | 'success' = 'progress';
                  const logMessage = data.message || '';

                  // Başarı mesajları
                  if (logMessage.includes('Başarılı') || logMessage.includes('✅')) {
                    logType = 'success';
                  }

                  addLog(logType, logMessage, undefined, data.percent);
                }

                if (data.delegated) {
                  // Bot Electron'a devredildi, WS'den dinlemeye devam
                  isDelegatedRef.current = true;
                  return;
                }

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.complete) {
                  if (data.beyannameler) {
                    setBeyannameler(data.beyannameler);
                    optionsRef.current.onBeyannamelerUpdate?.(data.beyannameler);
                  }

                  if (data.unmatchedBeyannameler) {
                    setUnmatchedDeclarations(data.unmatchedBeyannameler);
                    optionsRef.current.onUnmatchedUpdate?.(data.unmatchedBeyannameler);
                  }

                  setSyncStatus("success");

                  const reportData = {
                    ...data,
                    success: true,
                  } as GibBotResult;

                  // Cross-page persistence için sonucu sakla
                  setPendingResult(reportData);
                  optionsRef.current.onComplete?.(reportData);

                  // Bot log paneline tamamlanma mesajı
                  const totalCount = (data.beyannameler?.length || 0) + (data.unmatchedBeyannameler?.length || 0);
                  addLog('success', `Bot tamamlandı — **${totalCount}** beyanname işlendi`, undefined, 100);
                  setBotRunning(false);
                  setBotStatus('completed');
                  return;
                }
              } catch (e) {
                console.error("SSE parse error:", e);
              }
            }
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Bilinmeyen hata";
        setSyncStatus("error");
        optionsRef.current.onError?.(errorMsg, 'UNKNOWN');

        // Bot log paneline hata mesajı
        addLog('error', `Hata: ${errorMsg}`);
        setBotRunning(false);
        setBotStatus('error');
      }
    },
    [setPendingResult, addLog, setLiveMessage, clearLogs, setBotRunning, setBotStatus]
  );

  return {
    syncStatus,
    setSyncStatus,
    beyannameler,
    unmatchedDeclarations,
    startBot,
    stopBot,
  };
}
