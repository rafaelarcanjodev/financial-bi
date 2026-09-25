"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { chrome } from "@/lib/palette";
import { useTheme } from "@/lib/useTheme";
import { formatCompactBRL, formatMonthLabel } from "@/lib/format";

interface Series {
  key: string;
  name: string;
  color: string;
  strokeWidth?: number;
  dashed?: boolean;
}

interface LineChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  /** Format the x-axis category as a "YYYY-MM" month key. */
  xIsMonthKey?: boolean;
  series: Series[];
  height?: number;
}

export function LineChart({ data, xKey, xIsMonthKey, series, height = 320 }: LineChartProps) {
  const xTickFormatter = xIsMonthKey ? formatMonthLabel : undefined;
  const [mode] = useTheme();
  const c = chrome[mode];
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke={c.gridline} />
        <XAxis
          dataKey={xKey}
          tickFormatter={xTickFormatter}
          interval={tickInterval}
          tick={{ fill: c.inkMuted, fontSize: 11 }}
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
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={
                typeof label === "string" && xTickFormatter ? xTickFormatter(label) : (label as string | undefined)
              }
              payload={payload?.map((p) => ({
                name: p.name as string,
                value: p.value as number,
                color: p.color as string,
              }))}
            />
          )}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: c.inkSecondary }} iconType="plainline" />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? 2}
            strokeDasharray={s.dashed ? "4 3" : undefined}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  );
}
