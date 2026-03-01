"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Download } from "lucide-react";
import { toast } from "@/components/ui/modern-toast";
import { cn } from "@/lib/utils";

interface VergiLevhasiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

type VergiLevhasiDil = "tr" | "en";
type VergiLevhasiYil = "2023" | "2024" | "2025" | "2026";

export function VergiLevhasiDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: VergiLevhasiDialogProps) {
  const [dil, setDil] = useState<VergiLevhasiDil>("tr");
  const [yil, setYil] = useState<VergiLevhasiYil>("2025");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!customerId) {
      toast.warning("Mükellef seçilmedi", {
        description: "Lütfen önce bir mükellef seçin.",
      });
      return;
    }

    setLoading(true);
    const toastId = "vergi-levhasi-download";

    toast.info("Vergi Levhası İndirme Başlatıldı", {
      id: toastId,
      description: "SMMM Asistan'a yönlendiriyor...",
    });

    try {
      const res = await fetch("/api/bot/launch-gib", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application: "ivd",
          customerId,
          targetPage: "vergi-levhasi",
          vergiLevhasiYil: yil,
          vergiLevhasiDil: dil,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onOpenChange(false);
      } else {
        if (data.code === "BOT_NOT_CONNECTED") {
          toast.error("Electron Bot bağlı değil", {
            id: toastId,
            description: "Lütfen Electron uygulamasını başlatın.",
          });
        } else if (data.code === "CUSTOMER_MISSING_CREDENTIALS") {
          toast.warning("Mükellef GİB bilgileri eksik", {
            id: toastId,
            description: "Mükellef kartından GİB bilgilerini girin.",
          });
        } else if (data.code === "CUSTOMER_NOT_FOUND") {
          toast.error("Mükellef bulunamadı", { id: toastId });
        } else {
          toast.error(data.error || "Hata oluştu", { id: toastId });
        }
      }
    } catch {
      toast.error("Bağlantı hatası", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px] p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-medium">
            Vergi Levhası İndir
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Dil Seçimi */}
          <div className="space-y-2.5">
            <Label className="text-xs text-muted-foreground">Dil</Label>
            <RadioGroup
              value={dil}
              onValueChange={(value: string) => setDil(value as VergiLevhasiDil)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="dil-tr"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm cursor-pointer transition-all",
                  dil === "tr"
                    ? "border-primary bg-primary/10 text-primary font-semibold dark:bg-primary/25 dark:text-primary"
                    : "border-input hover:bg-accent"
                )}
              >
                <RadioGroupItem value="tr" id="dil-tr" className="sr-only" />
                Türkçe
              </Label>
              <Label
                htmlFor="dil-en"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm cursor-pointer transition-all",
                  dil === "en"
                    ? "border-primary bg-primary/10 text-primary font-semibold dark:bg-primary/25 dark:text-primary"
                    : "border-input hover:bg-accent"
                )}
              >
                <RadioGroupItem value="en" id="dil-en" className="sr-only" />
                İngilizce
              </Label>
            </RadioGroup>
          </div>

          {/* Yıl Seçimi */}
          <div className="space-y-2.5">
            <Label className="text-xs text-muted-foreground">Yıl</Label>
            <RadioGroup
              value={yil}
              onValueChange={(value: string) => setYil(value as VergiLevhasiYil)}
              className="grid grid-cols-4 gap-2"
            >
              {["2023", "2024", "2025", "2026"].map((year) => (
                <Label
                  key={year}
                  htmlFor={`yil-${year}`}
                  className={cn(
                    "flex items-center justify-center rounded-md border-2 px-2 py-2.5 text-sm cursor-pointer transition-all",
                    yil === year
                      ? "border-primary bg-primary/10 text-primary font-semibold dark:bg-primary/25 dark:text-primary"
                      : "border-input hover:bg-accent"
                  )}
                >
                  <RadioGroupItem value={year} id={`yil-${year}`} className="sr-only" />
                  {year}
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="pt-4 gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                İndir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
