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
  pdfDocumentIds: Record<string, string>;
}

export interface UseSgkQueryReturn extends SgkQueryState {
  startQuery: (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => Promise<void>;
  clearResults: () => void;
  pdfPreview: PdfPreviewInfo | null;
  closePdfPreview: () => void;
  openPdf: (bildirgeRefNo: string, type: "tahakkuk" | "hizmet") => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════

type Action =
  | { type: "QUERY_START" }
  | { type: "PROGRESS"; payload: { status: string; customerName?: string } }
  | { type: "RESULTS"; payload: { bildirgeler: BildirgeItem[]; isyeriInfo: IsyeriInfo | null } }
  | { type: "ERROR"; payload: { error: string; errorCode: string } }
  | { type: "CLEAR" }
  | { type: "PDF_LOADING"; payload: { refNo: string } }
  | { type: "PDF_DONE" }
  | { type: "PIPELINE_PDF_PROGRESS"; payload: { downloadedCount: number; totalCount: number; fileCategory: string; bildirgeRefNo: string } }
  | { type: "PIPELINE_COMPLETE"; payload: { totalDownloaded: number; totalFailed: number; totalSkipped: number } }
  | { type: "STREAM_SAVE_RESULT"; payload: { bildirgeRefNo: string; fileCategory?: string; documentId?: string; saved?: boolean; skipped?: boolean; success?: boolean } }
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
  pdfDocumentIds: {},
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
      const newDocIds = { ...state.pdfDocumentIds };

      if (action.payload.saved || action.payload.success) {
        sp.saved++;
        newDownloaded.push(action.payload.bildirgeRefNo);
        if (action.payload.documentId && action.payload.fileCategory) {
          newDocIds[`${action.payload.bildirgeRefNo}_${action.payload.fileCategory}`] = action.payload.documentId;
        }
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
        pdfDocumentIds: newDocIds,
      };
    }

    case "ALL_SAVES_COMPLETE": {
      const sp = state.saveProgress;
      return {
        ...state,
        isPipelineActive: false,
        isLoading: false,
        queryDone: true,
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

  // Pipeline state refs
  const pipelineCompleteRef = useRef(false);

  // Bildirge listesi ref (WS handler'dan erişim için)
  const bildirgeRef = useRef<BildirgeItem[]>([]);
  const pdfCountRef = useRef(0);

  // Bulk save: PDF'leri kısa debounce ile toplayıp toplu gönder
  interface PdfSaveItem {
    pdfBase64: string;
    bildirgeRefNo: string;
    belgeTuru: string;
    belgeMahiyeti: string;
    hizmetDonem: string;
    fileCategory: string;
  }
  const pdfBufferRef = useRef<PdfSaveItem[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBulkSavesRef = useRef(0);

  // PDF dialog state
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewInfo | null>(null);

  // Pipeline + tüm save'ler bittiyse final dispatch
  const checkAllDone = useCallback(() => {
    if (pipelineCompleteRef.current && activeBulkSavesRef.current <= 0 && pdfBufferRef.current.length === 0) {
      dispatch({ type: "ALL_SAVES_COMPLETE" });
    }
  }, []);

  // Bulk save gönder — fire-and-forget
  const fireBulkSave = useCallback(
    (customerId: string, batch: PdfSaveItem[]) => {
      if (batch.length === 0) return;
      activeBulkSavesRef.current++;

      fetch("/api/sgk/ebildirge-bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, items: batch }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.results && Array.isArray(data.results)) {
            for (const result of data.results) {
              dispatch({
                type: "STREAM_SAVE_RESULT",
                payload: {
                  bildirgeRefNo: result.bildirgeRefNo,
                  fileCategory: result.fileCategory,
                  documentId: result.documentId,
                  saved: result.success && !result.skipped,
                  skipped: result.skipped,
                },
              });
            }
          }
        })
        .catch(() => {
          for (const item of batch) {
            dispatch({
              type: "STREAM_SAVE_RESULT",
              payload: { bildirgeRefNo: item.bildirgeRefNo, fileCategory: item.fileCategory },
            });
          }
        })
        .finally(() => {
          activeBulkSavesRef.current--;
          checkAllDone();
        });
    },
    [checkAllDone]
  );

  // PDF geldiğinde buffer'a ekle, 150ms debounce ile toplu gönder
  const FLUSH_DEBOUNCE = 150;

  const bufferPdf = useCallback(
    (customerId: string, item: PdfSaveItem) => {
      pdfBufferRef.current.push(item);

      // Debounce: 150ms içinde yeni PDF gelirse timer sıfırlanır, gelmezse flush
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (pdfBufferRef.current.length > 0) {
          const batch = pdfBufferRef.current.splice(0);
          fireBulkSave(customerId, batch);
        }
      }, FLUSH_DEBOUNCE);
    },
    [fireBulkSave]
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
                  bildirgeRef.current = data.bildirgeler;
                  dispatch({
                    type: "RESULTS",
                    payload: {
                      bildirgeler: data.bildirgeler,
                      isyeriInfo: data.isyeriInfo || null,
                    },
                  });
                }
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
                // Electron bot'tan gelen alanlar: bildirgeRefNo, tip, donem, pdfBase64, fileName, success
                const fileCategory = data.tip === "tahakkuk" ? "SGK_TAHAKKUK" : "HIZMET_LISTESI";
                const bildirge = bildirgeRef.current.find(
                  (b: BildirgeItem) => b.bildirgeRefNo === data.bildirgeRefNo
                );

                // PDF sayacını artır
                pdfCountRef.current++;
                const totalPdfCount = bildirgeRef.current.reduce((count: number, b: BildirgeItem) => {
                  if (b.hasTahakkukPdf) count++;
                  if (b.hasHizmetPdf) count++;
                  return count;
                }, 0);

                // Progress güncelle
                dispatch({
                  type: "PIPELINE_PDF_PROGRESS",
                  payload: {
                    downloadedCount: pdfCountRef.current,
                    totalCount: totalPdfCount,
                    fileCategory,
                    bildirgeRefNo: data.bildirgeRefNo || "",
                  },
                });

                // PDF buffer'a ekle — 150ms debounce ile toplu kaydedilecek
                const customerId = pendingQueryRef.current?.customerId || "";
                if (data.pdfBase64 && customerId) {
                  bufferPdf(customerId, {
                    pdfBase64: data.pdfBase64,
                    bildirgeRefNo: data.bildirgeRefNo || "",
                    belgeTuru: bildirge?.belgeTuru || "",
                    belgeMahiyeti: bildirge?.belgeMahiyeti || "",
                    hizmetDonem: data.donem || "",
                    fileCategory,
                  });
                }
                break;
              }

              case "sgk:ebildirge-pdf-skip":
                console.log(`[SGK-PDF] Atlandı: ${data.bildirgeRefNo} (${data.tip}) — ${data.reason || data.error || "bilinmeyen neden"}`);
                break;

              case "sgk:ebildirge-pipeline-complete": {
                // Electron bot'tan gelen alanlar: success, totalBildirgeler, totalPdfs, downloadedPdfs, failedPdfs
                dispatch({
                  type: "PIPELINE_COMPLETE",
                  payload: {
                    totalDownloaded: data.downloadedPdfs || 0,
                    totalFailed: data.failedPdfs || 0,
                    totalSkipped: 0,
                  },
                });

                pipelineCompleteRef.current = true;

                // Kalan buffer'ı hemen flush et (debounce beklemeden)
                if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
                const cId = pendingQueryRef.current?.customerId || "";
                if (pdfBufferRef.current.length > 0) {
                  const batch = pdfBufferRef.current.splice(0);
                  fireBulkSave(cId, batch);
                }

                // Tüm save'ler bittiyse hemen tamamla
                if (activeBulkSavesRef.current <= 0) {
                  dispatch({ type: "ALL_SAVES_COMPLETE" });
                  pendingQueryRef.current = null;
                  const downloaded = data.downloadedPdfs || 0;
                  const msg = downloaded > 0
                    ? `${downloaded} SGK PDF'i kaydedildi`
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
  }, [bufferPdf, fireBulkSave]);

  const startQuery = useCallback(
    async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => {
      if (state.isLoading) return;

      dispatch({ type: "QUERY_START" });
      pendingQueryRef.current = { customerId };
      pipelineCompleteRef.current = false;
      activeBulkSavesRef.current = 0;
      pdfBufferRef.current = [];
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      pdfCountRef.current = 0;
      bildirgeRef.current = [];

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

  const openPdf = useCallback(
    (bildirgeRefNo: string, type: "tahakkuk" | "hizmet") => {
      const fileCategory = type === "tahakkuk" ? "SGK_TAHAKKUK" : "HIZMET_LISTESI";
      const key = `${bildirgeRefNo}_${fileCategory}`;
      const documentId = state.pdfDocumentIds[key];

      if (documentId) {
        window.open(`/api/files/view?id=${documentId}`, "_blank");
      } else {
        toast.error("PDF henüz kaydedilmedi veya bulunamadı");
      }
    },
    [state.pdfDocumentIds]
  );

  return {
    ...state,
    startQuery,
    clearResults,
    pdfPreview,
    closePdfPreview,
    openPdf,
  };
}
