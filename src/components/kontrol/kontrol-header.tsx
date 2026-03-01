/**
 * KontrolHeader Component
 *
 * Sayfa başlığı ve eylem butonları.
 */

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import type { SyncStatus, BotInfo } from "./types";

const aylar = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

interface KontrolHeaderProps {
  syncStatus: SyncStatus;
  botInfo: BotInfo;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  onSync: () => void;
  onClearList: () => void;
  onRenumberAll?: () => void;
  onAddCustomer: () => void;
  onPrint: () => void;
  selectedMonth: number;
  selectedYear: number;
}

export function KontrolHeader({
  syncStatus,
  botInfo,
  showSettings,
  setShowSettings,
  onSync,
  onClearList,
  onAddCustomer,
  onPrint,
  selectedMonth,
  selectedYear,
}: KontrolHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Icon icon="solar:clipboard-check-bold" className="h-6 w-6 text-primary" />
          Beyanname Kontrol
        </h1>
        <p className="text-muted-foreground">
          GİB E-Beyanname sisteminden onaylı beyannameleri çekin ve takip edin.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Icon icon="solar:settings-bold" className="h-4 w-4 mr-2" />
          Ayarlar
        </Button>
        <Button
          size="sm"
          onClick={onSync}
          disabled={syncStatus === "running" || !botInfo.hasCredentials}
        >
          {syncStatus === "running" ? (
            <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
          )}
          GİB Senkronize Et
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onClearList}
          disabled={syncStatus === "running"}
        >
          <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
          Listeyi Temizle
        </Button>
        <Button variant="default" size="sm" onClick={onAddCustomer}>
          <Icon icon="solar:user-plus-bold" className="h-4 w-4 mr-2" />
          Mükellef Ekle
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint}>
          <Icon icon="solar:printer-bold" className="h-4 w-4 mr-2" />
          Yazdır
        </Button>
      </div>
    </div>
  );
}
