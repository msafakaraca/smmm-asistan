"use client";

import { Archive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

interface ArchiveOverlapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlapInfo: {
    month: number;
    year: number;
    totalCount: number;
    lastQueriedAt: string;
    customerName: string;
    archiveId: string;
  } | null;
  onShowArchive: () => void;
  onRequery: () => void;
}

export default function ArchiveOverlapDialog({
  open,
  onOpenChange,
  overlapInfo,
  onShowArchive,
  onRequery,
}: ArchiveOverlapDialogProps) {
  if (!overlapInfo) return null;

  const lastDate = new Date(overlapInfo.lastQueriedAt).toLocaleDateString(
    "tr-TR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mevcut Arşiv Bulundu</DialogTitle>
          <DialogDescription>
            <strong>{overlapInfo.customerName}</strong> için{" "}
            <strong>
              {AY_ISIMLERI[overlapInfo.month - 1]} {overlapInfo.year}
            </strong>{" "}
            dönemine ait {overlapInfo.totalCount} kayıtlık bir arşiv zaten mevcut.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          Son sorgu: {lastDate}
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3">
          <Button variant="outline" onClick={onShowArchive}>
            <Archive className="h-4 w-4 mr-2" />
            Arşivden Göster
          </Button>
          <Button onClick={onRequery}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yeniden Sorgula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
