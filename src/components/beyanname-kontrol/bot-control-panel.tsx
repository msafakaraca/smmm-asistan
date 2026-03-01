"use client";

import React from "react";
import { KeyRound, Calendar, UserSearch, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/sonner";

const beyannameSecenekleri = [
  { value: 'KDV1', label: 'KDV Beyannamesi 1' },
  { value: 'KDV2', label: 'KDV Beyannamesi 2' },
  { value: 'KDV9015', label: 'KDV Tevkifatı (9015)' },
  { value: 'MUHSGK', label: 'Muhtasar ve Prim Hizmet' },
  { value: 'GGECICI', label: 'Gelir Geçici Vergi' },
  { value: 'KGECICI', label: 'Kurum Geçici Vergi' },
  { value: 'GELIR', label: 'Yıllık Gelir Vergisi' },
  { value: 'KURUMLAR', label: 'Kurumlar Vergisi' },
  { value: 'DAMGA', label: 'Damga Vergisi' },
  { value: 'POSET', label: 'Geri Kazanım Katılım Payı' },
  { value: 'KONAKLAMA', label: 'Konaklama Vergisi' },
  { value: 'TURIZM', label: 'Turizm Payı' },
];

const aylar = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

// ─── BotBasicSettings ───────────────────────────────────────────────────────

interface BotBasicSettingsProps {
  gibCode: string;
  gibPassword: string;
  gibParola: string;
  hasCredentials: boolean;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  isRunning: boolean;
}

export const BotBasicSettings = React.memo(function BotBasicSettings({
  gibCode,
  gibPassword,
  gibParola,
  hasCredentials,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRunning,
}: BotBasicSettingsProps) {
  const validateDateRange = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    const diffDays = Math.abs(
      (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 31) {
      toast.error("Tarih aralığı en fazla 1 ay olabilir!");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-5">
      {/* GİB Bilgileri */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-primary" />
            GİB Giriş Bilgileri
          </Label>
          <a
            href="/dashboard/ayarlar"
            className="text-xs text-primary hover:underline font-medium"
          >
            Ayarları Düzenle &rarr;
          </a>
        </div>

        {hasCredentials ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <span className="text-sm text-green-700 dark:text-green-300">
              GİB: Kaydedildi &#10003;
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              GİB bilgileri eksik.{" "}
              <a
                href="/dashboard/ayarlar"
                className="underline font-medium"
              >
                Ayarlar
              </a>{" "}
              sayfasından giriniz.
            </p>
          </div>
        )}
      </div>

      {/* Tarih Aralığı */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Beyanname Yükleme Tarih Aralığı
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Başlangıç</Label>
            <DatePickerInput
              value={startDate}
              onChange={(date) => {
                setStartDate(date);
                validateDateRange(date, endDate);
              }}
              maxDate={endDate}
              placeholder="Başlangıç tarihi"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bitiş</Label>
            <DatePickerInput
              value={endDate}
              onChange={(date) => {
                setEndDate(date);
                validateDateRange(startDate, date);
              }}
              minDate={startDate}
              placeholder="Bitiş tarihi"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── BotAdvancedSettings ────────────────────────────────────────────────────

interface BotAdvancedSettingsProps {
  vergiNo: string;
  setVergiNo: (val: string) => void;
  tcKimlikNo: string;
  setTcKimlikNo: (val: string) => void;
  useBeyannameTuruFilter: boolean;
  setUseBeyannameTuruFilter: (val: boolean) => void;
  selectedBeyannameTuru: string;
  setSelectedBeyannameTuru: (val: string) => void;
  usePeriodFilter: boolean;
  setUsePeriodFilter: (use: boolean) => void;
  donemBasAy: number;
  setDonemBasAy: (ay: number) => void;
  donemBasYil: number;
  setDonemBasYil: (yil: number) => void;
  donemBitAy: number;
  setDonemBitAy: (ay: number) => void;
  donemBitYil: number;
  setDonemBitYil: (yil: number) => void;
  shouldDownloadFiles: boolean;
  setShouldDownloadFiles: (download: boolean) => void;
  isRunning: boolean;
}

export const BotAdvancedSettings = React.memo(function BotAdvancedSettings({
  vergiNo,
  setVergiNo,
  tcKimlikNo,
  setTcKimlikNo,
  useBeyannameTuruFilter,
  setUseBeyannameTuruFilter,
  selectedBeyannameTuru,
  setSelectedBeyannameTuru,
  usePeriodFilter,
  setUsePeriodFilter,
  donemBasAy,
  setDonemBasAy,
  donemBasYil,
  setDonemBasYil,
  donemBitAy,
  setDonemBitAy,
  donemBitYil,
  setDonemBitYil,
  shouldDownloadFiles,
  setShouldDownloadFiles,
  isRunning,
}: BotAdvancedSettingsProps) {
  return (
    <div className="space-y-5 pt-2">
      {/* Mükellef Filtresi */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <UserSearch className="h-4 w-4 text-muted-foreground" />
          Mükellef Filtresi
        </Label>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">VKN (Vergi Kimlik No)</Label>
            <Input
              value={vergiNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setVergiNo(val);
                if (val) setTcKimlikNo('');
              }}
              placeholder="10 haneli VKN"
              maxLength={10}
              disabled={isRunning}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">TC Kimlik No</Label>
            <Input
              value={tcKimlikNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                setTcKimlikNo(val);
                if (val) setVergiNo('');
              }}
              placeholder="11 haneli TC Kimlik No"
              maxLength={11}
              disabled={isRunning}
              className="h-8 text-xs font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Boş bırakılırsa tüm mükellefler aranır.
          </p>
        </div>
      </div>

      {/* Beyanname Türü Filtresi */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="useBeyannameTuruFilter"
            checked={useBeyannameTuruFilter}
            onCheckedChange={(c) => setUseBeyannameTuruFilter(!!c)}
            disabled={isRunning}
          />
          <div className="grid gap-1 leading-none">
            <Label
              htmlFor="useBeyannameTuruFilter"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Beyanname Türü Filtresi
            </Label>
            <p className="text-xs text-muted-foreground">
              İşaretlenmezse tüm türler aranır.
            </p>
          </div>
        </div>
        {useBeyannameTuruFilter && (
          <Select
            value={selectedBeyannameTuru}
            onValueChange={setSelectedBeyannameTuru}
            disabled={isRunning}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Beyanname türü seçin" />
            </SelectTrigger>
            <SelectContent>
              {beyannameSecenekleri.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Dönem Filtresi */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="usePeriodFilter"
            checked={usePeriodFilter}
            onCheckedChange={(c) => setUsePeriodFilter(!!c)}
            disabled={isRunning}
          />
          <div className="grid gap-1 leading-none">
            <Label
              htmlFor="usePeriodFilter"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Dönem Filtresi
            </Label>
            <p className="text-xs text-muted-foreground">
              İşaretlenmezse dönem filtresi uygulanmaz.
            </p>
          </div>
        </div>
        {usePeriodFilter && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Başlangıç</Label>
              <div className="flex gap-2">
                <Select
                  value={donemBasAy.toString()}
                  onValueChange={(v) => setDonemBasAy(parseInt(v))}
                  disabled={isRunning}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aylar.map((ay, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>
                        {ay}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={donemBasYil.toString()}
                  onValueChange={(v) => setDonemBasYil(parseInt(v))}
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => 2020 + i).map(
                      (year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitiş</Label>
              <div className="flex gap-2">
                <Select
                  value={donemBitAy.toString()}
                  onValueChange={(v) => setDonemBitAy(parseInt(v))}
                  disabled={isRunning}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aylar.map((ay, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>
                        {ay}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={donemBitYil.toString()}
                  onValueChange={(v) => setDonemBitYil(parseInt(v))}
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => 2020 + i).map(
                      (year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* İndirme Seçeneği */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="downloadFiles"
          checked={shouldDownloadFiles}
          onCheckedChange={(c) => setShouldDownloadFiles(!!c)}
          disabled={isRunning}
        />
        <div className="grid gap-1 leading-none">
          <Label
            htmlFor="downloadFiles"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            Beyannameleri indir
          </Label>
          <p className="text-xs text-muted-foreground">
            İşaretlenmezse sadece liste güncellenir.
          </p>
        </div>
      </div>
    </div>
  );
});
