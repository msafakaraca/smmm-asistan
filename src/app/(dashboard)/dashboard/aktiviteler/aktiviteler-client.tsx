"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";
import { useActivitiesData } from "@/components/dashboard/hooks/use-activities-data";
import { actionLabels, resourceLabels, moduleContextLabels } from "@/lib/activity-descriptions";
import type { ActivityItem, ActivityAction } from "@/types/dashboard";
import { format, isToday, isYesterday, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";

// ============================================
// ACTION CONFIG (Timeline dot colors + icons)
// ============================================

const actionConfig: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string; dotColor: string }
> = {
  LOGIN: { icon: KeyRound, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/50", dotColor: "bg-blue-500" },
  LOGOUT: { icon: LogOut, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/50", dotColor: "bg-gray-400" },
  LOGIN_FAILED: { icon: ShieldAlert, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  CREATE: { icon: FilePlus, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/50", dotColor: "bg-emerald-500" },
  UPDATE: { icon: FileEdit, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/50", dotColor: "bg-amber-500" },
  DELETE: { icon: Trash2, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  VIEW: { icon: Eye, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/50", dotColor: "bg-purple-500" },
  VIEW_SENSITIVE: { icon: Lock, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/50", dotColor: "bg-orange-500" },
  EXPORT: { icon: FileDown, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/50", dotColor: "bg-cyan-500" },
  IMPORT: { icon: FileUp, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/50", dotColor: "bg-indigo-500" },
  BULK_DELETE: { icon: Trash2, color: "text-red-700", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-600" },
  BULK_UPDATE: { icon: RefreshCw, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/50", dotColor: "bg-orange-500" },
  BOT_START: { icon: Play, color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/50", dotColor: "bg-teal-500" },
  BOT_COMPLETE: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/50", dotColor: "bg-green-500" },
  BOT_ERROR: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/50", dotColor: "bg-red-500" },
  SETTINGS_UPDATE: { icon: Settings, color: "text-slate-600", bgColor: "bg-slate-100 dark:bg-slate-900/50", dotColor: "bg-slate-500" },
  PASSWORD_CHANGE: { icon: KeyRound, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/50", dotColor: "bg-amber-500" },
  PERMISSION_CHANGE: { icon: Shield, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/50", dotColor: "bg-purple-500" },
};

const defaultConfig = {
  icon: Activity,
  color: "text-muted-foreground",
  bgColor: "bg-muted",
  dotColor: "bg-muted-foreground",
};

// ============================================
// TYPES
// ============================================

interface UserOption {
  id: string;
  name: string | null;
  role: string;
}

// ============================================
// HELPERS
// ============================================

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("API request failed");
  return res.json();
};

function groupActivitiesByDay(activities: ActivityItem[]): Map<string, ActivityItem[]> {
  const groups = new Map<string, ActivityItem[]>();

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    let label: string;

    if (isToday(date)) {
      label = "Bugün";
    } else if (isYesterday(date)) {
      label = "Dün";
    } else {
      label = format(date, "d MMMM yyyy EEEE", { locale: tr });
    }

    const group = groups.get(label) || [];
    group.push(activity);
    groups.set(label, group);
  }

  return groups;
}

function formatDateForInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Avatar renkleri (baş harfe göre)
const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-red-500",
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500",
];

function getAvatarColor(name: string): string {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[idx];
}

// ============================================
// COMPONENT
// ============================================

export function AktivitelerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filtre state'leri (URL'den başlat)
  const [filterUserId, setFilterUserId] = useState(searchParams.get("userId") || "");
  const [filterAction, setFilterAction] = useState(searchParams.get("action") || "");
  const [filterResource, setFilterResource] = useState(searchParams.get("resource") || "");
  const [filterStartDate, setFilterStartDate] = useState(searchParams.get("startDate") || "");
  const [filterEndDate, setFilterEndDate] = useState(searchParams.get("endDate") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));

  // Yeni aktivite banner
  const [showNewBanner, setShowNewBanner] = useState(false);
  const [prevFirstId, setPrevFirstId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Kullanıcı listesi (filtre dropdown)
  const { data: users } = useSWR<UserOption[]>("/api/users", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
  });

  // Aktiviteler
  const { activities, total, pageSize, isLoading, isValidating } = useActivitiesData({
    page,
    userId: filterUserId || undefined,
    action: filterAction || undefined,
    resource: filterResource || undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
  });

  const totalPages = Math.ceil(total / pageSize);

  // Yeni aktivite algılama
  useEffect(() => {
    if (activities.length > 0 && prevFirstId && activities[0].id !== prevFirstId && page === 1) {
      setShowNewBanner(true);
    }
    if (activities.length > 0) {
      setPrevFirstId(activities[0].id);
    }
  }, [activities, prevFirstId, page]);

  // URL sync
  const syncUrl = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) sp.set(k, v);
      });
      const qs = sp.toString();
      router.replace(`/dashboard/aktiviteler${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router]
  );

  // Filtre değişikliğinde sayfa 1'e reset + URL güncelle
  const applyFilter = useCallback(
    (key: string, value: string) => {
      const newFilters: Record<string, string> = {
        userId: filterUserId,
        action: filterAction,
        resource: filterResource,
        startDate: filterStartDate,
        endDate: filterEndDate,
        page: "1",
      };
      newFilters[key] = value;

      // State güncelle
      switch (key) {
        case "userId": setFilterUserId(value); break;
        case "action": setFilterAction(value); break;
        case "resource": setFilterResource(value); break;
        case "startDate": setFilterStartDate(value); break;
        case "endDate": setFilterEndDate(value); break;
      }
      setPage(1);
      syncUrl(newFilters);
    },
    [filterUserId, filterAction, filterResource, filterStartDate, filterEndDate, syncUrl]
  );

  const clearFilters = useCallback(() => {
    setFilterUserId("");
    setFilterAction("");
    setFilterResource("");
    setFilterStartDate("");
    setFilterEndDate("");
    setPage(1);
    router.replace("/dashboard/aktiviteler", { scroll: false });
  }, [router]);

  // Hızlı preset butonları
  const applyPreset = useCallback(
    (preset: "today" | "week" | "month") => {
      const now = new Date();
      let start: Date;
      switch (preset) {
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          start = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case "month":
          start = startOfMonth(now);
          break;
      }
      const end = endOfDay(now);
      const startStr = formatDateForInput(start);
      const endStr = formatDateForInput(end);
      setFilterStartDate(startStr);
      setFilterEndDate(endStr);
      setPage(1);
      syncUrl({
        userId: filterUserId,
        action: filterAction,
        resource: filterResource,
        startDate: startStr,
        endDate: endStr,
        page: "1",
      });
    },
    [filterUserId, filterAction, filterResource, syncUrl]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      syncUrl({
        userId: filterUserId,
        action: filterAction,
        resource: filterResource,
        startDate: filterStartDate,
        endDate: filterEndDate,
        page: String(newPage),
      });
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [filterUserId, filterAction, filterResource, filterStartDate, filterEndDate, syncUrl]
  );

  // Aktif filtre chip'leri
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    if (filterUserId) {
      const user = users?.find((u) => u.id === filterUserId);
      chips.push({ key: "userId", label: "Kullanıcı", value: user?.name || filterUserId });
    }
    if (filterAction) {
      chips.push({ key: "action", label: "İşlem", value: actionLabels[filterAction] || filterAction });
    }
    if (filterResource) {
      chips.push({ key: "resource", label: "Kaynak", value: resourceLabels[filterResource] || filterResource });
    }
    if (filterStartDate) {
      chips.push({ key: "startDate", label: "Başlangıç", value: filterStartDate });
    }
    if (filterEndDate) {
      chips.push({ key: "endDate", label: "Bitiş", value: filterEndDate });
    }
    return chips;
  }, [filterUserId, filterAction, filterResource, filterStartDate, filterEndDate, users]);

  // Timeline gruplama
  const groupedActivities = useMemo(() => groupActivitiesByDay(activities), [activities]);

  return (
    <div className="space-y-4" ref={topRef}>
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Son Aktiviteler</h2>
          <p className="text-sm text-muted-foreground">
            Sistemdeki tüm işlemlerin zaman çizelgesi
          </p>
        </div>
        {isValidating && !isLoading && (
          <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Yeni aktivite banner */}
      {showNewBanner && (
        <div
          className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => {
            setShowNewBanner(false);
            topRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-sm font-medium">Yeni aktiviteler var</span>
          </div>
          <ArrowUp className="h-4 w-4" />
        </div>
      )}

      {/* Filtre Alanı */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtreler</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {/* Kullanıcı */}
          <Select value={filterUserId} onValueChange={(v) => applyFilter("userId", v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Kullanıcı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Kullanıcılar</SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white",
                        getAvatarColor(u.name || "?")
                      )}
                    >
                      {(u.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <span>{u.name || u.id}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* İşlem Türü */}
          <Select value={filterAction} onValueChange={(v) => applyFilter("action", v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="İşlem türü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm İşlemler</SelectItem>
              {Object.entries(actionLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Kaynak Türü */}
          <Select value={filterResource} onValueChange={(v) => applyFilter("resource", v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Kaynak türü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Kaynaklar</SelectItem>
              {Object.entries(resourceLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tarih Aralığı */}
          <Input
            type="date"
            className="h-9"
            value={filterStartDate}
            onChange={(e) => applyFilter("startDate", e.target.value)}
            placeholder="Başlangıç"
          />
          <Input
            type="date"
            className="h-9"
            value={filterEndDate}
            onChange={(e) => applyFilter("endDate", e.target.value)}
            placeholder="Bitiş"
          />
        </div>

        {/* Hızlı Preset Butonları */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Hızlı:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("today")}>
            Bugün
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("week")}>
            Bu Hafta
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset("month")}>
            Bu Ay
          </Button>

          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground ml-auto" onClick={clearFilters}>
              Filtreleri Temizle
            </Button>
          )}
        </div>

        {/* Aktif Filtre Chip'leri */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilters.map((chip) => (
              <div
                key={chip.key}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                <span>{chip.label}: {chip.value}</span>
                <button
                  onClick={() => applyFilter(chip.key, "")}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline İçeriği */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : activities.length === 0 ? (
        <EmptyState hasFilters={activeFilters.length > 0} />
      ) : (
        <div className="space-y-0">
          {Array.from(groupedActivities.entries()).map(([dayLabel, dayActivities]) => (
            <div key={dayLabel}>
              {/* Gün Başlığı */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 px-4 font-semibold text-sm border-b">
                {dayLabel}
              </div>

              {/* Timeline */}
              <div className="border-l-2 border-muted ml-6 mt-2 mb-4">
                {dayActivities.map((activity) => {
                  const config = actionConfig[activity.action] || defaultConfig;
                  const Icon = config.icon;

                  return (
                    <div
                      key={activity.id}
                      className="relative pl-8 pb-4 animate-in fade-in duration-200"
                    >
                      {/* Timeline Dot */}
                      <div
                        className={cn(
                          "absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full ring-2 ring-background",
                          config.dotColor
                        )}
                      />

                      {/* Aktivite Kartı */}
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex-shrink-0 p-1.5 rounded-full",
                            config.bgColor
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5", config.color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Primary */}
                          <p className="text-sm font-medium leading-snug text-foreground">
                            {activity.description?.primary ||
                              `${activity.userName || "Bilinmeyen"} - ${activity.action}`}
                          </p>

                          {/* Secondary */}
                          {activity.description?.secondary && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {activity.description.secondary}
                            </p>
                          )}

                          {/* Saat + Modül */}
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {format(new Date(activity.timestamp), "HH:mm", { locale: tr })}
                            {activity.resource && (
                              <span> · {moduleContextLabels[activity.resource] || activity.resource}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Toplam {total} kayıt
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Önceki
            </Button>
            <span className="text-sm font-medium px-2">
              Sayfa {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Sonraki
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-24" />
      <div className="border-l-2 border-muted ml-6 space-y-4 mt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="relative pl-8 pb-4">
            <Skeleton className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full" />
            <div className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full max-w-[280px]" />
                <Skeleton className="h-3 w-full max-w-[180px]" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Activity className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">
        {hasFilters
          ? "Bu filtrelere uygun aktivite bulunamadı"
          : "Henüz aktivite kaydı yok"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {hasFilters
          ? "Filtrelerinizi değiştirerek tekrar deneyin."
          : "Sistemdeki işlemler burada görünecek."}
      </p>
    </div>
  );
}
