"use client";

import { useState, useCallback } from "react";

// ============================================
// Tipler
// ============================================

export interface ArchiveSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerVkn: string;
  month: number;
  year: number;
  queryType: string;
  totalCount: number;
  totalAmount: number;
  lastQueriedAt: string;
  queryCount: number;
  createdAt: string;
}

export interface ArchiveDetail {
  id: string;
  customerId: string;
  queryType: string;
  month: number;
  year: number;
  resultData: unknown[];
  resultMeta: Record<string, unknown> | null;
  queryHistory: Array<{
    date: string;
    params: Record<string, unknown>;
    addedCount: number;
  }>;
  lastQueriedAt: string;
  customers: { unvan: string; kisaltma: string | null; vknTckn: string };
}

export interface OverlapInfo {
  hasOverlap: boolean;
  archiveId?: string;
  month?: number;
  year?: number;
  totalCount?: number;
  totalAmount?: number;
  lastQueriedAt?: string;
  customerName?: string;
}

export interface ArchiveFilter {
  queryType: string;
  customerIds?: string[];
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
}

export interface SaveResult {
  action: "created" | "merged";
  id: string;
  totalCount: number;
  addedCount: number;
}

interface ArchiveSummaryResponse {
  totalArchives: number;
  grandTotalCount: number;
  grandTotalAmount: number;
}

// ============================================
// API'den gelen ham veri tipi
// ============================================
interface RawArchive {
  id: string;
  customerId: string;
  month: number;
  year: number;
  queryType: string;
  totalCount: number;
  totalAmount: number | null;
  lastQueriedAt: string;
  queryCount: number;
  createdAt: string;
  customers: { unvan: string; kisaltma: string | null; vknTckn: string };
}

// ============================================
// Hook
// ============================================

export function useQueryArchives() {
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ArchiveSummaryResponse | null>(null);

  const loadArchives = useCallback(async (filter: ArchiveFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("queryType", filter.queryType);
      if (filter.customerIds?.length) {
        params.set("customerIds", filter.customerIds.join(","));
      }
      if (filter.startMonth) params.set("startMonth", String(filter.startMonth));
      if (filter.startYear) params.set("startYear", String(filter.startYear));
      if (filter.endMonth) params.set("endMonth", String(filter.endMonth));
      if (filter.endYear) params.set("endYear", String(filter.endYear));

      const res = await fetch(`/api/query-archives?${params.toString()}`);
      if (!res.ok) throw new Error("Arşiv yüklenemedi");

      const data = await res.json();

      const mapped: ArchiveSummary[] = (data.archives as RawArchive[]).map(
        (a) => ({
          id: a.id,
          customerId: a.customerId,
          customerName: a.customers.kisaltma || a.customers.unvan,
          customerVkn: a.customers.vknTckn,
          month: a.month,
          year: a.year,
          queryType: a.queryType,
          totalCount: a.totalCount,
          totalAmount: a.totalAmount ? Number(a.totalAmount) : 0,
          lastQueriedAt: a.lastQueriedAt,
          queryCount: a.queryCount,
          createdAt: a.createdAt,
        })
      );

      setArchives(mapped);
      setSummary(data.summary);
      return mapped;
    } catch (error) {
      console.error("[useQueryArchives] loadArchives hatası:", error);
      setArchives([]);
      setSummary(null);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchiveDetail = useCallback(
    async (id: string): Promise<ArchiveDetail | null> => {
      try {
        const res = await fetch(`/api/query-archives/${id}`);
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error("[useQueryArchives] loadArchiveDetail hatası:", error);
        return null;
      }
    },
    []
  );

  const checkOverlap = useCallback(
    async (
      queryType: string,
      customerId: string,
      month: number,
      year: number
    ): Promise<OverlapInfo> => {
      try {
        const res = await fetch("/api/query-archives/check-overlap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, queryType, month, year }),
        });
        if (!res.ok) return { hasOverlap: false };
        return await res.json();
      } catch {
        return { hasOverlap: false };
      }
    },
    []
  );

  const saveOrMerge = useCallback(
    async (
      queryType: string,
      customerId: string,
      month: number,
      year: number,
      results: unknown[],
      params: Record<string, unknown>,
      dedupKey?: string[],
      meta?: Record<string, unknown>
    ): Promise<SaveResult | null> => {
      try {
        const res = await fetch("/api/query-archives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            queryType,
            month,
            year,
            newResults: results,
            queryParams: params,
            dedupKey,
            meta,
          }),
        });
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error("[useQueryArchives] saveOrMerge hatası:", error);
        return null;
      }
    },
    []
  );

  const deleteArchive = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/query-archives/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) return false;
        setArchives((prev) => prev.filter((a) => a.id !== id));
        return true;
      } catch (error) {
        console.error("[useQueryArchives] deleteArchive hatası:", error);
        return false;
      }
    },
    []
  );

  const clearArchives = useCallback(() => {
    setArchives([]);
    setSummary(null);
  }, []);

  return {
    archives,
    loading,
    summary,
    loadArchives,
    loadArchiveDetail,
    checkOverlap,
    saveOrMerge,
    deleteArchive,
    clearArchives,
  };
}
