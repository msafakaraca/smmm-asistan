"use client";

import { memo } from "react";
import { X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/**
 * Sticky bottom bar for bulk actions
 * Shows selected count and action buttons
 */
export const BulkActionBar = memo(function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onCancel,
  children,
}: BulkActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t-2 border-blue-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Sol - Seçim Bilgisi */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {selectedCount}
                </span>{" "}
                kayıt seçildi
              </span>
            </div>

            {/* Tümünü Seç / Seçimi Kaldır */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="h-8 px-3 text-xs"
              >
                {allSelected ? (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1.5" />
                    Seçimi Kaldır
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    Tümünü Seç ({totalCount})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Sağ - Aksiyon Butonları */}
          <div className="flex items-center gap-2">
            {children}

            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-9 px-4"
            >
              <X className="h-4 w-4 mr-1.5" />
              İptal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
