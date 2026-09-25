"use client";

import { useTheme } from "@/lib/useTheme";

export function ThemeToggle() {
  const [mode, toggle] = useTheme();
  return (
    <button
      onClick={toggle}
      className="card px-3 py-1.5 text-xs text-ink-secondary hover:text-ink transition-colors"
      aria-label="Alternar tema"
    >
      {mode === "dark" ? "☀ Claro" : "☾ Escuro"}
    </button>
  );
}
