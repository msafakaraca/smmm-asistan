"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { TaskSummaryStats } from "@/types/dashboard";

interface TaskPriorityChartProps {
  stats: TaskSummaryStats;
}

const COLORS = {
  high: "#ef4444", // red-500
  medium: "#f59e0b", // amber-500
  low: "#22c55e", // green-500
};

const LABELS = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

export function TaskPriorityChart({ stats }: TaskPriorityChartProps) {
  const data = [
    { name: LABELS.high, value: stats.highPriority, color: COLORS.high },
    { name: LABELS.medium, value: stats.mediumPriority, color: COLORS.medium },
    { name: LABELS.low, value: stats.lowPriority, color: COLORS.low },
  ].filter((item) => item.value > 0);

  // Eğer hiç aktif görev yoksa
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Aktif görev yok
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={60}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value} görev`]}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span className="text-xs text-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
