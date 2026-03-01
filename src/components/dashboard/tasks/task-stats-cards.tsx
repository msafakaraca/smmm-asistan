"use client";

import { cn } from "@/lib/utils";
import {
  ListTodo,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { TaskSummaryStats } from "@/types/dashboard";

interface TaskStatsCardsProps {
  stats: TaskSummaryStats;
  className?: string;
}

interface MiniStatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

function MiniStatCard({ title, value, icon, colorClass }: MiniStatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-2.5 rounded-lg border",
        colorClass
      )}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

export function TaskStatsCards({ stats, className }: TaskStatsCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      <MiniStatCard
        title="Toplam"
        value={stats.total}
        icon={<ListTodo className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        colorClass="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
      />
      <MiniStatCard
        title="Devam Eden"
        value={stats.inProgress}
        icon={<PlayCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        colorClass="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
      />
      <MiniStatCard
        title="Tamamlanan"
        value={stats.completed}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        colorClass="bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
      />
      <MiniStatCard
        title="Geciken"
        value={stats.overdue}
        icon={<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
        colorClass={cn(
          "border",
          stats.overdue > 0
            ? "bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-700"
            : "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800"
        )}
      />
    </div>
  );
}
