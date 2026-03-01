"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2, Save, Mail, MessageSquare, Phone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Icon } from "@iconify/react";

interface NotificationSettings {
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  smsNotifications: boolean;
  reminderNotifications: boolean;
  taskNotifications: boolean;
  announcementNotifications: boolean;
  hasWhatsappApiKey: boolean;
}

export function NotificationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    whatsappNotifications: false,
    smsNotifications: false,
    reminderNotifications: true,
    taskNotifications: true,
    announcementNotifications: true,
    hasWhatsappApiKey: false,
  });
  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/notifications");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Bildirim ayarları hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          whatsappApiKey: whatsappApiKey || undefined,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(result.message || "Bildirim ayarları güncellendi");
        setWhatsappApiKey("");
        setHasChanges(false);
        fetchSettings();
      } else {
        toast.error(result.error || "Güncelleme başarısız");
      }
    } catch (error) {
      toast.error("Bağlantı hatası");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Bildirim Ayarları</h3>
          <p className="text-sm text-muted-foreground">
            Email, WhatsApp ve SMS bildirim tercihlerinizi yönetin
          </p>
        </div>
      </div>

      {/* Bildirim Kanalları */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Bildirim Kanalları
        </h4>

        <div className="space-y-3">
          {/* Email */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Email Bildirimleri</p>
                <p className="text-sm text-muted-foreground">
                  Önemli güncellemeler için email al
                </p>
              </div>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
            />
          </div>

          {/* WhatsApp */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Icon icon="simple-icons:whatsapp" className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium">WhatsApp Bildirimleri</p>
                <p className="text-sm text-muted-foreground">
                  Hatırlatıcılar ve duyurular için WhatsApp mesajı
                  {!settings.hasWhatsappApiKey && (
                    <span className="text-yellow-600 dark:text-yellow-500">
                      {" "}(API anahtarı gerekli)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.whatsappNotifications}
              onCheckedChange={() => handleToggle("whatsappNotifications")}
              disabled={!settings.hasWhatsappApiKey && !settings.whatsappNotifications}
            />
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between p-4 rounded-lg border opacity-60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium">SMS Bildirimleri</p>
                <p className="text-sm text-muted-foreground">
                  Kritik uyarılar için SMS (Yakında)
                </p>
              </div>
            </div>
            <Switch checked={false} disabled />
          </div>
        </div>
      </div>

      {/* Bildirim Türleri */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Bildirim Türleri
        </h4>

        <div className="space-y-3">
          {/* Hatırlatıcılar */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Hatırlatıcılar</p>
              <p className="text-sm text-muted-foreground">
                Yaklaşan etkinlikler ve görevler için bildirim
              </p>
            </div>
            <Switch
              checked={settings.reminderNotifications}
              onCheckedChange={() => handleToggle("reminderNotifications")}
            />
          </div>

          {/* Görevler */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Görev Bildirimleri</p>
              <p className="text-sm text-muted-foreground">
                Atanan ve güncellenen görevler hakkında bilgi
              </p>
            </div>
            <Switch
              checked={settings.taskNotifications}
              onCheckedChange={() => handleToggle("taskNotifications")}
            />
          </div>

          {/* Duyurular */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Duyuru Bildirimleri</p>
              <p className="text-sm text-muted-foreground">
                Zamanlanmış duyuru gönderim bildirimleri
              </p>
            </div>
            <Switch
              checked={settings.announcementNotifications}
              onCheckedChange={() => handleToggle("announcementNotifications")}
            />
          </div>
        </div>
      </div>

      {/* WhatsApp API Key */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          WhatsApp Entegrasyonu
        </h4>

        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex items-start gap-3">
            <Icon icon="simple-icons:whatsapp" className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Whapi.cloud API Anahtarı</p>
              <p className="text-sm text-muted-foreground mb-3">
                WhatsApp bildirimleri göndermek için API anahtarınızı girin.
                {settings.hasWhatsappApiKey && (
                  <span className="text-green-600 dark:text-green-500 ml-2">
                    (Mevcut anahtar kayıtlı)
                  </span>
                )}
              </p>
              <Input
                type="password"
                placeholder={
                  settings.hasWhatsappApiKey
                    ? "Değiştirmek için yeni anahtar girin"
                    : "API anahtarınızı buraya yapıştırın"
                }
                value={whatsappApiKey}
                onChange={(e) => {
                  setWhatsappApiKey(e.target.value);
                  setHasChanges(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kaydet Butonu */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Kaydediliyor...
            </>
          ) : hasChanges ? (
            <>
              <Save className="h-4 w-4" />
              Değişiklikleri Kaydet
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Kaydedildi
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
