"use client";

import { memo } from "react";
import { Users, AlertCircle } from "lucide-react";

interface BeyannameBulkBarProps {
    selectedCount: number;
    dirtyCount: number;
}

export const BeyannameBulkBar = memo(function BeyannameBulkBar({
    selectedCount,
    dirtyCount,
}: BeyannameBulkBarProps) {
    if (selectedCount === 0 && dirtyCount === 0) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 rounded-lg border bg-background px-4 py-2 shadow-lg animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-4 text-xs whitespace-nowrap">
                {selectedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                            Seçili: <span className="font-semibold text-foreground">{selectedCount}</span> mükellef
                        </span>
                    </div>
                )}
                {dirtyCount > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>
                            Kaydedilmemiş: <span className="font-semibold">{dirtyCount}</span> değişiklik
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});
