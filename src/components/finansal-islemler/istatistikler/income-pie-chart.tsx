"use client";

import { memo, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChartIcon } from "lucide-react";
import type { CategoryBreakdownItem } from "../hooks/use-stats";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

interface IncomePieChartProps {
  data: CategoryBreakdownItem[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: {
      categoryName?: string;
      total?: number;
      percent?: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
        <p className="text-sm font-medium">{d?.categoryName}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(d?.total || 0)}
        </p>
        <p className="text-xs text-muted-foreground">
          %{(d?.percent || 0).toFixed(1)}
        </p>
      </div>
    );
  }
  return null;
}

export const IncomePieChart = memo(function IncomePieChart({
  data,
}: IncomePieChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.total, 0),
    [data]
  );

  const chartData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        percent: total > 0 ? (item.total / total) * 100 : 0,
      })),
    [data, total]
  );

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            Gelir Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[250px]">
          <p className="text-sm text-muted-foreground">
            Bu dönemde gelir verisi bulunamadı
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          Gelir Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="total"
                nameKey="categoryName"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.categoryId}
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
            <span className="text-[10px] text-muted-foreground">Toplam</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-2">
          {chartData.map((item) => (
            <div key={item.categoryId} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm flex-1 truncate">
                {item.categoryName}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(item.total)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                %{item.percent.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
