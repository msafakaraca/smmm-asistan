"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Users,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardDeclarationData } from "@/types/dashboard";

interface DeclarationStatusPanelProps {
  period?: { year: number; month: number };
  onPeriodChange?: (year: number, month: number) => void;
  className?: string;
}

const monthNames = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// Durum renkleri ve ikonları
const statusConfig = {
  verildi: {
    label: "Verildi",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
  },
  bekliyor: {
    label: "Bekliyor",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: Clock,
    iconColor: "text-amber-500",
  },
  eksik: {
    label: "Eksik",
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
    borderColor: "border-gray-200 dark:border-gray-700",
    icon: AlertCircle,
    iconColor: "text-gray-400",
  },
  verilmeyecek: {
    label: "Verilmeyecek",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

export function DeclarationStatusPanel({
  period,
  className,
}: DeclarationStatusPanelProps) {
  const [data, setData] = useState<DashboardDeclarationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Veri çekme fonksiyonu
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period) {
        params.set("year", String(period.year));
        params.set("month", String(period.month));
      }

      const res = await fetch(`/api/dashboard/declaration-stats?${params}`);
      if (!res.ok) throw new Error("Veri yüklenemedi");

      const result: DashboardDeclarationData = await res.json();
      setData(result);

      // İlk yüklemede ilk türü seç
      if (result.declarations.length > 0 && !selectedType) {
        setSelectedType(result.declarations[0].code);
      }
    } catch (error) {
      console.error("Error fetching declaration stats:", error);
    } finally {
      setLoading(false);
    }
  }, [period, selectedType]);

  // Period değiştiğinde veriyi yeniden çek
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.year, period?.month]);

  const periodLabel = data?.period
    ? `${monthNames[data.period.month - 1]} ${data.period.year}`
    : period
    ? `${monthNames[period.month - 1]} ${period.year}`
    : "";

  // Seçili beyanname türü
  const selectedTypeData = data?.declarations.find((d) => d.code === selectedType) || null;

  if (loading) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Beyanname Durumu</span>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-28 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!data || data.declarations.length === 0) {
    return (
      <Card className={cn("p-4 flex flex-col", className)}>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Beyanname Durumu</span>
          {periodLabel && (
            <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Bu dönem için beyanname verisi yok</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Beyanname Durumu</span>
        {periodLabel && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {periodLabel}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-lg font-bold text-emerald-600">
            %{data.summary.completionRate}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={fetchData}
            title="Yenile"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Beyanname Türleri Butonları - Yatay Kaydırma */}
      <DeclarationTypeScroller
        declarations={data.declarations}
        selectedType={selectedType}
        onSelectType={setSelectedType}
      />

      {/* Seçili Beyanname Türü Detayları */}
      {selectedTypeData && (
        <div className="flex flex-col flex-1 gap-3">
          {/* Toplam Müşteri */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Toplam Müşteri</span>
            </div>
            <span className="text-lg font-bold">{selectedTypeData.total}</span>
          </div>

          {/* Durum Kartları Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Verildi */}
            <StatusCard
              status="verildi"
              count={selectedTypeData.verildi}
              effectiveTotal={selectedTypeData.total - selectedTypeData.verilmeyecek}
            />

            {/* Eksik */}
            <StatusCard
              status="eksik"
              count={selectedTypeData.eksik}
              effectiveTotal={selectedTypeData.total - selectedTypeData.verilmeyecek}
            />

            {/* Bekliyor */}
            <StatusCard
              status="bekliyor"
              count={selectedTypeData.bekliyor}
              effectiveTotal={selectedTypeData.total - selectedTypeData.verilmeyecek}
            />

            {/* Verilmeyecek - yüzde gösterme */}
            <StatusCard
              status="verilmeyecek"
              count={selectedTypeData.verilmeyecek}
              showPercentage={false}
            />
          </div>

          {/* Progress Bar - Sadece verildi, eksik, bekliyor (verilmeyecek hariç) */}
          {(() => {
            const effectiveTotal = selectedTypeData.total - selectedTypeData.verilmeyecek;
            const completionPercent = effectiveTotal > 0
              ? Math.round((selectedTypeData.verildi / effectiveTotal) * 100)
              : 0;

            return (
              <div className="space-y-1.5 mt-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tamamlanma</span>
                  <span>
                    {selectedTypeData.verildi} / {effectiveTotal} (%{completionPercent})
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                  {/* Verildi */}
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${
                        effectiveTotal > 0
                          ? (selectedTypeData.verildi / effectiveTotal) * 100
                          : 0
                      }%`,
                    }}
                  />
                  {/* Bekliyor */}
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{
                      width: `${
                        effectiveTotal > 0
                          ? (selectedTypeData.bekliyor / effectiveTotal) * 100
                          : 0
                      }%`,
                    }}
                  />
                  {/* Eksik */}
                  <div
                    className="h-full bg-gray-300 transition-all"
                    style={{
                      width: `${
                        effectiveTotal > 0
                          ? (selectedTypeData.eksik / effectiveTotal) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Detay Linki - en alta yapışık */}
          <div className="mt-auto">
            {selectedTypeData.hasDetailPage ? (
              <Link
                href={`${selectedTypeData.route}?year=${data.period.year}&month=${data.period.month}`}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Detaylı çizelgeyi görüntüle</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed text-sm text-muted-foreground/60">
                <span>Çizelge hazırlanıyor...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Beyanname Türleri Yatay Kaydırma Bileşeni
function DeclarationTypeScroller({
  declarations,
  selectedType,
  onSelectType,
}: {
  declarations: DashboardDeclarationData["declarations"];
  selectedType: string | null;
  onSelectType: (code: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, declarations]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -150 : 150, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1 mb-4">
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none flex-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {declarations.map((type) => {
          const isSelected = selectedType === type.code;
          const effectiveTotal = type.total - type.verilmeyecek;
          const completionPercent = effectiveTotal > 0
            ? Math.round((type.verildi / effectiveTotal) * 100)
            : 0;

          return (
            <button
              key={type.code}
              onClick={() => onSelectType(type.code)}
              className={cn(
                "relative h-auto py-2 px-3 rounded-md border text-left transition-all flex-shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium text-xs">{type.name}</span>
                <span
                  className={cn(
                    "text-[10px]",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}
                >
                  {type.verildi}/{effectiveTotal} (%{completionPercent})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// Durum Kartı Bileşeni
function StatusCard({
  status,
  count,
  effectiveTotal,
  showPercentage = true,
}: {
  status: keyof typeof statusConfig;
  count: number;
  effectiveTotal?: number;
  showPercentage?: boolean;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const percentage = showPercentage && effectiveTotal && effectiveTotal > 0
    ? Math.round((count / effectiveTotal) * 100)
    : null;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", config.iconColor)} />
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-bold", config.color)}>{count}</span>
        {percentage !== null && (
          <span className="text-xs text-muted-foreground">(%{percentage})</span>
        )}
      </div>
    </div>
  );
}
