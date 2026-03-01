/**
 * E-Defter Kontrol Hook
 * ======================
 * WebSocket üzerinden Electron Bot'tan gelen E-Defter paket kontrol
 * sonuçlarını dinler ve state yönetir.
 *
 * Referans: use-etebligat-query.ts pattern'i
 */

"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface EdefterPaket {
  oid: string;
  paketId: string;
  islemOid: string;
  belgeTuru: string;
  alinmaZamani: string;
  durumKodu: number;
  durumAciklama: string;
  dfsPath: string;
  gibDfsPath: string;
}

export interface EdefterAySonuc {
  donem: string;
  ay: number;
  yil: number;
  paketler: EdefterPaket[];
  kbYuklendi: boolean;
  ybYuklendi: boolean;
  yYuklendi: boolean;
  tamam: boolean;
  yuklemeTarihi: string | null;
}

interface EdefterState {
  aylar: EdefterAySonuc[];
  isLoading: boolean;
  progress: {
    status: string;
    customerName?: string;
  };
  error: string | null;
  errorCode: string | null;
  tamamlanan: number;
  eksik: number;
  kismenEksik: number;
}

export interface UseEdefterQueryReturn extends EdefterState {
  startQuery: (customerId: string, yil: number, basAy: number, bitAy: number) => Promise<void>;
  clearResults: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { aylar: EdefterAySonuc[] } }
  | { type: "COMPLETE"; payload: { aylar: EdefterAySonuc[]; tamamlanan: number; eksik: number; kismenEksik: number } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" };

const initialState: EdefterState = {
  aylar: [],
  isLoading: false,
  progress: { status: "" },
  error: null,
  errorCode: null,
  tamamlanan: 0,
  eksik: 0,
  kismenEksik: 0,
};

function reducer(state: EdefterState, action: Action): EdefterState {
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
        aylar: action.payload.aylar,
      };

    case "COMPLETE": {
      return {
        ...state,
        isLoading: false,
        aylar: action.payload.aylar,
        tamamlanan: action.payload.tamamlanan,
        eksik: action.payload.eksik,
        kismenEksik: action.payload.kismenEksik,
        progress: { status: "Sorgulama tamamlandı", customerName: state.progress.customerName },
      };
    }

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

export function useEdefterQuery(): UseEdefterQueryReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  // WebSocket bağlantısı ve event dinleme
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
          console.log("[EDEFTER-WS] Bağlantı kuruldu");
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
              case "edefter:query-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    customerName: data.customerName,
                  },
                });
                break;

              case "edefter:query-results":
                if (data.aylar && Array.isArray(data.aylar)) {
                  dispatch({
                    type: "RESULTS",
                    payload: { aylar: data.aylar },
                  });
                }
                break;

              case "edefter:query-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    aylar: data.aylar || [],
                    tamamlanan: data.tamamlanan || 0,
                    eksik: data.eksik || 0,
                    kismenEksik: data.kismenEksik || 0,
                  },
                });

                toast.success(
                  `${data.customerName || "Mükellef"}: ${data.tamamlanan} ay tamam, ${data.eksik} ay eksik`
                );
                break;

              case "edefter:query-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                toast.error(data.error || "E-Defter sorgulama hatası");
                break;
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[EDEFTER-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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

  // Sorgulama başlat
  const startQuery = useCallback(
    async (customerId: string, yil: number, basAy: number, bitAy: number) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });

      try {
        const response = await fetch("/api/edefter/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, yil, basAy, bitAy }),
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
          toast.error(errorData.error || "E-Defter sorgulama başlatılamadı");
        }
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
