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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Info,
    RotateCcw,
    Landmark,
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

// Vergi dönemi seçenekleri (son 22 yıl)
function getVergiDonemleri(): { label: string; value: string }[] {
    const currentYear = new Date().getFullYear();
    const donemleri: { label: string; value: string }[] = [];
    for (let i = 0; i <= 22; i++) {
        const year = currentYear - i;
        donemleri.push({ label: year.toString(), value: year.toString() });
    }
    return donemleri;
}

const VERGI_DONEMLERI = getVergiDonemleri();

const GELIR_UNSURLARI = [
    { label: "Ücretli", value: "1" },
    { label: "Ücret Dışı", value: "0" },
];

interface FormRow {
    id: string;
    vergiDonemi: string;
    gelirUnsuru: string;
    matrah: string;
}

interface ResultRow {
    matrah: string;
    donem: string;
    gelirVergisi: string;
    gelirUnsuru: string;
}

function createEmptyRow(): FormRow {
    return {
        id: crypto.randomUUID(),
        vergiDonemi: new Date().getFullYear().toString(),
        gelirUnsuru: "1",
        matrah: "",
    };
}

export function GelirVergisiHesaplama() {
    const [rows, setRows] = useState<FormRow[]>([createEmptyRow()]);
    const [results, setResults] = useState<ResultRow[]>([]);
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
        setError(null);
    }, []);

    const hasInput = useMemo(
        () => rows.some((r) => r.matrah !== ""),
        [rows]
    );

    const hasResults = results.length > 0;

    const totalVergi = useMemo(
        () =>
            results.reduce(
                (sum, r) => sum + parseFloat(r.gelirVergisi || "0"),
                0
            ),
        [results]
    );

    const handleHesapla = useCallback(async () => {
        // Matrahı olan satırları filtrele
        const validRows = rows.filter((r) => parseNumber(r.matrah) > 0);
        if (validRows.length === 0) {
            setError("Lütfen en az bir satırda matrah giriniz.");
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const response = await fetch("/api/hesaplamalar/gelir-vergisi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rows: validRows.map((r) => ({
                        tur: r.gelirUnsuru,
                        vergiDonemi: `01${r.vergiDonemi}12${r.vergiDonemi}`,
                        matrah: parseNumber(r.matrah),
                    })),
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(
                    data?.error ||
                        "GİB servisi şu anda yanıt vermiyor."
                );
            }

            const data = await response.json();

            if (data.gelirVergisi && Array.isArray(data.gelirVergisi)) {
                setResults(data.gelirVergisi);
            } else {
                throw new Error("Beklenmeyen yanıt formatı.");
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
                    <Landmark className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Gelir Vergisi Hesaplama
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            GİB üzerinden gelir vergisi hesaplayın
                        </p>
                    </div>
                </div>
                {(hasInput || hasResults) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Sıfırla
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Giriş ve Sonuç */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Giriş Tablosu */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Hesaplama Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            Sıra
                                        </TableHead>
                                        <TableHead className="w-36">
                                            Vergi Dönemi
                                        </TableHead>
                                        <TableHead className="w-36">
                                            Gelir Unsuru
                                        </TableHead>
                                        <TableHead>Matrah (₺)</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, index) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-medium">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={row.vergiDonemi}
                                                    onValueChange={(v) =>
                                                        updateRow(
                                                            row.id,
                                                            "vergiDonemi",
                                                            v
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {VERGI_DONEMLERI.map(
                                                            (d) => (
                                                                <SelectItem
                                                                    key={
                                                                        d.value
                                                                    }
                                                                    value={
                                                                        d.value
                                                                    }
                                                                >
                                                                    {d.label}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={row.gelirUnsuru}
                                                    onValueChange={(v) =>
                                                        updateRow(
                                                            row.id,
                                                            "gelirUnsuru",
                                                            v
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {GELIR_UNSURLARI.map(
                                                            (g) => (
                                                                <SelectItem
                                                                    key={
                                                                        g.value
                                                                    }
                                                                    value={
                                                                        g.value
                                                                    }
                                                                >
                                                                    {g.label}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0,00"
                                                    value={row.matrah}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.id,
                                                            "matrah",
                                                            e.target.value
                                                        )
                                                    }
                                                    className="text-right tabular-nums"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {rows.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() =>
                                                            removeRow(row.id)
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="flex items-center justify-between mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    disabled={rows.length >= 10}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Satır Ekle
                                </Button>
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

                    {/* Sonuç Tablosu */}
                    {hasResults && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    Hesaplama Sonuçları
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                Sıra
                                            </TableHead>
                                            <TableHead>Vergi Dönemi</TableHead>
                                            <TableHead>Gelir Unsuru</TableHead>
                                            <TableHead className="text-right">
                                                Matrah (₺)
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Gelir Vergisi (₺)
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">
                                                    {i + 1}
                                                </TableCell>
                                                <TableCell>{r.donem}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {r.gelirUnsuru}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono tabular-nums">
                                                    {currencyFormatter.format(
                                                        parseFloat(
                                                            r.matrah || "0"
                                                        )
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold tabular-nums text-primary">
                                                    {currencyFormatter.format(
                                                        parseFloat(
                                                            r.gelirVergisi ||
                                                                "0"
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {results.length > 1 && (
                                            <TableRow className="bg-primary/5 border-t-2">
                                                <TableCell
                                                    colSpan={4}
                                                    className="font-semibold text-right"
                                                >
                                                    Toplam
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold tabular-nums text-primary text-base">
                                                    {currencyFormatter.format(
                                                        totalVergi
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Ana Sonuç Kartı */}
                    {hasResults && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Hesaplanan Gelir Vergisi
                                    </p>
                                    <p className="text-3xl font-bold text-primary">
                                        {currencyFormatter.format(
                                            results.length === 1
                                                ? parseFloat(
                                                      results[0]
                                                          .gelirVergisi ||
                                                          "0"
                                                  )
                                                : totalVergi
                                        )}{" "}
                                        TL
                                    </p>
                                    {results.length === 1 && (
                                        <Badge variant="secondary">
                                            {results[0].donem} -{" "}
                                            {results[0].gelirUnsuru}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sağ: Bilgi alanı */}
                <div className="flex flex-col gap-4">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Gelir Vergisi Hakkında</AlertTitle>
                        <AlertDescription>
                            Gelir vergisi, gerçek kişilerin bir takvim yılı
                            içinde elde ettiği kazanç ve iratların safi tutarı
                            üzerinden hesaplanan vergidir. Hesaplama GİB (Gelir
                            İdaresi Başkanlığı) üzerinden yapılmaktadır.
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Gelir Unsurları</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>
                                    <strong>Ücretli:</strong> Hizmet karşılığı
                                    alınan ücret gelirleri
                                </li>
                                <li>
                                    <strong>Ücret Dışı:</strong> Ticari kazanç,
                                    serbest meslek kazancı, gayrimenkul ve
                                    menkul sermaye iratları, diğer kazançlar
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Nasıl Kullanılır?</AlertTitle>
                        <AlertDescription>
                            <ol className="list-decimal list-inside space-y-1 mt-1">
                                <li>Vergi dönemini (yıl) seçin</li>
                                <li>Gelir unsurunu seçin</li>
                                <li>Vergi matrahını girin</li>
                                <li>
                                    &quot;Hesapla&quot; butonuna tıklayın
                                </li>
                            </ol>
                            <p className="mt-2 text-xs">
                                Birden fazla satır ekleyerek farklı dönem ve
                                gelir unsurları için toplu hesaplama
                                yapabilirsiniz (en fazla 10 satır).
                            </p>
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
                                    Vergi Matrahı
                                </p>
                                <p className="text-muted-foreground">
                                    Gayrisafi gelirden, kanunda belirtilen
                                    indirimler düşüldükten sonra kalan
                                    tutardır.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">
                                    Vergi Dilimleri
                                </p>
                                <p className="text-muted-foreground">
                                    Gelir vergisi artan oranlı tarifeye tabidir.
                                    Matrah arttıkça vergi oranı da artar.
                                    Ücretli ve ücret dışı gelirler için farklı
                                    dilimler uygulanır.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Kaynak</p>
                                <p className="text-muted-foreground">
                                    Hesaplama doğrudan GİB (Gelir İdaresi
                                    Başkanlığı) üzerinden yapılmaktadır.
                                    Sonuçlar resmi vergi tarifelerine göre
                                    hesaplanır.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
