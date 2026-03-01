"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import type { SendResult } from '../types';

interface SendResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SendResult | null;
  type: 'mail' | 'whatsapp' | 'sms';
}

const TYPE_CONFIG = {
  mail: {
    icon: 'solar:letter-bold',
    color: 'blue',
    label: 'Mail',
  },
  whatsapp: {
    icon: 'solar:chat-round-dots-bold',
    color: 'green',
    label: 'WhatsApp',
  },
  sms: {
    icon: 'solar:smartphone-bold',
    color: 'purple',
    label: 'SMS',
  },
};

export function SendResultDialog({
  open,
  onOpenChange,
  result,
  type,
}: SendResultDialogProps) {
  if (!result) return null;

  const config = TYPE_CONFIG[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              icon={config.icon}
              className={cn('w-5 h-5', `text-${config.color}-600`)}
            />
            {config.label} Gönderim Sonucu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sonuç Özeti */}
          <div
            className={cn(
              'p-6 rounded-lg text-center',
              result.success ? 'bg-emerald-50' : 'bg-amber-50'
            )}
          >
            <div
              className={cn(
                'w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4',
                result.success ? 'bg-emerald-100' : 'bg-amber-100'
              )}
            >
              <Icon
                icon={result.success ? 'solar:check-circle-bold' : 'solar:danger-triangle-bold'}
                className={cn(
                  'w-8 h-8',
                  result.success ? 'text-emerald-600' : 'text-amber-600'
                )}
              />
            </div>
            <h3
              className={cn(
                'text-lg font-semibold mb-2',
                result.success ? 'text-emerald-700' : 'text-amber-700'
              )}
            >
              {result.success ? 'Gönderim Tamamlandı!' : 'Gönderim Kısmen Başarılı'}
            </h3>
            <p className="text-sm text-gray-600">
              {result.sent} / {result.total} dosya başarıyla gönderildi
            </p>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.total}</div>
              <div className="text-xs text-gray-500">Toplam</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{result.sent}</div>
              <div className="text-xs text-emerald-600">Başarılı</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.failed}</div>
              <div className="text-xs text-red-600">Başarısız</div>
            </div>
          </div>

          {/* Hatalar */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Icon icon="solar:danger-circle-bold" className="w-4 h-4 text-red-500" />
                Başarısız Gönderimler ({result.errors.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((error, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="font-medium text-red-700 truncate">
                      {error.customerName}:
                    </span>
                    <span className="text-red-600 truncate">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              `bg-${config.color}-600 hover:bg-${config.color}-700 text-white`
            )}
          >
            Tamam
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
