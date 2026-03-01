"use client";

import { memo } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAnnouncementWidgetData } from "./hooks/use-announcement-widget-data";

interface AnnouncementWidgetProps {
  className?: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function ChannelBar({
  icon,
  label,
  total,
  sent,
  barColor,
}: {
  icon: string;
  label: string;
  total: number;
  sent: number;
  barColor: string;
}) {
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <Icon icon={icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-12 text-right flex-shrink-0">
        {sent}/{total}
      </span>
    </div>
  );
}

export const AnnouncementWidget = memo(function AnnouncementWidget({
  className,
}: AnnouncementWidgetProps) {
  const { data, loading, error } = useAnnouncementWidgetData();

  // Loading state
  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="solar:megaphone-bold-duotone" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Duyuru Merkezi</span>
        </div>
        <div className="space-y-3 flex-1">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-40 mt-2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="solar:megaphone-bold-duotone" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Duyuru Merkezi</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Icon icon="solar:danger-circle-bold-duotone" className="h-8 w-8 text-destructive/40 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  // Empty state - sadece gönderim logu VE zamanlanmış duyuru yoksa
  if (!data || (data.total === 0 && data.upcoming.length === 0)) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="solar:megaphone-bold-duotone" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Duyuru Merkezi</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Icon icon="solar:mailbox-bold-duotone" className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Henüz duyuru gönderimi yok</p>
          <p className="text-xs text-muted-foreground mt-1">
            Duyuru oluşturup gönderdiğinizde istatistikler burada görünecek.
          </p>
          <Link
            href="/dashboard/duyurular"
            className="text-xs text-primary hover:underline mt-3"
          >
            Duyuru oluştur
          </Link>
        </div>
      </Card>
    );
  }

  const hasLogs = data.total > 0;

  return (
    <Card className={cn("p-4 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon icon="solar:megaphone-bold-duotone" className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Duyuru Merkezi</span>
          {data.failed > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {data.failed} hata
            </Badge>
          )}
        </div>
        <Link
          href="/dashboard/duyurular"
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          Git
          <Icon icon="solar:arrow-right-linear" className="h-3 w-3" />
        </Link>
      </div>

      {/* Stat Kartları - sadece gönderim logu varsa */}
      {hasLogs && (
        <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <Icon icon="solar:letter-bold-duotone" className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">{data.total}</span>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 truncate">Toplam</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
            <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">{data.sent}</span>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">Başarılı</p>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 p-2 rounded-lg border",
            data.failed > 0
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
              : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
          )}>
            <Icon icon="solar:danger-triangle-bold-duotone" className={cn(
              "h-4 w-4 flex-shrink-0",
              data.failed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"
            )} />
            <div className="min-w-0">
              <span className={cn(
                "text-lg font-bold leading-none",
                data.failed > 0 ? "text-red-700 dark:text-red-300" : "text-slate-500"
              )}>{data.failed}</span>
              <p className={cn(
                "text-[10px] mt-0.5 truncate",
                data.failed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"
              )}>Hatalı</p>
            </div>
          </div>
        </div>
      )}

      {/* Kanal Performansı - sadece gönderim logu varsa */}
      {hasLogs && (
        <div className="mb-3 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
            Kanal Performansı
          </p>
          <div className="space-y-2">
            <ChannelBar
              icon="solar:letter-bold"
              label="E-posta"
              total={data.byChannel.email.total}
              sent={data.byChannel.email.sent}
              barColor="bg-blue-500"
            />
            <ChannelBar
              icon="solar:chat-round-dots-bold"
              label="SMS"
              total={data.byChannel.sms.total}
              sent={data.byChannel.sms.sent}
              barColor="bg-purple-500"
            />
            <ChannelBar
              icon="solar:chat-square-bold"
              label="WhatsApp"
              total={data.byChannel.whatsapp.total}
              sent={data.byChannel.whatsapp.sent}
              barColor="bg-green-500"
            />
          </div>
        </div>
      )}

      {/* Log yokken bilgilendirme */}
      {!hasLogs && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 p-3 mb-3 flex-shrink-0">
          <Icon icon="solar:mailbox-bold-duotone" className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Henüz gönderim logu yok. Zamanlanmış duyurularınız aşağıda listeleniyor.
          </p>
        </div>
      )}

      {/* Yaklaşan Duyurular */}
      {data.upcoming.length > 0 && (
        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon icon="solar:clock-circle-bold-duotone" className="h-3.5 w-3.5 text-orange-500" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Zamanlanmış Duyurular ({data.upcoming.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {data.upcoming.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-2 min-w-0">
                <Icon icon="solar:calendar-bold" className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate flex-1">{item.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.channels.map((ch) => (
                    <Icon
                      key={ch}
                      icon={
                        ch === "email"
                          ? "solar:letter-bold"
                          : ch === "sms"
                            ? "solar:chat-round-dots-bold"
                            : "solar:chat-square-bold"
                      }
                      className={cn(
                        "h-3 w-3",
                        ch === "email"
                          ? "text-blue-500"
                          : ch === "sms"
                            ? "text-purple-500"
                            : "text-green-500"
                      )}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(item.nextExecuteAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 mt-auto border-t flex-shrink-0">
        <Link
          href="/dashboard/duyurular"
          className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center"
        >
          Tüm duyuruları görüntüle
        </Link>
      </div>
    </Card>
  );
});

AnnouncementWidget.displayName = "AnnouncementWidget";
