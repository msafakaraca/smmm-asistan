/**
 * POS Bilgileri Sorgulama Hook
 * ============================
 * WebSocket üzerinden Electron Bot'tan gelen POS sorgulama
 * sonuçlarını dinler ve state yönetir.
 *
 * Pattern: use-tahsilat-query.ts
 */

"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PosBilgisi {
  pos_banka_adi: string;
  pos_banka_vkn: string;
  pos_uye_isy: string;
  toplam: string;
}

export interface PosMeta {
  toplamGenel: string;
  posListeSize: number;
  ay: string;
  yil: string;
}

interface PosQueryState {
  posBilgileri: PosBilgisi[];
  meta: PosMeta | null;
  isLoading: boolean;
  progress: {
    status: string;
    customerName?: string;
  };
  error: string | null;
  errorCode: string | null;
}

export interface UsePosQueryReturn extends PosQueryState {
  startQuery: (customerId: string, ay: string, yil: string) => Promise<void>;
  clearResults: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { posBilgileri: PosBilgisi[]; meta: PosMeta } }
  | { type: "COMPLETE"; payload: { totalCount: number; toplamGenel: string; customerName?: string } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" };

const initialState: PosQueryState = {
  posBilgileri: [],
  meta: null,
  isLoading: false,
  progress: { status: "" },
  error: null,
  errorCode: null,
};

function reducer(state: PosQueryState, action: Action): PosQueryState {
  switch (action.type) {
    case "QUERY_START":
      return {
        ...initialState,
        isLoading: true,
        progress: { status: "Sorgulama başlatılıyor..." },
      };

    case "PROGRESS":
      return {
        ...state,
        progress: {
          status: action.payload.status,
          customerName: action.payload.customerName || state.progress.customerName,
        },
      };

    case "RESULTS":
      return {
        ...state,
        posBilgileri: action.payload.posBilgileri,
        meta: action.payload.meta,
      };

    case "COMPLETE":
      return {
        ...state,
        isLoading: false,
        progress: { status: "Sorgulama tamamlandı", customerName: state.progress.customerName },
      };

    case "ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        errorCode: action.payload.errorCode,
        progress: { status: "" },
      };

    case "CLEAR":
      return initialState;

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

export function usePosQuery(): UsePosQueryReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // WebSocket bağlantısı ve event dinleme
  useEffect(() => {
    let mounted = true;

    const connectWS = async () => {
      try {
        // Token al
        const tokenRes = await fetch("/api/auth/token");
        if (!tokenRes.ok) {
          reconnectTimerRef.current = setTimeout(connectWS, 5000);
          return;
        }
        const tokenData = await tokenRes.json();
        const token = tokenData.token;
        userIdRef.current = tokenData.userId || null;

        // WS bağlantısı
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || "3001";
        const wsHost = `${window.location.hostname}:${wsPort}`;
        const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[POS-WS] Bağlantı kuruldu");
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
              case "intvrg:pos-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    customerName: data.customerName,
                  },
                });
                break;

              case "intvrg:pos-results":
                if (data.posBilgileri && Array.isArray(data.posBilgileri)) {
                  dispatch({
                    type: "RESULTS",
                    payload: {
                      posBilgileri: data.posBilgileri,
                      meta: data.meta || {},
                    },
                  });
                }
                break;

              case "intvrg:pos-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    totalCount: data.totalCount || 0,
                    toplamGenel: data.toplamGenel || "0",
                    customerName: data.customerName,
                  },
                });

                if (data.totalCount > 0) {
                  toast.success(
                    `${data.customerName || "Mükellef"} için ${data.totalCount} POS kaydı bulundu`
                  );
                } else {
                  toast.info(
                    `${data.customerName || "Mükellef"} için POS kaydı bulunamadı`
                  );
                }
                break;

              case "intvrg:pos-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                toast.error(data.error || "POS sorgulama hatası");
                break;
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[POS-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  // Çift tıklama koruması — isLoading true ise return
  const startQuery = useCallback(
    async (customerId: string, ay: string, yil: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });

      try {
        const response = await fetch("/api/intvrg/pos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, ay, yil }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({
            type: "ERROR",
            payload: {
              error: errorData.error || `HTTP ${response.status}`,
              errorCode: errorData.code || "API_ERROR",
            },
          });
          toast.error(errorData.error || "POS sorgulaması başlatılamadı");
        }
        // Başarılı ise WS üzerinden sonuçlar gelecek
      } catch {
        dispatch({
          type: "ERROR",
          payload: {
            error: "Sunucuya bağlanılamadı. Lütfen tekrar deneyin.",
            errorCode: "NETWORK_ERROR",
          },
        });
        toast.error("Sunucuya bağlanılamadı");
      }
    },
    [state.isLoading]
  );

  const clearResults = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return {
    ...state,
    startQuery,
    clearResults,
  };
}
