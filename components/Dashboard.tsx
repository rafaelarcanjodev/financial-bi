"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MasterData } from "@/lib/types";
import { Tabs } from "@/components/Tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MonthSelector } from "@/components/MonthSelector";
import { OverviewSection } from "@/components/sections/OverviewSection";
import { ForecastSection } from "@/components/sections/ForecastSection";
import { ExpensesSection } from "@/components/sections/ExpensesSection";
import { DebtsSection } from "@/components/sections/DebtsSection";
import { PayrollSection } from "@/components/sections/PayrollSection";
import { CardsSection } from "@/components/sections/CardsSection";
import { formatMonthLabel } from "@/lib/format";
import { mesesDisponiveis, getMonthView } from "@/lib/months";

const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hora

export function Dashboard({ initialData }: { initialData: MasterData }) {
  const [data, setData] = useState(initialData);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const [selectedMonth, setSelectedMonth] = useState(data._metadata.mes_referencia);

  const months = useMemo(() => mesesDisponiveis(data), [data]);
  const effectiveMonth = months.includes(selectedMonth) ? selectedMonth : data._metadata.mes_referencia;
  const monthView = useMemo(() => getMonthView(data, effectiveMonth), [data, effectiveMonth]);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as MasterData;
      setData(fresh);
      setLastSync(new Date());
    } catch (err) {
      console.error("Falha ao atualizar dados", err);
      setError("Nao foi possivel atualizar os dados agora.");
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[var(--border-hairline)] bg-[var(--card-surface)]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">Financeiro Familia Arcanjo</h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Referencia: {formatMonthLabel(data._metadata.mes_referencia)} · Atualizado em{" "}
              {data._metadata.ultima_atualizacao}
              {lastSync && (
                <> · Sincronizado as {lastSync.toLocaleTimeString("pt-BR")}</>
              )}
            </p>
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <MonthSelector
              months={months}
              value={effectiveMonth}
              vigente={data._metadata.mes_referencia}
              onChange={setSelectedMonth}
            />
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="card px-3 py-1.5 text-xs text-ink-secondary hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Atualizar dados"
            >
              {isRefreshing ? "Atualizando..." : "↻ Atualizar"}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        <Tabs
          tabs={[
            { id: "overview", label: "Visao geral", content: <OverviewSection data={data} monthView={monthView} /> },
            { id: "forecast", label: "Previsibilidade", content: <ForecastSection data={data} /> },
            { id: "expenses", label: "Despesas", content: <ExpensesSection data={data} monthView={monthView} /> },
            { id: "debts", label: "Dividas e patrimonio", content: <DebtsSection data={data} monthView={monthView} /> },
            { id: "payroll", label: "Entradas", content: <PayrollSection data={data} /> },
            { id: "cards", label: "Cartoes", content: <CardsSection data={data} mes={effectiveMonth} /> },
          ]}
        />
      </main>

      <footer className="border-t border-[var(--border-hairline)] py-4">
        <div className="max-w-6xl mx-auto px-6 text-xs text-ink-muted">
          Fonte: {data._metadata.fonte} · Dados locais em <code>data/master.json</code>
        </div>
      </footer>
    </div>
  );
}
