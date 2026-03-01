"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import type { BulkSendDocument } from '../types';

interface SmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: BulkSendDocument[];
  onSend: (params: { message?: string }) => Promise<void>;
}

export function SmsDialog({
  open,
  onOpenChange,
  selectedDocuments,
  onSend,
}: SmsDialogProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Benzersiz müşteri sayısı
  const uniqueCustomers = new Set(selectedDocuments.map((d) => d.customerId)).size;

  // Telefonu olan müşteriler
  const customersWithPhone = new Set(
    selectedDocuments.filter((d) => d.customerTelefon1 || d.customerTelefon2).map((d) => d.customerId)
  ).size;

  // Karakter sayısı hesapla
  const charCount = message.length;
  const smsCount = Math.ceil((charCount || 160) / 160);
  const hasTurkishChars = /[çğıöşüÇĞİÖŞÜ]/.test(message);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onSend({
        message: message || undefined,
      });
      onOpenChange(false);
      // Reset form
      setMessage('');
    } catch (error) {
      console.error('SMS gönderme hatası:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:smartphone-bold" className="w-5 h-5 text-purple-600" />
            Toplu SMS Gönderimi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Özet Bilgi */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {selectedDocuments.length}
              </div>
              <div className="text-xs text-gray-500">Dosya</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{uniqueCustomers}</div>
              <div className="text-xs text-gray-500">Mükellef</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {customersWithPhone}
              </div>
              <div className="text-xs text-gray-500">Telefon Var</div>
            </div>
          </div>

          {/* Uyarı - Telefon yok */}
          {customersWithPhone < uniqueCustomers && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 shrink-0" />
              <span>
                {uniqueCustomers - customersWithPhone} mükellefin telefon numarası kayıtlı değil.
                Bu mükelleflere SMS gönderilemeyecek.
              </span>
            </div>
          )}

          {/* Uyarı - Türkçe karakter */}
          {hasTurkishChars && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
              <Icon icon="solar:info-circle-bold" className="w-5 h-5 shrink-0" />
              <span>
                Türkçe karakter kullanımı SMS maliyetini 2 katına çıkarır.
                Otomatik şablonda Türkçe karakterler kullanılmaz.
              </span>
            </div>
          )}

          {/* Mesaj */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                SMS Mesajı (Opsiyonel)
              </label>
              <span className="text-xs text-gray-500">
                {charCount} karakter / {smsCount} SMS
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Boş bırakılırsa otomatik şablon kullanılır (Türkçe karaktersiz)..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-sm resize-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              160 karakteri aşan mesajlar birden fazla SMS olarak gönderilir.
            </p>
          </div>

          {/* Maliyet Tahmini */}
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tahmini SMS Sayısı:</span>
              <span className="font-medium text-purple-700">
                {customersWithPhone} x {smsCount} = {customersWithPhone * smsCount} SMS
              </span>
            </div>
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
            disabled={isSending || customersWithPhone === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isSending || customersWithPhone === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            )}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:smartphone-bold" className="w-4 h-4" />
                {customersWithPhone} Müşteriye Gönder
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
