"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { chrome } from "@/lib/palette";
import { useTheme } from "@/lib/useTheme";
import { formatCompactBRL } from "@/lib/format";

interface Datum {
  name: string;
  value: number;
  color: string;
  seriesName?: string;
}

export function HorizontalBarChart({ data, height }: { data: Datum[]; height?: number }) {
  const [mode] = useTheme();
  const c = chrome[mode];
  const rowHeight = 32;
  const chartHeight = height ?? Math.max(data.length * rowHeight + 20, 120);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke={c.gridline} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatCompactBRL(v)}
          tick={{ fill: c.inkMuted, fontSize: 11 }}
          axisLine={{ stroke: c.baseline }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: c.inkSecondary, fontSize: 12 }}
          axisLine={{ stroke: c.baseline }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: c.gridline, opacity: 0.5 }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label as string}
              payload={payload?.map((p) => ({
                name: (p.payload as Datum).seriesName ?? "Valor",
                value: p.value as number,
                color: (p.payload as Datum).color,
              }))}
            />
          )}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
