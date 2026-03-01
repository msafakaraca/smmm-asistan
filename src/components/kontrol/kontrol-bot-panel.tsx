/**
 * KontrolBotPanel Component
 *
 * GİB Bot ayarları paneli - tarih aralığı, dönem filtresi, PDF indirme seçeneği.
 */

import { Icon } from "@iconify/react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/sonner";

interface KontrolBotPanelProps {
  isOpen: boolean;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
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
  gibCode: string;
}

export function KontrolBotPanel({
  isOpen,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
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
  gibCode,
}: KontrolBotPanelProps) {
  if (!isOpen) return null;

  const validateDateRange = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    const diffDays = Math.abs((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 31) {
      toast.error("Tarih aralığı en fazla 1 ay olabilir!");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GİB Bot Ayarları</CardTitle>
        <CardDescription>Tarih aralığı ve bağlantı durumu</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Yükleme Tarih Aralığı */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Yükleme Tarih Aralığı</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Başlangıç Tarihi</Label>
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
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bitiş Tarihi</Label>
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

        {/* Vergilendirme Dönemi */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="usePeriodFilter"
              checked={usePeriodFilter}
              onChange={(e) => setUsePeriodFilter(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="usePeriodFilter" className="cursor-pointer">
              Vergilendirme Dönemi
            </Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Başlangıç</Label>
              <div className="flex gap-2">
                <Select value={donemBasAy.toString()} onValueChange={(v) => setDonemBasAy(parseInt(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((ay, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{ay}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={donemBasYil.toString()} onValueChange={(v) => setDonemBasYil(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => 2020 + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bitiş</Label>
              <div className="flex gap-2">
                <Select value={donemBitAy.toString()} onValueChange={(v) => setDonemBitAy(parseInt(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((ay, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{ay}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={donemBitYil.toString()} onValueChange={(v) => setDonemBitYil(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => 2020 + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* PDF İndirme Seçeneği */}
        <div className="pt-4 border-t">
          <div className="flex items-start gap-3">
            <Checkbox
              id="downloadFiles"
              checked={shouldDownloadFiles}
              onCheckedChange={(c) => setShouldDownloadFiles(!!c)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="downloadFiles"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Beyannameleri indir
              </Label>
              <p className="text-xs text-muted-foreground">
                Fazla mükellefiniz var ise bot uzun sürebilir. İşaretlenmezse sadece liste güncellenir.
              </p>
            </div>
          </div>
        </div>

        {/* GİB Giriş Bilgileri */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label className="text-sm font-semibold mb-2 block">GİB Giriş Bilgileri</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Bot, GİB kullanıcı adı ve şifresini <strong>Ayarlar → GİB Şifreler</strong> kısmından otomatik olarak alır.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Kullanıcı Kodu:</span>
                  <code className="text-xs bg-background px-2 py-1 rounded border">
                    {gibCode || "Ayarlanmamış"}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
