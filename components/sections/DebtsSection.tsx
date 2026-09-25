import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { status, categorical } from "@/lib/palette";
import type { MasterData } from "@/lib/types";
import type { MonthView } from "@/lib/months";

export function DebtsSection({ data, monthView }: { data: MasterData; monthView: MonthView }) {
  const { dividasAtivas, totalDividasAtivas, patrimonio } = monthView;
  const atrasadas = monthView.isVigente ? data.dividas.atrasadas : [];
  const totalAtrasadas = monthView.isVigente ? data.dividas.total_atrasadas : 0;

  const debtData = [
    ...dividasAtivas
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((d) => ({ name: d.credor, value: d.valor, color: "#2a78d6", seriesName: "Ativa (em dia)" })),
    ...atrasadas
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((d) => ({ name: d.credor, value: d.valor, color: status.critical.light, seriesName: "Atrasada" })),
  ].sort((a, b) => b.value - a.value);

  const patrimonioData =
    patrimonio?.itens
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((p, i) => ({ name: p.item, value: p.valor, color: categorical.light[i % categorical.light.length] })) ??
    [];

  return (
    <div className="flex flex-col gap-5">
      {!monthView.isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando {formatMonthLabel(monthView.mes)} · dividas ativas projetadas a partir do mes vigente
          ({formatMonthLabel(data._metadata.mes_referencia)}). Atrasadas e patrimonio so aparecem no mes
          vigente, por nao terem projecao conhecida.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Dividas ativas" value={formatBRL(totalDividasAtivas)} />
        {monthView.isVigente && (
          <StatTile label="Dividas atrasadas" value={formatBRL(totalAtrasadas)} tone="critical" />
        )}
        {patrimonio && <StatTile label="Patrimonio bloqueado" value={formatBRL(patrimonio.total)} tone="good" />}
        {patrimonio && (
          <StatTile
            label="Patrimonio - dividas"
            value={formatBRL(patrimonio.total - totalDividasAtivas - totalAtrasadas)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Dividas por credor"
          subtitle={monthView.isVigente ? "Azul = em dia · Vermelho = atrasada" : "Dividas ativas projetadas"}
        >
          <HorizontalBarChart data={debtData} />
        </SectionCard>

        {patrimonio && (
          <SectionCard title="Patrimonio bloqueado" subtitle="Nao liquido - poupanca, FGTS e bens">
            <HorizontalBarChart data={patrimonioData} />
            <div className="mt-4 flex flex-col divide-y divide-[var(--gridline)]">
              {patrimonio.itens.map((p) => (
                <div key={p.item} className="flex items-center justify-between py-2 text-xs text-ink-muted">
                  <span>{p.item}</span>
                  <span className="tabular">+{formatBRL(p.adicao_mensal)}/mes</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
