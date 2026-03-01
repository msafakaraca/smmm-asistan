/**
 * BeyannameKontrolPage Component
 *
 * GİB Bot senkronizasyonu orchestrator bileşeni.
 * - Bot ayarları
 * - Bot başlatma/durma
 * - Bot sonuçları görüntüleme
 * - Bulunan/Eşleştirilemeyen beyannameler
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { toTitleCase } from "@/lib/utils/text";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Lazy load heavy modal
const BotReportModal = dynamic(
  () => import("@/components/kontrol/bot-report-modal").then(mod => ({ default: mod.BotReportModal })),
  { ssr: false }
);
import type { GibBotResult } from "@/types/gib";

// Mevcut kontrol bileşenlerini yeniden kullan
import { KontrolBotPanel } from "@/components/kontrol/kontrol-bot-panel";
import { AddCustomerDialog } from "@/components/kontrol/dialogs/add-customer-dialog";
import { BotLogPanel } from "./bot-log-panel";

// Hooks
import { useBotConnection } from "@/components/kontrol/hooks/use-bot-connection";
import { useBotResult } from "@/context/bot-result-context";

// Types
import type { Customer, SyncStatus, BotInfo, BeyannameData } from "@/components/kontrol/types";

// Son tarama bilgisi
interface LastScanInfo {
  completedAt: string; // ISO timestamp
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
  } catch { /* ignore */ }
  return [];
}

function saveScanToHistory(scan: LastScanInfo) {
  const history = loadScanHistory();
  history.unshift(scan);
  if (history.length > MAX_SCAN_HISTORY) history.length = MAX_SCAN_HISTORY;
  localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function BeyannameKontrolPage() {
  const { consumeResult } = useBotResult();

  // UI states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<GibBotResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Bot info
  const [botInfo, setBotInfo] = useState<BotInfo>({
    hasCredentials: false,
    hasCaptchaKey: false,
    lastSync: null,
  });
  const [gibCode, setGibCode] = useState<string>("");

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

  // Son tarama geçmişi
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
            hasCredentials: !!data.gibCode && (data.hasGibPassword || data.hasGibParola),
            hasCaptchaKey: !!data.captchaKey,
            lastSync: null,
          });
          setGibCode(data.gibCode || "");
        }
      } catch (error) {
        console.error("Bot info fetch error:", error);
      }
    };
    fetchBotInfo();
  }, []);

  // Mount'ta bekleyen bot sonucu var mı kontrol et
  // (sayfa yeniden yüklendiğinde veya başka sayfadan dönüldüğünde)
  useEffect(() => {
    const pending = consumeResult();
    if (pending) {
      setReportData(pending);
      // Dialog otomatik açılmaz - özet terminalde gösterilir
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bot connection hook
  const {
    syncStatus,
    beyannameler,
    unmatchedDeclarations,
    startBot,
    stopBot,
  } = useBotConnection({
    onComplete: (data) => {
      setReportData(data);
      // Dialog otomatik açılmaz - özet terminalde gösterilir

      // Tarama geçmişine kaydet
      const scanInfo: LastScanInfo = {
        completedAt: new Date().toISOString(),
        startDate: data.startDate || startDate,
        endDate: data.endDate || endDate,
        totalBeyanname: data.stats?.total || data.beyannameler?.length || 0,
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

  // Bot durdurma işlemi
  const handleStopBot = useCallback(() => {
    stopBot();
    toast.warning("Bot durduruluyor...");
  }, [stopBot]);

  // Handlers
  const handleSync = useCallback(async () => {
    startBot({
      startDate,
      endDate,
      donemBasAy: usePeriodFilter ? donemBasAy : undefined,
      donemBasYil: usePeriodFilter ? donemBasYil : undefined,
      donemBitAy: usePeriodFilter ? donemBitAy : undefined,
      donemBitYil: usePeriodFilter ? donemBitYil : undefined,
      downloadFiles: shouldDownloadFiles,
    });
  }, [startBot, startDate, endDate, usePeriodFilter, donemBasAy, donemBasYil, donemBitAy, donemBitYil, shouldDownloadFiles]);

  const handleReportClose = useCallback(() => {
    setReportModalOpen(false);
    setReportData(null);
  }, []);

  const handleAddCustomer = useCallback((customer: Customer) => {
    toast.success(`${customer.unvan} eklendi`);
  }, []);

  // Status badge
  const getStatusBadge = () => {
    switch (syncStatus) {
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Icon icon="svg-spinners:180-ring" className="h-3 w-3 mr-1" />
            Senkronize Ediliyor
          </Badge>
        );
      case "success":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Icon icon="solar:check-circle-bold" className="h-3 w-3 mr-1" />
            Tamamlandı
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <Icon icon="solar:danger-triangle-bold" className="h-3 w-3 mr-1" />
            Hata
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Icon icon="solar:bot-bold-duotone" className="h-7 w-7 text-primary" />
            Beyanname Kontrol
          </h1>
          <p className="text-muted-foreground mt-1">
            GİB E-Beyanname sisteminden onaylı beyannameleri senkronize edin
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button
            onClick={handleSync}
            disabled={syncStatus === "running" || !botInfo.hasCredentials}
            className="gap-2"
          >
            {syncStatus === "running" ? (
              <>
                <Icon icon="svg-spinners:180-ring" className="h-4 w-4" />
                Senkronize Ediliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:refresh-bold" className="h-4 w-4" />
                Senkronizasyonu Başlat
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddModal(true)}
            className="gap-2"
          >
            <Icon icon="solar:user-plus-bold" className="h-4 w-4" />
            Mükellef Ekle
          </Button>
        </div>
      </div>

      {/* Bot Report Modal */}
      <BotReportModal
        isOpen={reportModalOpen}
        onClose={handleReportClose}
        data={reportData}
      />

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCustomer}
      />

      {/* Bot Credentials Warning */}
      {!botInfo.hasCredentials && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Icon icon="solar:danger-triangle-bold" className="h-8 w-8 text-amber-600" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                GİB Bilgileri Eksik
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Senkronizasyon için{" "}
                <a href="/dashboard/ayarlar" className="underline font-medium">
                  Ayarlar
                </a>{" "}
                sayfasından GİB E-Beyanname bilgilerinizi giriniz.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bot Log Panel - Bot Ayarları'nın üzerinde */}
      <BotLogPanel onStop={handleStopBot} />

      {/* Bot Settings Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="solar:settings-bold" className="h-5 w-5" />
            Bot Ayarları
          </CardTitle>
          <CardDescription>
            Senkronizasyon için tarih aralığı ve dönem filtresi ayarlayın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KontrolBotPanel
            isOpen={true}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
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
            gibCode={gibCode}
          />
        </CardContent>
      </Card>

      {/* Son Taramalar */}
      {scanHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Icon icon="solar:history-bold" className="h-5 w-5 text-muted-foreground" />
              Son Taramalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanHistory.map((scan, i) => {
                const date = new Date(scan.completedAt);
                const dateStr = date.toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                });
                const timeStr = date.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // Tarih aralığını formatla
                const rangeStart = new Date(scan.startDate).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
                const rangeEnd = new Date(scan.endDate).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                const durationMin = Math.floor(scan.duration / 60);
                const durationSec = scan.duration % 60;
                const durationStr = durationMin > 0
                  ? `${durationMin}dk ${durationSec}sn`
                  : `${durationSec}sn`;

                return (
                  <div
                    key={scan.completedAt}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border ${
                      i === 0
                        ? "bg-muted/50 border-border"
                        : "bg-muted/20 border-transparent"
                    }`}
                  >
                    {/* Tarih ve saat */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon
                        icon={scan.success ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                        className={`h-4 w-4 ${scan.success ? "text-green-500" : "text-red-500"}`}
                      />
                      <span className="text-sm font-medium">{dateStr}</span>
                      <span className="text-xs text-muted-foreground">{timeStr}</span>
                    </div>

                    {/* Detaylar */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:calendar-bold" className="h-3.5 w-3.5" />
                        {rangeStart} - {rangeEnd}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:document-text-bold" className="h-3.5 w-3.5" />
                        {scan.totalBeyanname} beyanname
                      </span>
                      {scan.downloaded > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon icon="solar:download-bold" className="h-3.5 w-3.5" />
                          {scan.downloaded} indirilen
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:clock-circle-bold" className="h-3.5 w-3.5" />
                        {durationStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table from GIB Sync */}
      {beyannameler.length > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Icon icon="solar:check-circle-bold" className="h-5 w-5" />
              Bulunan Beyannameler ({beyannameler.length})
            </CardTitle>
            <CardDescription>
              {startDate} - {endDate} tarihleri arasındaki onaylı beyannameler
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-green-50 dark:bg-green-950/20">
                    <th className="text-left p-2">Beyanname Türü</th>
                    <th className="text-left p-2">TC/VKN</th>
                    <th className="text-left p-2">Ad Soyad/Unvan</th>
                    <th className="text-left p-2">Dönem</th>
                  </tr>
                </thead>
                <tbody>
                  {beyannameler.slice(0, 50).map((b, i) => (
                    <tr key={i} className="border-b hover:bg-green-50/50 dark:hover:bg-green-950/10">
                      <td className="p-2">{b.beyannameTuru}</td>
                      <td className="p-2 font-mono">{b.tcVkn}</td>
                      <td className="p-2">{toTitleCase(b.adSoyadUnvan || "").substring(0, 40)}</td>
                      <td className="p-2">{b.vergilendirmeDonemi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {beyannameler.length > 50 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  ... ve {beyannameler.length - 50} kayıt daha
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched Declarations */}
      {unmatchedDeclarations.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Icon icon="solar:danger-triangle-bold" className="h-5 w-5" />
              Eşleştirilemeyen Beyannameler ({unmatchedDeclarations.length})
            </CardTitle>
            <CardDescription>
              Aşağıdaki beyannameler sistemdeki mükelleflerle eşleştirilemedi. VKN/TCKN bilgilerini kontrol edin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-amber-50 dark:bg-amber-950/20">
                    <th className="text-left p-2">Beyanname Türü</th>
                    <th className="text-left p-2">TC/VKN</th>
                    <th className="text-left p-2">Ad Soyad/Unvan</th>
                    <th className="text-left p-2">Dönem</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedDeclarations.map((b, i) => (
                    <tr key={i} className="border-b hover:bg-amber-50/50 dark:hover:bg-amber-950/10">
                      <td className="p-2">{b.beyannameTuru}</td>
                      <td className="p-2 font-mono font-semibold text-amber-700 dark:text-amber-400">
                        {b.tcVkn}
                      </td>
                      <td className="p-2">{toTitleCase(b.adSoyadUnvan).substring(0, 40)}</td>
                      <td className="p-2">{b.vergilendirmeDonemi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {syncStatus === "idle" && beyannameler.length === 0 && scanHistory.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Icon icon="solar:bot-bold-duotone" className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">Beyanname Senkronizasyonu</h3>
            <p className="text-muted-foreground mb-4">
              GİB E-Beyanname sisteminden onaylı beyannameleri çekmek için yukarıdaki butona tıklayın.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card - Link to Çizelge */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-center gap-4 py-4">
          <Icon icon="solar:info-circle-bold" className="h-6 w-6 text-blue-500" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              Beyanname durumlarını tablo halinde görüntülemek ve düzenlemek için{" "}
              <a href="/dashboard/kontrol-cizelgesi" className="text-primary font-medium hover:underline">
                Kontrol Çizelgesi
              </a>{" "}
              sayfasını kullanabilirsiniz.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
