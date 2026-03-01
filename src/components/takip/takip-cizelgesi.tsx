"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Custom icons for specific use cases
const RotateCcwIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

const CircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4"/>
  </svg>
);

const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const CheckIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { KolonHeader } from "./kolon-header";
import { TakipSatirRow } from "./takip-satir";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { BulkValueDialog } from "./bulk-value-dialog";
import { extractCellData } from "@/lib/takip-utils";

// Lazy load modal
const KolonEkleModal = dynamic(
  () => import("./kolon-ekle-modal").then(mod => ({ default: mod.KolonEkleModal })),
  { ssr: false }
);

interface TakipKolon {
  id: string;
  kod: string;
  baslik: string;
  tip: string;
  siraNo: number;
  aktif: boolean;
  sistem: boolean;
}

interface TakipSatir {
  id: string;
  no: string;
  isim: string;
  siraNo: number;
  degerler: Record<string, unknown>;
  year?: number;
  month?: number;
}

interface CurrentUser {
  id: string;
  name: string;
}

interface TakipCizelgesiProps {
  currentUser: CurrentUser | null;
}

// Sabitler
const MONTHS = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

// Yıl seçenekleri (2020'den bu yıla kadar)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

const VIRTUAL_THRESHOLD = 200;

// Mali müşavirlik kuralı: Varsayılan dönem bir önceki ay
function getDefaultPeriod() {
  const now = new Date();
  let month = now.getMonth(); // 0-indexed, yani getMonth() + 1 - 1 = getMonth()
  let year = now.getFullYear();

  if (month === 0) {
    // Ocak ayındaysak, bir önceki ay Aralık (önceki yıl)
    month = 12;
    year = year - 1;
  }

  return { year, month };
}

export function TakipCizelgesi({ currentUser }: TakipCizelgesiProps) {
  const defaultPeriod = getDefaultPeriod();
  const [year, setYear] = useState(defaultPeriod.year);
  const [month, setMonth] = useState(defaultPeriod.month);
  const [kolonlar, setKolonlar] = useState<TakipKolon[]>([]);
  const [satirlar, setSatirlar] = useState<TakipSatir[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [kolonEkleOpen, setKolonEkleOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Kolon bazlı filtreleme
  const [filterKolon, setFilterKolon] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Virtual scrolling ref
  const parentRef = useRef<HTMLDivElement>(null);

  // Row selection for bulk actions
  const {
    selectedIds,
    isSelectionMode,
    selectedCount,
    toggleSelectionMode,
    toggleRow,
    selectAll,
    deselectAll,
    isSelected,
    exitSelectionMode,
  } = useRowSelection();

  // Bulk value dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Veri yükleme
  const fetchKolonlar = useCallback(async () => {
    try {
      const res = await fetch("/api/takip/kolonlar");
      if (res.ok) {
        const data = await res.json();
        setKolonlar(data);
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Kolonlar yüklenemedi:", error);
      toast.error("Kolonlar yüklenirken hata oluştu");
    }
  }, []);

  const fetchSatirlar = useCallback(async () => {
    try {
      const res = await fetch(`/api/takip/satirlar?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setSatirlar(data);
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Satırlar yüklenemedi:", error);
      toast.error("Satırlar yüklenirken hata oluştu");
    }
  }, [year, month]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchKolonlar(), fetchSatirlar()]);
      setLoading(false);
    };
    loadData();
  }, [fetchKolonlar, fetchSatirlar]);

  // Kolon işlemleri
  const handleAddKolon = async (kolon: {
    kod: string;
    baslik: string;
    tip: string;
  }) => {
    try {
      const res = await fetch("/api/takip/kolonlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kolon),
      });

      if (res.ok) {
        const yeniKolon = await res.json();
        setKolonlar((prev) => [...prev, yeniKolon]);
        toast.success(`"${kolon.baslik}" kolonu eklendi`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Kolon eklenemedi");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Kolon eklenemedi:", error);
      toast.error("Kolon eklenirken hata oluştu");
    }
  };

  const handleUpdateKolon = async (id: string, data: Partial<TakipKolon>) => {
    try {
      const res = await fetch("/api/takip/kolonlar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });

      if (res.ok) {
        const guncellenmis = await res.json();
        setKolonlar((prev) =>
          prev.map((k) => (k.id === id ? guncellenmis : k))
        );
        toast.success("Kolon güncellendi");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Kolon güncellenemedi:", error);
      toast.error("Kolon güncellenirken hata oluştu");
    }
  };

  const handleDeleteKolon = async (id: string) => {
    try {
      const res = await fetch(`/api/takip/kolonlar?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKolonlar((prev) => prev.filter((k) => k.id !== id));
        toast.success("Kolon silindi");
      } else {
        const error = await res.json();
        toast.error(error.error || "Kolon silinemedi");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Kolon silinemedi:", error);
      toast.error("Kolon silinirken hata oluştu");
    }
  };

  // Satır işlemleri
  const handleAddSatir = async () => {
    try {
      const res = await fetch("/api/takip/satirlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });

      if (res.ok) {
        const yeniSatir = await res.json();
        setSatirlar((prev) => [...prev, yeniSatir]);
        toast.success("Yeni satır eklendi");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Satır eklenemedi:", error);
      toast.error("Satır eklenirken hata oluştu");
    }
  };

  const handleUpdateSatir = async (id: string, data: Partial<TakipSatir>) => {
    // Optimistic update - degerler'i metadata ile birlikte merge et
    const now = new Date().toISOString();

    setSatirlar((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        // degerler varsa her değer için metadata ekle (optimistic)
        let mergedDegerler = s.degerler;
        if (data.degerler && currentUser) {
          mergedDegerler = { ...s.degerler };
          for (const [key, value] of Object.entries(data.degerler)) {
            mergedDegerler[key] = {
              value,
              modifiedBy: currentUser.id,
              modifiedByName: currentUser.name,
              modifiedAt: now,
            };
          }
        }

        return {
          ...s,
          ...data,
          degerler: mergedDegerler,
        };
      })
    );

    try {
      const res = await fetch("/api/takip/satirlar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });

      if (!res.ok) {
        // Revert on error
        await fetchSatirlar();
        toast.error("Güncelleme başarısız");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Satır güncellenemedi:", error);
      await fetchSatirlar();
    }
  };

  const handleDeleteSatir = async (id: string) => {
    if (!window.confirm("Bu satırı silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      const res = await fetch(`/api/takip/satirlar?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSatirlar((prev) => prev.filter((s) => s.id !== id));
        toast.success("Satır silindi");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Satır silinemedi:", error);
      toast.error("Satır silinirken hata oluştu");
    }
  };

  // Toplu değer güncelleme
  const handleBulkValueUpdate = async (kolonKod: string, value: boolean | null) => {
    setIsBulkUpdating(true);
    try {
      const res = await fetch("/api/takip/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satirIds: Array.from(selectedIds),
          kolonKod,
          value,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(result.message || "Değerler güncellendi");
        // Tabloyu yenile
        await fetchSatirlar();
        setBulkDialogOpen(false);
        exitSelectionMode();
      } else {
        toast.error(result.error || "Güncelleme başarısız");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Toplu güncelleme hatası:", error);
      toast.error("Toplu güncelleme sırasında hata oluştu");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Tümünü sıfırla
  const handleResetAll = async () => {
    if (
      !window.confirm(
        `${MONTHS.find(m => m.value === month)?.label} ${year} dönemindeki tüm tikleri 'Bekliyor' konumuna getirmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/takip/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });

      if (res.ok) {
        await fetchSatirlar();
        toast.success("Tüm tikler sıfırlandı");
      }
    } catch (error) {
      console.error("[TakipCizelgesi] Sıfırlama başarısız:", error);
      toast.error("Sıfırlama başarısız");
    }
  };

  // Excel export
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/takip/export?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Export hatası");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `takip_${MONTHS.find(m => m.value === month)?.label}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel indirildi");
    } catch {
      toast.error("Excel oluşturulurken hata oluştu");
    }
  };

  // NO'yu sayıya çevir (sıralama için)
  const parseNo = (no: string): number => {
    const num = parseInt(no.replace(/\D/g, ""), 10);
    return isNaN(num) ? Infinity : num;
  };

  // Sistem olmayan aktif kolonlar
  const dinamikKolonlar = useMemo(
    () => kolonlar.filter((k) => !k.sistem && k.aktif),
    [kolonlar]
  );

  // Arama + kolon filtresi ve NO'ya göre sıralama
  const filteredSatirlar = useMemo(() => {
    return satirlar
      .filter((s) => {
        // Arama filtresi
        if (searchTerm && !s.isim.toLowerCase().includes(searchTerm.toLowerCase()) && !s.no.includes(searchTerm)) {
          return false;
        }
        // Kolon bazlı filtre
        if (filterKolon && filterStatus !== null) {
          const cellData = extractCellData(s.degerler[filterKolon]);
          if (filterStatus === "null") return cellData.value === null || cellData.value === undefined;
          if (filterStatus === "true") return cellData.value === true;
          if (filterStatus === "false") return cellData.value === false;
          if (filterStatus === "handled") return cellData.value === true || cellData.value === false;
        }
        return true;
      })
      .sort((a, b) => parseNo(a.no) - parseNo(b.no));
  }, [satirlar, searchTerm, filterKolon, filterStatus]);

  // Virtual scrolling
  const useVirtual = filteredSatirlar.length > VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: filteredSatirlar.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
    enabled: useVirtual,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = useVirtual && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = useVirtual && virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  // Filtre temizleme
  const clearFilters = useCallback(() => {
    setFilterKolon(null);
    setFilterStatus(null);
  }, []);

  const hasActiveFilter = filterKolon !== null && filterStatus !== null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const selectedMonth = MONTHS.find((m) => m.value === month);
  const colSpan = dinamikKolonlar.length + 4 + (isSelectionMode ? 1 : 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-5">
          {/* Baslik ve Donem Secimi */}
          <div className="px-4 xl:px-6 py-4 xl:py-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4 xl:gap-6">
              {/* Sol Taraf - Baslik + Donem */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Icon icon="solar:clipboard-list-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Muhasebe Takip Çizelgesi
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Aylık muhasebe işlemlerini takip edin
                    </p>
                  </div>
                </div>

                {/* Dönem Seçici */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Icon icon="solar:calendar-bold" className="h-4 w-4" />
                    <span className="font-medium">Dönem:</span>
                  </div>

                  {/* Ay Seçici */}
                  <Select
                    value={month.toString()}
                    onValueChange={(val) => setMonth(parseInt(val))}
                  >
                    <SelectTrigger className="w-32 h-9 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Yıl Seçici */}
                  <Select
                    value={year.toString()}
                    onValueChange={(val) => setYear(parseInt(val))}
                  >
                    <SelectTrigger className="w-24 h-9 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sag Taraf - Aksiyonlar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Arama */}
                <div className="relative">
                  <Icon icon="solar:magnifer-bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Müşteri ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 w-52 h-9 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Kolon Filtre */}
                <Select
                  value={filterKolon || "__all__"}
                  onValueChange={(v) => {
                    setFilterKolon(v === "__all__" ? null : v);
                    setFilterStatus(null);
                  }}
                >
                  <SelectTrigger className="w-36 h-9 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                    <SelectValue placeholder="Filtrele..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {dinamikKolonlar.filter(k => k.tip === "boolean").map(k => (
                      <SelectItem key={k.id} value={k.kod}>{k.baslik}</SelectItem>
                    ))}
                    <SelectItem value="SONDUR">Son Durum</SelectItem>
                  </SelectContent>
                </Select>

                {/* Durum Filtre */}
                {filterKolon && (
                  <Select
                    value={filterStatus || ""}
                    onValueChange={(v) => setFilterStatus(v || null)}
                  >
                    <SelectTrigger className="w-40 h-9 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <SelectValue placeholder="Durum..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Bekliyor (Eksik)</SelectItem>
                      <SelectItem value="true">Tamam</SelectItem>
                      <SelectItem value="false">İptal (Yapılmayacak)</SelectItem>
                      <SelectItem value="handled">İşlenmiş (Tamam+İptal)</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Filtre temizle */}
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 px-2 text-slate-500 hover:text-slate-700"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                )}

                {/* Toplu İşlemler */}
                <Button
                  variant={isSelectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                  className={`h-9 px-3 ${isSelectionMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white"}`}
                >
                  <Icon icon="solar:checklist-bold" className="w-4 h-4 mr-1.5" />
                  {isSelectionMode ? "Seçim Modundan Çık" : "Toplu İşlemler"}
                </Button>

                {/* Excel Export */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-9 px-3 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white"
                >
                  <Icon icon="solar:download-minimalistic-bold" className="w-4 h-4 mr-1.5" />
                  Excel
                </Button>

                {/* Sıfırla */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="h-9 px-3 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white"
                >
                  <RotateCcwIcon className="w-4 h-4 mr-1.5" />
                  Sıfırla
                </Button>

                {/* Kolon Ekle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setKolonEkleOpen(true)}
                  className="h-9 px-3 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white"
                >
                  <Icon icon="solar:add-circle-bold" className="h-4 w-4 mr-1.5" />
                  Kolon Ekle
                </Button>

                {/* Yeni Satır */}
                <Button
                  size="sm"
                  onClick={handleAddSatir}
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Icon icon="solar:add-circle-bold" className="h-4 w-4 mr-1.5" />
                  Yeni Satır
                </Button>
              </div>
            </div>
          </div>

          {/* Info Bar */}
          <div className="px-4 xl:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs">
              {/* Sol taraf - müşteri sayısı ve dönem */}
              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{filteredSatirlar.length}</span> müşteri
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedMonth?.label} {year}</span> Dönemi
                </span>
                {hasActiveFilter && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      Filtre aktif
                    </span>
                  </>
                )}
              </div>

              {/* Sağ taraf - göstergeler */}
              <div className="flex items-center gap-5 text-slate-500 dark:text-slate-400">
                {/* Tamam */}
                <div className="flex items-center gap-1.5">
                  <CheckIcon className="w-3.5 h-3.5 text-green-600 dark:text-green-500" strokeWidth={2.5} />
                  <span>Tamam</span>
                </div>
                {/* İptal */}
                <div className="flex items-center gap-1.5">
                  <XIcon className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" strokeWidth={2.5} />
                  <span>İptal (Yapılmayacak)</span>
                </div>
                {/* Bekliyor */}
                <div className="flex items-center gap-1.5">
                  <CircleIcon className="w-2 h-2 text-slate-400 dark:text-slate-500" />
                  <span>Bekliyor (Eksik)</span>
                </div>
                {/* Separator */}
                <span className="text-slate-300 dark:text-slate-600">|</span>
                {/* Tüm işlemler tamamlandı */}
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span className="font-medium">Tüm işlemler tamamlandı</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div ref={parentRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                  {/* Checkbox kolonu - Selection mode */}
                  {isSelectionMode && (
                    <th className="border-x border-slate-200 dark:border-slate-600 px-2 py-2.5 bg-blue-100 dark:bg-blue-900 font-semibold text-xs text-slate-600 dark:text-slate-300 w-10">
                      <span className="sr-only">Seç</span>
                    </th>
                  )}
                  {/* Sistem Kolonları */}
                  <th className="border-x border-slate-200 dark:border-slate-600 px-2 py-2.5 bg-slate-100 dark:bg-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-300 w-12">
                    No
                  </th>
                  <th className="border-x border-slate-200 dark:border-slate-600 px-2 py-2.5 bg-slate-100 dark:bg-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-300 min-w-[200px] text-left">
                    İsim/Ünvan
                  </th>

                  {/* Dinamik Kolonlar */}
                  {dinamikKolonlar.map((kolon) => (
                    <KolonHeader
                      key={kolon.id}
                      kolon={kolon}
                      onUpdate={(data) => handleUpdateKolon(kolon.id, data)}
                      onDelete={() => handleDeleteKolon(kolon.id)}
                    />
                  ))}

                  {/* Son Durum - Kalıcı Kolon */}
                  <th className="border-x border-slate-200 dark:border-slate-600 px-2 py-2.5 bg-green-600 dark:bg-green-700 font-semibold text-xs text-white whitespace-nowrap">
                    Son Durum
                  </th>

                  {/* Sil kolonu */}
                  <th className="border-x border-slate-200 dark:border-slate-600 px-2 py-2.5 bg-red-500 dark:bg-red-600 w-10">
                    <span className="text-xs font-semibold text-white">Sil</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSatirlar.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <InboxIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        <p className="font-medium text-slate-500 dark:text-slate-400">
                          {searchTerm || hasActiveFilter
                            ? "Arama/filtre sonucu bulunamadı"
                            : "Henüz satır eklenmemiş"}
                        </p>
                        {!searchTerm && !hasActiveFilter && (
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            Yeni Satır butonuna tıklayarak başlayın
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : useVirtual ? (
                  <>
                    {paddingTop > 0 && (
                      <tr><td style={{ height: paddingTop }} colSpan={colSpan} /></tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const satir = filteredSatirlar[virtualRow.index];
                      return (
                        <TakipSatirRow
                          key={satir.id}
                          satir={satir}
                          kolonlar={kolonlar}
                          onUpdate={handleUpdateSatir}
                          onDelete={handleDeleteSatir}
                          isSelectionMode={isSelectionMode}
                          isSelected={isSelected(satir.id)}
                          onToggleSelect={() => toggleRow(satir.id)}
                        />
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr><td style={{ height: paddingBottom }} colSpan={colSpan} /></tr>
                    )}
                  </>
                ) : (
                  filteredSatirlar.map((satir) => (
                    <TakipSatirRow
                      key={satir.id}
                      satir={satir}
                      kolonlar={kolonlar}
                      onUpdate={handleUpdateSatir}
                      onDelete={handleDeleteSatir}
                      isSelectionMode={isSelectionMode}
                      isSelected={isSelected(satir.id)}
                      onToggleSelect={() => toggleRow(satir.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filteredSatirlar.length > 0 && (
            <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Toplam <span className="font-medium text-slate-700 dark:text-slate-200">{filteredSatirlar.length}</span> kayıt gösteriliyor
                  {useVirtual && (
                    <span className="ml-2 text-blue-500">(virtual scroll aktif)</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Kolon Ekle Modal */}
      <KolonEkleModal
        open={kolonEkleOpen}
        onOpenChange={setKolonEkleOpen}
        onAdd={handleAddKolon}
        mevcutKolonlar={kolonlar.map((k) => k.kod)}
      />

      {/* Bulk Action Bar */}
      {isSelectionMode && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={filteredSatirlar.length}
          onSelectAll={() => selectAll(filteredSatirlar.map((s) => s.id))}
          onDeselectAll={deselectAll}
          onCancel={exitSelectionMode}
        >
          <Button
            size="sm"
            onClick={() => setBulkDialogOpen(true)}
            disabled={selectedCount === 0}
            className="h-9 px-4"
          >
            <Icon icon="solar:pen-bold" className="h-4 w-4 mr-1.5" />
            Değer Değiştir
          </Button>
        </BulkActionBar>
      )}

      {/* Bulk Value Dialog */}
      <BulkValueDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selectedCount}
        kolonlar={kolonlar}
        onConfirm={handleBulkValueUpdate}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}
