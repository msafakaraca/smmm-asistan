"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Loader2,
  Users,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface SubscriptionData {
  plan: {
    name: string;
    code: string;
    status: string;
    expiresAt: string | null;
    daysRemaining: number | null;
    features: string[];
  };
  license: {
    key: string;
    type: string;
    status: string;
    isActive: boolean;
    activatedAt: string | null;
    features: string[];
  } | null;
  usage: {
    users: {
      current: number;
      max: number;
      percentage: number;
    };
    customers: {
      current: number;
      max: number;
      percentage: number;
    };
  };
  createdAt: string;
}

export function SubscriptionTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/settings/subscription");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error("Abonelik bilgileri hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Abonelik bilgileri yüklenemedi
      </div>
    );
  }

  const getPlanBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "trial":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "expired":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 70) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Abonelik ve Kullanım</h3>
          <p className="text-sm text-muted-foreground">
            Mevcut planınız ve kullanım istatistikleriniz
          </p>
        </div>
      </div>

      {/* Mevcut Plan */}
      <div className="p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h4 className="text-xl font-bold">{data.plan.name} Plan</h4>
              <Badge className={getPlanBadgeColor(data.plan.status)}>
                {data.plan.status === "active" ? "Aktif" : data.plan.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {data.plan.daysRemaining !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {data.plan.daysRemaining > 0
                    ? `${data.plan.daysRemaining} gün kaldı`
                    : "Süre doldu"}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Başlangıç: {new Date(data.createdAt).toLocaleDateString("tr-TR")}
              </span>
            </div>
          </div>
          <Button variant="outline" disabled className="gap-2">
            <Sparkles className="h-4 w-4" />
            Planı Yükselt (Yakında)
          </Button>
        </div>

        {/* Özellikler */}
        <div className="mt-4 pt-4 border-t border-primary/10">
          <p className="text-sm font-medium mb-2">Plan Özellikleri:</p>
          <div className="flex flex-wrap gap-2">
            {data.plan.features.map((feature, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-background"
              >
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Kullanım İstatistikleri */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Kullanıcılar */}
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Kullanıcılar</span>
            </div>
            <span className={`text-sm font-semibold ${getUsageColor(data.usage.users.percentage)}`}>
              {data.usage.users.current} / {data.usage.users.max}
            </span>
          </div>
          <Progress value={data.usage.users.percentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            %{data.usage.users.percentage} kullanıldı
          </p>
        </div>

        {/* Müşteriler */}
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Müşteriler</span>
            </div>
            <span className={`text-sm font-semibold ${getUsageColor(data.usage.customers.percentage)}`}>
              {data.usage.customers.current} / {data.usage.customers.max}
            </span>
          </div>
          <Progress value={data.usage.customers.percentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            %{data.usage.customers.percentage} kullanıldı
          </p>
        </div>
      </div>

      {/* Lisans Bilgileri */}
      {data.license && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="font-medium">Lisans Bilgileri</span>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lisans Anahtarı:</span>
              <code className="font-mono">{data.license.key}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tip:</span>
              <span className="capitalize">{data.license.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durum:</span>
              <Badge
                variant={data.license.isActive ? "default" : "secondary"}
                className="h-5"
              >
                {data.license.isActive ? "Aktif" : "Pasif"}
              </Badge>
            </div>
            {data.license.activatedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktivasyon:</span>
                <span>
                  {new Date(data.license.activatedAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uyarı (limit yaklaşırken) */}
      {(data.usage.users.percentage >= 80 || data.usage.customers.percentage >= 80) && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Kullanım Limitine Yaklaşıyorsunuz
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Planınızı yükselterek daha fazla kullanıcı veya müşteri
              ekleyebilirsiniz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
