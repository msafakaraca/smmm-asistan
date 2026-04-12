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
import { Info, RotateCcw, Calculator, BookOpen } from "lucide-react";

const KKEG_ORANI = 0.10;

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("tr-TR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function parseNumber(value: string): number {
    if (!value) return 0;
    // Türkçe format desteği: 1.000.000,50 → 1000000.50
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

export function FinansmanGiderKisitlamasi() {
    // Kullanıcı girişi alanları
    const [d4Input, setD4Input] = useState(""); // Özsermaye
    const [d5Input, setD5Input] = useState(""); // Yabancı kaynak
    const [d8Input, setD8Input] = useState(""); // Finansman gideri
    const [d9Input, setD9Input] = useState(""); // Örtülü sermaye gideri

    // Parse edilen değerler
    const d4 = useMemo(() => parseNumber(d4Input), [d4Input]);
    const d5 = useMemo(() => parseNumber(d5Input), [d5Input]);
    const d8 = useMemo(() => parseNumber(d8Input), [d8Input]);
    const d9 = useMemo(() => parseNumber(d9Input), [d9Input]);

    // Hesaplanan alanlar
    const d6 = useMemo(() => Math.max(d5 - Math.max(d4, 0), 0), [d4, d5]); // Aşan kısım
    const d7 = useMemo(() => (d5 > 0 ? d6 / d5 : 0), [d5, d6]); // Oran
    const d10 = useMemo(() => d8 - d9, [d8, d9]); // Net gider
    const d11 = useMemo(() => d7 * d10, [d7, d10]); // Aşan kısma isabet eden
    const d12 = useMemo(() => d11 * KKEG_ORANI, [d11]); // KKEG
    const d13 = useMemo(() => d8 - d12, [d8, d12]); // Gider kalacak tutar

    const handleReset = useCallback(() => {
        setD4Input("");
        setD5Input("");
        setD8Input("");
        setD9Input("");
    }, []);

    const hasInput = d4Input || d5Input || d8Input || d9Input;

    return (
        <div className="flex flex-col h-full p-1">
          <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                    <Calculator className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Finansman Gider Kısıtlaması Hesaplama
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Kurumlar vergisi matrahına eklenecek KKEG tutarını hesaplayın
                        </p>
                    </div>
                </div>
                {hasInput && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Sıfırla
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hesaplama Tablosu */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Hesaplama Tablosu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">Sıra</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="w-48 text-right">Tutar / Oran</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Satır 1: Özsermaye */}
                                    <TableRow>
                                        <TableCell className="font-medium">1</TableCell>
                                        <TableCell>Özsermaye</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                value={d4Input}
                                                onChange={(e) => setD4Input(e.target.value)}
                                                className="text-right w-full"
                                            />
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 2: Yabancı kaynak */}
                                    <TableRow>
                                        <TableCell className="font-medium">2</TableCell>
                                        <TableCell>Yabancı Kaynak Toplamı</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                value={d5Input}
                                                onChange={(e) => setD5Input(e.target.value)}
                                                className="text-right w-full"
                                            />
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 3: Aşan kısım */}
                                    <TableRow className="bg-muted/30">
                                        <TableCell className="font-medium">3</TableCell>
                                        <TableCell>
                                            Yabancı Kaynağın Özsermayeyi Aşan Kısmı
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 2 - Satır 1)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium pr-5">
                                            {currencyFormatter.format(d6)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 4: Oran */}
                                    <TableRow className="bg-muted/30">
                                        <TableCell className="font-medium">4</TableCell>
                                        <TableCell>
                                            Aşan Kısmın Yabancı Kaynaklara Oranı
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 3 / Satır 2)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium pr-5">
                                            {percentFormatter.format(d7)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 5: Finansman gideri */}
                                    <TableRow>
                                        <TableCell className="font-medium">5</TableCell>
                                        <TableCell>
                                            Yabancı Kaynaklara İlişkin Finansman Gideri
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                value={d8Input}
                                                onChange={(e) => setD8Input(e.target.value)}
                                                className="text-right w-full"
                                            />
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 6: Örtülü sermaye gideri */}
                                    <TableRow>
                                        <TableCell className="font-medium">6</TableCell>
                                        <TableCell>
                                            Örtülü Sermaye Sayılan Borçlanma Gideri
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                value={d9Input}
                                                onChange={(e) => setD9Input(e.target.value)}
                                                className="text-right w-full"
                                            />
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 7: Net gider */}
                                    <TableRow className="bg-muted/30">
                                        <TableCell className="font-medium">7</TableCell>
                                        <TableCell>
                                            Finansman Gider Kısıtlamasına Konu Gider
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 5 - Satır 6)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium pr-5">
                                            {currencyFormatter.format(d10)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 8: Aşan kısma isabet eden */}
                                    <TableRow className="bg-muted/30">
                                        <TableCell className="font-medium">8</TableCell>
                                        <TableCell>
                                            Aşan Kısma İsabet Eden Finansman Gideri
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 4 x Satır 7)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium pr-5">
                                            {currencyFormatter.format(d11)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Satır 9: KKEG */}
                                    <TableRow className="bg-primary/5 border-primary/20">
                                        <TableCell className="font-bold">9</TableCell>
                                        <TableCell className="font-semibold">
                                            KKEG (Kanunen Kabul Edilmeyen Gider)
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 8 x %10)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-primary text-base pr-5">
                                            {currencyFormatter.format(d12)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Ek satır: Gider kalacak tutar */}
                                    <TableRow className="bg-green-50 dark:bg-green-950/20">
                                        <TableCell className="font-medium">-</TableCell>
                                        <TableCell className="font-medium text-green-700 dark:text-green-400">
                                            Gider Olarak Kalacak Tutar
                                            <span className="text-xs text-muted-foreground ml-2">
                                                (Satır 5 - Satır 9)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-green-700 dark:text-green-400 pr-5">
                                            {currencyFormatter.format(d13)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* KKEG Sonuç Kartı */}
                    <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="pt-6">
                            <div className="text-center space-y-2">
                                <p className="text-sm text-muted-foreground">Hesaplanan KKEG Tutarı</p>
                                <p className="text-3xl font-bold text-primary">
                                    {currencyFormatter.format(d12)} TL
                                </p>
                                <Badge variant="secondary">
                                    Oran: {percentFormatter.format(d7)}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sağ taraf: Bilgi alanı */}
                <div className="flex flex-col gap-4">
                    {/* Bilgi Alertleri */}
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Yasal Dayanak</AlertTitle>
                        <AlertDescription>
                            Kurumlar Vergisi Kanunu Madde 11/1-i ve Gelir Vergisi Kanunu Madde 40/1 gereğince,
                            kullanılan yabancı kaynakların özsermayeyi aşan kısmına isabet eden finansman
                            giderlerinin %10&apos;u KKEG olarak dikkate alınır.
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Özsermaye Negatifse</AlertTitle>
                        <AlertDescription>
                            Özsermaye negatif ise hesaplamada 0 (sıfır) olarak dikkate alınır.
                            Bu durumda yabancı kaynağın tamamı aşan kısım olarak değerlendirilir.
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Kısıtlamaya Tabi Olmayan Durumlar</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>Özsermaye yabancı kaynaktan büyükse kısıtlama yapılmaz</li>
                                <li>Kredi kuruluşları, finansal kiralama ve finansman şirketleri muaftır</li>
                                <li>Teminat mektubu komisyonları kısıtlama kapsamı dışındadır</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    {/* Formül Açıklamaları */}
                    <Card className="flex-1">
                        <CardHeader className="pb-1 pt-4">
                            <CardTitle className="text-base underline">Formül Açıklamaları</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3 pt-2">
                            <div>
                                <p className="font-medium mb-0.5">Aşan Kısım</p>
                                <p className="text-muted-foreground">
                                    Yabancı kaynakların özsermayeyi aşan tutarıdır. Özsermaye negatifse sıfır kabul edilir, yabancı kaynak özsermayeden küçükse kısıtlama uygulanmaz.
                                    <code className="ml-1 text-foreground font-mono font-bold">YK - ÖS</code>
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Oran</p>
                                <p className="text-muted-foreground">
                                    Özsermayeyi aşan yabancı kaynak tutarının toplam yabancı kaynaklara bölünmesiyle elde edilen orandır.
                                    <code className="ml-1 text-foreground font-mono font-bold">Aşan / YK</code>
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Net Gider</p>
                                <p className="text-muted-foreground">
                                    Yabancı kaynaklara ilişkin toplam finansman giderinden, örtülü sermaye sayılan borçlanma giderleri düşülerek bulunan tutardır.
                                    <code className="ml-1 text-foreground font-mono font-bold">FG - ÖSG</code>
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">KKEG</p>
                                <p className="text-muted-foreground">
                                    Aşan kısma isabet eden net finansman giderinin %10&apos;u, kanunen kabul edilmeyen gider olarak kurumlar vergisi matrahına eklenir.
                                    <code className="ml-1 text-foreground font-mono font-bold">Oran x Net x %10</code>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Açıklama ve Bilgi Tablosu */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Kavramlar ve Açıklamalar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-64">Kavram</TableHead>
                                <TableHead>Açıklama</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium align-top">Finansman Giderleri</TableCell>
                                <TableCell className="whitespace-normal">
                                    Yabancı kaynağın kullanım süresine bağlı olarak doğan her türlü faiz, komisyon, vade farkı, kâr payı, kur farkı, faktoring kuruluşlarına verilen iskonto bedelleri ve benzeri adlar altında yapılmış olan gider ve maliyet unsurlarından oluşur. Bu tutarların yer aldığı 780, 660, 656 hesaplar ve benzeri hesaplardaki rakamlar kısıtlamaya tabi olacak.
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium align-top">Özsermaye</TableCell>
                                <TableCell className="whitespace-normal">
                                    Gider kısıtlamasının yapılacağı dönem itibarıyla çıkarılan bilançodaki özsermaye olup, her dönem sonu itibarıyla bilanço çıkarılması gerekiyor. Ör. 2021/1. Geçici için 31.03.2021 tarihli bilançodaki özsermaye dikkate alınacak.
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium align-top">Yabancı Kaynaklar</TableCell>
                                <TableCell className="whitespace-normal">
                                    Bilançonun kısa vadeli yabancı kaynaklar ve uzun vadeli yabancı kaynaklar toplamını ifade etmekte. (Aktif - Özsermaye)
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium align-top" rowSpan={2}>
                                    Finansman Gider Kısıtlamasına Tabi Olmayan Giderler
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    Teminat mektubu komisyonları, tahvil ihracı ile ilgili olarak yapılan baskı ve benzeri giderler ile ipotek masrafları gibi herhangi bir yabancı kaynak kullanımına bağlı olmaksızın yapılan giderlerin gider kısıtlamasına konu edilmesi söz konusu değildir. Aynı şekilde bir finansman gideri olmayıp finansman geliri azalması niteliğinde olan erken ödeme iskontoları veya peşin ödeme iskontoları da <strong className="underline">gider indirimi kısıtlaması kapsamı dışındadır.</strong>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="whitespace-normal">
                                    Kredi sözleşmelerine ilişkin olarak ödenen damga vergisi veya banka havale ücretlerine ilişkin ödenen banka ve sigorta muameleleri vergisi gibi bir yabancı kaynağın kullanım süresine bağlı olarak doğmayan gider ve maliyet unsurları <strong className="underline">gider indirimi kısıtlaması uygulamasına tabi olmayacaktır.</strong>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium align-top">
                                    Yapılmakta Olan Yatırımlara Ait Finansman Giderleri
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    İlgili duran varlık kullanılmaya hazır hale gelinceye kadar yatırım projelerine ilişkin olarak &quot;Yapılmakta olan yatırımlar&quot; hesabında izlenen tutarlar da dahil olmak üzere her türlü (teşvik belgeli veya belgesiz) amortismana tabi iktisadi kıymetler olup, bunların maliyetine eklenen finansman <strong className="underline">giderleri kısıtlamaya tabi olmayacak.</strong>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium align-top">
                                    Yıllara Yaygın İnşaat İşlerinde Uygulama
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    Bu işlerle uğraşanların kullandıkları yabancı kaynaklara ilişkin finansman giderlerinin, işin kesin kâr veya zararının tespit edildiği yıl kazancının hesaplanmasında gider veya maliyet unsuru olarak dikkate alınması gerektiğinden, gider kısıtlamasına ilişkin uygulama da aynı dönemde yapılacaktır. Birden fazla inşaat ve onarma işinin birlikte yapılması veya yıllara sari inşaat ve onarma işlerinin yanı sıra başka işlerin de bulunması halinde, yapılan finansman giderleri hangi yılın kâr veya zarar tutarının tespitinde dikkate alınıyorsa, o yılda gider indirimi kısıtlamasına konu edilecektir.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Gelir tablosunda yer alan doğrudan finansman giderleri kısıtlamaya tabi olacaktır. Bu giderler içinden yatırım maliyetine aktarılan tutar olursa, aktarılan tutar gider kısıtlamasına tabi olmayacak, kalan tutar kısıtlamada dikkate alınacaktır.
                        </p>
                    </div>
                </CardContent>
            </Card>
            </div>
          </div>
        </div>
    );
}
