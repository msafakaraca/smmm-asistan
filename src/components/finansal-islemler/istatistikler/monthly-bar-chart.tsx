"use client";

import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { MonthlyTrendItem } from "../hooks/use-stats";

const MONTH_NAMES = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

interface MonthlyBarChartProps {
  data: MonthlyTrendItem[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length && label) {
    const [year, monthStr] = label.split("-");
    const monthIdx = parseInt(monthStr) - 1;
    const monthName = MONTH_NAMES[monthIdx] || monthStr;
    const income = payload.find((p) => p.dataKey === "income")?.value || 0;
    const expense = payload.find((p) => p.dataKey === "expense")?.value || 0;
    const diff = income - expense;

    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
        <p className="text-sm font-medium mb-1">
          {monthName} {year}
        </p>
        <div className="space-y-0.5">
          <p className="text-sm text-green-600">
            Gelir: {formatCurrency(income)}
          </p>
          <p className="text-sm text-red-600">
            Gider: {formatCurrency(expense)}
          </p>
          <p
            className={`text-sm font-medium ${
              diff >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            Fark: {formatCurrency(diff)}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export const MonthlyBarChart = memo(function MonthlyBarChart({
  data,
}: MonthlyBarChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => {
        const [, monthStr] = item.month.split("-");
        const monthIdx = parseInt(monthStr) - 1;
        return {
          ...item,
          label: MONTH_NAMES[monthIdx] || monthStr,
        };
      }),
    [data]
  );

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Aylık Gelir-Gider Trendi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[250px]">
          <p className="text-sm text-muted-foreground">
            Henüz trend verisi bulunamadı
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Aylık Gelir-Gider Trendi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={formatShortCurrency}
                className="text-muted-foreground"
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) =>
                  value === "income" ? "Gelir" : "Gider"
                }
              />
              <Bar
                dataKey="income"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="expense"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
