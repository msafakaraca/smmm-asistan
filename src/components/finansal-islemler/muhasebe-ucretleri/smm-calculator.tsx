"use client";

import { memo, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { KDV_RATE_OPTIONS, STOPAJ_RATE_OPTIONS } from "../shared/finance-types";

interface SMMCalculatorProps {
  hasSMM: boolean;
  onHasSMMChange: (value: boolean) => void;
  kdvRate: number;
  onKdvRateChange: (value: number) => void;
  stopajRate: number;
  onStopajRateChange: (value: number) => void;
  amount: number;
  disabled?: boolean;
}

export const SMMCalculator = memo(function SMMCalculator({
  hasSMM,
  onHasSMMChange,
  kdvRate,
  onKdvRateChange,
  stopajRate,
  onStopajRateChange,
  amount,
  disabled = false,
}: SMMCalculatorProps) {
  // GİB SMM hesaplama formülü:
  // Brüt Ücret (KDV Hariç) = girilen tutar
  // Stopaj = Brüt × Stopaj Oranı
  // Net Ücret (KDV Hariç) = Brüt - Stopaj
  // KDV = Brüt × KDV Oranı
  // Brüt Ücret (KDV Dahil) = Brüt + KDV
  // Net Tahsil Edilen (KDV Dahil) = Net Ücret + KDV
  const calculations = useMemo(() => {
    const brutUcretKDVHaric = amount || 0;
    const stopajTutari = hasSMM ? brutUcretKDVHaric * (stopajRate / 100) : 0;
    const netUcretKDVHaric = brutUcretKDVHaric - stopajTutari;
    const kdvTutari = hasSMM ? brutUcretKDVHaric * (kdvRate / 100) : 0;
    const brutUcretKDVDahil = brutUcretKDVHaric + kdvTutari;
    const netTahsilEdilen = netUcretKDVHaric + kdvTutari;

    return {
      brutUcretKDVHaric,
      stopajTutari,
      netUcretKDVHaric,
      kdvTutari,
      brutUcretKDVDahil,
      netTahsilEdilen,
    };
  }, [amount, hasSMM, kdvRate, stopajRate]);

  const fmt = (val: number) =>
    val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* SMM Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Serbest Meslek Makbuzu (SMM)</Label>
          <p className="text-xs text-muted-foreground">
            KDV ve stopaj hesaplaması yapılsın mı?
          </p>
        </div>
        <Switch
          checked={hasSMM}
          onCheckedChange={onHasSMMChange}
          disabled={disabled}
        />
      </div>

      {/* KDV ve Stopaj oranları */}
      {hasSMM && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">KDV Oranı</Label>
              <Select
                value={String(kdvRate)}
                onValueChange={(v) => onKdvRateChange(Number(v))}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-sm">
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
              <Label className="text-xs">Stopaj Oranı</Label>
              <Select
                value={String(stopajRate)}
                onValueChange={(v) => onStopajRateChange(Number(v))}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-sm">
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

          {/* GİB uyumlu hesaplama detayları */}
          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Brüt Ücret (KDV Hariç):</span>
              <span className="font-medium tabular-nums">{fmt(calculations.brutUcretKDVHaric)} ₺</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stopaj (%{stopajRate}):</span>
              <span className="text-red-600 tabular-nums">-{fmt(calculations.stopajTutari)} ₺</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Ücret (KDV Hariç):</span>
              <span className="tabular-nums">{fmt(calculations.netUcretKDVHaric)} ₺</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">KDV (%{kdvRate}):</span>
              <span className="text-green-600 tabular-nums">+{fmt(calculations.kdvTutari)} ₺</span>
            </div>

            <Separator className="my-1" />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Brüt Ücret (KDV Dahil):</span>
              <span className="font-semibold tabular-nums">{fmt(calculations.brutUcretKDVDahil)} ₺</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Net Tahsil Edilen (KDV Dahil):</span>
              <span className="tabular-nums text-primary">{fmt(calculations.netTahsilEdilen)} ₺</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

// Yardımcı fonksiyon: SMM hesapla (hook'lar ve API'ler için)
export function calculateSMM(amount: number, kdvRate: number, stopajRate: number, hasSMM: boolean) {
  const brutUcretKDVHaric = amount;
  const stopajTutari = hasSMM ? brutUcretKDVHaric * (stopajRate / 100) : 0;
  const netUcretKDVHaric = brutUcretKDVHaric - stopajTutari;
  const kdvTutari = hasSMM ? brutUcretKDVHaric * (kdvRate / 100) : 0;
  const brutUcretKDVDahil = brutUcretKDVHaric + kdvTutari;
  const netTahsilEdilen = netUcretKDVHaric + kdvTutari;

  return {
    grossAmount: Math.round(brutUcretKDVHaric * 100) / 100,
    kdvAmount: Math.round(kdvTutari * 100) / 100,
    stopajAmount: Math.round(stopajTutari * 100) / 100,
    netAmount: Math.round(netTahsilEdilen * 100) / 100,
    brutUcretKDVDahil: Math.round(brutUcretKDVDahil * 100) / 100,
    netUcretKDVHaric: Math.round(netUcretKDVHaric * 100) / 100,
  };
}
