"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  KeyRound,
  LogOut,
  ShieldAlert,
  FilePlus,
  FileEdit,
  Trash2,
  Eye,
  Lock,
  FileDown,
  FileUp,
  RefreshCw,
  Play,
  CheckCircle,
  AlertTriangle,
  Settings,
  Shield,
  Activity,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem, ActivityAction } from "@/types/dashboard";
import { moduleContextLabels } from "@/lib/activity-descriptions";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading?: boolean;
  className?: string;
}

const actionConfig: Record<
  ActivityAction,
  {
    icon: LucideIcon;
    label: string;
    color: string;
    bgColor: string;
    dotColor: string;
  }
> = {
  LOGIN: { icon: KeyRound, label: "Giriş yaptı", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/50", dotColor: "bg-blue-500" },
  LOGOUT: { icon: LogOut, label: "Çıkış yaptı", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/50", dotColor: "bg-gray-400" },
  LOGIN_FAILED: { icon: ShieldAlert, label: "Başarısız giriş", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  CREATE: { icon: FilePlus, label: "Oluşturdu", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/50", dotColor: "bg-emerald-500" },
  UPDATE: { icon: FileEdit, label: "Güncelledi", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/50", dotColor: "bg-amber-500" },
  DELETE: { icon: Trash2, label: "Sildi", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  VIEW: { icon: Eye, label: "Görüntüledi", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/50", dotColor: "bg-purple-500" },
  VIEW_SENSITIVE: { icon: Lock, label: "Hassas bilgi görüntüledi", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/50", dotColor: "bg-orange-500" },
  EXPORT: { icon: FileDown, label: "Dışa aktardı", color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/50", dotColor: "bg-cyan-500" },
  IMPORT: { icon: FileUp, label: "İçe aktardı", color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/50", dotColor: "bg-indigo-500" },
  BULK_DELETE: { icon: Trash2, label: "Toplu sildi", color: "text-red-700", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-600" },
  BULK_UPDATE: { icon: RefreshCw, label: "Toplu güncelledi", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/50", dotColor: "bg-orange-500" },
  BOT_START: { icon: Play, label: "Bot başlattı", color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/50", dotColor: "bg-teal-500" },
  BOT_COMPLETE: { icon: CheckCircle, label: "Bot tamamladı", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/50", dotColor: "bg-green-500" },
  BOT_ERROR: { icon: AlertTriangle, label: "Bot hatası", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  SETTINGS_UPDATE: { icon: Settings, label: "Ayarları güncelledi", color: "text-slate-600", bgColor: "bg-slate-100 dark:bg-slate-900/50", dotColor: "bg-slate-500" },
  PASSWORD_CHANGE: { icon: KeyRound, label: "Şifre değiştirdi", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/50", dotColor: "bg-amber-500" },
  PERMISSION_CHANGE: { icon: Shield, label: "Yetki değiştirdi", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/50", dotColor: "bg-purple-500" },
};

function getActionConfig(action: ActivityAction) {
  return actionConfig[action] || {
    icon: Activity,
    label: action,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    dotColor: "bg-muted-foreground",
  };
}

function formatTimestamp(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: tr,
    });
  } catch {
    return timestamp;
  }
}

function formatTime(timestamp: string): string {
  try {
    return format(new Date(timestamp), "HH:mm", { locale: tr });
  } catch {
    return "";
  }
}

const ActivityItemCard = memo(function ActivityItemCard({
  activity,
  isNew,
}: {
  activity: ActivityItem;
  isNew?: boolean;
}) {
  const config = getActionConfig(activity.action);
  const Icon = config.icon;
  const description = activity.description;

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2",
        isNew && "animate-in fade-in slide-in-from-top-2 duration-300"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 p-1.5 rounded-full mt-0.5",
          config.bgColor
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Katman 1: Primary */}
        <p className="text-sm font-medium leading-snug text-foreground truncate">
          {description?.primary || `${activity.userName || "Bilinmeyen"} ${config.label.toLowerCase()}`}
        </p>

        {/* Katman 2: Secondary */}
        {description?.secondary && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {description.secondary}
          </p>
        )}

        {/* Katman 3: Timestamp + Modül */}
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          {formatTime(activity.timestamp)} · {formatTimestamp(activity.timestamp)}
          {activity.resource && (
            <span> · {moduleContextLabels[activity.resource] || activity.resource}</span>
          )}
        </p>
      </div>
    </div>
  );
});

ActivityItemCard.displayName = "ActivityItemCard";

export const ActivityFeed = memo(function ActivityFeed({
  activities,
  loading = false,
  className,
}: ActivityFeedProps) {
  const displayActivities = useMemo(() => activities.slice(0, 10), [activities]);

  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Son Aktiviteler</span>
          </div>
        </div>
        <div className="space-y-3 flex-1 overflow-y-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full max-w-[200px]" />
                <Skeleton className="h-3 w-full max-w-[140px]" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Son Aktiviteler</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
          <Activity className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Henüz aktivite yok</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sistemdeki işlemler burada görünecek.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      {/* Başlık + Tümünü Gör */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Son Aktiviteler</span>
        </div>
        <Link
          href="/dashboard/aktiviteler"
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          Tümünü Gör
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Aktivite Listesi */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {displayActivities.map((activity) => (
          <ActivityItemCard key={activity.id} activity={activity} />
        ))}
      </div>

      {/* Alt link */}
      <div className="pt-2 mt-2 border-t flex-shrink-0">
        <Link
          href="/dashboard/aktiviteler"
          className="text-xs text-muted-foreground hover:text-primary transition-colors block text-center"
        >
          Daha fazla...
        </Link>
      </div>
    </Card>
  );
});

ActivityFeed.displayName = "ActivityFeed";
