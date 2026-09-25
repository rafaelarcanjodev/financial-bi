import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { LineChart } from "@/components/charts/LineChart";
import { formatBRL } from "@/lib/format";
import { categorical } from "@/lib/palette";
import {
  custosFixosMensais,
  custosFixosPorCategoria,
  dividasAtivasMensal,
  dividasComPrazo,
  dividasSemPrazo,
  comprasParceladasAtivas,
  rendaFixaTotal,
  saldoFixoMensal,
  saldoFixoMensalPorMes,
  evolucaoDivida,
} from "@/lib/forecast";
import type { MasterData } from "@/lib/types";

export function ForecastSection({ data }: { data: MasterData }) {
  const renda = rendaFixaTotal(data);
  const custos = custosFixosMensais(data);
  const custosPorCategoria = custosFixosPorCategoria(data);
  const dividasMes = dividasAtivasMensal(data);
  const saldo = saldoFixoMensal(data);

  const comPrazo = dividasComPrazo(data);
  const semPrazo = dividasSemPrazo(data);
  const parceladasAtivas = comprasParceladasAtivas(data);

  const saldoPorMes = saldoFixoMensalPorMes(data, 6);
  const saldoSeries = [
    { key: "renda", name: "Renda fixa", color: "#1baf7a", strokeWidth: 2 },
    { key: "compromissos", name: "Custos + dividas + parceladas", color: "#eb6834", strokeWidth: 2 },
    { key: "saldo", name: "Saldo estrutural", color: "#0b0b0b", strokeWidth: 3 },
  ];

  const evolucao = evolucaoDivida(data);
  const lineSeries = [
    ...comPrazo.map((d, i) => ({
      key: d.credor,
      name: d.credor,
      color: categorical.light[i % categorical.light.length],
      strokeWidth: 1.5,
    })),
    { key: "total", name: "Total projetado", color: "#0b0b0b", strokeWidth: 3 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-secondary max-w-3xl">
        Previsibilidade de custos fixos: considera o que foi <strong>assumido/planejado</strong>{" "}
        (STATUS financeiro), nao o que ja foi pago ou nao neste mes. Dividas atrasadas sem parcela
        mensal definida (Boticario, LIS, Nubank cancelado, Nubank PJ, Mercado Livre) ficam de fora
        por nao serem custo fixo recorrente.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Renda fixa mensal" value={formatBRL(renda)} tone="good" />
        <StatTile label="Custos fixos mensais" value={formatBRL(custos)} />
        <StatTile label="Dividas ativas (mes)" value={formatBRL(dividasMes)} tone="warning" />
        <StatTile
          label="Saldo fixo mensal projetado"
          value={formatBRL(saldo)}
          tone={saldo >= 0 ? "good" : "critical"}
          hint="Renda - custos fixos - dividas ativas - parceladas ativas"
        />
      </div>

      <SectionCard
        title="Custos fixos mensais"
        subtitle="Contas do dia a dia (moradia, educacao, alimentacao, transporte...) - sem dividas, sem parcelamentos, sem emprestimos"
      >
        <div className="flex flex-col divide-y divide-[var(--gridline)]">
          {custosPorCategoria.map((cat) => (
            <div key={cat.nome} className="py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-ink font-medium">{cat.nome}</span>
                <span className="tabular text-ink-secondary">{formatBRL(cat.subtotal)}</span>
              </div>
              <div className="flex flex-col gap-1">
                {cat.itens.map((item) => (
                  <div key={item.item} className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{item.item}</span>
                    <span className="tabular">{formatBRL(item.previsto)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-hairline)] text-sm">
          <span className="text-ink font-semibold">Total custo fixo mensal</span>
          <span className="tabular text-ink font-semibold">{formatBRL(custos)}</span>
        </div>
      </SectionCard>

      <SectionCard
        title="Renda x compromissos x saldo (proximos 6 meses)"
        subtitle="Renda fixa (salarios + beneficios) contra custos fixos + dividas ativas + parceladas de cada mes - nao inclui freelances/bonus nem gastos pontuais"
      >
        <LineChart data={saldoPorMes} xKey="mes" xIsMonthKey series={saldoSeries} />
      </SectionCard>

      {evolucao.length > 0 && (
        <SectionCard
          title="Evolucao da divida parcelada"
          subtitle="Saldo projetado das dividas com data final conhecida (estimativa linear ate a ultima parcela)"
        >
          <LineChart data={evolucao} xKey="mes" xIsMonthKey series={lineSeries} />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Custos fixos recorrentes sem prazo definido"
          subtitle="Tem parcela mensal, mas o fim do compromisso ainda precisa ser confirmado"
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {semPrazo.map((d) => (
              <div key={d.credor} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{d.credor}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular text-ink font-medium">{formatBRL(d.valor)}/mes</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--gridline)] text-ink-muted">
                    prazo a confirmar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Compras parceladas ainda ativas"
          subtitle="Parcelas restantes a partir deste mes"
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {parceladasAtivas.map((c) => {
              const parcelaValor = c.total / (c.parcelas_totais ?? 1);
              const restantes = (c.parcelas_totais ?? 0) - (c.parcela_atual ?? 0);
              return (
                <div key={c.item} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="text-ink">{c.item}</span>
                    <span className="text-ink-muted ml-2 text-xs">
                      parcela {c.parcela_atual}/{c.parcelas_totais}
                    </span>
                  </div>
                  <div className="text-right tabular">
                    <div className="text-ink font-medium">{formatBRL(parcelaValor)}/mes</div>
                    <div className="text-ink-muted text-xs">
                      {restantes > 0 ? `${restantes} restante(s)` : "ultima parcela"}
                    </div>
                  </div>
                </div>
              );
            })}
            {parceladasAtivas.length === 0 && (
              <p className="text-sm text-ink-muted py-2.5">Nenhuma compra parcelada ativa.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
