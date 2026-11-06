import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { StatTile } from "@/components/StatTile";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import type { MasterData } from "@/lib/types";

import type { MonthView } from "@/lib/months";

export function PayrollSection({
  data,
  mes,
  monthView,
}: {
  data: MasterData;
  mes?: string;
  monthView?: MonthView;
}) {
  const isVigente = !mes || mes === data._metadata.mes_referencia;
  const effectiveMonth = mes || data._metadata.mes_referencia;
  const { entradas, holerites, pessoas, beneficios_mensais } = data;
  const [openSubitens, setOpenSubitens] = useState<Record<string, boolean>>({
    salarios: true,
    freelance_johnny: true,
    freelance_elizandro: true,
  });

  const toggle = (key: string) => {
    setOpenSubitens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalBeneficios = Object.values(beneficios_mensais).reduce((s, b) => s + b.total, 0);
  const rendaRafaelObj = data.renda_fixa_mensal?.find((r) => r.pessoa.toUpperCase().includes("RAFAEL"));
  const rendaNatashaObj = data.renda_fixa_mensal?.find((r) => r.pessoa.toUpperCase().includes("NATASHA"));

  const rendaRafael = rendaRafaelObj?.liquido ?? 2860.7;
  const rendaNatasha = rendaNatashaObj?.liquido ?? 5244.31;

  const brutoRafael = rendaRafaelObj?.bruto ?? data.pessoas.RAFAEL?.salario_bruto_fixo ?? 6258.18;
  const brutoNatasha = rendaNatashaObj?.bruto ?? data.pessoas.NATASHA?.salario_bruto_fixo ?? 7048.76;

  const descontosRafael = rendaRafaelObj?.descontos ?? 3397.48;
  const descontosNatasha = rendaNatashaObj?.descontos ?? 1804.45;

  // Busca valores reais dinâmicos nos arrays de recebido e pendente
  const findRecebido = (term: string) =>
    entradas.recebido.find((r) => r.item.toLowerCase().includes(term.toLowerCase()))?.valor ?? 0;
  const findPendente = (term: string) =>
    entradas.pendente.find((p) => p.item.toLowerCase().includes(term.toLowerCase()))?.valor ?? 0;

  const caminhoRecebido = findRecebido("Caminho Louvor");
  const padreLeonanRecebido = findRecebido("Padre Leonan");
  const johnnyRecebido = findRecebido("Johnny");
  const johnnyPendente = findPendente("Johnny");
  const elizandroRecebido = findRecebido("Elizandro");
  const elizandroPendente = findPendente("Elizandro");

  const knownKeywords = ["salario", "vr", "vho", "caminho", "leonan", "johnny", "elizandro"];
  const outrosFreelances = [
    ...entradas.recebido
      .filter((r) => !knownKeywords.some((k) => r.item.toLowerCase().includes(k)))
      .map((r) => ({ item: r.item, valor: r.valor, status: "recebido" as const })),
    ...entradas.pendente
      .filter((p) => !knownKeywords.some((k) => p.item.toLowerCase().includes(k)))
      .map((p) => ({ item: p.item, valor: p.valor, status: "pendente" as const })),
  ];

  interface FreelanceDisplayItem {
    id: string;
    cliente: string;
    descricao: string;
    valor: number;
    total?: number;
    status: "recebido" | "pendente" | "previsto" | "parcial" | "quitado";
    subitens?: {
      label: string;
      valor: number;
      tag: string;
      tagColor?: string;
    }[];
  }

  const freelanceList: FreelanceDisplayItem[] = [];

  if (isVigente) {
    // 1. Johnny Boeira
    freelanceList.push({
      id: "freelance_johnny",
      cliente: "Johnny Boeira",
      descricao: `Total ${formatBRL(johnnyRecebido + (johnnyPendente > 0 ? johnnyPendente : 950.0))}`,
      valor: johnnyRecebido > 0 ? johnnyRecebido : 1400.0,
      total: johnnyRecebido + (johnnyPendente > 0 ? johnnyPendente : 950.0),
      status: johnnyPendente === 0 && johnnyRecebido > 0 ? "quitado" : "parcial",
      subitens: [
        {
          label: "• 1ª Parcela (15/SET)",
          valor: johnnyRecebido > 0 ? johnnyRecebido : 1400.0,
          tag: "recebido",
          tagColor: "text-[#0ca30c]",
        },
        {
          label: "• 2ª Parcela",
          valor: johnnyPendente > 0 ? johnnyPendente : 950.0,
          tag: johnnyPendente > 0 ? "pendente" : "recebido",
          tagColor: johnnyPendente > 0 ? "text-[#c98500] dark:text-[#fab219]" : "text-[#0ca30c]",
        },
      ],
    });

    // 2. Elizandro Barro
    freelanceList.push({
      id: "freelance_elizandro",
      cliente: "Elizandro Barro",
      descricao: "Projeto novo (1ª parcela paga em setembro)",
      valor: elizandroRecebido > 0 ? elizandroRecebido : 1000.0,
      status: elizandroRecebido > 0 ? "recebido" : "pendente",
      subitens: [
        {
          label: "• 1ª Parcela (15/SET)",
          valor: 1000.0,
          tag: "recebido",
          tagColor: "text-[#0ca30c]",
        },
        {
          label: "• 2ª Parcela (15/OUT)",
          valor: 1000.0,
          tag: "mês seguinte (outubro)",
          tagColor: "text-ink-muted",
        },
      ],
    });

    // 3. Caminho do Louvor
    freelanceList.push({
      id: "freelance_caminho",
      cliente: "Caminho do Louvor",
      descricao: "Manutenção e suporte mensal contínuo",
      valor: caminhoRecebido > 0 ? caminhoRecebido : 850.0,
      status: caminhoRecebido > 0 ? "recebido" : "previsto",
    });

    // 4. Padre Leonan
    freelanceList.push({
      id: "freelance_leonan",
      cliente: "Padre Leonan",
      descricao: "Consultoria técnica / Pix (parcela 1/4)",
      valor: padreLeonanRecebido > 0 ? padreLeonanRecebido : 375.0,
      status: padreLeonanRecebido > 0 ? "recebido" : "previsto",
    });

    // 5. Outros lançamentos avulsos
    for (const f of outrosFreelances) {
      freelanceList.push({
        id: f.item,
        cliente: f.item,
        descricao: "Lançamento adicional",
        valor: f.valor,
        status: f.status,
      });
    }
  } else {
    // Meses projetados (ex: 2026-10, 2026-11, etc.)
    // Contrato contínuo
    freelanceList.push({
      id: "freelance_caminho",
      cliente: "Caminho do Louvor",
      descricao: "Manutenção e suporte mensal contínuo",
      valor: 850.0,
      status: "previsto",
    });

    // Percorre freelances_historico para este mês específico
    for (const f of data.freelances_historico ?? []) {
      for (const rec of f.recebimentos ?? []) {
        if (rec.mes.startsWith(effectiveMonth)) {
          if (f.cliente.toLowerCase().includes("johnny")) {
            const isUltima = effectiveMonth === "2026-11";
            freelanceList.push({
              id: "freelance_johnny",
              cliente: "Johnny Boeira",
              descricao: isUltima ? "Última parcela de quitação do contrato" : "Parcela mensal do contrato",
              valor: rec.valor,
              status: rec.status === "confirmado" ? "recebido" : "previsto",
              subitens: [
                {
                  label: isUltima ? "• Parcela final de quitação" : `• Parcela prevista (${formatMonthLabel(effectiveMonth)})`,
                  valor: rec.valor,
                  tag: rec.status || "previsto",
                  tagColor: rec.status === "confirmado" ? "text-[#0ca30c]" : "text-[#2a78d6]",
                },
              ],
            });
          } else if (f.cliente.toLowerCase().includes("elizandro")) {
            freelanceList.push({
              id: "freelance_elizandro",
              cliente: "Elizandro Barro",
              descricao: "2ª e última parcela do projeto (1ª parcela paga em Set/2026)",
              valor: rec.valor,
              status: "pendente",
              subitens: [
                {
                  label: "• 1ª Parcela (15/SET)",
                  valor: 1000.0,
                  tag: "paga em set",
                  tagColor: "text-[#0ca30c]",
                },
                {
                  label: "• 2ª Parcela (15/OUT)",
                  valor: rec.valor,
                  tag: "pendente",
                  tagColor: "text-[#c98500] dark:text-[#fab219]",
                },
              ],
            });
          } else if (f.cliente.toLowerCase().includes("padre leonan")) {
            const numParcela =
              effectiveMonth === "2026-10"
                ? "2/4"
                : effectiveMonth === "2026-11"
                ? "3/4"
                : effectiveMonth === "2026-12"
                ? "4/4 (final)"
                : "avulsa";
            freelanceList.push({
              id: "freelance_leonan",
              cliente: "Padre Leonan",
              descricao: `Consultoria técnica (parcela ${numParcela})`,
              valor: rec.valor,
              status: "previsto",
            });
          } else if (f.cliente.toLowerCase().includes("andes") || f.cliente.toLowerCase().includes("alterlux")) {
            freelanceList.push({
              id: "freelance_andes",
              cliente: "Agência Andes (Site Alterlux)",
              descricao: "Desenvolvimento de site (vencimento dia 05)",
              valor: rec.valor,
              status: "previsto",
            });
          } else {
            freelanceList.push({
              id: f.cliente,
              cliente: f.cliente,
              descricao: "Projeto extra",
              valor: rec.valor,
              status: rec.status === "confirmado" ? "recebido" : "previsto",
            });
          }
        }
      }
    }

    // Extras sazonais
    if (effectiveMonth === "2026-11") {
      freelanceList.push({
        id: "13_salario",
        cliente: "13º Salário",
        descricao: "Primeira parcela / abono de final de ano (30/nov)",
        valor: 3000.0,
        status: "previsto",
      });
    } else if (effectiveMonth === "2026-12") {
      freelanceList.push({
        id: "bonus_ferias",
        cliente: "Bônus de Férias",
        descricao: "Gratificação de férias (28/dez)",
        valor: 500.0,
        status: "previsto",
      });
    }
  }

  const totalEsperado = isVigente
    ? entradas.total_esperado
    : monthView?.entradasProjetadas?.total_esperado ?? entradas.total_esperado;

  return (
    <div className="flex flex-col gap-5">
      {!isVigente && (
        <p className="text-xs text-ink-muted">
          Mostrando projeção de entradas para {formatMonthLabel(effectiveMonth)} · Salários e benefícios são fixos
          recorrentes; freelances refletem o cronograma previsto.
        </p>
      )}

      {/* StatTiles padronizados no topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isVigente ? (
          <>
            <StatTile label="Recebido no mês" value={formatBRL(entradas.total_recebido)} tone="good" />
            <StatTile label="Pendente no mês" value={formatBRL(entradas.total_pendente)} tone="warning" />
            <StatTile label="Total esperado" value={formatBRL(entradas.total_esperado)} />
            <StatTile label="Benefícios mensais" value={formatBRL(totalBeneficios)} tone="good" />
          </>
        ) : (
          <>
            <StatTile
              label={`Renda prevista (${formatMonthLabel(effectiveMonth)})`}
              value={formatBRL(totalEsperado)}
              tone="good"
            />
            <StatTile
              label="Salários líquidos"
              value={formatBRL(rendaRafael + rendaNatasha)}
              hint="Renda fixa garantida"
            />
            <StatTile label="Benefícios mensais" value={formatBRL(totalBeneficios)} tone="good" />
            <StatTile
              label="Contratos / Extras"
              value={formatBRL(Math.max(0, totalEsperado - (rendaRafael + rendaNatasha)))}
              hint="Previsão de projetos"
            />
          </>
        )}
      </div>

      {/* Grid de Cards no mesmo padrão de Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Salários e Proventos */}
        <SectionCard
          title="Salários e proventos fixos"
          subtitle={`Total líquido: ${formatBRL(rendaRafael + rendaNatasha)} garantido no mês`}
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {/* Natasha */}
            <div className="py-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-ink font-medium">Natasha Arcanjo</span>
                  <span className="text-ink-muted text-xs ml-2">Tigre · Analista Financeiro Pl</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular font-semibold text-ink">{formatBRL(rendaNatasha)}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                    recebido
                  </span>
                </div>
              </div>
              <div className="ml-2 pl-3 border-l-2 border-[var(--border-hairline)] text-xs text-ink-muted flex flex-col gap-1 mt-0.5">
                <div className="flex justify-between">
                  <span>• Salário Bruto</span>
                  <span className="tabular">{formatBRL(brutoNatasha)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Descontos oficiais (INSS, IRRF, Benefícios)</span>
                  <span className="tabular text-[#d03b3b]">- {formatBRL(descontosNatasha)}</span>
                </div>
              </div>
            </div>

            {/* Rafael */}
            <div className="py-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-ink font-medium">Rafael Arcanjo</span>
                  <span className="text-ink-muted text-xs ml-2">TOTVS · Analista II Backend</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular font-semibold text-ink">{formatBRL(rendaRafael)}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                    recebido
                  </span>
                </div>
              </div>
              <div className="ml-2 pl-3 border-l-2 border-[var(--border-hairline)] text-xs text-ink-muted flex flex-col gap-1 mt-0.5">
                <div className="flex justify-between">
                  <span>• Salário Bruto</span>
                  <span className="tabular">{formatBRL(brutoRafael)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Descontos folha e consignados</span>
                  <span className="tabular text-[#d03b3b]">- {formatBRL(descontosRafael)}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Card 2: Benefícios */}
        <SectionCard
          title="Benefícios mensais"
          subtitle={`${formatBRL(totalBeneficios)} creditados em alimentação e auxílios`}
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            <div className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <span className="text-ink font-medium">VR Natasha</span>
                <span className="text-ink-muted text-xs ml-2">Vale Refeição / Alimentação</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-ink">
                  {formatBRL(beneficios_mensais.NATASHA?.VR ?? beneficios_mensais.NATASHA?.vale_refeicao_vr ?? 722.1)}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                  recebido
                </span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <span className="text-ink font-medium">VR Rafael (Líquido)</span>
                <span className="text-ink-muted text-xs ml-2">
                  Bruto {formatBRL(807.62)} - Desc. {formatBRL(161.52)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-ink">
                  {formatBRL(beneficios_mensais.RAFAEL?.VR ?? 646.1)}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                  recebido
                </span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <span className="text-ink font-medium">VHO Rafael</span>
                <span className="text-ink-muted text-xs ml-2">Vale Home Office / Ajuda de Custo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-ink">
                  {formatBRL(beneficios_mensais.RAFAEL?.VHO ?? 133)}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0ca30c]/10 text-[#0ca30c]">
                  recebido
                </span>
              </div>
            </div>

            <div className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <span className="text-ink font-medium">Previdência Privada Natasha</span>
                <span className="text-ink-muted text-xs ml-2">Aporte direto empresa</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular font-semibold text-ink">{formatBRL(70.49)}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--gridline)] text-ink-muted">
                  bloqueado
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Card 3: Freelances e Projetos Extras */}
        <SectionCard
          title={isVigente ? "Freelances e projetos extras" : `Freelances e extras (${formatMonthLabel(effectiveMonth)})`}
          subtitle={
            isVigente
              ? "Projetos independentes e contratos de desenvolvimento"
              : `Projetos confirmados e receitas adicionais previstas para ${formatMonthLabel(effectiveMonth)}`
          }
        >
          <div className="flex flex-col divide-y divide-[var(--gridline)]">
            {freelanceList.map((item) => {
              const statusPill =
                item.status === "recebido" || item.status === "quitado"
                  ? { bg: "bg-[#0ca30c]/10 text-[#0ca30c]" }
                  : item.status === "pendente"
                  ? { bg: "bg-[#d03b3b]/10 text-[#d03b3b] dark:text-[#e66767]" }
                  : item.status === "parcial"
                  ? { bg: "bg-[#fab219]/10 text-[#c98500] dark:text-[#fab219]" }
                  : { bg: "bg-[#2a78d6]/10 text-[#2a78d6]" }; // previsto

              const hasSubitens = item.subitens && item.subitens.length > 0;
              const isOpen = openSubitens[item.id] ?? true;

              return (
                <div key={item.id} className="py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-ink font-medium">{item.cliente}</span>
                      <span className="text-ink-muted text-xs ml-2">{item.descricao}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-semibold text-ink">{formatBRL(item.valor)}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusPill.bg}`}>
                        {item.status}
                      </span>
                      {hasSubitens && (
                        <button
                          onClick={() => toggle(item.id)}
                          className="text-[11px] text-ink-muted hover:text-ink px-1"
                          aria-label={`Alternar subitens ${item.cliente}`}
                        >
                          {isOpen ? "▲" : "▼"}
                        </button>
                      )}
                    </div>
                  </div>
                  {hasSubitens && isOpen && (
                    <div className="ml-2 pl-3 border-l-2 border-[var(--border-hairline)] text-xs text-ink-muted flex flex-col gap-1 mt-0.5">
                      {item.subitens!.map((sub, sIdx) => (
                        <div key={sIdx} className="flex justify-between">
                          <span>{sub.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="tabular font-medium text-ink">{formatBRL(sub.valor)}</span>
                            <span className={`text-[10px] ${sub.tagColor || "text-ink-muted"}`}>{sub.tag}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Card 4: Detalhamento de Descontos e Folha */}
        <SectionCard
          title="Composição de folha e descontos"
          subtitle="Itemização dos contracheques mais recentes"
        >
          <div className="flex flex-col gap-4">
            {Object.entries(holerites).map(([pessoa, entries]) => {
              const ultimo = entries[entries.length - 1];
              if (!ultimo) return null;
              const nome = pessoas[pessoa]?.nome ?? pessoa;

              return (
                <div key={pessoa} className="flex flex-col gap-1.5 p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--card-surface)]/50">
                  <div className="flex items-center justify-between text-sm pb-1.5 border-b border-[var(--gridline)]">
                    <span className="font-semibold text-ink">{nome}</span>
                    <span className="text-xs text-ink-muted">
                      {formatMonthLabel(ultimo.competencia)} · {ultimo.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs py-1">
                    <div>
                      <span className="text-ink-muted block text-[10px]">BRUTO</span>
                      <span className="font-semibold text-ink tabular">{formatBRL(ultimo.bruto)}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-[10px]">DESCONTOS</span>
                      <span className="font-semibold text-[#d03b3b] tabular">
                        -{formatBRL(ultimo.total_descontos)}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-[10px]">LÍQUIDO</span>
                      <span className="font-semibold text-[#0ca30c] tabular">
                        {ultimo.liquido !== null ? formatBRL(ultimo.liquido) : "A confirmar"}
                      </span>
                    </div>
                  </div>

                  {ultimo.descontos.length > 0 && (
                    <div className="mt-1 pt-1.5 border-t border-[var(--gridline)]/50 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-ink-muted uppercase">
                        Principais descontos
                      </span>
                      {ultimo.descontos.slice(0, 4).map((d, dIdx) => (
                        <div key={dIdx} className="flex justify-between text-xs text-ink-muted">
                          <span>• {d.descricao}</span>
                          <span className="tabular font-medium text-ink-secondary">
                            -{formatBRL(d.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
