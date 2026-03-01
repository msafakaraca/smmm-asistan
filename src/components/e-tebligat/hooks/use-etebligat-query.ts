/**
 * E-Tebligat Sorgulama Hook
 * ==========================
 * WebSocket üzerinden Electron Bot'tan gelen e-Tebligat sorgulama
 * sonuçlarını dinler ve state yönetir.
 *
 * Özellikler:
 * - useReducer ile rapid WS mesaj güvenliği
 * - tebligId bazlı deduplication
 * - requesterId bazlı mesaj filtreleme
 * - Zarf detay + PDF desteği
 */

"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TebligatItem {
  kurumKodu: string;
  kurumAciklama: string;
  belgeTuru: string;
  belgeTuruAciklama: string;
  belgeNo: string;
  kayitZamani: string;
  tebligZamani: string;
  mukellefOkumaZamani: string | null;
  gonderimZamani: string;
  gerceklesenOtomatikOkunmaZamani: string | null;
  dizin: string;
  tebligId: string;
  tebligSecureId: string;
  tarafId: string;
  tarafSecureId: string;
  altKurum: string | null;
}

interface TebligatSayilari {
  okunmus: number;
  okunmamis: number;
  arsivlenmis: number;
}

interface EtebligatState {
  tebligatlar: TebligatItem[];
  isLoading: boolean;
  progress: {
    status: string;
    customerName?: string;
  };
  error: string | null;
  errorCode: string | null;
  totalCount: number;
  aktivasyon: boolean;
  sayilar: TebligatSayilari | null;
  zarfLoading: string | null; // tarafId
  pdfLoading: string | null; // tebligId
}

export interface UseEtebligatQueryReturn extends EtebligatState {
  startQuery: (customerId: string) => Promise<void>;
  openZarf: (customerId: string, tarafId: string, tarafSecureId: string) => Promise<void>;
  viewPdf: (customerId: string, tebligId: string, tebligSecureId: string, tarafId: string, tarafSecureId: string) => Promise<void>;
  clearResults: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { tebligatlar: TebligatItem[] } }
  | { type: "COMPLETE"; payload: { totalCount: number; sayilar: TebligatSayilari | null; aktivasyon: boolean; error?: string } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" }
  | { type: "ZARF_DETAY_START"; payload: { tarafId: string } }
  | { type: "ZARF_DETAY_RESULT"; payload: { tarafId: string } }
  | { type: "ZARF_DETAY_ERROR"; payload: { error: string } }
  | { type: "PDF_START"; payload: { tebligId: string } }
  | { type: "PDF_RESULT"; payload: { tebligId: string; pdfBase64: string } }
  | { type: "PDF_ERROR"; payload: { error: string } };

const initialState: EtebligatState = {
  tebligatlar: [],
  isLoading: false,
  progress: { status: "" },
  error: null,
  errorCode: null,
  totalCount: 0,
  aktivasyon: true,
  sayilar: null,
  zarfLoading: null,
  pdfLoading: null,
};

function reducer(state: EtebligatState, action: Action): EtebligatState {
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

    case "RESULTS": {
      // Dedup — tebligId bazlı
      const existingIds = new Set(state.tebligatlar.map((t) => t.tebligId));
      const newItems = action.payload.tebligatlar.filter(
        (t) => !existingIds.has(t.tebligId)
      );
      if (newItems.length === 0) return state;

      return {
        ...state,
        tebligatlar: state.tebligatlar.concat(newItems),
        totalCount: state.totalCount + newItems.length,
      };
    }

    case "COMPLETE":
      return {
        ...state,
        isLoading: false,
        totalCount: action.payload.totalCount,
        sayilar: action.payload.sayilar,
        aktivasyon: action.payload.aktivasyon,
        error: action.payload.error || null,
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

    case "ZARF_DETAY_START":
      return { ...state, zarfLoading: action.payload.tarafId };

    case "ZARF_DETAY_RESULT": {
      // Okundu işaretle — ilgili tebligatın mukellefOkumaZamani'nı güncelle
      const now = new Date().toISOString();
      return {
        ...state,
        zarfLoading: null,
        tebligatlar: state.tebligatlar.map((t) =>
          t.tarafId === action.payload.tarafId
            ? { ...t, mukellefOkumaZamani: now }
            : t
        ),
      };
    }

    case "ZARF_DETAY_ERROR":
      return { ...state, zarfLoading: null };

    case "PDF_START":
      return { ...state, pdfLoading: action.payload.tebligId };

    case "PDF_RESULT": {
      // PDF geldi — blob URL oluştur ve aç
      try {
        const byteChars = atob(action.payload.pdfBase64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        // 5dk sonra cleanup
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      } catch {
        toast.error("PDF görüntülenemedi");
      }
      return { ...state, pdfLoading: null };
    }

    case "PDF_ERROR":
      return { ...state, pdfLoading: null };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

export function useEtebligatQuery(): UseEtebligatQueryReturn {
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
          console.log("[ETEBLIGAT-WS] Bağlantı kuruldu");
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
              case "etebligat:query-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    customerName: data.customerName,
                  },
                });
                break;

              case "etebligat:query-results":
                if (data.tebligatlar && Array.isArray(data.tebligatlar)) {
                  dispatch({
                    type: "RESULTS",
                    payload: { tebligatlar: data.tebligatlar },
                  });
                }
                break;

              case "etebligat:query-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    totalCount: data.totalCount || 0,
                    sayilar: data.sayilar || null,
                    aktivasyon: data.aktivasyon !== false,
                    error: data.error,
                  },
                });

                if (data.error) {
                  toast.warning(data.error);
                } else {
                  toast.success(
                    `${data.customerName || "Mükellef"} için ${data.totalCount} tebligat bulundu`
                  );
                }
                break;

              case "etebligat:query-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                toast.error(data.error || "E-Tebligat sorgulama hatası");
                break;

              case "etebligat:zarf-detay-result":
                dispatch({
                  type: "ZARF_DETAY_RESULT",
                  payload: { tarafId: data.tarafId },
                });
                toast.success("Zarf açıldı — tebligat okundu olarak işaretlendi");
                break;

              case "etebligat:zarf-detay-error":
                dispatch({
                  type: "ZARF_DETAY_ERROR",
                  payload: { error: data.error || "Zarf açılamadı" },
                });
                toast.error(data.error || "Zarf açılamadı");
                break;

              case "etebligat:pdf-result":
                dispatch({
                  type: "PDF_RESULT",
                  payload: {
                    tebligId: data.tebligId,
                    pdfBase64: data.pdfBase64,
                  },
                });
                break;

              case "etebligat:pdf-error":
                dispatch({
                  type: "PDF_ERROR",
                  payload: { error: data.error || "PDF indirilemedi" },
                });
                toast.error(data.error || "PDF indirilemedi");
                break;
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[ETEBLIGAT-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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
    async (customerId: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });

      try {
        const response = await fetch("/api/etebligat/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId }),
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
          toast.error(errorData.error || "E-Tebligat sorgulama başlatılamadı");
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

  // Zarf aç (OKUNDU İŞARETLER!)
  const openZarf = useCallback(
    async (customerId: string, tarafId: string, tarafSecureId: string) => {
      if (state.zarfLoading) return;

      dispatch({ type: "ZARF_DETAY_START", payload: { tarafId } });

      try {
        const response = await fetch("/api/etebligat/zarf-detay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, tarafId, tarafSecureId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({ type: "ZARF_DETAY_ERROR", payload: { error: errorData.error } });
          toast.error(errorData.error || "Zarf açılamadı");
        }
      } catch {
        dispatch({ type: "ZARF_DETAY_ERROR", payload: { error: "Sunucuya bağlanılamadı" } });
        toast.error("Sunucuya bağlanılamadı");
      }
    },
    [state.zarfLoading]
  );

  // PDF görüntüle
  const viewPdf = useCallback(
    async (customerId: string, tebligId: string, tebligSecureId: string, tarafId: string, tarafSecureId: string) => {
      if (state.pdfLoading) return;

      dispatch({ type: "PDF_START", payload: { tebligId } });

      try {
        const response = await fetch("/api/etebligat/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, tebligId, tebligSecureId, tarafId, tarafSecureId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({ type: "PDF_ERROR", payload: { error: errorData.error } });
          toast.error(errorData.error || "PDF indirilemedi");
        }
      } catch {
        dispatch({ type: "PDF_ERROR", payload: { error: "Sunucuya bağlanılamadı" } });
        toast.error("Sunucuya bağlanılamadı");
      }
    },
    [state.pdfLoading]
  );

  const clearResults = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return {
    ...state,
    startQuery,
    openZarf,
    viewPdf,
    clearResults,
  };
}
