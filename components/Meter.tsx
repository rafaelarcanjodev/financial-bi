import { formatBRL, formatPercent } from "@/lib/format";

interface MeterProps {
  label: string;
  value: number;
  limit: number;
}

export function Meter({ label, value, limit }: MeterProps) {
  const ratio = limit > 0 ? Math.min(value / limit, 1) : 0;
  const over = limit > 0 && value > limit;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular text-ink-secondary shrink-0">
          {formatBRL(value)} <span className="text-ink-muted">/ {formatBRL(limit)}</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--gridline)] overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? "bg-[#d03b3b]" : "bg-[#2a78d6] dark:bg-[#3987e5]"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="text-xs text-ink-muted">{formatPercent(limit > 0 ? value / limit : 0)} pago</span>
    </div>
  );
}
