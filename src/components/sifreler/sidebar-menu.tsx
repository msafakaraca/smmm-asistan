"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface SidebarMenuProps {
  activeTab: "gib" | "sgk" | "iskur" | "turmob" | "edevlet";
  onTabChange: (tab: "gib" | "sgk" | "iskur" | "turmob" | "edevlet") => void;
}

const menuItems = [
  {
    id: "gib" as const,
    label: "Dijital Vergi Dairesi (GİB)",
    description: "GİB Portal Girişleri",
    icon: "solar:buildings-bold",
  },
  {
    id: "sgk" as const,
    label: "Sosyal Güvenlik Kurumu (SGK)",
    description: "SGK Portal Girişleri",
    icon: "solar:shield-user-bold",
  },
  {
    id: "iskur" as const,
    label: "İŞKUR İşveren Sistemi",
    description: "İŞKUR Portal Girişleri",
    icon: "solar:case-round-bold",
  },
  {
    id: "turmob" as const,
    label: "TÜRMOB Entegratör",
    description: "e-Beyanname Girişleri",
    icon: "solar:document-text-bold",
  },
  {
    id: "edevlet" as const,
    label: "e-Devlet Kapısı",
    description: "e-Devlet Girişleri",
    icon: "solar:shield-keyhole-bold",
  },
];

export function SidebarMenu({ activeTab, onTabChange }: SidebarMenuProps) {
  return (
    <nav className="flex-1 p-3">
      <ul className="space-y-1">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors text-left",
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  icon={item.icon}
                  className={cn(
                    "size-5 mt-0.5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="flex flex-col min-w-0">
                  <span
                    className={cn(
                      "font-medium text-sm truncate",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
