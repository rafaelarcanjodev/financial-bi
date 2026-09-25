import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { Meter } from "@/components/Meter";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import type { MasterData } from "@/lib/types";
import type { MonthView } from "@/lib/months";

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
          Mostrando {formatMonthLabel(monthView.mes)} · compras parceladas projetadas a partir do mes
          vigente. Categorias de despesa fixa mostram o previsto recorrente; "ja pago" so aparece quando
          ha dado real registrado para este mes.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Previsto no mes" value={formatBRL(despesas?.resumo.previsto_total ?? previstoTotal)} />
        {comPago && despesas && (
          <>
            <StatTile label="Ja pago" value={formatBRL(despesas.resumo.pago_total)} tone="good" />
            <StatTile
              label="Restante a pagar"
              value={formatBRL(despesas.resumo.previsto_total - despesas.resumo.pago_total)}
              tone="warning"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categorias.map((cat) => {
          const previsto = cat.itens.reduce((s, i) => s + i.previsto, 0);
          const pago = cat.itens.reduce((s, i) => s + i.pago, 0);
          // Itens sem previsto fixo (gasto extra/variavel) so aparecem quando ha
          // dado real de pagamento neste mes; sem previsto e sem pago, nao ha
          // nada a mostrar para esse mes.
          const itensVisiveis = comPago ? cat.itens.filter((i) => i.previsto > 0 || i.pago > 0) : cat.itens.filter((i) => i.previsto > 0);
          if (itensVisiveis.length === 0) return null;
          return (
            <SectionCard
              key={cat.nome}
              title={cat.nome}
              subtitle={comPago ? `${formatBRL(pago)} de ${formatBRL(previsto)} pago` : `${formatBRL(previsto)} previsto (fixo mensal)`}
            >
              <div className="flex flex-col gap-4">
                {comPago
                  ? itensVisiveis.map((item) =>
                      item.previsto > 0 ? (
                        <Meter key={item.item} label={item.item} value={item.pago} limit={item.previsto} />
                      ) : (
                        <div key={item.item} className="flex items-center justify-between text-sm">
                          <span className="text-ink-secondary">
                            {item.item}
                            <span className="text-ink-muted text-xs ml-1.5">(sem expectativa fixa)</span>
                          </span>
                          <span className="tabular text-ink font-medium">{formatBRL(item.pago)}</span>
                        </div>
                      )
                    )
                  : itensVisiveis.map((item) => (
                      <div key={item.item} className="flex items-center justify-between text-sm">
                        <span className="text-ink-secondary">{item.item}</span>
                        <span className="tabular text-ink font-medium">{formatBRL(item.previsto)}</span>
                      </div>
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
                ? `${formatBRL(parceladoPagoTotal)} pago este mes`
                : `${formatBRL(parceladoPagoTotal)} previsto neste mes`
            }
          >
            <div className="flex flex-col divide-y divide-[var(--gridline)]">
              {parceladas.map((c) => (
                <div key={c.item} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="text-ink">{c.item}</span>
                    <span className="text-ink-muted ml-2 text-xs">parcela {c.parcela}</span>
                  </div>
                  <div className="text-right tabular">
                    <div className="text-ink font-medium">{formatBRL(c.total / c.parcelas_totais)}</div>
                    <div className="text-ink-muted text-xs">total {formatBRL(c.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {parceladas.length === 0 && categorias.length === 0 && (
          <p className="text-sm text-ink-muted">Nenhuma despesa registrada ou projetada para este mes.</p>
        )}
      </div>
    </div>
  );
}
