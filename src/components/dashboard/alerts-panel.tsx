"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  ChevronRight,
  Bell,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardAlert, AlertType } from "@/types/dashboard";

interface AlertsPanelProps {
  alerts: DashboardAlert[];
  loading?: boolean;
  className?: string;
}

const alertConfig: Record<
  AlertType,
  {
    icon: typeof AlertTriangle;
    bgColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  error: {
    icon: AlertCircle,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-300",
    iconColor: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-700 dark:text-amber-300",
    iconColor: "text-amber-500",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-300",
    iconColor: "text-blue-500",
  },
  success: {
    icon: CheckCircle,
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-300",
    iconColor: "text-emerald-500",
  },
};


export const AlertsPanel = memo(function AlertsPanel({
  alerts,
  loading = false,
  className,
}: AlertsPanelProps) {
  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Uyarılar</span>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Uyarılar</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
          <p className="text-sm font-medium">Her şey yolunda!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Şu anda bekleyen uyarı bulunmuyor.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Uyarılar</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {alerts.length} adet
        </span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {alerts.map((alert) => {
          const config = alertConfig[alert.type];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={cn(
                "flex gap-3 p-3 rounded-lg",
                config.bgColor
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", config.iconColor)} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", config.textColor)}>
                  {alert.title}
                  {alert.count && alert.count > 1 && (
                    <span className="ml-1.5 text-xs opacity-75">({alert.count})</span>
                  )}
                </p>
                <p className={cn("text-xs mt-0.5 opacity-80", config.textColor)}>
                  {alert.message}
                </p>
                {alert.link && alert.linkText && (
                  <Link
                    href={alert.link}
                    className={cn(
                      "inline-flex items-center gap-0.5 text-xs font-medium mt-1.5 hover:underline",
                      config.textColor
                    )}
                  >
                    {alert.linkText}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

AlertsPanel.displayName = "AlertsPanel";
