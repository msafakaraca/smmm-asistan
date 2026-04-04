"use client";

/**
 * INTVRG Beyanname Test Tab
 * =========================
 * INTVRG üzerinden beyanname sorgulama ve PDF indirme test arayüzü.
 * Mevcut e-beyanname pipeline'ına dokunmaz.
 */

import { useState, useReducer, useCallback, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Loader2,
  Check,
  AlertCircle,
  FileDown,
  BarChart3,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// ═════════════��════════════════════════���════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface BeyannameItem {
  beyannameKodu: string;
  beyannameTuru: string;
  durum: string;
  tckn: string;
  unvan: string;
  vergiDairesi: string;
  donem: string;
  yuklemezamani: string;
  beyannameOid: string;
  tahakkukOid: string;
}

interface PdfResult {
  success: boolean;
  type: string;
  size: number;
  error?: string;
}

interface TestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  avgResponseTime: number;
  rateLimitHits: number;
  tokenStatus: string;
  pdfStats: {
    attempted: number;
    downloaded: number;
    totalSize: number;
    errors: number;
  };
}

// ═════════════════��═════════════════════���═══════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════

interface TestState {
  status: "idle" | "running" | "success" | "error";
  progressMessage: string;
  progressPercent: number;
  beyannameler: BeyannameItem[];
  pdfResults: Record<string, PdfResult[]>;
  stats: TestStats | null;
  error: string | null;
}

type TestAction =
  | { type: "START" }
  | { type: "PROGRESS"; payload: { message: string; progress?: number } }
  | {
      type: "RESULTS";
      payload: { beyannameler: BeyannameItem[]; stats: TestStats };
    }
  | {
      type: "COMPLETE";
      payload: {
        beyannameler: BeyannameItem[];
        pdfResults: Record<string, PdfResult[]>;
        stats: TestStats;
      };
    }
  | { type: "ERROR"; payload: { error: string; stats?: TestStats } }
  | { type: "RESET" };

const initialState: TestState = {
  status: "idle",
  progressMessage: "",
  progressPercent: 0,
  beyannameler: [],
  pdfResults: {},
  stats: null,
  error: null,
};

function reducer(state: TestState, action: TestAction): TestState {
  switch (action.type) {
    case "START":
      return { ...initialState, status: "running" };
    case "PROGRESS":
      return {
        ...state,
        progressMessage: action.payload.message,
        progressPercent: action.payload.progress ?? state.progressPercent,
      };
    case "RESULTS":
      return {
        ...state,
        beyannameler: action.payload.beyannameler,
        stats: action.payload.stats,
      };
    case "COMPLETE":
      return {
        ...state,
        status: "success",
        progressPercent: 100,
        progressMessage: "Test tamamlandı!",
        beyannameler: action.payload.beyannameler,
        pdfResults: action.payload.pdfResults,
        stats: action.payload.stats,
      };
    case "ERROR":
      return {
        ...state,
        status: "error",
        error: action.payload.error,
        stats: action.payload.stats ?? state.stats,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ═════════════════════════════════════════════════════════════���═════
// HELPERS
// ══════════════════════════════════��════════════════════════════════

const DURUM_LABELS: Record<string, string> = {
  "0": "Hatalı",
  "1": "Onay Bekliyor",
  "2": "Onaylandı",
  "3": "İptal",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}sn`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}dk ${remainSecs}sn`;
}

// ════════════════════════════════════════��══════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function IntrvrgTestTab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);

  // Form state
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const defaultStartDate = `${lastMonthYear}${String(lastMonth + 1).padStart(2, "0")}01`;
  const defaultEndDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const [baslangicTarihi, setBaslangicTarihi] = useState(defaultStartDate);
  const [bitisTarihi, setBitisTarihi] = useState(defaultEndDate);
  const [durumFiltresi, setDurumFiltresi] = useState<"onaylandi" | "hatali" | "tumu">("onaylandi");
  const [downloadBeyanname, setDownloadBeyanname] = useState(true);
  const [downloadTahakkuk, setDownloadTahakkuk] = useState(true);
  const [downloadSgk, setDownloadSgk] = useState(true);

  // WebSocket bağlantısı
  useEffect(() => {
    let mounted = true;

    const connectWS = async () => {
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (!tokenRes.ok || !mounted) return;
        const { token } = await tokenRes.json();
        if (!mounted) return;

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

            switch (message.type) {
              case "intvrg-test:progress":
                dispatch({
                  type: "PROGRESS",
                  payload: {
                    message: data?.message || "",
                    progress: data?.progress,
                  },
                });
                break;

              case "intvrg-test:results":
                dispatch({
                  type: "RESULTS",
                  payload: {
                    beyannameler: data?.beyannameler || [],
                    stats: data?.stats,
                  },
                });
                break;

              case "intvrg-test:complete":
                dispatch({
                  type: "COMPLETE",
                  payload: {
                    beyannameler: data?.beyannameler || [],
                    pdfResults: data?.pdfResults || {},
                    stats: data?.stats,
                  },
                });
                toast.success("INTVRG test tamamlandı");
                break;

              case "intvrg-test:error":
                dispatch({
                  type: "ERROR",
                  payload: {
                    error: data?.error || "Bilinmeyen hata",
                    stats: data?.stats,
                  },
                });
                toast.error(`INTVRG test hatası: ${data?.error || "Bilinmeyen hata"}`);
                break;
            }
          } catch {
            // JSON parse hatası — sessizce geç
          }
        };

        ws.onclose = () => {
          if (mounted) {
            wsRef.current = null;
            // 5sn sonra yeniden bağlan
            setTimeout(connectWS, 5000);
          }
        };
      } catch {
        if (mounted) setTimeout(connectWS, 5000);
      }
    };

    connectWS();

    return () => {
      mounted = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // Test başlat
  const handleStart = useCallback(async () => {
    dispatch({ type: "START" });

    try {
      // Dönem: yükleme tarihinden otomatik hesapla (geniş aralık)
      // baslangicTarihi YYYYMMDD → ay-1, bitisTarihi YYYYMMDD → ay
      const startYear = baslangicTarihi.substring(0, 4);
      const startMonth = baslangicTarihi.substring(4, 6);
      const endYear = bitisTarihi.substring(0, 4);
      const endMonth = bitisTarihi.substring(4, 6);

      // Dönem başlangıcı: yükleme başlangıç ayından 2 ay önce (geniş aralık)
      let dBasAy = parseInt(startMonth, 10) - 2;
      let dBasYil = parseInt(startYear, 10);
      if (dBasAy <= 0) { dBasAy += 12; dBasYil -= 1; }

      const res = await fetch("/api/gib/intvrg-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baslangicTarihi,
          bitisTarihi,
          donemBasAy: String(dBasAy).padStart(2, "0"),
          donemBasYil: String(dBasYil),
          donemBitAy: endMonth,
          donemBitYil: endYear,
          durumFiltresi,
          downloadBeyanname,
          downloadTahakkuk,
          downloadSgk,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API hatası");
      }

      // Delegated — WS'den sonuç beklenecek
    } catch (e) {
      dispatch({
        type: "ERROR",
        payload: { error: (e as Error).message },
      });
      toast.error((e as Error).message);
    }
  }, [
    baslangicTarihi,
    bitisTarihi,
    durumFiltresi,
    downloadBeyanname,
    downloadTahakkuk,
    downloadSgk,
  ]);

  // Test durdur
  const handleStop = useCallback(async () => {
    try {
      await fetch("/api/gib/stop", { method: "POST" });
    } catch { /* ignore */ }
    dispatch({ type: "RESET" });
    toast.warning("Test durduruldu");
  }, []);

  const isRunning = state.status === "running";
  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  return (
    <div className="space-y-5">
      {/* ─── Filtreler ─── */}
      {!isRunning && !isSuccess && (
        <div className="space-y-4">
          {/* Tarih Aralığı */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Yükleme Başlangıç (YYYYMMDD)
              </Label>
              <Input
                value={baslangicTarihi}
                onChange={(e) => setBaslangicTarihi(e.target.value)}
                placeholder="20260201"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Yükleme Bitiş (YYYYMMDD)
              </Label>
              <Input
                value={bitisTarihi}
                onChange={(e) => setBitisTarihi(e.target.value)}
                placeholder="20260228"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Durum Filtresi */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Durum Filtresi
            </Label>
            <div className="flex gap-3">
              {(
                [
                  ["onaylandi", "Onaylandı"],
                  ["hatali", "Hatalı"],
                  ["tumu", "Tümü"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="durumFiltresi"
                    value={value}
                    checked={durumFiltresi === value}
                    onChange={() => setDurumFiltresi(value)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* PDF İndirme Seçenekleri */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              PDF İndirme
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={downloadBeyanname}
                  onCheckedChange={(c) => setDownloadBeyanname(c === true)}
                />
                Beyanname
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={downloadTahakkuk}
                  onCheckedChange={(c) => setDownloadTahakkuk(c === true)}
                />
                Tahakkuk
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={downloadSgk}
                  onCheckedChange={(c) => setDownloadSgk(c === true)}
                />
                SGK
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ─── Başlat / Durdur ─── */}
      <div className="flex gap-2">
        {isRunning ? (
          <Button
            variant="destructive"
            onClick={handleStop}
            className="flex-1 gap-2"
          >
            <Square className="h-4 w-4" />
            Testi Durdur
          </Button>
        ) : (
          <Button
            onClick={isSuccess ? () => dispatch({ type: "RESET" }) : handleStart}
            className="flex-1 gap-2"
          >
            <Play className="h-4 w-4" />
            {isSuccess ? "Yeni Test" : "Testi Başlat"}
          </Button>
        )}
      </div>

      {/* ─── Hata ─── */}
      {isError && state.error && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">
            {state.error}
          </p>
        </div>
      )}

      {/* ─── Progress ─── */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{state.progressMessage || "Başlatılıyor..."}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${state.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            %{state.progressPercent}
          </p>
        </div>
      )}

      {/* ─── İstatistikler ─── */}
      {state.stats && (isSuccess || isError) && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            İstatistikler
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <StatCard
              label="Toplam İstek"
              value={String(state.stats.totalRequests)}
            />
            <StatCard
              label="Başarılı"
              value={String(state.stats.successfulRequests)}
              variant="success"
            />
            <StatCard
              label="Hata"
              value={String(state.stats.failedRequests)}
              variant={state.stats.failedRequests > 0 ? "error" : "default"}
            />
            <StatCard
              label="Rate Limit"
              value={String(state.stats.rateLimitHits)}
              variant={state.stats.rateLimitHits > 0 ? "warning" : "default"}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <StatCard
              label="Toplam Süre"
              value={formatDuration(state.stats.totalDuration)}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <StatCard
              label="Ort. Response"
              value={`${state.stats.avgResponseTime}ms`}
            />
            <StatCard
              label="Token Durumu"
              value={
                state.stats.tokenStatus === "active"
                  ? "Aktif"
                  : state.stats.tokenStatus === "expired"
                    ? "Süresi Dolmuş"
                    : "Bilinmiyor"
              }
              icon={
                state.stats.tokenStatus === "active" ? (
                  <Wifi className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-600" />
                )
              }
            />
          </div>

          {/* PDF İstatistikleri */}
          {state.stats.pdfStats.attempted > 0 && (
            <div className="pt-2 border-t">
              <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <FileDown className="h-3.5 w-3.5" />
                PDF İstatistikleri
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <StatCard
                  label="Denenen"
                  value={String(state.stats.pdfStats.attempted)}
                />
                <StatCard
                  label="İndirilen"
                  value={String(state.stats.pdfStats.downloaded)}
                  variant="success"
                />
                <StatCard
                  label="Toplam Boyut"
                  value={formatBytes(state.stats.pdfStats.totalSize)}
                />
                <StatCard
                  label="PDF Hata"
                  value={String(state.stats.pdfStats.errors)}
                  variant={state.stats.pdfStats.errors > 0 ? "error" : "default"}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Beyanname Listesi ─── */}
      {state.beyannameler.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h4 className="text-sm font-medium">
              Sonuçlar ({state.beyannameler.length} beyanname)
            </h4>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Tür</th>
                  <th className="px-3 py-2 text-left font-medium">VKN/TCK</th>
                  <th className="px-3 py-2 text-left font-medium">Ünvan</th>
                  <th className="px-3 py-2 text-left font-medium">Dönem</th>
                  <th className="px-3 py-2 text-left font-medium">Durum</th>
                  <th className="px-3 py-2 text-left font-medium">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.beyannameler.map((byn, idx) => {
                  const pdfs = state.pdfResults[byn.beyannameOid] || [];
                  return (
                    <tr
                      key={byn.beyannameOid}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {byn.beyannameKodu}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 font-mono">{byn.tckn}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate">
                        {byn.unvan}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {byn.donem}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge
                          variant="outline"
                          className={
                            byn.durum === "2"
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 text-[10px] py-0"
                              : byn.durum === "0"
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 text-[10px] py-0"
                                : "text-[10px] py-0"
                          }
                        >
                          {DURUM_LABELS[byn.durum] || byn.durum}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        {pdfs.length > 0 ? (
                          <div className="flex gap-1">
                            {pdfs.map((pdf, pi) => (
                              <span
                                key={pi}
                                title={
                                  pdf.success
                                    ? `${pdf.type}: ${formatBytes(pdf.size)}`
                                    : `${pdf.type}: ${pdf.error}`
                                }
                              >
                                {pdf.success ? (
                                  <Check className="h-3.5 w-3.5 text-green-600 inline" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════��═════════════════════════��══════════════════════════════
// Stat Card
// ═════════════════════════════════════════════���═════════════════════

function StatCard({
  label,
  value,
  variant = "default",
  icon,
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "error" | "warning";
  icon?: React.ReactNode;
}) {
  const variantClasses = {
    default: "",
    success: "text-green-700 dark:text-green-400",
    error: "text-red-700 dark:text-red-400",
    warning: "text-amber-700 dark:text-amber-400",
  };

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className={`text-lg font-bold ${variantClasses[variant]}`}>
          {value}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
