"use client";

/**
 * Vergi Levhası Sorgulama Hook
 * =============================
 * WebSocket üzerinden Electron Bot'a vergi levhası sorgulama komutu gönderir,
 * ilerleme ve sonuçları dinler, başarılı sonuçları API'ye kaydeder.
 */

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MukellefResult {
  customerId: string;
  success: boolean;
  onayKodu?: string;
  onayZamani?: string;
  vergiTuru?: string;
  vergiDairesi?: string;
  unvan?: string;
  pdfBase64?: string;
  error?: string;
  alreadyExists?: boolean;
}

export type QueryStage = "idle" | "querying" | "complete" | "error";

interface VergiLevhasiQueryState {
  stage: QueryStage;
  progress: {
    current: number;
    total: number;
    status: string;
    currentCustomerId?: string;
  };
  results: MukellefResult[];
  error?: string;
  errorCode?: string;
}

type Action =
  | { type: "QUERY_START"; payload: { total: number } }
  | { type: "PROGRESS"; payload: { current: number; total: number; status: string; currentCustomerId?: string } }
  | { type: "RESULT"; payload: MukellefResult }
  | { type: "COMPLETE" }
  | { type: "ERROR"; payload: { error: string; errorCode?: string } }
  | { type: "RESET" };

const initialState: VergiLevhasiQueryState = {
  stage: "idle",
  progress: { current: 0, total: 0, status: "" },
  results: [],
};

function reducer(state: VergiLevhasiQueryState, action: Action): VergiLevhasiQueryState {
  switch (action.type) {
    case "QUERY_START":
      return {
        ...initialState,
        stage: "querying",
        progress: { current: 0, total: action.payload.total, status: "Başlatılıyor..." },
      };
    case "PROGRESS":
      return {
        ...state,
        progress: action.payload,
      };
    case "RESULT":
      return {
        ...state,
        results: [...state.results, action.payload],
      };
    case "COMPLETE":
      return {
        ...state,
        stage: "complete",
      };
    case "ERROR":
      return {
        ...state,
        stage: "error",
        error: action.payload.error,
        errorCode: action.payload.errorCode,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

export interface UseVergiLevhasiQueryReturn extends VergiLevhasiQueryState {
  startQuery: (mukellefler: Array<{ customerId: string; vknTckn: string; tcKimlikNo: string | null; unvan: string; sirketTipi: string }>) => void;
  reset: () => void;
}

export function useVergiLevhasiQuery(): UseVergiLevhasiQueryReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<MukellefResult[]>([]);
  const isSavingRef = useRef(false);

  // Biriken sonuçları toplu kaydet (batch API)
  const flushSaveQueue = useCallback(async () => {
    if (isSavingRef.current || saveQueueRef.current.length === 0) return;
    isSavingRef.current = true;

    const items = saveQueueRef.current.splice(0);
    console.log(`[VERGI-LEVHASI] ${items.length} sonuç toplu kaydediliyor...`);

    try {
      const res = await fetch("/api/intvrg/vergi-levhasi/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((r) => ({
            customerId: r.customerId,
            onayKodu: r.onayKodu,
            onayZamani: r.onayZamani,
            vergiTuru: r.vergiTuru,
            vergiDairesi: r.vergiDairesi,
            unvan: r.unvan,
            pdfBase64: r.pdfBase64,
          })),
        }),
      });

      if (!res.ok) {
        console.error("[VERGI-LEVHASI] Batch kayıt hatası:", res.status);
      } else {
        const data = await res.json();
        console.log(`[VERGI-LEVHASI] Batch kayıt tamamlandı: ${data.saved} kaydedildi, ${data.skipped} atlandı`);
      }
    } catch (err) {
      console.error("[VERGI-LEVHASI] Batch kayıt hatası:", err);
    }

    isSavingRef.current = false;
  }, []);

  // WebSocket bağlantısı
  useEffect(() => {
    let mounted = true;

    const connectWS = async () => {
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (!tokenRes.ok) {
          reconnectTimerRef.current = setTimeout(connectWS, 5000);
          return;
        }
        const tokenData = await tokenRes.json();
        const token = tokenData.token;
        userIdRef.current = tokenData.userId || null;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || "3001";
        const wsHost = `${window.location.hostname}:${wsPort}`;
        const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[VERGI-LEVHASI-WS] Bağlantı kuruldu");
        };

        ws.onmessage = (event) => {
          if (!mounted) return;

          try {
            const message = JSON.parse(event.data);
            const data = message.data;

            // requesterId kontrolü
            if (data?.requesterId && userIdRef.current && data.requesterId !== userIdRef.current) {
              return;
            }

            switch (message.type) {
              case "intvrg:vergi-levhasi-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    current: data.current || 0,
                    total: data.total || 0,
                    status: data.status || "",
                    currentCustomerId: data.customerId,
                  },
                });
                break;

              case "intvrg:vergi-levhasi-result": {
                const result: MukellefResult = {
                  customerId: data.customerId,
                  success: data.success,
                  onayKodu: data.onayKodu,
                  onayZamani: data.onayZamani,
                  vergiTuru: data.vergiTuru,
                  vergiDairesi: data.vergiDairesi,
                  unvan: data.unvan,
                  pdfBase64: data.pdfBase64,
                  error: data.error,
                  alreadyExists: data.alreadyExists,
                };
                dispatch({ type: "RESULT", payload: result });

                // Başarılıysa kayıt kuyruğuna ekle (complete'te toplu gönderilecek)
                if (result.success && result.pdfBase64) {
                  saveQueueRef.current.push(result);
                }
                break;
              }

              case "intvrg:vergi-levhasi-complete": {
                dispatch({ type: "COMPLETE" });
                const successful = data.totalDownloaded || 0;
                const failed = data.totalFailed || 0;

                // Biriken sonuçları toplu kaydet
                if (saveQueueRef.current.length > 0) {
                  flushSaveQueue();
                }

                if (failed > 0) {
                  toast.success(`Sorgulama tamamlandı: ${successful} başarılı, ${failed} başarısız`);
                } else {
                  toast.success(`${successful} mükellefin vergi levhası indirildi`);
                }
                break;
              }

              case "intvrg:vergi-levhasi-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode,
                  },
                });
                toast.error(data.error || "Vergi levhası sorgulama hatası");
                break;
            }
          } catch (err) {
            console.error("[VERGI-LEVHASI-WS] Mesaj parse hatası:", err);
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[VERGI-LEVHASI-WS] Bağlantı kapandı, yeniden bağlanılıyor...");
            reconnectTimerRef.current = setTimeout(connectWS, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (mounted) {
          reconnectTimerRef.current = setTimeout(connectWS, 5000);
        }
      }
    };

    connectWS();

    return () => {
      mounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [flushSaveQueue]);

  // Sorgulama başlat
  const startQuery = useCallback(
    (mukellefler: Array<{ customerId: string; vknTckn: string; tcKimlikNo: string | null; unvan: string; sirketTipi: string }>) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error("Bot bağlantısı kurulamadı. Electron Bot'un çalıştığından emin olun.");
        return;
      }

      dispatch({ type: "QUERY_START", payload: { total: mukellefler.length } });

      // GİB ayarlarını al ve komutu gönder
      fetch("/api/settings/gib")
        .then((res) => res.json())
        .then((settings) => {
          if (!settings.gibCode || !settings.gibPassword) {
            dispatch({
              type: "ERROR",
              payload: {
                error: "Mali müşavir GİB bilgileri ayarlardan bulunamadı. Lütfen Ayarlar sayfasından GİB bilgilerinizi girin.",
                errorCode: "NO_CREDENTIALS",
              },
            });
            toast.error("GİB bilgileri eksik. Ayarlar sayfasından girin.");
            return;
          }

          ws.send(
            JSON.stringify({
              type: "intvrg:vergi-levhasi-query",
              data: {
                userid: settings.gibCode,
                password: settings.gibPassword,
                captchaApiKey: settings.captchaKey || "",
                ocrSpaceApiKey: settings.ocrSpaceKey || undefined,
                mukellefler,
                userId: userIdRef.current,
              },
            })
          );
        })
        .catch((err) => {
          dispatch({
            type: "ERROR",
            payload: { error: "GİB ayarları alınamadı: " + err.message },
          });
        });
    },
    []
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    saveQueueRef.current = [];
  }, []);

  return {
    ...state,
    startQuery,
    reset,
  };
}
