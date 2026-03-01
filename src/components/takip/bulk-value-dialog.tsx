"use client";

import { memo, useState } from "react";
import { Loader2, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TakipKolon {
  id: string;
  kod: string;
  baslik: string;
  tip: string;
  siraNo: number;
  aktif: boolean;
  sistem: boolean;
}

interface BulkValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  kolonlar: TakipKolon[];
  onConfirm: (kolonKod: string, value: boolean | null) => Promise<void>;
  isLoading?: boolean;
}

// Takip Çizelgesi değer seçenekleri
const VALUE_OPTIONS = [
  {
    value: "true",
    label: "Tamam",
    icon: <Check className="h-4 w-4 text-green-600" />,
    color: "bg-green-100",
  },
  {
    value: "false",
    label: "İptal",
    icon: <X className="h-4 w-4 text-red-600" />,
    color: "bg-red-100",
  },
  {
    value: "null",
    label: "Bekliyor",
    icon: <Clock className="h-4 w-4 text-gray-600" />,
    color: "bg-gray-100",
  },
];

/**
 * Dialog for selecting a column and value for bulk updates in Takip Çizelgesi
 */
export const BulkValueDialog = memo(function BulkValueDialog({
  open,
  onOpenChange,
  selectedCount,
  kolonlar,
  onConfirm,
  isLoading = false,
}: BulkValueDialogProps) {
  const [selectedKolon, setSelectedKolon] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  // Sadece dinamik (sistem olmayan) ve aktif kolonları göster
  const dinamikKolonlar = kolonlar.filter((k) => !k.sistem && k.aktif);

  const handleConfirm = async () => {
    if (!selectedKolon || selectedValue === null) return;

    // Convert string to appropriate type
    let value: boolean | null = null;
    if (selectedValue === "true") value = true;
    else if (selectedValue === "false") value = false;
    else value = null;

    await onConfirm(selectedKolon, value);
    setSelectedKolon(null);
    setSelectedValue(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedKolon(null);
      setSelectedValue(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu Değer Değiştir</DialogTitle>
          <DialogDescription>
            Seçili satırların belirli bir kolonundaki değerleri toplu olarak değiştirin.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span> satır
            için kolon ve değer seçin:
          </p>

          {/* Kolon Seçimi */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Kolon</label>
            <Select
              value={selectedKolon || ""}
              onValueChange={setSelectedKolon}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kolon seçin..." />
              </SelectTrigger>
              <SelectContent>
                {dinamikKolonlar.map((kolon) => (
                  <SelectItem key={kolon.id} value={kolon.kod}>
                    {kolon.baslik}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Değer Seçimi */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Değer</label>
            <div className="grid gap-2">
              {VALUE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedValue(option.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    selectedValue === option.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${option.color}`}
                  >
                    {option.icon}
                  </div>
                  <div className="font-medium text-sm">{option.label}</div>
                  {selectedValue === option.value && (
                    <div className="ml-auto h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
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
            disabled={!selectedKolon || selectedValue === null || isLoading}
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
