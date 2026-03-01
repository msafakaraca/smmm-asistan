"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { TaskStats } from "@/types/task";

interface TaskStatsProps {
  stats: TaskStats;
  loading?: boolean;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  iconColor: string;
  bgColor: string;
}

const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  iconColor,
  bgColor,
}: StatCardProps) {
  return (
    <div className={cn(
      "flex flex-col gap-1 px-4 py-3 rounded-lg border bg-card",
      "min-w-[140px]"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded", bgColor)}>
          <Icon icon={icon} className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
});

const StatCardSkeleton = memo(function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-lg border bg-card min-w-[140px] animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
      <div className="h-8 w-12 rounded bg-muted mt-1" />
    </div>
  );
});

export const TaskStatsDisplay = memo(function TaskStatsDisplay({
  stats,
  loading = false,
  className,
}: TaskStatsProps) {
  if (loading) {
    return (
      <div className={cn("flex flex-wrap gap-4", className)}>
        {[...Array(6)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards: StatCardProps[] = [
    {
      label: "Düşük Öncelik",
      value: stats.lowPriority,
      icon: "solar:flag-bold",
      iconColor: "#EAB308",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Orta Öncelik",
      value: stats.mediumPriority,
      icon: "solar:flag-bold",
      iconColor: "#F97316",
      bgColor: "bg-orange-50",
    },
    {
      label: "Yüksek Öncelik",
      value: stats.highPriority,
      icon: "solar:flag-bold",
      iconColor: "#EF4444",
      bgColor: "bg-red-50",
    },
    {
      label: "Toplam Görev",
      value: stats.totalTasks,
      icon: "solar:clipboard-list-bold",
      iconColor: "#3B82F6",
      bgColor: "bg-blue-50",
    },
    {
      label: "Tamamlanan",
      value: stats.completedTasks,
      icon: "solar:check-circle-bold",
      iconColor: "#22C55E",
      bgColor: "bg-green-50",
    },
    {
      label: "Gecikmiş",
      value: stats.overdueTasks,
      icon: "solar:alarm-bold",
      iconColor: "#EF4444",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-4", className)}>
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
});
