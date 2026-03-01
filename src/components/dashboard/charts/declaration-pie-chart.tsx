"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle, Clock, XCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeclarationStats } from "@/types/dashboard";

interface DeclarationPieChartProps {
  stats: DeclarationStats | null;
  loading?: boolean;
  period?: { year: number; month: number };
}

const monthNames = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// Beyanname türü için route mapping
const typeRouteMap: Record<string, string> = {
  KDV1: "/dashboard/kontrol-cizelgesi/kdv-detay",
  KDV2: "/dashboard/kontrol-cizelgesi/kdv2-detay",
  MUHSGK: "/dashboard/kontrol-cizelgesi/muhsgk-detay",
  KONAKLAMA: "/dashboard/kontrol-cizelgesi/beyanname-takip",
  GV: "/dashboard/kontrol-cizelgesi/beyanname-takip",
  DAMGA: "/dashboard/kontrol-cizelgesi/beyanname-takip",
  BA: "/dashboard/kontrol-cizelgesi/beyanname-takip",
  BS: "/dashboard/kontrol-cizelgesi/beyanname-takip",
};

export function DeclarationPieChart({
  stats,
  loading = false,
  period,
}: DeclarationPieChartProps) {
  const periodLabel = period
    ? `${monthNames[period.month - 1]} ${period.year}`
    : "";

  // Sadece verildi > 0 veya bekliyor > 0 olan türleri göster
  const activeTypes = useMemo(() => {
    if (!stats?.byType) return [];
    return stats.byType.filter(t => t.verildi > 0 || t.bekliyor > 0 || t.bos > 0);
  }, [stats?.byType]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Beyanname Durumu</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (!stats || activeTypes.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Beyanname Durumu</span>
          {periodLabel && (
            <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Bu dönem için beyanname verisi yok</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Beyanname Durumu</span>
        {periodLabel && (
          <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
        )}
      </div>

      {/* Özet */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">{stats.verildi}</span>
            <span className="text-xs text-muted-foreground">verildi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{stats.bekliyor}</span>
            <span className="text-xs text-muted-foreground">bekliyor</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-emerald-600">%{stats.completionRate}</span>
        </div>
      </div>

      {/* Beyanname Türleri */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {activeTypes.map((type) => {
          const route = typeRouteMap[type.code] || "/dashboard/kontrol-cizelgesi/beyanname-takip";
          const completionPercent = type.total > 0
            ? Math.round((type.verildi / type.total) * 100)
            : 0;

          return (
            <Link
              key={type.code}
              href={`${route}?type=${type.code}`}
              className="block"
            >
              <div className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{type.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {type.verildi}/{type.total}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Status icons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {type.verildi > 0 && (
                    <div className="flex items-center gap-0.5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">{type.verildi}</span>
                    </div>
                  )}
                  {type.bekliyor > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">{type.bekliyor}</span>
                    </div>
                  )}
                  {type.bos > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Circle className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">{type.bos}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
