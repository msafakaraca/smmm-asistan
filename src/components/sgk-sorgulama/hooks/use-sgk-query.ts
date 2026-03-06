/**
 * SGK E-Bildirge Sorgulama Hook
 * ==============================
 * WebSocket üzerinden Electron Bot'tan gelen SGK E-Bildirge
 * sorgulama sonuçlarını dinler ve state yönetir.
 * PDF'ler geldiğinde fire-and-forget stream save ile kaydeder.
 */

"use client";

import { useReducer, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BildirgeItem {
  tahakkukDonem: string;
  hizmetDonem: string;
  belgeTuru: string;
  belgeMahiyeti: string;
  kanunNo: string;
  calisanSayisi: number;
  gunSayisi: number;
  pekTutar: string;
  bildirgeRefNo: string;
  hasTahakkukPdf: boolean;
  hasHizmetPdf: boolean;
}

export interface IsyeriInfo {
  sicilNo: string;
  unvan: string;
  adres: string;
  sgmKodAd: string;
  kanunKapsaminaAlinis: string;
  primOran: string;
  isyeriTipi: string;
}

export interface PdfPreviewInfo {
  blobUrl: string | null;
  title: string;
  donem: string;
  customerName: string;
}

interface SgkQueryState {
  bildirgeler: BildirgeItem[];
  isyeriInfo: IsyeriInfo | null;
  isLoading: boolean;
  progress: { status: string; customerName?: string };
  error: string | null;
  errorCode: string | null;
  queryDone: boolean;
  pdfLoading: string | null;
  saveProgress: { saved: number; skipped: number; failed: number; total: number };
  downloadedRefNos: string[];
  isPipelineActive: boolean;
}

export interface UseSgkQueryReturn extends SgkQueryState {
  startQuery: (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => Promise<void>;
  clearResults: () => void;
  pdfPreview: PdfPreviewInfo | null;
  closePdfPreview: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { bildirgeler: BildirgeItem[]; isyeriInfo: IsyeriInfo | null } }
  | { type: "COMPLETE"; payload: { totalCount: number } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" }
  | { type: "PDF_LOADING"; payload: { refNo: string } }
  | { type: "PDF_DONE" }
  | { type: "PIPELINE_PDF_PROGRESS"; payload: { downloadedCount: number; totalCount: number; fileCategory: string; bildirgeRefNo: string } }
  | { type: "PIPELINE_COMPLETE"; payload: { totalDownloaded: number; totalFailed: number; totalSkipped: number } }
  | { type: "STREAM_SAVE_RESULT"; payload: { bildirgeRefNo: string; saved?: boolean; skipped?: boolean; success?: boolean } }
  | { type: "ALL_SAVES_COMPLETE" };

const initialState: SgkQueryState = {
  bildirgeler: [],
  isyeriInfo: null,
  isLoading: false,
  progress: { status: "" },
  error: null,
  errorCode: null,
  queryDone: false,
  pdfLoading: null,
  saveProgress: { saved: 0, skipped: 0, failed: 0, total: 0 },
  downloadedRefNos: [],
  isPipelineActive: false,
};

function reducer(state: SgkQueryState, action: Action): SgkQueryState {
  switch (action.type) {
    case "QUERY_START":
      return {
        ...initialState,
        isLoading: true,
        progress: { status: "SGK sorgulaması başlatılıyor..." },
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
        bildirgeler: action.payload.bildirgeler,
        isyeriInfo: action.payload.isyeriInfo,
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
      return { ...state, pdfLoading: action.payload.refNo };

    case "PDF_DONE":
      return { ...state, pdfLoading: null };

    case "PIPELINE_PDF_PROGRESS":
      return {
        ...state,
        progress: {
          status: `PDF indiriliyor: ${action.payload.downloadedCount}/${action.payload.totalCount} (${action.payload.fileCategory === "SGK_TAHAKKUK" ? "Tahakkuk" : "Hizmet Listesi"})`,
          customerName: state.progress.customerName,
        },
        saveProgress: {
          ...state.saveProgress,
          total: action.payload.totalCount,
        },
        isPipelineActive: true,
      };

    case "PIPELINE_COMPLETE":
      return {
        ...state,
        progress: {
          status: `PDF indirme tamamlandı: ${action.payload.totalDownloaded} indirildi${action.payload.totalSkipped > 0 ? `, ${action.payload.totalSkipped} atlandı` : ""}${action.payload.totalFailed > 0 ? `, ${action.payload.totalFailed} başarısız` : ""} — Kaydediliyor...`,
          customerName: state.progress.customerName,
        },
      };

    case "STREAM_SAVE_RESULT": {
      const sp = { ...state.saveProgress };
      const newDownloaded = [...state.downloadedRefNos];

      if (action.payload.saved || action.payload.success) {
        sp.saved++;
        newDownloaded.push(action.payload.bildirgeRefNo);
      } else if (action.payload.skipped) {
        sp.skipped++;
        newDownloaded.push(action.payload.bildirgeRefNo);
      } else {
        sp.failed++;
      }

      return {
        ...state,
        saveProgress: sp,
        downloadedRefNos: newDownloaded,
      };
    }

    case "ALL_SAVES_COMPLETE": {
      const sp = state.saveProgress;
      return {
        ...state,
        isPipelineActive: false,
        isLoading: false,
        progress: {
          status: `Tamamlandı: ${sp.saved} PDF kaydedildi${sp.skipped > 0 ? `, ${sp.skipped} atlandı` : ""}${sp.failed > 0 ? `, ${sp.failed} başarısız` : ""}`,
          customerName: state.progress.customerName,
        },
      };
    }

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

export function useSgkQuery(): UseSgkQueryReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingQueryRef = useRef<{ customerId: string } | null>(null);

  // Aktif stream save sayacı
  const activeSavesRef = useRef(0);
  const pipelineCompleteRef = useRef(false);

  // PDF dialog state
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewInfo | null>(null);

  // Pipeline tamamlandığında ve tüm save'ler bittiyse final dispatch
  const checkAllSavesComplete = useCallback(() => {
    if (pipelineCompleteRef.current && activeSavesRef.current <= 0) {
      dispatch({ type: "ALL_SAVES_COMPLETE" });
    }
  }, []);

  // Fire-and-forget stream save
  const streamSavePdf = useCallback(
    (data: {
      customerId: string;
      pdfBase64: string;
      bildirgeRefNo: string;
      belgeTuru: string;
      belgeMahiyeti: string;
      hizmetDonem: string;
      fileCategory: string;
    }) => {
      activeSavesRef.current++;

      fetch("/api/sgk/ebildirge-stream-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((r) => r.json())
        .then((result) => {
          dispatch({
            type: "STREAM_SAVE_RESULT",
            payload: {
              bildirgeRefNo: data.bildirgeRefNo,
              saved: result.success && !result.skipped,
              skipped: result.skipped,
            },
          });
        })
        .catch(() => {
          dispatch({
            type: "STREAM_SAVE_RESULT",
            payload: { bildirgeRefNo: data.bildirgeRefNo },
          });
        })
        .finally(() => {
          activeSavesRef.current--;
          checkAllSavesComplete();
        });
    },
    [checkAllSavesComplete]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

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
          console.log("[SGK-WS] Bağlantı kuruldu");
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
              case "sgk:ebildirge-progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    status: data.status || "",
                    customerName: data.customerName,
                  },
                });
                break;

              case "sgk:ebildirge-results":
                if (data.bildirgeler && Array.isArray(data.bildirgeler)) {
                  dispatch({
                    type: "RESULTS",
                    payload: {
                      bildirgeler: data.bildirgeler,
                      isyeriInfo: data.isyeriInfo || null,
                    },
                  });
                }
                break;

              case "sgk:ebildirge-complete":
                dispatch({
                  type: "COMPLETE",
                  payload: { totalCount: data.totalCount || 0 },
                });
                toast.success(
                  `${data.customerName || "Mükellef"} için ${data.totalCount || 0} bildirge bulundu`
                );
                break;

              case "sgk:ebildirge-error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data.error || "Bilinmeyen hata",
                    errorCode: data.errorCode || "UNKNOWN_ERROR",
                  },
                });
                pendingQueryRef.current = null;
                toast.error(data.error || "SGK sorgulama hatası");
                break;

              case "sgk:ebildirge-pdf-result": {
                // Progress güncelle
                dispatch({
                  type: "PIPELINE_PDF_PROGRESS",
                  payload: {
                    downloadedCount: data.downloadedCount || 0,
                    totalCount: data.totalCount || 0,
                    fileCategory: data.fileCategory || "",
                    bildirgeRefNo: data.bildirgeRefNo || "",
                  },
                });

                // Fire-and-forget stream save
                const customerId = pendingQueryRef.current?.customerId || "";
                if (data.pdfBase64 && customerId) {
                  streamSavePdf({
                    customerId,
                    pdfBase64: data.pdfBase64,
                    bildirgeRefNo: data.bildirgeRefNo || "",
                    belgeTuru: data.belgeTuru || "",
                    belgeMahiyeti: data.belgeMahiyeti || "",
                    hizmetDonem: data.hizmetDonem || "",
                    fileCategory: data.fileCategory || "",
                  });
                }
                break;
              }

              case "sgk:ebildirge-pdf-skip":
                console.log(`[SGK-PDF] Atlandı: ${data.bildirgeRefNo} — ${data.error}`);
                break;

              case "sgk:ebildirge-pipeline-complete": {
                dispatch({
                  type: "PIPELINE_COMPLETE",
                  payload: {
                    totalDownloaded: data.totalDownloaded || 0,
                    totalFailed: data.totalFailed || 0,
                    totalSkipped: data.totalSkipped || 0,
                  },
                });

                pipelineCompleteRef.current = true;
                // Tüm save'ler bittiyse hemen tamamla
                if (activeSavesRef.current <= 0) {
                  dispatch({ type: "ALL_SAVES_COMPLETE" });
                  pendingQueryRef.current = null;
                  const msg = data.totalDownloaded > 0
                    ? `${data.totalDownloaded} SGK PDF'i kaydedildi`
                    : "Tüm SGK PDF'leri zaten mevcut";
                  toast.success(msg);
                }
                break;
              }
            }
          } catch {
            // JSON parse hatası — yoksay
          }
        };

        ws.onclose = () => {
          if (mounted) {
            console.log("[SGK-WS] Bağlantı kapandı, 3s sonra yeniden bağlanılıyor...");
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
  }, [streamSavePdf]);

  const startQuery = useCallback(
    async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });
      pendingQueryRef.current = { customerId };
      pipelineCompleteRef.current = false;
      activeSavesRef.current = 0;

      try {
        const response = await fetch("/api/sgk/ebildirge", {
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
          toast.error(errorData.error || "SGK sorgulaması başlatılamadı");
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

  const closePdfPreview = useCallback(() => {
    if (pdfPreview?.blobUrl) {
      URL.revokeObjectURL(pdfPreview.blobUrl);
    }
    setPdfPreview(null);
  }, [pdfPreview?.blobUrl]);

  return {
    ...state,
    startQuery,
    clearResults,
    pdfPreview,
    closePdfPreview,
  };
}
