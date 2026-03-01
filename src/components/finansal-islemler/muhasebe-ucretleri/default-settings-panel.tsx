"use client";

import { memo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings, ChevronDown, ChevronUp } from "lucide-react";
import {
  type FinanceSettings,
  KDV_RATE_OPTIONS,
  STOPAJ_RATE_OPTIONS,
} from "../shared/finance-types";

interface DefaultSettingsPanelProps {
  settings: FinanceSettings;
  loading: boolean;
  saving: boolean;
  onSave: (data: Partial<FinanceSettings>) => Promise<void>;
}

export const DefaultSettingsPanel = memo(function DefaultSettingsPanel({
  settings,
  loading,
  saving,
  onSave,
}: DefaultSettingsPanelProps) {
  // Panel açık/kapalı durumu localStorage'den oku
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("finance-settings-panel-open") === "true";
    }
    return false;
  });

  // Yerel form state
  const [localSettings, setLocalSettings] = useState<FinanceSettings>(settings);
  const [isDirty, setIsDirty] = useState(false);

  // Settings değiştiğinde local state'i güncelle
  useEffect(() => {
    setLocalSettings(settings);
    setIsDirty(false);
  }, [settings]);

  // Panel durumunu localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem("finance-settings-panel-open", String(isOpen));
  }, [isOpen]);

  const handleChange = (field: keyof FinanceSettings, value: boolean | number) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    await onSave(localSettings);
    setIsDirty(false);
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setIsDirty(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Ayarlar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      {/* Panel Başlığı (Collapsible) */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Varsayılan Ayarlar</span>
          {isDirty && (
            <span className="text-xs text-amber-600 font-normal">(kaydedilmemiş değişiklik)</span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Panel İçeriği */}
      {isOpen && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            Bu ayarlar yeni maliyet kalemi oluştururken varsayılan değerler olarak kullanılır.
            Her kalem için ayrıca değiştirilebilir.
          </p>

          {/* SMM Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Varsayılan SMM</Label>
              <p className="text-xs text-muted-foreground">
                Yeni kalemlerde SMM açık gelsin mi?
              </p>
            </div>
            <Switch
              checked={localSettings.hasSMM}
              onCheckedChange={(v) => handleChange("hasSMM", v)}
              disabled={saving}
            />
          </div>

          {/* KDV ve Stopaj Oranları */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Varsayılan KDV Oranı</Label>
              <Select
                value={String(localSettings.defaultKdvRate)}
                onValueChange={(v) => handleChange("defaultKdvRate", Number(v))}
                disabled={saving}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KDV_RATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Varsayılan Stopaj Oranı</Label>
              <Select
                value={String(localSettings.defaultStopajRate)}
                onValueChange={(v) => handleChange("defaultStopajRate", Number(v))}
                disabled={saving}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOPAJ_RATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kaydet / İptal */}
          {isDirty && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
              >
                Geri Al
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  "Ayarları Kaydet"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
