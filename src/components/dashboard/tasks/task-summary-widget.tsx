"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ListTodo,
  AlertCircle,
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowRight,
  Calendar,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TaskSummaryData, TaskSummaryItem } from "@/types/dashboard";

interface TaskSummaryWidgetProps {
  className?: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
}

function formatDaysLabel(days: number | undefined, isOverdue: boolean): string {
  if (days === undefined) return "";
  if (days === 0) return "Bugün";
  if (days === 1) return isOverdue ? "1 gün gecikmiş" : "Yarın";
  return isOverdue ? `${days} gün gecikmiş` : `${days} gün`;
}

export function TaskSummaryWidget({ className }: TaskSummaryWidgetProps) {
  const [data, setData] = useState<TaskSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch("/api/dashboard/tasks-summary?limit=10");
      if (!res.ok) throw new Error("Görev özeti yüklenemedi");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error("Error fetching task summary:", err);
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
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ListTodo className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Görev Özeti</span>
        </div>
        <div className="space-y-3 flex-1">
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <Skeleton className="h-[52px] rounded-lg" />
          <Skeleton className="h-[52px] rounded-lg" />
          <Skeleton className="h-[52px] rounded-lg" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ListTodo className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Görev Özeti</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <AlertCircle className="h-8 w-8 text-destructive/40 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  // Empty state
  if (!data || data.stats.total === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <ListTodo className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Görev Özeti</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <ListTodo className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Henüz görev yok</p>
        </div>
      </Card>
    );
  }

  const { stats, overdueTasks, upcomingTasks, todayTasks } = data;

  // Tüm görevleri birleştir
  const allTasks: { task: TaskSummaryItem; isOverdue: boolean }[] = [];

  overdueTasks.forEach(task => {
    allTasks.push({ task, isOverdue: true });
  });

  if (todayTasks) {
    todayTasks.forEach(task => {
      if (!allTasks.find(t => t.task.id === task.id)) {
        allTasks.push({ task, isOverdue: false });
      }
    });
  }

  upcomingTasks.forEach(task => {
    if (!allTasks.find(t => t.task.id === task.id)) {
      allTasks.push({ task, isOverdue: false });
    }
  });

  const tasksToShow = allTasks.slice(0, 3);

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Görev Özeti</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
          <Link
            href="/dashboard/gorevler"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            Tümü
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {/* Yapılacak */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <Circle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">{stats.todo}</span>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Yapılacak</p>
          </div>
        </div>

        {/* Devam Eden */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none">{stats.inProgress}</span>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Devam Eden</p>
          </div>
        </div>

        {/* Tamamlanan */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">{stats.completed}</span>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Tamamlanan</p>
          </div>
        </div>

        {/* Geciken */}
        <div className={cn(
          "flex items-center gap-2 p-2.5 rounded-lg border",
          stats.overdue > 0
            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
            : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
        )}>
          <AlertTriangle className={cn(
            "h-4 w-4",
            stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"
          )} />
          <div>
            <span className={cn(
              "text-lg font-bold leading-none",
              stats.overdue > 0 ? "text-red-700 dark:text-red-300" : "text-slate-500"
            )}>{stats.overdue}</span>
            <p className={cn(
              "text-[10px] mt-0.5",
              stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"
            )}>Geciken</p>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {tasksToShow.length > 0 ? (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Yaklaşan Görevler
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-hidden">
              {tasksToShow.map(({ task, isOverdue }) => (
                <TaskItem key={task.id} task={task} isOverdue={isOverdue} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1" />
              <span className="text-xs text-muted-foreground">Yaklaşan görev yok</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const AVATAR_COLORS = [
  "bg-violet-500 text-white",
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-pink-500 text-white",
] as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function TaskItem({ task, isOverdue }: { task: TaskSummaryItem; isOverdue: boolean }) {
  const dueLabel = formatDaysLabel(
    isOverdue ? task.daysOverdue : task.daysUntil,
    isOverdue
  );
  const dateLabel = formatDate(task.dueDate);

  return (
    <Link
      href={`/dashboard/gorevler?task=${task.id}`}
      className={cn(
        "block px-2.5 py-2 rounded-lg border transition-all",
        "hover:shadow-sm hover:border-primary/30",
        isOverdue
          ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
          : "bg-card border-border hover:bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Priority Indicator */}
        <div className={cn(
          "w-1 h-8 rounded-full shrink-0",
          isOverdue ? "bg-red-500" :
          task.priority === "high" ? "bg-red-500" :
          task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"
        )} />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="font-medium text-sm truncate leading-tight">
            {task.title}
          </h4>

          {/* Meta Row */}
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium",
              task.priority === "high"
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                : task.priority === "medium"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
            )}>
              {PRIORITY_LABELS[task.priority]}
            </span>

            <span className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {dateLabel}
              {dueLabel && <span className="text-[10px]">({dueLabel})</span>}
            </span>

            {/* Oluşturan */}
            {task.createdBy && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <UserRound className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{task.createdBy.fullName}</span>
              </span>
            )}

            {/* Atanan kişiler */}
            {task.assignees.length > 0 && (
              <TooltipProvider>
                <div className="flex items-center gap-1 ml-auto">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Tooltip key={assignee.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-5 w-5 ring-1 ring-background">
                          <AvatarImage src={assignee.image || undefined} alt={assignee.fullName} />
                          <AvatarFallback className={cn("text-[8px] font-semibold", getAvatarColor(assignee.id))}>
                            {getInitials(assignee.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {assignee.fullName}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {task.assignees.length > 3 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-5 w-5 ring-1 ring-background">
                          <AvatarFallback className="text-[8px] font-semibold bg-slate-600 text-white">
                            +{task.assignees.length - 3}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {task.assignees.slice(3).map(a => a.fullName).join(", ")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
