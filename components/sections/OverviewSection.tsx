import { StatTile } from "@/components/StatTile";
import { SectionCard } from "@/components/SectionCard";
import { SegmentedBar } from "@/components/SegmentedBar";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { status, categorical } from "@/lib/palette";
import type { MasterData } from "@/lib/types";
import type { MonthView } from "@/lib/months";

export function OverviewSection({ data, monthView }: { data: MasterData; monthView: MonthView }) {
  const { entradas, saldo_caixa, patrimonio } = monthView;
  const { dividasAtivas, totalDividasAtivas } = monthView;
  const totalAtrasadas = data.dividas.total_atrasadas;
  const totalDividas = totalDividasAtivas + totalAtrasadas;

  // Segmentos de categoria de despesa
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

  // BI Chart: Holerites Bruto vs Líquido
  const holeriteChartData = Object.entries(data.holerites).flatMap(([pessoa, entries]) =>
    entries.map((h) => ({
      name: `${formatMonthLabel(h.competencia)} ${data.pessoas[pessoa]?.nome.split(" ")[0] ?? pessoa}`,
      Bruto: h.bruto,
      Liquido: h.liquido ?? 0,
    }))
  );

  // BI Chart: Faturas dos Cartões
  const cardMeses = Array.from(
    new Set(Object.values(data.cartoes_credito).flatMap((c) => c.faturas.map((f) => f.mes)))
  ).sort();
  const cardsChartData = cardMeses.map((m) => {
    const row: Record<string, string | number> = { name: formatMonthLabel(m) };
    for (const [nome, cartao] of Object.entries(data.cartoes_credito)) {
      row[nome] = cartao.faturas.find((f) => f.mes === m)?.valor ?? 0;
    }
    return row;
  });
  const cardColors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

  // BI Chart: Dívidas por credor
  const debtData = [
    ...dividasAtivas
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((d) => ({ name: d.credor, value: d.valor, color: "#2a78d6", seriesName: "Ativa (em dia)" })),
    ...data.dividas.atrasadas
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((d) => ({ name: d.credor, value: d.valor, color: status.critical.light, seriesName: "Atrasada" })),
  ].sort((a, b) => b.value - a.value);

  // BI Chart: Patrimônio
  const patrimonioData =
    patrimonio?.itens
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .map((p, i) => ({ name: p.item, value: p.valor, color: categorical.light[i % categorical.light.length] })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {!monthView.isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando {formatMonthLabel(monthView.mes)} · dívidas e parcelamentos são projetados a partir do
          mês vigente ({formatMonthLabel(data._metadata.mes_referencia)}); entradas, despesas e saldo de
          caixa só aparecem quando há dado real registrado para este mês.
        </p>
      )}

      {/* Top StatTiles - Indicadores Executivos */}
      {monthView.isVigente && entradas && saldo_caixa ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatTile label="Recebido no mês" value={formatBRL(entradas.total_recebido)} tone="good" />
          <StatTile label="Pendente no mês" value={formatBRL(entradas.total_pendente)} tone="warning" />
          <StatTile label="Total esperado" value={formatBRL(entradas.total_esperado)} />
          <StatTile label="Saldo em caixa" value={formatBRL(saldo_caixa.caixa_atual)} tone="good" />
          <StatTile
            label="Ainda precisa pagar"
            value={formatBRL(saldo_caixa.ainda_precisa_pagar)}
            tone="critical"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatTile
            label={`Entradas previstas (${formatMonthLabel(monthView.mes)})`}
            value={formatBRL(monthView.entradasProjetadas.total_esperado)}
            tone="good"
            hint="Salários + Benefícios + Freelances"
          />
          <StatTile
            label="Despesas fixas previstas"
            value={formatBRL(monthView.totalDespesasFixasPrevistas)}
            hint="Contas recorrentes do mês"
          />
          <StatTile
            label="Dívidas & parcelamentos"
            value={formatBRL(monthView.totalDividasAtivas + monthView.totalComprasParceladas)}
            tone="warning"
            hint={`${monthView.dividasAtivas.length} dívidas + ${monthView.comprasParceladas.length} parcelas`}
          />
          <StatTile
            label="Cartões estimados"
            value={formatBRL(monthView.totalCartoesMes)}
            tone="warning"
            hint="Faturas estimadas do mês"
          />
          <StatTile
            label="Resultado projetado"
            value={formatBRL(monthView.resultadoPrevisto)}
            tone={monthView.resultadoPrevisto >= 0 ? "good" : "critical"}
            hint={monthView.resultadoPrevisto >= 0 ? "Superávit projetado" : "Déficit projetado"}
          />
        </div>
      )}

      {/* Resumo Rápido de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title={monthView.isVigente ? "Entradas do mês" : `Projeção de entradas (${formatMonthLabel(monthView.mes)})`}
          subtitle={monthView.isVigente ? "Já recebido vs. ainda pendente" : "Composição da renda esperada"}
        >
          <SegmentedBar
            segments={
              monthView.isVigente && entradas
                ? [
                    { label: "Recebido", value: entradas.total_recebido, color: status.good.light },
                    { label: "Pendente", value: entradas.total_pendente, color: status.warning.light },
                  ]
                : monthView.entradasProjetadas.itens.map((it, i) => ({
                    label: it.item,
                    value: it.valor,
                    color: categorical.light[i % categorical.light.length],
                  }))
            }
          />
        </SectionCard>

        <SectionCard
          title="Dívidas totais"
          subtitle={
            monthView.isVigente
              ? "Em dia vs. atrasadas"
              : `Projeção ${formatMonthLabel(monthView.mes)} (em dia vs. atrasadas)`
          }
        >
          <SegmentedBar
            segments={[
              { label: "Ativas (em dia)", value: totalDividasAtivas, color: "#2a78d6" },
              { label: "Atrasadas", value: totalAtrasadas, color: status.critical.light },
            ]}
          />
        </SectionCard>
      </div>

      {categoriaSegments.some((s) => s.value > 0) && (
        <SectionCard
          title="Gasto por categoria"
          subtitle={`Percentual do previsto para ${formatMonthLabel(monthView.mes)}, por categoria`}
        >
          <SegmentedBar segments={categoriaSegments} />
        </SectionCard>
      )}

      {/* PAINEL CENTRAL DE BI E ANÁLISES GRÁFICAS */}
      <div className="pt-2">
        <div className="border-t border-[var(--border-hairline)] pt-5 pb-3">
          <h2 className="text-base font-bold text-ink">Inteligência Financeira & BI Consolidado</h2>
          <p className="text-xs text-ink-muted">
            Painel unificado com todos os gráficos de histórico, comparativos e evolução
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
          {/* BI 1: Holerites Bruto vs Líquido */}
          <SectionCard
            title="Bruto vs. Líquido por holerite"
            subtitle="Evolução histórica de remuneração por pessoa"
          >
            <GroupedBarChart
              data={holeriteChartData}
              xKey="name"
              series={[
                { key: "Bruto", name: "Bruto", color: "#2a78d6" },
                { key: "Liquido", name: "Líquido", color: "#1baf7a" },
              ]}
            />
          </SectionCard>

          {/* BI 2: Evolução de Cartões de Crédito */}
          <SectionCard
            title="Evolução de cartões de crédito"
            subtitle="Comparativo histórico das faturas mês a mês"
          >
            <GroupedBarChart
              data={cardsChartData}
              xKey="name"
              series={Object.keys(data.cartoes_credito).map((nome, i) => ({
                key: nome,
                name: nome,
                color: cardColors[i % cardColors.length],
              }))}
            />
          </SectionCard>

          {/* BI 3: Dívidas por Credor */}
          <SectionCard
            title="Distribuição de dívidas por credor"
            subtitle="Azul = em dia · Vermelho = atrasada"
          >
            <HorizontalBarChart data={debtData} />
          </SectionCard>

          {/* BI 4: Patrimônio Bloqueado */}
          {patrimonio && (
            <SectionCard title="Alocação de patrimônio bloqueado" subtitle="Ativos fixos, FGTS e previdência privada">
              <HorizontalBarChart data={patrimonioData} />
            </SectionCard>
          )}
        </div>
      </div>

      {/* Balanço Final */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {patrimonio && <StatTile label="Patrimônio bloqueado" value={formatBRL(patrimonio.total)} />}
        <StatTile label="Dívidas em aberto" value={formatBRL(totalDividas)} tone="critical" />
        {patrimonio && (
          <StatTile
            label="Patrimônio - Dívidas"
            value={formatBRL(patrimonio.total - totalDividas)}
            tone={patrimonio.total - totalDividas >= 0 ? "good" : "critical"}
          />
        )}
      </div>
    </div>
  );
}
