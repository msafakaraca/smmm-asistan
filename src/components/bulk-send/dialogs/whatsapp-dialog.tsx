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

type SendType = 'link' | 'document' | 'text' | 'document_text';

interface WhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: BulkSendDocument[];
  onSend: (params: { message?: string; sendType: SendType }) => Promise<void>;
}

const SEND_TYPE_OPTIONS: { value: SendType; label: string; description: string; icon: string }[] = [
  {
    value: 'document_text',
    label: 'Mesaj + Doküman',
    description: 'Önce mesaj, sonra PDF dosyaları gönderilir',
    icon: 'solar:documents-bold',
  },
  {
    value: 'document',
    label: 'Sadece Doküman',
    description: 'Sadece PDF dosyaları gönderilir',
    icon: 'solar:document-bold',
  },
  {
    value: 'link',
    label: 'Link ile Mesaj',
    description: 'Dosya linkleri mesaj içinde gönderilir',
    icon: 'solar:link-bold',
  },
  {
    value: 'text',
    label: 'Sadece Mesaj',
    description: 'Sadece bilgilendirme mesajı gönderilir',
    icon: 'solar:chat-line-bold',
  },
];

export function WhatsAppDialog({
  open,
  onOpenChange,
  selectedDocuments,
  onSend,
}: WhatsAppDialogProps) {
  const [message, setMessage] = useState('');
  const [sendType, setSendType] = useState<SendType>('document_text');
  const [isSending, setIsSending] = useState(false);

  // Benzersiz müşteri sayısı
  const uniqueCustomers = new Set(selectedDocuments.map((d) => d.customerId)).size;

  // Telefonu olan müşteriler
  const customersWithPhone = new Set(
    selectedDocuments.filter((d) => d.customerTelefon1 || d.customerTelefon2).map((d) => d.customerId)
  ).size;

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onSend({
        message: message || undefined,
        sendType,
      });
      onOpenChange(false);
      // Reset form
      setMessage('');
      setSendType('document_text');
    } catch (error) {
      console.error('WhatsApp gönderme hatası:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:chat-round-dots-bold" className="w-5 h-5 text-green-600" />
            Toplu WhatsApp Gönderimi
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
              <div className="text-2xl font-bold text-green-600">{uniqueCustomers}</div>
              <div className="text-xs text-gray-500">Mükellef</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {customersWithPhone}
              </div>
              <div className="text-xs text-gray-500">Telefon Var</div>
            </div>
          </div>

          {/* Uyarı */}
          {customersWithPhone < uniqueCustomers && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 shrink-0" />
              <span>
                {uniqueCustomers - customersWithPhone} mükellefin telefon numarası kayıtlı değil.
                Bu mükelleflere WhatsApp gönderilemeyecek.
              </span>
            </div>
          )}

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
                    'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
                    sendType === option.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  )}
                >
                  <Icon
                    icon={option.icon}
                    className={cn(
                      'w-5 h-5 shrink-0 mt-0.5',
                      sendType === option.value ? 'text-green-600' : 'text-gray-400'
                    )}
                  />
                  <div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        sendType === option.value ? 'text-green-700' : 'text-gray-700'
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
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4" />
                {customersWithPhone} Müşteriye Gönder
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
