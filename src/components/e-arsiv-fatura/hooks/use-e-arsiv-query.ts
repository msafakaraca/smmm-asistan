/**
 * E-Arşiv Fatura Sorgulama Hook
 * ==============================
 * WebSocket üzerinden Electron Bot'tan gelen e-Arşiv fatura sorgulama
 * sonuçlarını dinler ve state yönetir.
 *
 * Özellikler:
 * - useReducer ile rapid WS mesaj güvenliği (F5)
 * - faturaNo+tcknVkn+tarih bazlı deduplication (F28)
 * - requesterId bazlı mesaj filtreleme (PM-3)
 * - Partial failure tracking (F3)
 * - Çift tıklama koruması (F8)
 */

"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface EarsivFatura {
  unvan: string;
  tcknVkn: string;
  faturaNo: string;
  duzenlenmeTarihi: string;
  toplamTutar: number;
  odenecekTutar: string;
  vergilerTutari: number;
  paraBirimi: string;
  tesisatNumarasi: string;
  gonderimSekli: string;
  iptalItirazDurum: string | null;
  iptalItirazTarihi: string | null;
  mukellefTckn: string;
  mukellefVkn: string;
}

interface EarsivQueryState {
  invoices: EarsivFatura[];
  isLoading: boolean;
  progress: {
    status: string;
    phase: "login" | "query" | "idle";
    customerName?: string;
  };
  error: string | null;
  errorCode: string | null;
  totalCount: number;
  completedChunks: string[];
  failedChunks: string[];
}

export interface UseEarsivQueryReturn extends EarsivQueryState {
  isPartialResult: boolean;
  startQuery: (customerId: string, startDate: string, endDate: string) => Promise<void>;
  clearResults: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; phase: string; customerName?: string } }
  | { type: "RESULTS"; payload: { invoices: EarsivFatura[] } }
  | { type: "COMPLETE"; payload: { totalCount: number; completedChunks: string[]; failedChunks: string[]; customerName?: string } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" };

const initialState: EarsivQueryState = {
  invoices: [],
  isLoading: false,
  progress: { status: "", phase: "idle" },
  error: null,
  errorCode: null,
  totalCount: 0,
  completedChunks: [],
  failedChunks: [],
};

/** Composite dedup key — faturaNo + tcknVkn + tarih (F28) */
function getInvoiceKey(inv: EarsivFatura): string {
  return `${inv.faturaNo}-${inv.tcknVkn}-${inv.duzenlenmeTarihi}`;
}

function reducer(state: EarsivQueryState, action: Action): EarsivQueryState {
  switch (action.type) {
    case "QUERY_START":
      return {
        ...initialState,
        isLoading: true,
        progress: { status: "Sorgulama başlatılıyor...", phase: "login" },
      };

    case "PROGRESS":
      return {
        ...state,
        progress: {
          status: action.payload.status,
          phase: (action.payload.phase as "login" | "query" | "idle") || state.progress.phase,
          customerName: action.payload.customerName || state.progress.customerName,
        },
      };

    case "RESULTS": {
      // Deduplication: mevcut fatura key'leri + yeni faturalar
      const existingKeys = new Set(state.invoices.map(getInvoiceKey));
      const newInvoices = action.payload.invoices.filter(
        (inv) => !existingKeys.has(getInvoiceKey(inv))
      );

      if (newInvoices.length === 0) return state;

      // PM-6: concat kullan, spread yerine (memory pressure azaltma)
      return {
        ...state,
        invoices: state.invoices.concat(newInvoices),
        totalCount: state.totalCount + newInvoices.length,
      };
    }

    case "COMPLETE":
      return {
        ...state,
        isLoading: false,
        totalCount: action.payload.totalCount,
        completedChunks: action.payload.completedChunks,
        failedChunks: action.payload.failedChunks,
        progress: { status: "Sorgulama tamamlandı", phase: "idle", customerName: state.progress.customerName },
      };

    case "ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        errorCode: action.payload.errorCode,
        progress: { status: "", phase: "idle" },
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

export function useEarsivQuery(): UseEarsivQueryReturn {
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
          console.log("[E-ARSIV-WS] Bağlantı kuruldu");
        };

        ws.onmessage = (event) => {
          if (!mounted) return;

          try {
            const message = JSON.parse(event.data);
            const data = message.data;

            // PM-3: requesterId kontrolü — farklı kullanıcının sonuçlarını filtrele
            if (data?.requesterId && userIdRef.current && data.requesterId !== userIdRef.current) {
              return;
            }

            switch (message.type) {
              case "earsiv:query-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    phase: data.phase || "query",
                    customerName: data.customerName,
                  },
                });
                break;

              case "earsiv:query-results":
                if (data.invoices && Array.isArray(data.invoices)) {
                  dispatch({
                    type: "RESULTS",
                    payload: { invoices: data.invoices },
                  });
                }
                break;

              case "earsiv:query-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    totalCount: data.totalCount || 0,
                    completedChunks: data.completedChunks || [],
                    failedChunks: data.failedChunks || [],
                    customerName: data.customerName,
                  },
                });

                // UF-5: Toast bildirimi
                if (data.failedChunks?.some((c: string) => c.includes("tdvd.auth.servis.yetki.hata"))) {
                  toast.error(
                    `${data.customerName || "Mükellef"} için GİB'de telefon güncelleme gerekli`
                  );
                } else if (data.failedChunks?.length > 0) {
                  toast.warning(
                    `${data.customerName || "Mükellef"} için ${data.totalCount} fatura bulundu (bazı tarihler sorgulanamadı)`
                  );
                } else {
                  toast.success(
                    `${data.customerName || "Mükellef"} için ${data.totalCount} fatura bulundu`
                  );
                }
                break;

              case "earsiv:query-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                toast.error(data.error || "E-Arşiv sorgulama hatası");
                break;
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[E-ARSIV-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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

  // F8: Çift tıklama koruması — isLoading true ise return
  const startQuery = useCallback(
    async (customerId: string, startDate: string, endDate: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });

      try {
        const response = await fetch("/api/earsiv/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, startDate, endDate }),
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
          toast.error(errorData.error || "E-Arşiv sorgulama başlatılamadı");
        }
        // Başarılı ise WS üzerinden sonuçlar gelecek
      } catch (e) {
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
    isPartialResult: state.failedChunks.length > 0,
    startQuery,
    clearResults,
  };
}
