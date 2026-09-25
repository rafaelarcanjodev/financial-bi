import { formatBRL } from "@/lib/format";

interface Payload {
  name: string;
  value: number;
  color: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card px-3 py-2 shadow-lg text-xs" style={{ minWidth: 160 }}>
      {label && <div className="text-ink-secondary mb-1 font-medium">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              {p.name}
            </span>
            <span className="tabular text-ink font-medium">{formatBRL(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
