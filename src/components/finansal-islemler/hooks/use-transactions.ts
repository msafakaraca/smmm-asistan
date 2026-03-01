"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  FinancialTransaction,
  PendingDebtWithBalance,
  CollectRequest,
  PaginatedResponse,
} from "../shared/finance-types";

interface UseTransactionsParams {
  customerId?: string;
  type?: "DEBIT" | "CREDIT";
  status?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useTransactions(params?: UseTransactionsParams) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTransactions = useCallback(
    async (overrideParams?: UseTransactionsParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        const p = overrideParams || params;
        const searchParams = new URLSearchParams();
        if (p?.customerId) searchParams.set("customerId", p.customerId);
        if (p?.type) searchParams.set("type", p.type);
        if (p?.status) searchParams.set("status", p.status);
        if (p?.categoryId) searchParams.set("categoryId", p.categoryId);
        if (p?.startDate) searchParams.set("startDate", p.startDate);
        if (p?.endDate) searchParams.set("endDate", p.endDate);
        if (p?.page) searchParams.set("page", String(p.page));
        if (p?.limit) searchParams.set("limit", String(p.limit));

        const qs = searchParams.toString();
        const url = qs
          ? `/api/finance/transactions?${qs}`
          : "/api/finance/transactions";

        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("İşlemler yüklenemedi");
        const data = await res.json();

        if (Array.isArray(data)) {
          setTransactions(data);
          setTotal(data.length);
        } else {
          const paginated = data as PaginatedResponse<FinancialTransaction>;
          setTransactions(paginated.data);
          setTotal(paginated.total);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("İşlemler yükleme hatası:", error);
        toast.error("İşlemler yüklenirken hata oluştu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [
      params?.customerId,
      params?.type,
      params?.status,
      params?.categoryId,
      params?.startDate,
      params?.endDate,
      params?.page,
      params?.limit,
    ]
  );

  useEffect(() => {
    fetchTransactions();
    return () => abortRef.current?.abort();
  }, [fetchTransactions]);

  // Bekleyen borçları getir (belirli müşteri için)
  const fetchPendingDebts = useCallback(
    async (customerId: string): Promise<PendingDebtWithBalance[]> => {
      const res = await fetch(
        `/api/finance/transactions/pending/${customerId}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Bekleyen borçlar yüklenemedi");
      }
      return await res.json();
    },
    []
  );

  // Tahsilat al
  const collectPayment = useCallback(
    async (data: CollectRequest) => {
      const res = await fetch("/api/finance/transactions/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Tahsilat kaydedilemedi");
      }
      const result = await res.json();
      await fetchTransactions();
      return result;
    },
    [fetchTransactions]
  );

  // Yeni işlem oluştur
  const createTransaction = useCallback(
    async (data: Partial<FinancialTransaction>) => {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "İşlem oluşturulamadı");
      }
      const created = await res.json();
      setTransactions((prev) => [created, ...prev]);
      return created as FinancialTransaction;
    },
    []
  );

  // Özet istatistikler
  const summaryStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = now.toISOString().split("T")[0];

    let pendingTotal = 0;
    let thisMonthCollected = 0;
    let overdueTotal = 0;

    for (const t of transactions) {
      if (
        t.type === "DEBIT" &&
        (t.status === "PENDING" || t.status === "PARTIAL")
      ) {
        pendingTotal += Number(t.netAmount);
      }

      if (t.type === "CREDIT") {
        const txDate = new Date(t.date);
        if (txDate >= startOfMonth && txDate <= endOfMonth) {
          thisMonthCollected += Number(t.netAmount);
        }
      }

      if (
        t.type === "DEBIT" &&
        (t.status === "PENDING" || t.status === "PARTIAL") &&
        t.dueDate &&
        t.dueDate < today
      ) {
        overdueTotal += Number(t.netAmount);
      }
    }

    return { pendingTotal, thisMonthCollected, overdueTotal };
  }, [transactions]);

  return {
    transactions,
    total,
    loading,
    fetchTransactions,
    fetchPendingDebts,
    collectPayment,
    createTransaction,
    summaryStats,
  };
}
