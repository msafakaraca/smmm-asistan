/**
 * SGK Bildirge Grup Listesi
 * =========================
 * Bildirgeleri yıl bazında ayırır, her yılın altında açılır/kapanır ay grupları gösterir.
 * Beyanname grup listesinin (beyanname-group-list.tsx) SGK'ya özelleştirilmiş versiyonu.
 * Yıl ayracı: ortada çizgi + yıl yazısı.
 * Ay grupları: ay etiketi + toplam metrikler + progress bar.
 * Kart: belge türü + mahiyet + kanun no + çalışan/gün/tutar + PDF butonları.
 */

"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BildirgeItem } from "./hooks/use-sgk-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  items: BildirgeItem[];
  toplamCalisan: number;
  toplamGun: number;
  toplamTutar: number;
}

interface YearGroup {
  year: string;
  monthGroups: MonthGroup[];
  totalCount: number;
}

interface SgkGroupListProps {
  bildirgeler: BildirgeItem[];
  downloadedRefNos: Set<string>;
  isPipelineActive: boolean;
  saveProgress: { saved: number; skipped: number; failed: number; total: number };
  pdfDocumentIds: Record<string, string>;
  onOpenPdf: (bildirgeRefNo: string, type: "tahakkuk" | "hizmet") => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

/** hizmetDonem'den yıl çıkar: "2025/01" → "2025" */
function extractYear(donem: string): string {
  if (!donem) return "Bilinmeyen";
  const parts = donem.split("/");
  return parts[0] || "Bilinmeyen";
}

/** hizmetDonem'den ay çıkar: "2025/01" → "01" */
function extractMonth(donem: string): string {
  if (!donem) return "00";
  const parts = donem.split("/");
  return parts[1] || "00";
}

/** Tutar string'ini sayıya çevir: "45.230,00" → 45230.00 */
function parseTutar(tutar: string): number {
  if (!tutar) return 0;
  return parseFloat(tutar.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Sayıyı Türkçe para formatına çevir: 45230.00 → "45.230,00" */
function formatTutar(amount: number): string {
  return amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════════════════════════════════════════
// BildirgeItemCard — Tek bildirge kartı (mikro kart)
// ═══════════════════════════════════════════════════════════════════════════

interface BildirgeItemCardProps {
  item: BildirgeItem;
  isDownloaded: boolean;
  showProgress: boolean;
  pdfDocumentIds: Record<string, string>;
  onOpenPdf: (bildirgeRefNo: string, type: "tahakkuk" | "hizmet") => void;
}

const BildirgeItemCard = memo(function BildirgeItemCard({
  item,
  isDownloaded,
  showProgress,
  pdfDocumentIds,
  onOpenPdf,
}: BildirgeItemCardProps) {
  const isAsil = item.belgeMahiyeti === "ASIL";
  const hasTahakkukDoc = !!pdfDocumentIds[`${item.bildirgeRefNo}_SGK_TAHAKKUK`];
  const hasHizmetDoc = !!pdfDocumentIds[`${item.bildirgeRefNo}_HIZMET_LISTESI`];

  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-l-2 px-3 py-2 transition-colors ${
        isAsil
          ? "border-l-blue-400 bg-blue-50/60 dark:border-l-blue-500 dark:bg-blue-950/20"
          : "border-l-amber-400 bg-amber-50/40 dark:border-l-amber-500 dark:bg-amber-950/20"
      } hover:bg-blue-100/80 dark:hover:bg-blue-950/40`}
    >
      {/* Belge Türü */}
      <span className={`text-sm font-medium whitespace-nowrap min-w-[32px] ${
        isAsil ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-300"
      }`}>
        {item.belgeTuru}
      </span>

      {/* Mahiyet Badge — sadece ASIL değilse göster */}
      {!isAsil && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {item.belgeMahiyeti}
        </span>
      )}

      {/* Kanun No */}
      <span className="text-xs text-muted-foreground font-mono">{item.kanunNo || "—"}</span>

      {/* Boşluk dolgusu */}
      <div className="flex-1" />

      {/* Metrikler */}
      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
        {item.calisanSayisi} çalışan
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
        {item.gunSayisi} gün
      </span>
      <span className="text-xs font-semibold whitespace-nowrap">
        {"\u20BA"}{item.pekTutar}
      </span>

      {/* İndirme durumu çubuğu */}
      {showProgress && (
        <div className="w-5 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDownloaded ? "w-full bg-emerald-500" : "w-0"
            }`}
          />
        </div>
      )}

      {/* PDF Butonları — Tahakkuk Fişi ve Hizmet Listesi */}
      {item.hasTahakkukPdf && (
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 px-2 text-xs shrink-0 gap-1 ${hasTahakkukDoc ? "text-emerald-600 hover:text-emerald-700" : "text-blue-500 hover:text-blue-600"}`}
          title="Tahakkuk Fişi"
          disabled={!hasTahakkukDoc}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPdf(item.bildirgeRefNo, "tahakkuk");
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          T
        </Button>
      )}
      {item.hasHizmetPdf && (
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 px-2 text-xs shrink-0 gap-1 ${hasHizmetDoc ? "text-emerald-600 hover:text-emerald-700" : "text-blue-500 hover:text-blue-600"}`}
          title="Hizmet Listesi"
          disabled={!hasHizmetDoc}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPdf(item.bildirgeRefNo, "hizmet");
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          H
        </Button>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MonthGroupSection — Açılır/kapanır ay grubu (TypeGroupSection adaptasyonu)
// ═══════════════════════════════════════════════════════════════════════════

interface MonthGroupSectionProps {
  group: MonthGroup;
  isExpanded: boolean;
  onToggle: () => void;
  downloadedRefNos: Set<string>;
  showProgress: boolean;
  pdfDocumentIds: Record<string, string>;
  onOpenPdf: (bildirgeRefNo: string, type: "tahakkuk" | "hizmet") => void;
}

const MonthGroupSection = memo(function MonthGroupSection({
  group,
  isExpanded,
  onToggle,
  downloadedRefNos,
  showProgress,
  pdfDocumentIds,
  onOpenPdf,
}: MonthGroupSectionProps) {
  const downloadedInGroup = useMemo(() => {
    if (!showProgress) return 0;
    return group.items.filter((item) => downloadedRefNos.has(item.bildirgeRefNo)).length;
  }, [group.items, downloadedRefNos, showProgress]);

  const totalInGroup = group.items.length;
  const progressPercent = totalInGroup > 0 ? (downloadedInGroup / totalInGroup) * 100 : 0;
  const allDone = downloadedInGroup === totalInGroup && totalInGroup > 0;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Ay başlığı — tıklanabilir */}
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
          {group.monthLabel}
        </span>

        {/* Toplam metrikler */}
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
          {group.toplamCalisan} çalışan · {group.toplamGun} gün · {"\u20BA"}{formatTutar(group.toplamTutar)}
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
            {group.items.length} bildirge
          </span>
        </div>
      </button>

      {/* Kartlar — sadece açıkken */}
      {isExpanded && (
        <div className="flex flex-col gap-1 p-2 border-t">
          {group.items.map((item, idx) => (
            <BildirgeItemCard
              key={`${item.bildirgeRefNo}-${idx}`}
              item={item}
              isDownloaded={downloadedRefNos.has(item.bildirgeRefNo)}
              showProgress={showProgress}
              pdfDocumentIds={pdfDocumentIds}
              onOpenPdf={onOpenPdf}
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
        <span className="ml-2 text-xs font-normal">({count} bildirge)</span>
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SgkGroupList — Ana component
// ═══════════════════════════════════════════════════════════════════════════

export default memo(function SgkGroupList({
  bildirgeler,
  downloadedRefNos,
  isPipelineActive,
  saveProgress,
  pdfDocumentIds,
  onOpenPdf,
}: SgkGroupListProps) {
  // Progress göster: pipeline aktif veya bazı PDF'ler indirilmiş
  const showProgress = isPipelineActive || saveProgress.saved + saveProgress.skipped > 0;

  // Yıl → Ay → Bildirge şeklinde grupla
  const yearGroups = useMemo((): YearGroup[] => {
    const yearMap = new Map<string, Map<string, MonthGroup>>();

    for (const b of bildirgeler) {
      const year = extractYear(b.hizmetDonem);
      const month = extractMonth(b.hizmetDonem);
      const monthKey = month;
      const monthLabel = `${month}/${year}`;

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map<string, MonthGroup>());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
          monthLabel,
          items: [],
          toplamCalisan: 0,
          toplamGun: 0,
          toplamTutar: 0,
        });
      }

      const group = monthMap.get(monthKey)!;
      group.items.push(b);
      group.toplamCalisan += b.calisanSayisi;
      group.toplamGun += b.gunSayisi;
      group.toplamTutar += parseTutar(b.pekTutar);
    }

    // Yılları büyükten küçüğe sırala (2025, 2024, 2023...)
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));

    return sortedYears.map((year) => {
      const monthMap = yearMap.get(year)!;
      // Ayları büyükten küçüğe sırala (12, 11, 10...)
      const monthGroups = Array.from(monthMap.values()).sort(
        (a, b) => b.monthKey.localeCompare(a.monthKey)
      );
      // Her grup içi: belge türüne göre sırala
      for (const mg of monthGroups) {
        mg.items.sort((a, b) => a.belgeTuru.localeCompare(b.belgeTuru, "tr"));
      }
      const totalCount = monthGroups.reduce((sum, mg) => sum + mg.items.length, 0);
      return { year, monthGroups, totalCount };
    });
  }, [bildirgeler]);

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

  return (
    <div className="flex flex-col gap-4">
      {yearGroups.map((yg) => (
        <div key={yg.year} className="flex flex-col gap-2">
          {/* Yıl ayracı */}
          <YearDivider year={yg.year} count={yg.totalCount} />

          {/* Ay grupları — açılır/kapanır */}
          <div className="flex flex-col gap-2 px-1">
            {yg.monthGroups.map((mg) => {
              const key = `${yg.year}-${mg.monthKey}`;
              return (
                <MonthGroupSection
                  key={key}
                  group={mg}
                  isExpanded={expandedKeys.has(key)}
                  onToggle={() => toggleGroup(key)}
                  downloadedRefNos={downloadedRefNos}
                  showProgress={showProgress}
                  pdfDocumentIds={pdfDocumentIds}
                  onOpenPdf={onOpenPdf}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Alt bilgi */}
      <div className="flex items-center justify-end px-1 pt-1 text-xs text-muted-foreground">
        Toplam: {bildirgeler.length} bildirge
        {yearGroups.length > 1 && `, ${yearGroups.length} yıl`}
      </div>
    </div>
  );
});
