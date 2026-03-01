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
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/modern-toast";
import { cn } from "@/lib/utils";

interface IskurGirisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  hasIskurCredentials: boolean;
  hasEdevletCredentials: boolean;
}

type LoginMethod = "iskur" | "edevlet";

export function IskurGirisDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  hasIskurCredentials,
  hasEdevletCredentials,
}: IskurGirisDialogProps) {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("iskur");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    // Credential check
    if (loginMethod === "iskur" && !hasIskurCredentials) {
      toast.warning("İŞKUR bilgileri eksik", {
        description: "Şifreler > İŞKUR İşveren Sistemi'nden bilgileri girin.",
      });
      return;
    }

    if (loginMethod === "edevlet" && !hasEdevletCredentials) {
      toast.warning("e-Devlet bilgileri eksik", {
        description: "Şifreler > e-Devlet Kapısı'ndan bilgileri girin.",
      });
      return;
    }

    setLoading(true);
    const toastId = "iskur-launch";

    toast.info("İŞKUR İşveren Sistemi Başlatılıyor", {
      id: toastId,
      description: "SMMM Asistan'a yönlendiriyor...",
    });

    try {
      const res = await fetch("/api/bot/launch-iskur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, loginMethod }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "İŞKUR başlatıldı", { id: toastId });
        onOpenChange(false);
      } else {
        if (data.code === "BOT_NOT_CONNECTED") {
          toast.error("SMMM Asistan Masaüstü Uygulamasını Çalıştırın", {
            id: toastId,
            description: "Lütfen Electron uygulamasını başlatın.",
          });
        } else if (data.code === "CUSTOMER_MISSING_ISKUR_CREDENTIALS") {
          toast.warning("İŞKUR bilgileri eksik", {
            id: toastId,
            description: "Şifreler > İŞKUR İşveren Sistemi'nden bilgileri girin.",
          });
        } else if (data.code === "CUSTOMER_MISSING_EDEVLET_CREDENTIALS") {
          toast.warning("e-Devlet bilgileri eksik", {
            id: toastId,
            description: "Şifreler > e-Devlet Kapısı'ndan bilgileri girin.",
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
      <DialogContent className="sm:max-w-[380px] p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-medium">
            İŞKUR İşveren Sistemi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Kart 1: ISKUR Bilgileriyle Baglan */}
          <button
            type="button"
            onClick={() => setLoginMethod("iskur")}
            className={cn(
              "w-full flex items-center justify-center rounded-lg border-2 p-4 transition-all",
              loginMethod === "iskur"
                ? "border-primary bg-primary/10 dark:bg-primary/25"
                : "border-input hover:bg-accent"
            )}
          >
            <span className="text-sm font-semibold">İŞKUR Bilgileriyle Giriş</span>
          </button>

          {/* Kart 2: E-Devlet ile Baglan */}
          <button
            type="button"
            onClick={() => setLoginMethod("edevlet")}
            className={cn(
              "w-full flex items-center justify-center rounded-lg border-2 p-4 transition-all",
              loginMethod === "edevlet"
                ? "border-primary bg-primary/10 dark:bg-primary/25"
                : "border-input hover:bg-accent"
            )}
          >
            <span className="text-sm font-semibold">E-Devlet ile Giriş</span>
          </button>
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
          <Button size="sm" onClick={handleConnect} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                Bağlan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
