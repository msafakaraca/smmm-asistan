"use client";

import Link from "next/link";
import { AlertCircle, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskSummaryItem } from "@/types/dashboard";

interface OverdueTasksListProps {
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

export function OverdueTasksList({ tasks }: OverdueTasksListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2 mb-2">
          <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-sm text-muted-foreground">Geciken görev yok</p>
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
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <Clock className="h-3 w-3" />
              {task.daysOverdue} gün gecikmiş
            </span>
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
