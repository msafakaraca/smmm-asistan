/**
 * Beyanname Grup Listesi
 * ======================
 * Beyannameleri yıl bazında ayırır, her yılın altında açılır/kapanır tür grupları gösterir.
 * Yıl ayracı: ortada çizgi + yıl yazısı.
 * Düzeltme etiketi sadece açıklaması olan beyannamelerde gösterilir.
 */

"use client";

import { memo, useState, useCallback, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Eye, Loader2, Mail } from "lucide-react";
import type { BeyannameItem } from "./hooks/use-beyanname-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface TypeGroup {
  turKodu: string;
  turAdi: string;
  items: BeyannameItem[];
}

interface YearGroup {
  year: string;
  typeGroups: TypeGroup[];
  totalCount: number;
}

interface BeyannameGroupListProps {
  beyannameler: BeyannameItem[];
  pdfLoading: string | null;
  onViewPdf: (beyoid: string) => void;
  selectedCustomerId: string;
  downloadedBeyoids?: Set<string>;
  isPipelineActive?: boolean;
  saveProgress?: { saved: number; skipped: number; failed: number; total: number };
  onHoverStart?: (item: BeyannameItem) => void;
  unavailableBeyoids?: Set<string>;
  onWhatsApp?: (item: BeyannameItem) => void;
  onMail?: (item: BeyannameItem) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

/** Dönem'den yıl çıkar: "202501" → "2025", "202501202503" → "2025" */
function extractYear(donem: string): string {
  if (!donem || donem.length < 4) return "Bilinmeyen";
  return donem.substring(0, 4);
}

/** Dönem formatı: ay/yıl — "202510" → "10/2025", "202501202503" → "01/2025-03/2025" */
function formatDonem(donem: string): string {
  if (!donem) return "";
  if (donem.length === 12) {
    const basAy = donem.substring(4, 6);
    const basYil = donem.substring(0, 4);
    const bitAy = donem.substring(10, 12);
    const bitYil = donem.substring(6, 10);
    if (basAy === bitAy && basYil === bitYil) return `${basAy}/${basYil}`;
    return `${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }
  if (donem.length === 6) {
    const ay = donem.substring(4, 6);
    const yil = donem.substring(0, 4);
    return `${ay}/${yil}`;
  }
  return donem;
}

// ═══════════════════════════════════════════════════════════════════════════
// BeyannameItemCard — Tek beyanname kartı
// ═══════════════════════════════════════════════════════════════════════════

interface BeyannameItemCardProps {
  item: BeyannameItem;
  pdfLoading: string | null;
  onViewPdf: (beyoid: string) => void;
  isDownloaded: boolean;
  showProgress: boolean;
  onHoverStart?: (item: BeyannameItem) => void;
  isUnavailable?: boolean;
  onWhatsApp?: (item: BeyannameItem) => void;
  onMail?: (item: BeyannameItem) => void;
}

const BeyannameItemCard = memo(function BeyannameItemCard({
  item,
  pdfLoading,
  onViewPdf,
  isDownloaded,
  showProgress,
  onHoverStart,
  isUnavailable = false,
  onWhatsApp,
  onMail,
}: BeyannameItemCardProps) {
  const isLoadingPdf = pdfLoading === item.beyoid;
  const hasBeyoid = !!item.beyoid;
  const isClickable = hasBeyoid && !isUnavailable;
  const isDuzeltme = !!item.aciklama?.trim();
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-3 rounded-md border border-l-2 px-3 py-2 transition-[colors,transform] ${
        isUnavailable
          ? "border-l-slate-300 bg-slate-50/60 dark:border-l-slate-600 dark:bg-slate-950/20 opacity-50"
          : "border-l-blue-400 bg-blue-50/60 dark:border-l-blue-500 dark:bg-blue-950/20"
      } ${
        isClickable
          ? "hover:bg-blue-100/80 dark:hover:bg-blue-950/40 cursor-pointer"
          : isUnavailable
            ? "cursor-not-allowed"
            : "hover:bg-blue-100/50 dark:hover:bg-blue-950/30"
      }`}
      onClick={(e) => {
        if (!isClickable || isLoadingPdf) return;
        if ((e.target as HTMLElement).closest("button")) return;
        onViewPdf(item.beyoid);
      }}
      onMouseDown={(e) => {
        if (!isClickable) return;
        if ((e.target as HTMLElement).closest("button")) return;
        rowRef.current?.style.setProperty("transform", "scale(0.99)");
      }}
      onMouseUp={() => rowRef.current?.style.removeProperty("transform")}
      onMouseLeave={() => rowRef.current?.style.removeProperty("transform")}
      onMouseEnter={() => isClickable && onHoverStart?.(item)}
      title={isUnavailable ? "PDF mevcut değil — sorgulama sayfasından tekrar sorgulayın" : hasBeyoid ? `${item.turAdi} - ${formatDonem(item.donem)} PDF görüntüle` : undefined}
    >
      {/* Dönem */}
      <span className={`text-sm font-medium whitespace-nowrap min-w-[70px] ${isUnavailable ? "text-slate-400 dark:text-slate-500" : "text-blue-700 dark:text-blue-300"}`}>
        {formatDonem(item.donem)}
      </span>

      {/* Düzeltme etiketi — sadece açıklaması varsa */}
      {isDuzeltme && (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
          Düzeltme
        </span>
      )}

      {/* Açıklama */}
      {isDuzeltme && (
        <span
          className="text-xs text-muted-foreground truncate max-w-[300px]"
          title={item.aciklama}
        >
          {item.aciklama}
        </span>
      )}

      {/* Boşluk dolgusu */}
      <div className="flex-1" />

      {/* PDF mevcut değil etiketi */}
      {isUnavailable && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
          PDF yok
        </span>
      )}

      {/* İndirme durumu çubuğu */}
      {showProgress && !isUnavailable && (
        <div className="w-5 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDownloaded ? "w-full bg-emerald-500" : "w-0"
            }`}
          />
        </div>
      )}

      {/* WhatsApp Butonu */}
      {onWhatsApp && (
        <button
          type="button"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-all duration-200 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => onWhatsApp(item)}
          title="WhatsApp ile gönder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="#4aba5a">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
      )}

      {/* Mail Butonu */}
      {onMail && (
        <button
          type="button"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-all duration-200 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
          onClick={() => onMail(item)}
          title="Mail ile gönder"
        >
          <Mail className="h-5 w-5" />
        </button>
      )}

      {/* PDF İkonu */}
      <span
        className={`inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-all duration-200 ${
          isUnavailable
            ? "text-slate-300 dark:text-slate-600"
            : isDownloaded
              ? "text-emerald-500"
              : hasBeyoid
                ? "text-blue-500"
                : "text-muted-foreground/30"
        }`}
      >
        {isLoadingPdf ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </span>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TypeGroupSection — Açılır/kapanır tür grubu
// ═══════════════════════════════════════════════════════════════════════════

interface TypeGroupSectionProps {
  group: TypeGroup;
  isExpanded: boolean;
  onToggle: () => void;
  pdfLoading: string | null;
  onViewPdf: (beyoid: string) => void;
  downloadedBeyoids: Set<string>;
  showProgress: boolean;
  onHoverStart?: (item: BeyannameItem) => void;
  unavailableBeyoids: Set<string>;
  onWhatsApp?: (item: BeyannameItem) => void;
  onMail?: (item: BeyannameItem) => void;
}

const TypeGroupSection = memo(function TypeGroupSection({
  group,
  isExpanded,
  onToggle,
  pdfLoading,
  onViewPdf,
  downloadedBeyoids,
  showProgress,
  onHoverStart,
  unavailableBeyoids,
  onWhatsApp,
  onMail,
}: TypeGroupSectionProps) {
  const downloadedInGroup = useMemo(() => {
    if (!showProgress) return 0;
    return group.items.filter((item) => downloadedBeyoids.has(item.beyoid)).length;
  }, [group.items, downloadedBeyoids, showProgress]);

  const totalInGroup = group.items.length;
  const progressPercent = totalInGroup > 0 ? (downloadedInGroup / totalInGroup) * 100 : 0;
  const allDone = downloadedInGroup === totalInGroup && totalInGroup > 0;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Tür başlığı — tıklanabilir */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">
          {group.turKodu}
        </span>
        <span className="text-xs text-muted-foreground">
          {group.turAdi}
        </span>
        <div className="flex-1" />
        {/* Sağ taraf: progress + sayaç — sabit genişlik ile hizalı */}
        <div className="flex items-center shrink-0 w-[220px] gap-2">
          {showProgress && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    allDone ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-semibold w-[44px] text-left ${allDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {downloadedInGroup}/{totalInGroup}
              </span>
            </div>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {group.items.length} beyanname
          </span>
        </div>
      </button>

      {/* Kartlar — sadece açıkken */}
      {isExpanded && (
        <div className="flex flex-col gap-1 p-2 border-t">
          {group.items.map((item, idx) => (
            <BeyannameItemCard
              key={`${item.turKodu}-${item.donem}-${item.versiyon}-${idx}`}
              item={item}
              pdfLoading={pdfLoading}
              onViewPdf={onViewPdf}
              isDownloaded={downloadedBeyoids.has(item.beyoid)}
              showProgress={showProgress}
              onHoverStart={onHoverStart}
              isUnavailable={unavailableBeyoids.has(item.beyoid)}
              onWhatsApp={onWhatsApp}
              onMail={onMail}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// YearDivider — Yıl ayracı (çizgi + yıl yazısı)
// ═══════════════════════════════════════════════════════════════════════════

function YearDivider({ year, count }: { year: string; count: number }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-sm font-bold text-muted-foreground px-2">
        {year}
        <span className="ml-2 text-xs font-normal">({count} beyanname)</span>
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BeyannameGroupList — Ana component
// ═══════════════════════════════════════════════════════════════════════════

export default memo(function BeyannameGroupList({
  beyannameler,
  pdfLoading,
  onViewPdf,
  selectedCustomerId,
  downloadedBeyoids = new Set<string>(),
  isPipelineActive = false,
  saveProgress = { saved: 0, skipped: 0, failed: 0, total: 0 },
  onHoverStart,
  unavailableBeyoids = new Set<string>(),
  onWhatsApp,
  onMail,
}: BeyannameGroupListProps) {
  // Progress göster: pipeline aktif veya bazı PDF'ler indirilmiş
  const showProgress = isPipelineActive || saveProgress.saved + saveProgress.skipped > 0;
  // Yıl → Tür → Beyanname şeklinde grupla
  const yearGroups = useMemo((): YearGroup[] => {
    const yearMap = new Map<string, Map<string, TypeGroup>>();

    for (const b of beyannameler) {
      const year = extractYear(b.donem);

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map<string, TypeGroup>());
      }
      const typeMap = yearMap.get(year)!;

      if (!typeMap.has(b.turKodu)) {
        typeMap.set(b.turKodu, {
          turKodu: b.turKodu,
          turAdi: b.turAdi,
          items: [],
        });
      }
      typeMap.get(b.turKodu)!.items.push(b);
    }

    // Yılları büyükten küçüğe sırala (2025, 2024, 2023...)
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedYears.map((year) => {
      const typeMap = yearMap.get(year)!;
      const typeGroups = Array.from(typeMap.values()).sort(
        (a, b) => a.turAdi.localeCompare(b.turAdi, "tr")
      );
      // Her grup içi: en yeni dönem üste
      for (const tg of typeGroups) {
        tg.items.sort((a, b) => b.donem.localeCompare(a.donem));
      }
      const totalCount = typeGroups.reduce((sum, tg) => sum + tg.items.length, 0);
      return { year, typeGroups, totalCount };
    });
  }, [beyannameler]);

  // Accordion state — varsayılan: tümü kapalı
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleViewPdf = useCallback(
    (beyoid: string) => {
      if (selectedCustomerId) {
        onViewPdf(beyoid);
      }
    },
    [selectedCustomerId, onViewPdf]
  );

  return (
    <div className="flex flex-col gap-4">
      {yearGroups.map((yg) => (
        <div key={yg.year} className="flex flex-col gap-2">
          {/* Yıl ayracı */}
          <YearDivider year={yg.year} count={yg.totalCount} />

          {/* Tür grupları — açılır/kapanır */}
          <div className="flex flex-col gap-2 px-1">
            {yg.typeGroups.map((tg) => {
              const key = `${yg.year}-${tg.turKodu}`;
              return (
                <TypeGroupSection
                  key={key}
                  group={tg}
                  isExpanded={expandedKeys.has(key)}
                  onToggle={() => toggleGroup(key)}
                  pdfLoading={pdfLoading}
                  onViewPdf={handleViewPdf}
                  downloadedBeyoids={downloadedBeyoids}
                  showProgress={showProgress}
                  onHoverStart={onHoverStart}
                  unavailableBeyoids={unavailableBeyoids}
                  onWhatsApp={onWhatsApp}
                  onMail={onMail}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Alt bilgi */}
      <div className="flex items-center justify-end px-1 pt-1 text-xs text-muted-foreground">
        Toplam: {beyannameler.length} beyanname
        {yearGroups.length > 1 && `, ${yearGroups.length} yıl`}
      </div>
    </div>
  );
});
