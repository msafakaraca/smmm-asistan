"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  FinanceCategory,
  FinanceCategoryType,
  CategoryFormValues,
} from "../shared/finance-types";

export function useCategories(type?: FinanceCategoryType) {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCategories = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      const url = params.toString()
        ? `/api/finance/categories?${params.toString()}`
        : "/api/finance/categories";

      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Kategoriler yüklenemedi");
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Kategori yükleme hatası:", error);
      toast.error("Kategoriler yüklenirken hata oluştu");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchCategories();
    return () => abortRef.current?.abort();
  }, [fetchCategories]);

  const createCategory = useCallback(
    async (data: CategoryFormValues) => {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Kategori oluşturulamadı");
      }
      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      return created as FinanceCategory;
    },
    []
  );

  const updateCategory = useCallback(
    async (id: string, data: Partial<CategoryFormValues>) => {
      const res = await fetch(`/api/finance/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Kategori güncellenemedi");
      }
      const updated = await res.json();
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
      return updated as FinanceCategory;
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/categories/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Kategori silinemedi");
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "INCOME"),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "EXPENSE"),
    [categories]
  );

  return {
    categories,
    incomeCategories,
    expenseCategories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
