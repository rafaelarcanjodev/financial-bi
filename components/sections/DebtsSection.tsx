import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import type { MonthView } from "@/lib/months";

export function DebtsSection({ data, monthView }: { data: MasterData; monthView: MonthView }) {
  const { dividasAtivas, totalDividasAtivas, patrimonio } = monthView;
  const atrasadas = data.dividas.atrasadas;
  const totalAtrasadas = data.dividas.total_atrasadas;
  const totalDividas = totalDividasAtivas + totalAtrasadas;

  const [openSubitens, setOpenSubitens] = useState<Record<string, boolean>>({
    ativas: true,
    atrasadas: true,
    patrimonio: true,
    libertacao: true,
  });

  const toggle = (key: string) => {
    setOpenSubitens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const timelineLibertacao = [
    { data: "Fevereiro/2027", credor: "Empréstimo Sogro", liberacao: 1000.0, status: "em 5 meses" },
    { data: "Março/2027", credor: "Nubank Natasha (App)", liberacao: 328.2, status: "em 6 meses" },
    { data: "Setembro/2029", credor: "Itaú Consignado 2", liberacao: 949.2, status: "em 36 meses" },
    { data: "Outubro/2029", credor: "Financiamento Carro", liberacao: 1165.06, status: "em 37 meses" },
    { data: "Dezembro/2029", credor: "Itaú Consignado 1", liberacao: 382.48, status: "em 39 meses" },
    { data: "Junho/2031", credor: "Banco Inter Consignado", liberacao: 234.18, status: "em 57 meses" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {!monthView.isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando {formatMonthLabel(monthView.mes)} · dívidas ativas e patrimônio projetados a partir do
          mês vigente ({formatMonthLabel(data._metadata.mes_referencia)}); dívidas atrasadas permanecem como passivo acumulado até a quitação.
        </p>
      )}

      {/* StatTiles padronizados no topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Dívidas ativas (mês)"
          value={formatBRL(totalDividasAtivas)}
          hint="Parcelas mensais em dia"
        />
        <StatTile
          label="Dívidas atrasadas"
          value={formatBRL(totalAtrasadas)}
          tone="critical"
          hint={`${atrasadas.length} credores vencidos`}
        />
        {patrimonio && (
          <StatTile
            label="Patrimônio bloqueado"
            value={formatBRL(patrimonio.total)}
            tone="good"
            hint="FGTS, bens e previdência"
          />
        )}
        {patrimonio && (
          <StatTile
            label="Patrimônio - Dívidas"
            value={formatBRL(patrimonio.total - totalDividas)}
            tone={patrimonio.total - totalDividas >= 0 ? "good" : "critical"}
            hint="Balanço patrimonial total"
          />
        )}
      </div>

      {/* Grid de Cards no mesmo padrão de Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Dívidas Ativas */}
        <SectionCard
          title="Dívidas ativas (em dia)"
          subtitle={`${formatBRL(totalDividasAtivas)} de parcelas recorrentes no mês`}
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {dividasAtivas.map((d, idx) => {
              const startsLater = d.data_inicio && d.data_inicio > monthView.mes;
              return (
                <div key={idx} className="py-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-ink font-medium">{d.credor}</span>
                      {d.data_final && (
                        <span className="text-ink-muted text-xs ml-2">
                          até {formatMonthLabel(d.data_final)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-ink">{formatBRL(d.valor)}</span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          startsLater
                            ? "bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]"
                            : "bg-[#0ca30c]/10 text-[#0ca30c]"
                        }`}
                      >
                        {startsLater ? `inicia em ${formatMonthLabel(d.data_inicio!)}` : "em dia"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Card 2: Dívidas Atrasadas */}
        {atrasadas.length > 0 && (
          <SectionCard
            title="Dívidas atrasadas (vencidas)"
            subtitle={`${atrasadas.length} credores com pagamentos parados para quitação futura`}
          >
            <div className="flex flex-col divide-y divide-[var(--gridline)]">
              {atrasadas.map((a, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-ink font-medium">{a.credor}</span>
                    <span className="text-ink-muted text-xs ml-2">
                      {a.credor.toLowerCase().includes("natasha") || a.credor.toLowerCase().includes("botic") || a.credor.toLowerCase().includes("lis") || a.credor.toLowerCase().includes("mercado")
                        ? "Natasha"
                        : "Rafael"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular font-semibold text-[#d03b3b] dark:text-[#e66767]">
                      {formatBRL(a.valor)}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]">
                      atrasada
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Card 3: Patrimônio Bloqueado */}
        {patrimonio && (
          <SectionCard
            title="Patrimônio bloqueado"
            subtitle={`${formatBRL(patrimonio.total)} em ativos não líquidos e investimentos`}
          >
            <div className="flex flex-col divide-y divide-[var(--gridline)]">
              {patrimonio.itens.map((p) => {
                const isCarro = p.item.toLowerCase().includes("carro");
                const isMoto = p.item.toLowerCase().includes("moto");
                const statusTag = isMoto
                  ? { label: "quitado", bg: "bg-[#0ca30c]/10 text-[#0ca30c]" }
                  : isCarro
                  ? { label: "financiado", bg: "bg-[#2a78d6]/10 text-[#2a78d6]" }
                  : { label: "bloqueado", bg: "bg-[var(--gridline)] text-ink-muted" };

                return (
                  <div key={p.item} className="py-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-ink font-medium">{p.item}</span>
                        {p.adicao_mensal > 0 && (
                          <span className="text-ink-muted text-xs ml-2">
                            +{formatBRL(p.adicao_mensal)}/mês
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular font-semibold text-ink">{formatBRL(p.valor)}</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusTag.bg}`}>
                          {statusTag.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Card 4: Cronograma de Libertação de Dívidas */}
        <SectionCard
          title="Timeline de libertação de caixa"
          subtitle="Previsão de término das parcelas e impacto no fluxo mensal"
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {timelineLibertacao.map((t, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{t.data}</span>
                    <span className="text-xs text-ink-muted">· {t.status}</span>
                  </div>
                  <span className="text-xs text-ink-secondary">{t.credor} quita</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div className="tabular">
                    <span className="font-bold text-[#0ca30c]">+{formatBRL(t.liberacao)}</span>
                    <span className="text-[10px] text-ink-muted block">liberado/mês</span>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                    futuro
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
