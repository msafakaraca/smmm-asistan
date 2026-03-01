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

interface MailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: BulkSendDocument[];
  onSend: (params: { subject?: string; body?: string; groupByCustomer: boolean }) => Promise<void>;
}

export function MailDialog({
  open,
  onOpenChange,
  selectedDocuments,
  onSend,
}: MailDialogProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [groupByCustomer, setGroupByCustomer] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Benzersiz müşteri sayısı
  const uniqueCustomers = new Set(selectedDocuments.map((d) => d.customerId)).size;

  // Mail adresi olan müşteriler
  const customersWithEmail = new Set(
    selectedDocuments.filter((d) => d.customerEmail).map((d) => d.customerId)
  ).size;

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onSend({
        subject: subject || undefined,
        body: body || undefined,
        groupByCustomer,
      });
      onOpenChange(false);
      // Reset form
      setSubject('');
      setBody('');
    } catch (error) {
      console.error('Mail gönderme hatası:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:letter-bold" className="w-5 h-5 text-blue-600" />
            Toplu Mail Gönderimi
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
              <div className="text-2xl font-bold text-blue-600">{uniqueCustomers}</div>
              <div className="text-xs text-gray-500">Mükellef</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {customersWithEmail}
              </div>
              <div className="text-xs text-gray-500">E-posta Var</div>
            </div>
          </div>

          {/* Uyarı */}
          {customersWithEmail < uniqueCustomers && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 shrink-0" />
              <span>
                {uniqueCustomers - customersWithEmail} mükellefin e-posta adresi kayıtlı değil.
                Bu mükelleflere mail gönderilemeyecek.
              </span>
            </div>
          )}

          {/* Gruplandırma */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="groupByCustomer"
              checked={groupByCustomer}
              onChange={(e) => setGroupByCustomer(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="groupByCustomer" className="text-sm text-gray-700 flex-1">
              <span className="font-medium">Müşteri bazında grupla</span>
              <span className="block text-xs text-gray-500">
                Her müşteriye ait tüm dosyalar tek bir mailde gönderilir
              </span>
            </label>
          </div>

          {/* Konu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mail Konusu (Opsiyonel)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Boş bırakılırsa otomatik oluşturulur..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          {/* İçerik */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mail İçeriği (Opsiyonel)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Boş bırakılırsa otomatik şablon kullanılır..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
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
            disabled={isSending || customersWithEmail === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isSending || customersWithEmail === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:plain-bold" className="w-4 h-4" />
                {customersWithEmail} Müşteriye Gönder
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
