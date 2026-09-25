"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { chrome } from "@/lib/palette";
import { useTheme } from "@/lib/useTheme";
import { formatCompactBRL } from "@/lib/format";

interface GroupedBarChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
}

export function GroupedBarChart({ data, xKey, series, height = 280 }: GroupedBarChartProps) {
  const [mode] = useTheme();
  const c = chrome[mode];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={c.gridline} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: c.inkSecondary, fontSize: 12 }}
          axisLine={{ stroke: c.baseline }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCompactBRL(v)}
          tick={{ fill: c.inkMuted, fontSize: 11 }}
          axisLine={{ stroke: c.baseline }}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ fill: c.gridline, opacity: 0.5 }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label as string}
              payload={payload?.map((p) => ({
                name: p.name as string,
                value: p.value as number,
                color: p.color as string,
              }))}
            />
          )}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: c.inkSecondary }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
