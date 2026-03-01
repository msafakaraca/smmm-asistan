"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TakipStats, TakipColumnStats } from "@/types/dashboard";

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} sa önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateName(name: string, maxLen: number = 18): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen) + "...";
}

interface TakipProgressPanelProps {
  period?: { year: number; month: number };
  className?: string;
}

const monthNames = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function TakipProgressPanel({ period, className }: TakipProgressPanelProps) {
  const [data, setData] = useState<TakipStats | null>(null);
  const [columnData, setColumnData] = useState<TakipColumnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (period) {
          params.set("year", String(period.year));
          params.set("month", String(period.month));
        }

        const [statsRes, columnRes] = await Promise.all([
          fetch(`/api/dashboard/takip-stats?${params}`),
          fetch(`/api/dashboard/takip-column-stats?${params}`),
        ]);

        // 401 = oturum süresi dolmuş, sessizce bitir (ana fetcher login'e yönlendirecek)
        if (statsRes.status === 401 || columnRes.status === 401) {
          return;
        }

        if (!statsRes.ok) throw new Error("Veri yüklenemedi");

        const statsResult: TakipStats = await statsRes.json();
        setData(statsResult);

        if (columnRes.ok) {
          const columnResult: TakipColumnStats = await columnRes.json();
          setColumnData(columnResult);
        }
      } catch (err) {
        console.error("Error fetching takip stats:", err);
        setError("Veriler yüklenirken bir hata oluştu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period?.year, period?.month]);

  const periodLabel = data?.period
    ? `${monthNames[data.period.month - 1]} ${data.period.year}`
    : period
    ? `${monthNames[period.month - 1]} ${period.year}`
    : "";

  // Loading state
  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Takip Çizelgesi</span>
        </div>
        <div className="space-y-3 flex-1">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Takip Çizelgesi</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <AlertCircle className="h-8 w-8 text-destructive/40 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  // Empty state
  if (!data || data.total === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Takip Çizelgesi</span>
          {periodLabel && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {periodLabel}
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Bu dönem için veri yok</p>
        </div>
      </Card>
    );
  }

  const linkHref = `/dashboard/takip${
    data.period ? `?year=${data.period.year}&month=${data.period.month}` : ""
  }`;

  const completedPercent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
  const cancelledPercent = data.total > 0 ? Math.round((data.cancelled / data.total) * 100) : 0;

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      {/* Header: Başlık + Dönem + Link */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Takip Çizelgesi</span>
          {periodLabel && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {periodLabel}
            </Badge>
          )}
        </div>
        <Link href={linkHref} className="text-xs text-primary hover:underline">
          Tümünü Gör
        </Link>
      </div>

      {/* Ana Stat + Son İşlenenler yan yana */}
      <div className="flex items-center gap-4 mb-3">
        {/* Sol: Stat */}
        <div className="flex-shrink-0 flex items-stretch gap-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{data.handled}</span>
              <span className="text-base text-muted-foreground">/ {data.total}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-2.5 w-2.5" />
                {data.completed} tamam
              </span>
              {data.cancelled > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <XCircle className="h-2.5 w-2.5" />
                  {data.cancelled} iptal
                </span>
              )}
              {data.pending > 0 && (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  {data.pending} bekliyor
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">%{data.completionRate}</span>
            <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Tamamlandı</span>
          </div>
        </div>

        {/* Sağ: Son İşlenenler - 2 sütun, 3+3 */}
        {data.recentCompleted && data.recentCompleted.length > 0 && (
          <div className="flex-1 min-w-0 border-l border-border pl-3">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide block mb-1">
              Son İşlenenler
            </span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {data.recentCompleted.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 min-w-0"
                  title={`${item.isim}${item.completedAt ? ` - ${formatDateTime(item.completedAt)}` : ""}`}
                >
                  {item.isCancelled ? (
                    <XCircle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                  )}
                  <span className="text-xs truncate text-foreground/80">
                    {truncateName(item.isim, 20)}
                  </span>
                  {item.completedAt && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-auto">
                      {formatTimeAgo(item.completedAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={data.completionRate}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 bg-muted rounded-full overflow-hidden flex mb-4"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${completedPercent}%` }}
        />
        {cancelledPercent > 0 && (
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${cancelledPercent}%` }}
          />
        )}
      </div>

      {/* Kolon İlerleme - alt alta */}
      {columnData && columnData.columns.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-2">
            Kolon İlerleme
          </span>
          <div className="space-y-1.5">
            {columnData.columns.map((col) => (
              <div key={col.kod} className="flex items-center gap-2">
                <span className="w-24 text-[11px] text-muted-foreground flex-shrink-0" title={col.baslik}>
                  {truncateName(col.baslik, 15)}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      col.rate >= 80 ? "bg-emerald-600" : col.rate >= 50 ? "bg-amber-600" : "bg-red-500"
                    )}
                    style={{ width: `${col.rate}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground w-8 text-right flex-shrink-0">%{col.rate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </Card>
  );
}
