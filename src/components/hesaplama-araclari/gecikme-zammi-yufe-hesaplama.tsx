"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Info,
    RotateCcw,
    CalendarClock,
    Plus,
    Trash2,
    Loader2,
    Calculator,
} from "lucide-react";

// Türkçe para formatı
const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function fmt(value: number): string {
    return currencyFormatter.format(value);
}

// Tarih → YYYYMMDD
function dateToApiFormat(dateStr: string): string {
    return dateStr.replace(/-/g, "");
}

// YYYYMMDD → DD/MM/YYYY
function formatApiDate(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

const GECIKME_TIPLERI = [
    { label: "Gecikme Zammı (Yİ-ÜFE)", value: "6" },
    { label: "Gecikme Faizi (Yİ-ÜFE)", value: "7" },
];

interface FormRow {
    id: string;
    gecikmeTipi: string;
    vadeTarihi: string;
    odemeTarihi: string;
    tutar: string;
}

interface ResultRow {
    gecikmeTipi: string;
    odenecekMiktar: number;
    vadeTarihi: string;
    odemeTarihi: string;
    hesaplananZamOrani: string;
    hesaplananFaizTutari: number;
    hesaplananMiktar: number;
}

interface ResultToplam {
    toplamMiktar: number;
    toplamZam: number;
    toplamOdenecekTutar: number;
}

function createEmptyRow(): FormRow {
    const today = new Date().toISOString().split("T")[0];
    return {
        id: crypto.randomUUID(),
        gecikmeTipi: "6",
        vadeTarihi: "",
        odemeTarihi: today,
        tutar: "",
    };
}

export function GecikmeZammiYufeHesaplama() {
    const [rows, setRows] = useState<FormRow[]>([createEmptyRow()]);
    const [results, setResults] = useState<ResultRow[]>([]);
    const [toplam, setToplam] = useState<ResultToplam | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addRow = useCallback(() => {
        setRows((prev) => {
            if (prev.length >= 10) return prev;
            return [...prev, createEmptyRow()];
        });
    }, []);

    const removeRow = useCallback((id: string) => {
        setRows((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((r) => r.id !== id);
        });
    }, []);

    const updateRow = useCallback(
        (id: string, field: keyof FormRow, value: string) => {
            setRows((prev) =>
                prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
            );
        },
        []
    );

    const handleReset = useCallback(() => {
        setRows([createEmptyRow()]);
        setResults([]);
        setToplam(null);
        setError(null);
    }, []);

    const hasInput = useMemo(
        () => rows.some((r) => r.tutar !== "" && r.vadeTarihi !== ""),
        [rows]
    );

    const hasResults = results.length > 0;

    const handleHesapla = useCallback(async () => {
        const validRows = rows.filter(
            (r) => parseNumber(r.tutar) > 0 && r.vadeTarihi && r.odemeTarihi
        );
        if (validRows.length === 0) {
            setError("Lütfen en az bir satırda tutar ve tarih bilgisi giriniz.");
            return;
        }

        for (const row of validRows) {
            if (row.odemeTarihi < row.vadeTarihi) {
                setError("Ödeme tarihi vade tarihinden önce olamaz.");
                return;
            }
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setToplam(null);

        try {
            const response = await fetch("/api/hesaplamalar/gecikme-zammi-faizi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rows: validRows.map((r) => ({
                        gecikmeTipi: parseInt(r.gecikmeTipi),
                        vadeTarihi: dateToApiFormat(r.vadeTarihi),
                        odemeTarihi: dateToApiFormat(r.odemeTarihi),
                        odenecekMiktar: parseNumber(r.tutar).toFixed(2),
                    })),
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(
                    data?.error || "GİB servisi şu anda yanıt vermiyor."
                );
            }

            const data = await response.json();

            if (data.hesaplamaList && Array.isArray(data.hesaplamaList)) {
                setResults(data.hesaplamaList);
            }
            if (data.toplam) {
                setToplam(data.toplam);
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Hesaplama sırasında bir hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    }, [rows]);

    return (
        <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CalendarClock className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Gecikme Zammı / Faizi - Yİ-ÜFE
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Yİ-ÜFE bazlı gecikme zammı ve faizi hesaplayın
                        </p>
                    </div>
                </div>
                {(hasInput || hasResults) && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Sıfırla
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Giriş ve Sonuç */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Giriş Formu */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Hesaplama Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {rows.map((row, index) => (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] items-center gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                                >
                                    <span className="text-sm font-medium text-muted-foreground w-6 text-center">
                                        {index + 1}
                                    </span>
                                    <div className="space-y-1">
                                        {index === 0 && (
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Gecikme Tipi
                                            </label>
                                        )}
                                        <Select
                                            value={row.gecikmeTipi}
                                            onValueChange={(v) =>
                                                updateRow(row.id, "gecikmeTipi", v)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {GECIKME_TIPLERI.map((t) => (
                                                    <SelectItem key={t.value} value={t.value}>
                                                        {t.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        {index === 0 && (
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Vade Tarihi
                                            </label>
                                        )}
                                        <DatePickerInput
                                            value={row.vadeTarihi}
                                            onChange={(date) =>
                                                updateRow(row.id, "vadeTarihi", date)
                                            }
                                            placeholder="Vade tarihi"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        {index === 0 && (
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Ödeme Tarihi
                                            </label>
                                        )}
                                        <DatePickerInput
                                            value={row.odemeTarihi}
                                            onChange={(date) =>
                                                updateRow(row.id, "odemeTarihi", date)
                                            }
                                            placeholder="Ödeme tarihi"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        {index === 0 && (
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Tutar (₺)
                                            </label>
                                        )}
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            value={row.tutar}
                                            onChange={(e) =>
                                                updateRow(row.id, "tutar", e.target.value)
                                            }
                                            className="text-right tabular-nums"
                                        />
                                    </div>
                                    <div className={index === 0 ? "mt-5" : ""}>
                                        {rows.length > 1 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeRow(row.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <div className="w-8" />
                                        )}
                                    </div>
                                </div>
                            ))}

                            <div className="flex items-center justify-between pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    disabled={rows.length >= 10}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Satır Ekle
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hesapla Butonu */}
                    <Button
                        className="w-full h-11"
                        onClick={handleHesapla}
                        disabled={loading || !hasInput}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Calculator className="h-4 w-4 mr-2" />
                        )}
                        Hesapla
                    </Button>

                    {/* Hata Mesajı */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Sonuç Tablosu */}
                    {hasResults && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    Hesaplama Sonuçları
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10">Sıra</TableHead>
                                                <TableHead>Tip</TableHead>
                                                <TableHead className="text-right">Tutar (₺)</TableHead>
                                                <TableHead>Vade Tarihi</TableHead>
                                                <TableHead>Ödeme Tarihi</TableHead>
                                                <TableHead className="text-right">Oran</TableHead>
                                                <TableHead className="text-right">Zam/Faiz (₺)</TableHead>
                                                <TableHead className="text-right">Toplam (₺)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {results.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{i + 1}</TableCell>
                                                    <TableCell>{r.gecikmeTipi}</TableCell>
                                                    <TableCell className="text-right font-mono tabular-nums">
                                                        {fmt(r.odenecekMiktar)}
                                                    </TableCell>
                                                    <TableCell>{formatApiDate(r.vadeTarihi)}</TableCell>
                                                    <TableCell>{formatApiDate(r.odemeTarihi)}</TableCell>
                                                    <TableCell className="text-right font-mono tabular-nums">
                                                        {r.hesaplananZamOrani}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono tabular-nums text-orange-600 dark:text-orange-400">
                                                        {fmt(r.hesaplananFaizTutari)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold tabular-nums text-primary">
                                                        {fmt(r.hesaplananMiktar)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {toplam && (
                                                <TableRow className="bg-primary/5 border-t-2">
                                                    <TableCell colSpan={2} className="font-semibold">
                                                        Toplam
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                                                        {fmt(toplam.toplamMiktar)}
                                                    </TableCell>
                                                    <TableCell colSpan={3}></TableCell>
                                                    <TableCell className="text-right font-mono font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                                                        {fmt(toplam.toplamZam)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold tabular-nums text-primary text-base">
                                                        {fmt(toplam.toplamOdenecekTutar)}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Ana Sonuç Kartı */}
                    {toplam && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="pt-6 pb-6">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Ana Para Toplamı
                                        </p>
                                        <p className="text-xl font-bold tabular-nums">
                                            {fmt(toplam.toplamMiktar)} ₺
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Zam / Faiz Toplamı
                                        </p>
                                        <p className="text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                                            {fmt(toplam.toplamZam)} ₺
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Ödenecek Toplam
                                        </p>
                                        <p className="text-2xl font-bold tabular-nums text-primary">
                                            {fmt(toplam.toplamOdenecekTutar)} ₺
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sağ: Bilgi alanı (kompakt) */}
                <div className="flex flex-col gap-3">
                    <Card className="flex-1">
                        <CardHeader className="pb-3 pt-5">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Info className="h-5 w-5 text-primary" />
                                Yİ-ÜFE Bazlı Hesaplama
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-4 pt-0">
                            <p>
                                Yurt İçi Üretici Fiyat Endeksi (Yİ-ÜFE) aylık değişim
                                oranları esas alınarak yapılan gecikme zammı ve faizi
                                hesaplamasıdır.
                            </p>

                            <div>
                                <p className="font-medium text-foreground mb-1.5">Gecikme Tipleri</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>
                                        <strong>Gecikme Zammı (Yİ-ÜFE):</strong> Vadesinde
                                        ödenmeyen amme alacaklarına Yİ-ÜFE oranları ile hesaplanan zam
                                    </li>
                                    <li>
                                        <strong>Gecikme Faizi (Yİ-ÜFE):</strong> İkmalen, re&apos;sen
                                        veya idarece yapılan tarhiyatlarda Yİ-ÜFE oranları ile
                                        hesaplanan faiz
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-medium text-foreground mb-1.5">Nasıl Kullanılır?</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Gecikme tipini seçin</li>
                                    <li>Vade ve ödeme tarihlerini girin</li>
                                    <li>Ödenecek tutarı girin</li>
                                    <li>&quot;Hesapla&quot; butonuna tıklayın</li>
                                </ol>
                                <p className="mt-2 text-xs text-muted-foreground/70">
                                    En fazla 10 satır ekleyerek toplu hesaplama yapabilirsiniz.
                                </p>
                            </div>

                            <div className="border-t pt-3 space-y-3">
                                <div>
                                    <p className="font-medium text-foreground mb-1">Yİ-ÜFE Endeksi</p>
                                    <p>
                                        TÜİK tarafından aylık olarak açıklanan üretici
                                        fiyatlarındaki değişimi ölçen endekstir.
                                    </p>
                                </div>
                                <div>
                                    <p className="font-medium text-foreground mb-1">Hesaplama Yöntemi</p>
                                    <p>
                                        Vade tarihinden ödeme tarihine kadar geçen her ay
                                        için Yİ-ÜFE aylık değişim oranları toplanarak hesaplanır.
                                    </p>
                                </div>
                                <div>
                                    <p className="font-medium text-foreground mb-1">Kaynak</p>
                                    <p>
                                        Hesaplama doğrudan GİB (Gelir İdaresi Başkanlığı)
                                        üzerinden yapılmaktadır.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
