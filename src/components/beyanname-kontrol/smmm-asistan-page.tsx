"use client";

/**
 * SmmmAsistanPage Component
 *
 * SMMM Asistan bot sayfası — tek kolon layout, collapsible sections.
 * Terminal UI kaldırıldı, inline progress + step list kullanılıyor.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  Loader2,
  AlertCircle,
  Bot,
  ChevronDown,
  Play,
  Square,
  RefreshCw,
  Settings,
  FlaskConical,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Lazy load heavy modal
const BotReportModal = dynamic(
  () =>
    import("@/components/kontrol/bot-report-modal").then((mod) => ({
      default: mod.BotReportModal,
    })),
  { ssr: false }
);

// Sub-components
import { BotBasicSettings, BotAdvancedSettings } from "./bot-control-panel";
import { BotProgressArea } from "./bot-progress-area";
import { BulunanTab } from "./tabs/bulunan-tab";
import { EslesmeyenlerTab } from "./tabs/eslesmeyenler-tab";
import { TaramalarTab } from "./tabs/taramalar-tab";

// Lazy load INTVRG test tab (ağır bileşen — kendi WS bağlantısı var)
const IntrvrgTestTab = dynamic(
  () => import("./intvrg-test-tab").then((mod) => ({ default: mod.IntrvrgTestTab })),
  { ssr: false }
);

// Dialogs
import { AddCustomerDialog } from "@/components/kontrol/dialogs/add-customer-dialog";

// Hooks & Context
import { useBotConnection } from "@/components/kontrol/hooks/use-bot-connection";
import { useBotResult } from "@/context/bot-result-context";
import { useBotLog } from "@/context/bot-log-context";

// Types
import type { GibBotResult } from "@/types/gib";
import type { Customer, SyncStatus, BotInfo } from "@/components/kontrol/types";

// Son tarama bilgisi
interface LastScanInfo {
  completedAt: string;
  startDate: string;
  endDate: string;
  totalBeyanname: number;
  downloaded: number;
  skipped: number;
  duration: number;
  success: boolean;
}

const SCAN_HISTORY_KEY = "smmm-scan-history";
const MAX_SCAN_HISTORY = 5;

function loadScanHistory(): LastScanInfo[] {
  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return [];
}

function saveScanToHistory(scan: LastScanInfo) {
  const history = loadScanHistory();
  history.unshift(scan);
  if (history.length > MAX_SCAN_HISTORY) history.length = MAX_SCAN_HISTORY;
  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function SmmmAsistanPage() {
  const { consumeResult } = useBotResult();
  const { logs, liveMessage } = useBotLog();

  // UI states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<GibBotResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Bot info & credentials
  const [botInfo, setBotInfo] = useState<BotInfo>({
    hasCredentials: false,
    hasCaptchaKey: false,
    lastSync: null,
  });
  const [gibCode, setGibCode] = useState("");
  const [gibPassword, setGibPassword] = useState("");
  const [gibParola, setGibParola] = useState("");

  // Bot settings
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const [startDate, setStartDate] = useState(
    `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [usePeriodFilter, setUsePeriodFilter] = useState(false);
  const [donemBasAy, setDonemBasAy] = useState(lastMonth + 1);
  const [donemBasYil, setDonemBasYil] = useState(lastMonthYear);
  const [donemBitAy, setDonemBitAy] = useState(lastMonth + 1);
  const [donemBitYil, setDonemBitYil] = useState(lastMonthYear);
  const [shouldDownloadFiles, setShouldDownloadFiles] = useState(true);

  // Arama filtreleri
  const [vergiNo, setVergiNo] = useState("");
  const [tcKimlikNo, setTcKimlikNo] = useState("");
  const [useBeyannameTuruFilter, setUseBeyannameTuruFilter] = useState(false);
  const [selectedBeyannameTuru, setSelectedBeyannameTuru] = useState("KDV1");

  // Scan history
  const [scanHistory, setScanHistory] = useState<LastScanInfo[]>([]);

  // Mount'ta tarama geçmişini yükle
  useEffect(() => {
    setScanHistory(loadScanHistory());
  }, []);

  // Fetch bot info on mount
  useEffect(() => {
    const fetchBotInfo = async () => {
      try {
        const res = await fetch("/api/settings/gib");
        if (res.ok) {
          const data = await res.json();
          setBotInfo({
            hasCredentials:
              !!data.gibCode && (data.hasGibPassword || data.hasGibParola),
            hasCaptchaKey: !!data.captchaKey,
            lastSync: null,
          });
          setGibCode(data.gibCode || "");
          setGibPassword(data.gibPassword || "");
          setGibParola(data.gibParola || "");
        }
      } catch (error) {
        console.error("Bot info fetch error:", error);
      }
    };
    fetchBotInfo();
  }, []);

  // Mount'ta bekleyen bot sonucu var mı kontrol et
  useEffect(() => {
    const pending = consumeResult();
    if (pending) {
      setReportData(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bot connection hook
  const { syncStatus, beyannameler, unmatchedDeclarations, startBot, stopBot } =
    useBotConnection({
      onComplete: (data) => {
        setReportData(data);

        const scanInfo: LastScanInfo = {
          completedAt: new Date().toISOString(),
          startDate: data.startDate || startDate,
          endDate: data.endDate || endDate,
          totalBeyanname:
            data.stats?.total || data.beyannameler?.length || 0,
          downloaded: data.stats?.downloaded || 0,
          skipped: data.stats?.skipped || 0,
          duration: data.stats?.duration || 0,
          success: data.success,
        };
        setScanHistory(saveScanToHistory(scanInfo));
      },
      onError: (error) => {
        toast.error(error);
      },
    });

  // Progress hesaplama — log'lardan ve liveMessage'dan oku
  const currentProgress = useMemo(() => {
    // liveMessage (batch/complete) en güncel progress değerini taşır
    if (liveMessage?.progress !== undefined) return liveMessage.progress;
    // Log array'den son progress değerini al
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].progress !== undefined) return logs[i].progress!;
    }
    return 0;
  }, [logs, liveMessage]);

  // Filtre özet chip'leri
  const filterChips = useMemo(() => {
    const chips: string[] = [];
    chips.push(
      `${new Date(startDate).toLocaleDateString("tr-TR")} — ${new Date(endDate).toLocaleDateString("tr-TR")}`
    );
    if (vergiNo) chips.push(`VKN: ${vergiNo}`);
    else if (tcKimlikNo) chips.push(`TC: ${tcKimlikNo}`);
    else chips.push("Tüm mükellefler");
    if (useBeyannameTuruFilter) chips.push(selectedBeyannameTuru);
    else chips.push("Tüm türler");
    chips.push(shouldDownloadFiles ? "İndirme: Açık" : "İndirme: Kapalı");
    return chips;
  }, [
    startDate,
    endDate,
    vergiNo,
    tcKimlikNo,
    useBeyannameTuruFilter,
    selectedBeyannameTuru,
    shouldDownloadFiles,
  ]);

  // Handlers
  const handleStopBot = useCallback(() => {
    stopBot();
    toast.warning("Bot durduruluyor...");
  }, [stopBot]);

  const handleSync = useCallback(async () => {
    startBot({
      startDate,
      endDate,
      donemBasAy: usePeriodFilter ? donemBasAy : undefined,
      donemBasYil: usePeriodFilter ? donemBasYil : undefined,
      donemBitAy: usePeriodFilter ? donemBitAy : undefined,
      donemBitYil: usePeriodFilter ? donemBitYil : undefined,
      downloadFiles: shouldDownloadFiles,
      vergiNo: vergiNo.trim() || undefined,
      tcKimlikNo: tcKimlikNo.trim() || undefined,
      beyannameTuru: useBeyannameTuruFilter
        ? selectedBeyannameTuru
        : undefined,
    });
  }, [
    startBot,
    startDate,
    endDate,
    usePeriodFilter,
    donemBasAy,
    donemBasYil,
    donemBitAy,
    donemBitYil,
    shouldDownloadFiles,
    vergiNo,
    tcKimlikNo,
    useBeyannameTuruFilter,
    selectedBeyannameTuru,
  ]);

  const handleReportClose = useCallback(() => {
    setReportModalOpen(false);
    setReportData(null);
  }, []);

  const handleAddCustomer = useCallback((customer: Customer) => {
    toast.success(`${customer.unvan} eklendi`);
  }, []);

  const handleNewScan = useCallback(() => {
    // idle durumuna dönüş — sonuçlar temizlenecek, syncStatus sıfırlanacak
    stopBot();
    setReportData(null);
  }, [stopBot]);

  // Status badge
  const getStatusBadge = () => {
    switch (syncStatus) {
      case "running":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Çalışıyor
          </Badge>
        );
      case "success":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
          >
            <Check className="h-3 w-3 mr-1" />
            Tamamlandı
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Hata
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Bot className="h-3 w-3 mr-1" />
            Hazır
          </Badge>
        );
    }
  };

  // Daraltılmış özet satırı (running/success durumunda)
  const compactSummary = useMemo(() => {
    const startFormatted = new Date(startDate).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    });
    const endFormatted = new Date(endDate).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    });
    return `GİB ✓ · Tarih: ${startFormatted}—${endFormatted}`;
  }, [startDate, endDate]);

  // Özet kartı bilgileri
  const summaryStats = useMemo(() => {
    if (!reportData) return null;
    const total = reportData.stats?.total || reportData.beyannameler?.length || 0;
    const matched = total - (unmatchedDeclarations.length || 0);
    const duration = reportData.stats?.duration || 0;
    const durationMin = Math.floor(duration / 60);
    const durationSec = duration % 60;
    const durationStr =
      durationMin > 0
        ? `${durationMin}dk ${durationSec}sn`
        : `${durationSec}sn`;
    return { total, matched, unmatched: unmatchedDeclarations.length, durationStr };
  }, [reportData, unmatchedDeclarations]);

  const isRunning = syncStatus === "running";
  const isIdle = syncStatus === "idle";
  const isSuccess = syncStatus === "success";
  const isError = syncStatus === "error";

  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* 1. Header + Status Badge */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            Beyanname Kontrol
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            GİB Bot ile beyanname senkronizasyonu
          </p>
        </div>
        <div className="flex items-center gap-2">{getStatusBadge()}</div>
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
      {/* 2. GİB Bilgileri + Tarih */}
      {!isRunning && !isSuccess ? (
        <BotBasicSettings
          gibCode={gibCode}
          gibPassword={gibPassword}
          gibParola={gibParola}
          hasCredentials={botInfo.hasCredentials}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isRunning={isRunning}
        />
      ) : (
        <div className="px-4 py-3 rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">{compactSummary}</p>
        </div>
      )}

      {/* 3. Gelişmiş Seçenekler (idle/error'da görünür) */}
      {(isIdle || isError) && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Gelişmiş Seçenekler
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 mt-1">
              <BotAdvancedSettings
                vergiNo={vergiNo}
                setVergiNo={setVergiNo}
                tcKimlikNo={tcKimlikNo}
                setTcKimlikNo={setTcKimlikNo}
                useBeyannameTuruFilter={useBeyannameTuruFilter}
                setUseBeyannameTuruFilter={setUseBeyannameTuruFilter}
                selectedBeyannameTuru={selectedBeyannameTuru}
                setSelectedBeyannameTuru={setSelectedBeyannameTuru}
                usePeriodFilter={usePeriodFilter}
                setUsePeriodFilter={setUsePeriodFilter}
                donemBasAy={donemBasAy}
                setDonemBasAy={setDonemBasAy}
                donemBasYil={donemBasYil}
                setDonemBasYil={setDonemBasYil}
                donemBitAy={donemBitAy}
                setDonemBitAy={setDonemBitAy}
                donemBitYil={donemBitYil}
                setDonemBitYil={setDonemBitYil}
                shouldDownloadFiles={shouldDownloadFiles}
                setShouldDownloadFiles={setShouldDownloadFiles}
                isRunning={isRunning}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 4. Filtre Özet Chip'leri */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {chip}
          </Badge>
        ))}
      </div>

      {/* 5. Başlat/Durdur Butonu */}
      {isRunning ? (
        <Button
          variant="destructive"
          onClick={handleStopBot}
          className="w-full gap-2"
          size="lg"
        >
          <Square className="h-4 w-4" />
          Botu Durdur
        </Button>
      ) : isSuccess ? (
        <Button
          onClick={handleNewScan}
          className="w-full gap-2"
          size="lg"
        >
          <RefreshCw className="h-4 w-4" />
          Yeni Tarama Başlat
        </Button>
      ) : (
        <Button
          onClick={handleSync}
          disabled={!botInfo.hasCredentials}
          className="w-full gap-2"
          size="lg"
        >
          <Play className="h-4 w-4" />
          Senkronizasyonu Başlat
        </Button>
      )}

      {/* 6. Hata Banner */}
      {isError && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">
              Senkronizasyon sırasında bir hata oluştu.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            className="shrink-0"
          >
            Tekrar Dene
          </Button>
        </div>
      )}

      {/* 7. Progress Area */}
      {!isIdle && (
        <BotProgressArea progress={currentProgress} syncStatus={syncStatus} />
      )}

      {/* 8. Özet Kartı (success'te görünür) */}
      {isSuccess && summaryStats && (
        <div
          role="status"
          aria-live="polite"
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {summaryStats.total}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Bulundu
            </p>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {summaryStats.matched}
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              Eşleşti
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {summaryStats.unmatched}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
              Eşleşmedi
            </p>
          </div>
          <div className="col-span-3 text-center text-xs text-muted-foreground">
            Süre: {summaryStats.durationStr}
          </div>
        </div>
      )}

      {/* 9. Bulunan Beyannameler */}
      {beyannameler.length > 0 && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
            <span className="flex items-center gap-2">
              Bulunan Beyannameler
              <Badge variant="secondary">{beyannameler.length}</Badge>
            </span>
            <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 mt-1">
              <BulunanTab
                beyannameler={beyannameler}
                startDate={startDate}
                endDate={endDate}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 10. Eşleşmeyenler */}
      {unmatchedDeclarations.length > 0 && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
            <span className="flex items-center gap-2">
              Eşleşmeyenler
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                {unmatchedDeclarations.length}
              </Badge>
            </span>
            <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 mt-1 space-y-3">
              <EslesmeyenlerTab
                unmatchedDeclarations={unmatchedDeclarations}
              />
              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                className="w-full"
              >
                Mükellef Ekle
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 11. Son Taramalar */}
      {scanHistory.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
            <span className="flex items-center gap-2">
              Son Taramalar
              <Badge variant="secondary">{scanHistory.length}</Badge>
            </span>
            <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 mt-1">
              <TaramalarTab scanHistory={scanHistory} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 12. INTVRG Test */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-500" />
            INTVRG Beyanname Test
            <Badge variant="outline" className="text-[10px] text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800">
              Test
            </Badge>
          </span>
          <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 mt-1">
            <IntrvrgTestTab />
          </div>
        </CollapsibleContent>
      </Collapsible>

      </div>
      {/* /Ana İçerik */}
      </div>
      {/* /Çerçeve */}

      {/* Modallar */}
      <BotReportModal
        isOpen={reportModalOpen}
        onClose={handleReportClose}
        data={reportData}
      />
      <AddCustomerDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCustomer}
      />
    </div>
  );
}
