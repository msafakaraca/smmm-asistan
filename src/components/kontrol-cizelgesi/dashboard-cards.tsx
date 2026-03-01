"use client";

/**
 * DashboardCards Component
 *
 * Kontrol Çizelgesi ana sayfası.
 * 4 kart ile alt sayfalara yönlendirme sağlar.
 */

import Link from "next/link";
import { Icon } from "@iconify/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardCard {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  borderColor: string;
  hoverColor: string;
  href: string;
}

const cards: DashboardCard[] = [
  {
    title: "Beyanname Takip",
    description: "Mükelleflerin beyanname durumlarını takip edin",
    icon: "solar:clipboard-check-bold-duotone",
    iconColor: "text-primary",
    borderColor: "border-primary/20",
    hoverColor: "hover:border-primary hover:shadow-primary/10",
    href: "/dashboard/kontrol-cizelgesi/beyanname-takip",
  },
  {
    title: "MUHSGK Detay",
    description: "SGK tahakkuk ve hizmet listesi takibi",
    icon: "solar:shield-check-bold-duotone",
    iconColor: "text-green-600",
    borderColor: "border-green-500/20",
    hoverColor: "hover:border-green-500 hover:shadow-green-500/10",
    href: "/dashboard/kontrol-cizelgesi/muhsgk-detay",
  },
  {
    title: "KDV Detay",
    description: "KDV tahakkuk ve beyanname takibi",
    icon: "solar:calculator-bold-duotone",
    iconColor: "text-blue-600",
    borderColor: "border-blue-500/20",
    hoverColor: "hover:border-blue-500 hover:shadow-blue-500/10",
    href: "/dashboard/kontrol-cizelgesi/kdv-detay",
  },
  {
    title: "KDV-2 Detay",
    description: "KDV tevkifat tahakkuk takibi",
    icon: "solar:calculator-minimalistic-bold-duotone",
    iconColor: "text-purple-600",
    borderColor: "border-purple-500/20",
    hoverColor: "hover:border-purple-500 hover:shadow-purple-500/10",
    href: "/dashboard/kontrol-cizelgesi/kdv2-detay",
  },
  {
    title: "KDV9015 Tevkifat Detay",
    description: "KDV tevkifat (9015) tahakkuk takibi",
    icon: "solar:calculator-bold-duotone",
    iconColor: "text-orange-600",
    borderColor: "border-orange-500/20",
    hoverColor: "hover:border-orange-500 hover:shadow-orange-500/10",
    href: "/dashboard/kontrol-cizelgesi/kdv9015-detay",
  },
  {
    title: "Gelir Geçici Vergi Detay",
    description: "Gelir geçici vergi tahakkuk takibi (Şahıs)",
    icon: "solar:chart-square-bold-duotone",
    iconColor: "text-teal-600",
    borderColor: "border-teal-500/20",
    hoverColor: "hover:border-teal-500 hover:shadow-teal-500/10",
    href: "/dashboard/kontrol-cizelgesi/ggecici-detay",
  },
  {
    title: "Kurum Geçici Vergi Detay",
    description: "Kurum geçici vergi tahakkuk takibi (Firma)",
    icon: "solar:buildings-bold-duotone",
    iconColor: "text-rose-600",
    borderColor: "border-rose-500/20",
    hoverColor: "hover:border-rose-500 hover:shadow-rose-500/10",
    href: "/dashboard/kontrol-cizelgesi/kgecici-detay",
  },
];

export function DashboardCards() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon icon="solar:clipboard-check-bold-duotone" className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kontrol Çizelgesi</h1>
          <p className="text-muted-foreground">
            Beyanname, SGK ve KDV durumlarını takip edin
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card
              className={`border-2 ${card.borderColor} ${card.hoverColor} transition-all duration-200 cursor-pointer hover:shadow-md h-full`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon icon={card.icon} className={`h-10 w-10 ${card.iconColor}`} />
                  <div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-end text-sm text-muted-foreground">
                  <span>Çizelgeyi görüntüle</span>
                  <Icon icon="solar:arrow-right-linear" className="h-4 w-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
