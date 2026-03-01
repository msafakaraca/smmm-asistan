"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import type {
  AnnouncementCustomer,
  ChannelSettings,
  TemplateWithCount,
} from "../types";
import { TEMPLATE_VARIABLES, replaceTemplateVariables } from "../types";

// ============================================
// TYPES
// ============================================

interface SendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomers: AnnouncementCustomer[];
  templates?: TemplateWithCount[];
  onSend: (params: {
    subject?: string;
    content: string;
    channels: ChannelSettings;
  }) => Promise<void>;
  initialChannels?: ChannelSettings;
}

// ============================================
// COMPONENT
// ============================================

export function SendDialog({
  open,
  onOpenChange,
  selectedCustomers,
  templates = [],
  onSend,
  initialChannels,
}: SendDialogProps) {
  // Form state
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [channels, setChannels] = useState<ChannelSettings>(
    initialChannels || { email: true, sms: false, whatsapp: false }
  );
  const [isSending, setIsSending] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Update channels when initialChannels changes
  React.useEffect(() => {
    if (initialChannels && open) {
      setChannels(initialChannels);
    }
  }, [initialChannels, open]);

  // Customer statistics
  const stats = useMemo(() => {
    const withEmail = selectedCustomers.filter((c) => c.email).length;
    const withPhone = selectedCustomers.filter(
      (c) => c.telefon1 || c.telefon2
    ).length;

    return {
      total: selectedCustomers.length,
      withEmail,
      withPhone,
      withoutEmail: selectedCustomers.length - withEmail,
      withoutPhone: selectedCustomers.length - withPhone,
    };
  }, [selectedCustomers]);

  // Check if at least one channel is selected
  const hasSelectedChannel = channels.email || channels.sms || channels.whatsapp;

  // Check if content is valid
  const isContentValid = content.trim().length > 0;

  // Check if selected channels have recipients
  const hasRecipients = useMemo(() => {
    if (channels.email && stats.withEmail === 0) return false;
    if ((channels.sms || channels.whatsapp) && stats.withPhone === 0) return false;
    return true;
  }, [channels, stats]);

  // Preview with first customer
  const previewContent = useMemo(() => {
    if (!content || selectedCustomers.length === 0) return "";
    return replaceTemplateVariables(content, selectedCustomers[0]);
  }, [content, selectedCustomers]);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") {
      setSubject("");
      setContent("");
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject || "");
      setContent(template.content);
    }
  };

  // Insert variable into content
  const insertVariable = (variable: string) => {
    setContent((prev) => prev + variable);
  };

  // Handle send
  const handleSend = async () => {
    if (!isContentValid) {
      toast.error("Mesaj içeriği boş olamaz");
      return;
    }

    if (!hasSelectedChannel) {
      toast.error("En az bir kanal seçmelisiniz");
      return;
    }

    if (!hasRecipients) {
      toast.error("Seçili kanallarda alıcı bulunamadı");
      return;
    }

    setIsSending(true);
    try {
      await onSend({
        subject: subject || undefined,
        content,
        channels,
      });
      // Reset form on success
      setSubject("");
      setContent("");
      setSelectedTemplateId("");
      setChannels({ email: true, sms: false, whatsapp: false });
      onOpenChange(false);
    } catch (error) {
      console.error("Gönderim hatası:", error);
      toast.error("Gönderim sırasında bir hata oluştu");
    } finally {
      setIsSending(false);
    }
  };

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSubject("");
      setContent("");
      setSelectedTemplateId("");
      setChannels({ email: true, sms: false, whatsapp: false });
      setShowVariables(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              icon="solar:letter-bold"
              className="w-5 h-5 text-blue-600"
            />
            Duyuru Gönder
          </DialogTitle>
          <DialogDescription>
            Seçili mükelleflere duyuru gönderin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Customer Summary */}
          <div className="grid grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats.total}
              </div>
              <div className="text-xs text-muted-foreground">Toplam</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.withEmail}
              </div>
              <div className="text-xs text-muted-foreground">E-posta Var</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {stats.withPhone}
              </div>
              <div className="text-xs text-muted-foreground">Telefon Var</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {stats.withoutEmail}
              </div>
              <div className="text-xs text-muted-foreground">E-posta Yok</div>
            </div>
          </div>

          {/* Channel Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Gönderim Kanalları</Label>
            <div className="flex flex-wrap gap-4">
              {/* E-posta */}
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
                  channels.email
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.email}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, email: !!checked }))
                  }
                  aria-label="E-posta kanalı"
                />
                <Icon
                  icon="solar:letter-bold"
                  className={cn(
                    "w-5 h-5",
                    channels.email ? "text-blue-600" : "text-muted-foreground"
                  )}
                />
                <div>
                  <div className="text-sm font-medium">E-posta</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.withEmail} alıcı
                  </div>
                </div>
              </label>

              {/* SMS */}
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
                  channels.sms
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.sms}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, sms: !!checked }))
                  }
                  aria-label="SMS kanalı"
                />
                <Icon
                  icon="solar:smartphone-bold"
                  className={cn(
                    "w-5 h-5",
                    channels.sms ? "text-purple-600" : "text-muted-foreground"
                  )}
                />
                <div>
                  <div className="text-sm font-medium">SMS</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.withPhone} alıcı
                  </div>
                </div>
              </label>

              {/* WhatsApp */}
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors",
                  channels.whatsapp
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.whatsapp}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, whatsapp: !!checked }))
                  }
                  aria-label="WhatsApp kanalı"
                />
                <Icon
                  icon="logos:whatsapp-icon"
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-sm font-medium">WhatsApp</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.withPhone} alıcı
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template-select">Şablon Seç (Opsiyonel)</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger id="template-select" className="w-full">
                  <SelectValue placeholder="Şablon seçin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Şablon Kullanma</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Konu (Opsiyonel - Sadece E-posta)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E-posta konusu..."
              disabled={isSending}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Mesaj İçeriği *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs"
              >
                <Icon
                  icon={showVariables ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                  className="w-4 h-4 mr-1"
                />
                Değişkenler
              </Button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Mesaj içeriğini yazın..."
              rows={5}
              disabled={isSending}
              className="resize-none"
            />

            {/* Template Variables Help */}
            {showVariables && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Kullanılabilir Değişkenler (tıkla ekle):
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => insertVariable(variable.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-background border rounded hover:bg-accent transition-colors"
                      title={variable.description}
                    >
                      <code className="text-blue-600">{variable.key}</code>
                      <span className="text-muted-foreground">
                        {variable.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {previewContent && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Önizleme (İlk Mükellef)
              </Label>
              <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                {previewContent}
              </div>
            </div>
          )}

          {/* Warnings */}
          {!hasSelectedChannel && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <Icon
                icon="solar:danger-triangle-bold"
                className="w-5 h-5 shrink-0"
              />
              <span>En az bir gönderim kanalı seçmelisiniz.</span>
            </div>
          )}

          {hasSelectedChannel && !hasRecipients && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <Icon
                icon="solar:danger-triangle-bold"
                className="w-5 h-5 shrink-0"
              />
              <span>
                Seçili kanallarda alıcı bulunamadı. Müşterilerin iletişim
                bilgilerini kontrol edin.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSending}
          >
            İptal
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              isSending || !isContentValid || !hasSelectedChannel || !hasRecipients
            }
            className="min-w-[140px]"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:plain-bold" className="w-4 h-4 mr-2" />
                {stats.total} Müşteriye Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
