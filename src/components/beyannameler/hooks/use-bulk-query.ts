/**
 * Toplu Beyanname Sorgulama Hook
 * ================================
 * WebSocket üzerinden Electron Bot'tan gelen toplu sorgulama
 * event'lerini dinler ve state yönetir.
 *
 * Her PDF geldiğinde beyanname-bulk-save endpoint'ine fire-and-forget gönderir.
 */

"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomerResult {
  customerId: string;
  customerName: string;
  success: boolean;
  beyannameCount: number;
  pdfDownloaded: number;
  pdfFailed: number;
  pdfSkipped: number;
  error?: string;
}

type BulkStatus = "idle" | "running" | "completed" | "cancelled";

interface BulkQueryState {
  status: BulkStatus;
  currentIndex: number;
  totalCount: number;
  currentCustomerName: string;
  progressMessage: string;
  customerResults: CustomerResult[];
  elapsedSeconds: number;
}

type BulkAction =
  | { type: "START"; payload: { totalCount: number } }
  | { type: "CUSTOMER_START"; payload: { customerId: string; customerName: string; index: number; total: number } }
  | { type: "CUSTOMER_RESULTS"; payload: { customerId: string; beyannameCount: number } }
  | { type: "CUSTOMER_COMPLETE"; payload: { customerId: string; customerName: string; totalQueried: number; totalDownloaded: number; totalFailed: number; totalSkipped: number } }
  | { type: "CUSTOMER_ERROR"; payload: { customerId: string; customerName: string; error: string } }
  | { type: "PROGRESS"; payload: { status: string } }
  | { type: "ALL_COMPLETE"; payload: { totalCustomers: number; successCount: number; errorCount: number; totalBeyanname: number; totalPdf: number; cancelled: boolean } }
  | { type: "ERROR"; payload: { error: string } }
  | { type: "TICK" }
  | { type: "RESET" };

const initialState: BulkQueryState = {
  status: "idle",
  currentIndex: 0,
  totalCount: 0,
  currentCustomerName: "",
  progressMessage: "",
  customerResults: [],
  elapsedSeconds: 0,
};

function reducer(state: BulkQueryState, action: BulkAction): BulkQueryState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        status: "running",
        totalCount: action.payload.totalCount,
        progressMessage: "Toplu sorgulama başlatılıyor...",
      };

    case "CUSTOMER_START": {
      const results = [...state.customerResults];
      // Müşteriyi henüz eklenmemişse placeholder olarak ekle
      if (!results.find((r) => r.customerId === action.payload.customerId)) {
        results.push({
          customerId: action.payload.customerId,
          customerName: action.payload.customerName,
          success: false,
          beyannameCount: 0,
          pdfDownloaded: 0,
          pdfFailed: 0,
          pdfSkipped: 0,
        });
      }
      return {
        ...state,
        currentIndex: action.payload.index,
        totalCount: action.payload.total,
        currentCustomerName: action.payload.customerName,
        progressMessage: `${action.payload.customerName} sorgulanıyor... (${action.payload.index + 1}/${action.payload.total})`,
        customerResults: results,
      };
    }

    case "CUSTOMER_RESULTS": {
      const results = [...state.customerResults];
      const existing = results.find((r) => r.customerId === action.payload.customerId);
      if (existing) {
        existing.beyannameCount += action.payload.beyannameCount;
      }
      return { ...state, customerResults: results };
    }

    case "CUSTOMER_COMPLETE": {
      const results = [...state.customerResults];
      const existing = results.find((r) => r.customerId === action.payload.customerId);
      if (existing) {
        existing.success = true;
        existing.pdfDownloaded = action.payload.totalDownloaded;
        existing.pdfFailed = action.payload.totalFailed;
        existing.pdfSkipped = action.payload.totalSkipped;
        existing.beyannameCount = action.payload.totalQueried;
      } else {
        results.push({
          customerId: action.payload.customerId,
          customerName: action.payload.customerName,
          success: true,
          beyannameCount: action.payload.totalQueried,
          pdfDownloaded: action.payload.totalDownloaded,
          pdfFailed: action.payload.totalFailed,
          pdfSkipped: action.payload.totalSkipped,
        });
      }
      return { ...state, customerResults: results };
    }

    case "CUSTOMER_ERROR": {
      const results = [...state.customerResults];
      results.push({
        customerId: action.payload.customerId,
        customerName: action.payload.customerName,
        success: false,
        beyannameCount: 0,
        pdfDownloaded: 0,
        pdfFailed: 0,
        pdfSkipped: 0,
        error: action.payload.error,
      });
      return { ...state, customerResults: results };
    }

    case "PROGRESS":
      return { ...state, progressMessage: action.payload.status };

    case "ALL_COMPLETE":
      return {
        ...state,
        status: action.payload.cancelled ? "cancelled" : "completed",
        progressMessage: action.payload.cancelled
          ? "Toplu sorgulama iptal edildi"
          : `Tamamlandı: ${action.payload.successCount} başarılı, ${action.payload.errorCount} hatalı`,
      };

    case "ERROR":
      return {
        ...state,
        status: "completed",
        progressMessage: action.payload.error,
      };

    case "TICK":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Kaydetme Buffer — customerId bazlı gruplama
// ═══════════════════════════════════════════════════════════════════════════

interface PdfSaveItem {
  customerId: string;
  pdfBase64: string;
  beyoid: string;
  turKodu: string;
  turAdi: string;
  donem: string;
  versiyon: string;
}

class BulkSaveBuffer {
  private buffers = new Map<string, PdfSaveItem[]>();
  private batchSize: number;

  constructor(batchSize: number = 10) {
    this.batchSize = batchSize;
  }

  add(item: PdfSaveItem) {
    const buf = this.buffers.get(item.customerId) || [];
    buf.push(item);
    this.buffers.set(item.customerId, buf);

    if (buf.length >= this.batchSize) {
      this.flush(item.customerId);
    }
  }

  flushCustomer(customerId: string) {
    this.flush(customerId);
  }

  flushAll() {
    for (const customerId of this.buffers.keys()) {
      this.flush(customerId);
    }
  }

  clear() {
    this.buffers.clear();
  }

  private flush(customerId: string) {
    const items = this.buffers.get(customerId);
    if (!items || items.length === 0) return;
    this.buffers.delete(customerId);

    // Fire-and-forget
    fetch("/api/intvrg/beyanname-bulk-save", {
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
    }).catch((err) => {
      console.error("[BULK-SAVE] Kaydetme hatası:", err);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════

export function useBulkQuery() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveBufferRef = useRef(new BulkSaveBuffer(10));

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
              case "intvrg:beyanname-bulk-progress":
                dispatch({ type: "PROGRESS", payload: { status: data.status || "" } });
                break;

              case "intvrg:beyanname-bulk-customer-start":
                // Reducer'a customer ekle (placeholder olarak)
                dispatch({
                  type: "CUSTOMER_START",
                  payload: {
                    customerId: data.customerId,
                    customerName: data.customerName,
                    index: data.index,
                    total: data.total,
                  },
                });
                break;

              case "intvrg:beyanname-bulk-customer-results":
                dispatch({
                  type: "CUSTOMER_RESULTS",
                  payload: {
                    customerId: data.customerId,
                    beyannameCount: data.beyannameCount || 0,
                  },
                });
                break;

              case "intvrg:beyanname-bulk-customer-pdf":
                // PDF geldi — buffer'a ekle (fire-and-forget save)
                if (data.pdfBase64 && data.customerId) {
                  saveBufferRef.current.add({
                    customerId: data.customerId,
                    pdfBase64: data.pdfBase64,
                    beyoid: data.beyoid || "",
                    turKodu: data.turKodu || "",
                    turAdi: data.turAdi || "",
                    donem: data.donem || "",
                    versiyon: data.versiyon || "",
                  });
                }
                break;

              case "intvrg:beyanname-bulk-customer-complete":
                // Bu mükellefi flush et
                saveBufferRef.current.flushCustomer(data.customerId);
                dispatch({
                  type: "CUSTOMER_COMPLETE",
                  payload: {
                    customerId: data.customerId,
                    customerName: data.customerName,
                    totalQueried: data.totalQueried || 0,
                    totalDownloaded: data.totalDownloaded || 0,
                    totalFailed: data.totalFailed || 0,
                    totalSkipped: data.totalSkipped || 0,
                  },
                });
                break;

              case "intvrg:beyanname-bulk-customer-error":
                saveBufferRef.current.flushCustomer(data.customerId);
                dispatch({
                  type: "CUSTOMER_ERROR",
                  payload: {
                    customerId: data.customerId,
                    customerName: data.customerName,
                    error: data.error || "Bilinmeyen hata",
                  },
                });
                break;

              case "intvrg:beyanname-bulk-all-complete":
                saveBufferRef.current.flushAll();
                dispatch({
                  type: "ALL_COMPLETE",
                  payload: {
                    totalCustomers: data.totalCustomers || 0,
                    successCount: data.successCount || 0,
                    errorCount: data.errorCount || 0,
                    totalBeyanname: data.totalBeyanname || 0,
                    totalPdf: data.totalPdf || 0,
                    cancelled: data.cancelled || false,
                  },
                });
                if (data.cancelled) {
                  toast.info("Toplu sorgulama iptal edildi");
                } else {
                  toast.success(
                    `Toplu sorgulama tamamlandı: ${data.successCount || 0} başarılı, ${data.errorCount || 0} hatalı`
                  );
                }
                // Timer'ı durdur
                if (tickTimerRef.current) {
                  clearInterval(tickTimerRef.current);
                  tickTimerRef.current = null;
                }
                break;

              case "intvrg:beyanname-bulk-error":
                dispatch({ type: "ERROR", payload: { error: data.error || "Toplu sorgulama hatası" } });
                toast.error(data.error || "Toplu sorgulama hatası");
                if (tickTimerRef.current) {
                  clearInterval(tickTimerRef.current);
                  tickTimerRef.current = null;
                }
                break;
            }
          } catch {
            // JSON parse hatası
          }
        };

        ws.onclose = () => {
          if (mounted) {
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
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      saveBufferRef.current.clear();
    };
  }, []);

  const startBulkQuery = useCallback(
    async (customerIds: string[], basAy: string, basYil: string, bitAy: string, bitYil: string) => {
      if (state.status === "running") return;

      saveBufferRef.current.clear();
      dispatch({ type: "START", payload: { totalCount: customerIds.length } });

      // Geçen süre sayacı
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      tickTimerRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);

      try {
        const response = await fetch("/api/intvrg/beyanname", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerIds, basAy, basYil, bitAy, bitYil }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
          dispatch({ type: "ERROR", payload: { error: errorData.error || `HTTP ${response.status}` } });
          toast.error(errorData.error || "Toplu sorgulama başlatılamadı");
          if (tickTimerRef.current) {
            clearInterval(tickTimerRef.current);
            tickTimerRef.current = null;
          }
        }
      } catch {
        dispatch({ type: "ERROR", payload: { error: "Sunucuya bağlanılamadı" } });
        toast.error("Sunucuya bağlanılamadı");
        if (tickTimerRef.current) {
          clearInterval(tickTimerRef.current);
          tickTimerRef.current = null;
        }
      }
    },
    [state.status]
  );

  const cancelBulkQuery = useCallback(async () => {
    try {
      const port = process.env.NEXT_PUBLIC_WS_PORT || "3001";
      // WS üzerinden iptal sinyali gönder
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "intvrg:beyanname-bulk-cancel",
          data: {},
        }));
      }
      toast.info("İptal sinyali gönderildi...");
    } catch {
      toast.error("İptal sinyali gönderilemedi");
    }
  }, []);

  const resetBulkQuery = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    saveBufferRef.current.clear();
    dispatch({ type: "RESET" });
  }, []);

  return {
    ...state,
    startBulkQuery,
    cancelBulkQuery,
    resetBulkQuery,
  };
}
