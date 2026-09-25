import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  icon?: ReactNode;
}

const toneClasses: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-ink",
  good: "text-[#0ca30c]",
  warning: "text-[#c98500] dark:text-[#fab219]",
  critical: "text-[#d03b3b] dark:text-[#e66767]",
};

export function StatTile({ label, value, hint, tone = "neutral", icon }: StatTileProps) {
  return (
    <div className="card p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-secondary">{label}</span>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <span className={`text-2xl font-semibold tabular truncate ${toneClasses[tone]}`}>
        {value}
      </span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
