"use client";

/**
 * Vergi Levhası WhatsApp Gönderim Dialog
 * ========================================
 * Tek mükellefin vergi levhası PDF'ini WhatsApp ile gönderir.
 * Referans: beyanname-whatsapp-dialog.tsx
 */

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, FileText, Files, Link2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════
// WhatsApp Icon
// ═══════════════════════════════════════════════════════════════════════════

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="#4aba5a">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type SendType = "link" | "document" | "text" | "document_text";

interface VergiLevhasiWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId: string;
  customerTelefon1: string | null;
  onayKodu: string;
  onayZamani: string;
}

const SEND_TYPE_OPTIONS: { value: SendType; label: string; description: string; icon: React.ReactNode; iconActive: React.ReactNode }[] = [
  {
    value: "document_text",
    label: "Mesaj + Doküman",
    description: "Önce mesaj, sonra PDF gönderilir",
    icon: <Files className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <Files className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "document",
    label: "Sadece Doküman",
    description: "PDF dosyası gönderilir",
    icon: <FileText className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <FileText className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "link",
    label: "Sadece Link",
    description: "İndirme linki gönderilir",
    icon: <Link2 className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <Link2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "text",
    label: "Sadece Mesaj",
    description: "Bilgilendirme mesajı gönderilir",
    icon: <MessageSquare className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <MessageSquare className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function VergiLevhasiWhatsAppDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
  customerTelefon1,
  onayKodu,
  onayZamani,
}: VergiLevhasiWhatsAppDialogProps) {
  const [message, setMessage] = useState("");
  const [sendType, setSendType] = useState<SendType>("document_text");

  const hasPhone = !!customerTelefon1;

  const autoMessage = useMemo(() => {
    return `Sayın ${customerName},\n\n${onayZamani || ""} tarihli Vergi Levhanız (Onay Kodu: ${onayKodu}) ektedir.\n\nBilginize.`;
  }, [customerName, onayKodu, onayZamani]);

  const handleSend = () => {
    toast.info("WhatsApp gönderim altyapısı henüz kurulmadı");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5" />
            WhatsApp ile Gönder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bilgi özeti */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">1</div>
              <div className="text-xs text-muted-foreground">Dosya</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">1</div>
              <div className="text-xs text-muted-foreground">Mükellef</div>
            </div>
            <div className={cn(
              "rounded-lg border p-3 text-center",
              !hasPhone && "border-red-200 bg-red-50"
            )}>
              <div className={cn("text-2xl font-bold", !hasPhone && "text-red-600")}>
                {hasPhone ? "1" : "0"}
              </div>
              <div className={cn("text-xs", hasPhone ? "text-muted-foreground" : "text-red-500")}>
                Telefon
              </div>
            </div>
          </div>

          {/* Telefon yoksa uyarı */}
          {!hasPhone && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-amber-800">Mükellefin telefon numarası eksik. </span>
                <Link
                  href={`/dashboard/mukellefler/${customerId}`}
                  className="text-amber-700 underline"
                >
                  Mükellef bilgilerini düzenleyin
                </Link>
              </div>
            </div>
          )}

          {/* Doküman bilgisi */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <div className="text-sm font-medium text-green-800">Vergi Levhası</div>
            <div className="text-xs text-green-600 mt-0.5">
              {customerName} · Onay: {onayKodu} · {onayZamani}
            </div>
          </div>

          {/* Gönderim tipi */}
          <div>
            <div className="text-sm font-medium mb-2">Gönderim Tipi</div>
            <div className="grid grid-cols-2 gap-2">
              {SEND_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSendType(opt.value)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    sendType === opt.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {sendType === opt.value ? opt.iconActive : opt.icon}
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mesaj */}
          <div>
            <div className="text-sm font-medium mb-2">Mesaj (Opsiyonel)</div>
            <Textarea
              placeholder="Boş bırakılırsa otomatik şablon kullanılır..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            {!message && (
              <div className="mt-1.5 p-2 rounded bg-muted/50 text-xs text-muted-foreground whitespace-pre-line">
                {autoMessage}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            onClick={handleSend}
            disabled={!hasPhone}
            className="bg-green-600 hover:bg-green-700"
          >
            <WhatsAppIcon className="h-4 w-4 mr-2" />
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
