"use client";

import { useState, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
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
import { Badge } from "@/components/ui/badge";

// --- Sabit Veriler (TÜRMOB construction.js'den birebir) ---

interface Period {
    text: string;
    value: number;
    ref: string;
}

interface Classification {
    id: number;
    description: string;
    value: number;
}

interface Group {
    id: number;
    description: string;
    value: number;
}

interface ConstructKind {
    id: number;
    description: string;
    value: number;
}

interface ClassificationGroup {
    value: number;
    rate: number;
}

interface PrimSatir {
    id: string;
    yil: string;
    ay: string;
    primMatrahi: string;
    sgk: string;
    issizlik: string;
}

const PERIODS: Period[] = [
    { text: "2026", value: 2026, ref: "https://www.resmigazete.gov.tr/eskiler/2026/02/20260203-4.htm" },
    { text: "2025", value: 2025, ref: "https://www.resmigazete.gov.tr/eskiler/2025/01/20250131-3.htm" },
    { text: "2024", value: 2024, ref: "https://www.resmigazete.gov.tr/eskiler/2024/02/20240220-2.htm" },
    { text: "2023-2", value: 202302, ref: "https://www.resmigazete.gov.tr/eskiler/2023/02/20230211-3.htm" },
    { text: "2023-1", value: 2023, ref: "https://www.resmigazete.gov.tr/eskiler/2023/02/20230211-3.htm" },
    { text: "2022-3", value: 20223, ref: "https://www.resmigazete.gov.tr/eskiler/2022/02/20220218-11.htm" },
    { text: "2022-2", value: 20222, ref: "https://www.resmigazete.gov.tr/eskiler/2022/02/20220218-11.htm" },
    { text: "2022-1", value: 2022, ref: "https://www.resmigazete.gov.tr/eskiler/2022/02/20220218-11.htm" },
    { text: "2021", value: 2021, ref: "https://www.resmigazete.gov.tr/eskiler/2021/03/20210324-3.htm" },
    { text: "2020", value: 2020, ref: "https://www.resmigazete.gov.tr/eskiler/2020/03/20200310-7.htm" },
    { text: "2019", value: 2019, ref: "https://www.resmigazete.gov.tr/eskiler/2019/03/20190316-12.htm" },
    { text: "2018", value: 2018, ref: "https://www.resmigazete.gov.tr/eskiler/2018/04/20180426-8.htm" },
];

const CLASSIFICATIONS: Classification[] = [
    { id: 1, description: "I. Sınıf", value: 100 },
    { id: 2, description: "II. Sınıf", value: 200 },
    { id: 3, description: "III. Sınıf", value: 300 },
    { id: 4, description: "IV. Sınıf", value: 400 },
    { id: 5, description: "V. Sınıf", value: 500 },
];

const GROUPS: Group[] = [
    { id: 1, description: "A Grubu Yapılar", value: 10 },
    { id: 2, description: "B Grubu Yapılar", value: 20 },
    { id: 3, description: "C Grubu Yapılar", value: 30 },
    { id: 4, description: "D Grubu Yapılar", value: 40 },
    { id: 5, description: "E Grubu Yapılar", value: 50 },
];

const CONSTRUCT_KINDS: ConstructKind[] = [
    { id: 1, description: "Yığma (Kargir) İnşaat", value: 12.00 },
    { id: 2, description: "Karkas İnşaat", value: 9.00 },
    { id: 3, description: "Bina İnşaatı", value: 13.00 },
    { id: 4, description: "Prefabrik", value: 8.00 },
];

const CLASSIFICATION_GROUPS: ClassificationGroup[] = [
    // 2018
    { value: 2128, rate: 153 }, { value: 2138, rate: 228 },
    { value: 2228, rate: 369 }, { value: 2238, rate: 483 }, { value: 2248, rate: 578 },
    { value: 2328, rate: 800 }, { value: 2338, rate: 966 },
    { value: 2428, rate: 1016 }, { value: 2438, rate: 1177 }, { value: 2448, rate: 1308 },
    { value: 2528, rate: 1642 }, { value: 2538, rate: 2033 }, { value: 2548, rate: 2331 }, { value: 2558, rate: 2746 },
    // 2019
    { value: 2129, rate: 185 }, { value: 2139, rate: 275 },
    { value: 2229, rate: 450 }, { value: 2239, rate: 590 }, { value: 2249, rate: 710 },
    { value: 2329, rate: 980 }, { value: 2339, rate: 1210 },
    { value: 2429, rate: 1270 }, { value: 2439, rate: 1470 }, { value: 2449, rate: 1630 },
    { value: 2529, rate: 2010 }, { value: 2539, rate: 2485 }, { value: 2549, rate: 2850 }, { value: 2559, rate: 3360 },
    // 2020
    { value: 2130, rate: 210 }, { value: 2140, rate: 310 },
    { value: 2230, rate: 510 }, { value: 2240, rate: 750 }, { value: 2250, rate: 820 },
    { value: 2330, rate: 1100 }, { value: 2340, rate: 1450 },
    { value: 2430, rate: 1550 }, { value: 2440, rate: 1850 }, { value: 2450, rate: 2000 },
    { value: 2530, rate: 2400 }, { value: 2540, rate: 2900 }, { value: 2550, rate: 3250 }, { value: 2560, rate: 3800 },
    // 2021
    { value: 2131, rate: 255 }, { value: 2141, rate: 390 },
    { value: 2231, rate: 640 }, { value: 2241, rate: 940 }, { value: 2251, rate: 1030 },
    { value: 2331, rate: 1360 }, { value: 2341, rate: 1800 },
    { value: 2431, rate: 1920 }, { value: 2441, rate: 2300 }, { value: 2451, rate: 2480 },
    { value: 2531, rate: 2970 }, { value: 2541, rate: 3600 }, { value: 2551, rate: 4000 }, { value: 2561, rate: 4700 },
    // 2022-1
    { value: 2132, rate: 425 }, { value: 2142, rate: 640 },
    { value: 2232, rate: 1050 }, { value: 2242, rate: 1550 }, { value: 2252, rate: 1700 },
    { value: 2332, rate: 2250 }, { value: 2342, rate: 3000 },
    { value: 2432, rate: 3200 }, { value: 2442, rate: 3800 }, { value: 2452, rate: 4100 },
    { value: 2532, rate: 4950 }, { value: 2542, rate: 6000 }, { value: 2552, rate: 6650 }, { value: 2562, rate: 7800 },
    // 2022-2 / 2022-3
    { value: 20332, rate: 605 }, { value: 20442, rate: 910 },
    { value: 20432, rate: 1500 }, { value: 20442, rate: 2210 }, { value: 20452, rate: 2425 },
    { value: 20532, rate: 3200 }, { value: 20542, rate: 4275 },
    { value: 20632, rate: 4580 }, { value: 20642, rate: 5440 }, { value: 20652, rate: 5875 },
    { value: 20732, rate: 7090 }, { value: 20742, rate: 8595 }, { value: 20752, rate: 9525 }, { value: 20762, rate: 11175 },
    { value: 20333, rate: 650 }, { value: 20343, rate: 990 },
    { value: 20433, rate: 1650 }, { value: 20443, rate: 2400 }, { value: 20453, rate: 2685 },
    { value: 20533, rate: 3450 }, { value: 20543, rate: 4650 },
    { value: 20633, rate: 4950 }, { value: 20643, rate: 5900 }, { value: 20653, rate: 6400 },
    { value: 20733, rate: 7700 }, { value: 20743, rate: 9350 }, { value: 20753, rate: 10300 }, { value: 20763, rate: 12150 },
    // 2023-1
    { value: 2133, rate: 865 }, { value: 2143, rate: 1320 },
    { value: 2233, rate: 2195 }, { value: 2243, rate: 3200 }, { value: 2253, rate: 3575 },
    { value: 2333, rate: 4600 }, { value: 2343, rate: 6350 },
    { value: 2433, rate: 6825 }, { value: 2443, rate: 8100 }, { value: 2453, rate: 8825 },
    { value: 2533, rate: 10650 }, { value: 2543, rate: 12950 }, { value: 2553, rate: 14350 }, { value: 2563, rate: 16950 },
    // 2023-2
    { value: 202412, rate: 1050 }, { value: 202422, rate: 1550 },
    { value: 202512, rate: 2600 }, { value: 202522, rate: 3800 }, { value: 202532, rate: 5350 },
    { value: 202612, rate: 7500 }, { value: 202622, rate: 9000 },
    { value: 202712, rate: 10200 }, { value: 202722, rate: 12050 }, { value: 202732, rate: 12450 },
    { value: 202812, rate: 13800 }, { value: 202822, rate: 16250 }, { value: 202832, rate: 18100 }, { value: 202842, rate: 21400 },
    // 2024
    { value: 2134, rate: 1450 }, { value: 2144, rate: 2100 },
    { value: 2234, rate: 3500 }, { value: 2244, rate: 5250 }, { value: 2254, rate: 7750 },
    { value: 2334, rate: 12250 }, { value: 2344, rate: 14400 },
    { value: 2434, rate: 15300 }, { value: 2444, rate: 17400 }, { value: 2454, rate: 18700 },
    { value: 2534, rate: 21300 }, { value: 2544, rate: 22250 }, { value: 2554, rate: 24300 }, { value: 2564, rate: 26800 },
    // 2025
    { value: 2135, rate: 2100 }, { value: 2145, rate: 3050 }, { value: 2155, rate: 3300 }, { value: 2165, rate: 3900 },
    { value: 2235, rate: 6600 }, { value: 2245, rate: 10200 }, { value: 2255, rate: 12400 },
    { value: 2335, rate: 17100 }, { value: 2345, rate: 18200 }, { value: 2355, rate: 19150 },
    { value: 2435, rate: 21500 }, { value: 2445, rate: 27500 }, { value: 2455, rate: 32600 },
    { value: 2535, rate: 34400 }, { value: 2545, rate: 35600 }, { value: 2555, rate: 39500 },
    { value: 2565, rate: 43400 }, { value: 2575, rate: 86250 },
    // 2026
    { value: 2136, rate: 2600 }, { value: 2146, rate: 3900 }, { value: 2156, rate: 4200 }, { value: 2166, rate: 4800 },
    { value: 2236, rate: 8100 }, { value: 2246, rate: 12500 }, { value: 2256, rate: 15100 },
    { value: 2336, rate: 19800 }, { value: 2346, rate: 21050 }, { value: 2356, rate: 23400 },
    { value: 2436, rate: 26450 }, { value: 2446, rate: 33900 }, { value: 2456, rate: 40500 },
    { value: 2536, rate: 42350 }, { value: 2546, rate: 43850 }, { value: 2556, rate: 48750 },
    { value: 2566, rate: 53500 }, { value: 2576, rate: 103500 },
];

const MONTHS = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// --- Yardımcı Fonksiyonlar ---

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function fmt(value: number): string {
    return currencyFormatter.format(value);
}

function parseNum(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function createId(): string {
    return Math.random().toString(36).substring(2, 9);
}

function createEmptyRow(): PrimSatir {
    return { id: createId(), yil: "2026", ay: "Ocak", primMatrahi: "", sgk: "", issizlik: "" };
}

// --- Component ---

export function AsgariIscilikHesaplama() {
    // Yapı parametreleri
    const [periodValue, setPeriodValue] = useState("");
    const [classificationId, setClassificationId] = useState("");
    const [groupId, setGroupId] = useState("");
    const [constructKindId, setConstructKindId] = useState("2"); // Karkas varsayılan
    const [areaInput, setAreaInput] = useState("");

    // Prim tablosu
    const [primRows, setPrimRows] = useState<PrimSatir[]>([createEmptyRow()]);
    const [formerBaseAmountInput, setFormerBaseAmountInput] = useState("");

    // Seçili nesneler
    const selectedPeriod = useMemo(() => PERIODS.find(p => String(p.value) === periodValue), [periodValue]);
    const selectedClassification = useMemo(() => CLASSIFICATIONS.find(c => String(c.id) === classificationId), [classificationId]);
    const selectedGroup = useMemo(() => GROUPS.find(g => String(g.id) === groupId), [groupId]);
    const selectedConstructKind = useMemo(() => CONSTRUCT_KINDS.find(k => String(k.id) === constructKindId), [constructKindId]);

    // Hesaplamalar
    const area = useMemo(() => parseNum(areaInput), [areaInput]);
    const formerBaseAmount = useMemo(() => parseNum(formerBaseAmountInput), [formerBaseAmountInput]);

    const rateOfWorkship = useMemo(() => selectedConstructKind?.value ?? 0, [selectedConstructKind]);
    const availableRate = useMemo(() => rateOfWorkship > 0 ? rateOfWorkship - (rateOfWorkship * 0.25) : 0, [rateOfWorkship]);

    const unitCost = useMemo(() => {
        if (!selectedPeriod || !selectedClassification || !selectedGroup) return 0;
        const key = selectedPeriod.value + selectedClassification.value + selectedGroup.value;
        const found = CLASSIFICATION_GROUPS.find(cg => cg.value === key);
        return found?.rate ?? 0;
    }, [selectedPeriod, selectedClassification, selectedGroup]);

    const constructionCost = useMemo(() => unitCost * area, [unitCost, area]);
    const constructionCostTax = useMemo(() => constructionCost > 0 && availableRate > 0 ? (constructionCost * availableRate) / 100 : 0, [constructionCost, availableRate]);

    // Prim toplamları
    const primTotals = useMemo(() => {
        let toplamPrim = 0;
        let toplamSGK = 0;
        let toplamIssizlik = 0;
        let toplamPrimToplami = 0;

        primRows.forEach(row => {
            const pm = parseNum(row.primMatrahi);
            const sgk = parseNum(row.sgk);
            const iss = parseNum(row.issizlik);
            toplamPrim += pm;
            toplamSGK += sgk;
            toplamIssizlik += iss;
            toplamPrimToplami += sgk + iss;
        });

        return { toplamPrim, toplamSGK, toplamIssizlik, toplamPrimToplami };
    }, [primRows]);

    const totalWorkshipBaseAmount = useMemo(() => primTotals.toplamPrim - formerBaseAmount, [primTotals.toplamPrim, formerBaseAmount]);
    const spek = useMemo(() => constructionCostTax > 0 ? constructionCostTax - totalWorkshipBaseAmount : 0, [constructionCostTax, totalWorkshipBaseAmount]);
    const tax = useMemo(() => spek > 0 ? spek * 0.375 : 0, [spek]);

    // Form doluluk kontrolü
    const isFormComplete = periodValue && classificationId && groupId && constructKindId && area > 0;

    // Satır işlemleri
    const addRow = useCallback(() => {
        setPrimRows(prev => [...prev, createEmptyRow()]);
    }, []);

    const removeRow = useCallback((id: string) => {
        setPrimRows(prev => {
            const next = prev.filter(r => r.id !== id);
            return next.length === 0 ? [createEmptyRow()] : next;
        });
    }, []);

    const updateRow = useCallback((id: string, field: keyof PrimSatir, value: string) => {
        setPrimRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    // Sıfırlama
    const handleReset = useCallback(() => {
        setPeriodValue("");
        setClassificationId("");
        setGroupId("");
        setConstructKindId("2");
        setAreaInput("");
        setPrimRows([createEmptyRow()]);
        setFormerBaseAmountInput("");
    }, []);

    const hasInput = periodValue || classificationId || groupId || areaInput || formerBaseAmountInput;

    return (
        <div className="flex flex-col h-full p-1">
          <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Icon icon="solar:buildings-3-bold-duotone" className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            SGK Asgari İşçilik Hesaplama
                        </h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Yapım işleri raporlamasında birim ve asgari işçilik hesaplayın
                        </p>
                    </div>
                </div>
                {hasInput && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                        <Icon icon="solar:restart-bold" className="h-4 w-4 mr-1.5" />
                        Sıfırla
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Bölüm 1: Yapı Bilgileri */}
            <Card className="border shadow-none">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Icon icon="solar:ruler-angular-bold-duotone" className="h-5 w-5 text-blue-500" />
                        Yapı Bilgileri
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Üst satır: Select'ler */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Yıl</label>
                            <Select value={periodValue} onValueChange={setPeriodValue}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Yıl seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PERIODS.map(p => (
                                        <SelectItem key={p.value} value={String(p.value)}>{p.text}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Sınıf</label>
                            <Select value={classificationId} onValueChange={setClassificationId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sınıf seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CLASSIFICATIONS.map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.description}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Grup</label>
                            <Select value={groupId} onValueChange={setGroupId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Grup seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GROUPS.map(g => (
                                        <SelectItem key={g.id} value={String(g.id)}>{g.description}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">İnşaat Türü</label>
                            <Select value={constructKindId} onValueChange={setConstructKindId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="İnşaat türü seçiniz" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONSTRUCT_KINDS.map(k => (
                                        <SelectItem key={k.id} value={String(k.id)}>{k.description}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Alan girişi */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                İnşaat Alanı (m²)
                            </label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={areaInput}
                                onChange={(e) => setAreaInput(e.target.value)}
                                className="text-right tabular-nums"
                            />
                        </div>
                        {selectedPeriod && (
                            <div className="md:col-span-2 flex items-center gap-2">
                                <Icon icon="solar:link-round-bold" className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <a
                                    href={selectedPeriod.ref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline truncate"
                                >
                                    Resmi Gazete - {selectedPeriod.text} yılı yapı yaklaşık birim maliyetleri
                                </a>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Hesaplanan değerler */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon icon="solar:chart-bold-duotone" className="h-3.5 w-3.5 text-orange-500" />
                                <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400">Asgari İşçilik Oranı</p>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-orange-700 dark:text-orange-300">%{rateOfWorkship.toFixed(2)}</p>
                        </div>

                        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon icon="solar:tag-price-bold-duotone" className="h-3.5 w-3.5 text-amber-500" />
                                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Uygulanabilecek Oran</p>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">%{availableRate.toFixed(2)}</p>
                            <p className="text-[10px] text-amber-500 mt-0.5">(%25 eksiği)</p>
                        </div>

                        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon icon="solar:money-bag-bold-duotone" className="h-3.5 w-3.5 text-blue-500" />
                                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">m² Birim Maliyet</p>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">{fmt(unitCost)} &#8378;</p>
                        </div>

                        <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50 dark:bg-violet-950/20 p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon icon="solar:buildings-bold-duotone" className="h-3.5 w-3.5 text-violet-500" />
                                <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">İnşaat Maliyeti</p>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">{fmt(constructionCost)} &#8378;</p>
                        </div>
                    </div>

                    {/* Bildirilmesi gereken işçilik */}
                    {isFormComplete && (
                        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:document-text-bold-duotone" className="h-5 w-5 text-primary" />
                                <span className="text-sm font-medium">Bildirilmesi Gereken İşçilik</span>
                            </div>
                            <span className="text-xl font-bold tabular-nums text-primary">{fmt(constructionCostTax)} &#8378;</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bölüm 2: Prim Tablosu */}
            <Card className="border shadow-none">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Icon icon="solar:chart-square-bold-duotone" className="h-5 w-5 text-emerald-500" />
                            Firma Prim Matrah ve SGK Primleri
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={addRow} className="h-8 text-xs">
                            <Icon icon="solar:add-circle-bold" className="h-3.5 w-3.5 mr-1" />
                            Satır Ekle
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Tablo başlıkları */}
                    <div className="hidden md:grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr_1fr_40px] gap-2 px-2 mb-2">
                        <span className="text-[10px] font-medium text-muted-foreground text-center">#</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Yıl</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Ay</span>
                        <span className="text-[10px] font-medium text-muted-foreground text-right">Prim Matrahı</span>
                        <span className="text-[10px] font-medium text-muted-foreground text-right">SGK Primi</span>
                        <span className="text-[10px] font-medium text-muted-foreground text-right">İşsizlik Primi</span>
                        <span className="text-[10px] font-medium text-muted-foreground text-right">Prim Toplamı</span>
                        <span />
                    </div>

                    {/* Satırlar */}
                    <div className="space-y-2">
                        {primRows.map((row, index) => {
                            const rowSgk = parseNum(row.sgk);
                            const rowIss = parseNum(row.issizlik);
                            const rowTotal = rowSgk + rowIss;

                            return (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-1 md:grid-cols-[40px_1fr_1fr_1fr_1fr_1fr_1fr_40px] gap-2 rounded-xl border bg-card/50 p-3 md:p-2 items-center"
                                >
                                    <span className="hidden md:block text-xs text-muted-foreground text-center font-medium">{index + 1}</span>

                                    <Select value={row.yil} onValueChange={(v) => updateRow(row.id, "yil", v)}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PERIODS.map(p => (
                                                <SelectItem key={p.value} value={String(p.value)}>{p.text}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={row.ay} onValueChange={(v) => updateRow(row.id, "ay", v)}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTHS.map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={row.primMatrahi}
                                        onChange={(e) => updateRow(row.id, "primMatrahi", e.target.value)}
                                        className="h-9 text-xs text-right tabular-nums"
                                    />

                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={row.sgk}
                                        onChange={(e) => updateRow(row.id, "sgk", e.target.value)}
                                        className="h-9 text-xs text-right tabular-nums"
                                    />

                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        value={row.issizlik}
                                        onChange={(e) => updateRow(row.id, "issizlik", e.target.value)}
                                        className="h-9 text-xs text-right tabular-nums"
                                    />

                                    <div className="flex items-center justify-end h-9 px-2">
                                        <span className="text-xs font-semibold tabular-nums">{fmt(rowTotal)} &#8378;</span>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeRow(row.id)}
                                    >
                                        <Icon icon="solar:trash-bin-minimalistic-bold" className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tablo toplamları */}
                    <div className="grid grid-cols-1 md:grid-cols-[40px_1fr_1fr_1fr_1fr_1fr_1fr_40px] gap-2 mt-3 px-2 py-2 rounded-lg bg-muted/40">
                        <span />
                        <span />
                        <span className="text-xs font-bold text-right md:text-left">TOPLAM</span>
                        <span className="text-xs font-bold tabular-nums text-right">{fmt(primTotals.toplamPrim)} &#8378;</span>
                        <span className="text-xs font-bold tabular-nums text-right">{fmt(primTotals.toplamSGK)} &#8378;</span>
                        <span className="text-xs font-bold tabular-nums text-right">{fmt(primTotals.toplamIssizlik)} &#8378;</span>
                        <span className="text-xs font-bold tabular-nums text-right">{fmt(primTotals.toplamPrimToplami)} &#8378;</span>
                        <span />
                    </div>
                </CardContent>
            </Card>

            {/* Bölüm 3: Sonuçlar */}
            <div className="space-y-4">
                {/* Matrah karşılaştırma */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border-2 border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Icon icon="solar:wallet-money-bold-duotone" className="h-4 w-4 text-blue-500" />
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Prim Matrah Toplamı</p>
                        </div>
                        <p className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">{fmt(primTotals.toplamPrim)} &#8378;</p>
                    </div>

                    <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Icon icon="solar:file-check-bold-duotone" className="h-4 w-4 text-slate-500" />
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Önceden Bildirilen Matrah</p>
                        </div>
                        <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={formerBaseAmountInput}
                            onChange={(e) => setFormerBaseAmountInput(e.target.value)}
                            className="text-center text-lg font-bold tabular-nums h-10 border-slate-300 dark:border-slate-600"
                        />
                    </div>

                    <div className={`rounded-xl border-2 p-4 text-center ${
                        totalWorkshipBaseAmount < 0
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                            : "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                    }`}>
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Icon icon="solar:calculator-bold-duotone" className={`h-4 w-4 ${totalWorkshipBaseAmount < 0 ? "text-amber-500" : "text-emerald-500"}`} />
                            <p className={`text-xs font-medium ${totalWorkshipBaseAmount < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                Toplam İşçilik Matrahı
                            </p>
                        </div>
                        <p className={`text-xl font-bold tabular-nums ${totalWorkshipBaseAmount < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                            {fmt(Math.abs(totalWorkshipBaseAmount))} &#8378;
                        </p>
                    </div>
                </div>

                {/* SPEK karşılaştırma */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`rounded-xl border-2 p-4 text-center ${
                        totalWorkshipBaseAmount < 0
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                            : "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                    }`}>
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Icon icon="solar:clipboard-check-bold-duotone" className={`h-4 w-4 ${totalWorkshipBaseAmount < 0 ? "text-amber-500" : "text-emerald-500"}`} />
                            <p className={`text-xs font-medium ${totalWorkshipBaseAmount < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                Bildirilen SPEK İşçilik
                            </p>
                        </div>
                        <p className={`text-xl font-bold tabular-nums ${totalWorkshipBaseAmount < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                            {fmt(totalWorkshipBaseAmount)} &#8378;
                        </p>
                    </div>

                    <div className="rounded-xl border-2 border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-950/20 p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Icon icon="solar:chart-2-bold-duotone" className="h-4 w-4 text-cyan-500" />
                            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                                Fark SPEK (Eksik / Fazla)
                            </p>
                        </div>
                        <p className="text-xl font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
                            {fmt(spek)} &#8378;
                        </p>
                        {spek > 0 && (
                            <Badge variant="destructive" className="mt-2 text-[10px]">
                                <Icon icon="solar:danger-triangle-bold" className="h-3 w-3 mr-1" />
                                Eksik Bildirim
                            </Badge>
                        )}
                        {spek < 0 && (
                            <Badge className="mt-2 text-[10px] bg-emerald-500">
                                <Icon icon="solar:check-circle-bold" className="h-3 w-3 mr-1" />
                                Fazla Bildirim
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Ana sonuç: Ödenmesi Gereken Prim */}
                <div className={`rounded-2xl border-2 py-6 px-4 text-center ${
                    tax > 0
                        ? "border-red-300 dark:border-red-800 bg-gradient-to-b from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-950/10"
                        : "border-emerald-300 dark:border-emerald-800 bg-gradient-to-b from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-950/10"
                }`}>
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <Icon
                            icon={tax > 0 ? "solar:hand-money-bold-duotone" : "solar:shield-check-bold-duotone"}
                            className={`h-6 w-6 ${tax > 0 ? "text-red-500" : "text-emerald-500"}`}
                        />
                        <p className={`text-sm font-medium uppercase tracking-wider ${tax > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            Ödenmesi Gereken Prim Tutarı
                        </p>
                    </div>
                    <p className={`text-4xl font-bold tabular-nums ${tax > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {fmt(tax)} &#8378;
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Fark SPEK x %37,5
                    </p>
                </div>
            </div>
            </div>
          </div>
        </div>
    );
}
