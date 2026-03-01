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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";

// --- Sabit Veriler ---

interface TevkifatOrani {
    code1: string;
    code2: string;
    text: string;
    rate: string;
    value: number;
}

const TEVKIFAT_ORANLARI: TevkifatOrani[] = [
    { code1: "601", code2: "601", text: "YAPIM İŞLERİ İLE BU İŞLERLE BİRLİKTE İFA EDİLEN MÜHENDİSLİK-MİMARLIK VE ETÜT-PROJE HİZMETLERİ [GT 117-Bölüm (3.2.1)]", rate: "4/10", value: 0.4 },
    { code1: "602", code2: "602", text: "ETÜT, PLAN-PROJE, DANIŞMANLIK, DENETİM VE BENZERİ HİZMETLER [GT 117-Bölüm (3.2.2)]", rate: "9/10", value: 0.9 },
    { code1: "603", code2: "603", text: "MAKİNE, TEÇHİZAT, DEMİRBAŞ VE TAŞITLARA AİT TADİL, BAKIM VE ONARIM HİZMETLERİ [GT 117-Bölüm (3.2.3)]", rate: "7/10", value: 0.7 },
    { code1: "604", code2: "604", text: "YEMEK SERVİS HİZMETİ [GT 117-Bölüm (3.2.4)]", rate: "5/10", value: 0.5 },
    { code1: "605", code2: "605", text: "ORGANİZASYON HİZMETİ [GT 117-Bölüm (3.2.4)]", rate: "5/10", value: 0.5 },
    { code1: "606", code2: "606", text: "İŞGÜCÜ TEMİN HİZMETLERİ [GT 117-Bölüm (3.2.5)]", rate: "9/10", value: 0.9 },
    { code1: "607", code2: "607", text: "ÖZEL GÜVENLİK HİZMETİ [GT 117-Bölüm (3.2.5)]", rate: "9/10", value: 0.9 },
    { code1: "608", code2: "608", text: "YAPI DENETİM HİZMETLERİ [GT 117-Bölüm (3.2.6)]", rate: "9/10", value: 0.9 },
    { code1: "609", code2: "609", text: "FASON OLARAK YAPTIRILAN TEKSTİL VE KONFEKSİYON İŞLERİ, ÇANTA VE AYAKKABI DİKİM İŞLERİ VE BU İŞLERE ARACILIK HİZMETLERİ [GT 117-Bölüm (3.2.7)]", rate: "7/10", value: 0.7 },
    { code1: "610", code2: "610", text: "TURİSTİK MAĞAZALARA VERİLEN MÜŞTERİ BULMA / GÖTÜRME HİZMETLERİ [GT 117-Bölüm (3.2.8)]", rate: "9/10", value: 0.9 },
    { code1: "611", code2: "611", text: "SPOR KULÜPLERİNİN YAYIN, REKLÂM VE İSİM HAKKI GELİRLERİNE KONU İŞLEMLERİ [GT 117-Bölüm (3.2.9)]", rate: "9/10", value: 0.9 },
    { code1: "612", code2: "612", text: "TEMİZLİK HİZMETİ [GT 117-Bölüm (3.2.10)]", rate: "9/10", value: 0.9 },
    { code1: "613", code2: "613", text: "ÇEVRE VE BAHÇE BAKIM HİZMETLERİ [GT 117-Bölüm (3.2.10)]", rate: "9/10", value: 0.9 },
    { code1: "614", code2: "614", text: "SERVİS TAŞIMACILIĞI HİZMETİ [GT 117-Bölüm (3.2.11)]", rate: "5/10", value: 0.5 },
    { code1: "615", code2: "615", text: "HER TÜRLÜ BASKI VE BASIM HİZMETLERİ [GT 117-Bölüm (3.2.12)]", rate: "7/10", value: 0.7 },
    { code1: "616", code2: "616", text: "Diğer Hizmetler [KDVGUT-(I/C-2.1.3.2.13)]", rate: "5/10", value: 0.5 },
    { code1: "617", code2: "617", text: "HURDA METALDEN ELDE EDİLEN KÜLÇE TESLİMLERİ [GT 117-Bölüm (3.3.1)]", rate: "7/10", value: 0.7 },
    { code1: "618", code2: "618", text: "HURDA METALDEN ELDE EDİLENLER DIŞINDAKİ BAKIR, ÇİNKO VE ALÜMİNYUM KÜLÇE TESLİMLERİ [GT 117-Bölüm (3.3.1)]", rate: "7/10", value: 0.7 },
    { code1: "619", code2: "619", text: "BAKIR, ÇİNKO VE ALÜMİNYUM ÜRÜNLERİNİN TESLİMİ [GT 117-Bölüm (3.3.2)]", rate: "7/10", value: 0.7 },
    { code1: "620", code2: "620", text: "İSTİSNADAN VAZGEÇENLERİN HURDA VE ATIK TESLİMİ [GT 117-Bölüm (3.3.3)]", rate: "7/10", value: 0.7 },
    { code1: "621", code2: "621", text: "METAL, PLASTİK, LASTİK, KAUÇUK, KÂĞIT VE CAM HURDA VE ATIKLARDAN ELDE EDİLEN HAMMADDE TESLİMİ [GT 117-Bölüm (3.3.4)]", rate: "9/10", value: 0.9 },
    { code1: "622", code2: "622", text: "PAMUK, TİFTİK, YÜN VE YAPAĞA İLE HAM POST VE DERİ TESLİMLERİ [GT 117-Bölüm (3.3.5)]", rate: "9/10", value: 0.9 },
    { code1: "623", code2: "623", text: "AĞAÇ VE ORMAN ÜRÜNLERİ TESLİMİ [GT 117-Bölüm (3.3.6)]", rate: "5/10", value: 0.5 },
    { code1: "624", code2: "624", text: "YÜK TAŞIMACILIĞI HİZMETİ [KDVGUT-(I/C-2.1.3.2.11)]", rate: "2/10", value: 0.2 },
    { code1: "625", code2: "625", text: "TİCARİ REKLAM HİZMETLERİ [KDVGUT-(I/C-2.1.3.2.15)]", rate: "3/10", value: 0.3 },
    { code1: "626", code2: "626", text: "DİĞER TESLİMLER [KDVGUT-(I/C-2.1.3.3.7.)]", rate: "2/10", value: 0.2 },
    { code1: "650", code2: "650", text: "DİĞERLERİ (2/10)", rate: "2/10", value: 0.2 },
    { code1: "650", code2: "650", text: "DİĞERLERİ (3/10)", rate: "3/10", value: 0.3 },
    { code1: "650", code2: "650", text: "DİĞERLERİ (5/10)", rate: "5/10", value: 0.5 },
    { code1: "650", code2: "650", text: "DİĞERLERİ (7/10)", rate: "7/10", value: 0.7 },
    { code1: "650", code2: "650", text: "DİĞERLERİ (9/10)", rate: "9/10", value: 0.9 },
];

const KDV_ORANLARI = [
    { label: "%20", value: 0.20 },
    { label: "%10", value: 0.10 },
    { label: "%1", value: 0.01 },
];

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

// --- Component ---

export function KdvTevkifatHesaplama() {
    const [kdvDahilMi, setKdvDahilMi] = useState("haric");
    const [tutarInput, setTutarInput] = useState("");
    const [kdvOraniIdx, setKdvOraniIdx] = useState("0");
    const [tevkifatIdx, setTevkifatIdx] = useState("");

    const tutar = useMemo(() => parseNumber(tutarInput), [tutarInput]);
    const kdvOrani = useMemo(() => KDV_ORANLARI[Number(kdvOraniIdx)]?.value ?? 0.20, [kdvOraniIdx]);
    const selectedTevkifat = useMemo(
        () => (tevkifatIdx !== "" ? TEVKIFAT_ORANLARI[Number(tevkifatIdx)] : null),
        [tevkifatIdx]
    );

    const h = useMemo(() => {
        let kdvHaric: number;
        let kdvTutari: number;
        let kdvDahil: number;

        if (kdvDahilMi === "dahil") {
            kdvDahil = tutar;
            kdvHaric = tutar / (1 + kdvOrani);
            kdvTutari = kdvDahil - kdvHaric;
        } else {
            kdvHaric = tutar;
            kdvTutari = tutar * kdvOrani;
            kdvDahil = tutar + kdvTutari;
        }

        const tevkifatOranValue = selectedTevkifat?.value ?? 0;
        const tevkifTutari = kdvTutari * tevkifatOranValue;
        const hesaplananKdv = kdvTutari - tevkifTutari;
        const genelToplam = kdvHaric + hesaplananKdv;

        return { kdvHaric, kdvTutari, kdvDahil, tevkifTutari, hesaplananKdv, genelToplam };
    }, [tutar, kdvOrani, kdvDahilMi, selectedTevkifat]);

    const handleReset = useCallback(() => {
        setKdvDahilMi("haric");
        setTutarInput("");
        setKdvOraniIdx("0");
        setTevkifatIdx("");
    }, []);

    const hasInput = tutarInput || tevkifatIdx !== "";
    const kdvOraniLabel = KDV_ORANLARI[Number(kdvOraniIdx)]?.label ?? "%20";

    return (
        <div className="space-y-8">
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        KDV Tevkifat Hesaplama
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        KDV tevkifat tutarını ve beyanname bilgilerini hesaplayın
                    </p>
                </div>
                {hasInput && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Sıfırla
                    </Button>
                )}
            </div>

            {/* Giriş */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hesaplama Bilgileri</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-[1fr_2fr_auto_auto] items-end gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                KDV Dahil/Hariç
                            </label>
                            <Select value={kdvDahilMi} onValueChange={setKdvDahilMi}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="haric">KDV Hariç</SelectItem>
                                    <SelectItem value="dahil">KDV Dahil</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                İşin Türü
                            </label>
                            <Select value={tevkifatIdx} onValueChange={setTevkifatIdx}>
                                <SelectTrigger>
                                    <SelectValue placeholder="İşin türünü seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TEVKIFAT_ORANLARI.map((t, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                            {t.code1} - {t.text} - {t.rate}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 w-36">
                            <label className="text-xs font-medium text-muted-foreground">
                                Tutar
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

                        <div className="space-y-1.5 w-24">
                            <label className="text-xs font-medium text-muted-foreground">
                                KDV Oranı
                            </label>
                            <Select value={kdvOraniIdx} onValueChange={setKdvOraniIdx}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {KDV_ORANLARI.map((o, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator />

            {/* Sonuçlar */}
            <div className="space-y-6">
                {/* KDV Satırı */}
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg border bg-card p-4">
                        <p className="text-xs text-muted-foreground mb-1.5">KDV Hariç</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(h.kdvHaric)} &#8378;</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                        <p className="text-xs text-muted-foreground mb-1.5">KDV Tutarı</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(h.kdvTutari)} &#8378;</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                        <p className="text-xs text-muted-foreground mb-1.5">KDV Dahil</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(h.kdvDahil)} &#8378;</p>
                    </div>
                </div>

                {/* Tevkifat Satırı */}
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="text-xs text-muted-foreground mb-1.5">Tevkif Edilen</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(h.tevkifTutari)} &#8378;</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="text-xs text-muted-foreground mb-1.5">Hesaplanan KDV</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(h.hesaplananKdv)} &#8378;</p>
                    </div>
                </div>

                {/* Genel Toplam */}
                <div className="rounded-xl border bg-primary/5 py-6 text-center">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Ödenecek Tutar</p>
                    <p className="text-3xl font-bold tabular-nums text-primary">
                        {fmt(h.genelToplam)} &#8378;
                    </p>
                    {selectedTevkifat && (
                        <Badge variant="secondary" className="mt-3">
                            Tevkifat: {selectedTevkifat.rate}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Detaylar - Accordion */}
            <Accordion type="multiple" className="space-y-0">
                {/* e-Belge Tablosu */}
                <AccordionItem value="ebelge">
                    <AccordionTrigger className="text-sm">
                        e-Belge Bilgileri
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-2">
                            {[
                                ["Mal/Hizmet Toplam Tutar", fmt(h.kdvHaric)],
                                ["Hesaplanan KDV", fmt(h.kdvTutari)],
                                ["Tevkifata Tabi İşlem Tutarı", fmt(h.kdvHaric)],
                                ["Tevkifata Tabi İşlem Üz. Hes. KDV", fmt(h.kdvTutari)],
                                ["Hesaplanan KDV Tevkifat", fmt(h.tevkifTutari)],
                                ["Vergiler Dahil Toplam", fmt(h.kdvDahil)],
                            ].map(([label, val]) => (
                                <div key={label} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-medium tabular-nums">{val} &#8378;</span>
                                </div>
                            ))}
                            <Separator />
                            <div className="flex justify-between py-1.5 text-sm font-semibold">
                                <span>Ödenecek Tutar</span>
                                <span className="tabular-nums text-primary">{fmt(h.genelToplam)} &#8378;</span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Beyanname Tabloları */}
                <AccordionItem value="beyanname">
                    <AccordionTrigger className="text-sm">
                        Beyanname Bilgileri
                    </AccordionTrigger>
                    <AccordionContent>
                        <Tabs defaultValue="satis">
                            <TabsList className="w-full">
                                <TabsTrigger value="satis" className="flex-1">Satış (KDV 1)</TabsTrigger>
                                <TabsTrigger value="alis" className="flex-1">Alış (KDV 1 + KDV 2)</TabsTrigger>
                            </TabsList>

                            {/* SATIŞ */}
                            <TabsContent value="satis" className="space-y-5 mt-4">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                        Kısmi Tevkifat Uygulanan İşlemler
                                    </p>
                                    <div className="grid grid-cols-5 gap-3">
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Matrah</p>
                                            <p className="text-sm font-semibold tabular-nums">{fmt(h.kdvHaric)}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">KDV Oranı</p>
                                            <p className="text-sm font-semibold">{kdvOraniLabel}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Kod</p>
                                            <p className="text-sm font-semibold">{selectedTevkifat?.code1 ?? "-"}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tevkifat Oranı</p>
                                            <p className="text-sm font-semibold">{selectedTevkifat?.rate ?? "-"}</p>
                                        </div>
                                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Vergi</p>
                                            <p className="text-sm font-bold tabular-nums text-primary">{fmt(h.hesaplananKdv)}</p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                        Bildirim Eki
                                    </p>
                                    <div className="grid grid-cols-5 gap-3">
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tutar (KDV Hariç)</p>
                                            <p className="text-sm font-semibold tabular-nums">{fmt(h.kdvHaric)}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">KDV Oranı</p>
                                            <p className="text-sm font-semibold">{kdvOraniLabel}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Hes. KDV</p>
                                            <p className="text-sm font-semibold tabular-nums">{fmt(h.kdvTutari)}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tevkifat Oranı</p>
                                            <p className="text-sm font-semibold">{selectedTevkifat?.rate ?? "-"}</p>
                                        </div>
                                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tevkifat Tutarı</p>
                                            <p className="text-sm font-bold tabular-nums text-primary">{fmt(h.tevkifTutari)}</p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* ALIŞ */}
                            <TabsContent value="alis" className="space-y-5 mt-4">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                        KDV 1 - İndirim Tablosu
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-lg border bg-card p-3 flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Yurt İçi Alımlara İlişkin KDV</p>
                                            <p className="text-sm font-semibold tabular-nums">{fmt(h.hesaplananKdv)} &#8378;</p>
                                        </div>
                                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Sorumlu Sıfatıyla Beyan Edilen KDV</p>
                                            <p className="text-sm font-bold tabular-nums text-primary">{fmt(h.tevkifTutari)} &#8378;</p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                        KDV 2 - Kısmi Tevkifat Bildirimi
                                    </p>
                                    <div className="grid grid-cols-5 gap-3">
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Matrah</p>
                                            <p className="text-sm font-semibold tabular-nums">{fmt(h.kdvHaric)}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Oran</p>
                                            <p className="text-sm font-semibold">{kdvOraniLabel}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Kod</p>
                                            <p className="text-sm font-semibold">{selectedTevkifat?.code2 ?? "-"}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Tevkifat Oranı</p>
                                            <p className="text-sm font-semibold">{selectedTevkifat?.rate ?? "-"}</p>
                                        </div>
                                        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
                                            <p className="text-[10px] text-muted-foreground mb-1">Vergi</p>
                                            <p className="text-sm font-bold tabular-nums text-primary">{fmt(h.tevkifTutari)}</p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
