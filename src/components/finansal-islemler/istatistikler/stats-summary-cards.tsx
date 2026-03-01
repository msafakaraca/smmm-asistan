"use client";

import { memo, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, HandCoins, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import type { StatsSummary } from "../hooks/use-stats";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

interface StatsSummaryCardsProps {
  summary: StatsSummary;
}

export const StatsSummaryCards = memo(function StatsSummaryCards({
  summary,
}: StatsSummaryCardsProps) {
  const isProfit = summary.netProfit >= 0;

  const cards = useMemo(
    () => [
      {
        title: "Toplam Alacak",
        value: formatCurrency(summary.pendingTotal),
        icon: Clock,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
      },
      {
        title: "Bu Ay Tahsilat",
        value: formatCurrency(summary.thisMonthCollected),
        icon: HandCoins,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
      },
      {
        title: "Bu Ay Gider",
        value: formatCurrency(summary.thisMonthExpenses),
        icon: Receipt,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800",
      },
      {
        title: "Net Kâr",
        value: formatCurrency(summary.netProfit),
        icon: isProfit ? TrendingUp : TrendingDown,
        color: isProfit ? "text-emerald-600" : "text-red-600",
        bgColor: isProfit
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-red-50 dark:bg-red-950/30",
        borderColor: isProfit
          ? "border-emerald-200 dark:border-emerald-800"
          : "border-red-200 dark:border-red-800",
      },
    ],
    [summary, isProfit]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={card.borderColor}>
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
