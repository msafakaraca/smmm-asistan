"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type { FinanceSettings } from "../shared/finance-types";

const DEFAULT_SETTINGS: FinanceSettings = {
  hasSMM: true,
  defaultKdvRate: 20,
  defaultStopajRate: 20,
  autoChargeEnabled: false,
  autoChargeDay: 1,
};

export function useFinanceSettings() {
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSettings = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch("/api/finance/settings", {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error("Ayarlar yüklenemedi");
      const data = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Finansal ayarlar yükleme hatası:", error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    return () => abortRef.current?.abort();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (data: Partial<FinanceSettings>) => {
      try {
        setSaving(true);
        const res = await fetch("/api/finance/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Ayarlar güncellenemedi");
        const updated = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...updated });
        toast.success("Ayarlar güncellendi");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Ayarlar güncellenemedi"
        );
        throw error;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { settings, loading, saving, fetchSettings, updateSettings };
}
