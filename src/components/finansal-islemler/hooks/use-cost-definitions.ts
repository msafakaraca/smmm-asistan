"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  CostDefinition,
  CostDefinitionFormValues,
  BulkCostDefinitionRequest,
} from "../shared/finance-types";

interface UseCostDefinitionsParams {
  customerId?: string;
  categoryId?: string;
  isActive?: boolean;
}

export function useCostDefinitions(params?: UseCostDefinitionsParams) {
  const [definitions, setDefinitions] = useState<CostDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDefinitions = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const searchParams = new URLSearchParams();
      if (params?.customerId)
        searchParams.set("customerId", params.customerId);
      if (params?.categoryId)
        searchParams.set("categoryId", params.categoryId);
      if (params?.isActive !== undefined)
        searchParams.set("isActive", String(params.isActive));

      const url = searchParams.toString()
        ? `/api/finance/cost-definitions?${searchParams.toString()}`
        : "/api/finance/cost-definitions";

      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Maliyet tanımları yüklenemedi");
      const data = await res.json();
      if (Array.isArray(data)) setDefinitions(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Maliyet tanımları yükleme hatası:", error);
      toast.error("Maliyet tanımları yüklenirken hata oluştu");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [params?.customerId, params?.categoryId, params?.isActive]);

  useEffect(() => {
    fetchDefinitions();
    return () => abortRef.current?.abort();
  }, [fetchDefinitions]);

  const createDefinition = useCallback(
    async (data: CostDefinitionFormValues) => {
      const res = await fetch("/api/finance/cost-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Maliyet tanımı oluşturulamadı");
      }
      const created = await res.json();
      setDefinitions((prev) => [created, ...prev]);
      return created as CostDefinition;
    },
    []
  );

  const updateDefinition = useCallback(
    async (
      id: string,
      data: Partial<CostDefinitionFormValues> & { isActive?: boolean }
    ) => {
      const res = await fetch(`/api/finance/cost-definitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Maliyet tanımı güncellenemedi");
      }
      const updated = await res.json();
      setDefinitions((prev) =>
        prev.map((d) => (d.id === id ? updated : d))
      );
      return updated as CostDefinition;
    },
    []
  );

  const deleteDefinition = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/cost-definitions/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Maliyet tanımı silinemedi");
    }
    setDefinitions((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const bulkCreate = useCallback(
    async (data: BulkCostDefinitionRequest) => {
      const res = await fetch("/api/finance/cost-definitions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Toplu kayıt başarısız");
      }
      const result = await res.json();
      await fetchDefinitions();
      return result as {
        successCount: number;
        failCount: number;
        results: {
          customerId: string;
          success: boolean;
          error?: string;
        }[];
      };
    },
    [fetchDefinitions]
  );

  return {
    definitions,
    loading,
    fetchDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    bulkCreate,
  };
}
