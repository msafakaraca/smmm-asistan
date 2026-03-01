"use client";

import { useState, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStats } from "@/components/finansal-islemler/hooks/use-stats";
import { StatsSummaryCards } from "@/components/finansal-islemler/istatistikler/stats-summary-cards";
import { IncomePieChart } from "@/components/finansal-islemler/istatistikler/income-pie-chart";
import { MonthlyBarChart } from "@/components/finansal-islemler/istatistikler/monthly-bar-chart";
import { CollectionPerformance } from "@/components/finansal-islemler/istatistikler/collection-performance";

const MONTHS = [
  { value: "1", label: "Ocak" },
  { value: "2", label: "Şubat" },
  { value: "3", label: "Mart" },
  { value: "4", label: "Nisan" },
  { value: "5", label: "Mayıs" },
  { value: "6", label: "Haziran" },
  { value: "7", label: "Temmuz" },
  { value: "8", label: "Ağustos" },
  { value: "9", label: "Eylül" },
  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasım" },
  { value: "12", label: "Aralık" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

export default function IstatistiklerPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { stats, loading, fetchStats } = useStats({
    year: selectedYear,
    month: selectedMonth,
  });

  const handleMonthChange = useCallback(
    (value: string) => {
      const m = parseInt(value);
      setSelectedMonth(m);
      fetchStats({ year: selectedYear, month: m });
    },
    [selectedYear, fetchStats]
  );

  const handleYearChange = useCallback(
    (value: string) => {
      const y = parseInt(value);
      setSelectedYear(y);
      fetchStats({ year: y, month: selectedMonth });
    },
    [selectedMonth, fetchStats]
  );

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header + Filtreler */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">İstatistikler</h1>
            <p className="text-muted-foreground">
              Finansal raporlar, grafikler ve performans göstergeleri
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedMonth)}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedYear)}
            onValueChange={handleYearChange}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* İçerik */}
      {loading ? (
        <StatsLoadingSkeleton />
      ) : stats ? (
        <>
          {/* Summary Kartları */}
          <StatsSummaryCards summary={stats.summary} />

          {/* Grafikler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IncomePieChart data={stats.categoryBreakdown} />
            <MonthlyBarChart data={stats.monthlyTrend} />
          </div>

          {/* Tahsilat Performansı */}
          <CollectionPerformance
            collectionRate={stats.summary.collectionRate}
            topDebtors={stats.topDebtors}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          İstatistik verisi yüklenemedi
        </div>
      )}
    </div>
  );
}

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary kartları skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[80px] rounded-lg" />
        ))}
      </div>

      {/* Grafikler skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[400px] rounded-lg" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>

      {/* Performans skeleton */}
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  );
}
