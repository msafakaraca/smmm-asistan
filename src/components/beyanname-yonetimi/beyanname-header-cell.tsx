"use client";

import { memo, useState } from "react";
import {
    DONEM_OPTIONS,
    DONEM_SHORT_LABEL_MAP,
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

    return (
        <th
            className="sticky bg-background z-10 border-b border-r px-0.5 py-0.5 text-center align-bottom"
            style={{ top: 24 }}
        >
            <div className="flex flex-col items-center gap-0.5">
                {/* Beyanname kısa adı */}
                <span
                    className="text-[10px] font-bold leading-tight cursor-default truncate block max-w-full"
                    title={beyannameTuru.aciklama}
                >
                    {beyannameTuru.kisaAd || beyannameTuru.kod}
                </span>

                {/* Dönem seçimi — kompakt */}
                {hasSingleOption ? (
                    <span className="text-[9px] text-muted-foreground font-medium leading-none h-4 flex items-center">
                        {DONEM_SHORT_LABEL_MAP[filteredOptions[0].value] || filteredOptions[0].label}
                    </span>
                ) : (
                    <select
                        value={selectedDonem}
                        onChange={(e) => setSelectedDonem(e.target.value as DonemType)}
                        className="h-4 w-full max-w-[44px] text-[9px] border rounded px-0.5 bg-background text-foreground cursor-pointer appearance-auto"
                        title="Dönem seçin"
                    >
                        <option value="">—</option>
                        {filteredOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {DONEM_SHORT_LABEL_MAP[opt.value] || opt.label}
                            </option>
                        ))}
                    </select>
                )}

                {/* Ata butonu — kompakt */}
                <button
                    disabled={!canBulkAssign}
                    onClick={handleBulkAssign}
                    className={`h-4 px-1.5 text-[9px] font-medium rounded leading-none transition-colors ${
                        canBulkAssign
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "text-muted-foreground/40 cursor-not-allowed"
                    }`}
                >
                    Ata
                </button>
            </div>
        </th>
    );
});
