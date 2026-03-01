"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Users } from "lucide-react";
import type { TopDebtorItem } from "../hooks/use-stats";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

interface CollectionPerformanceProps {
  collectionRate: number;
  topDebtors: TopDebtorItem[];
}

export const CollectionPerformance = memo(function CollectionPerformance({
  collectionRate,
  topDebtors,
}: CollectionPerformanceProps) {
  const rateColor = useMemo(() => {
    if (collectionRate >= 80) return { bar: "bg-green-500", text: "text-green-600" };
    if (collectionRate >= 60) return { bar: "bg-yellow-500", text: "text-yellow-600" };
    return { bar: "bg-red-500", text: "text-red-600" };
  }, [collectionRate]);

  const maxDebt = useMemo(
    () => (topDebtors.length > 0 ? topDebtors[0].total : 0),
    [topDebtors]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Tahsilat Performansı
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tahsilat oranı */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Bu Ay Tahsilat Oranı
            </span>
            <span className={`text-2xl font-bold tabular-nums ${rateColor.text}`}>
              %{collectionRate}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${rateColor.bar}`}
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">%0</span>
            <span className="text-[10px] text-muted-foreground">%100</span>
          </div>
        </div>

        {/* En borçlu müşteriler */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">En Borçlu Müşteriler</span>
          </div>

          {topDebtors.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                Bekleyen borç bulunamadı
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {topDebtors.map((debtor, index) => {
                const barWidth =
                  maxDebt > 0
                    ? Math.max((debtor.total / maxDebt) * 100, 5)
                    : 0;
                return (
                  <div key={debtor.customerId} className="group">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
                        {index + 1}.
                      </span>
                      <span className="text-sm flex-1 truncate">
                        {debtor.customerName}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-red-600">
                        {formatCurrency(debtor.total)}
                      </span>
                    </div>
                    <div className="ml-7 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
