import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
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
  const [openSubitens, setOpenSubitens] = useState<Record<string, boolean>>({
    CLICK: true,
    UNICLASS: true,
    NUBANK_RAFAEL: true,
  });

  const toggle = (key: string) => {
    setOpenSubitens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* StatTiles padronizados no topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(cartoes_credito).map(([nome, cartao]) => {
          const entry = getCardMonthEntry(cartao, mes);
          const pendente =
            entry?.tipo === "confirmado" && entry.valorPago !== undefined
              ? entry.valor - entry.valorPago
              : undefined;
          const pagoHint =
            entry?.tipo === "confirmado" && entry.pago !== undefined
              ? entry.pago
                ? " · pago"
                : pendente
                ? ` · pendente ${formatBRL(pendente)}`
                : " · não pago"
              : "";
          return (
            <StatTile
              key={nome}
              label={`${nome} · ${formatMonthLabel(mes)}`}
              value={entry ? formatBRL(entry.valor) : "—"}
              hint={
                entry
                  ? `${cartao.banco} · ${TIPO_LABEL[entry.tipo]}${pagoHint}`
                  : `${cartao.banco} · sem dado`
              }
              tone={
                entry?.tipo === "confirmado" && entry.pago !== undefined
                  ? entry.pago
                    ? "good"
                    : "critical"
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Grid de Cards no mesmo padrão de Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Object.entries(cartoes_credito).map(([nome, cartao]) => {
          const entry = getCardMonthEntry(cartao, mes);
          const faturasOrdenadas = cartao.faturas.slice().sort((a, b) => a.mes.localeCompare(b.mes));
          const totalHistorico = faturasOrdenadas.reduce((s, f) => s + f.valor, 0);
          const isOpen = openSubitens[nome] ?? true;

          return (
            <SectionCard key={nome} title={nome} subtitle={`${cartao.banco} · ${cartao.status}`}>
              {entry && (
                <div className="mb-4 pb-4 border-b border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-ink font-semibold">Fatura de {formatMonthLabel(mes)}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-ink font-bold">{formatBRL(entry.valor)}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TIPO_CLASS[entry.tipo]}`}>
                        {TIPO_LABEL[entry.tipo]}
                      </span>
                      {entry.tipo === "confirmado" && entry.pago !== undefined && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            entry.pago
                              ? "bg-[#0ca30c]/10 text-[#0ca30c]"
                              : "bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]"
                          }`}
                        >
                          {entry.pago ? "pago" : "não pago"}
                        </span>
                      )}
                    </div>
                  </div>

                  {entry.tipo === "confirmado" && entry.pago === false && entry.valorPago !== undefined && (
                    <div className="text-xs text-[#d03b3b] dark:text-[#e66767] font-medium mt-1 mb-2">
                      Pago {formatBRL(entry.valorPago)} de {formatBRL(entry.valor)} · pendente{" "}
                      {formatBRL(entry.valor - entry.valorPago)}
                    </div>
                  )}

                  {/* Subitens detalhados da fatura linha a linha */}
                  {entry.itens && entry.itens.length > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-ink-muted uppercase">
                          Itens da fatura ({entry.itens.length} compras)
                        </span>
                        <button
                          onClick={() => toggle(nome)}
                          className="text-[11px] text-ink-muted hover:text-ink px-1.5 py-0.5 rounded border border-[var(--border-hairline)]"
                        >
                          {isOpen ? "Ocultar ▲" : "Ver subitens ▼"}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="ml-2 pl-3 border-l-2 border-[var(--border-hairline)] flex flex-col gap-1.5 py-1 bg-[var(--card-surface)]/40 rounded-r p-2">
                          {entry.itens.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs py-1 border-b border-[var(--gridline)]/50 last:border-b-0"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-ink-muted">•</span>
                                <span className="text-ink-secondary font-medium">{item.descricao}</span>
                                {item.parcela_atual && item.parcelas_totais && (
                                  <span className="text-[10px] text-ink-muted">
                                    (parcela {item.parcela_atual}/{item.parcelas_totais})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="tabular font-semibold text-ink">{formatBRL(item.valor)}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0ca30c]/10 text-[#0ca30c]">
                                  {entry.pago ? "pago" : "fatura"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {entry.itensCompletos === false && (
                    <p className="text-xs text-ink-muted mt-2 italic">
                      Itens não cobrem o total da fatura (extração parcial).
                    </p>
                  )}
                  {entry.observacao && (
                    <p className="text-xs text-ink-muted mt-1.5">{entry.observacao}</p>
                  )}
                </div>
              )}

              {/* Cronograma de faturas */}
              <p className="text-xs font-semibold text-ink-muted uppercase mb-2">
                Histórico e projeções ({nome})
              </p>
              <div className="flex flex-col divide-y divide-[var(--gridline)]">
                {faturasOrdenadas.map((f) => (
                  <div key={f.mes} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-secondary font-medium">{formatMonthLabel(f.mes)}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-ink font-semibold">{formatBRL(f.valor)}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          f.pago ? "bg-[#0ca30c]/10 text-[#0ca30c]" : "bg-[var(--gridline)] text-ink-muted"
                        }`}
                      >
                        {f.pago ? "pago" : "aberto"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-hairline)] text-sm">
                <span className="text-ink-muted text-xs">Total histórico no período</span>
                <span className="tabular text-ink font-bold">{formatBRL(totalHistorico)}</span>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
