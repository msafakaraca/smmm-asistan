"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  FinancialTransaction,
  PaginatedResponse,
} from "../shared/finance-types";

interface AccountStatementParams {
  customerId?: string;
  startDate?: string;
  endDate?: string;
  type?: "DEBIT" | "CREDIT";
  categoryId?: string;
}

export interface StatementRow extends FinancialTransaction {
  debitAmount: number;
  creditAmount: number;
  balance: number;
}

interface AccountStatementTotals {
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
}

export function useAccountStatement() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatement = useCallback(
    async (params: AccountStatementParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        const searchParams = new URLSearchParams();
        if (params.customerId)
          searchParams.set("customerId", params.customerId);
        if (params.startDate) searchParams.set("startDate", params.startDate);
        if (params.endDate) searchParams.set("endDate", params.endDate);
        if (params.type) searchParams.set("type", params.type);
        if (params.categoryId)
          searchParams.set("categoryId", params.categoryId);
        searchParams.set("limit", "500");

        const qs = searchParams.toString();
        const url = `/api/finance/transactions?${qs}`;

        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("Hesap dökümü yüklenemedi");
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
        console.error("Hesap dökümü yükleme hatası:", error);
        toast.error("Hesap dökümü yüklenirken hata oluştu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    []
  );

  // Running balance hesaplama (tarih sırasıyla)
  const statementRows = useMemo<StatementRow[]>(() => {
    const sorted = [...transactions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    let balance = 0;
    return sorted.map((t) => {
      const amount = Number(t.netAmount);
      const debitAmount = t.type === "DEBIT" ? amount : 0;
      const creditAmount = t.type === "CREDIT" ? amount : 0;
      if (t.type === "DEBIT") {
        balance += amount;
      } else {
        balance -= amount;
      }
      return {
        ...t,
        debitAmount,
        creditAmount,
        balance,
      };
    });
  }, [transactions]);

  // Toplamlar
  const totals = useMemo<AccountStatementTotals>(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of statementRows) {
      totalDebit += row.debitAmount;
      totalCredit += row.creditAmount;
    }
    return {
      totalDebit,
      totalCredit,
      finalBalance: totalDebit - totalCredit,
    };
  }, [statementRows]);

  return {
    transactions,
    statementRows,
    totals,
    total,
    loading,
    fetchStatement,
  };
}
