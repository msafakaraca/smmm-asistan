"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";

export interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCustomers = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch("/api/customers?status=active", {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Müşteriler yüklenemedi");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomers(
          data.map(
            (c: {
              id: string;
              unvan: string;
              kisaltma?: string | null;
              vknTckn: string;
            }) => ({
              id: c.id,
              unvan: c.unvan,
              kisaltma: c.kisaltma || null,
              vknTckn: c.vknTckn,
            })
          )
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Müşteri yükleme hatası:", error);
      toast.error("Müşteriler yüklenirken hata oluştu");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    return () => abortRef.current?.abort();
  }, [fetchCustomers]);

  return { customers, loading, fetchCustomers };
}
