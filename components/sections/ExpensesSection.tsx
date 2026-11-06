import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { Meter } from "@/components/Meter";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import type { MasterData, DespesaItem } from "@/lib/types";
import type { MonthView } from "@/lib/months";

function getStatusBadge(item: DespesaItem) {
  if (item.previsto <= 0) {
    return item.pago > 0 ? (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
        pago
      </span>
    ) : null;
  }
  if (item.pago >= item.previsto) {
    const isExceeded = item.pago > item.previsto;
    return (
      <span
        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          isExceeded
            ? "bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]"
            : "bg-[#0ca30c]/10 text-[#0ca30c]"
        }`}
      >
        {isExceeded ? "excedeu" : "pago"}
      </span>
    );
  }
  if (item.pago > 0) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]">
        parcial
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--gridline)] text-ink-muted">
      pendente
    </span>
  );
}

function ItemRow({ item, comPago }: { item: DespesaItem; comPago: boolean }) {
  const [open, setOpen] = useState(true);
  const hasSubitems = Array.isArray(item.detalhes) && item.detalhes.length > 0;

  return (
    <div className="flex flex-col gap-2 py-2 border-b border-[var(--gridline)] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          {comPago ? (
            item.previsto > 0 ? (
              <Meter label={item.item} value={item.pago} limit={item.previsto} />
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-secondary">
                  {item.item}
                  <span className="text-ink-muted text-xs ml-1.5">(gasto avulso)</span>
                </span>
                <span className="tabular text-ink font-medium">{formatBRL(item.pago)}</span>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary">{item.item}</span>
              <span className="tabular text-ink font-medium">{formatBRL(item.previsto)}</span>
            </div>
          )}
        </div>

        {comPago && (
          <div className="flex items-center gap-2">
            {getStatusBadge(item)}
            {hasSubitems && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="text-[11px] font-medium px-2 py-0.5 rounded border border-[var(--border-hairline)] text-ink-muted hover:text-ink transition-colors"
                title={open ? "Ocultar subitens" : "Ver subitens"}
              >
                {item.detalhes!.length} subitem{item.detalhes!.length > 1 ? "s" : ""}{" "}
                {open ? "▲" : "▼"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Subitens detalhados (ex: Supermercado e Almocos e extras) */}
      {comPago && hasSubitems && open && (
        <div className="ml-2 pl-3 border-l-2 border-[var(--border-hairline)] flex flex-col gap-1.5 py-1 mt-1 bg-[var(--card-surface)]/40 rounded-r p-2">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-ink-muted mb-0.5">
            Lançamentos detalhados ({item.item})
          </div>
          {item.detalhes!.map((det, dIdx) => (
            <div
              key={dIdx}
              className="flex items-center justify-between text-xs py-1 border-b border-[var(--gridline)]/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">•</span>
                <span className="text-ink-secondary font-medium">{det.descricao}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-ink">{formatBRL(det.valor)}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0ca30c]/10 text-[#0ca30c]">
                  pago
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExpensesSection({ data, monthView }: { data: MasterData; monthView: MonthView }) {
  const despesas = monthView.despesas;
  const categorias = monthView.despesasCategorias;
  const comPago = monthView.despesasComPago;
  const previstoTotal = categorias.reduce((s, cat) => s + cat.itens.reduce((s2, i) => s2 + i.previsto, 0), 0);
  const parceladas = monthView.comprasParceladas;
  const parceladoPagoTotal = monthView.isVigente
    ? parceladas.reduce((s, c) => s + c.pago_mes, 0)
    : parceladas.reduce((s, c) => s + c.total / c.parcelas_totais, 0);

  return (
    <div className="flex flex-col gap-5">
      {!monthView.isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando {formatMonthLabel(monthView.mes)} · compras parceladas projetadas a partir do mês
          vigente. Categorias de despesa fixa mostram o previsto recorrente; &ldquo;já pago&rdquo; só aparece quando
          há dado real registrado para este mês.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Previsto no mês" value={formatBRL(despesas?.resumo.previsto_total ?? previstoTotal)} />
        {comPago && despesas && (
          <>
            <StatTile label="Já pago" value={formatBRL(despesas.resumo.pago_total)} tone="good" />
            <StatTile
              label="Restante a pagar"
              value={formatBRL(Math.max(0, despesas.resumo.previsto_total - despesas.resumo.pago_total))}
              tone="warning"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categorias.map((cat) => {
          const previsto = cat.itens.reduce((s, i) => s + i.previsto, 0);
          const pago = cat.itens.reduce((s, i) => s + i.pago, 0);
          const itensVisiveis = comPago
            ? cat.itens.filter((i) => i.previsto > 0 || i.pago > 0)
            : cat.itens.filter((i) => i.previsto > 0);
          if (itensVisiveis.length === 0) return null;

          return (
            <SectionCard
              key={cat.nome}
              title={cat.nome}
              subtitle={
                comPago
                  ? `${formatBRL(pago)} de ${formatBRL(previsto)} pago`
                  : `${formatBRL(previsto)} previsto (fixo mensal)`
              }
            >
              <div className="flex flex-col">
                {itensVisiveis.map((item) => (
                  <ItemRow key={item.item} item={item} comPago={comPago} />
                ))}
              </div>
            </SectionCard>
          );
        })}

        {parceladas.length > 0 && (
          <SectionCard
            title="Compras parceladas"
            subtitle={
              monthView.isVigente
                ? `${formatBRL(parceladoPagoTotal)} pago este mês`
                : `${formatBRL(parceladoPagoTotal)} previsto neste mês`
            }
          >
            <div className="flex flex-col divide-y divide-[var(--gridline)]">
              {parceladas.map((c) => (
                <div key={c.item} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="text-ink font-medium">{c.item}</span>
                    <span className="text-ink-muted ml-2 text-xs">parcela {c.parcela}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right tabular">
                      <div className="text-ink font-semibold">
                        {formatBRL(c.total / c.parcelas_totais)}
                      </div>
                      <div className="text-ink-muted text-xs">total {formatBRL(c.total)}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                      {monthView.isVigente && c.pago_mes > 0 ? "pago no mês" : "em dia"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {parceladas.length === 0 && categorias.length === 0 && (
          <p className="text-sm text-ink-muted">Nenhuma despesa registrada ou projetada para este mês.</p>
        )}
      </div>
    </div>
  );
}
