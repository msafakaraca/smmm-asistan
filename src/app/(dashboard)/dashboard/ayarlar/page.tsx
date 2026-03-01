import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Ayarlar",
  description: "Ofis ve hesap ayarlarınızı yönetin",
};

export default async function AyarlarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        tenantId: session.user.tenantId,
      }}
    />
  );
}
