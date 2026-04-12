"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import type { BeyannameItem } from "./hooks/use-beyanname-query";

// ═══════════════════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════════════════

interface BeyannameMailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BeyannameItem | null;
  customerName: string;
  customerId: string;
  customerEmail: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

function generateAutoSubject(customerName: string, item: BeyannameItem): string {
  const truncated = customerName.length > 30 ? customerName.substring(0, 30) + "…" : customerName;
  const donem = item.donem;

  if (!donem) return `${truncated} ${item.turAdi}`;

  // Çoklu dönem: "202510202512" → "10-12/2025"
  if (donem.length === 12) {
    const basAy = parseInt(donem.substring(4, 6));
    const basYil = donem.substring(0, 4);
    const bitAy = parseInt(donem.substring(10, 12));
    const bitYil = donem.substring(6, 10);

    if (basYil === bitYil) {
      return `${truncated} ${item.turAdi} ${basAy}-${bitAy}/${basYil}`;
    }
    return `${truncated} ${item.turAdi} ${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }

  // Tekli dönem: "202510" → "Ekim KDV1 Beyannamesi"
  if (donem.length === 6) {
    const ay = parseInt(donem.substring(4, 6));
    const yil = donem.substring(0, 4);
    const ayAdi = MONTHS_TR[ay - 1] || "";
    return `${truncated} ${ayAdi} ${item.turAdi} ${yil}`;
  }

  return `${truncated} ${item.turAdi}`;
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

export default function BeyannameMailDialog({
  open,
  onOpenChange,
  item,
  customerName,
  customerId,
  customerEmail,
}: BeyannameMailDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const hasEmail = !!customerEmail;

  const autoSubject = useMemo(() => {
    if (!item) return "";
    return generateAutoSubject(customerName, item);
  }, [item, customerName]);

  const autoBody = useMemo(() => {
    if (!item) return "";
    const donemLabel = formatDonemLabel(item);
    const donemPart = donemLabel ? ` ${donemLabel} dönemi` : "";
    return `Sayın ${customerName},\n\n${item.turAdi}${donemPart} ekte gönderilmiştir.\n\nBilginize.`;
  }, [item, customerName]);

  // Dialog açıldığında otomatik konuyu doldur
  useEffect(() => {
    if (open && item) {
      setSubject(generateAutoSubject(customerName, item));
      setBody("");
    }
  }, [open, item, customerName]);

  const handleSend = () => {
    toast.info("Mail gönderim altyapısı henüz kurulmadı. Yakında aktif olacak!");
    onOpenChange(false);
    setSubject("");
    setBody("");
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Mail Gönderimi
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
              <div className="text-2xl font-bold text-blue-600">1</div>
              <div className="text-xs text-gray-500">Mükellef</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${hasEmail ? "text-emerald-600" : "text-red-500"}`}>
                {hasEmail ? 1 : 0}
              </div>
              <div className="text-xs text-gray-500">E-posta Var</div>
            </div>
          </div>

          {/* Uyarı — email yoksa */}
          {!hasEmail && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Mükellefin e-posta adresi kayıtlı değil.{" "}
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
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-800">
              {item.turKodu} — {item.turAdi}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Dönem: {formatDonemLabel(item)} · Mükellef: {customerName}
            </div>
          </div>

          {/* Mail Konusu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mail Konusu
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={autoSubject}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Otomatik oluşturuldu. Değiştirmek isterseniz düzenleyebilirsiniz.
            </p>
          </div>

          {/* Mail İçeriği */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mail İçeriği (Opsiyonel)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Boş bırakılırsa otomatik şablon kullanılır..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
            />
            {!body && (
              <div className="mt-1.5 p-2 rounded bg-muted/50 text-xs text-muted-foreground whitespace-pre-line">
                {autoBody}
              </div>
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
            disabled={!hasEmail}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !hasEmail
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            <Send className="w-4 h-4" />
            {hasEmail ? "1 Müşteriye Gönder" : "E-posta Gerekli"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
