"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ClipboardCheck,
    RefreshCw,
    Settings,
    Loader2,
    Search,
    Download,
    Check,
    ChevronDown,
    ChevronUp,
    Trash2,
    AlertTriangle,
    ArrowUpDown,
    GripVertical,
    Pencil,
    UserPlus,
    FolderOpen
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { useTerminal } from "@/context/terminal-context";
import { useBotResult } from "@/context/bot-result-context";
import { toTitleCase } from "@/lib/utils/text";
import { GibBotResult } from "@/types/gib";
import { BotReportModal } from "./bot-report-modal";
import { useBotConnection } from "./hooks/use-bot-connection";


type SyncStatus = "idle" | "running" | "success" | "error";

// Beyanname durum tipleri
type DeclarationStatus = "bos" | "verildi" | "muaf" | "3aylik";

interface BeyannameData {
    beyannameTuru: string;
    tcVkn: string;
    adSoyadUnvan: string;
    vergiDairesi: string;
    vergilendirmeDonemi: string;
}

interface Customer {
    id: string;
    unvan: string;
    sirketTipi: string;
    vknTckn: string;
    siraNo?: string | null;
    sortOrder?: number;
    verilmeyecekBeyannameler?: string[]; // Kalıcı olarak verilmeyecek beyanname türleri
}

// Beyanname türü interface
interface BeyannameTuru {
    id: string;
    kod: string;
    aciklama: string;
    kisaAd: string | null;
    kategori: string | null;
    aktif: boolean;
    siraNo: number;
}

export function KontrolClient() {
    const terminal = useTerminal();
    const { consumeResult } = useBotResult();
    // NOT: syncStatus artık useBotConnection hook'undan geliyor (duplicate state kaldırıldı)
    const [beyannameler, setBeyannameler] = useState<BeyannameData[]>([]);
    const [showSettings, setShowSettings] = useState(false);

    // Bot Rapor Modalı
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportData, setReportData] = useState<GibBotResult | null>(null);



    // Date range - default to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [startDate, setStartDate] = useState(firstDay.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(lastDay.toISOString().split("T")[0]);

    // Vergilendirme Dönemi - default to current month/year
    const [usePeriodFilter, setUsePeriodFilter] = useState(true);
    const [donemBasAy, setDonemBasAy] = useState(now.getMonth() + 1);
    const [donemBasYil, setDonemBasYil] = useState(now.getFullYear());
    const [donemBitAy, setDonemBitAy] = useState(now.getMonth() + 1);
    const [donemBitYil, setDonemBitYil] = useState(now.getFullYear());

    // PDF İndirme Seçeneği
    const [shouldDownloadFiles, setShouldDownloadFiles] = useState(true);

    // Check bot availability on mount
    const [botInfo, setBotInfo] = useState<{ hasCredentials: boolean; hasCaptchaKey: boolean; lastSync: string | null }>({
        hasCredentials: false,
        hasCaptchaKey: false,
        lastSync: null,
    });

    // Takip Çizelgesi State'leri
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sirketTipiFilter, setSirketTipiFilter] = useState<string>("all");
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    // Sıralama state'leri
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // Dinamik beyanname türleri
    const [beyannameTurleri, setBeyannameTurleri] = useState<BeyannameTuru[]>([]);
    const [turlerLoading, setTurlerLoading] = useState(true);

    // Beyanname durumları (DB'den yüklenir) - Dinamik JSON yapı
    // Format: { customerId: { "KDV1": { status: "verildi", meta: {...} }, ... } }
    const [beyannameStatuses, setBeyannameStatuses] = useState<Record<string, Record<string, any>>>({});
    const [takipLoading, setTakipLoading] = useState(false);

    // Eşleştirilemeyen beyannameler
    const [unmatchedDeclarations, setUnmatchedDeclarations] = useState<BeyannameData[]>([]);

    // Takip verilerini yeniden yükle - declare early for use in hook
    const fetchTakipDataRef = useCallback(async () => {
        setTakipLoading(true);
        try {
            const res = await fetch(`/api/beyanname-takip?year=${selectedYear}&month=${selectedMonth}`);
            if (res.ok) {
                const data = await res.json();
                const statusMap: Record<string, Record<string, any>> = {};
                for (const item of data) {
                    statusMap[item.customerId] = item.beyannameler || {};
                }
                setBeyannameStatuses(statusMap);
            }
        } catch (error) {
            console.error("Error fetching takip data:", error);
        } finally {
            setTakipLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    // WebSocket bağlantısı - Electron Bot ile iletişim
    // Hook'tan syncStatus ve setSyncStatus alınıyor (component state yerine)
    const { syncStatus, setSyncStatus } = useBotConnection({
        onComplete: async (data) => {
            // Hook zaten terminal log, setLoading, autoClose yapıyor
            if (data.beyannameler) {
                setBeyannameler(data.beyannameler as BeyannameData[]);

                // Başarılı beyannameleri otomatik "verildi" olarak işaretle
                const successfulBeyannameler = data.beyannameler.filter(b => b.success === true);

                if (successfulBeyannameler.length > 0) {
                    // Müşteri listesini al (güncel state)
                    const customersRes = await fetch("/api/customers");
                    const customersList = customersRes.ok ? await customersRes.json() : [];

                    // Her başarılı beyanname için takip tablosunu güncelle
                    for (const beyanname of successfulBeyannameler) {
                        const customer = customersList.find((c: { vknTckn: string }) => c.vknTckn === beyanname.tcVkn);
                        if (customer && beyanname.beyannameTuru && beyanname.vergilendirmeDonemi) {
                            try {
                                // vergilendirmeDonemi'nden yıl ve ay'ı parse et
                                // Format: "2025/11" veya "202511" veya "2025-11"
                                const donemStr = beyanname.vergilendirmeDonemi.replace(/[^0-9]/g, '');
                                let donemYear: number, donemMonth: number;

                                if (donemStr.length >= 6) {
                                    // "202511" -> year=2025, month=11
                                    donemYear = parseInt(donemStr.substring(0, 4), 10);
                                    donemMonth = parseInt(donemStr.substring(4, 6), 10);
                                } else {
                                    // Fallback: UI'da seçili dönem
                                    donemYear = selectedYear;
                                    donemMonth = selectedMonth;
                                }

                                if (donemYear && donemMonth) {
                                    await fetch("/api/beyanname-takip", {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            customerId: customer.id,
                                            year: donemYear,
                                            month: donemMonth,
                                            kod: beyanname.beyannameTuru,
                                            status: "verildi"
                                        })
                                    });
                                    console.log(`✅ Takip güncellendi: ${beyanname.tcVkn} - ${beyanname.beyannameTuru} (${donemYear}/${donemMonth})`);
                                }
                            } catch (err) {
                                console.error(`Takip güncelleme hatası (${beyanname.tcVkn}):`, err);
                            }
                        }
                    }
                }
            }

            setReportData(data);
            setReportModalOpen(true);
            fetchTakipDataRef();
            // Yönlendirme GlobalBotListener tarafından yapılıyor
        },
        onError: () => {
            // Hook zaten syncStatus="error", terminal log ve autoClose yapıyor
        },
        onBeyannamelerUpdate: (data) => {
            setBeyannameler(data as BeyannameData[]);
        },
        onUnmatchedUpdate: (data) => {
            setUnmatchedDeclarations(data as BeyannameData[]);
        }
    });

    // Mount'ta bekleyen bot sonucu var mı kontrol et
    useEffect(() => {
        const pending = consumeResult();
        if (pending) {
            setReportData(pending);
            setReportModalOpen(true);
            fetchTakipDataRef();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Sadece mount'ta çalış

    // Inline düzenleme state'leri
    const [editingSiraNo, setEditingSiraNo] = useState<string | null>(null);
    const [editingSiraNoValue, setEditingSiraNoValue] = useState("");
    const [editingUnvan, setEditingUnvan] = useState<string | null>(null);
    const [editingUnvanValue, setEditingUnvanValue] = useState("");

    // Drag & Drop state'leri
    const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);
    const [dragOverCustomerId, setDragOverCustomerId] = useState<string | null>(null);

    // Mükellef ekleme modal state'leri
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        unvan: "",
        vknTckn: "",
        sirketTipi: "firma"
    });
    const [addingCustomer, setAddingCustomer] = useState(false);

    // Seçili mükellef (silme için)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Beyanname türlerini yükle
    const fetchBeyannameTurleri = useCallback(async () => {
        setTurlerLoading(true);
        try {
            const res = await fetch("/api/beyanname-turleri");
            if (res.ok) {
                const data = await res.json();
                // Sadece aktif olanları al ve sırala
                const aktifTurler = data.filter((t: BeyannameTuru) => t.aktif).sort((a: BeyannameTuru, b: BeyannameTuru) => a.siraNo - b.siraNo);
                setBeyannameTurleri(aktifTurler);
            }
        } catch (error) {
            console.error("Error fetching beyanname türleri:", error);
        } finally {
            setTurlerLoading(false);
        }
    }, []);

    // Beyanname takip verilerini yükle
    const fetchTakipData = useCallback(async () => {
        setTakipLoading(true);
        try {
            const res = await fetch(`/api/beyanname-takip?year=${selectedYear}&month=${selectedMonth}`);
            if (res.ok) {
                const data = await res.json();
                setBeyannameStatuses(data);
            }
        } catch (error) {
            console.error("Error fetching takip data:", error);
        } finally {
            setTakipLoading(false);
        }
    }, [selectedYear, selectedMonth]);


    // GİB Ayarları State
    const [gibSettings, setGibSettings] = useState({
        gibCode: "",
        gibPassword: "",
        gibParola: "",
        captchaKey: "",
        hasGibPassword: false,
        hasGibParola: false
    });
    const [savingSettings, setSavingSettings] = useState(false);

    // GİB Ayarlarını yükle
    const fetchGibSettings = async () => {
        try {
            const res = await fetch("/api/settings/gib");
            if (res.ok) {
                const data = await res.json();
                setGibSettings(prev => ({
                    ...prev,
                    gibCode: data.gibCode || "",
                    captchaKey: data.captchaKey || "",
                    hasGibPassword: data.hasGibPassword,
                    hasGibParola: data.hasGibParola,
                    // Şifre alanlarını boş bırak, kullanıcı yeni girebilir
                    gibPassword: "",
                    gibParola: ""
                }));
            }
        } catch (error) {
            console.error("Error fetching GIB settings:", error);
        }
    };

    // GİB Ayarlarını kaydet
    const saveGibSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/settings/gib", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gibCode: gibSettings.gibCode,
                    gibPassword: gibSettings.gibPassword, // Boş ise server güncellemeyecek
                    gibParola: gibSettings.gibParola, // Boş ise server güncellemeyecek
                    captchaKey: gibSettings.captchaKey
                })
            });

            if (res.ok) {
                toast.success("GİB ayarları başarıyla kaydedildi!");
                fetchGibSettings(); // Yenile
                // Bot bilgisini de yenile
                fetch("/api/gib/sync")
                    .then(r => r.json())
                    .then(d => setBotInfo(d));
            } else {
                toast.error("Ayarlar kaydedilemedi.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Bir hata oluştu.");
        } finally {
            setSavingSettings(false);
        }
    };

    useEffect(() => {
        fetch("/api/gib/sync")
            .then(res => res.json())
            .then(data => setBotInfo(data))
            .catch(console.error);

        fetchCustomers();
        fetchGibSettings(); // Ayarları yükle
        fetchBeyannameTurleri(); // Beyanname türlerini yükle
    }, []);

    // Dönem değiştiğinde takip verilerini yeniden yükle
    useEffect(() => {
        fetchTakipData();
    }, [fetchTakipData]);

    const fetchCustomers = async () => {
        setCustomersLoading(true);
        try {
            const res = await fetch("/api/customers");
            if (!res.ok) throw new Error("Müşteriler yüklenemedi");
            const data = await res.json();
            setCustomers(data);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Müşteriler yüklenirken hata oluştu");
        } finally {
            setCustomersLoading(false);
        }
    };

    // Filtrelenmiş müşteriler
    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const matchesSearch = searchTerm === "" ||
                c.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.vknTckn.includes(searchTerm);

            const matchesTipi = sirketTipiFilter === "all" || c.sirketTipi === sirketTipiFilter;

            return matchesSearch && matchesTipi;
        });
    }, [customers, searchTerm, sirketTipiFilter]);

    // İstatistikler
    const stats = useMemo(() => {
        const firma = customers.filter(c => c.sirketTipi === "firma").length;
        const sahis = customers.filter(c => c.sirketTipi === "sahis").length;
        const basit = customers.filter(c => c.sirketTipi === "basit_usul").length;
        return { firma, sahis, basit, total: customers.length };
    }, [customers]);

    // Veri içeren aktif beyanname türlerini filtrele
    const activeBeyannameTurleri = useMemo(() => {
        // Tüm müşterilerin verilerini kontrol et
        const columnsWithData = new Set<string>();

        // Her müşteri için her beyanname türünü kontrol et
        for (const customerId of Object.keys(beyannameStatuses)) {
            const customerData = beyannameStatuses[customerId];
            if (customerData) {
                for (const [kod, data] of Object.entries(customerData)) {
                    // Eğer status "verildi" veya "bos" ise (muaf değilse) bu sütun aktif
                    if (data && (data.status === "verildi" || data.status === "bos")) {
                        columnsWithData.add(kod);
                    }
                }
            }
        }

        // Sadece veri içeren sütunları döndür
        if (columnsWithData.size === 0) {
            // Hiç veri yoksa tüm türleri göster
            return beyannameTurleri;
        }

        return beyannameTurleri.filter(tur => columnsWithData.has(tur.kod));
    }, [beyannameTurleri, beyannameStatuses]);

    // Sıralama önceliği: verildi (1) > bos (2) > muaf (3)
    const getStatusPriority = (status: string): number => {
        switch (status) {
            case "verildi": return 1;
            case "bos": return 2;
            case "3aylik": return 2;
            case "muaf": return 3;
            default: return 3;
        }
    };

    // Sıralanmış müşteriler - varsayılan: siraNo'ya göre küçükten büyüğe
    const sortedCustomers = useMemo(() => {
        // Önce siraNo'ya göre sırala (varsayılan)
        const byDefault = [...filteredCustomers].sort((a, b) => {
            const aNum = a.siraNo ? parseInt(a.siraNo) : 9999;
            const bNum = b.siraNo ? parseInt(b.siraNo) : 9999;
            return aNum - bNum;
        });

        if (!sortColumn) {
            return byDefault;
        }

        // Beyanname sütununa göre sıralama
        return byDefault.sort((a, b) => {
            const aData = beyannameStatuses[a.id]?.[sortColumn];
            const bData = beyannameStatuses[b.id]?.[sortColumn];
            const aStatus = aData?.status || "muaf";
            const bStatus = bData?.status || "muaf";

            const aPriority = getStatusPriority(aStatus);
            const bPriority = getStatusPriority(bStatus);

            // asc: verildi üstte, desc: muaf üstte
            if (sortDirection === "asc") {
                return aPriority - bPriority;
            } else {
                return bPriority - aPriority;
            }
        });
    }, [filteredCustomers, beyannameStatuses, sortColumn, sortDirection]);

    // Sütun başlığına tıklama
    const handleColumnSort = (kod: string) => {
        if (sortColumn === kod) {
            // Aynı sütuna tekrar tıklandı, yönü değiştir veya sıralamayı kaldır
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else {
                setSortColumn(null); // Sıralamayı kaldır
            }
        } else {
            setSortColumn(kod);
            setSortDirection("asc"); // Varsayılan: verildi üstte
        }
    };

    const aylar = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    // Listeyi temizle fonksiyonu
    const handleClearList = async () => {
        if (!confirm(`${selectedYear} ${aylar[selectedMonth - 1]} dönemi için tüm beyanname takip kayıtları kalıcı olarak silinecek. Devam etmek istiyor musunuz?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/beyanname-takip?year=${selectedYear}&month=${selectedMonth}`, {
                method: "DELETE"
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(data.message || "Liste temizlendi");
                setBeyannameStatuses({});
                fetchTakipData();
            } else {
                toast.error(data.error || "Liste temizlenirken hata oluştu");
            }
        } catch (error) {
            toast.error("Liste temizlenirken hata oluştu");
        }
    };

    const handleReportClose = () => {
        setReportModalOpen(false);
        // Otomatik olarak bir önceki aya git
        const start = new Date(startDate);
        const prevMonthDate = new Date(start);
        prevMonthDate.setDate(1); // 31-30 gün farkından etkilenmemesi için aya başla
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);

        setSelectedYear(prevMonthDate.getFullYear());
        setSelectedMonth(prevMonthDate.getMonth() + 1);

        // Verileri tazelemek için otomatik tetikleme useEffect tarafından yapılacak
    };



    const handleSync = async () => {
        // Validate 1 month range before starting
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.abs((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 31) {
            toast.error("Tarih aralığı en fazla 1 ay olabilir! Lütfen tarihleri düzeltin.");
            return;
        }

        setSyncStatus("running");
        setBeyannameler([]);

        terminal.showTerminal("SMMM-ASİSTAN BOT");

        try {
            const response = await fetch("/api/gib/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    ...(usePeriodFilter && { donemBasAy, donemBasYil, donemBitAy, donemBitYil }),
                    downloadFiles: shouldDownloadFiles
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Bağlantı hatası");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("Stream okunamadı");
            }

            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.error) {
                                terminal.addLog(`❌ Hata: ${data.error}`, 100);
                                terminal.setLoading(false);
                                terminal.autoClose(5000);
                                setSyncStatus("error");
                                return;
                            } else if (data.delegated) {
                                // Bot Electron'a devredildi - WebSocket'ten dinlemeye devam
                                // SSE'yi kes, WebSocket devam edecek
                                return;
                            } else if (data.complete) {
                                // Completion data received (eski uyumluluk için)
                                if (data.stats) {
                                    terminal.addLog(`📊 Toplam: ${data.stats.total || 0} | İndirilen: ${data.stats.downloaded || 0} | Atlanan: ${data.stats.skipped || 0}`, 100);
                                    terminal.addLog(`⏱️ Süre: ${data.stats.duration || 0} saniye`, 100);
                                }
                                if (data.beyannameler) {
                                    setBeyannameler(data.beyannameler);
                                }
                                if (data.unmatchedBeyannameler) {
                                    setUnmatchedDeclarations(data.unmatchedBeyannameler);
                                }
                                setSyncStatus("success");
                                terminal.setLoading(false);
                                terminal.autoClose(3000);

                                setReportData(data as GibBotResult);
                                setReportModalOpen(true);
                                fetchTakipData();
                            } else {
                                // Regular progress update
                                terminal.addLog(data.message, data.percent);
                                terminal.setProgress(data.percent);
                            }
                        } catch (e) {
                            console.error("Failed to parse SSE data:", e);
                        }
                    }
                }
            }
        } catch (error) {
            terminal.addLog(`❌ Hata: ${(error as Error).message}`, 100);
            setSyncStatus("error");
            terminal.setLoading(false);
            terminal.autoClose(5000);
        }
    };

    // Beyanname durumunu kaydet - Dinamik JSON yapı
    const saveStatus = useCallback(async (customerId: string, kod: string, status: string) => {
        try {
            await fetch("/api/beyanname-takip", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    year: selectedYear,
                    month: selectedMonth,
                    kod,
                    status
                })
            });
        } catch (error) {
            console.error("Error saving status:", error);
            toast.error("Kayıt sırasında hata oluştu");
        }
    }, [selectedYear, selectedMonth]);

    // Beyanname durumu değiştirme - sol tık
    const handleLeftClick = useCallback((customerId: string, kod: string, currentStatus: string) => {
        // muaf ve 3aylik kilitli
        if (currentStatus === "muaf" || currentStatus === "3aylik") return;

        const nextStatus = currentStatus === "verildi" ? "bos" : "verildi";

        // Optimistic update - Dinamik JSON yapı
        setBeyannameStatuses(prev => ({
            ...prev,
            [customerId]: {
                ...(prev[customerId] || {}),
                [kod]: {
                    ...(prev[customerId]?.[kod] || {}), // Meta verisini koru
                    status: nextStatus
                }
            }
        }));

        // DB'ye kaydet
        saveStatus(customerId, kod, nextStatus);
    }, [saveStatus]);

    // Sağ tık - bos/beyaz <-> muaf/siyah toggle (muaf kalıcı - tüm dönemlerde geçerli)
    // Optimistic Update: Önce UI'yi anında güncelle, sonra API çağrısı yap
    const handleRightClick = useCallback(async (e: React.MouseEvent, customerId: string, kod: string) => {
        e.preventDefault();

        // Müşterinin muaf listesini kontrol et
        const customer = customers.find(c => c.id === customerId);
        const currentList = customer?.verilmeyecekBeyannameler || [];
        const isMuaf = currentList.includes(kod);

        // Yeni listeyi hesapla
        const newList = isMuaf
            ? currentList.filter(item => item !== kod)
            : [...currentList, kod];

        // Optimistic Update: Önce UI'yi anında güncelle
        setCustomers(prev => prev.map(c => {
            if (c.id === customerId) {
                return { ...c, verilmeyecekBeyannameler: newList };
            }
            return c;
        }));

        // Arkada API çağrısı yap
        try {
            const response = await fetch(`/api/customers/${customerId}/verilmeyecek`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod, action: isMuaf ? 'remove' : 'add' })
            });

            if (!response.ok) {
                // Hata olursa geri al
                setCustomers(prev => prev.map(c => {
                    if (c.id === customerId) {
                        return { ...c, verilmeyecekBeyannameler: currentList };
                    }
                    return c;
                }));
                toast.error('Güncelleme başarısız');
            }
        } catch (error) {
            // Hata olursa geri al
            console.error('Muaf güncelleme hatası:', error);
            setCustomers(prev => prev.map(c => {
                if (c.id === customerId) {
                    return { ...c, verilmeyecekBeyannameler: currentList };
                }
                return c;
            }));
            toast.error('Güncelleme sırasında hata oluştu');
        }
    }, [customers]);

    const getStatus = (customerId: string, columnKey: string): DeclarationStatus => {
        return beyannameStatuses[customerId]?.[columnKey] || "bos";
    };

    // Meta verilerini al (tooltip için) - Dinamik JSON yapı
    const getMeta = (customerId: string, kod: string): { beyannameTuru?: string; yuklemeZamani?: string; unvan?: string; donem?: string; beyannamePath?: string; tahakkukPath?: string } | null => {
        const customerStatuses = beyannameStatuses[customerId];
        if (!customerStatuses) return null;
        const beyannameData = customerStatuses[kod];
        return beyannameData?.meta || null;
    };

    // ========== INLINE DÜZENLEME HANDLERLARI ==========

    // S.N. düzenlemeye başla
    const handleSiraNoClick = (customerId: string, currentValue: string | null) => {
        setEditingSiraNo(customerId);
        setEditingSiraNoValue(currentValue || "");
    };

    // S.N. kaydet - hızlı optimistic update
    const handleSiraNoSave = async (customerId: string) => {
        // Önce local state güncelle (anında görünür)
        setCustomers(prev => prev.map(c =>
            c.id === customerId ? { ...c, siraNo: editingSiraNoValue } : c
        ));
        setEditingSiraNo(null);

        // Sonra backend'e kaydet (arka planda)
        try {
            await fetch("/api/customers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: customerId,
                    field: "siraNo",
                    value: editingSiraNoValue
                })
            });
        } catch (error) {
            toast.error("Kaydetme başarısız");
        }
    };

    // Unvan düzenlemeye başla
    const handleUnvanClick = (customerId: string, currentValue: string) => {
        setEditingUnvan(customerId);
        setEditingUnvanValue(currentValue);
    };

    // Unvan kaydet
    const handleUnvanSave = async (customerId: string) => {
        if (!editingUnvanValue.trim()) {
            toast.error("Unvan boş olamaz");
            return;
        }

        try {
            await fetch("/api/customers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: customerId,
                    field: "unvan",
                    value: editingUnvanValue.trim()
                })
            });

            // Local state güncelle
            setCustomers(prev => prev.map(c =>
                c.id === customerId ? { ...c, unvan: toTitleCase(editingUnvanValue) } : c
            ));

            setEditingUnvan(null);
            toast.success("Unvan güncellendi");
        } catch (error) {
            toast.error("Güncelleme başarısız");
        }
    };

    // ========== DRAG & DROP HANDLERLARI ==========

    const handleDragStart = (e: React.DragEvent, customerId: string) => {
        setDraggedCustomerId(customerId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, customerId: string) => {
        e.preventDefault();
        if (draggedCustomerId && draggedCustomerId !== customerId) {
            setDragOverCustomerId(customerId);
        }
    };

    const handleDragLeave = () => {
        setDragOverCustomerId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetCustomerId: string) => {
        e.preventDefault();

        if (!draggedCustomerId || draggedCustomerId === targetCustomerId) {
            setDraggedCustomerId(null);
            setDragOverCustomerId(null);
            return;
        }

        try {
            await fetch("/api/customers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reorder: {
                        sourceId: draggedCustomerId,
                        targetId: targetCustomerId
                    }
                })
            });

            // Local state'de satırların yerini değiştir
            setCustomers(prev => {
                const newList = [...prev];
                const sourceIndex = newList.findIndex(c => c.id === draggedCustomerId);
                const targetIndex = newList.findIndex(c => c.id === targetCustomerId);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                    // siraNo değerlerini değiştir
                    const tempSiraNo = newList[sourceIndex].siraNo;
                    newList[sourceIndex].siraNo = newList[targetIndex].siraNo;
                    newList[targetIndex].siraNo = tempSiraNo;

                    // Dizide yer değiştir
                    [newList[sourceIndex], newList[targetIndex]] = [newList[targetIndex], newList[sourceIndex]];
                }

                return newList;
            });

            toast.success("Sıralama güncellendi");
        } catch (error) {
            toast.error("Sıralama güncellenemedi");
        }

        setDraggedCustomerId(null);
        setDragOverCustomerId(null);
    };

    const handleDragEnd = () => {
        setDraggedCustomerId(null);
        setDragOverCustomerId(null);
    };

    // ========== MÜKELLEf EKLEME/SİLME HANDLERLARI ==========

    // Mükellef ekle
    const handleAddCustomer = async () => {
        if (!newCustomer.unvan.trim() || !newCustomer.vknTckn.trim()) {
            toast.error("Ünvan ve VKN/TCKN zorunlu");
            return;
        }

        setAddingCustomer(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    unvan: toTitleCase(newCustomer.unvan),
                    vknTckn: newCustomer.vknTckn.trim(),
                    sirketTipi: newCustomer.sirketTipi,
                    siraNo: String(customers.length + 1)
                })
            });

            if (res.ok) {
                const created = await res.json();
                toast.success("Mükellef eklendi");
                setShowAddModal(false);
                setNewCustomer({ unvan: "", vknTckn: "", sirketTipi: "firma" });
                fetchCustomers(); // Listeyi yenile

                // Mükellefi dosya yöneticisinde aç
                window.open(`/dashboard/mukellefler/${created.id}`, "_blank");
            } else {
                const err = await res.json();
                toast.error(err.error || "Ekleme başarısız");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setAddingCustomer(false);
        }
    };

    // Mükellef sil
    const handleDeleteCustomer = async (customerId: string) => {
        if (!confirm("Bu mükellefi silmek istediğinize emin misiniz?")) {
            return;
        }

        try {
            const res = await fetch(`/api/customers?id=${customerId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                toast.success("Mükellef silindi");
                setCustomers(prev => prev.filter(c => c.id !== customerId));
            } else {
                const err = await res.json();
                toast.error(err.error || "Silme başarısız");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        }
    };

    // Mükellef detay sayfasını aç
    const handleOpenCustomer = (customerId: string) => {
        window.open(`/dashboard/mukellefler/${customerId}`, "_blank");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ClipboardCheck className="h-6 w-6 text-primary" />
                        Beyanname Kontrol
                    </h1>
                    <p className="text-muted-foreground">
                        GİB E-Beyanname sisteminden onaylı beyannameleri çekin ve takip edin.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Ayarlar
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSync}
                        disabled={syncStatus === "running" || !botInfo.hasCredentials}
                    >
                        {syncStatus === "running" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        GİB Senkronize Et
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleClearList}
                        disabled={syncStatus === "running"}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Listeyi Temizle
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Mükellef Ekle
                    </Button>
                </div>
            </div>

            {/* Bot Rapor Modalı */}
            <BotReportModal
                isOpen={reportModalOpen}
                onClose={handleReportClose}
                data={reportData}
            />

            {/* Add Customer Modal */}
            {showAddModal && (
                <Card className="border-2 border-primary">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5" />
                            Yeni Mükellef Ekle
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Ünvan *</Label>
                                <Input
                                    placeholder="Firma ünvanı"
                                    value={newCustomer.unvan}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, unvan: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>VKN/TCKN *</Label>
                                <Input
                                    placeholder="Vergi/TC No"
                                    value={newCustomer.vknTckn}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, vknTckn: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Şirket Tipi</Label>
                                <select
                                    className="w-full h-10 px-3 rounded-md border bg-background"
                                    value={newCustomer.sirketTipi}
                                    onChange={(e) => setNewCustomer(prev => ({ ...prev, sirketTipi: e.target.value }))}
                                >
                                    <option value="firma">Firma</option>
                                    <option value="sahis">Şahıs</option>
                                    <option value="basit_usul">Basit Usul</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowAddModal(false)}>
                                İptal
                            </Button>
                            <Button onClick={handleAddCustomer} disabled={addingCustomer}>
                                {addingCustomer ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                                Kaydet ve Aç
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Settings Panel */}
            {showSettings && (
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
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            // Validate 1 month range
                                            const start = new Date(e.target.value);
                                            const end = new Date(endDate);
                                            const diffDays = Math.abs((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            if (diffDays > 31) {
                                                toast.error("Tarih aralığı en fazla 1 ay olabilir!");
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Bitiş Tarihi</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value);
                                            // Validate 1 month range
                                            const start = new Date(startDate);
                                            const end = new Date(e.target.value);
                                            const diffDays = Math.abs((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                            if (diffDays > 31) {
                                                toast.error("Tarih aralığı en fazla 1 ay olabilir!");
                                            }
                                        }}
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
                                                <SelectItem value="1">Ocak</SelectItem>
                                                <SelectItem value="2">Şubat</SelectItem>
                                                <SelectItem value="3">Mart</SelectItem>
                                                <SelectItem value="4">Nisan</SelectItem>
                                                <SelectItem value="5">Mayıs</SelectItem>
                                                <SelectItem value="6">Haziran</SelectItem>
                                                <SelectItem value="7">Temmuz</SelectItem>
                                                <SelectItem value="8">Ağustos</SelectItem>
                                                <SelectItem value="9">Eylül</SelectItem>
                                                <SelectItem value="10">Ekim</SelectItem>
                                                <SelectItem value="11">Kasım</SelectItem>
                                                <SelectItem value="12">Aralık</SelectItem>
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
                                                <SelectItem value="1">Ocak</SelectItem>
                                                <SelectItem value="2">Şubat</SelectItem>
                                                <SelectItem value="3">Mart</SelectItem>
                                                <SelectItem value="4">Nisan</SelectItem>
                                                <SelectItem value="5">Mayıs</SelectItem>
                                                <SelectItem value="6">Haziran</SelectItem>
                                                <SelectItem value="7">Temmuz</SelectItem>
                                                <SelectItem value="8">Ağustos</SelectItem>
                                                <SelectItem value="9">Eylül</SelectItem>
                                                <SelectItem value="10">Ekim</SelectItem>
                                                <SelectItem value="11">Kasım</SelectItem>
                                                <SelectItem value="12">Aralık</SelectItem>
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

                        <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>GİB Kullanıcı Kodu</Label>
                                <Input
                                    value={gibSettings.gibCode}
                                    onChange={(e) => setGibSettings({ ...gibSettings, gibCode: e.target.value })}
                                    placeholder="Kullanıcı Kodu"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>2Captcha API Key</Label>
                                <Input
                                    value={gibSettings.captchaKey}
                                    onChange={(e) => setGibSettings({ ...gibSettings, captchaKey: e.target.value })}
                                    type="password"
                                    placeholder="API Key"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>GİB Şifre</Label>
                                <Input
                                    value={gibSettings.gibPassword}
                                    onChange={(e) => setGibSettings({ ...gibSettings, gibPassword: e.target.value })}
                                    type="password"
                                    placeholder={gibSettings.hasGibPassword ? "******** (Kayıtlı)" : "Şifre"}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>GİB Parola</Label>
                                <Input
                                    value={gibSettings.gibParola}
                                    onChange={(e) => setGibSettings({ ...gibSettings, gibParola: e.target.value })}
                                    type="password"
                                    placeholder={gibSettings.hasGibParola ? "******** (Kayıtlı)" : "Parola"}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={saveGibSettings} disabled={savingSettings}>
                                {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                                Ayarları Kaydet
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}


            {/* ===================== BEYANNAME TAKİP ÇİZELGESİ ===================== */}
            <Card className="border-2 border-primary/20">
                <CardHeader className="cursor-pointer" onClick={() => setIsPanelOpen(!isPanelOpen)}>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5 text-primary" />
                                Beyanname Takip Çizelgesi
                            </CardTitle>
                            <CardDescription>
                                {aylar[selectedMonth - 1]} {selectedYear} - Mükelleflerin beyanname durumlarını takip edin
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Stats mini */}
                            <div className="hidden md:flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <Badge variant="default">{stats.firma}</Badge>
                                    <span className="text-muted-foreground">Firma</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Badge variant="secondary">{stats.sahis}</Badge>
                                    <span className="text-muted-foreground">Şahıs</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Badge variant="outline">{stats.basit}</Badge>
                                    <span className="text-muted-foreground">B.Usul</span>
                                </div>
                            </div>
                            {isPanelOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </div>
                </CardHeader>

                {isPanelOpen && (
                    <CardContent className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 items-center pb-4 border-b">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Dönem:</span>
                                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                                    <SelectTrigger className="w-[120px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {aylar.map((ay, i) => (
                                            <SelectItem key={i} value={String(i + 1)}>{ay}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                                    <SelectTrigger className="w-[90px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[2024, 2025, 2026].map((y) => (
                                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Tip:</span>
                                <Select value={sirketTipiFilter} onValueChange={setSirketTipiFilter}>
                                    <SelectTrigger className="w-[120px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        <SelectItem value="firma">Firma</SelectItem>
                                        <SelectItem value="sahis">Şahıs</SelectItem>
                                        <SelectItem value="basit_usul">Basit Usul</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Mükellef ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-8"
                                />
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
                                <div className="flex items-center gap-1">
                                    <Check className="h-4 w-4 text-green-600" />
                                    <span>Verildi</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 rounded border-2 border-dashed border-muted-foreground/50" />
                                    <span>Boş</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 rounded bg-zinc-600" />
                                    <span>Muaf</span>
                                </div>
                            </div>

                            <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={customersLoading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${customersLoading ? "animate-spin" : ""}`} />
                                Yenile
                            </Button>
                            <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Excel
                            </Button>
                        </div>

                        {/* Table */}
                        {customersLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="border-2 border-border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-muted">
                                                <th className="border border-border px-3 py-2 w-16 font-bold text-center sticky left-0 bg-muted z-10">No</th>
                                                <th className="border border-border px-2 py-1 text-left font-bold w-64 sticky left-16 bg-muted z-10">
                                                    <div className="flex items-center gap-1">
                                                        <span>Mükellef</span>
                                                        <div className="flex gap-0.5 ml-auto">
                                                            <button
                                                                className={`text-[9px] px-1.5 py-0.5 rounded ${sirketTipiFilter === 'firma' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                                                onClick={() => setSirketTipiFilter(sirketTipiFilter === 'firma' ? 'all' : 'firma')}
                                                            >
                                                                Firma
                                                            </button>
                                                            <button
                                                                className={`text-[9px] px-1.5 py-0.5 rounded ${sirketTipiFilter === 'sahis' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                                                onClick={() => setSirketTipiFilter(sirketTipiFilter === 'sahis' ? 'all' : 'sahis')}
                                                            >
                                                                Şahıs
                                                            </button>
                                                            <button
                                                                className={`text-[9px] px-1.5 py-0.5 rounded ${sirketTipiFilter === 'basit_usul' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                                                                onClick={() => setSirketTipiFilter(sirketTipiFilter === 'basit_usul' ? 'all' : 'basit_usul')}
                                                            >
                                                                Basit
                                                            </button>
                                                        </div>
                                                    </div>
                                                </th>
                                                {activeBeyannameTurleri.map(tur => (
                                                    <th
                                                        key={tur.kod}
                                                        className="border border-border px-2 py-2 font-bold text-center min-w-[48px] cursor-pointer hover:bg-muted/50 transition-colors"
                                                        onClick={() => handleColumnSort(tur.kod)}
                                                    >
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger className="cursor-pointer flex items-center justify-center gap-1 w-full">
                                                                    <span>{tur.kisaAd || tur.kod}</span>
                                                                    <ArrowUpDown className={`h-3 w-3 ${sortColumn === tur.kod
                                                                        ? (sortDirection === "asc" ? "text-green-600" : "text-amber-600")
                                                                        : "text-muted-foreground/40"
                                                                        }`} />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{tur.aciklama}</p>
                                                                    <p className="text-xs text-muted-foreground mt-1">Tıkla: Sırala</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedCustomers.map((customer, index) => {
                                                const isDragging = draggedCustomerId === customer.id;
                                                const isDragOver = dragOverCustomerId === customer.id;

                                                return (
                                                    <tr
                                                        key={customer.id}
                                                        className={`
                                                            hover:bg-muted/80 transition-colors
                                                            ${isDragging ? "opacity-50" : ""}
                                                            ${isDragOver ? "border-t-2 border-t-primary" : ""}
                                                        `}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, customer.id)}
                                                        onDragOver={(e) => handleDragOver(e, customer.id)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, customer.id)}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        {/* S.N. - Editable */}
                                                        <td className="border border-border px-1 py-1 text-center font-mono text-muted-foreground sticky left-0 w-16 z-20 bg-background">
                                                            <div className="flex items-center gap-1">
                                                                <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab hover:text-muted-foreground" />
                                                                {editingSiraNo === customer.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editingSiraNoValue}
                                                                        onChange={(e) => setEditingSiraNoValue(e.target.value)}
                                                                        onBlur={() => handleSiraNoSave(customer.id)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") handleSiraNoSave(customer.id);
                                                                            if (e.key === "Escape") setEditingSiraNo(null);
                                                                        }}
                                                                        className="w-6 text-xs text-center bg-transparent border-none outline-none focus:bg-muted rounded"
                                                                        autoFocus
                                                                        onFocus={(e) => e.target.select()}
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        className="w-6 text-xs text-center cursor-text hover:text-foreground"
                                                                        onDoubleClick={() => handleSiraNoClick(customer.id, customer.siraNo ?? null)}
                                                                    >
                                                                        {customer.siraNo || index + 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {/* Mükellef - Editable */}
                                                        <td className="border border-border px-2 py-1 font-medium sticky left-16 w-64 z-20 bg-background">
                                                            {editingUnvan === customer.id ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingUnvanValue}
                                                                    onChange={(e) => setEditingUnvanValue(e.target.value)}
                                                                    onBlur={() => handleUnvanSave(customer.id)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") handleUnvanSave(customer.id);
                                                                        if (e.key === "Escape") setEditingUnvan(null);
                                                                    }}
                                                                    className="w-full h-6 text-xs border rounded px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-2 group">
                                                                    {customer.sirketTipi === "firma" ? (
                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                                                                            Firma
                                                                        </Badge>
                                                                    ) : customer.sirketTipi === "basit_usul" ? (
                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                                                            Basit
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                                            Şahıs
                                                                        </Badge>
                                                                    )}
                                                                    <span
                                                                        className="truncate cursor-pointer hover:underline"
                                                                        title="Tıkla: Düzenle"
                                                                        onClick={() => handleUnvanClick(customer.id, customer.unvan)}
                                                                    >
                                                                        {toTitleCase(customer.unvan)}
                                                                    </span>
                                                                    <Pencil
                                                                        className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                        onClick={() => handleUnvanClick(customer.id, customer.unvan)}
                                                                    />
                                                                    <FolderOpen
                                                                        className="h-3 w-3 text-blue-500/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                        onClick={() => handleOpenCustomer(customer.id)}
                                                                    />
                                                                    <Trash2
                                                                        className="h-3 w-3 text-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                                        onClick={() => handleDeleteCustomer(customer.id)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                        {activeBeyannameTurleri.map(tur => {
                                                            const customerStatuses = beyannameStatuses[customer.id] || {};
                                                            const beyannameData = customerStatuses[tur.kod];
                                                            const status = beyannameData?.status || "bos";
                                                            const isMuaf = customer.verilmeyecekBeyannameler?.includes(tur.kod) || false;

                                                            return (
                                                                <td
                                                                    key={tur.kod}
                                                                    onClick={() => handleLeftClick(customer.id, tur.kod, status)}
                                                                    onContextMenu={(e) => handleRightClick(e, customer.id, tur.kod)}
                                                                    title="Sol tık: Verildi/Boş | Sağ tık: Muaf (kalıcı)"
                                                                    className={`
                                                                    border border-border cursor-pointer text-center select-none h-8 transition-colors
                                                                    ${isMuaf
                                                                            ? "bg-zinc-600 dark:bg-zinc-700 hover:bg-zinc-500"
                                                                            : status === "verildi"
                                                                                ? "bg-background hover:bg-green-50 dark:hover:bg-green-950/30"
                                                                                : status === "3aylik"
                                                                                    ? "bg-amber-100 dark:bg-amber-900/30"
                                                                                    : "bg-background hover:bg-muted/50"
                                                                        }
                                                                `}
                                                                >
                                                                    {status === "verildi" && (() => {
                                                                        const meta = getMeta(customer.id, tur.kod);

                                                                        // PDF Açma Fonksiyonu
                                                                        const openPdf = (e: React.MouseEvent, path: string) => {
                                                                            e.stopPropagation(); // Hücre tıklamasını engelle
                                                                            window.open(`/api/files?path=${path}`, '_blank', 'width=1000,height=800');
                                                                        };

                                                                        if (meta) {
                                                                            return (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <div className="flex items-center justify-center w-full h-full gap-0.5 relative group">
                                                                                                {/* Eğer dosya varsa göster, yoksa sadece Tik */}
                                                                                                {meta.beyannamePath || meta.tahakkukPath ? (
                                                                                                    <div className="flex items-center gap-0.5">
                                                                                                        {/* Yeşil Tik */}
                                                                                                        <Check className="w-3 h-3 text-green-600 stroke-[3]" />

                                                                                                        {/* B İkonu */}
                                                                                                        {meta.beyannamePath && (
                                                                                                            <div
                                                                                                                onClick={(e) => openPdf(e, meta.beyannamePath!)}
                                                                                                                className="w-4 h-4 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-[2px] cursor-pointer border border-red-200"
                                                                                                                title="Beyanname PDF"
                                                                                                            >
                                                                                                                <span className="text-[9px] font-bold">B</span>
                                                                                                            </div>
                                                                                                        )}

                                                                                                        {/* T İkonu */}
                                                                                                        {meta.tahakkukPath && (
                                                                                                            <div
                                                                                                                onClick={(e) => openPdf(e, meta.tahakkukPath!)}
                                                                                                                className="w-4 h-4 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-[2px] cursor-pointer border border-red-200"
                                                                                                                title="Tahakkuk PDF"
                                                                                                            >
                                                                                                                <span className="text-[9px] font-bold">T</span>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <Check className="w-4 h-4 text-green-600 stroke-[3]" />
                                                                                                )}
                                                                                            </div>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent
                                                                                            side="top"
                                                                                            className="rounded-2xl px-5 py-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 border-green-200 dark:border-green-800 shadow-xl"
                                                                                        >
                                                                                            <div className="space-y-2.5 min-w-[220px]">
                                                                                                <div className="font-bold text-green-800 dark:text-green-200 text-sm flex items-center gap-2 pb-2 border-b border-green-200 dark:border-green-700">
                                                                                                    <Check className="w-4 h-4" />
                                                                                                    {meta.beyannameTuru}
                                                                                                </div>
                                                                                                <div className="space-y-1.5 text-xs">
                                                                                                    <div className="flex items-center justify-between text-green-700 dark:text-green-300">
                                                                                                        <span className="font-medium">Gönderim Tarihi:</span>
                                                                                                        <span>{meta.yuklemeZamani}</span>
                                                                                                    </div>
                                                                                                    {meta.donem && (
                                                                                                        <div className="flex items-center justify-between text-green-700 dark:text-green-300">
                                                                                                            <span className="font-medium">Vergilendirme Dönemi:</span>
                                                                                                            <span>{meta.donem}</span>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="text-xs text-green-600 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-700">
                                                                                                    <span className="font-medium">Mükellef:</span> {toTitleCase(meta.unvan)}
                                                                                                </div>

                                                                                                {/* Tooltip içinde de butonlar olsun */}
                                                                                                {(meta.beyannamePath || meta.tahakkukPath) && (
                                                                                                    <div className="flex gap-2 pt-2">
                                                                                                        {meta.beyannamePath && (
                                                                                                            <Button
                                                                                                                size="sm"
                                                                                                                variant="outline"
                                                                                                                className="h-6 text-[10px] w-full bg-white/50 hover:bg-white"
                                                                                                                onClick={(e) => openPdf(e, meta.beyannamePath!)}
                                                                                                            >
                                                                                                                Beyanname İndir
                                                                                                            </Button>
                                                                                                        )}
                                                                                                        {meta.tahakkukPath && (
                                                                                                            <Button
                                                                                                                size="sm"
                                                                                                                variant="outline"
                                                                                                                className="h-6 text-[10px] w-full bg-white/50 hover:bg-white"
                                                                                                                onClick={(e) => openPdf(e, meta.tahakkukPath!)}
                                                                                                            >
                                                                                                                Tahakkuk İndir
                                                                                                            </Button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <div className="flex items-center justify-center w-full h-full">
                                                                                <Check className="w-4 h-4 text-green-600 stroke-[3]" />
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    {status === "3aylik" && (
                                                                        <div className="flex items-center justify-center w-full h-full">
                                                                            <span className="text-[9px] font-bold text-amber-700">3AY</span>
                                                                        </div>
                                                                    )}
                                                                    {(status === "bos" || status === "muaf") && (
                                                                        <div className="flex items-center justify-center w-full h-full" />
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredCustomers.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p>Mükellef bulunamadı.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer Legend */}
                        <div className="flex items-center justify-end gap-6 text-[10px] font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-background border-2 border-border rounded" />
                                Sol Tık: Değiştir
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-zinc-600 border-2 border-border rounded" />
                                Sağ Tık: Muaf/Var
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Results Table from GIB Sync */}
            {beyannameler.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Bulunan Beyannameler ({beyannameler.length})</CardTitle>
                        <CardDescription>
                            {startDate} - {endDate} tarihleri arasındaki onaylı beyannameler
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">Beyanname Türü</th>
                                        <th className="text-left p-2">TC/VKN</th>
                                        <th className="text-left p-2">Ad Soyad/Unvan</th>
                                        <th className="text-left p-2">Dönem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {beyannameler.slice(0, 20).map((b, i) => (
                                        <tr key={i} className="border-b hover:bg-muted/50">
                                            <td className="p-2">{b.beyannameTuru}</td>
                                            <td className="p-2 font-mono">{b.tcVkn}</td>
                                            <td className="p-2">{b.adSoyadUnvan.substring(0, 40)}</td>
                                            <td className="p-2">{b.vergilendirmeDonemi}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {beyannameler.length > 20 && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    ... ve {beyannameler.length - 20} kayıt daha
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )
            }

            {/* Eşleştirilemeyen Beyannameler */}
            {unmatchedDeclarations.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-5 w-5" />
                            Eşleştirilemeyen Beyannameler ({unmatchedDeclarations.length})
                        </CardTitle>
                        <CardDescription>
                            Aşağıdaki beyannameler sistemdeki mükelleflerle eşleştirilemedi. VKN/TCKN bilgilerini kontrol edin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-amber-50 dark:bg-amber-950/20">
                                        <th className="text-left p-2">Beyanname Türü</th>
                                        <th className="text-left p-2">TC/VKN</th>
                                        <th className="text-left p-2">Ad Soyad/Unvan</th>
                                        <th className="text-left p-2">Dönem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unmatchedDeclarations.map((b, i) => (
                                        <tr key={i} className="border-b hover:bg-amber-50/50 dark:hover:bg-amber-950/10">
                                            <td className="p-2">{b.beyannameTuru}</td>
                                            <td className="p-2 font-mono font-semibold text-amber-700 dark:text-amber-400">{b.tcVkn}</td>
                                            <td className="p-2">{b.adSoyadUnvan.substring(0, 40)}</td>
                                            <td className="p-2">{b.vergilendirmeDonemi}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {
                syncStatus === "idle" && beyannameler.length === 0 && customers.length === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="text-center py-12">
                            <ClipboardCheck className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                            <h3 className="font-semibold mb-2">Beyanname Senkronizasyonu</h3>
                            <p className="text-muted-foreground mb-4">
                                GİB E-Beyanname sisteminden onaylı beyannameleri çekmek için
                                yukarıdaki butona tıklayın.
                            </p>
                            {botInfo.lastSync && (
                                <p className="text-xs text-muted-foreground">
                                    Son senkronizasyon: {new Date(botInfo.lastSync).toLocaleString("tr-TR")}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )
            }
        </div >
    );
}
