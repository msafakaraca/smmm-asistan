"use client";

import { memo } from "react";
import {
    DONEM_SHORT_LABEL_MAP,
    DONEM_OPTIONS,
    type DonemType,
} from "./hooks/use-beyanname-yonetimi";

interface BeyannameDataCellProps {
    customerId: string;
    beyannameKod: string;
    currentDonem: DonemType | null;
    donemSecenekleri: string[];
    onChange: (customerId: string, beyannameKod: string, donem: DonemType | null) => void;
    onOpenDropdown: (
        customerId: string,
        beyannameKod: string,
        currentDonem: DonemType | null,
        donemSecenekleri: string[],
        anchorEl: HTMLElement
    ) => void;
}

export const BeyannameDataCell = memo(function BeyannameDataCell({
    customerId,
    beyannameKod,
    currentDonem,
    donemSecenekleri,
    onChange,
    onOpenDropdown,
}: BeyannameDataCellProps) {
    const filteredOptions = DONEM_OPTIONS.filter((o) => donemSecenekleri.includes(o.value));
    const hasSingleOption = filteredOptions.length === 1;

    const shortLabel = currentDonem
        ? (DONEM_SHORT_LABEL_MAP[currentDonem] || currentDonem)
        : null;

    return (
        <td
            className="border-b border-r px-0.5 py-0.5 text-center align-middle"
        >
            {currentDonem ? (
                // Atanmış durum
                hasSingleOption ? (
                    <button
                        onClick={() => onChange(customerId, beyannameKod, null)}
                        className="inline-flex items-center justify-center h-5 w-full rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Kaldırmak için tıklayın"
                    >
                        {shortLabel}
                    </button>
                ) : (
                    <button
                        onClick={(e) => onOpenDropdown(customerId, beyannameKod, currentDonem, donemSecenekleri, e.currentTarget)}
                        className="inline-flex items-center justify-center h-5 w-full rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors gap-0.5"
                    >
                        {shortLabel}
                        <svg className="h-2.5 w-2.5 opacity-50 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                )
            ) : (
                // Atanmamış durum
                hasSingleOption ? (
                    <button
                        onClick={() => onChange(customerId, beyannameKod, filteredOptions[0].value)}
                        className="inline-flex items-center justify-center h-5 w-full rounded text-[10px] text-muted-foreground/30 hover:bg-muted hover:text-foreground transition-colors"
                        title={`${filteredOptions[0].label} olarak ata`}
                    >
                        —
                    </button>
                ) : (
                    <button
                        onClick={(e) => onOpenDropdown(customerId, beyannameKod, null, donemSecenekleri, e.currentTarget)}
                        className="inline-flex items-center justify-center h-5 w-full rounded text-[10px] text-muted-foreground/30 hover:bg-muted hover:text-foreground transition-colors"
                    >
                        —
                    </button>
                )
            )}
        </td>
    );
});
