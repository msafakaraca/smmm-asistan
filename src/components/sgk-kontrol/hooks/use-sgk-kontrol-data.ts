/**
 * useSgkKontrolData Hook
 *
 * SGK Kontrol sayfası için veri yönetimi hook'u.
 * WebSocket üzerinden bot event'lerini dinler.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import type {
  SgkKontrolData,
  SgkStatus,
  ParseResult,
  ParseAllResult,
} from "../types";

// Grup tipi
interface CustomerGroup {
  id: string;
  name: string;
  color: string;
  beyannameTypes: string[];
  memberCount: number;
}

interface UseSgkKontrolDataOptions {
  initialYear?: number;
  initialMonth?: number;
}

export function useSgkKontrolData(options: UseSgkKontrolDataOptions = {}) {
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
  const [data, setData] = useState<SgkKontrolData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sirketTipiFilter, setSirketTipiFilter] = useState<string>("all");
  const [statusFilter, setStatusFilterInternal] = useState<string>("all");

  // Kart tıklama filtresi (istatistik kartlarından)
  const [activeCardFilter, setActiveCardFilterInternal] = useState<string | null>(null);

  // Senkronize set fonksiyonları - kartlar ve durum filtresi birbirine bağlı
  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterInternal(status);
    // Durum filtresi değiştiğinde kart filtresini de güncelle
    setActiveCardFilterInternal(status === "all" ? null : status);
  }, []);

  const setActiveCardFilter = useCallback((filter: string | null) => {
    setActiveCardFilterInternal(filter);
    // Kart filtresi değiştiğinde durum filtresini de güncelle
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

  // SGK Kontrol verilerini yükle
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sgk-kontrol?year=${selectedYear}&month=${selectedMonth}`
      );
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        toast.error("SGK kontrol verileri yüklenemedi");
      }
    } catch (error) {
      console.error("Error fetching SGK kontrol data:", error);
      toast.error("SGK kontrol verileri yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

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
          // MUHSGK beyannameTypes içeren grupları filtrele
          const muhsgkGroups = data.filter((g: CustomerGroup) =>
            g.beyannameTypes?.includes('MUHSGK')
          );
          setGroups(muhsgkGroups);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
    fetchGroups();
  }, []);

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

  // WebSocket bağlantısı - SGK parse event'lerini dinle
  useEffect(() => {
    const connectWS = async () => {
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
          console.log("[SGK-WS] Connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // SGK parse complete event
            if (message.type === "sgk:parse-complete") {
              const data = message.data;
              console.log("[SGK-WS] Parse complete:", data);

              setIsParsingAll(false);

              if (data?.success) {
                toast.success(data.message || "SGK verileri parse edildi");
                // Tabloyu yenile
                fetchData();
              } else {
                toast.error(data?.message || "Parse başarısız");
              }
            }

            // Bot progress event (SGK için)
            if (message.type === "BOT_PROGRESS") {
              const payload = message.payload;
              if (
                payload?.message?.toLowerCase().includes("sgk") ||
                payload?.message?.toLowerCase().includes("hizmet") ||
                payload?.message?.toLowerCase().includes("tahakkuk")
              ) {
                // SGK ile ilgili progress - toast göster
                if (payload.progress === 100) {
                  setIsParsingAll(false);
                }
              }
            }
          } catch (e) {
            console.error("[SGK-WS] Parse error", e);
          }
        };

        ws.onclose = () => {
          console.log("[SGK-WS] Disconnected");
          reconnectTimerRef.current = setTimeout(connectWS, 5000);
        };
      } catch (e) {
        console.error("[SGK-WS] Setup failed", e);
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

  // Grup bazlı filtrelenmiş veri (stats hesaplaması için)
  // Sadece grup filtresi uygulanır, diğer filtreler (arama, şirket tipi, durum) uygulanmaz
  const groupFilteredData = useMemo(() => {
    if (selectedGroupId === 'all' || groupMembers.length === 0) {
      return data;
    }
    return data.filter((item) => groupMembers.includes(item.customerId));
  }, [data, selectedGroupId, groupMembers]);

  // İstatistikler - grup seçildiğinde sadece o gruba ait mükellefler üzerinden hesaplanır
  const stats = useMemo(() => {
    return {
      total: groupFilteredData.length,
      gonderildi: groupFilteredData.filter((d) => d.status === "gonderildi").length,
      eksik: groupFilteredData.filter((d) => d.status === "eksik").length,
      bekliyor: groupFilteredData.filter((d) => d.status === "bekliyor").length,
      gonderilmeyecek: groupFilteredData.filter((d) => d.status === "gonderilmeyecek").length,
      dilekce_gonderildi: groupFilteredData.filter((d) => d.status === "dilekce_gonderildi").length,
    };
  }, [groupFilteredData]);

  // Durum güncelle - Optimistic Update (önce UI, sonra API)
  const updateStatus = useCallback(
    async (customerId: string, status: SgkStatus, notes?: string) => {
      // Önceki değeri kaydet (rollback için)
      const previousData = data.find((item) => item.customerId === customerId);

      // HEMEN UI'ı güncelle (Optimistic Update)
      setData((prev) =>
        prev.map((item) =>
          item.customerId === customerId
            ? { ...item, status, notes: notes ?? item.notes }
            : item
        )
      );

      // Arka planda API'ye gönder
      try {
        const res = await fetch("/api/sgk-kontrol", {
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
          toast.error("Durum güncellenemedi");
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
        toast.error("Durum güncellenirken hata oluştu");
      }
    },
    [selectedYear, selectedMonth, data]
  );

  // Tek müşteri için parse
  const parseCustomer = useCallback(
    async (customerId: string): Promise<ParseResult | null> => {
      setIsParsing(true);
      try {
        const res = await fetch("/api/sgk-kontrol/parse", {
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
          toast.success("Dosyalar başarıyla parse edildi");
          return result;
        } else {
          toast.error(result.error || "Dosyalar parse edilemedi");
          return result;
        }
      } catch (error) {
        console.error("Error parsing:", error);
        toast.error("Parse işlemi sırasında hata oluştu");
        return null;
      } finally {
        setIsParsing(false);
      }
    },
    [selectedYear, selectedMonth, fetchData]
  );

  // Tüm müşteriler için parse - Electron bot'a WebSocket mesajı gönderir
  const parseAll = useCallback(async (): Promise<ParseAllResult | null> => {
    setIsParsingAll(true);
    try {
      const res = await fetch("/api/sgk-kontrol/parse-all", {
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
        // Bot'a mesaj gönderildi - WebSocket'ten sgk:parse-complete event'i bekle
        toast.info(result.message || "Parse isteği gönderildi...");
        // NOT: isParsingAll'ı burada kapatmıyoruz, WebSocket event'i geldiğinde kapatılacak
        return result;
      } else {
        // Bot'a bağlanılamadı veya hata
        toast.error(result.message || result.error || "Toplu parse işlemi başlatılamadı");
        setIsParsingAll(false);
        return result;
      }
    } catch (error) {
      console.error("Error parsing all:", error);
      toast.error("Toplu parse işlemi sırasında hata oluştu");
      setIsParsingAll(false);
      return null;
    }
    // NOT: finally'de setIsParsingAll(false) yok - WebSocket'ten event bekliyor
  }, [selectedYear, selectedMonth, selectedGroupId]);

  // Toplu durum güncelle
  const bulkUpdateStatus = useCallback(
    async (customerIds: string[], status: SgkStatus): Promise<boolean> => {
      try {
        const res = await fetch("/api/sgk-kontrol/bulk-status", {
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
          toast.success(result.message || "Durumlar güncellendi");
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
          toast.error(result.error || "Durumlar güncellenemedi");
          return false;
        }
      } catch (error) {
        console.error("Error bulk updating status:", error);
        toast.error("Toplu güncelleme sırasında hata oluştu");
        return false;
      }
    },
    [selectedYear, selectedMonth]
  );

  // Tüm verileri temizle
  const clearAll = useCallback(async (): Promise<boolean> => {
    setIsClearing(true);
    try {
      const res = await fetch(
        `/api/sgk-kontrol/clear?year=${selectedYear}&month=${selectedMonth}`,
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
      toast.error("Veriler temizlenirken hata oluştu");
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
