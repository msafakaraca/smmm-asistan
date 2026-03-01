"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type { Check, CheckStatus, CheckFormValues } from "../shared/finance-types";

interface UseChecksParams {
  status?: CheckStatus;
  customerId?: string;
}

export function useChecks(params?: UseChecksParams) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchChecks = useCallback(
    async (overrideParams?: UseChecksParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        const p = overrideParams || params;
        const searchParams = new URLSearchParams();
        if (p?.status) searchParams.set("status", p.status);
        if (p?.customerId) searchParams.set("customerId", p.customerId);

        const qs = searchParams.toString();
        const url = qs ? `/api/finance/checks?${qs}` : "/api/finance/checks";

        const res = await fetch(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("Çekler yüklenemedi");
        const data = await res.json();
        if (Array.isArray(data)) {
          setChecks(data);
        } else if (data.data) {
          setChecks(data.data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Çekler yükleme hatası:", error);
        toast.error("Çekler yüklenirken hata oluştu");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [params?.status, params?.customerId]
  );

  useEffect(() => {
    fetchChecks();
    return () => abortRef.current?.abort();
  }, [fetchChecks]);

  const createCheck = useCallback(
    async (
      data: CheckFormValues & { customerId: string; currency?: string }
    ) => {
      const res = await fetch("/api/finance/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Çek oluşturulamadı");
      }
      const created = await res.json();
      setChecks((prev) => [created, ...prev]);
      return created as Check;
    },
    []
  );

  const updateCheckStatus = useCallback(
    async (id: string, newStatus: "COLLECTED" | "BOUNCED" | "RETURNED") => {
      const res = await fetch(`/api/finance/checks/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Çek durumu güncellenemedi");
      }
      const updated = await res.json();
      setChecks((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      return updated;
    },
    []
  );

  return {
    checks,
    loading,
    fetchChecks,
    createCheck,
    updateCheckStatus,
  };
}
