"use client";

import { memo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export interface StatusOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  selectedCount: number;
  statusOptions: StatusOption[];
  onConfirm: (status: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Dialog for selecting a new status for bulk updates
 */
export const StatusChangeDialog = memo(function StatusChangeDialog({
  open,
  onOpenChange,
  title,
  description,
  selectedCount,
  statusOptions,
  onConfirm,
  isLoading = false,
}: StatusChangeDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selectedStatus) return;
    await onConfirm(selectedStatus);
    setSelectedStatus(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedStatus(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-semibold text-foreground">{selectedCount}</span> kayıt
            için yeni durum seçin:
          </p>

          <div className="grid gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedStatus(option.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                  selectedStatus === option.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${option.color}`}
                >
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </div>
                {selectedStatus === option.value && (
                  <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStatus || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Güncelleniyor...
              </>
            ) : (
              "Uygula"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
