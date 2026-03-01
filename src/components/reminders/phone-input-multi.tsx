"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Plus, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  phoneNumber?: string;
  onPhoneNumberChange: (phoneNumber: string) => void;
  sendWhatsApp: boolean;
  onSendWhatsAppChange: (send: boolean) => void;
  disabled?: boolean;
}

export function PhoneInput({
  phoneNumber,
  onPhoneNumberChange,
  sendWhatsApp,
  onSendWhatsAppChange,
  disabled = false,
}: PhoneInputProps) {
  const formatPhoneNumber = (value: string): string => {
    // Sadece rakamları al
    const digits = value.replace(/\D/g, "");

    // 10 haneden fazlasını kabul etme
    const limited = digits.slice(0, 10);

    // Format: 5XX XXX XX XX
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    } else if (limited.length <= 8) {
      return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6, 8)} ${limited.slice(8)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onPhoneNumberChange(formatted);
  };

  const getCleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, "");
  };

  const isValidPhone = phoneNumber
    ? getCleanPhoneNumber(phoneNumber).length === 10
    : false;

  return (
    <div className="space-y-4">
      {/* Telefon Numarası */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Telefon Numarası
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
            +90
          </span>
          <Input
            type="tel"
            value={phoneNumber || ""}
            onChange={handlePhoneChange}
            placeholder="5XX XXX XX XX"
            disabled={disabled}
            className={cn(
              "rounded-l-none",
              phoneNumber && !isValidPhone && "border-destructive"
            )}
          />
        </div>
        {phoneNumber && !isValidPhone && (
          <p className="text-xs text-destructive">
            Geçerli bir telefon numarası girin (10 hane)
          </p>
        )}
      </div>

      {/* WhatsApp Gönderimi */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="sendWhatsApp"
          checked={sendWhatsApp}
          onCheckedChange={(checked) => onSendWhatsAppChange(checked === true)}
          disabled={disabled || !isValidPhone}
        />
        <Label
          htmlFor="sendWhatsApp"
          className={cn(
            "text-sm cursor-pointer flex items-center gap-2",
            (!isValidPhone || disabled) && "text-muted-foreground"
          )}
        >
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp ile hatırlat
        </Label>
      </div>

      {sendWhatsApp && isValidPhone && (
        <p className="text-xs text-muted-foreground">
          Anımsatıcı zamanında +90{getCleanPhoneNumber(phoneNumber || "")}{" "}
          numarasına WhatsApp mesajı gönderilecek.
        </p>
      )}
    </div>
  );
}

// Çoklu telefon girişi için (gelecekte kullanılabilir)
interface MultiPhoneInputProps {
  phoneNumbers: string[];
  onPhoneNumbersChange: (phoneNumbers: string[]) => void;
  maxNumbers?: number;
  disabled?: boolean;
}

export function MultiPhoneInput({
  phoneNumbers,
  onPhoneNumbersChange,
  maxNumbers = 5,
  disabled = false,
}: MultiPhoneInputProps) {
  const [newPhone, setNewPhone] = useState("");

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8)
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  };

  const addPhoneNumber = () => {
    const clean = newPhone.replace(/\D/g, "");
    if (clean.length === 10 && !phoneNumbers.includes(newPhone)) {
      onPhoneNumbersChange([...phoneNumbers, newPhone]);
      setNewPhone("");
    }
  };

  const removePhoneNumber = (index: number) => {
    onPhoneNumbersChange(phoneNumbers.filter((_, i) => i !== index));
  };

  const canAdd =
    phoneNumbers.length < maxNumbers &&
    newPhone.replace(/\D/g, "").length === 10;

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Phone className="h-4 w-4" />
        Telefon Numaraları
      </Label>

      {/* Mevcut numaralar */}
      {phoneNumbers.length > 0 && (
        <div className="space-y-2">
          {phoneNumbers.map((phone, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted rounded-md"
            >
              <span className="text-sm flex-1">+90 {phone}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePhoneNumber(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Yeni numara ekle */}
      {phoneNumbers.length < maxNumbers && (
        <div className="flex gap-2">
          <div className="flex items-center flex-1">
            <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
              +90
            </span>
            <Input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
              placeholder="5XX XXX XX XX"
              disabled={disabled}
              className="rounded-l-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdd) {
                  e.preventDefault();
                  addPhoneNumber();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addPhoneNumber}
            disabled={disabled || !canAdd}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {phoneNumbers.length}/{maxNumbers} numara eklendi
      </p>
    </div>
  );
}
