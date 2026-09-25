import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { getCardMonthEntry } from "@/lib/months";
import type { MasterData } from "@/lib/types";

const TIPO_LABEL: Record<string, string> = {
  confirmado: "confirmado",
  estimado: "estimado",
  quitado: "quitado",
};

const TIPO_CLASS: Record<string, string> = {
  confirmado: "bg-[#0ca30c]/10 text-[#0ca30c]",
  estimado: "bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]",
  quitado: "bg-[var(--gridline)] text-ink-muted",
};

export function CardsSection({ data, mes }: { data: MasterData; mes: string }) {
  const { cartoes_credito } = data;

  const meses = Array.from(
    new Set(Object.values(cartoes_credito).flatMap((c) => c.faturas.map((f) => f.mes)))
  ).sort();

  const chartData = meses.map((m) => {
    const row: Record<string, string | number> = { name: formatMonthLabel(m) };
    for (const [nome, cartao] of Object.entries(cartoes_credito)) {
      row[nome] = cartao.faturas.find((f) => f.mes === m)?.valor ?? 0;
    }
    return row;
  });

  const cardColors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(cartoes_credito).map(([nome, cartao]) => {
          const entry = getCardMonthEntry(cartao, mes);
          const pendente =
            entry?.tipo === "confirmado" && entry.valorPago !== undefined ? entry.valor - entry.valorPago : undefined;
          const pagoHint =
            entry?.tipo === "confirmado" && entry.pago !== undefined
              ? entry.pago
                ? " · pago"
                : pendente
                  ? ` · pendente ${formatBRL(pendente)}`
                  : " · nao pago"
              : "";
          return (
            <StatTile
              key={nome}
              label={`${nome} · ${formatMonthLabel(mes)}`}
              value={entry ? formatBRL(entry.valor) : "—"}
              hint={entry ? `${cartao.banco} · ${TIPO_LABEL[entry.tipo]}${pagoHint}` : `${cartao.banco} · sem dado`}
              tone={entry?.tipo === "confirmado" && entry.pago !== undefined ? (entry.pago ? "good" : "critical") : undefined}
            />
          );
        })}
      </div>

      <SectionCard title="Faturas dos cartoes" subtitle="Valor por mes e por cartao (confirmado)">
        <GroupedBarChart
          data={chartData}
          xKey="name"
          series={Object.keys(cartoes_credito).map((nome, i) => ({
            key: nome,
            name: nome,
            color: cardColors[i % cardColors.length],
          }))}
        />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Object.entries(cartoes_credito).map(([nome, cartao]) => {
          const entry = getCardMonthEntry(cartao, mes);
          const faturasOrdenadas = cartao.faturas.slice().sort((a, b) => a.mes.localeCompare(b.mes));
          const totalHistorico = faturasOrdenadas.reduce((s, f) => s + f.valor, 0);

          return (
            <SectionCard key={nome} title={nome} subtitle={`${cartao.banco} · ${cartao.status}`}>
              {entry && (
                <div className="mb-4 pb-4 border-b border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-ink font-medium">{formatMonthLabel(mes)}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-ink font-semibold">{formatBRL(entry.valor)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_CLASS[entry.tipo]}`}>
                        {TIPO_LABEL[entry.tipo]}
                      </span>
                      {entry.tipo === "confirmado" && entry.pago !== undefined && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.pago ? "bg-[#0ca30c]/10 text-[#0ca30c]" : "bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]"
                          }`}
                        >
                          {entry.pago ? "pago" : "nao pago"}
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.tipo === "confirmado" && entry.pago === false && entry.valorPago !== undefined && (
                    <p className="text-xs text-ink-muted mt-2">
                      Pago {formatBRL(entry.valorPago)} de {formatBRL(entry.valor)} · pendente{" "}
                      {formatBRL(entry.valor - entry.valorPago)}
                    </p>
                  )}
                  {entry.itens && entry.itens.length > 0 && (
                    <div className="flex flex-col gap-1 pl-3 border-l border-[var(--gridline)]">
                      {entry.itens.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-ink-muted">
                          <span>
                            {item.descricao}
                            {item.parcela_atual && item.parcelas_totais && (
                              <span className="ml-1.5">
                                (parcela {item.parcela_atual}/{item.parcelas_totais}
                                {item.parcelas_totais - item.parcela_atual > 0
                                  ? ` · ${item.parcelas_totais - item.parcela_atual} restante(s)`
                                  : " · ultima parcela"}
                                )
                              </span>
                            )}
                          </span>
                          <span className="tabular">{formatBRL(item.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.itensCompletos === false && (
                    <p className="text-xs text-ink-muted mt-2 italic">
                      Itens nao cobrem o total da fatura - extracao parcial.
                    </p>
                  )}
                  {entry.observacao && (
                    <p className="text-xs text-ink-muted mt-2">{entry.observacao}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-ink-muted mb-2">Historico de faturas confirmadas</p>
              <div className="flex flex-col divide-y divide-[var(--gridline)]">
                {faturasOrdenadas.map((f) => (
                  <div key={f.mes} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-secondary">{formatMonthLabel(f.mes)}</span>
                    <span className="tabular text-ink font-medium">{formatBRL(f.valor)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-hairline)] text-sm">
                <span className="text-ink-muted">Total confirmado no periodo</span>
                <span className="tabular text-ink font-semibold">{formatBRL(totalHistorico)}</span>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
