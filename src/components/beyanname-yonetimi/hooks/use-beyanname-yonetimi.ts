"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";

// Dönem tipleri
export type DonemType = "15gunluk" | "aylik" | "3aylik" | "6aylik" | "yillik" | "dilekce";

export const DONEM_OPTIONS: { value: DonemType; label: string }[] = [
    { value: "15gunluk", label: "15 Günlük" },
    { value: "aylik", label: "Aylık" },
    { value: "3aylik", label: "3 Aylık" },
    { value: "6aylik", label: "6 Aylık" },
    { value: "yillik", label: "Yıllık" },
    { value: "dilekce", label: "Dilekçe" },
];

export const DONEM_LABEL_MAP: Record<DonemType, string> = {
    "15gunluk": "15 Günlük",
    "aylik": "Aylık",
    "3aylik": "3 Aylık",
    "6aylik": "6 Aylık",
    "yillik": "Yıllık",
    "dilekce": "Dilekçe",
};

// Kompakt tablo görünümü için kısa etiketler
export const DONEM_SHORT_LABEL_MAP: Record<DonemType, string> = {
    "15gunluk": "15G",
    "aylik": "A",
    "3aylik": "3A",
    "6aylik": "6A",
    "yillik": "Y",
    "dilekce": "D",
};

// Dönem renk paleti — hücre ve dropdown'larda kullanılır
export const DONEM_COLORS: Record<DonemType, { bg: string; text: string; hoverBg: string; badge: string }> = {
    "15gunluk": { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", hoverBg: "hover:bg-rose-50 dark:hover:bg-rose-900/20", badge: "bg-rose-500" },
    "aylik": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/20", badge: "bg-blue-500" },
    "3aylik": { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", hoverBg: "hover:bg-violet-50 dark:hover:bg-violet-900/20", badge: "bg-violet-500" },
    "6aylik": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20", badge: "bg-amber-500" },
    "yillik": { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20", badge: "bg-emerald-500" },
    "dilekce": { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", hoverBg: "hover:bg-slate-50 dark:hover:bg-slate-800/30", badge: "bg-slate-500" },
};

// Kategori sırası
const KATEGORI_SIRASI = ["KDV", "Gelir", "Kurumlar", "Muhtasar", "ÖTV", "Diğer", "Damga"];

export interface BeyannameCustomer {
    id: string;
    unvan: string;
    kisaltma: string | null;
    sirketTipi: string;
    siraNo: string | null;
    beyannameAyarlari: Record<string, string>;
}

export interface BeyannameTuru {
    id: string;
    kod: string;
    aciklama: string;
    kisaAd: string | null;
    kategori: string | null;
    aktif: boolean;
    siraNo: number;
    donemSecenekleri: string[];
}

export interface CategoryGroup {
    category: string;
    count: number;
}

export function useBeyannameYonetimi() {
    // Veri state'leri
    const [customers, setCustomers] = useState<BeyannameCustomer[]>([]);
    const [turler, setTurler] = useState<BeyannameTuru[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Local ayarlar — her müşteri için beyannameAyarlari kopyası
    const [localAyarlar, setLocalAyarlar] = useState<Map<string, Record<string, string>>>(new Map());
    const originalAyarlarRef = useRef<Map<string, Record<string, string>>>(new Map());

    // Filtre state'leri
    const [searchTerm, setSearchTerm] = useState("");
    const [sirketTipiFilter, setSirketTipiFilter] = useState<string>("all");
    // activeCategory kaldırıldı — tüm türler tek sayfada gösteriliyor

    // Seçim state'i
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

    // Veri yükleme
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [customersRes, turleriRes] = await Promise.all([
                fetch("/api/customers/beyanname-ayarlari"),
                fetch("/api/beyanname-turleri"),
            ]);

            if (!customersRes.ok || !turleriRes.ok) {
                throw new Error("Veri yüklenirken hata oluştu");
            }

            const customersData = await customersRes.json();
            const turleriData: BeyannameTuru[] = await turleriRes.json();

            const customerList: BeyannameCustomer[] = customersData.customers;
            setCustomers(customerList);
            setTurler(turleriData.filter(t => t.aktif));

            // Local ayarları başlat
            const ayarlarMap = new Map<string, Record<string, string>>();
            const originalMap = new Map<string, Record<string, string>>();
            for (const c of customerList) {
                const ayar = (c.beyannameAyarlari || {}) as Record<string, string>;
                ayarlarMap.set(c.id, { ...ayar });
                originalMap.set(c.id, { ...ayar });
            }
            setLocalAyarlar(ayarlarMap);
            originalAyarlarRef.current = originalMap;

                    // activeCategory artık kullanılmıyor — tüm türler tek sayfada
        } catch (error) {
            console.error("Beyanname yönetimi verisi yüklenemedi:", error);
            toast.error("Veriler yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Kategori normalizasyonu — "Vergi"/"VERGİ" gibi bilinmeyen kategorileri "Diğer"e eşle
    const normalizeKategori = (k: string | null) => {
        if (!k) return "Diğer";
        if (KATEGORI_SIRASI.includes(k)) return k;
        return "Diğer";
    };

    // Tüm aktif beyanname türleri — kategori sırasına göre, sonra siraNo'ya göre
    const allTurleri = useMemo(() => {
        return [...turler].sort((a, b) => {
            const catA = normalizeKategori(a.kategori);
            const catB = normalizeKategori(b.kategori);
            const ai = KATEGORI_SIRASI.indexOf(catA);
            const bi = KATEGORI_SIRASI.indexOf(catB);
            const catOrder = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            if (catOrder !== 0) return catOrder;
            return a.siraNo - b.siraNo;
        });
    }, [turler]);

    // Kategori grupları — matrix başlık satırı için
    const categoryGroups = useMemo(() => {
        const groups: { category: string; count: number }[] = [];
        let lastCat = "";
        for (const tur of allTurleri) {
            const cat = normalizeKategori(tur.kategori);
            if (cat !== lastCat) {
                groups.push({ category: cat, count: 1 });
                lastCat = cat;
            } else {
                groups[groups.length - 1].count++;
            }
        }
        return groups;
    }, [allTurleri]);

    // Filtrelenmiş müşteriler
    const filteredCustomers = useMemo(() => {
        let result = customers;

        if (sirketTipiFilter !== "all") {
            result = result.filter(c => c.sirketTipi === sirketTipiFilter);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.unvan.toLowerCase().includes(term) ||
                (c.kisaltma && c.kisaltma.toLowerCase().includes(term))
            );
        }

        return result;
    }, [customers, sirketTipiFilter, searchTerm]);

    // Dirty tracking
    const dirtyCustomerIds = useMemo(() => {
        const dirtyIds = new Set<string>();
        for (const [customerId, currentAyar] of localAyarlar) {
            const original = originalAyarlarRef.current.get(customerId) || {};
            const currentKeys = Object.keys(currentAyar);
            const originalKeys = Object.keys(original);

            if (currentKeys.length !== originalKeys.length) {
                dirtyIds.add(customerId);
                continue;
            }

            for (const key of currentKeys) {
                if (currentAyar[key] !== original[key]) {
                    dirtyIds.add(customerId);
                    break;
                }
            }
        }
        return dirtyIds;
    }, [localAyarlar]);

    const dirtyCount = dirtyCustomerIds.size;

    // Her beyanname türü için atanmış mükellef sayısı
    const stats = useMemo(() => {
        const result: Record<string, number> = {};
        for (const tur of allTurleri) {
            let count = 0;
            for (const c of filteredCustomers) {
                const ayar = localAyarlar.get(c.id);
                if (ayar && ayar[tur.kod]) {
                    count++;
                }
            }
            result[tur.kod] = count;
        }
        return result;
    }, [allTurleri, filteredCustomers, localAyarlar]);

    // Tekil hücre güncelleme
    const updateCell = useCallback((customerId: string, beyannameKod: string, donem: DonemType | null) => {
        setLocalAyarlar(prev => {
            const next = new Map(prev);
            const current = { ...(next.get(customerId) || {}) };
            if (donem === null) {
                delete current[beyannameKod];
            } else {
                current[beyannameKod] = donem;
            }
            next.set(customerId, current);
            return next;
        });
    }, []);

    // Toplu atama
    const bulkAssign = useCallback((beyannameKod: string, donem: DonemType) => {
        if (selectedCustomerIds.size === 0) {
            toast.error("Lütfen önce mükellef seçin");
            return;
        }
        setLocalAyarlar(prev => {
            const next = new Map(prev);
            for (const customerId of selectedCustomerIds) {
                const current = { ...(next.get(customerId) || {}) };
                current[beyannameKod] = donem;
                next.set(customerId, current);
            }
            return next;
        });
    }, [selectedCustomerIds]);

    // Toplu kaldırma
    const bulkRemove = useCallback((beyannameKod: string) => {
        if (selectedCustomerIds.size === 0) {
            toast.error("Lütfen önce mükellef seçin");
            return;
        }
        setLocalAyarlar(prev => {
            const next = new Map(prev);
            for (const customerId of selectedCustomerIds) {
                const current = { ...(next.get(customerId) || {}) };
                delete current[beyannameKod];
                next.set(customerId, current);
            }
            return next;
        });
    }, [selectedCustomerIds]);

    // Tüm atanmış beyanname türlerini kaldır (seçili müşterilerden)
    const bulkRemoveAll = useCallback(() => {
        if (selectedCustomerIds.size === 0) {
            toast.error("Lütfen önce mükellef seçin");
            return;
        }
        setLocalAyarlar(prev => {
            const next = new Map(prev);
            for (const customerId of selectedCustomerIds) {
                next.set(customerId, {});
            }
            return next;
        });
        toast.info(`${selectedCustomerIds.size} mükellefin tüm beyanname türleri kaldırıldı`);
    }, [selectedCustomerIds]);

    // Kaydet — tüm dirty müşterileri tek istekte gönder
    const saveChanges = useCallback(async () => {
        if (dirtyCustomerIds.size === 0) return;

        setSaving(true);
        try {
            // Tüm dirty müşterilerin tam beyannameAyarlari objesini topla
            const data: Record<string, Record<string, string>> = {};
            for (const customerId of dirtyCustomerIds) {
                data[customerId] = localAyarlar.get(customerId) || {};
            }

            const res = await fetch("/api/customers/beyanname-ayarlari", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data }),
            });

            if (!res.ok) {
                throw new Error("Kaydetme başarısız");
            }

            // Original'ı güncelle
            const newOriginal = new Map<string, Record<string, string>>();
            for (const [id, ayar] of localAyarlar) {
                newOriginal.set(id, { ...ayar });
            }
            originalAyarlarRef.current = newOriginal;

            // State'i yeniden trigger et (dirtyCount sıfırlansın)
            setLocalAyarlar(new Map(localAyarlar));

            toast.success(`${dirtyCustomerIds.size} mükellefin beyanname ayarları kaydedildi`);
        } catch (error) {
            console.error("Beyanname ayarları kaydedilemedi:", error);
            toast.error("Kaydetme sırasında hata oluştu");
        } finally {
            setSaving(false);
        }
    }, [dirtyCustomerIds, localAyarlar]);

    // Mükellef seçim işlemleri
    const toggleCustomer = useCallback((customerId: string) => {
        setSelectedCustomerIds(prev => {
            const next = new Set(prev);
            if (next.has(customerId)) {
                next.delete(customerId);
            } else {
                next.add(customerId);
            }
            return next;
        });
    }, []);

    const toggleAllCustomers = useCallback(() => {
        setSelectedCustomerIds(prev => {
            if (prev.size === filteredCustomers.length) {
                return new Set();
            }
            return new Set(filteredCustomers.map(c => c.id));
        });
    }, [filteredCustomers]);

    return {
        // Veri
        customers: filteredCustomers,
        allCustomersCount: customers.length,
        turler,
        allTurleri,
        categoryGroups,
        localAyarlar,
        stats,

        // Durumlar
        loading,
        saving,
        dirtyCount,

        // Filtreler
        searchTerm,
        setSearchTerm,
        sirketTipiFilter,
        setSirketTipiFilter,

        // Seçim
        selectedCustomerIds,
        toggleCustomer,
        toggleAllCustomers,

        // Aksiyonlar
        updateCell,
        bulkAssign,
        bulkRemove,
        bulkRemoveAll,
        saveChanges,
        refetch: fetchData,
    };
}
