"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";

export interface StatsSummary {
  pendingTotal: number;
  thisMonthCollected: number;
  thisMonthExpenses: number;
  netProfit: number;
  collectionRate: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
}

export interface MonthlyTrendItem {
  month: string;
  income: number;
  expense: number;
}

export interface TopDebtorItem {
  customerId: string;
  customerName: string;
  total: number;
}

export interface StatsData {
  summary: StatsSummary;
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  topDebtors: TopDebtorItem[];
}

interface UseStatsParams {
  year?: number;
  month?: number;
}

export function useStats(params?: UseStatsParams) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(
    async (overrideParams?: UseStatsParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        const p = overrideParams || params;
        const searchParams = new URLSearchParams();
        if (p?.year) searchParams.set("year", String(p.year));
        if (p?.month) searchParams.set("month", String(p.month));

        const qs = searchParams.toString();
        const url = qs ? `/api/finance/stats?${qs}` : "/api/finance/stats";

        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("İstatistikler yüklenemedi");
        const data: StatsData = await res.json();
        setStats(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("İstatistik yükleme hatası:", error);
        toast.error("İstatistikler yüklenirken hata oluştu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [params?.year, params?.month]
  );

  useEffect(() => {
    fetchStats();
    return () => abortRef.current?.abort();
  }, [fetchStats]);

  return { stats, loading, fetchStats };
}
