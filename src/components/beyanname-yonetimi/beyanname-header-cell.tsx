"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
    DONEM_OPTIONS,
    DONEM_SHORT_LABEL_MAP,
    DONEM_COLORS,
    type BeyannameTuru,
    type DonemType,
} from "./hooks/use-beyanname-yonetimi";

interface BeyannameHeaderCellProps {
    beyannameTuru: BeyannameTuru;
    onBulkAssign: (beyannameKod: string, donem: DonemType) => void;
    onBulkRemove: (beyannameKod: string) => void;
    hasSelectedCustomers: boolean;
}

export const BeyannameHeaderCell = memo(function BeyannameHeaderCell({
    beyannameTuru,
    onBulkAssign,
    onBulkRemove,
    hasSelectedCustomers,
}: BeyannameHeaderCellProps) {
    const [selectedDonem, setSelectedDonem] = useState<DonemType | "">("");
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const secenekler = beyannameTuru.donemSecenekleri as string[];
    const filteredOptions = DONEM_OPTIONS.filter((o) => secenekler.includes(o.value));
    const hasSingleOption = filteredOptions.length === 1;

    const effectiveDonem = hasSingleOption ? filteredOptions[0].value : selectedDonem;
    const canBulkAssign = hasSelectedCustomers && !!effectiveDonem;

    const handleBulkAssign = () => {
        if (canBulkAssign) {
            onBulkAssign(beyannameTuru.kod, effectiveDonem as DonemType);
        }
    };

    const handleSelect = useCallback((value: DonemType) => {
        setSelectedDonem(value);
        setIsOpen(false);
    }, []);

    const selectedColors = selectedDonem ? DONEM_COLORS[selectedDonem] : null;

    return (
        <th
            className="sticky bg-background z-10 border-b border-r px-0.5 py-0.5 text-center align-bottom"
            style={{ top: 24 }}
        >
            <div className="flex flex-col items-center gap-1">
                {/* Beyanname kısa adı */}
                <span
                    className="text-[10px] font-bold leading-tight cursor-default truncate block max-w-full"
                    title={beyannameTuru.aciklama}
                >
                    {beyannameTuru.kisaAd || beyannameTuru.kod}
                </span>

                {/* Dönem seçimi — modern mini dropdown */}
                {hasSingleOption ? (
                    <span className={`text-[9px] font-semibold leading-none h-4 flex items-center rounded px-1 ${DONEM_COLORS[filteredOptions[0].value].bg} ${DONEM_COLORS[filteredOptions[0].value].text}`}>
                        {DONEM_SHORT_LABEL_MAP[filteredOptions[0].value] || filteredOptions[0].label}
                    </span>
                ) : (
                    <button
                        ref={triggerRef}
                        onClick={() => setIsOpen(!isOpen)}
                        className={`h-4 w-full max-w-[44px] text-[9px] font-semibold rounded px-0.5 flex items-center justify-center gap-px transition-all duration-100 cursor-pointer ${
                            selectedDonem && selectedColors
                                ? `${selectedColors.bg} ${selectedColors.text}`
                                : "border border-border/60 text-muted-foreground hover:border-border hover:bg-muted/50"
                        }`}
                        title="Dönem seçin"
                    >
                        <span>{selectedDonem ? DONEM_SHORT_LABEL_MAP[selectedDonem] : "—"}</span>
                        <ChevronDown className={`h-2 w-2 opacity-50 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                )}

                {/* Mini dropdown portal */}
                {isOpen && !hasSingleOption && triggerRef.current && (
                    <HeaderDropdown
                        triggerEl={triggerRef.current}
                        options={filteredOptions}
                        selectedDonem={selectedDonem as DonemType | ""}
                        onSelect={handleSelect}
                        onClose={() => setIsOpen(false)}
                    />
                )}

                {/* Ata butonu */}
                <button
                    disabled={!canBulkAssign}
                    onClick={handleBulkAssign}
                    className={`h-5 px-2.5 text-[10px] font-medium rounded-full leading-none transition-all duration-150 ${
                        canBulkAssign
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                            : "text-muted-foreground/30 cursor-not-allowed"
                    }`}
                >
                    Ata
                </button>
            </div>
        </th>
    );
});

// Header hücresindeki mini dropdown
interface HeaderDropdownProps {
    triggerEl: HTMLElement;
    options: { value: DonemType; label: string }[];
    selectedDonem: DonemType | "";
    onSelect: (value: DonemType) => void;
    onClose: () => void;
}

function HeaderDropdown({ triggerEl, options, selectedDonem, onSelect, onClose }: HeaderDropdownProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const rect = triggerEl.getBoundingClientRect();
        const el = ref.current;
        if (!el) return;

        let top = rect.bottom + 4;
        const dropdownWidth = el.offsetWidth || 120;
        let left = rect.left + (rect.width - dropdownWidth) / 2;

        const dropdownHeight = el.offsetHeight || 140;
        if (top + dropdownHeight > window.innerHeight) {
            top = rect.top - dropdownHeight - 4;
        }
        if (left < 4) left = 4;
        if (left + dropdownWidth > window.innerWidth) {
            left = window.innerWidth - dropdownWidth - 8;
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
    }, [triggerEl]);

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
            className="fixed z-[100] bg-popover/95 backdrop-blur-sm border border-border/60 rounded-lg shadow-xl py-1 min-w-[110px] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
        >
            {options.map((opt) => {
                const isActive = selectedDonem === opt.value;
                const colors = DONEM_COLORS[opt.value];
                return (
                    <button
                        key={opt.value}
                        onClick={() => onSelect(opt.value)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-left transition-all duration-100 ${
                            isActive
                                ? `${colors.bg} ${colors.text} font-semibold`
                                : `hover:bg-accent/60 text-foreground/80 ${colors.hoverBg}`
                        }`}
                    >
                        <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${colors.badge} ${isActive ? "" : "opacity-40"}`} />
                        <span className="flex-1">{opt.label}</span>
                        <span className={`text-[9px] font-bold ${isActive ? colors.text : "text-muted-foreground/40"}`}>
                            {DONEM_SHORT_LABEL_MAP[opt.value]}
                        </span>
                    </button>
                );
            })}
        </div>,
        document.body
    );
}
