import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import type { MasterData } from "@/lib/types";

export function PayrollSection({ data }: { data: MasterData }) {
  const { holerites, beneficios_mensais, pessoas, entradas, freelances_historico } = data;

  const chartData = Object.entries(holerites).flatMap(([pessoa, entries]) =>
    entries.map((h) => ({
      name: `${formatMonthLabel(h.competencia)} ${pessoas[pessoa]?.nome.split(" ")[0] ?? pessoa}`,
      Bruto: h.bruto,
      Liquido: h.liquido ?? 0,
    }))
  );

  const entradasStatus = [
    ...entradas.recebido.map((e) => ({ ...e, status: "recebido" as const })),
    ...entradas.pendente.map((e) => ({ ...e, status: "pendente" as const })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Recebido no mes" value={formatBRL(entradas.total_recebido)} tone="good" />
        <StatTile label="Pendente no mes" value={formatBRL(entradas.total_pendente)} tone="warning" />
        <StatTile label="Total esperado" value={formatBRL(entradas.total_esperado)} />
        {Object.entries(beneficios_mensais).map(([pessoa, b]) => (
          <StatTile
            key={pessoa}
            label={`Beneficios ${pessoas[pessoa]?.nome.split(" ")[0] ?? pessoa}`}
            value={formatBRL(b.total)}
          />
        ))}
      </div>

      {entradasStatus.length > 0 && (
        <SectionCard title="Status das entradas" subtitle="Recebido vs. ainda pendente, item a item">
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {entradasStatus.map((e, i) => (
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

      <SectionCard title="Bruto vs liquido por holerite" subtitle="Historico por pessoa e competencia">
        <GroupedBarChart
          data={chartData}
          xKey="name"
          series={[
            { key: "Bruto", name: "Bruto", color: "#2a78d6" },
            { key: "Liquido", name: "Liquido", color: "#1baf7a" },
          ]}
        />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Object.entries(holerites).map(([pessoa, entries]) => {
          const ultimo = entries[entries.length - 1];
          if (!ultimo) return null;
          const nome = pessoas[pessoa]?.nome ?? pessoa;
          const descontosOrdenados = ultimo.descontos
            .slice()
            .sort((a, b) => b.valor - a.valor)
            .map((d) => ({ name: d.descricao, value: d.valor, color: "#2a78d6" }));

          return (
            <SectionCard
              key={pessoa}
              title={`${nome} - holerite de ${formatMonthLabel(ultimo.competencia)}`}
              subtitle={`Status: ${ultimo.status}`}
            >
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatTile label="Bruto" value={formatBRL(ultimo.bruto)} />
                <StatTile label="Total proventos" value={formatBRL(ultimo.total_proventos)} />
                <StatTile label="Total descontos" value={formatBRL(ultimo.total_descontos)} tone="critical" />
                <StatTile
                  label="Liquido"
                  value={ultimo.liquido !== null ? formatBRL(ultimo.liquido) : "A confirmar"}
                  tone="good"
                />
              </div>

              {descontosOrdenados.length > 0 ? (
                <>
                  <p className="text-xs text-ink-muted mb-2">
                    Descontos detalhados ({descontosOrdenados.length} itens)
                  </p>
                  <HorizontalBarChart data={descontosOrdenados} />
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Sem descontos detalhados para esta competencia ainda.
                </p>
              )}
            </SectionCard>
          );
        })}
      </div>

      <SectionCard
        title="Freelances"
        subtitle="Historico e previsao por cliente - confirmado (recebido), estimado (previsto) ou pendente (esperado, ainda nao chegou)"
      >
        <div className="flex flex-col divide-y divide-[var(--gridline)]">
          {freelances_historico.map((f) => (
            <div key={f.cliente} className="py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-ink font-medium">{f.cliente}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    f.status === "ativo"
                      ? "bg-[#0ca30c]/10 text-[#0ca30c]"
                      : "bg-[var(--gridline)] text-ink-muted"
                  }`}
                >
                  {f.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1.5">
                {f.recebimentos.map((r, i) => {
                  const st = r.status ?? "confirmado";
                  const cls =
                    st === "confirmado"
                      ? "bg-[#0ca30c]/10 text-[#0ca30c]"
                      : st === "pendente"
                        ? "bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]"
                        : "bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]";
                  return (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded-full tabular ${cls}`}>
                      {r.mes}: {formatBRL(r.valor)} · {st}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
