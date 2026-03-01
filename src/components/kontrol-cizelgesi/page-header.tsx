"use client";

/**
 * PageHeader Component
 *
 * Kontrol çizelgesi alt sayfaları için shared header.
 * Geri butonu + başlık + açıklama içerir.
 */

import { useRouter } from "next/navigation";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function PageHeader({ title, description, icon: Icon, iconColor = "text-primary" }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-4 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.push("/dashboard/kontrol-cizelgesi")}
        className="h-10 w-10"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Icon className={`h-8 w-8 ${iconColor}`} />
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
