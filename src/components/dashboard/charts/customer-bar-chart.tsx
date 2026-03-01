"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  User,
  Briefcase,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  Mail,
  Phone,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerStats, CredentialStats } from "@/types/dashboard";

interface CustomerBarChartProps {
  stats: CustomerStats | null;
  credentials?: CredentialStats | null;
  loading?: boolean;
  className?: string;
}

interface ChartDataItem {
  name: string;
  label: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: { label?: string; value?: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
        <p className="text-sm font-medium">{data?.label}</p>
        <p className="text-sm text-muted-foreground">{data?.value} mükellef</p>
      </div>
    );
  }
  return null;
}

const COLORS = {
  firma: "#3b82f6",
  sahis: "#8b5cf6",
  basitUsul: "#14b8a6",
};

const TYPE_CONFIG = [
  { key: "firma" as const, label: "Firma", icon: Building2, color: COLORS.firma },
  { key: "sahis" as const, label: "Şahıs", icon: User, color: COLORS.sahis },
  { key: "basitUsul" as const, label: "Basit Usul", icon: Briefcase, color: COLORS.basitUsul },
];

const STATUS_CONFIG = [
  { key: "active" as const, label: "Aktif", dotColor: "bg-emerald-500", textColor: "text-emerald-600" },
  { key: "passive" as const, label: "Pasif", dotColor: "bg-red-500", textColor: "text-red-600" },
  { key: "pending" as const, label: "Bekleyen", dotColor: "bg-amber-500", textColor: "text-amber-600" },
];

export function CustomerBarChart({
  stats,
  credentials,
  loading = false,
  className,
}: CustomerBarChartProps) {
  const chartData = useMemo((): ChartDataItem[] => {
    if (!stats) return [];
    return TYPE_CONFIG
      .map((t) => ({
        name: t.key,
        label: t.label,
        value: stats[t.key],
        color: t.color,
      }))
      .filter((item) => item.value > 0);
  }, [stats]);

  const missingItems = useMemo(() => {
    if (!stats || !credentials) return [];

    const gibMissing = credentials.totalCustomers - credentials.gibComplete;
    const sgkMissing = credentials.totalCustomers - credentials.sgkComplete;

    return [
      {
        icon: KeyRound,
        label: "GİB Giriş Bilgisi",
        missing: gibMissing,
        href: "/dashboard/sifreler",
        iconColor: "text-blue-500",
      },
      {
        icon: ShieldCheck,
        label: "SGK Giriş Bilgisi",
        missing: sgkMissing,
        href: "/dashboard/sifreler",
        iconColor: "text-teal-500",
      },
      {
        icon: Mail,
        label: "E-posta Adresi",
        missing: stats.emailMissing,
        href: "/dashboard/mukellefler",
        iconColor: "text-violet-500",
      },
      {
        icon: Phone,
        label: "Telefon Numarası",
        missing: stats.telefonMissing,
        href: "/dashboard/mukellefler",
        iconColor: "text-orange-500",
      },
    ];
  }, [stats, credentials]);

  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Müşteri Portföyü</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-[100px] w-[100px] rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-full mb-2" />
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Müşteri Portföyü</span>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Henüz müşteri kaydı yok</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Müşteri Portföyü</span>
        </div>
        <Link
          href="/dashboard/mukellefler"
          className="text-xs text-primary hover:underline"
        >
          Tümünü Gör
        </Link>
      </div>

      {/* Donut Chart + Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="h-[100px] w-[100px] flex-shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={46}
                paddingAngle={2}
                dataKey="value"
                nameKey="label"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{stats.total}</span>
            <span className="text-[10px] text-muted-foreground leading-none">Toplam</span>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {TYPE_CONFIG.map((t) => {
            const value = stats[t.key];
            if (value === 0) return null;
            const pct = Math.round((value / stats.total) * 100);
            const Icon = t.icon;
            return (
              <div key={t.key} className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center h-7 w-7 rounded-lg"
                  style={{ backgroundColor: `${t.color}18` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                </div>
                <span className="text-sm flex-1">{t.label}</span>
                <span className="text-sm font-semibold w-6 text-right">{value}</span>
                <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: t.color }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8">%{pct}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Durum Satırı */}
      <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-muted/40 mb-3">
        {STATUS_CONFIG.map((s) => {
          const value = stats[s.key];
          return (
            <Link
              key={s.key}
              href="/dashboard/mukellefler"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <div className={cn("h-2.5 w-2.5 rounded-full", s.dotColor)} />
              <span className={cn("text-sm font-semibold", s.textColor)}>{value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Eksik Bilgiler */}
      <div className="mb-3">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block">
          Eksik Bilgiler
        </span>
        <div className="space-y-1">
          {missingItems.map((item) => {
            const Icon = item.icon;
            const hasMissing = item.missing > 0;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg border transition-colors group",
                  hasMissing
                    ? "border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20"
                    : "border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", item.iconColor)} />
                <span className="text-xs flex-1">{item.label}</span>
                {hasMissing ? (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {item.missing} eksik
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Tam
                  </span>
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Gruplar */}
      {stats.groups && stats.groups.length > 0 && (
        <div className="mb-3">
          <Link
            href="/dashboard/mukellefler"
            className="flex items-center gap-1.5 mb-1.5 group"
          >
            <UsersRound className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Gruplar
            </span>
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground ml-auto transition-colors" />
          </Link>
          <div className="flex flex-wrap gap-1.5">
            {stats.groups.slice(0, 4).map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
                style={{
                  backgroundColor: `${g.color}12`,
                  borderColor: `${g.color}30`,
                  color: g.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                {g.name}
                <span className="opacity-60">{g.count}</span>
              </span>
            ))}
            {stats.groups.length > 4 && (
              <span className="text-[11px] text-muted-foreground self-center">
                +{stats.groups.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Yeni Müşteriler */}
      <div className="mt-auto pt-2 border-t border-border">
        <Link
          href="/dashboard/mukellefler"
          className="flex items-center gap-1.5 group"
        >
          <UserPlus className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            Bu ay +{stats.newThisMonth} yeni
          </span>
          {stats.recentCustomers && stats.recentCustomers.length > 0 && (
            <span className="text-[11px] text-muted-foreground truncate flex-1">
              {stats.recentCustomers
                .slice(0, 2)
                .map((c) => c.kisaltma || c.unvan)
                .join(", ")}
            </span>
          )}
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
        </Link>
      </div>
    </Card>
  );
}
