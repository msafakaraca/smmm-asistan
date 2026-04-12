"use client";

import { memo, useRef, useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { observeElementRectHeightOnly } from "@/lib/virtualizer-helpers";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BeyannameHeaderCell } from "./beyanname-header-cell";
import { BeyannameDataCell } from "./beyanname-data-cell";
import {
    DONEM_OPTIONS,
    DONEM_SHORT_LABEL_MAP,
    DONEM_COLORS,
    type BeyannameCustomer,
    type BeyannameTuru,
    type CategoryGroup,
    type DonemType,
} from "./hooks/use-beyanname-yonetimi";

const VIRTUAL_THRESHOLD = 50;
const ROW_HEIGHT = 30;

// Kategori renkleri
const CATEGORY_COLORS: Record<string, string> = {
    "KDV": "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300",
    "Gelir": "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300",
    "Kurumlar": "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300",
    "Muhtasar": "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300",
    "ÖTV": "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300",
    "Damga": "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300",
    "Diğer": "bg-gray-100 text-gray-900 dark:bg-gray-900/40 dark:text-gray-300",
};

// Paylaşımlı dropdown state tipi
interface DropdownState {
    customerId: string;
    beyannameKod: string;
    currentDonem: DonemType | null;
    donemSecenekleri: string[];
    anchorEl: HTMLElement;
}

interface BeyannameMatrixProps {
    customers: BeyannameCustomer[];
    allTurleri: BeyannameTuru[];
    categoryGroups: CategoryGroup[];
    localAyarlar: Map<string, Record<string, string>>;
    stats: Record<string, number>;
    selectedCustomerIds: Set<string>;
    allSelected: boolean;
    onToggleCustomer: (customerId: string) => void;
    onToggleAll: () => void;
    onUpdateCell: (customerId: string, beyannameKod: string, donem: DonemType | null) => void;
    onBulkAssign: (beyannameKod: string, donem: DonemType) => void;
    onBulkRemove: (beyannameKod: string) => void;
    hasSelectedCustomers: boolean;
}

export const BeyannameMatrix = memo(function BeyannameMatrix({
    customers,
    allTurleri,
    categoryGroups,
    localAyarlar,
    stats,
    selectedCustomerIds,
    allSelected,
    onToggleCustomer,
    onToggleAll,
    onUpdateCell,
    onBulkAssign,
    onBulkRemove,
    hasSelectedCustomers,
}: BeyannameMatrixProps) {
    const parentRef = useRef<HTMLDivElement>(null);
    const useVirtual = customers.length > VIRTUAL_THRESHOLD;

    // Paylaşımlı dropdown state — tek bir dropdown tüm hücreler için
    const [dropdown, setDropdown] = useState<DropdownState | null>(null);

    const rowVirtualizer = useVirtualizer({
        count: customers.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
        enabled: useVirtual,
        observeElementRect: observeElementRectHeightOnly,
    });

    const handleCellChange = useCallback(
        (customerId: string, beyannameKod: string, donem: DonemType | null) => {
            onUpdateCell(customerId, beyannameKod, donem);
        },
        [onUpdateCell]
    );

    // Hücre tıklandığında paylaşımlı dropdown'u aç
    const handleOpenDropdown = useCallback(
        (customerId: string, beyannameKod: string, currentDonem: DonemType | null, donemSecenekleri: string[], anchorEl: HTMLElement) => {
            setDropdown({ customerId, beyannameKod, currentDonem, donemSecenekleri, anchorEl });
        },
        []
    );

    // Dropdown'dan seçim yapıldığında
    const handleDropdownSelect = useCallback(
        (donem: DonemType | null) => {
            if (dropdown) {
                onUpdateCell(dropdown.customerId, dropdown.beyannameKod, donem);
            }
            setDropdown(null);
        },
        [dropdown, onUpdateCell]
    );

    const handleDropdownClose = useCallback(() => {
        setDropdown(null);
    }, []);

    // Scroll olduğunda dropdown'u kapat
    useEffect(() => {
        if (!dropdown) return;
        const scrollEl = parentRef.current;
        if (!scrollEl) return;
        const handleScroll = () => setDropdown(null);
        scrollEl.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollEl.removeEventListener("scroll", handleScroll);
    }, [dropdown]);

    if (allTurleri.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Beyanname türü bulunmuyor.
            </div>
        );
    }

    if (customers.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Filtrelere uygun mükellef bulunamadı.
            </div>
        );
    }

    // Sütun genişlikleri — kompakt tasarım
    const checkboxColWidth = 32;
    const nameColWidth = 200;
    const minDataColWidth = 52;
    const minTotalWidth = checkboxColWidth + nameColWidth + allTurleri.length * minDataColWidth;

    const items = useVirtual ? rowVirtualizer.getVirtualItems() : null;
    const totalSize = useVirtual ? rowVirtualizer.getTotalSize() : 0;

    return (
        <>
            {/* Matrix tablo — scroll alanı */}
            <div className="flex-1 overflow-auto" ref={parentRef}>
                <table
                    className="w-full"
                    style={{
                        minWidth: minTotalWidth + "px",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        tableLayout: "fixed",
                    }}
                >
                    <colgroup>
                        <col style={{ width: checkboxColWidth, minWidth: checkboxColWidth }} />
                        <col style={{ width: nameColWidth, minWidth: nameColWidth }} />
                        {allTurleri.map((tur) => (
                            <col key={tur.kod} style={{ width: minDataColWidth, minWidth: minDataColWidth }} />
                        ))}
                    </colgroup>
                    <thead>
                        {/* Kategori grup başlık satırı — kompakt */}
                        <tr>
                            <th
                                colSpan={2}
                                className="sticky top-0 left-0 bg-background z-30 border-b border-r px-1 text-left text-[10px] font-semibold text-muted-foreground align-middle"
                                style={{ height: 22 }}
                            >
                                Kategori
                            </th>
                            {categoryGroups.map((group) => (
                                <th
                                    key={group.category}
                                    colSpan={group.count}
                                    className={`sticky top-0 z-10 border-b border-r px-1.5 py-0.5 text-center text-[11px] font-extrabold tracking-wide align-middle border-b-2 border-r-2 ${CATEGORY_COLORS[group.category] || CATEGORY_COLORS["Diğer"]}`}
                                    style={{ height: 24 }}
                                >
                                    {group.category}
                                </th>
                            ))}
                        </tr>
                        {/* Beyanname türleri başlık satırı */}
                        <tr>
                            <th
                                className="sticky left-0 bg-background z-30 border-b border-r px-0.5 text-center align-middle"
                                style={{ top: 24 }}
                            >
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onToggleAll}
                                    aria-label="Tümünü seç"
                                    className="h-3.5 w-3.5"
                                />
                            </th>
                            <th
                                className="sticky bg-background z-30 border-b border-r px-1.5 text-center text-[11px] font-bold text-muted-foreground align-middle"
                                style={{ left: checkboxColWidth, top: 24 }}
                            >
                                Mükellef
                            </th>
                            {allTurleri.map((tur) => (
                                <BeyannameHeaderCell
                                    key={tur.kod}
                                    beyannameTuru={tur}
                                    onBulkAssign={onBulkAssign}
                                    onBulkRemove={onBulkRemove}
                                    hasSelectedCustomers={hasSelectedCustomers}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {useVirtual ? (
                            <>
                                {(items?.[0]?.start ?? 0) > 0 && (
                                    <tr>
                                        <td
                                            style={{ height: items![0].start }}
                                            colSpan={allTurleri.length + 2}
                                        />
                                    </tr>
                                )}
                                {items!.map((virtualRow) => {
                                    const customer = customers[virtualRow.index];
                                    const ayar = localAyarlar.get(customer.id) || {};
                                    const isSelected = selectedCustomerIds.has(customer.id);
                                    return (
                                        <MatrixRow
                                            key={customer.id}
                                            customer={customer}
                                            ayar={ayar}
                                            isSelected={isSelected}
                                            allTurleri={allTurleri}
                                            onToggleCustomer={onToggleCustomer}
                                            onCellChange={handleCellChange}
                                            onOpenDropdown={handleOpenDropdown}
                                            checkboxColWidth={checkboxColWidth}
                                        />
                                    );
                                })}
                                {totalSize - (items?.[items!.length - 1]?.end ?? 0) > 0 && (
                                    <tr>
                                        <td
                                            style={{
                                                height:
                                                    totalSize -
                                                    (items![items!.length - 1]?.end ?? 0),
                                            }}
                                            colSpan={allTurleri.length + 2}
                                        />
                                    </tr>
                                )}
                            </>
                        ) : (
                            customers.map((customer) => {
                                const ayar = localAyarlar.get(customer.id) || {};
                                const isSelected = selectedCustomerIds.has(customer.id);
                                return (
                                    <MatrixRow
                                        key={customer.id}
                                        customer={customer}
                                        ayar={ayar}
                                        isSelected={isSelected}
                                        allTurleri={allTurleri}
                                        onToggleCustomer={onToggleCustomer}
                                        onCellChange={handleCellChange}
                                        onOpenDropdown={handleOpenDropdown}
                                        checkboxColWidth={checkboxColWidth}
                                    />
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Özet istatistik */}
            <div className="shrink-0 border-t p-4 text-xs text-muted-foreground bg-background overflow-x-auto">
                <div className="flex items-center gap-3 whitespace-nowrap">
                    {allTurleri.map((tur) => (
                        <span key={tur.kod}>
                            <span className="font-medium">{tur.kisaAd || tur.kod}</span>:{" "}
                            {stats[tur.kod] || 0}/{customers.length}
                        </span>
                    ))}
                </div>
            </div>

            {/* Paylaşımlı dropdown — tek instance tüm hücreler için */}
            {dropdown && (
                <CellDropdown
                    currentDonem={dropdown.currentDonem}
                    donemSecenekleri={dropdown.donemSecenekleri}
                    anchorEl={dropdown.anchorEl}
                    onSelect={handleDropdownSelect}
                    onClose={handleDropdownClose}
                />
            )}
        </>
    );
});

// Paylaşımlı hücre dropdown'u — tüm matrix için tek instance
interface CellDropdownProps {
    currentDonem: DonemType | null;
    donemSecenekleri: string[];
    anchorEl: HTMLElement;
    onSelect: (donem: DonemType | null) => void;
    onClose: () => void;
}

function CellDropdown({ currentDonem, donemSecenekleri, anchorEl, onSelect, onClose }: CellDropdownProps) {
    const ref = useRef<HTMLDivElement>(null);
    const filteredOptions = DONEM_OPTIONS.filter((o) => donemSecenekleri.includes(o.value));

    useEffect(() => {
        const rect = anchorEl.getBoundingClientRect();
        const el = ref.current;
        if (!el) return;

        let top = rect.bottom + 4;
        const dropdownWidth = el.offsetWidth || 140;
        let left = rect.left + (rect.width - dropdownWidth) / 2;

        const dropdownHeight = el.offsetHeight || 160;
        if (top + dropdownHeight > window.innerHeight) {
            top = rect.top - dropdownHeight - 4;
        }
        if (left < 4) left = 4;
        if (left + dropdownWidth > window.innerWidth) {
            left = window.innerWidth - dropdownWidth - 8;
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
    }, [anchorEl]);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            className="fixed z-[100] bg-popover/95 backdrop-blur-sm border border-border/60 rounded-lg shadow-xl py-1 min-w-[130px] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
        >
            <div className="px-2 py-1 mb-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Dönem Seçin</span>
            </div>
            {filteredOptions.map((opt) => {
                const isActive = currentDonem === opt.value;
                const colors = DONEM_COLORS[opt.value];
                return (
                    <button
                        key={opt.value}
                        onClick={() => onSelect(opt.value as DonemType)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-left transition-all duration-100 ${
                            isActive
                                ? `${colors.bg} ${colors.text} font-semibold`
                                : `hover:bg-accent/60 text-foreground/80 ${colors.hoverBg}`
                        }`}
                    >
                        <span className={`shrink-0 h-2 w-2 rounded-full ${colors.badge} ${isActive ? "" : "opacity-40"}`} />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-[9px] font-bold ${isActive ? colors.text : "text-muted-foreground/50"}`}>
                            {DONEM_SHORT_LABEL_MAP[opt.value]}
                        </span>
                    </button>
                );
            })}
            {currentDonem && (
                <>
                    <div className="border-t border-border/40 my-1 mx-2" />
                    <button
                        onClick={() => onSelect(null)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-left text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                        <X className="h-3 w-3 shrink-0" />
                        <span>Kaldır</span>
                    </button>
                </>
            )}
        </div>,
        document.body
    );
}

// Satır bileşeni — memo ile optimize
interface MatrixRowProps {
    customer: BeyannameCustomer;
    ayar: Record<string, string>;
    isSelected: boolean;
    allTurleri: BeyannameTuru[];
    onToggleCustomer: (customerId: string) => void;
    onCellChange: (customerId: string, beyannameKod: string, donem: DonemType | null) => void;
    onOpenDropdown: (customerId: string, beyannameKod: string, currentDonem: DonemType | null, donemSecenekleri: string[], anchorEl: HTMLElement) => void;
    checkboxColWidth: number;
}

const MatrixRow = memo(function MatrixRow({
    customer,
    ayar,
    isSelected,
    allTurleri,
    onToggleCustomer,
    onCellChange,
    onOpenDropdown,
    checkboxColWidth,
}: MatrixRowProps) {
    return (
        <tr className="hover:bg-muted/50 transition-colors" style={{ height: ROW_HEIGHT }}>
            <td
                className="sticky left-0 bg-background z-10 border-b border-r px-0.5 text-center align-middle"
            >
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleCustomer(customer.id)}
                    aria-label={`${customer.unvan} seç`}
                    className="h-3.5 w-3.5"
                />
            </td>
            <td
                className="sticky bg-background z-10 border-b border-r px-1.5 text-[11px] align-middle"
                style={{ left: checkboxColWidth }}
                title={customer.unvan}
            >
                <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {customer.kisaltma || customer.unvan}
                </div>
            </td>
            {allTurleri.map((tur) => (
                <BeyannameDataCell
                    key={tur.kod}
                    customerId={customer.id}
                    beyannameKod={tur.kod}
                    currentDonem={(ayar[tur.kod] as DonemType) || null}
                    donemSecenekleri={tur.donemSecenekleri}
                    onChange={onCellChange}
                    onOpenDropdown={onOpenDropdown}
                />
            ))}
        </tr>
    );
});
