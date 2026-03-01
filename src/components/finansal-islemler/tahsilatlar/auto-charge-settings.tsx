"use client";

import { memo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings, ChevronDown, ChevronUp } from "lucide-react";
import type { FinanceSettings } from "../shared/finance-types";

interface AutoChargeSettingsProps {
  settings: FinanceSettings;
  loading: boolean;
  saving: boolean;
  onSave: (data: Partial<FinanceSettings>) => Promise<void>;
}

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export const AutoChargeSettings = memo(function AutoChargeSettings({
  settings,
  loading,
  saving,
  onSave,
}: AutoChargeSettingsProps) {
  // Panel açık/kapalı durumu localStorage'den oku
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auto-charge-panel-open") === "true";
    }
    return false;
  });

  const [enabled, setEnabled] = useState(settings.autoChargeEnabled);
  const [day, setDay] = useState(settings.autoChargeDay);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setEnabled(settings.autoChargeEnabled);
    setDay(settings.autoChargeDay);
    setIsDirty(false);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("auto-charge-panel-open", String(isOpen));
  }, [isOpen]);

  const handleSave = async () => {
    await onSave({
      autoChargeEnabled: enabled,
      autoChargeDay: day,
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    setEnabled(settings.autoChargeEnabled);
    setDay(settings.autoChargeDay);
    setIsDirty(false);
  };

  if (loading) return null;

  return (
    <div className="rounded-lg border bg-card">
      {/* Başlık - tıklanabilir */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Otomatik Borçlandırma Ayarları</span>
          {enabled && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Aktif
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* İçerik */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Aktif edildiğinde, her ayın belirlenen gününde aktif maliyet kalemleri otomatik olarak
            müşterilere borç olarak tanımlanır.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="autoChargeEnabled"
                checked={enabled}
                onCheckedChange={(v) => { setEnabled(v); setIsDirty(true); }}
              />
              <Label htmlFor="autoChargeEnabled" className="text-sm">
                Otomatik borçlandırma
              </Label>
            </div>

            {/* Gün seçimi */}
            {enabled && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Her ayın</Label>
                <Select
                  value={String(day)}
                  onValueChange={(v) => { setDay(parseInt(v)); setIsDirty(true); }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-sm">. günü</Label>
              </div>
            )}
          </div>

          {/* Kaydet/İptal */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Kaydet
              </Button>
              <Button size="sm" variant="ghost" onClick={handleReset} disabled={saving}>
                İptal
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
