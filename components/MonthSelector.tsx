"use client";

import { formatMonthLabel } from "@/lib/format";

interface MonthSelectorProps {
  months: string[];
  value: string;
  vigente: string;
  onChange: (mes: string) => void;
}

export function MonthSelector({ months, value, vigente, onChange }: MonthSelectorProps) {
  const idx = months.indexOf(value);
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < months.length - 1;

  return (
    <div className="card px-1.5 py-1 flex items-center gap-1 text-xs">
      <button
        onClick={() => canPrev && onChange(months[idx - 1])}
        disabled={!canPrev}
        aria-label="Mes anterior"
        className="px-2 py-1 rounded-md text-ink-secondary hover:text-ink hover:bg-[var(--gridline)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        ‹
      </button>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-ink font-medium px-1 py-1 outline-none cursor-pointer"
      >
        {months.map((mes) => (
          <option key={mes} value={mes} className="bg-[var(--card-surface)] text-ink">
            {formatMonthLabel(mes)}
            {mes === vigente ? " (vigente)" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => canNext && onChange(months[idx + 1])}
        disabled={!canNext}
        aria-label="Proximo mes"
        className="px-2 py-1 rounded-md text-ink-secondary hover:text-ink hover:bg-[var(--gridline)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        ›
      </button>
      {value !== vigente && (
        <button
          onClick={() => onChange(vigente)}
          className="ml-1 px-2 py-1 rounded-md text-ink-secondary hover:text-ink hover:bg-[var(--gridline)] transition-colors"
        >
          hoje
        </button>
      )}
    </div>
  );
}
