/**
 * Beyanname Sorgulama Hook
 * ========================
 * WebSocket üzerinden Electron Bot'tan gelen beyanname sorgulama
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

export interface BeyannameItem {
  turKodu: string;
  turAdi: string;
  donem: string;
  donemFormatli: string;
  versiyon: string;
  kaynak: string;
  aciklama: string;
  beyoid: string;
}

/** Çoklu yıl sorgu ilerleme durumu */
export interface MultiQueryProgress {
  isMultiYear: boolean;
  currentChunk: number;
  totalChunks: number;
  currentYear: string;
  completedYears: { year: string; count: number }[];
}

interface BeyannameQueryState {
  beyannameler: BeyannameItem[];
  isLoading: boolean;
  progress: {
    status: string;
    customerName?: string;
  };
  error: string | null;
  errorCode: string | null;
  queryDone: boolean;
  isFromArchive: boolean;
  pdfLoading: string | null; // beyoid of currently loading PDF
  multiQueryProgress: MultiQueryProgress | null;
}

export interface UseBeyannameQueryReturn extends BeyannameQueryState {
  startQuery: (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => Promise<void>;
  clearResults: () => void;
  viewPdf: (customerId: string, beyoid: string, turAdi: string) => Promise<void>;
  showArchiveData: (data: unknown[]) => void;
  multiQueryProgress: MultiQueryProgress | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { beyannameler: BeyannameItem[] } }
  | { type: "COMPLETE"; payload: { totalCount: number; customerName?: string } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" }
  | { type: "SHOW_ARCHIVE"; payload: { beyannameler: BeyannameItem[] } }
  | { type: "PDF_LOADING"; payload: { beyoid: string } }
  | { type: "PDF_DONE" }
  | { type: "MULTI_PROGRESS"; payload: { chunkIndex: number; totalChunks: number; year: string; status: string } }
  | { type: "MULTI_CHUNK_RESULTS"; payload: { chunkIndex: number; totalChunks: number; year: string; beyannameler: BeyannameItem[] } }
  | { type: "MULTI_COMPLETE"; payload: { totalCount: number } };

const initialState: BeyannameQueryState = {
  beyannameler: [],
  isLoading: false,
  progress: { status: "" },
  error: null,
  errorCode: null,
  queryDone: false,
  isFromArchive: false,
  pdfLoading: null,
  multiQueryProgress: null,
};

function reducer(state: BeyannameQueryState, action: Action): BeyannameQueryState {
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
        beyannameler: action.payload.beyannameler,
        isFromArchive: false,
      };

    case "SHOW_ARCHIVE":
      return {
        ...initialState,
        beyannameler: action.payload.beyannameler,
        queryDone: true,
        isFromArchive: true,
      };

    case "COMPLETE":
      return {
        ...state,
        isLoading: false,
        queryDone: true,
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

    case "PDF_LOADING":
      return { ...state, pdfLoading: action.payload.beyoid };

    case "PDF_DONE":
      return { ...state, pdfLoading: null };

    case "MULTI_PROGRESS":
      return {
        ...state,
        progress: {
          status: action.payload.status,
          customerName: state.progress.customerName,
        },
        multiQueryProgress: {
          isMultiYear: true,
          currentChunk: action.payload.chunkIndex,
          totalChunks: action.payload.totalChunks,
          currentYear: action.payload.year,
          completedYears: state.multiQueryProgress?.completedYears || [],
        },
      };

    case "MULTI_CHUNK_RESULTS":
      return {
        ...state,
        // Beyannameleri biriktir (append)
        beyannameler: [...state.beyannameler, ...action.payload.beyannameler],
        isFromArchive: false,
        multiQueryProgress: state.multiQueryProgress
          ? {
              ...state.multiQueryProgress,
              completedYears: [
                ...state.multiQueryProgress.completedYears,
                { year: action.payload.year, count: action.payload.beyannameler.length },
              ],
            }
          : null,
      };

    case "MULTI_COMPLETE":
      return {
        ...state,
        isLoading: false,
        queryDone: true,
        progress: { status: "Çoklu yıl sorgulaması tamamlandı", customerName: state.progress.customerName },
        multiQueryProgress: state.multiQueryProgress
          ? { ...state.multiQueryProgress, currentChunk: state.multiQueryProgress.totalChunks }
          : null,
      };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

// Beyanname dönem'inden ay/yıl çıkar
function parseBeyannamePeriod(donem: string): { basAy: number; basYil: number } | null {
  if (!donem) return null;
  if (donem.length === 12) {
    return {
      basYil: parseInt(donem.substring(0, 4), 10),
      basAy: parseInt(donem.substring(4, 6), 10),
    };
  }
  if (donem.length === 6) {
    return {
      basYil: parseInt(donem.substring(0, 4), 10),
      basAy: parseInt(donem.substring(4, 6), 10),
    };
  }
  return null;
}

export function useBeyannameQuery(): UseBeyannameQueryReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingQueryRef = useRef<{
    customerId: string;
    basAy: string;
    basYil: string;
    bitAy: string;
    bitYil: string;
    beyannameler: BeyannameItem[];
  } | null>(null);

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
          console.log("[BEYANNAME-WS] Bağlantı kuruldu");
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
              case "intvrg:beyanname-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    customerName: data.customerName,
                  },
                });
                break;

              case "intvrg:beyanname-results":
                if (data.beyannameler && Array.isArray(data.beyannameler)) {
                  dispatch({
                    type: "RESULTS",
                    payload: {
                      beyannameler: data.beyannameler,
                    },
                  });
                  // Arşivleme için biriktir
                  if (pendingQueryRef.current) {
                    pendingQueryRef.current.beyannameler = data.beyannameler;
                  }
                }
                break;

              case "intvrg:beyanname-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    totalCount: data.totalCount || 0,
                    customerName: data.customerName,
                  },
                });

                toast.success(
                  `${data.customerName || "Mükellef"} için ${data.totalCount || 0} beyanname bulundu`
                );

                // Otomatik arşivleme
                if (pendingQueryRef.current) {
                  const pq = pendingQueryRef.current;
                  if (pq.beyannameler.length > 0) {
                    const byMonth = new Map<string, BeyannameItem[]>();
                    for (const b of pq.beyannameler) {
                      const parsed = parseBeyannamePeriod(b.donem);
                      if (parsed) {
                        const key = `${parsed.basYil}-${String(parsed.basAy).padStart(2, "0")}`;
                        if (!byMonth.has(key)) byMonth.set(key, []);
                        byMonth.get(key)!.push(b);
                      }
                    }

                    for (const [key, items] of byMonth) {
                      const [yilStr, ayStr] = key.split("-");
                      fetch("/api/query-archives", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          customerId: pq.customerId,
                          queryType: "beyanname",
                          month: parseInt(ayStr, 10),
                          year: parseInt(yilStr, 10),
                          newResults: items,
                          queryParams: {
                            basAy: pq.basAy,
                            basYil: pq.basYil,
                            bitAy: pq.bitAy,
                            bitYil: pq.bitYil,
                          },
                          dedupKey: ["beyoid"],
                          meta: { totalCount: items.length },
                        }),
                      })
                        .then((r) => (r.ok ? r.json() : null))
                        .then((result) => {
                          if (result)
                            console.log(
                              `[BEYANNAME] Arşivlendi (${ayStr}/${yilStr}): ${result.action}`
                            );
                        })
                        .catch(() => {});
                    }
                  }
                  pendingQueryRef.current = null;
                }
                break;

              // Çoklu yıl event'leri
              case "intvrg:beyanname-multi-progress":
                dispatch({
                  type: "MULTI_PROGRESS",
                  payload: {
                    chunkIndex: data.chunkIndex ?? 0,
                    totalChunks: data.totalChunks ?? 1,
                    year: data.year || "",
                    status: data.status || "",
                  },
                });
                break;

              case "intvrg:beyanname-multi-chunk-results":
                if (data.beyannameler && Array.isArray(data.beyannameler)) {
                  dispatch({
                    type: "MULTI_CHUNK_RESULTS",
                    payload: {
                      chunkIndex: data.chunkIndex ?? 0,
                      totalChunks: data.totalChunks ?? 1,
                      year: data.year || "",
                      beyannameler: data.beyannameler,
                    },
                  });
                  // Arşivleme için biriktir
                  if (pendingQueryRef.current) {
                    pendingQueryRef.current.beyannameler = [
                      ...pendingQueryRef.current.beyannameler,
                      ...data.beyannameler,
                    ];
                  }
                }
                break;

              case "intvrg:beyanname-multi-complete":
                dispatch({
                  type: "MULTI_COMPLETE",
                  payload: {
                    totalCount: data.totalCount || 0,
                  },
                });

                toast.success(
                  `${data.customerName || "Mükellef"} için ${data.totalCount || 0} beyanname bulundu (çoklu yıl)`
                );

                // Otomatik arşivleme (çoklu yıl — tüm sonuçlar)
                if (pendingQueryRef.current) {
                  const pq = pendingQueryRef.current;
                  if (pq.beyannameler.length > 0) {
                    const byMonth = new Map<string, BeyannameItem[]>();
                    for (const b of pq.beyannameler) {
                      const parsed = parseBeyannamePeriod(b.donem);
                      if (parsed) {
                        const key = `${parsed.basYil}-${String(parsed.basAy).padStart(2, "0")}`;
                        if (!byMonth.has(key)) byMonth.set(key, []);
                        byMonth.get(key)!.push(b);
                      }
                    }

                    for (const [key, items] of byMonth) {
                      const [yilStr, ayStr] = key.split("-");
                      fetch("/api/query-archives", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          customerId: pq.customerId,
                          queryType: "beyanname",
                          month: parseInt(ayStr, 10),
                          year: parseInt(yilStr, 10),
                          newResults: items,
                          queryParams: {
                            basAy: pq.basAy,
                            basYil: pq.basYil,
                            bitAy: pq.bitAy,
                            bitYil: pq.bitYil,
                          },
                          dedupKey: ["beyoid"],
                          meta: { totalCount: items.length },
                        }),
                      })
                        .then((r) => (r.ok ? r.json() : null))
                        .then((result) => {
                          if (result)
                            console.log(
                              `[BEYANNAME-MULTI] Arşivlendi (${ayStr}/${yilStr}): ${result.action}`
                            );
                        })
                        .catch(() => {});
                    }
                  }
                  pendingQueryRef.current = null;
                }
                break;

              case "intvrg:beyanname-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                pendingQueryRef.current = null;
                toast.error(data.error || "Beyanname sorgulama hatası");
                break;

              // PDF event'leri
              case "intvrg:beyanname-pdf-result":
                dispatch({ type: "PDF_DONE" });
                if (data.pdfBase64) {
                  // Base64 → Blob → Yeni sekmede aç
                  const byteChars = atob(data.pdfBase64);
                  const byteNumbers = new Array(byteChars.length);
                  for (let i = 0; i < byteChars.length; i++) {
                    byteNumbers[i] = byteChars.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: "application/pdf" });
                  const blobUrl = URL.createObjectURL(blob);
                  window.open(blobUrl, "_blank");
                  // Blob URL'i 5 dakika sonra temizle
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
                  toast.success(`${data.turAdi || "Beyanname"} PDF açıldı`);
                }
                break;

              case "intvrg:beyanname-pdf-error":
                dispatch({ type: "PDF_DONE" });
                toast.error(data.error || "PDF indirilemedi");
                break;
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[BEYANNAME-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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
    async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });
      pendingQueryRef.current = {
        customerId,
        basAy,
        basYil,
        bitAy,
        bitYil,
        beyannameler: [],
      };

      try {
        const response = await fetch("/api/intvrg/beyanname", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, basAy, basYil, bitAy, bitYil }),
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
          toast.error(errorData.error || "Beyanname sorgulaması başlatılamadı");
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

  const showArchiveData = useCallback((data: unknown[]) => {
    dispatch({
      type: "SHOW_ARCHIVE",
      payload: { beyannameler: data as BeyannameItem[] },
    });
  }, []);

  const viewPdf = useCallback(
    async (customerId: string, beyoid: string, turAdi: string) => {
      if (state.pdfLoading) return;

      dispatch({ type: "PDF_LOADING", payload: { beyoid } });

      try {
        const response = await fetch("/api/intvrg/beyanname-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, beyoid, turAdi }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({ type: "PDF_DONE" });

          if (errorData.code === "TOKEN_EXPIRED") {
            toast.error("GİB oturumu süresi dolmuş. Lütfen önce beyanname sorgulaması yapın.");
          } else {
            toast.error(errorData.error || "PDF isteği başarısız");
          }
        }
        // Başarılı ise WS üzerinden PDF gelecek
      } catch {
        dispatch({ type: "PDF_DONE" });
        toast.error("PDF isteği gönderilemedi");
      }
    },
    [state.pdfLoading]
  );

  return {
    ...state,
    startQuery,
    clearResults,
    viewPdf,
    showArchiveData,
  };
}
