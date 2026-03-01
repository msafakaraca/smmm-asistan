/**
 * useGeciciVergiKontrolData Hook
 *
 * Geçici Vergi Kontrol sayfası için veri yönetimi hook'u.
 * Çeyreklik dönem yönetimi (Q1=3, Q2=6, Q3=9, Q4=12).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  GeciciVergiKontrolData,
  GeciciVergiStatus,
  GeciciVergiTuru,
} from "../types";

// Grup tipi
interface CustomerGroup {
  id: string;
  name: string;
  color: string;
  beyannameTypes: string[];
  memberCount: number;
}

// Çeyrek hesaplama
const QUARTERS = [
  { quarter: 1, month: 3, label: "Q1 (Ocak-Mart)" },
  { quarter: 2, month: 6, label: "Q2 (Nisan-Haziran)" },
  { quarter: 3, month: 9, label: "Q3 (Temmuz-Eylül)" },
  { quarter: 4, month: 12, label: "Q4 (Ekim-Aralık)" },
];

function getPreviousQuarter(): { year: number; month: number } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Mevcut çeyreği bul
  let currentQuarterIndex: number;
  if (currentMonth <= 3) currentQuarterIndex = 0; // Q1
  else if (currentMonth <= 6) currentQuarterIndex = 1; // Q2
  else if (currentMonth <= 9) currentQuarterIndex = 2; // Q3
  else currentQuarterIndex = 3; // Q4

  // Bir önceki çeyrek
  if (currentQuarterIndex === 0) {
    return { year: currentYear - 1, month: 12 }; // Önceki yılın Q4
  }
  return { year: currentYear, month: QUARTERS[currentQuarterIndex - 1].month };
}

export { QUARTERS };

interface UseGeciciVergiKontrolDataOptions {
  vergiTuru: GeciciVergiTuru;
  initialYear?: number;
  initialMonth?: number;
}

export function useGeciciVergiKontrolData(options: UseGeciciVergiKontrolDataOptions) {
  const { vergiTuru } = options;

  // Mali müşavirlik kuralı: Bir önceki çeyrek
  const prev = getPreviousQuarter();

  const [selectedYear, setSelectedYear] = useState(
    options.initialYear ?? prev.year
  );
  const [selectedMonth, setSelectedMonth] = useState(
    options.initialMonth ?? prev.month
  );

  // Data states
  const [data, setData] = useState<GeciciVergiKontrolData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilterInternal] = useState<string>("all");

  // Kart tıklama filtresi
  const [activeCardFilter, setActiveCardFilterInternal] = useState<string | null>(null);

  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterInternal(status);
    setActiveCardFilterInternal(status === "all" ? null : status);
  }, []);

  const setActiveCardFilter = useCallback((filter: string | null) => {
    setActiveCardFilterInternal(filter);
    setStatusFilterInternal(filter === null ? "all" : filter);
  }, []);

  // Grup filtreleme
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Verileri yükle
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/gecici-vergi-kontrol?year=${selectedYear}&month=${selectedMonth}&vergiTuru=${vergiTuru}`
      );
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast.error("Geçici vergi kontrol verileri yüklenemedi");
      }
    } catch (error) {
      console.error("Error fetching gecici vergi kontrol data:", error);
      toast.error("Geçici vergi kontrol verileri yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, vergiTuru]);

  // İlk yükleme
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Grupları yükle
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/customer-groups');
        if (res.ok) {
          const data = await res.json();
          const relevantGroups = data.filter((g: CustomerGroup) =>
            g.beyannameTypes?.includes(vergiTuru)
          );
          setGroups(relevantGroups);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
    fetchGroups();
  }, [vergiTuru]);

  // Grup üyelerini yükle
  useEffect(() => {
    if (selectedGroupId === 'all') {
      setGroupMembers([]);
      return;
    }
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/customer-groups/${selectedGroupId}`);
        if (res.ok) {
          const data = await res.json();
          const memberIds = data.members?.map((m: { id: string }) => m.id) || [];
          setGroupMembers(memberIds);
        }
      } catch (error) {
        console.error('Error fetching group members:', error);
        setGroupMembers([]);
      }
    };
    fetchMembers();
  }, [selectedGroupId]);

  // WebSocket bağlantısı
  useEffect(() => {
    const connectWS = async () => {
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (!tokenRes.ok) return;
        const { token } = await tokenRes.json();

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
        const wsHost = `${window.location.hostname}:${wsPort}`;
        const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "BOT_PROGRESS") {
              const payload = message.payload;
              if (
                payload?.message?.toLowerCase().includes("gecici") ||
                payload?.message?.toLowerCase().includes("geçici")
              ) {
                if (payload.progress === 100) {
                  fetchData();
                }
              }
            }
          } catch (e) {
            console.error("[GECICI-WS] Parse error", e);
          }
        };

        ws.onclose = () => {
          reconnectTimerRef.current = setTimeout(connectWS, 5000);
        };
      } catch (e) {
        console.error("[GECICI-WS] Setup failed", e);
      }
    };

    connectWS();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [fetchData]);

  // Filtrelenmiş veriler
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (selectedGroupId !== 'all' && groupMembers.length > 0) {
        if (!groupMembers.includes(item.customerId)) return false;
      }

      const matchesSearch =
        searchTerm === "" ||
        item.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vknTckn.includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter, selectedGroupId, groupMembers]);

  // Grup bazlı filtrelenmiş veri (stats için)
  const groupFilteredData = useMemo(() => {
    if (selectedGroupId === 'all' || groupMembers.length === 0) {
      return data;
    }
    return data.filter((item) => groupMembers.includes(item.customerId));
  }, [data, selectedGroupId, groupMembers]);

  // İstatistikler
  const stats = useMemo(() => {
    return {
      total: groupFilteredData.length,
      verildi: groupFilteredData.filter((d) => d.status === "verildi").length,
      eksik: groupFilteredData.filter((d) => d.status === "eksik").length,
      bekliyor: groupFilteredData.filter((d) => d.status === "bekliyor").length,
      verilmeyecek: groupFilteredData.filter((d) => d.status === "verilmeyecek").length,
    };
  }, [groupFilteredData]);

  // Durum güncelle - Optimistic Update
  const updateStatus = useCallback(
    async (customerId: string, status: GeciciVergiStatus, notes?: string) => {
      const previousData = data.find((item) => item.customerId === customerId);

      setData((prev) =>
        prev.map((item) =>
          item.customerId === customerId
            ? { ...item, status, notes: notes ?? item.notes }
            : item
        )
      );

      try {
        const res = await fetch("/api/gecici-vergi-kontrol", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            year: selectedYear,
            month: selectedMonth,
            vergiTuru,
            status,
            notes,
          }),
        });

        if (!res.ok) {
          if (previousData) {
            setData((prev) =>
              prev.map((item) =>
                item.customerId === customerId ? previousData : item
              )
            );
          }
          toast.error("Durum güncellenemedi");
        }
      } catch (error) {
        if (previousData) {
          setData((prev) =>
            prev.map((item) =>
              item.customerId === customerId ? previousData : item
            )
          );
        }
        console.error("Error updating status:", error);
        toast.error("Durum güncellenirken hata oluştu");
      }
    },
    [selectedYear, selectedMonth, vergiTuru, data]
  );

  // Toplu durum güncelle
  const bulkUpdateStatus = useCallback(
    async (customerIds: string[], status: GeciciVergiStatus): Promise<boolean> => {
      try {
        // Her bir customerId için ayrı PUT isteği gönder
        const results = await Promise.all(
          customerIds.map((customerId) =>
            fetch("/api/gecici-vergi-kontrol", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId,
                year: selectedYear,
                month: selectedMonth,
                vergiTuru,
                status,
              }),
            })
          )
        );

        const allOk = results.every((r) => r.ok);
        if (allOk) {
          toast.success("Durumlar güncellendi");
          setData((prev) =>
            prev.map((item) =>
              customerIds.includes(item.customerId)
                ? { ...item, status }
                : item
            )
          );
          return true;
        } else {
          toast.error("Bazı durumlar güncellenemedi");
          return false;
        }
      } catch (error) {
        console.error("Error bulk updating status:", error);
        toast.error("Toplu güncelleme sırasında hata oluştu");
        return false;
      }
    },
    [selectedYear, selectedMonth, vergiTuru]
  );

  return {
    // Data
    data,
    filteredData,
    stats,
    loading,

    // Period
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,

    // Filters
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    activeCardFilter,
    setActiveCardFilter,

    // Grup filtreleme
    selectedGroupId,
    setSelectedGroupId,
    groups,

    // Actions
    fetchData,
    updateStatus,
    bulkUpdateStatus,
  };
}
