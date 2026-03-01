"use client";

import Link from "next/link";
import { Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskSummaryItem } from "@/types/dashboard";

interface UpcomingTasksListProps {
  tasks: TaskSummaryItem[];
}

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const PRIORITY_LABELS = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

function getDaysLabel(daysUntil: number | undefined): string {
  if (daysUntil === undefined) return "";
  if (daysUntil === 0) return "Bugün";
  if (daysUntil === 1) return "Yarın";
  return `${daysUntil} gün`;
}

function getDaysBadgeVariant(daysUntil: number | undefined): "destructive" | "warning" | "secondary" | "outline" {
  if (daysUntil === undefined) return "outline";
  if (daysUntil === 0) return "destructive";
  if (daysUntil <= 2) return "warning";
  return "secondary";
}

export function UpcomingTasksList({ tasks }: UpcomingTasksListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="rounded-full bg-muted p-2 mb-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Yaklaşan görev yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/dashboard/gorevler?task=${task.id}`}
          className="block p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              {task.customer && (
                <p className="text-xs text-muted-foreground truncate">
                  {task.customer.kisaltma || task.customer.unvan}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] ${PRIORITY_COLORS[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <Badge
              variant={getDaysBadgeVariant(task.daysUntil)}
              className="text-[10px] font-normal"
            >
              {getDaysLabel(task.daysUntil)}
            </Badge>
            {task.assignees.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignees[0].fullName}
                {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
