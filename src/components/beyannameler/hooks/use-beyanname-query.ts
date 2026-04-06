/**
 * Beyanname Sorgulama Hook — Streaming Pipeline + Ultra-Hızlı Batch Save
 * =======================================================================
 * WebSocket üzerinden Electron Bot'tan gelen beyanname sorgulama
 * sonuçlarını dinler ve state yönetir.
 *
 * Batch Save: PDF'ler geldiğinde buffer'a ekle, 15'lik batch'ler halinde
 * tek HTTP POST ile toplu kaydet. ~10-20x hızlanma.
 */

"use client";

import { useReducer, useCallback, useEffect, useRef, useMemo, useState } from "react";
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
  pdfLoading: string | null;
  multiQueryProgress: MultiQueryProgress | null;
  // Streaming save progress
  saveProgress: {
    saved: number;
    skipped: number;
    failed: number;
    total: number;
  };
  // Pipeline PDF indirme takibi
  downloadedBeyoids: string[];
  isPipelineActive: boolean;
  savesComplete: boolean;
}

/** PDF dialog'da gösterilecek veri */
export interface PdfPreviewInfo {
  blobUrl: string | null;
  turAdi: string;
  donem: string;
  customerName: string;
}

export interface UseBeyannameQueryReturn extends BeyannameQueryState {
  startQuery: (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string, savedBeyoids?: string[]) => Promise<void>;
  clearResults: () => void;
  viewPdf: (customerId: string, beyoid: string, turAdi: string, donem?: string, customerName?: string) => Promise<void>;
  showArchiveData: (data: unknown[]) => void;
  multiQueryProgress: MultiQueryProgress | null;
  pdfPreview: PdfPreviewInfo | null;
  closePdfPreview: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// BatchBuffer — Toplu kaydetme için buffer
// ═══════════════════════════════════════════════════════════════════════════

interface SaveItem {
  customerId: string;
  pdfBase64: string;
  beyoid: string;
  turKodu: string;
  turAdi: string;
  donem: string;
  versiyon: string;
}

class BatchBuffer {
  private buffer: SaveItem[] = [];
  private batchSize: number;
  private flushDelay: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (items: SaveItem[]) => Promise<void>;
  private activeFlushes: Promise<void>[] = [];
  private idleResolvers: (() => void)[] = [];

  constructor(
    batchSize: number,
    flushDelay: number,
    onFlush: (items: SaveItem[]) => Promise<void>
  ) {
    this.batchSize = batchSize;
    this.flushDelay = flushDelay;
    this.onFlush = onFlush;
  }

  add(item: SaveItem) {
    this.buffer.push(item);
    if (this.buffer.length >= this.batchSize) {
      // Batch dolu — hemen flush
      this.cancelTimer();
      this.doFlush();
    } else {
      // Debounce: yeni item gelmezse flush
      this.cancelTimer();
      this.flushTimer = setTimeout(() => this.doFlush(), this.flushDelay);
    }
  }

  /** Pipeline tamamlandığında kalan buffer'ı flush et ve tüm işlemleri bekle */
  async finalize(): Promise<void> {
    this.cancelTimer();
    this.doFlush();
    await Promise.all(this.activeFlushes);
  }

  /** Tüm aktif flush'lar bitince resolve */
  onIdle(): Promise<void> {
    if (this.activeFlushes.length === 0 && this.buffer.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  clear() {
    this.cancelTimer();
    this.buffer = [];
  }

  private cancelTimer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private doFlush() {
    if (this.buffer.length === 0) return;
    const items = this.buffer.splice(0);
    const promise = this.onFlush(items)
      .catch((err) => {
        console.error("[BATCH-BUFFER] Flush hatası:", err);
      })
      .finally(() => {
        this.activeFlushes = this.activeFlushes.filter((p) => p !== promise);
        if (this.activeFlushes.length === 0 && this.buffer.length === 0) {
          for (const resolve of this.idleResolvers) {
            resolve();
          }
          this.idleResolvers = [];
        }
      });
    this.activeFlushes.push(promise);
  }
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
  | { type: "MULTI_COMPLETE"; payload: { totalCount: number } }
  | { type: "PIPELINE_PDF_PROGRESS"; payload: { downloadedCount: number; totalCount: number; turAdi: string; beyoid: string } }
  | { type: "PIPELINE_PDF_SKIP"; payload: { beyoid: string } }
  | { type: "PIPELINE_COMPLETE"; payload: { totalDownloaded: number; totalFailed: number; totalSkipped: number } }
  | { type: "BATCH_SAVE_RESULTS"; payload: { results: Array<{ beyoid: string; saved: boolean; skipped: boolean; failed: boolean }> } }
  | { type: "ALL_SAVES_COMPLETE" };

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
  saveProgress: { saved: 0, skipped: 0, failed: 0, total: 0 },
  downloadedBeyoids: [],
  isPipelineActive: false,
  savesComplete: false,
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

    case "PIPELINE_PDF_PROGRESS":
      return {
        ...state,
        progress: {
          status: `PDF indiriliyor: ${action.payload.downloadedCount}/${action.payload.totalCount} (${action.payload.turAdi})`,
          customerName: state.progress.customerName,
        },
        saveProgress: {
          ...state.saveProgress,
          total: action.payload.totalCount,
        },
        isPipelineActive: true,
      };

    case "PIPELINE_PDF_SKIP":
      return state;

    case "PIPELINE_COMPLETE":
      return {
        ...state,
        progress: {
          status: `PDF indirme tamamlandı: ${action.payload.totalDownloaded} indirildi${action.payload.totalSkipped > 0 ? `, ${action.payload.totalSkipped} atlandı` : ''}${action.payload.totalFailed > 0 ? `, ${action.payload.totalFailed} başarısız` : ''} — Kaydediliyor...`,
          customerName: state.progress.customerName,
        },
      };

    // Toplu kaydetme sonuçları — batch'ten gelen tüm item'lar tek seferde güncellenir
    case "BATCH_SAVE_RESULTS": {
      const sp = { ...state.saveProgress };
      const newDownloadedBeyoids = [...state.downloadedBeyoids];

      for (const r of action.payload.results) {
        if (r.saved) {
          sp.saved++;
          newDownloadedBeyoids.push(r.beyoid);
        } else if (r.skipped) {
          sp.skipped++;
          newDownloadedBeyoids.push(r.beyoid);
        } else if (r.failed) {
          sp.failed++;
        }
      }

      return {
        ...state,
        saveProgress: sp,
        downloadedBeyoids: newDownloadedBeyoids,
      };
    }

    case "ALL_SAVES_COMPLETE": {
      const sp = state.saveProgress;
      return {
        ...state,
        isPipelineActive: false,
        savesComplete: true,
        progress: {
          status: `Tamamlandı: ${sp.saved} PDF kaydedildi${sp.skipped > 0 ? `, ${sp.skipped} atlandı` : ''}${sp.failed > 0 ? `, ${sp.failed} başarısız` : ''}`,
          customerName: state.progress.customerName,
        },
      };
    }

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

/** Base64 → Blob URL */
function createBlobUrl(pdfBase64: string): string {
  const byteChars = atob(pdfBase64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

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

  // Blob URL cache — unmount'ta temizlenir
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // PDF dialog state
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewInfo | null>(null);
  const pdfPreviewMetaRef = useRef<{ turAdi: string; donem: string; customerName: string } | null>(null);

  // PDF loading timeout — WS yanıtı gelmezse 30s sonra otomatik temizle
  const pdfLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Batch save fonksiyonu — useCallback ile stabil referans
  const saveBatch = useCallback(
    async (items: SaveItem[]) => {
      if (items.length === 0) return;
      const customerId = items[0].customerId;

      try {
        const res = await fetch("/api/intvrg/beyanname-bulk-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            items: items.map((i) => ({
              pdfBase64: i.pdfBase64,
              beyoid: i.beyoid,
              turKodu: i.turKodu,
              turAdi: i.turAdi,
              donem: i.donem,
              versiyon: i.versiyon,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.results && Array.isArray(data.results)) {
            dispatch({
              type: "BATCH_SAVE_RESULTS",
              payload: { results: data.results },
            });
          }
        } else {
          // Tüm batch başarısız — her item için failed dispatch
          dispatch({
            type: "BATCH_SAVE_RESULTS",
            payload: {
              results: items.map((i) => ({
                beyoid: i.beyoid,
                saved: false,
                skipped: false,
                failed: true,
              })),
            },
          });
        }
      } catch (err) {
        console.error("[BATCH-SAVE] İstek hatası:", err);
        dispatch({
          type: "BATCH_SAVE_RESULTS",
          payload: {
            results: items.map((i) => ({
              beyoid: i.beyoid,
              saved: false,
              skipped: false,
              failed: true,
            })),
          },
        });
      }
    },
    []
  );

  // BatchBuffer: 15'lik batch, 300ms debounce
  const batchBuffer = useMemo(
    () => new BatchBuffer(15, 300, saveBatch),
    [saveBatch]
  );

  // Cleanup: blob URL'leri ve timer'ları temizle
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current.clear();
      batchBuffer.clear();
      if (pdfLoadingTimerRef.current) clearTimeout(pdfLoadingTimerRef.current);
    };
  }, [batchBuffer]);

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
                    payload: { beyannameler: data.beyannameler },
                  });
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
                  payload: { totalCount: data.totalCount || 0 },
                });
                toast.success(
                  `${data.customerName || "Mükellef"} için ${data.totalCount || 0} beyanname bulundu (çoklu yıl)`
                );
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

              // Tekil PDF görüntüleme — dialog'da aç
              case "intvrg:beyanname-pdf-result":
                if (pdfLoadingTimerRef.current) { clearTimeout(pdfLoadingTimerRef.current); pdfLoadingTimerRef.current = null; }
                dispatch({ type: "PDF_DONE" });
                if (data.pdfBase64) {
                  try {
                    const blobUrl = createBlobUrl(data.pdfBase64);
                    const meta = pdfPreviewMetaRef.current;
                    setPdfPreview({
                      blobUrl,
                      turAdi: meta?.turAdi || data.turAdi || "Beyanname",
                      donem: meta?.donem || "",
                      customerName: meta?.customerName || "",
                    });
                  } catch (e) {
                    console.error("[BEYANNAME-PDF] Blob URL oluşturulamadı:", e);
                    toast.error("PDF verisi işlenemedi");
                  }
                  pdfPreviewMetaRef.current = null;
                }
                break;

              case "intvrg:beyanname-pdf-error":
                if (pdfLoadingTimerRef.current) { clearTimeout(pdfLoadingTimerRef.current); pdfLoadingTimerRef.current = null; }
                dispatch({ type: "PDF_DONE" });
                setPdfPreview(null);
                toast.error(data.error || "PDF indirilemedi");
                break;

              // ════════════════════════════════════════════════════════════
              // STREAMING PIPELINE — Her PDF geldiğinde batch buffer'a ekle
              // ════════════════════════════════════════════════════════════

              case "intvrg:beyanname-bulk-pdf-result": {
                // 1. Progress güncelle — ANINDA
                dispatch({
                  type: "PIPELINE_PDF_PROGRESS",
                  payload: {
                    downloadedCount: data.downloadedCount || 0,
                    totalCount: data.totalCount || 0,
                    turAdi: data.turAdi || "",
                    beyoid: data.beyoid || "",
                  },
                });

                // 2. Batch buffer'a ekle — otomatik flush (15'lik batch veya 300ms debounce)
                const capturedCustomerId = pendingQueryRef.current?.customerId || "";
                if (data.pdfBase64 && capturedCustomerId) {
                  batchBuffer.add({
                    customerId: capturedCustomerId,
                    pdfBase64: data.pdfBase64,
                    beyoid: data.beyoid || "",
                    turKodu: data.turKodu || "",
                    turAdi: data.turAdi || "",
                    donem: data.donem || "",
                    versiyon: data.versiyon || "",
                  });
                }
                break;
              }

              case "intvrg:beyanname-bulk-pdf-skip": {
                console.log(`[BEYANNAME-PDF] Atlandı: ${data.turAdi} — ${data.error}`);
                if (data.beyoid) {
                  dispatch({
                    type: "PIPELINE_PDF_SKIP",
                    payload: { beyoid: data.beyoid },
                  });
                }
                break;
              }

              case "intvrg:beyanname-pipeline-complete": {
                dispatch({
                  type: "PIPELINE_COMPLETE",
                  payload: {
                    totalDownloaded: data.totalDownloaded || 0,
                    totalFailed: data.totalFailed || 0,
                    totalSkipped: data.totalSkipped || 0,
                  },
                });

                // Kalan buffer'ı flush et ve tüm batch save'lerin bitmesini bekle
                batchBuffer.finalize().then(() => {
                  dispatch({ type: "ALL_SAVES_COMPLETE" });
                  pendingQueryRef.current = null;
                  const msg = data.totalDownloaded > 0
                    ? `${data.totalDownloaded} beyanname PDF'i kaydedildi`
                    : "Tüm beyanname PDF'leri zaten mevcut";
                  toast.success(msg);
                });
                break;
              }
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
  }, [batchBuffer]);

  const startQuery = useCallback(
    async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string, savedBeyoids?: string[]) => {
      if (state.isLoading) return;

      // Önceki blob URL'leri temizle
      for (const url of blobUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current.clear();
      batchBuffer.clear();

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
          body: JSON.stringify({ customerId, basAy, basYil, bitAy, bitYil, savedBeyoids: savedBeyoids || [] }),
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
    [state.isLoading, batchBuffer]
  );

  const clearResults = useCallback(() => {
    for (const url of blobUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    blobUrlsRef.current.clear();
    batchBuffer.clear();
    dispatch({ type: "CLEAR" });
  }, [batchBuffer]);

  const showArchiveData = useCallback((data: unknown[]) => {
    dispatch({
      type: "SHOW_ARCHIVE",
      payload: { beyannameler: data as BeyannameItem[] },
    });
  }, []);

  const viewPdf = useCallback(
    async (customerId: string, beyoid: string, turAdi: string, donem?: string, customerName?: string) => {
      if (state.pdfLoading) return;

      // Dialog'u HEMEN aç (loading spinner ile)
      setPdfPreview({
        blobUrl: null,
        turAdi,
        donem: donem || "",
        customerName: customerName || "",
      });

      // Beyanname item'ını bul — storage sorgusu için turKodu ve donem gerekli
      const item = state.beyannameler.find((b) => b.beyoid === beyoid);

      // 1. Storage'dan dene (pipeline sonrası PDF zaten kaydedilmiş olabilir)
      if (item) {
        try {
          const params = new URLSearchParams({
            customerId,
            turKodu: item.turKodu,
            donem: item.donem,
          });
          const metaRes = await fetch(`/api/intvrg/beyanname-pdf?${params}`);

          if (metaRes.ok) {
            const data = await metaRes.json();
            if (data.signedUrl) {
              const pdfRes = await fetch(data.signedUrl);
              if (pdfRes.ok) {
                const blob = await pdfRes.blob();
                if (blob.size >= 100) {
                  const blobUrl = URL.createObjectURL(blob);
                  setPdfPreview({
                    blobUrl,
                    turAdi,
                    donem: donem || "",
                    customerName: customerName || "",
                  });
                  return;
                }
              }
            }
          }
        } catch {
          // Storage'da bulunamadı — WebSocket fallback'e devam
        }
      }

      // 2. Storage'da yoksa → WebSocket üzerinden Electron Bot'tan iste
      if (pdfLoadingTimerRef.current) { clearTimeout(pdfLoadingTimerRef.current); pdfLoadingTimerRef.current = null; }

      pdfPreviewMetaRef.current = { turAdi, donem: donem || "", customerName: customerName || "" };
      dispatch({ type: "PDF_LOADING", payload: { beyoid } });

      // 30s timeout — WS yanıtı gelmezse temizle
      pdfLoadingTimerRef.current = setTimeout(() => {
        pdfLoadingTimerRef.current = null;
        dispatch({ type: "PDF_DONE" });
        setPdfPreview(null);
        toast.error("PDF yanıtı zaman aşımına uğradı. Lütfen tekrar deneyin.");
      }, 30000);

      try {
        const response = await fetch("/api/intvrg/beyanname-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, beyoid, turAdi }),
        });

        if (!response.ok) {
          if (pdfLoadingTimerRef.current) { clearTimeout(pdfLoadingTimerRef.current); pdfLoadingTimerRef.current = null; }
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({ type: "PDF_DONE" });
          setPdfPreview(null);

          if (errorData.code === "TOKEN_EXPIRED") {
            toast.error("GİB oturumu süresi dolmuş. Lütfen önce beyanname sorgulaması yapın.");
          } else {
            toast.error(errorData.error || "PDF isteği başarısız");
          }
        }
      } catch {
        if (pdfLoadingTimerRef.current) { clearTimeout(pdfLoadingTimerRef.current); pdfLoadingTimerRef.current = null; }
        dispatch({ type: "PDF_DONE" });
        setPdfPreview(null);
        toast.error("PDF isteği gönderilemedi");
      }
    },
    [state.pdfLoading, state.beyannameler]
  );

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
    viewPdf,
    showArchiveData,
    pdfPreview,
    closePdfPreview,
  };
}
