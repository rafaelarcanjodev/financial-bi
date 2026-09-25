import { formatBRL, formatPercent } from "@/lib/format";

interface Segment {
  label: string;
  value: number;
  color: string;
}

export function SegmentedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-[var(--gridline)]">
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{ width: `${total > 0 ? (seg.value / total) * 100 : 0}%`, background: seg.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-ink-secondary">{seg.label}</span>
            <span className="tabular text-ink font-medium">{formatBRL(seg.value)}</span>
            <span className="text-ink-muted text-xs">
              ({formatPercent(total > 0 ? seg.value / total : 0)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
