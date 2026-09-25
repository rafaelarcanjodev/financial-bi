import { StatTile } from "@/components/StatTile";
import { SectionCard } from "@/components/SectionCard";
import { SegmentedBar } from "@/components/SegmentedBar";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { status, categorical } from "@/lib/palette";
import type { MasterData } from "@/lib/types";
import type { MonthView } from "@/lib/months";

export function OverviewSection({ data, monthView }: { data: MasterData; monthView: MonthView }) {
  const { entradas, saldo_caixa, patrimonio } = monthView;
  const { dividasAtivas, totalDividasAtivas } = monthView;
  const totalAtrasadas = monthView.isVigente ? data.dividas.total_atrasadas : 0;
  const totalDividas = totalDividasAtivas + totalAtrasadas;

  const categoriaSegments = monthView.despesasCategorias.map((cat, i) => ({
    label: cat.nome,
    value: cat.itens.reduce((s, item) => s + item.previsto, 0),
    color: categorical.light[i % categorical.light.length],
  }));
  const parceladoPrevisto = monthView.comprasParceladas.reduce((s, c) => s + c.total, 0);
  if (parceladoPrevisto > 0) {
    categoriaSegments.push({
      label: "Compras parceladas",
      value: parceladoPrevisto,
      color: categorical.light[categoriaSegments.length % categorical.light.length],
    });
  }

  const entradasPrevistas = entradas
    ? [
        ...entradas.recebido.map((e) => ({ ...e, status: "recebido" as const })),
        ...entradas.pendente.map((e) => ({ ...e, status: "pendente" as const })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {!monthView.isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando {formatMonthLabel(monthView.mes)} · dividas e parcelamentos sao projetados a partir do
          mes vigente ({formatMonthLabel(data._metadata.mes_referencia)}); entradas, despesas e saldo de
          caixa so aparecem quando ha dado real registrado para este mes.
        </p>
      )}

      {entradas && saldo_caixa ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatTile label="Recebido no mes" value={formatBRL(entradas.total_recebido)} tone="good" />
          <StatTile label="Pendente no mes" value={formatBRL(entradas.total_pendente)} tone="warning" />
          <StatTile label="Total esperado" value={formatBRL(entradas.total_esperado)} />
          <StatTile label="Saldo em caixa" value={formatBRL(saldo_caixa.caixa_atual)} tone="good" />
          <StatTile
            label="Ainda precisa pagar"
            value={formatBRL(saldo_caixa.ainda_precisa_pagar)}
            tone="critical"
          />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Sem entradas/saldo de caixa registrados para este mes.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {entradas && (
          <SectionCard title="Entradas do mes" subtitle="Ja recebido vs. ainda pendente">
            <SegmentedBar
              segments={[
                { label: "Recebido", value: entradas.total_recebido, color: status.good.light },
                { label: "Pendente", value: entradas.total_pendente, color: status.warning.light },
              ]}
            />
          </SectionCard>
        )}

        <SectionCard
          title="Dividas totais"
          subtitle={monthView.isVigente ? "Em dia vs. atrasadas" : "Ativas projetadas para este mes"}
        >
          <SegmentedBar
            segments={
              monthView.isVigente
                ? [
                    { label: "Ativas (em dia)", value: totalDividasAtivas, color: "#2a78d6" },
                    { label: "Atrasadas", value: totalAtrasadas, color: status.critical.light },
                  ]
                : [{ label: "Ativas (em dia)", value: totalDividasAtivas, color: "#2a78d6" }]
            }
          />
        </SectionCard>
      </div>

      {entradasPrevistas.length > 0 && (
        <SectionCard
          title="Entradas previstas"
          subtitle="Tudo que era esperado neste mes - o que ja entrou e o que ainda falta"
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {entradasPrevistas.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-secondary">{e.item}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular text-ink font-medium">{formatBRL(e.valor)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      e.status === "recebido"
                        ? "bg-[#0ca30c]/10 text-[#0ca30c]"
                        : "bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]"
                    }`}
                  >
                    {e.status === "recebido" ? "recebido" : "pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {categoriaSegments.some((s) => s.value > 0) && (
        <SectionCard title="Gasto por categoria" subtitle="Percentual do previsto para este mes, por categoria">
          <SegmentedBar segments={categoriaSegments} />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {patrimonio && <StatTile label="Patrimonio bloqueado" value={formatBRL(patrimonio.total)} />}
        <StatTile label="Dividas em aberto" value={formatBRL(totalDividas)} tone="critical" />
        {patrimonio && (
          <StatTile
            label="Patrimonio - dividas"
            value={formatBRL(patrimonio.total - totalDividas)}
            tone={patrimonio.total - totalDividas >= 0 ? "good" : "critical"}
          />
        )}
      </div>
    </div>
  );
}
