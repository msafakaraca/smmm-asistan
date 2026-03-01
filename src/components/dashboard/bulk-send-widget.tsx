"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// API response tipleri
interface BulkSendSummaryStats {
  totalDocuments: number;
  sent: number;
  pending: number;
  failed: number;
  coveragePercent: number;
}

interface RecentSendItem {
  id: string;
  customerName: string;
  channel: "mail" | "whatsapp" | "sms";
  beyannameTurleri: string[];
  documentCount: number;
  sentAt: string;
}

interface BulkSendSummaryData {
  stats: BulkSendSummaryStats;
  recentSends: RecentSendItem[];
  period: {
    year: number;
    month: number;
    label: string;
  };
}

// Kanal ikonu eşleştirmesi
const CHANNEL_CONFIG: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  mail: {
    icon: "solar:letter-bold",
    label: "E-posta",
    color: "text-blue-500",
  },
  whatsapp: {
    icon: "solar:smartphone-bold",
    label: "WhatsApp",
    color: "text-emerald-500",
  },
  sms: {
    icon: "solar:chat-round-dots-bold",
    label: "SMS",
    color: "text-violet-500",
  },
};

function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const time = `${hours}:${minutes}`;

    // Bugünse sadece saat göster
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      return `Bugün ${time}`;
    }

    // Dünse
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return `Dün ${time}`;
    }

    // Diğer günler
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month} ${time}`;
  } catch {
    return "";
  }
}

interface BulkSendWidgetProps {
  className?: string;
}

export function BulkSendWidget({ className }: BulkSendWidgetProps) {
  const [data, setData] = useState<BulkSendSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch("/api/dashboard/bulk-send-summary");
      if (!res.ok) throw new Error("Toplu gönderim özeti yüklenemedi");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error("Error fetching bulk send summary:", err);
      setError("Veriler yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col h-[420px]", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Icon
            icon="solar:letter-opened-bold"
            className="h-4 w-4 text-primary"
          />
          <span className="text-sm font-semibold">Toplu Gönderim</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <div className="space-y-3 flex-1">
          <Skeleton className="h-[52px] rounded-lg" />
          <Skeleton className="h-[52px] rounded-lg" />
          <Skeleton className="h-[52px] rounded-lg" />
        </div>
        <Skeleton className="h-9 rounded-md mt-3" />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("p-4 flex flex-col h-[420px]", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Icon
            icon="solar:letter-opened-bold"
            className="h-4 w-4 text-primary"
          />
          <span className="text-sm font-semibold">Toplu Gönderim</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Icon
            icon="solar:close-circle-bold"
            className="h-8 w-8 text-destructive/40 mb-2"
          />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  const stats = data?.stats;
  const recentSends = data?.recentSends || [];
  const period = data?.period;

  // Empty state
  const isEmpty = !stats || stats.totalDocuments === 0;

  return (
    <Card className={cn("p-4 flex flex-col h-[420px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:letter-opened-bold"
            className="h-4 w-4 text-primary"
          />
          <span className="text-sm font-semibold">Toplu Gönderim</span>
          {period && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {period.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <Icon
              icon="solar:refresh-bold"
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
          </Button>
          <Link
            href="/dashboard/toplu-gonderim"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            Tümü
            <Icon icon="solar:arrow-right-linear" className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {isEmpty ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Icon
            icon="solar:inbox-bold"
            className="h-10 w-10 text-muted-foreground/30 mb-2"
          />
          <p className="text-sm font-medium text-muted-foreground">
            Henüz bu dönem gönderim yapılmadı
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Toplu gönderim sayfasından dosyalarınızı gönderebilirsiniz.
          </p>
        </div>
      ) : (
        <>
          {/* Stat Kartları */}
          <div className="grid grid-cols-4 gap-2 mb-3 flex-shrink-0">
            {/* Gönderildi */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <Icon
                icon="solar:check-circle-bold"
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                  {stats!.sent}
                </span>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                  Gönderildi
                </p>
              </div>
            </div>

            {/* Bekleyen */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <Icon
                icon="solar:clock-circle-bold"
                className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none">
                  {stats!.pending}
                </span>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                  Bekleyen
                </p>
              </div>
            </div>

            {/* Hatalı */}
            <div
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border",
                stats!.failed > 0
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                  : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
              )}
            >
              <Icon
                icon="solar:close-circle-bold"
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  stats!.failed > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-400"
                )}
              />
              <div className="min-w-0">
                <span
                  className={cn(
                    "text-lg font-bold leading-none",
                    stats!.failed > 0
                      ? "text-red-700 dark:text-red-300"
                      : "text-slate-500"
                  )}
                >
                  {stats!.failed}
                </span>
                <p
                  className={cn(
                    "text-[10px] mt-0.5 truncate",
                    stats!.failed > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-400"
                  )}
                >
                  Hatalı
                </p>
              </div>
            </div>

            {/* Kapsam */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <Icon
                icon="solar:chart-bold"
                className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">
                  %{stats!.coveragePercent}
                </span>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                  Kapsam
                </p>
              </div>
            </div>
          </div>

          {/* Son Gönderimler */}
          <div className="flex-1 min-h-0 flex flex-col">
            {recentSends.length > 0 ? (
              <div className="divide-y divide-border/50">
                {recentSends.map((item) => (
                  <RecentSendItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Icon
                    icon="solar:inbox-bold"
                    className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1"
                  />
                  <span className="text-xs text-muted-foreground">
                    Henüz gönderim kaydı yok
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="pt-2 mt-auto border-t flex-shrink-0">
        <Link
          href="/dashboard/toplu-gonderim"
          className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center"
        >
          Tüm gönderimleri görüntüle
        </Link>
      </div>
    </Card>
  );
}

// Son gönderim satır bileşeni
function RecentSendItem({ item }: { item: RecentSendItem }) {
  const channelConfig = CHANNEL_CONFIG[item.channel] || CHANNEL_CONFIG.mail;
  const dateTime = formatDateTime(item.sentAt);

  return (
    <div className="py-2.5 px-1">
      {/* Üst satır: Müşteri adı + kanal ikonu */}
      <div className="flex items-center gap-2">
        <Icon
          icon="solar:user-bold"
          className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
        />
        <span className="text-xs font-medium truncate flex-1">
          {item.customerName}
        </span>
        <span title={channelConfig.label} className="flex-shrink-0">
          <Icon
            icon={channelConfig.icon}
            className={cn("h-3.5 w-3.5", channelConfig.color)}
          />
        </span>
      </div>

      {/* Alt satır: Beyanname türleri + dosya sayısı + tarih/saat */}
      <div className="flex items-center justify-between mt-1 ml-[22px]">
        <span className="text-xs text-muted-foreground truncate">
          {item.beyannameTurleri.length > 0
            ? item.beyannameTurleri.join(", ")
            : "Dosya"}
          <span className="text-muted-foreground/60">
            {" "}&middot; {item.documentCount} dosya
          </span>
        </span>
        <span className="text-[11px] text-muted-foreground/70 flex-shrink-0 ml-2">
          {dateTime}
        </span>
      </div>
    </div>
  );
}
