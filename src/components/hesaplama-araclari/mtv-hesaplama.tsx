"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Info,
    RotateCcw,
    Car,
    Loader2,
    Calculator,
} from "lucide-react";

// --- Tipler ---

interface DropdownListItem {
    val: number;
    label: string;
    minValue: string;
    maxValue: string;
}

interface TasitDegeriGroup {
    name: string;
    label: string;
    list: DropdownListItem[] | null;
    tooltip: string | null;
    ilkIktisap: number;
    visible: boolean;
}

interface MotorSilindirHacmiItem extends DropdownListItem {
    tasitDegeriList?: TasitDegeriGroup[];
}

interface DropdownField {
    name: string;
    label: string;
    list: DropdownListItem[];
    tooltip: string | null;
    ilkIktisap?: number;
    visible: boolean;
}

interface AracTipi {
    aracTipiKod: string;
    aracTipi: string;
    aracTipiStr: string;
    aracYasi: DropdownField;
    motorSilindirHacmi: {
        name: string;
        label: string;
        list: MotorSilindirHacmiItem[];
        tooltip: string | null;
        visible: boolean;
    };
    ilkIktisabi?: DropdownField;
    koltukSayisi?: DropdownField;
    azamiToplamAgirlikBilgisi?: DropdownField;
    azamiKalkisAgirligi?: DropdownField;
}

// Türkçe para formatı
const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

// --- Component ---

export function MtvHesaplama() {
    // Dropdown verileri
    const [aracTipleri, setAracTipleri] = useState<AracTipi[]>([]);
    const [dropdownLoading, setDropdownLoading] = useState(true);
    const [dropdownError, setDropdownError] = useState<string | null>(null);

    // Form state
    const [selectedAracTipiKod, setSelectedAracTipiKod] = useState<string>("");
    const [selectedAracYasi, setSelectedAracYasi] = useState<string>("");
    const [selectedMotorHacmi, setSelectedMotorHacmi] = useState<string>("");
    const [selectedIlkIktisap, setSelectedIlkIktisap] = useState<string>("");
    const [selectedTasitDegeri, setSelectedTasitDegeri] = useState<string>("");
    const [selectedKoltukSayisi, setSelectedKoltukSayisi] = useState<string>("");
    const [selectedAzamiToplamAgirlik, setSelectedAzamiToplamAgirlik] = useState<string>("");
    const [selectedAzamiKalkisAgirlik, setSelectedAzamiKalkisAgirlik] = useState<string>("");

    // Sonuç
    const [result, setResult] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dropdown verilerini GİB'den çek
    useEffect(() => {
        let cancelled = false;
        async function fetchDropdown() {
            try {
                setDropdownLoading(true);
                setDropdownError(null);
                const res = await fetch("/api/hesaplamalar/mtv");
                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || "Veriler yüklenirken hata oluştu.");
                }
                const data = await res.json();
                if (!cancelled && data.aracTipleri) {
                    setAracTipleri(data.aracTipleri);
                }
            } catch (err) {
                if (!cancelled) {
                    setDropdownError(
                        err instanceof Error ? err.message : "Veriler yüklenemedi."
                    );
                }
            } finally {
                if (!cancelled) setDropdownLoading(false);
            }
        }
        fetchDropdown();
        return () => { cancelled = true; };
    }, []);

    // Seçili araç tipi objesi
    const selectedAracTipi = useMemo(
        () => aracTipleri.find((a) => a.aracTipiKod === selectedAracTipiKod) ?? null,
        [aracTipleri, selectedAracTipiKod]
    );

    // Hangi ek alanlar gösterilecek?
    const showMotorHacmi = useMemo(
        () => selectedAracTipi?.motorSilindirHacmi?.visible ?? false,
        [selectedAracTipi]
    );
    const showIlkIktisap = useMemo(
        () => selectedAracTipi?.ilkIktisabi?.visible ?? false,
        [selectedAracTipi]
    );
    const showKoltukSayisi = useMemo(
        () => selectedAracTipi?.koltukSayisi?.visible ?? false,
        [selectedAracTipi]
    );
    const showAzamiToplamAgirlik = useMemo(
        () => selectedAracTipi?.azamiToplamAgirlikBilgisi?.visible ?? false,
        [selectedAracTipi]
    );
    const showAzamiKalkisAgirlik = useMemo(
        () => selectedAracTipi?.azamiKalkisAgirligi?.visible ?? false,
        [selectedAracTipi]
    );

    // Motor hacmi label'ı (kW veya cm³)
    const motorHacmiLabel = useMemo(() => {
        if (!selectedAracTipi?.motorSilindirHacmi) return "Motor Silindir Hacmi";
        return selectedAracTipi.motorSilindirHacmi.label || "Motor Silindir Hacmi";
    }, [selectedAracTipi]);

    // İlk iktisap seçimine göre taşıt değeri listesi
    const tasitDegeriOptions = useMemo(() => {
        if (!showIlkIktisap || !selectedMotorHacmi || !selectedIlkIktisap) return [];

        const motorItem = selectedAracTipi?.motorSilindirHacmi.list.find(
            (m) => String(m.val) === selectedMotorHacmi
        );
        if (!motorItem?.tasitDegeriList) return [];

        const ilkIktisapVal = parseInt(selectedIlkIktisap, 10);
        const tdGroup = motorItem.tasitDegeriList.find(
            (td) => td.visible && td.ilkIktisap === ilkIktisapVal
        );

        return tdGroup?.list ?? [];
    }, [showIlkIktisap, selectedMotorHacmi, selectedIlkIktisap, selectedAracTipi]);

    const showTasitDegeri = tasitDegeriOptions.length > 0;

    // Form geçerli mi?
    const isFormValid = useMemo(() => {
        if (!selectedAracTipiKod || !selectedAracYasi) return false;
        if (showMotorHacmi && !selectedMotorHacmi) return false;
        if (showIlkIktisap && !selectedIlkIktisap) return false;
        if (showTasitDegeri && !selectedTasitDegeri) return false;
        if (showKoltukSayisi && !selectedKoltukSayisi) return false;
        if (showAzamiToplamAgirlik && !selectedAzamiToplamAgirlik) return false;
        if (showAzamiKalkisAgirlik && !selectedAzamiKalkisAgirlik) return false;
        return true;
    }, [
        selectedAracTipiKod, selectedAracYasi,
        showMotorHacmi, selectedMotorHacmi,
        showIlkIktisap, selectedIlkIktisap,
        showTasitDegeri, selectedTasitDegeri,
        showKoltukSayisi, selectedKoltukSayisi,
        showAzamiToplamAgirlik, selectedAzamiToplamAgirlik,
        showAzamiKalkisAgirlik, selectedAzamiKalkisAgirlik,
    ]);

    const hasInput = selectedAracTipiKod !== "";

    // Araç tipi değişince diğer alanları sıfırla
    const handleAracTipiChange = useCallback((val: string) => {
        setSelectedAracTipiKod(val);
        setSelectedAracYasi("");
        setSelectedMotorHacmi("");
        setSelectedIlkIktisap("");
        setSelectedTasitDegeri("");
        setSelectedKoltukSayisi("");
        setSelectedAzamiToplamAgirlik("");
        setSelectedAzamiKalkisAgirlik("");
        setResult(null);
        setError(null);
    }, []);

    const handleAracYasiChange = useCallback((val: string) => {
        setSelectedAracYasi(val);
        setResult(null);
    }, []);

    const handleMotorHacmiChange = useCallback((val: string) => {
        setSelectedMotorHacmi(val);
        setSelectedTasitDegeri("");
        setResult(null);
    }, []);

    const handleIlkIktisapChange = useCallback((val: string) => {
        setSelectedIlkIktisap(val);
        setSelectedTasitDegeri("");
        setResult(null);
    }, []);

    const handleTasitDegeriChange = useCallback((val: string) => {
        setSelectedTasitDegeri(val);
        setResult(null);
    }, []);

    const handleKoltukSayisiChange = useCallback((val: string) => {
        setSelectedKoltukSayisi(val);
        setResult(null);
    }, []);

    const handleAzamiToplamAgirlikChange = useCallback((val: string) => {
        setSelectedAzamiToplamAgirlik(val);
        setResult(null);
    }, []);

    const handleAzamiKalkisAgirlikChange = useCallback((val: string) => {
        setSelectedAzamiKalkisAgirlik(val);
        setResult(null);
    }, []);

    // Sıfırla
    const handleReset = useCallback(() => {
        setSelectedAracTipiKod("");
        setSelectedAracYasi("");
        setSelectedMotorHacmi("");
        setSelectedIlkIktisap("");
        setSelectedTasitDegeri("");
        setSelectedKoltukSayisi("");
        setSelectedAzamiToplamAgirlik("");
        setSelectedAzamiKalkisAgirlik("");
        setResult(null);
        setError(null);
    }, []);

    // Hesapla
    const handleHesapla = useCallback(async () => {
        if (!isFormValid || !selectedAracTipi) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // aracYasi: dropdown'dan maxValue gönderilir
            const aracYasiItem = selectedAracTipi.aracYasi.list.find(
                (item) => String(item.val) === selectedAracYasi
            );

            // motorSilindirHacmi: dropdown'dan minValue gönderilir
            const motorItem = showMotorHacmi
                ? selectedAracTipi.motorSilindirHacmi.list.find(
                      (item) => String(item.val) === selectedMotorHacmi
                  )
                : null;

            // ilkIktisabi: val.toString() gönderilir
            const ilkIktisapItem = showIlkIktisap
                ? selectedAracTipi.ilkIktisabi?.list.find(
                      (item) => String(item.val) === selectedIlkIktisap
                  )
                : null;

            // tasitDegeri: minValue ve maxValue gönderilir
            let tasitDegeriAltLimit = "0.00";
            let tasitDegeriUstLimit = "0.00";
            if (showTasitDegeri && selectedTasitDegeri) {
                const tdItem = tasitDegeriOptions.find(
                    (item) => String(item.val) === selectedTasitDegeri
                );
                if (tdItem) {
                    tasitDegeriAltLimit = tdItem.minValue;
                    tasitDegeriUstLimit = tdItem.maxValue;
                }
            }

            // koltukSayisi → oturmaYeri: minValue gönderilir
            const koltukItem = showKoltukSayisi
                ? selectedAracTipi.koltukSayisi?.list.find(
                      (item) => String(item.val) === selectedKoltukSayisi
                  )
                : null;

            // azamiToplamAgirlik: minValue gönderilir
            const azamiToplamItem = showAzamiToplamAgirlik
                ? selectedAracTipi.azamiToplamAgirlikBilgisi?.list.find(
                      (item) => String(item.val) === selectedAzamiToplamAgirlik
                  )
                : null;

            // azamiKalkisAgirlik: minValue gönderilir
            const azamiKalkisItem = showAzamiKalkisAgirlik
                ? selectedAracTipi.azamiKalkisAgirligi?.list.find(
                      (item) => String(item.val) === selectedAzamiKalkisAgirlik
                  )
                : null;

            // İlk iktisap yılı belirle
            let ilkIktisabi = "";
            if (ilkIktisapItem) {
                ilkIktisabi = String(ilkIktisapItem.val);
            } else {
                // İlk iktisap dropdown'ı yoksa güncel yılı gönder
                ilkIktisabi = new Date().getFullYear().toString();
            }

            const requestBody = {
                aracTipiKod: selectedAracTipiKod,
                ilkIktisabi,
                aracYasi: aracYasiItem?.maxValue ?? "",
                motorSilindirHacmi: motorItem?.minValue ?? "",
                tasitDegeriAltLimit,
                tasitDegeriUstLimit,
                oturmaYeri: koltukItem?.minValue ?? "",
                azamiToplamAgirlik: azamiToplamItem?.minValue ?? "",
                azamiKalkisAgirlik: azamiKalkisItem?.minValue ?? "",
            };

            const response = await fetch("/api/hesaplamalar/mtv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "GİB servisi şu anda yanıt vermiyor.");
            }

            const data = await response.json();

            if (data.tutar !== undefined) {
                setResult(parseFloat(String(data.tutar)));
            } else {
                throw new Error("Beklenmeyen yanıt formatı.");
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Hesaplama sırasında bir hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    }, [
        isFormValid, selectedAracTipi, selectedAracTipiKod,
        selectedAracYasi, showMotorHacmi, selectedMotorHacmi,
        showIlkIktisap, selectedIlkIktisap,
        showTasitDegeri, selectedTasitDegeri, tasitDegeriOptions,
        showKoltukSayisi, selectedKoltukSayisi,
        showAzamiToplamAgirlik, selectedAzamiToplamAgirlik,
        showAzamiKalkisAgirlik, selectedAzamiKalkisAgirlik,
    ]);

    // Loading durumu
    if (dropdownLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Veriler yükleniyor...</span>
            </div>
        );
    }

    // Dropdown yükleme hatası
    if (dropdownError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Veri Yükleme Hatası</AlertTitle>
                <AlertDescription>{dropdownError}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col h-full p-1">
            <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
                {/* Başlık */}
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Car className="h-6 w-6 text-primary" />
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                MTV Hesaplama
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                GİB üzerinden motorlu taşıtlar vergisi hesaplayın
                            </p>
                        </div>
                    </div>
                    {(hasInput || result !== null) && (
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Sıfırla
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sol: Giriş ve Sonuç */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Giriş Formu */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Araç Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* 1. Araç Tipi - Her zaman aktif, tam genişlik */}
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Araç Tipi
                                    </label>
                                    <Select value={selectedAracTipiKod} onValueChange={handleAracTipiChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Araç tipi seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {aracTipleri.map((at) => (
                                                <SelectItem key={at.aracTipiKod} value={at.aracTipiKod}>
                                                    {at.aracTipiStr}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 2. Araç Yaşı - Her zaman görünür, araç tipi seçilmeden disabled */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Aracın Yaşı
                                    </label>
                                    <Select
                                        value={selectedAracYasi}
                                        onValueChange={handleAracYasiChange}
                                        disabled={!selectedAracTipiKod}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={!selectedAracTipiKod ? "Önce araç tipi seçiniz" : "Araç yaşı seçiniz"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedAracTipi?.aracYasi.list.map((item) => (
                                                <SelectItem key={item.val} value={String(item.val)}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 3. Motor Silindir Hacmi / kW - Araç tipine bağlı */}
                                {showMotorHacmi && selectedAracTipi && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            {motorHacmiLabel}
                                        </label>
                                        <Select value={selectedMotorHacmi} onValueChange={handleMotorHacmiChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedAracTipi.motorSilindirHacmi.list.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* 4. İlk Tescil (İktisap) Yılı */}
                                {showIlkIktisap && selectedAracTipi?.ilkIktisabi && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            İlk Tescil Yılı
                                        </label>
                                        <Select value={selectedIlkIktisap} onValueChange={handleIlkIktisapChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedAracTipi.ilkIktisabi.list.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* 5. Taşıt Değeri */}
                                {showTasitDegeri && (
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Taşıt Değeri (İlk Tescildeki Satın Alma Değeri)
                                        </label>
                                        <Select value={selectedTasitDegeri} onValueChange={handleTasitDegeriChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Taşıt değeri aralığını seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tasitDegeriOptions.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* 6. Koltuk Sayısı */}
                                {showKoltukSayisi && selectedAracTipi?.koltukSayisi && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            {selectedAracTipi.koltukSayisi.label}
                                        </label>
                                        <Select value={selectedKoltukSayisi} onValueChange={handleKoltukSayisiChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedAracTipi.koltukSayisi.list.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* 7. Azami Toplam Ağırlık */}
                                {showAzamiToplamAgirlik && selectedAracTipi?.azamiToplamAgirlikBilgisi && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            {selectedAracTipi.azamiToplamAgirlikBilgisi.label}
                                        </label>
                                        <Select value={selectedAzamiToplamAgirlik} onValueChange={handleAzamiToplamAgirlikChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedAracTipi.azamiToplamAgirlikBilgisi.list.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* 8. Azami Kalkış Ağırlığı */}
                                {showAzamiKalkisAgirlik && selectedAracTipi?.azamiKalkisAgirligi && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            {selectedAracTipi.azamiKalkisAgirligi.label}
                                        </label>
                                        <Select value={selectedAzamiKalkisAgirlik} onValueChange={handleAzamiKalkisAgirlikChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Seçiniz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedAracTipi.azamiKalkisAgirligi.list.map((item) => (
                                                    <SelectItem key={item.val} value={String(item.val)}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Hesapla Butonu */}
                            <div className="flex justify-end mt-6">
                                <Button
                                    variant="default"
                                    onClick={handleHesapla}
                                    disabled={loading || !isFormValid}
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

                    {/* Sonuç */}
                    {result !== null && (
                        <div className="space-y-4">
                            {/* Yıllık Toplam */}
                            <Card className="border-primary/30 bg-primary/5">
                                <CardContent className="pt-6">
                                    <div className="text-center space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Yıllık MTV Tutarı
                                        </p>
                                        <p className="text-3xl font-bold text-primary tabular-nums">
                                            {currencyFormatter.format(result)} TL
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Taksitler */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card>
                                    <CardContent className="pt-4 pb-4">
                                        <div className="text-center space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                1. Taksit (Ocak)
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {currencyFormatter.format(result / 2)} TL
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 pb-4">
                                        <div className="text-center space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                2. Taksit (Temmuz)
                                            </p>
                                            <p className="text-lg font-semibold tabular-nums">
                                                {currencyFormatter.format(result / 2)} TL
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Boş durum */}
                    {result === null && !error && (
                        <div className="rounded-xl border border-dashed py-12 text-center">
                            <Car className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                MTV tutarını hesaplamak için yukarıdaki alanları doldurup
                                &quot;Hesapla&quot; butonuna tıklayınız
                            </p>
                        </div>
                    )}
                </div>

                {/* Sağ: Bilgi Alanı */}
                <div className="flex flex-col gap-4">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>MTV Hakkında</AlertTitle>
                        <AlertDescription>
                            Motorlu Taşıtlar Vergisi (MTV), Türkiye&apos;de kayıt ve tescil
                            edilmiş motorlu kara, hava ve deniz taşıtlarından alınan
                            yıllık bir vergidir. Hesaplama doğrudan GİB (Gelir İdaresi
                            Başkanlığı) üzerinden yapılmaktadır.
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Ödeme Takvimi</AlertTitle>
                        <AlertDescription>
                            MTV iki eşit taksitte ödenir:
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li>
                                    <strong>1. Taksit:</strong> Ocak ayı sonuna kadar
                                </li>
                                <li>
                                    <strong>2. Taksit:</strong> Temmuz ayı sonuna kadar
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Nasıl Kullanılır?</AlertTitle>
                        <AlertDescription>
                            <ol className="list-decimal list-inside space-y-1 mt-1">
                                <li>Araç tipini seçin</li>
                                <li>Aracın yaşını belirleyin</li>
                                <li>İlgili teknik bilgileri girin</li>
                                <li>&quot;Hesapla&quot; butonuna tıklayın</li>
                            </ol>
                            <p className="mt-2 text-xs">
                                Araç yaşı, ilk tescil yılından itibaren geçen
                                yıl sayısıdır. Tüm veriler GİB&apos;in resmi
                                hesaplama servisi üzerinden alınmaktadır.
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
                                <p className="font-medium mb-0.5">Araç Yaşı</p>
                                <p className="text-muted-foreground">
                                    Araç yaşı, taşıtın model yılından itibaren
                                    hesaplanır. Model yılı ile içinde bulunulan
                                    yıl arasındaki farktır.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Taşıt Değeri</p>
                                <p className="text-muted-foreground">
                                    2018 ve sonrası model otomobiller için aracın
                                    ilk tescilindeki satın alma değeri MTV
                                    hesaplamasını etkiler.
                                </p>
                            </div>
                            <div>
                                <p className="font-medium mb-0.5">Kaynak</p>
                                <p className="text-muted-foreground">
                                    Hesaplama doğrudan GİB (Gelir İdaresi
                                    Başkanlığı) üzerinden yapılmaktadır.
                                    Sonuçlar güncel vergi tarifelerine göre
                                    hesaplanır.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
                </div>
            </div>
        </div>
    );
}
