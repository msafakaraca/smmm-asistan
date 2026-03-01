"use client";

import { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, HandCoins, AlertTriangle } from "lucide-react";

interface SummaryCardsProps {
  pendingTotal: number;
  thisMonthCollected: number;
  overdueTotal: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

export const SummaryCards = memo(function SummaryCards({
  pendingTotal,
  thisMonthCollected,
  overdueTotal,
}: SummaryCardsProps) {
  const cards = useMemo(
    () => [
      {
        title: "Bekleyen Toplam",
        value: formatCurrency(pendingTotal),
        icon: Clock,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
      },
      {
        title: "Bu Ay Tahsilat",
        value: formatCurrency(thisMonthCollected),
        icon: HandCoins,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
      },
      {
        title: "Vadesi Geçen",
        value: formatCurrency(overdueTotal),
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800",
      },
    ],
    [pendingTotal, thisMonthCollected, overdueTotal]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={`${card.borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className={`text-xl font-bold tabular-nums ${card.color}`}>
                  {card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
