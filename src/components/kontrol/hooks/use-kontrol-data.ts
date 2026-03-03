/**
 * useKontrolData Hook
 *
 * Kontrol sayfası için veri yönetimi hook'u.
 * Müşteriler, beyanname türleri ve beyanname takip verilerini yönetir.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  Customer,
  BeyannameTuru,
  BeyannameStatuses,
  BotInfo,
  KontrolStats,
  DeclarationStatus,
  BeyannameStatusMeta,
} from "../types";

interface UseKontrolDataOptions {
  initialYear?: number;
  initialMonth?: number;
}

export function useKontrolData(options: UseKontrolDataOptions = {}) {
  // Mali müşavirlik kuralı: Beyannameler bir önceki ay için verilir
  // Örn: Ocak 2026'da Aralık 2025 dönemi görüntülenir
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth === 0) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }

  const [selectedYear, setSelectedYear] = useState(
    options.initialYear ?? previousYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    options.initialMonth ?? previousMonth
  );

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [beyannameTurleri, setBeyannameTurleri] = useState<BeyannameTuru[]>([]);
  const [turlerLoading, setTurlerLoading] = useState(true);
  const [beyannameStatuses, setBeyannameStatuses] = useState<BeyannameStatuses>(
    {}
  );
  const [takipLoading, setTakipLoading] = useState(false);
  const [botInfo, setBotInfo] = useState<BotInfo>({
    hasCredentials: false,
    hasCaptchaKey: false,
    lastSync: null,
  });
  const [gibCode, setGibCode] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sirketTipiFilter, setSirketTipiFilter] = useState<string>("all");

  // Beyanname takip verilerini yükle
  const fetchTakipData = useCallback(async () => {
    setTakipLoading(true);
    try {
      const res = await fetch(
        `/api/beyanname-takip?year=${selectedYear}&month=${selectedMonth}`
      );
      if (res.ok) {
        const data = await res.json();
        setBeyannameStatuses(data);
      }
    } catch (error) {
      console.error("Error fetching takip data:", error);
    } finally {
      setTakipLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Müşterileri yükle (sadece aktif müşteriler)
  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch("/api/customers?status=active");
      if (!res.ok) throw new Error("Müşteriler yüklenemedi");
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Müşteriler yüklenirken hata oluştu");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // Initial data loading - parallel fetch
  useEffect(() => {
    const loadInitialData = async () => {
      setCustomersLoading(true);
      setTurlerLoading(true);

      try {
        const [botInfoRes, customersRes, gibSettingsRes, turlerRes] =
          await Promise.all([
            fetch("/api/gib/sync")
              .then((r) => r.json())
              .catch(() => ({
                hasCredentials: false,
                hasCaptchaKey: false,
                lastSync: null,
              })),
            fetch("/api/customers?status=active").then((r) => (r.ok ? r.json() : [])),
            fetch("/api/settings/gib").then((r) => (r.ok ? r.json() : null)),
            fetch("/api/beyanname-turleri").then((r) => (r.ok ? r.json() : [])),
          ]);

        setBotInfo(botInfoRes);
        setCustomers(customersRes);
        if (gibSettingsRes?.gibCode) {
          setGibCode(gibSettingsRes.gibCode);
        }
        const aktifTurler = turlerRes
          .filter((t: BeyannameTuru) => t.aktif)
          .sort((a: BeyannameTuru, b: BeyannameTuru) => a.siraNo - b.siraNo);
        setBeyannameTurleri(aktifTurler);
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Veriler yüklenirken hata oluştu");
      } finally {
        setCustomersLoading(false);
        setTurlerLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Dönem değiştiğinde takip verilerini yeniden yükle
  useEffect(() => {
    fetchTakipData();
  }, [fetchTakipData]);

  // Filtrelenmiş müşteriler
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        searchTerm === "" ||
        c.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.vknTckn.includes(searchTerm);

      const matchesTipi =
        sirketTipiFilter === "all" || c.sirketTipi === sirketTipiFilter;

      return matchesSearch && matchesTipi;
    });
  }, [customers, searchTerm, sirketTipiFilter]);

  // İstatistikler - tek geçişte hesapla
  const stats = useMemo<KontrolStats>(() => {
    return customers.reduce(
      (acc, c) => {
        if (c.sirketTipi === "firma") acc.firma++;
        else if (c.sirketTipi === "sahis") acc.sahis++;
        else if (c.sirketTipi === "basit_usul") acc.basit++;
        acc.total++;
        return acc;
      },
      { firma: 0, sahis: 0, basit: 0, total: 0 }
    );
  }, [customers]);

  // Tüm aktif beyanname türlerini döndür (eski filtre sütun kaybolmasına neden oluyordu)
  const activeBeyannameTurleri = beyannameTurleri;

  // Müşteri ekleme
  const addCustomer = useCallback(
    async (data: { unvan: string; vknTckn: string; sirketTipi: string }) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Mükellef eklenemedi");
      }

      const newCustomer = await res.json();
      setCustomers((prev) => [...prev, newCustomer]);
      return newCustomer;
    },
    []
  );

  // Müşteri güncelleme
  const updateCustomer = useCallback(
    async (id: string, data: Partial<Customer>) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Güncelleme başarısız");
      }

      const updated = await res.json();
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    []
  );

  // Müşteri silme
  const deleteCustomer = useCallback(async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error("Silme başarısız");
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Beyanname durumu güncelleme (Optimistic Update)
  const updateBeyannameStatus = useCallback(
    async (
      customerId: string,
      beyannameKod: string,
      status: DeclarationStatus,
      meta?: BeyannameStatusMeta
    ) => {
      // Önceki durumu kaydet (geri alma için)
      const previousStatus = beyannameStatuses[customerId]?.[beyannameKod];

      // Optimistic Update: Önce UI'yi anında güncelle
      setBeyannameStatuses((prev) => ({
        ...prev,
        [customerId]: {
          ...prev[customerId],
          [beyannameKod]: { status, meta },
        },
      }));

      // Arkada API çağrısı yap
      try {
        const res = await fetch("/api/beyanname-takip", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            year: selectedYear,
            month: selectedMonth,
            kod: beyannameKod,
            status,
            meta,
          }),
        });

        if (!res.ok) {
          // Hata olursa geri al
          setBeyannameStatuses((prev) => ({
            ...prev,
            [customerId]: {
              ...prev[customerId],
              [beyannameKod]: previousStatus || { status: "bos" },
            },
          }));
          throw new Error("Durum güncellenemedi");
        }
      } catch (error) {
        // Hata olursa geri al
        setBeyannameStatuses((prev) => ({
          ...prev,
          [customerId]: {
            ...prev[customerId],
            [beyannameKod]: previousStatus || { status: "bos" },
          },
        }));
        throw error;
      }
    },
    [selectedYear, selectedMonth, beyannameStatuses]
  );

  return {
    // Data
    customers,
    filteredCustomers,
    beyannameTurleri,
    activeBeyannameTurleri,
    beyannameStatuses,
    botInfo,
    gibCode,
    stats,

    // Period
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,

    // Filters
    searchTerm,
    setSearchTerm,
    sirketTipiFilter,
    setSirketTipiFilter,

    // Loading states
    customersLoading,
    turlerLoading,
    takipLoading,

    // Actions
    fetchCustomers,
    fetchTakipData,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    updateBeyannameStatus,
    setCustomers,
    setBeyannameStatuses,
  };
}
