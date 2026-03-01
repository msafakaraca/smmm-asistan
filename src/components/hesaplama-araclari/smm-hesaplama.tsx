"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
    Info,
    RotateCcw,
    Receipt,
    Loader2,
    Calculator,
} from "lucide-react";

// --- Sabit Veriler ---

const HESAPLAMA_TIPLERI = [
    { label: "Brüt Ücret (KDV Hariç)", value: "BRUT_UCRET_KDV_HARIC" },
    { label: "Brüt Ücret (KDV Dahil)", value: "BRUT_UCRET_KDV_DAHIL" },
    { label: "Net Ücret (KDV Hariç)", value: "NET_UCRET_KDV_HARIC" },
    { label: "Net Tahsil Edilen Ücret (KDV Dahil)", value: "NET_TAHSIL_EDILEN_UCRET_KDV_DAHIL" },
];

const STOPAJ_ORANLARI = [
    { label: "%20", value: "YUZDE_YIRMI" },
    { label: "%17", value: "YUZDE_ONYEDI" },
    { label: "%0", value: "YUZDE_SIFIR" },
];

const KDV_ORANLARI = [
    { label: "%20", value: "YUZDE_YIRMI" },
    { label: "%10", value: "YUZDE_ON" },
    { label: "%1", value: "YUZDE_BIR" },
    { label: "%0", value: "YUZDE_SIFIR" },
];

// GİB response'u "₺10.000,00" formatında döndürüyor
function parseGibCurrency(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/₺/g, "").replace(/\./g, "").replace(",", ".").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function fmt(value: number): string {
    return currencyFormatter.format(value);
}

// --- Interfaces ---

interface SmmResult {
    brutUcretKDVHaric: number;
    stopajTutari: number;
    netUcretKDVHaric: number;
    kdvTutari: number;
    brutUcretKDVDahil: number;
    netTahsilEdilenUcretKDVDahil: number;
}

// --- Component ---

export function SmmHesaplama() {
    const [hesaplamaTipi, setHesaplamaTipi] = useState("BRUT_UCRET_KDV_HARIC");
    const [stopajOrani, setStopajOrani] = useState("YUZDE_YIRMI");
    const [kdvOrani, setKdvOrani] = useState("YUZDE_YIRMI");
    const [tutarInput, setTutarInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SmmResult | null>(null);

    const tutar = useMemo(() => parseNumber(tutarInput), [tutarInput]);

    const hasInput = tutarInput !== "";
    const hasResult = result !== null;

    const handleReset = useCallback(() => {
        setHesaplamaTipi("BRUT_UCRET_KDV_HARIC");
        setStopajOrani("YUZDE_YIRMI");
        setKdvOrani("YUZDE_YIRMI");
        setTutarInput("");
        setResult(null);
        setError(null);
    }, []);

    const handleHesapla = useCallback(async () => {
        if (tutar <= 0) {
            setError("Lütfen geçerli bir tutar giriniz.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch("/api/hesaplamalar/smm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hesaplamaTipi,
                    stopajOrani,
                    kdvOrani,
                    hesaplanacakTutar: tutar,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(
                    data?.error || "GİB servisi şu anda yanıt vermiyor."
                );
            }

            const data = await response.json();

            setResult({
                brutUcretKDVHaric: parseGibCurrency(data.brutUcretKDVHaric),
                stopajTutari: parseGibCurrency(data.stopajTutari),
                netUcretKDVHaric: parseGibCurrency(data.netUcretKDVHaric),
                kdvTutari: parseGibCurrency(data.kdvTutari),
                brutUcretKDVDahil: parseGibCurrency(data.brutUcretKDVDahil),
                netTahsilEdilenUcretKDVDahil: parseGibCurrency(data.netTahsilEdilenUcretKDVDahil),
            });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Hesaplama sırasında bir hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    }, [tutar, hesaplamaTipi, stopajOrani, kdvOrani]);

    return (
        <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Receipt className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Serbest Meslek Makbuzu Hesaplama
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            GİB üzerinden serbest meslek makbuzu hesaplayın
                        </p>
                    </div>
                </div>
                {(hasInput || hasResult) && (
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
                        <CardContent>
                            <div className="flex flex-wrap gap-4">
                                {/* Hesaplama Tipi */}
                                <div className="space-y-1.5 flex-1 min-w-[220px]">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Hesaplama Tipi
                                    </label>
                                    <Select value={hesaplamaTipi} onValueChange={setHesaplamaTipi}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {HESAPLAMA_TIPLERI.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Stopaj Oranı */}
                                <div className="space-y-1.5 flex-1 min-w-[120px]">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Stopaj Oranı
                                    </label>
                                    <Select value={stopajOrani} onValueChange={setStopajOrani}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STOPAJ_ORANLARI.map((s) => (
                                                <SelectItem key={s.value} value={s.value}>
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* KDV Oranı */}
                                <div className="space-y-1.5 flex-1 min-w-[120px]">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        KDV Oranı
                                    </label>
                                    <Select value={kdvOrani} onValueChange={setKdvOrani}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {KDV_ORANLARI.map((k) => (
                                                <SelectItem key={k.value} value={k.value}>
                                                    {k.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Tutar */}
                                <div className="space-y-1.5 flex-1 min-w-[160px]">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Tutar (₺)
                                    </label>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={tutarInput}
                                        onChange={(e) => setTutarInput(e.target.value)}
                                        className="text-right tabular-nums"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end mt-4">
                                <Button
                                    variant="default"
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
                            </div>
                        </CardContent>
                    </Card>

                    {/* Hata Mesajı */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Sonuçlar */}
                    {hasResult && result && (
                        <>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">
                                        Makbuz Detayları
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {[
                                            ["Brüt Ücret (KDV Hariç)", result.brutUcretKDVHaric],
                                            ["Stopaj Tutarı", result.stopajTutari],
                                            ["Net Ücret (KDV Hariç)", result.netUcretKDVHaric],
                                            ["KDV Tutarı", result.kdvTutari],
                                        ].map(([label, val]) => (
                                            <div key={label as string} className="flex justify-between py-1.5 text-sm">
                                                <span className="text-muted-foreground">{label as string}</span>
                                                <span className="font-medium tabular-nums">{fmt(val as number)} ₺</span>
                                            </div>
                                        ))}

                                        <Separator />

                                        <div className="flex justify-between py-1.5 text-sm">
                                            <span className="text-muted-foreground">Brüt Ücret (KDV Dahil)</span>
                                            <span className="font-semibold tabular-nums">{fmt(result.brutUcretKDVDahil)} ₺</span>
                                        </div>

                                        <div className="flex justify-between py-1.5 text-sm font-semibold">
                                            <span>Net Tahsil Edilen Ücret (KDV Dahil)</span>
                                            <span className="tabular-nums text-primary">{fmt(result.netTahsilEdilenUcretKDVDahil)} ₺</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Ana Sonuç Kartı */}
                            <Card className="border-primary/30 bg-primary/5">
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-2 gap-6 text-center">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Brüt Ücret (KDV Dahil)
                                            </p>
                                            <p className="text-2xl font-bold tabular-nums">
                                                {fmt(result.brutUcretKDVDahil)} ₺
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Net Tahsil Edilen
                                            </p>
                                            <p className="text-2xl font-bold tabular-nums text-primary">
                                                {fmt(result.netTahsilEdilenUcretKDVDahil)} ₺
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* Sağ: Bilgi alanı */}
                <div className="flex flex-col gap-4">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Serbest Meslek Makbuzu</AlertTitle>
                        <AlertDescription>
                            Serbest meslek faaliyetinde bulunanlar, mesleki faaliyetlerine
                            ilişkin her türlü tahsilat için serbest meslek makbuzu düzenlerler.
                            Hesaplama GİB üzerinden yapılmaktadır.
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Hesaplama Tipleri</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>
                                    <strong>Brüt Ücret (KDV Hariç):</strong> KDV hariç brüt tutar üzerinden
                                </li>
                                <li>
                                    <strong>Brüt Ücret (KDV Dahil):</strong> KDV dahil brüt tutar üzerinden
                                </li>
                                <li>
                                    <strong>Net Ücret (KDV Hariç):</strong> KDV hariç net tutar üzerinden
                                </li>
                                <li>
                                    <strong>Net Tahsil Edilen:</strong> KDV dahil net tutar üzerinden
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Stopaj Oranları</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>
                                    <strong>%20:</strong> Genel stopaj oranı (GVK 94/2-b)
                                </li>
                                <li>
                                    <strong>%17:</strong> İndirimli oran
                                </li>
                                <li>
                                    <strong>%0:</strong> Stopaj yok
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Card className="flex-1">
                        <CardHeader className="pb-1 pt-4">
                            <CardTitle className="text-base underline">
                                Bilgi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3 pt-2">
                            <div>
                                <p className="font-medium mb-0.5">
                                    Brüt Ücret
                                </p>
                                <p className="text-muted-foreground">
                                    Stopaj kesintisi yapılmadan önceki toplam ücret tutarıdır.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">
                                    Stopaj (Gelir Vergisi Kesintisi)
                                </p>
                                <p className="text-muted-foreground">
                                    Ödemeyi yapan tarafın, brüt ücret üzerinden kesmesi gereken
                                    gelir vergisi tevkifatıdır.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Kaynak</p>
                                <p className="text-muted-foreground">
                                    Hesaplama doğrudan GİB (Gelir İdaresi
                                    Başkanlığı) üzerinden yapılmaktadır.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
