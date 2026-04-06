"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, FileText, Files, Link2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import type { BeyannameItem } from "./hooks/use-beyanname-query";

// ═══════════════════════════════════════════════════════════════════════════
// WhatsApp SVG İkonu
// ═══════════════════════════════════════════════════════════════════════════

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="#4aba5a">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════════════════

type SendType = "link" | "document" | "text" | "document_text";

interface BeyannameWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BeyannameItem | null;
  customerName: string;
  customerId: string;
  customerTelefon1: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const SEND_TYPE_OPTIONS: { value: SendType; label: string; description: string; icon: React.ReactNode; iconActive: React.ReactNode }[] = [
  {
    value: "document_text",
    label: "Mesaj + Doküman",
    description: "Önce mesaj, sonra PDF dosyaları gönderilir",
    icon: <Files className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <Files className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "document",
    label: "Sadece Doküman",
    description: "Sadece PDF dosyaları gönderilir",
    icon: <FileText className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <FileText className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "link",
    label: "Link ile Mesaj",
    description: "Dosya linkleri mesaj içinde gönderilir",
    icon: <Link2 className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <Link2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
  {
    value: "text",
    label: "Sadece Mesaj",
    description: "Sadece bilgilendirme mesajı gönderilir",
    icon: <MessageSquare className="w-5 h-5 shrink-0 mt-0.5 text-gray-400" />,
    iconActive: <MessageSquare className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

function generateAutoMessage(customerName: string, item: BeyannameItem): string {
  const truncated = customerName.length > 30 ? customerName.substring(0, 30) + "…" : customerName;
  const donemLabel = formatDonemLabel(item);
  return `${truncated} ${item.turAdi} ${donemLabel}`;
}

function formatDonemLabel(item: BeyannameItem): string {
  const donem = item.donem;
  if (!donem) return "";

  if (donem.length === 12) {
    const basAy = donem.substring(4, 6);
    const basYil = donem.substring(0, 4);
    const bitAy = donem.substring(10, 12);
    const bitYil = donem.substring(6, 10);
    if (basYil === bitYil) {
      return `${parseInt(basAy)}-${parseInt(bitAy)}/${basYil}`;
    }
    return `${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }

  if (donem.length === 6) {
    const ay = parseInt(donem.substring(4, 6));
    const yil = donem.substring(0, 4);
    return `${MONTHS_TR[ay - 1]} ${yil}`;
  }

  return donem;
}

// ═══════════════════════════════════════════════════════════════════════════
// Bileşen
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameWhatsAppDialog({
  open,
  onOpenChange,
  item,
  customerName,
  customerId,
  customerTelefon1,
}: BeyannameWhatsAppDialogProps) {
  const [message, setMessage] = useState("");
  const [sendType, setSendType] = useState<SendType>("document_text");

  const hasPhone = !!customerTelefon1;

  const autoMessage = useMemo(() => {
    if (!item) return "";
    return generateAutoMessage(customerName, item);
  }, [item, customerName]);

  const handleSend = () => {
    toast.info("WhatsApp gönderim altyapısı henüz kurulmadı. Yakında aktif olacak!");
    onOpenChange(false);
    setMessage("");
    setSendType("document_text");
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5" />
            WhatsApp Gönderimi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Özet Bilgi */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 border border-gray-200 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">1</div>
              <div className="text-xs text-gray-500">Dosya</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-xs text-gray-500">Mükellef</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${hasPhone ? "text-emerald-600" : "text-red-500"}`}>
                {hasPhone ? 1 : 0}
              </div>
              <div className="text-xs text-gray-500">Telefon Var</div>
            </div>
          </div>

          {/* Uyarı — telefon yoksa */}
          {!hasPhone && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Mükellefin telefon numarası kayıtlı değil.{" "}
                <Link
                  href={`/dashboard/mukellefler/${customerId}`}
                  className="underline font-medium hover:text-amber-900"
                  onClick={() => onOpenChange(false)}
                >
                  Mükellef detayına git
                </Link>
              </span>
            </div>
          )}

          {/* Beyanname Bilgisi */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800">
              {item.turKodu} — {item.turAdi}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Dönem: {formatDonemLabel(item)} · Mükellef: {customerName}
            </div>
          </div>

          {/* Gönderim Tipi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gönderim Tipi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEND_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSendType(option.value)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors",
                    sendType === option.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-green-300"
                  )}
                >
                  {sendType === option.value ? option.iconActive : option.icon}
                  <div>
                    <div
                      className={cn(
                        "text-sm font-medium",
                        sendType === option.value ? "text-green-700" : "text-gray-700"
                      )}
                    >
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mesaj */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mesaj (Opsiyonel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Boş bırakılırsa otomatik şablon kullanılır..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm resize-none"
            />
            {!message && (
              <p className="text-xs text-gray-400 mt-1">
                Otomatik mesaj: <span className="text-gray-600">{autoMessage}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSend}
            disabled={!hasPhone}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !hasPhone
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            <WhatsAppIcon className="w-4 h-4" />
            {hasPhone ? "1 Müşteriye Gönder" : "Telefon Gerekli"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
