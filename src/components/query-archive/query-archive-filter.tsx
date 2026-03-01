"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, Trash2, Eye, ChevronDown, ChevronRight, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  useQueryArchives,
  type ArchiveSummary,
} from "@/components/query-archive/hooks/use-query-archives";

// ============================================
// Tipler
// ============================================

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface QueryArchiveFilterProps {
  queryType: string;
  customers: CustomerOption[];
  onShowArchiveData: (
    archiveId: string,
    data: unknown[],
    customerName?: string
  ) => void;
  onClearArchiveData?: () => void;
  showAmount?: boolean;
  amountLabel?: string;
}

// ============================================
// Yardımcı Fonksiyonlar
// ============================================

const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// Bileşen
// ============================================

export default function QueryArchiveFilter({
  queryType,
  customers,
  onShowArchiveData,
  onClearArchiveData,
  showAmount = false,
  amountLabel = "Tutar",
}: QueryArchiveFilterProps) {
  // Filtre state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    let m = now.getMonth(); // 0-indexed → önceki ay
    if (m === 0) m = 12;
    return m;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    const m = now.getMonth();
    return m === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });

  // Accordion state: müşteri ID → açık/kapalı
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set()
  );
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const {
    archives,
    loading,
    summary,
    loadArchives,
    loadArchiveDetail,
    deleteArchive,
  } = useQueryArchives();

  // Yıl seçenekleri
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // Müşteri seçimi
  const toggleCustomer = useCallback((id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const selectAllCustomers = useCallback(() => {
    setSelectedCustomerIds(customers.map((c) => c.id));
  }, [customers]);

  const deselectAllCustomers = useCallback(() => {
    setSelectedCustomerIds([]);
  }, []);

  // Filtre uygula
  const handleFilter = useCallback(async () => {
    if (filterMode === "monthly") {
      await loadArchives({
        queryType,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        startMonth: selectedMonth,
        startYear: selectedYear,
        endMonth: selectedMonth,
        endYear: selectedYear,
      });
    } else {
      await loadArchives({
        queryType,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        startMonth: 1,
        startYear: selectedYear,
        endMonth: 12,
        endYear: selectedYear,
      });
    }
  }, [
    queryType,
    selectedCustomerIds,
    filterMode,
    selectedMonth,
    selectedYear,
    loadArchives,
  ]);

  // Müşterilere göre grupla
  const groupedArchives = useMemo(() => {
    const map = new Map<
      string,
      { customerName: string; customerVkn: string; archives: ArchiveSummary[] }
    >();

    for (const a of archives) {
      if (!map.has(a.customerId)) {
        map.set(a.customerId, {
          customerName: a.customerName,
          customerVkn: a.customerVkn,
          archives: [],
        });
      }
      map.get(a.customerId)!.archives.push(a);
    }

    return Array.from(map.entries()).sort((a, b) =>
      a[1].customerName.localeCompare(b[1].customerName, "tr")
    );
  }, [archives]);

  // Arşiv göster
  const handleShowArchive = useCallback(
    async (archive: ArchiveSummary) => {
      setLoadingDetail(archive.id);
      try {
        const detail = await loadArchiveDetail(archive.id);
        if (detail) {
          onShowArchiveData(
            archive.id,
            detail.resultData,
            archive.customerName
          );
        } else {
          toast.error("Arşiv verisi yüklenemedi");
        }
      } finally {
        setLoadingDetail(null);
      }
    },
    [loadArchiveDetail, onShowArchiveData]
  );

  // Yıllık modda müşteri tıklama: tüm aylık arşivleri yükle ve birleştir
  const handleShowYearlyCustomer = useCallback(
    async (customerId: string, customerName: string) => {
      const customerArchives = archives.filter(
        (a) => a.customerId === customerId
      );
      if (customerArchives.length === 0) return;

      setLoadingDetail(customerId);
      try {
        // Tüm aylık arşivleri paralel yükle
        const details = await Promise.all(
          customerArchives.map((a) => loadArchiveDetail(a.id))
        );

        // Birleştir ve _donemAy/_donemYil ekle
        const allData: unknown[] = [];
        for (let i = 0; i < details.length; i++) {
          const detail = details[i];
          const archive = customerArchives[i];
          if (detail && Array.isArray(detail.resultData)) {
            for (const item of detail.resultData) {
              allData.push({
                ...(item as Record<string, unknown>),
                _donemAy: archive.month,
                _donemYil: archive.year,
              });
            }
          }
        }

        onShowArchiveData(customerId, allData, customerName);
      } catch {
        toast.error("Yıllık arşiv verisi yüklenemedi");
      } finally {
        setLoadingDetail(null);
      }
    },
    [archives, loadArchiveDetail, onShowArchiveData]
  );

  // Arşiv sil
  const handleDelete = useCallback(
    async (archive: ArchiveSummary) => {
      const ok = await deleteArchive(archive.id);
      if (ok) {
        toast.success(
          `${archive.customerName} — ${AY_ISIMLERI[archive.month - 1]} ${archive.year} arşivi silindi`
        );
      } else {
        toast.error("Arşiv silinemedi");
      }
    },
    [deleteArchive]
  );

  // Toggle accordion
  const toggleExpanded = useCallback((customerId: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }, []);

  // Filtrelenmiş müşteriler
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(q) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(q)) ||
        c.vknTckn.includes(q)
    );
  }, [customers, customerSearch]);

  return (
    <div className="space-y-4">
      {/* Filtre Paneli */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Mükellef Seçimi */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mükellef</label>
          <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[240px] justify-between text-left font-normal"
              >
                <span className="truncate">
                  {selectedCustomerIds.length === 0
                    ? "Tüm mükellefler"
                    : selectedCustomerIds.length === 1
                    ? customers.find((c) => c.id === selectedCustomerIds[0])
                        ?.kisaltma ||
                      customers.find((c) => c.id === selectedCustomerIds[0])
                        ?.unvan ||
                      "1 seçili"
                    : `${selectedCustomerIds.length} mükellef seçili`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="p-2 border-b">
                <input
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="Ara..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="p-2 border-b flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={selectAllCustomers}
                >
                  Tümünü Seç
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={deselectAllCustomers}
                >
                  Temizle
                </Button>
              </div>
              <div className="max-h-[250px] overflow-y-auto p-1">
                {filteredCustomers.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCustomerIds.includes(c.id)}
                      onCheckedChange={() => toggleCustomer(c.id)}
                    />
                    <span className="text-sm truncate">
                      {c.kisaltma || c.unvan}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Dönem Modu */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Dönem</label>
          <Select
            value={filterMode}
            onValueChange={(v) => setFilterMode(v as "monthly" | "yearly")}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="yearly">Yıllık</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ay Seçimi (sadece aylık modda) */}
        {filterMode === "monthly" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ay</label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AY_ISIMLERI.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Yıl Seçimi */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Yıl</label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtrele Butonu */}
        <Button onClick={handleFilter} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Filtrele
        </Button>

        {onClearArchiveData && archives.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearArchiveData}>
            Temizle
          </Button>
        )}
      </div>

      {/* Özet */}
      {summary && archives.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            <strong>{summary.totalArchives}</strong> arşiv kaydı
          </span>
          <span>
            <strong>{summary.grandTotalCount}</strong> toplam kayıt
          </span>
          {showAmount && summary.grandTotalAmount > 0 && (
            <span>
              <strong>
                {summary.grandTotalAmount.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                })}
              </strong>{" "}
              ₺ toplam {amountLabel.toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* Sonuç Listesi — Müşteri Gruplu */}
      {archives.length > 0 && (
        <div className="border rounded-lg divide-y">
          {groupedArchives.map(([customerId, group]) => {
            const isExpanded = expandedCustomers.has(customerId);
            const totalForCustomer = group.archives.reduce(
              (s, a) => s + a.totalCount,
              0
            );
            const isLoadingCustomer = loadingDetail === customerId;

            return (
              <div key={customerId}>
                {/* Müşteri Başlık */}
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/50 text-left"
                  onClick={() => {
                    if (filterMode === "yearly") {
                      handleShowYearlyCustomer(customerId, group.customerName);
                    } else {
                      toggleExpanded(customerId);
                    }
                  }}
                >
                  {filterMode === "monthly" ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )
                  ) : isLoadingCustomer ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 shrink-0 text-blue-500" />
                  )}
                  <span className="font-medium text-sm">
                    {group.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({group.customerVkn})
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {group.archives.length} dönem — {totalForCustomer} kayıt
                  </span>
                </button>

                {/* Aylık detaylar (aylık modda) */}
                {filterMode === "monthly" && isExpanded && (
                  <div className="bg-muted/30">
                    {group.archives.map((archive) => (
                      <div
                        key={archive.id}
                        className="flex items-center gap-3 px-8 py-2 text-sm border-t border-border/50"
                      >
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {AY_ISIMLERI[archive.month - 1]} {archive.year}
                        </span>
                        <span className="text-muted-foreground">
                          {archive.totalCount} kayıt
                        </span>
                        {showAmount && archive.totalAmount > 0 && (
                          <span className="text-muted-foreground">
                            {archive.totalAmount.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            ₺
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          Son: {formatDate(archive.lastQueriedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={loadingDetail === archive.id}
                          onClick={() => handleShowArchive(archive)}
                        >
                          {loadingDetail === archive.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">Göster</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(archive)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Boş durum */}
      {!loading && archives.length === 0 && summary !== null && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Seçilen dönem için arşiv kaydı bulunamadı.
        </div>
      )}
    </div>
  );
}
