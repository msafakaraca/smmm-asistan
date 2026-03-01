"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type { Expense, ExpenseFormValues } from "../shared/finance-types";

interface UseExpensesParams {
  categoryId?: string;
  isRecurring?: boolean;
  startDate?: string;
  endDate?: string;
}

export function useExpenses(params?: UseExpensesParams) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchExpenses = useCallback(
    async (overrideParams?: UseExpensesParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        const p = overrideParams || params;
        const searchParams = new URLSearchParams();
        if (p?.categoryId) searchParams.set("categoryId", p.categoryId);
        if (p?.isRecurring !== undefined)
          searchParams.set("isRecurring", String(p.isRecurring));
        if (p?.startDate) searchParams.set("startDate", p.startDate);
        if (p?.endDate) searchParams.set("endDate", p.endDate);

        const qs = searchParams.toString();
        const url = qs
          ? `/api/finance/expenses?${qs}`
          : "/api/finance/expenses";

        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("Giderler yüklenemedi");
        const data = await res.json();
        if (Array.isArray(data)) {
          setExpenses(data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Gider yükleme hatası:", error);
        toast.error("Giderler yüklenirken hata oluştu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [
      params?.categoryId,
      params?.isRecurring,
      params?.startDate,
      params?.endDate,
    ]
  );

  useEffect(() => {
    fetchExpenses();
    return () => abortRef.current?.abort();
  }, [fetchExpenses]);

  const createExpense = useCallback(async (data: ExpenseFormValues) => {
    const res = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Gider oluşturulamadı");
    }
    const created = await res.json();
    setExpenses((prev) => [created, ...prev]);
    return created as Expense;
  }, []);

  const updateExpense = useCallback(
    async (id: string, data: Partial<ExpenseFormValues>) => {
      const res = await fetch(`/api/finance/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gider güncellenemedi");
      }
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated as Expense;
    },
    []
  );

  const deleteExpense = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/expenses/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Gider silinemedi");
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const summaryStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let totalAmount = 0;
    let recurringTotal = 0;
    let thisMonthTotal = 0;

    for (const e of expenses) {
      const amount = Number(e.amount);
      totalAmount += amount;

      if (e.isRecurring) {
        recurringTotal += amount;
      }

      const expDate = new Date(e.date);
      if (expDate >= startOfMonth && expDate <= endOfMonth) {
        thisMonthTotal += amount;
      }
    }

    return { totalAmount, recurringTotal, thisMonthTotal };
  }, [expenses]);

  return {
    expenses,
    loading,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    summaryStats,
  };
}
