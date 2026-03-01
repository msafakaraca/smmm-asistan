"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Info } from "lucide-react";
import {
    hesaplaKidemTazminati,
    hesaplaIhbarTazminati,
    hesaplaCalismasuresi,
    hesaplaOzet,
    type KidemSonuc,
    type IhbarSonuc,
    type OzetSonuc,
    type CalismaSuresi,
} from "@/lib/hesaplama/kidem-ihbar-hesapla";

// --- Yardımcılar ---

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function fmt(value: number): string {
    return currencyFormatter.format(value);
}

function parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function formatCalismaSuresi(cs: CalismaSuresi): string {
    const parts: string[] = [];
    if (cs.yil > 0) parts.push(`${cs.yil} yıl`);
    if (cs.ay > 0) parts.push(`${cs.ay} ay`);
    if (cs.gun > 0) parts.push(`${cs.gun} gün`);
    return parts.length > 0 ? parts.join(" ") : "0 gün";
}

// --- Sonuç Satırı Bileşeni ---

function SonucSatiri({
    label,
    value,
    isBold = false,
    isPrimary = false,
}: {
    label: string;
    value: string;
    isBold?: boolean;
    isPrimary?: boolean;
}) {
    return (
        <div className="flex justify-between py-2 text-sm">
            <span className={isBold ? "font-semibold" : "text-muted-foreground"}>
                {label}
            </span>
            <span
                className={`tabular-nums ${
                    isPrimary
                        ? "font-bold text-primary"
                        : isBold
                          ? "font-semibold"
                          : "font-medium"
                }`}
            >
                {value} &#8378;
            </span>
        </div>
    );
}

// --- Ana Bileşen ---

export function KidemIhbarTazminati() {
    const [iseGirisTarihi, setIseGirisTarihi] = useState("");
    const [istenCikisTarihi, setIstenCikisTarihi] = useState("");
    const [brutUcretInput, setBrutUcretInput] = useState("");
    const [kumulatifMatrahInput, setKumulatifMatrahInput] = useState("");
    const [asgariUcretGvmInput, setAsgariUcretGvmInput] = useState("");

    const brutUcret = useMemo(() => parseNumber(brutUcretInput), [brutUcretInput]);
    const kumulatifMatrah = useMemo(
        () => parseNumber(kumulatifMatrahInput),
        [kumulatifMatrahInput]
    );
    const asgariUcretGvm = useMemo(
        () => parseNumber(asgariUcretGvmInput),
        [asgariUcretGvmInput]
    );

    const tarihlerGecerli = useMemo(() => {
        if (!iseGirisTarihi || !istenCikisTarihi) return false;
        const baslangic = new Date(iseGirisTarihi);
        const bitis = new Date(istenCikisTarihi);
        return bitis > baslangic;
    }, [iseGirisTarihi, istenCikisTarihi]);

    const calismaSuresi = useMemo(() => {
        if (!tarihlerGecerli) return null;
        return hesaplaCalismasuresi(
            new Date(iseGirisTarihi),
            new Date(istenCikisTarihi)
        );
    }, [iseGirisTarihi, istenCikisTarihi, tarihlerGecerli]);

    const hesaplamaYapilabilir = tarihlerGecerli && brutUcret > 0;

    const kidemSonuc: KidemSonuc | null = useMemo(() => {
        if (!hesaplamaYapilabilir) return null;
        return hesaplaKidemTazminati({
            baslangicTarihi: new Date(iseGirisTarihi),
            bitisTarihi: new Date(istenCikisTarihi),
            brutUcret,
        });
    }, [hesaplamaYapilabilir, iseGirisTarihi, istenCikisTarihi, brutUcret]);

    const ihbarSonuc: IhbarSonuc | null = useMemo(() => {
        if (!hesaplamaYapilabilir) return null;
        return hesaplaIhbarTazminati({
            baslangicTarihi: new Date(iseGirisTarihi),
            bitisTarihi: new Date(istenCikisTarihi),
            brutUcret,
            kumulatifVergiMatrahi: kumulatifMatrah,
            asgarIUcretGvmKumulatif: asgariUcretGvm,
        });
    }, [
        hesaplamaYapilabilir,
        iseGirisTarihi,
        istenCikisTarihi,
        brutUcret,
        kumulatifMatrah,
        asgariUcretGvm,
    ]);

    const ozetSonuc: OzetSonuc | null = useMemo(() => {
        if (!kidemSonuc || !ihbarSonuc) return null;
        return hesaplaOzet(kidemSonuc, ihbarSonuc);
    }, [kidemSonuc, ihbarSonuc]);

    const handleReset = useCallback(() => {
        setIseGirisTarihi("");
        setIstenCikisTarihi("");
        setBrutUcretInput("");
        setKumulatifMatrahInput("");
        setAsgariUcretGvmInput("");
    }, []);

    const hasInput =
        iseGirisTarihi ||
        istenCikisTarihi ||
        brutUcretInput ||
        kumulatifMatrahInput ||
        asgariUcretGvmInput;

    return (
        <div className="space-y-8">
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Kıdem & İhbar Tazminatı Hesaplama
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Kıdem ve ihbar tazminatı tutarlarını hesaplayın
                    </p>
                </div>
                {hasInput && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="text-muted-foreground"
                    >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Sıfırla
                    </Button>
                )}
            </div>

            {/* Giriş Formu */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hesaplama Bilgileri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Satır 1: Tarihler + Çalışma Süresi */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                İşe Giriş Tarihi
                            </label>
                            <DatePickerInput
                                value={iseGirisTarihi}
                                onChange={setIseGirisTarihi}
                                placeholder="İşe giriş tarihi"
                                maxDate={istenCikisTarihi || undefined}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                İşten Çıkış Tarihi
                            </label>
                            <DatePickerInput
                                value={istenCikisTarihi}
                                onChange={setIstenCikisTarihi}
                                placeholder="İşten çıkış tarihi"
                                minDate={iseGirisTarihi || undefined}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Çalışma Süresi
                            </label>
                            <div className="h-9 flex items-center">
                                {calismaSuresi ? (
                                    <Badge variant="secondary" className="text-sm">
                                        {formatCalismaSuresi(calismaSuresi)}
                                    </Badge>
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        Tarihleri girin
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Satır 2: Ücret ve Matrahlar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Brüt Ücret (&#8378;)
                            </label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={brutUcretInput}
                                onChange={(e) => setBrutUcretInput(e.target.value)}
                                className="text-right tabular-nums"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Kümülatif Vergi Matrahı (&#8378;)
                            </label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={kumulatifMatrahInput}
                                onChange={(e) =>
                                    setKumulatifMatrahInput(e.target.value)
                                }
                                className="text-right tabular-nums"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                Asg. Ücret GVM Kümülatif (&#8378;)
                            </label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={asgariUcretGvmInput}
                                onChange={(e) =>
                                    setAsgariUcretGvmInput(e.target.value)
                                }
                                className="text-right tabular-nums"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sonuçlar */}
            {hesaplamaYapilabilir && kidemSonuc && ihbarSonuc && ozetSonuc && (
                <>
                    <Separator />

                    <Tabs defaultValue="kidem">
                        <TabsList className="w-full">
                            <TabsTrigger value="kidem" className="flex-1">
                                Kıdem Tazminatı
                            </TabsTrigger>
                            <TabsTrigger value="ihbar" className="flex-1">
                                İhbar Tazminatı
                            </TabsTrigger>
                            <TabsTrigger value="ozet" className="flex-1">
                                Özet
                            </TabsTrigger>
                        </TabsList>

                        {/* KIDEM TAZMİNATI */}
                        <TabsContent value="kidem" className="space-y-6 mt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-0">
                                        <SonucSatiri
                                            label="Çalışma Süresi"
                                            value={formatCalismaSuresi(
                                                kidemSonuc.calismaSuresi
                                            )}
                                        />
                                        <Separator />
                                        <SonucSatiri
                                            label="Kıdeme Esas Brüt Ücret"
                                            value={fmt(kidemSonuc.kidemEsasBrutUcret)}
                                        />
                                        <SonucSatiri
                                            label="Kıdem Tazminatı Tavanı"
                                            value={fmt(kidemSonuc.kidemTavani)}
                                        />
                                        <Separator />

                                        <div className="py-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                İstisna Uygulanmayan
                                            </p>
                                            <SonucSatiri
                                                label="Brüt Kıdem Tazminatı"
                                                value={fmt(
                                                    kidemSonuc.brutKidemTazminati
                                                )}
                                            />
                                            <SonucSatiri
                                                label="Damga Vergisi"
                                                value={fmt(kidemSonuc.damgaVergisi)}
                                            />
                                            <Separator />
                                            <SonucSatiri
                                                label="Net Kıdem Tazminatı"
                                                value={fmt(
                                                    kidemSonuc.netKidemTazminati
                                                )}
                                                isBold
                                            />
                                        </div>

                                        <Separator />

                                        <div className="py-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                İstisna Uygulanan
                                            </p>
                                            <SonucSatiri
                                                label="Brüt Kıdem Tazminatı"
                                                value={fmt(
                                                    kidemSonuc.brutKidemTazminati
                                                )}
                                            />
                                            <SonucSatiri
                                                label="İstisna Tutarı"
                                                value={fmt(kidemSonuc.istisnaTutari)}
                                            />
                                            <SonucSatiri
                                                label="Damga Vergisi"
                                                value={fmt(
                                                    kidemSonuc.istisnaliDamgaVergisi
                                                )}
                                            />
                                            <Separator />
                                            <SonucSatiri
                                                label="Net Kıdem Tazminatı (İstisnalı)"
                                                value={fmt(
                                                    kidemSonuc.istisnaliNetKidemTazminati
                                                )}
                                                isBold
                                                isPrimary
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Özet Kart */}
                            <div className="rounded-xl border bg-primary/5 py-6 text-center">
                                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                                    Net Kıdem Tazminatı
                                </p>
                                <p className="text-3xl font-bold tabular-nums text-primary">
                                    {fmt(kidemSonuc.istisnaliNetKidemTazminati)}{" "}
                                    &#8378;
                                </p>
                                <Badge variant="secondary" className="mt-3">
                                    Tavan: {fmt(kidemSonuc.kidemTavani)} &#8378;
                                </Badge>
                            </div>
                        </TabsContent>

                        {/* İHBAR TAZMİNATI */}
                        <TabsContent value="ihbar" className="space-y-6 mt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-0">
                                        <SonucSatiri
                                            label="İhbar Süresi"
                                            value={`${ihbarSonuc.ihbarSuresiHafta} hafta (${ihbarSonuc.ihbarSuresiGun} gün)`}
                                        />
                                        <div className="flex justify-between py-2 text-sm">
                                            <span className="text-muted-foreground">
                                                Süre Açıklaması
                                            </span>
                                            <Badge variant="outline">
                                                {ihbarSonuc.ihbarSuresiAciklama}
                                            </Badge>
                                        </div>
                                        <Separator />

                                        <div className="py-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                İstisna Uygulanmayan
                                            </p>
                                            <SonucSatiri
                                                label="Brüt İhbar Tazminatı"
                                                value={fmt(
                                                    ihbarSonuc.brutIhbarTazminati
                                                )}
                                            />
                                            <SonucSatiri
                                                label="Gelir Vergisi"
                                                value={fmt(ihbarSonuc.gelirVergisi)}
                                            />
                                            <SonucSatiri
                                                label="Damga Vergisi"
                                                value={fmt(ihbarSonuc.damgaVergisi)}
                                            />
                                            <Separator />
                                            <SonucSatiri
                                                label="Net İhbar Tazminatı"
                                                value={fmt(
                                                    ihbarSonuc.netIhbarTazminati
                                                )}
                                                isBold
                                            />
                                        </div>

                                        <Separator />

                                        <div className="py-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                İstisna Uygulanan
                                            </p>
                                            <SonucSatiri
                                                label="Brüt İhbar Tazminatı"
                                                value={fmt(
                                                    ihbarSonuc.brutIhbarTazminati
                                                )}
                                            />
                                            <SonucSatiri
                                                label="İstisna Tutarı"
                                                value={fmt(ihbarSonuc.istisnaTutari)}
                                            />
                                            <SonucSatiri
                                                label="Gelir Vergisi (İstisnalı)"
                                                value={fmt(
                                                    ihbarSonuc.istisnaliGelirVergisi
                                                )}
                                            />
                                            <SonucSatiri
                                                label="Damga Vergisi (İstisnalı)"
                                                value={fmt(
                                                    ihbarSonuc.istisnaliDamgaVergisi
                                                )}
                                            />
                                            <Separator />
                                            <SonucSatiri
                                                label="Net İhbar Tazminatı (İstisnalı)"
                                                value={fmt(
                                                    ihbarSonuc.istisnaliNetIhbarTazminati
                                                )}
                                                isBold
                                                isPrimary
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Özet Kart */}
                            <div className="rounded-xl border bg-primary/5 py-6 text-center">
                                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                                    Net İhbar Tazminatı
                                </p>
                                <p className="text-3xl font-bold tabular-nums text-primary">
                                    {fmt(ihbarSonuc.istisnaliNetIhbarTazminati)}{" "}
                                    &#8378;
                                </p>
                                <Badge variant="secondary" className="mt-3">
                                    {ihbarSonuc.ihbarSuresiHafta} hafta /{" "}
                                    {ihbarSonuc.ihbarSuresiGun} gün
                                </Badge>
                            </div>
                        </TabsContent>

                        {/* ÖZET */}
                        <TabsContent value="ozet" className="space-y-6 mt-4">
                            {/* 3 kolonlu tablo */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2 text-muted-foreground font-medium">
                                                        Kalem
                                                    </th>
                                                    <th className="text-right py-2 text-muted-foreground font-medium">
                                                        Kıdem
                                                    </th>
                                                    <th className="text-right py-2 text-muted-foreground font-medium">
                                                        İhbar
                                                    </th>
                                                    <th className="text-right py-2 text-muted-foreground font-medium">
                                                        Toplam
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="py-2.5 text-muted-foreground">
                                                        Brüt Tazminat
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">
                                                        {fmt(ozetSonuc.brutKidem)}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">
                                                        {fmt(ozetSonuc.brutIhbar)}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-semibold">
                                                        {fmt(ozetSonuc.brutToplam)}{" "}
                                                        &#8378;
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-2.5 text-muted-foreground">
                                                        Net Tazminat (İstisnasız)
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">
                                                        {fmt(ozetSonuc.netKidem)}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">
                                                        {fmt(ozetSonuc.netIhbar)}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-semibold">
                                                        {fmt(ozetSonuc.netToplam)}{" "}
                                                        &#8378;
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2.5 font-semibold">
                                                        Net Tazminat (İstisnalı)
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-bold text-primary">
                                                        {fmt(
                                                            ozetSonuc.istisnaliNetKidem
                                                        )}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-bold text-primary">
                                                        {fmt(
                                                            ozetSonuc.istisnaliNetIhbar
                                                        )}{" "}
                                                        &#8378;
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-bold text-primary">
                                                        {fmt(
                                                            ozetSonuc.istisnaliNetToplam
                                                        )}{" "}
                                                        &#8378;
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Toplam Kart */}
                            <div className="rounded-xl border bg-primary/5 py-6 text-center">
                                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                                    Toplam Net Tazminat (İstisnalı)
                                </p>
                                <p className="text-3xl font-bold tabular-nums text-primary">
                                    {fmt(ozetSonuc.istisnaliNetToplam)} &#8378;
                                </p>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <Badge variant="secondary">
                                        Kıdem: {fmt(ozetSonuc.istisnaliNetKidem)}{" "}
                                        &#8378;
                                    </Badge>
                                    <Badge variant="secondary">
                                        İhbar: {fmt(ozetSonuc.istisnaliNetIhbar)}{" "}
                                        &#8378;
                                    </Badge>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Bilgi Notu */}
                    {kidemSonuc && (
                        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
                            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground">
                                Uygulanan kıdem tazminatı tavanı dönemi:{" "}
                                <span className="font-medium text-foreground">
                                    {kidemSonuc.tavanDonemi}
                                </span>{" "}
                                — Tavan:{" "}
                                <span className="font-medium text-foreground">
                                    {fmt(kidemSonuc.kidemTavani)} &#8378;
                                </span>
                                . Çalışma süresi en az bir yıl olmalıdır.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Hesaplama yapılmadan bilgi mesajı */}
            {!hesaplamaYapilabilir && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                    Hesaplama için tarihleri ve brüt ücreti girin.
                </div>
            )}
        </div>
    );
}
