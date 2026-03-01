/**
 * useKdv9015KontrolData Hook
 *
 * KDV9015 (KDV Tevkifat) Kontrol sayfasi icin veri yonetimi hook'u.
 * WebSocket uzerinden bot event'lerini dinler.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  Kdv9015KontrolData,
  Kdv9015Status,
  Kdv9015ParseResult,
  Kdv9015ParseAllResult,
} from "../types";

// Grup tipi
interface CustomerGroup {
  id: string;
  name: string;
  color: string;
  beyannameTypes: string[];
  memberCount: number;
}

interface UseKdv9015KontrolDataOptions {
  initialYear?: number;
  initialMonth?: number;
}

export function useKdv9015KontrolData(options: UseKdv9015KontrolDataOptions = {}) {
  // Mali musavirlik kurali: Beyannameler bir onceki ay icin verilir
  // Orn: Ocak 2026'da Aralik 2025 donemi goruntulenir
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
  const [data, setData] = useState<Kdv9015KontrolData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sirketTipiFilter, setSirketTipiFilter] = useState<string>("all");
  const [statusFilter, setStatusFilterInternal] = useState<string>("all");

  // Kart tiklama filtresi (istatistik kartlarindan)
  const [activeCardFilter, setActiveCardFilterInternal] = useState<string | null>(null);

  // Senkronize set fonksiyonlari - kartlar ve durum filtresi birbirine bagli
  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterInternal(status);
    // Durum filtresi degistiginde kart filtresini de guncelle
    setActiveCardFilterInternal(status === "all" ? null : status);
  }, []);

  const setActiveCardFilter = useCallback((filter: string | null) => {
    setActiveCardFilterInternal(filter);
    // Kart filtresi degistiginde durum filtresini de guncelle
    setStatusFilterInternal(filter === null ? "all" : filter);
  }, []);

  // Grup filtreleme
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  // Parse states
  const [isParsing, setIsParsing] = useState(false);
  const [isParsingAll, setIsParsingAll] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isMountedRef = useRef(true);

  // KDV9015 Kontrol verilerini yukle
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/kdv9015-kontrol?year=${selectedYear}&month=${selectedMonth}`
      );
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast.error("KDV Tevkifat kontrol verileri yuklenemedi");
      }
    } catch (error) {
      console.error("Error fetching KDV9015 kontrol data:", error);
      toast.error("KDV Tevkifat kontrol verileri yuklenirken hata olustu");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Ilk yukleme
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Gruplari yukle
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/customer-groups');
        if (res.ok) {
          const data = await res.json();
          // KDV9015 beyannameTypes iceren gruplari filtrele
          const kdv9015Groups = data.filter((g: CustomerGroup) =>
            g.beyannameTypes?.includes('KDV9015')
          );
          setGroups(kdv9015Groups);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
    fetchGroups();
  }, []);

  // Grup uyelerini yukle
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

  // WebSocket baglantisi - KDV9015 parse event'lerini dinle
  useEffect(() => {
    const connectWS = async () => {
      if (!isMountedRef.current) return;

      try {
        // Get Token
        const tokenRes = await fetch("/api/auth/token");
        if (!tokenRes.ok) return;
        const { token } = await tokenRes.json();

        // Connect
        const protocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
        const wsHost = `${window.location.hostname}:${wsPort}`;
        const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[KDV9015-WS] Connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // KDV9015 parse complete event
            if (message.type === "kdv9015:parse-complete") {
              const data = message.data;
              console.log("[KDV9015-WS] Parse complete:", data);

              setIsParsingAll(false);

              if (data?.success) {
                toast.success(data.message || "KDV Tevkifat verileri parse edildi");
                // Tabloyu yenile
                fetchData();
              } else {
                toast.error(data?.message || "Parse basarisiz");
              }
            }

            // Bot progress event (KDV9015 icin)
            if (message.type === "BOT_PROGRESS") {
              const payload = message.payload;
              if (
                payload?.message?.toLowerCase().includes("kdv9015") ||
                payload?.message?.toLowerCase().includes("tevkifat")
              ) {
                // KDV9015 ile ilgili progress
                if (payload.progress === 100) {
                  setIsParsingAll(false);
                }
              }
            }
          } catch (e) {
            console.error("[KDV9015-WS] Parse error", e);
          }
        };

        ws.onclose = () => {
          console.log("[KDV9015-WS] Disconnected");
          if (isMountedRef.current) {
            reconnectTimerRef.current = setTimeout(connectWS, 5000);
          }
        };
      } catch (e) {
        console.error("[KDV9015-WS] Setup failed", e);
      }
    };

    connectWS();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [fetchData]);

  // Filtrelenmis veriler
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Grup filtresi
      if (selectedGroupId !== 'all' && groupMembers.length > 0) {
        if (!groupMembers.includes(item.customerId)) return false;
      }

      const matchesSearch =
        searchTerm === "" ||
        item.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vknTckn.includes(searchTerm);

      const matchesTipi =
        sirketTipiFilter === "all" || item.sirketTipi === sirketTipiFilter;

      // Durum filtresi (kartlar ve dropdown senkronize)
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesTipi && matchesStatus;
    });
  }, [data, searchTerm, sirketTipiFilter, statusFilter, selectedGroupId, groupMembers]);

  // Grup bazli filtrelenmis veri (stats hesaplamasi icin)
  // Sadece grup filtresi uygulanir, diger filtreler (arama, sirket tipi, durum) uygulanmaz
  const groupFilteredData = useMemo(() => {
    if (selectedGroupId === 'all' || groupMembers.length === 0) {
      return data;
    }
    return data.filter((item) => groupMembers.includes(item.customerId));
  }, [data, selectedGroupId, groupMembers]);

  // Istatistikler - grup secildiginde sadece o gruba ait mukellefler uzerinden hesaplanir
  const stats = useMemo(() => {
    return {
      total: groupFilteredData.length,
      verildi: groupFilteredData.filter((d) => d.status === "verildi").length,
      eksik: groupFilteredData.filter((d) => d.status === "eksik").length,
      bekliyor: groupFilteredData.filter((d) => d.status === "bekliyor").length,
      verilmeyecek: groupFilteredData.filter((d) => d.status === "verilmeyecek").length,
    };
  }, [groupFilteredData]);

  // Durum guncelle - Optimistic Update (once UI, sonra API)
  const updateStatus = useCallback(
    async (customerId: string, status: Kdv9015Status, notes?: string) => {
      // Onceki degeri kaydet (rollback icin)
      const previousData = data.find((item) => item.customerId === customerId);

      // HEMEN UI'i guncelle (Optimistic Update)
      setData((prev) =>
        prev.map((item) =>
          item.customerId === customerId
            ? { ...item, status, notes: notes ?? item.notes }
            : item
        )
      );

      // Arka planda API'ye gonder
      try {
        const res = await fetch("/api/kdv9015-kontrol", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            year: selectedYear,
            month: selectedMonth,
            status,
            notes,
          }),
        });

        if (!res.ok) {
          // Hata durumunda geri al
          if (previousData) {
            setData((prev) =>
              prev.map((item) =>
                item.customerId === customerId ? previousData : item
              )
            );
          }
          toast.error("Durum guncellenemedi");
        }
      } catch (error) {
        // Hata durumunda geri al
        if (previousData) {
          setData((prev) =>
            prev.map((item) =>
              item.customerId === customerId ? previousData : item
            )
          );
        }
        console.error("Error updating status:", error);
        toast.error("Durum guncellenirken hata olustu");
      }
    },
    [selectedYear, selectedMonth, data]
  );

  // Tek musteri icin parse
  const parseCustomer = useCallback(
    async (customerId: string): Promise<Kdv9015ParseResult | null> => {
      setIsParsing(true);
      try {
        const res = await fetch("/api/kdv9015-kontrol/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            year: selectedYear,
            month: selectedMonth,
          }),
        });

        const result = await res.json();

        if (res.ok && result.parsed) {
          // Veriyi yenile
          await fetchData();
          toast.success("Dosyalar basariyla parse edildi");
          return result;
        } else {
          toast.error(result.error || "Dosyalar parse edilemedi");
          return result;
        }
      } catch (error) {
        console.error("Error parsing:", error);
        toast.error("Parse islemi sirasinda hata olustu");
        return null;
      } finally {
        setIsParsing(false);
      }
    },
    [selectedYear, selectedMonth, fetchData]
  );

  // Tum musteriler icin parse - Electron bot'a WebSocket mesaji gonderir
  const parseAll = useCallback(async (): Promise<Kdv9015ParseAllResult | null> => {
    setIsParsingAll(true);
    try {
      const res = await fetch("/api/kdv9015-kontrol/parse-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        // Bot'a mesaj gonderildi - WebSocket'ten kdv9015:parse-complete event'i bekle
        toast.info(result.message || "Parse istegi gonderildi...");
        // NOT: isParsingAll'i burada kapatmiyoruz, WebSocket event'i geldiginde kapatilacak
        return result;
      } else {
        // Bot'a baglanilamadi veya hata
        toast.error(result.message || result.error || "Toplu parse islemi baslatilamadi");
        setIsParsingAll(false);
        return result;
      }
    } catch (error) {
      console.error("Error parsing all:", error);
      toast.error("Toplu parse islemi sirasinda hata olustu");
      setIsParsingAll(false);
      return null;
    }
    // NOT: finally'de setIsParsingAll(false) yok - WebSocket'ten event bekliyor
  }, [selectedYear, selectedMonth, selectedGroupId]);

  // Toplu durum guncelle
  const bulkUpdateStatus = useCallback(
    async (customerIds: string[], status: Kdv9015Status): Promise<boolean> => {
      try {
        const res = await fetch("/api/kdv9015-kontrol/bulk-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerIds,
            year: selectedYear,
            month: selectedMonth,
            status,
          }),
        });

        const result = await res.json();

        if (res.ok && result.success) {
          toast.success(result.message || "Durumlar guncellendi");
          // Optimistic update
          setData((prev) =>
            prev.map((item) =>
              customerIds.includes(item.customerId)
                ? { ...item, status }
                : item
            )
          );
          return true;
        } else {
          toast.error(result.error || "Durumlar guncellenemedi");
          return false;
        }
      } catch (error) {
        console.error("Error bulk updating status:", error);
        toast.error("Toplu guncelleme sirasinda hata olustu");
        return false;
      }
    },
    [selectedYear, selectedMonth]
  );

  // Tum verileri temizle
  const clearAll = useCallback(async (): Promise<boolean> => {
    setIsClearing(true);
    try {
      const res = await fetch(
        `/api/kdv9015-kontrol/clear?year=${selectedYear}&month=${selectedMonth}`,
        { method: "DELETE" }
      );

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(result.message || "Veriler temizlendi");
        // Tabloyu yenile
        await fetchData();
        return true;
      } else {
        toast.error(result.error || "Veriler temizlenemedi");
        return false;
      }
    } catch (error) {
      console.error("Error clearing data:", error);
      toast.error("Veriler temizlenirken hata olustu");
      return false;
    } finally {
      setIsClearing(false);
    }
  }, [selectedYear, selectedMonth, fetchData]);

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
    sirketTipiFilter,
    setSirketTipiFilter,
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
    parseCustomer,
    parseAll,
    clearAll,

    // Parse states
    isParsing,
    isParsingAll,
    isClearing,
  };
}
