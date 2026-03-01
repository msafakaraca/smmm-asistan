"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle, PlusCircle } from "lucide-react";
import type { TaskSummaryStats } from "@/types/dashboard";

interface WeeklyTrendProps {
  stats: TaskSummaryStats;
  className?: string;
}

export function WeeklyTrend({ stats, className }: WeeklyTrendProps) {
  const { weeklyComparison } = stats;
  const { trend, changePercent, completedThisWeek, completedLastWeek, createdThisWeek } = weeklyComparison;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up"
    ? "text-emerald-600 dark:text-emerald-400"
    : trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";
  const trendBgColor = trend === "up"
    ? "bg-emerald-50 dark:bg-emerald-900/20"
    : trend === "down"
      ? "bg-red-50 dark:bg-red-900/20"
      : "bg-muted";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Trend Özeti */}
      <div className={cn("flex items-center justify-between p-2.5 rounded-lg", trendBgColor)}>
        <div className="flex items-center gap-2">
          <TrendIcon className={cn("h-4 w-4", trendColor)} />
          <div>
            <span className="text-xs font-medium">Haftalık Trend</span>
            <p className={cn("text-lg font-bold leading-none mt-0.5", trendColor)}>
              {trend === "stable" ? "Sabit" : `%${changePercent}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Geçen hafta</p>
          <p className="text-sm font-semibold">{completedLastWeek} tamamlandı</p>
        </div>
      </div>

      {/* Bu Hafta Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Bu hafta tamamlanan</p>
            <p className="text-sm font-bold">{completedThisWeek}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <PlusCircle className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-[10px] text-muted-foreground">Bu hafta oluşturulan</p>
            <p className="text-sm font-bold">{createdThisWeek}</p>
          </div>
        </div>
      </div>

      {/* Bugün/Yarın */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          <span className="text-muted-foreground">Bugün:</span>
          <span className="font-medium">{stats.dueToday} görev</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
          <span className="text-muted-foreground">Yarın:</span>
          <span className="font-medium">{stats.dueTomorrow} görev</span>
        </div>
      </div>
    </div>
  );
}
