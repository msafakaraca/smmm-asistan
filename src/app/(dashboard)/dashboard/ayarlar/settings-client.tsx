"use client";

import { Settings, Building2, Users, CreditCard, KeyRound, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoSettingsTab } from "@/components/settings/info-settings-tab";
import { UsersSettingsTab } from "@/components/settings/users-settings-tab";
import { SubscriptionTab } from "@/components/settings/subscription-tab";
import { PasswordsTab } from "@/components/settings/passwords-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { type UserWithPermissions } from "@/lib/permissions";

interface SettingsClientProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

export function SettingsClient({ user }: SettingsClientProps) {
  // Server'dan gelen user'ı UserWithPermissions formatına dönüştür
  const currentUser: UserWithPermissions = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "owner" | "admin" | "user",
    tenantId: user.tenantId,
    status: "active",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Ayarlar
        </h1>
        <p className="text-muted-foreground">
          Ofis ve hesap ayarlarınızı yönetin
        </p>
      </div>

      {/* Tab Layout */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="w-full justify-start gap-1 bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="info" className="gap-2 data-[state=active]:bg-background">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Bilgiler</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Kullanıcılar</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2 data-[state=active]:bg-background">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Abonelik</span>
          </TabsTrigger>
          <TabsTrigger value="passwords" className="gap-2 data-[state=active]:bg-background">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Şifreler</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-background">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">İletişim</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab İçerikleri */}
        <div className="min-h-[400px] rounded-lg border bg-card p-4 xl:p-6">
          <TabsContent value="info" className="m-0">
            <InfoSettingsTab />
          </TabsContent>

          <TabsContent value="users" className="m-0">
            <UsersSettingsTab currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="subscription" className="m-0">
            <SubscriptionTab />
          </TabsContent>

          <TabsContent value="passwords" className="m-0">
            <PasswordsTab />
          </TabsContent>

          <TabsContent value="notifications" className="m-0">
            <NotificationsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
