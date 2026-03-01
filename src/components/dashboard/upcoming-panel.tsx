"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  StickyNote,
  Calendar,
  Clock,
  ChevronRight,
  User,
} from "lucide-react";
import type { UpcomingReminder } from "@/types/dashboard";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface UpcomingPanelProps {
  events: UpcomingReminder[];
  tasks: UpcomingReminder[];
  loading?: boolean;
  className?: string;
}


function getDaysUntilBadge(daysUntil: number) {
  if (daysUntil === 0) {
    return { label: "Bugün", variant: "destructive" as const };
  } else if (daysUntil === 1) {
    return { label: "Yarın", variant: "warning" as const };
  } else if (daysUntil <= 3) {
    return { label: `${daysUntil} gün`, variant: "warning" as const };
  } else if (daysUntil <= 7) {
    return { label: `${daysUntil} gün`, variant: "secondary" as const };
  } else {
    return { label: `${daysUntil} gün`, variant: "outline" as const };
  }
}

function formatReminderDate(dateStr: string, isAllDay: boolean, startTime?: string | null, daysUntil?: number) {
  const date = new Date(dateStr);

  // Bugünse sadece saati göster (varsa)
  if (daysUntil === 0) {
    if (isAllDay) {
      return "Bugün (Tüm gün)";
    }
    if (startTime) {
      return `Bugün ${startTime}`;
    }
    return "Bugün";
  }

  // Yarınsa
  if (daysUntil === 1) {
    if (isAllDay) {
      return "Yarın (Tüm gün)";
    }
    if (startTime) {
      return `Yarın ${startTime}`;
    }
    return "Yarın";
  }

  // Diğer günler
  const dateFormatted = format(date, "d MMM", { locale: tr });

  if (isAllDay) {
    return dateFormatted;
  }

  if (startTime) {
    return `${dateFormatted} ${startTime}`;
  }

  return dateFormatted;
}

function ReminderItem({ item, type }: { item: UpcomingReminder; type: "event" | "task" }) {
  const { label, variant } = getDaysUntilBadge(item.daysUntil);
  const Icon = type === "event" ? Bell : StickyNote;

  // Müşteri bilgisi
  const customerName = item.customer?.kisaltma || item.customer?.unvan ||
    (item.customers && item.customers.length > 0
      ? item.customers[0].kisaltma || item.customers[0].unvan
      : null);

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div
        className={cn(
          "flex-shrink-0 p-1.5 rounded",
          type === "event"
            ? "bg-blue-100 dark:bg-blue-900/50"
            : "bg-amber-100 dark:bg-amber-900/50"
        )}
      >
        <Icon className={cn(
          "h-3.5 w-3.5",
          type === "event" ? "text-blue-600" : "text-amber-600"
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={cn(
            "text-xs flex items-center gap-1",
            item.daysUntil === 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
          )}>
            {item.startTime && !item.isAllDay ? (
              <Clock className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {formatReminderDate(item.date, item.isAllDay, item.startTime, item.daysUntil)}
          </span>
          {customerName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <User className="h-3 w-3" />
              {customerName}
            </span>
          )}
        </div>
      </div>

      <Badge variant={variant} className="text-[10px] px-1.5 py-0 h-5">
        {label}
      </Badge>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count, href }: {
  icon: React.ElementType;
  title: string;
  count: number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
        {count > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {count}
          </Badge>
        )}
      </div>
      <Link
        href={href}
        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
      >
        Tümü
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <Skeleton className="h-7 w-7 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ type }: { type: "event" | "task" }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {type === "event" ? (
        <Bell className="h-8 w-8 text-muted-foreground/40 mb-1" />
      ) : (
        <StickyNote className="h-8 w-8 text-muted-foreground/40 mb-1" />
      )}
      <p className="text-xs text-muted-foreground">
        {type === "event"
          ? "Yaklaşan anımsatıcı yok"
          : "Yaklaşan not yok"}
      </p>
    </div>
  );
}

export const UpcomingPanel = memo(function UpcomingPanel({
  events,
  tasks,
  loading = false,
  className,
}: UpcomingPanelProps) {
  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex flex-col flex-1 gap-4 min-h-0">
          {/* Anımsatıcılar Loading */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <LoadingSkeleton />
            </div>
          </div>
          {/* Notlar Loading */}
          <div className="flex-1 min-h-0 flex flex-col border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <LoadingSkeleton />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      <div className="flex flex-col flex-1 gap-4 min-h-0">
        {/* Anımsatıcılar */}
        <div className="flex-1 min-h-0 flex flex-col">
          <SectionTitle
            icon={Bell}
            title="Anımsatıcılar"
            count={events.length}
            href="/dashboard/animsaticilar"
          />
          <div className="flex-1 overflow-y-auto">
            {events.length > 0 ? (
              <div>
                {events.map((event) => (
                  <ReminderItem key={event.id} item={event} type="event" />
                ))}
              </div>
            ) : (
              <EmptyState type="event" />
            )}
          </div>
        </div>

        {/* Notlar */}
        <div className="flex-1 min-h-0 flex flex-col border-t pt-4">
          <SectionTitle
            icon={StickyNote}
            title="Notlar"
            count={tasks.length}
            href="/dashboard/animsaticilar"
          />
          <div className="flex-1 overflow-y-auto">
            {tasks.length > 0 ? (
              <div>
                {tasks.map((task) => (
                  <ReminderItem key={task.id} item={task} type="task" />
                ))}
              </div>
            ) : (
              <EmptyState type="task" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

UpcomingPanel.displayName = "UpcomingPanel";
