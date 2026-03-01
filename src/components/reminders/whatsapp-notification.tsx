"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";

interface WhatsAppNotificationProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function WhatsAppNotification({
  enabled,
  onEnabledChange,
  disabled = false,
}: WhatsAppNotificationProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="whatsapp-checkbox"
        checked={enabled}
        onCheckedChange={(checked) => onEnabledChange(checked === true)}
        disabled={disabled}
      />
      <Label
        htmlFor="whatsapp-checkbox"
        className="flex items-center gap-1.5 text-sm cursor-pointer"
      >
        <Icon icon="logos:whatsapp-icon" className="h-4 w-4" />
        WhatsApp bildirimi gönder
      </Label>
    </div>
  );
}
