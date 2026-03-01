"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { SendResult, AnnouncementChannel } from "../types";
import { getChannelLabel } from "../types";

// ============================================
// TYPES
// ============================================

interface SendResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SendResult | null;
}

// ============================================
// CHANNEL CONFIG
// ============================================

const CHANNEL_CONFIG: Record<
  AnnouncementChannel,
  { icon: string; color: string; bgColor: string }
> = {
  email: {
    icon: "solar:letter-bold",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  sms: {
    icon: "solar:smartphone-bold",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  whatsapp: {
    icon: "logos:whatsapp-icon",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
};

// ============================================
// COMPONENT
// ============================================

export function SendResultDialog({
  open,
  onOpenChange,
  result,
}: SendResultDialogProps) {
  // Group results by channel
  const channelStats = useMemo(() => {
    if (!result) return {};

    const stats: Record<
      AnnouncementChannel,
      { sent: number; failed: number; total: number }
    > = {
      email: { sent: 0, failed: 0, total: 0 },
      sms: { sent: 0, failed: 0, total: 0 },
      whatsapp: { sent: 0, failed: 0, total: 0 },
    };

    result.results.forEach((r) => {
      stats[r.channel].total++;
      if (r.status === "sent") {
        stats[r.channel].sent++;
      } else if (r.status === "failed") {
        stats[r.channel].failed++;
      }
    });

    // Filter out channels with no results
    return Object.fromEntries(
      Object.entries(stats).filter(([, v]) => v.total > 0)
    ) as Record<AnnouncementChannel, { sent: number; failed: number; total: number }>;
  }, [result]);

  // Get failed results for error display
  const failedResults = useMemo(() => {
    if (!result) return [];
    return result.results.filter((r) => r.status === "failed");
  }, [result]);

  // Determine overall status
  const isFullSuccess = result?.success && result?.failed === 0;
  const isPartialSuccess = result?.success && result && result.failed > 0;
  const isFailure = result && !result.success;

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              icon={
                isFullSuccess
                  ? "solar:check-circle-bold"
                  : isPartialSuccess
                  ? "solar:danger-triangle-bold"
                  : "solar:close-circle-bold"
              }
              className={cn(
                "w-5 h-5",
                isFullSuccess
                  ? "text-emerald-600"
                  : isPartialSuccess
                  ? "text-amber-600"
                  : "text-red-600"
              )}
            />
            Gönderim Sonucu
          </DialogTitle>
          <DialogDescription>
            Duyuru gönderim işleminin sonuçları
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Overall Status */}
          <div
            className={cn(
              "p-6 rounded-xl text-center",
              isFullSuccess
                ? "bg-emerald-50 dark:bg-emerald-950"
                : isPartialSuccess
                ? "bg-amber-50 dark:bg-amber-950"
                : "bg-red-50 dark:bg-red-950"
            )}
          >
            <div
              className={cn(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4",
                isFullSuccess
                  ? "bg-emerald-100 dark:bg-emerald-900"
                  : isPartialSuccess
                  ? "bg-amber-100 dark:bg-amber-900"
                  : "bg-red-100 dark:bg-red-900"
              )}
            >
              <Icon
                icon={
                  isFullSuccess
                    ? "solar:check-circle-bold"
                    : isPartialSuccess
                    ? "solar:danger-triangle-bold"
                    : "solar:close-circle-bold"
                }
                className={cn(
                  "w-8 h-8",
                  isFullSuccess
                    ? "text-emerald-600"
                    : isPartialSuccess
                    ? "text-amber-600"
                    : "text-red-600"
                )}
              />
            </div>
            <h3
              className={cn(
                "text-lg font-semibold mb-2",
                isFullSuccess
                  ? "text-emerald-700 dark:text-emerald-300"
                  : isPartialSuccess
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300"
              )}
            >
              {isFullSuccess
                ? "Gönderim Tamamlandı!"
                : isPartialSuccess
                ? "Gönderim Kısmen Başarılı"
                : "Gönderim Başarısız"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.sent} / {result.total} gönderim başarılı
            </p>
          </div>

          {/* Overall Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {result.total}
              </div>
              <div className="text-xs text-muted-foreground">Toplam</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">
                {result.sent}
              </div>
              <div className="text-xs text-emerald-600">Başarılı</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {result.failed}
              </div>
              <div className="text-xs text-red-600">Başarısız</div>
            </div>
          </div>

          {/* Channel-wise Statistics */}
          {Object.keys(channelStats).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Kanal Bazında Sonuçlar
              </h4>
              <div className="space-y-2">
                {(Object.entries(channelStats) as [
                  AnnouncementChannel,
                  { sent: number; failed: number; total: number }
                ][]).map(([channel, stats]) => {
                  const config = CHANNEL_CONFIG[channel];
                  const successRate =
                    stats.total > 0
                      ? Math.round((stats.sent / stats.total) * 100)
                      : 0;

                  return (
                    <div
                      key={channel}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        config.bgColor
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          icon={config.icon}
                          className={cn("w-5 h-5", config.color)}
                        />
                        <span className="text-sm font-medium">
                          {getChannelLabel(channel)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-600">
                          {stats.sent} başarılı
                        </span>
                        {stats.failed > 0 && (
                          <span className="text-red-600">
                            {stats.failed} başarısız
                          </span>
                        )}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            successRate === 100
                              ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                              : successRate >= 50
                              ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                              : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                          )}
                        >
                          %{successRate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Details */}
          {failedResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Icon
                  icon="solar:danger-circle-bold"
                  className="w-4 h-4 text-red-500"
                />
                Başarısız Gönderimler ({failedResults.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {failedResults.map((failed, index) => {
                  const channelConfig = CHANNEL_CONFIG[failed.channel];
                  return (
                    <div
                      key={`${failed.customerId}-${failed.channel}-${index}`}
                      className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm"
                    >
                      <Icon
                        icon="solar:close-circle-bold"
                        className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">
                            {failed.customerName}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              channelConfig.bgColor
                            )}
                          >
                            <Icon
                              icon={channelConfig.icon}
                              className={cn("w-3 h-3 inline", channelConfig.color)}
                            />
                          </span>
                        </div>
                        {failed.error && (
                          <p className="text-red-600 dark:text-red-400 text-xs">
                            {failed.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="min-w-[100px]">
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
