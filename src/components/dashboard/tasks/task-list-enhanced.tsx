"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Clock,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TaskSummaryItem } from "@/types/dashboard";

interface TaskListEnhancedProps {
  tasks: TaskSummaryItem[];
  type: "overdue" | "upcoming" | "today" | "completed";
  emptyMessage?: string;
  className?: string;
  maxItems?: number;
}

const PRIORITY_CONFIG = {
  high: {
    label: "Yüksek",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  medium: {
    label: "Orta",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  low: {
    label: "Düşük",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
};

const STATUS_CONFIG = {
  todo: {
    label: "Yapılacak",
    icon: Clock,
    color: "text-slate-500",
  },
  in_progress: {
    label: "Devam Ediyor",
    icon: PlayCircle,
    color: "text-amber-500",
  },
  completed: {
    label: "Tamamlandı",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDueLabel(type: "overdue" | "upcoming" | "today" | "completed", task: TaskSummaryItem): string {
  if (type === "overdue" && task.daysOverdue !== undefined) {
    if (task.daysOverdue === 1) return "1 gün gecikmiş";
    return `${task.daysOverdue} gün gecikmiş`;
  }
  if (type === "upcoming" && task.daysUntil !== undefined) {
    if (task.daysUntil === 0) return "Bugün";
    if (task.daysUntil === 1) return "Yarın";
    return `${task.daysUntil} gün`;
  }
  if (type === "today") return "Bugün";
  return "";
}

export function TaskListEnhanced({
  tasks,
  type,
  emptyMessage,
  className,
  maxItems = 5,
}: TaskListEnhancedProps) {
  const displayTasks = tasks.slice(0, maxItems);

  if (tasks.length === 0) {
    const defaultMessages = {
      overdue: "Geciken görev yok",
      upcoming: "Yaklaşan görev yok",
      today: "Bugün biten görev yok",
      completed: "Tamamlanan görev yok",
    };

    const icons = {
      overdue: CheckCircle2,
      upcoming: Calendar,
      today: Clock,
      completed: CheckCircle2,
    };

    const IconComponent = icons[type];

    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="rounded-full bg-muted p-2 mb-2">
          <IconComponent className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage || defaultMessages[type]}</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-1", className)}>
        {displayTasks.map((task) => (
          <TaskRow key={task.id} task={task} type={type} />
        ))}

        {/* Daha fazla varsa */}
        {tasks.length > maxItems && (
          <Link
            href="/dashboard/gorevler"
            className="flex items-center justify-center gap-1 py-1.5 text-xs text-primary hover:underline"
          >
            <span>+{tasks.length - maxItems} görev daha</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </TooltipProvider>
  );
}

function TaskRow({ task, type }: { task: TaskSummaryItem; type: "overdue" | "upcoming" | "today" | "completed" }) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const statusConfig = STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;
  const dueLabel = formatDueLabel(type, task);

  return (
    <Link
      href={`/dashboard/gorevler?task=${task.id}`}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg transition-all",
        "hover:bg-muted/70 border border-transparent hover:border-border",
        type === "overdue" && "bg-red-50/50 dark:bg-red-900/10"
      )}
    >
      {/* Priority Dot + Status Icon */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className={cn("h-2 w-2 rounded-full", priorityConfig.dot)} />
        <StatusIcon className={cn("h-3 w-3", statusConfig.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {task.title}
            </p>
            {task.customer && (
              <p className="text-xs text-muted-foreground truncate">
                {task.customer.kisaltma || task.customer.unvan}
              </p>
            )}
          </div>

          {/* Priority Badge */}
          <Badge
            variant="outline"
            className={cn("shrink-0 text-[10px] h-5", priorityConfig.color)}
          >
            {priorityConfig.label}
          </Badge>
        </div>

        {/* Meta Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Left side: Due label */}
          <div className="flex items-center gap-2 text-xs">
            {type === "overdue" ? (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {dueLabel}
              </span>
            ) : dueLabel ? (
              <Badge
                variant={type === "today" ? "warning" : "secondary"}
                className="text-[10px] font-normal h-4"
              >
                {dueLabel}
              </Badge>
            ) : null}
          </div>

          {/* Right side: Assignees */}
          {task.assignees.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {task.assignees.slice(0, 3).map((assignee) => (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-5 w-5 border-2 border-background">
                      <AvatarImage src={assignee.image || undefined} alt={assignee.fullName} />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
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
                <span className="ml-1.5 text-[10px] text-muted-foreground">
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Arrow on hover */}
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
