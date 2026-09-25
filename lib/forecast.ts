import type { MasterData, DividaItem } from "./types";
import { getMonthView, addMonths } from "./months";

/** "YYYY-MM" -> linear month index (for arithmetic across year boundaries). */
function toMonthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

function fromMonthIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Total committed monthly fixed cost, from the STATUS financeiro (what was
 * planned/previsto for the month), never from what has already been paid.
 */
export function custosFixosMensais(data: MasterData): number {
  return data.despesas.categorias
    .flatMap((c) => c.itens)
    .reduce((sum, item) => sum + item.previsto, 0);
}

export interface CustoFixoCategoria {
  nome: string;
  itens: { item: string; previsto: number }[];
  subtotal: number;
}

/**
 * Custos fixos mensais agrupados por categoria (moradia, educacao, etc.),
 * apenas o "previsto" das despesas do dia a dia - nunca dividas, parcelamentos
 * ou emprestimos. Usado para mostrar o custo fixo puro de manter a casa.
 */
export function custosFixosPorCategoria(data: MasterData): CustoFixoCategoria[] {
  return data.despesas.categorias
    .map((cat) => ({
      nome: cat.nome,
      // Itens com previsto 0 sao gasto extra/variavel, sem expectativa fixa -
      // nao entram na lista de custo fixo (mas continuam contando no "pago" real).
      itens: cat.itens.filter((item) => item.previsto > 0).map((item) => ({ item: item.item, previsto: item.previsto })),
      subtotal: cat.itens.reduce((sum, item) => sum + item.previsto, 0),
    }))
    .filter((cat) => cat.itens.length > 0);
}

/** Dividas ativas that already apply in mes_referencia (excludes ones with a future data_inicio). */
function dividasAtivasNoMes(data: MasterData): DividaItem[] {
  const refIdx = toMonthIndex(data._metadata.mes_referencia);
  return data.dividas.ativas.filter((d) => !d.data_inicio || toMonthIndex(d.data_inicio) <= refIdx);
}

/** All active debt installments due every month (dividas.ativas), regardless of prazo. */
export function dividasAtivasMensal(data: MasterData): number {
  return dividasAtivasNoMes(data).reduce((sum, d) => sum + d.valor, 0);
}

export function dividasComPrazo(data: MasterData): (DividaItem & { data_final: string })[] {
  return dividasAtivasNoMes(data).filter((d): d is DividaItem & { data_final: string } => !!d.data_final);
}

export function dividasSemPrazo(data: MasterData): DividaItem[] {
  return dividasAtivasNoMes(data).filter((d) => !d.data_final);
}

/** Installment purchases that still have unpaid installments this month or later. */
export function comprasParceladasAtivas(data: MasterData) {
  return data.despesas.compras_parceladas.filter((c) => {
    if (c.parcela_atual === undefined || c.parcelas_totais === undefined) return false;
    return c.parcela_atual <= c.parcelas_totais;
  });
}

export function comprasParceladasMensal(data: MasterData): number {
  return comprasParceladasAtivas(data).reduce((sum, c) => sum + c.total / c.parcelas_totais!, 0);
}

export function rendaFixaTotal(data: MasterData): number {
  if (data.renda_fixa_mensal && data.renda_fixa_mensal.length > 0) {
    return data.renda_fixa_mensal.reduce((sum, r) => sum + r.total, 0);
  }
  return Object.values(data.beneficios_mensais).reduce((sum, b) => sum + b.total, 0);
}

/**
 * Structural monthly balance: fixed income minus every recurring committed
 * cost (fixed expenses, all active debt installments, active installment
 * purchases) - independent of what has or hasn't been paid this month.
 */
export function saldoFixoMensal(data: MasterData): number {
  return (
    rendaFixaTotal(data) -
    custosFixosMensais(data) -
    dividasAtivasMensal(data) -
    comprasParceladasMensal(data)
  );
}

export interface SaldoMensalPonto {
  mes: string;
  label: string;
  renda: number;
  compromissos: number;
  saldo: number;
  [key: string]: string | number;
}

/**
 * Renda fixa (constante) vs custos fixos + dividas ativas + parceladas
 * (mes a mes, usando a projecao de cada mes via getMonthView) e o saldo
 * resultante. Estrutural: nao inclui entradas variaveis (freelances, bonus)
 * nem despesas pontuais - so o que ja e comprometido/recorrente.
 */
export function saldoFixoMensalPorMes(data: MasterData, meses: number): SaldoMensalPonto[] {
  const renda = rendaFixaTotal(data);
  const pontos: SaldoMensalPonto[] = [];
  let mes = data._metadata.mes_referencia;
  for (let i = 0; i < meses; i++) {
    const view = getMonthView(data, mes);
    const custos = view.despesasCategorias.reduce(
      (s, cat) => s + cat.itens.reduce((s2, item) => s2 + item.previsto, 0),
      0
    );
    const compromissos = custos + view.totalDividasAtivas + view.totalComprasParceladas;
    pontos.push({ mes, label: mes, renda, compromissos, saldo: renda - compromissos });
    mes = addMonths(mes, 1);
  }
  return pontos;
}

export interface EvolucaoDividaPonto {
  mes: string;
  label: string;
  total: number;
  [credor: string]: string | number;
}

/**
 * Projects the declining balance of every debt with a known payoff date
 * (data_final), month by month, from the reference month until the last
 * one is paid off. Straight-line estimate: parcela_mensal x remaining
 * installments - not a bank amortization schedule.
 */
export function evolucaoDivida(data: MasterData): EvolucaoDividaPonto[] {
  const dividas = dividasComPrazo(data);
  if (dividas.length === 0) return [];

  const refIdx = toMonthIndex(data._metadata.mes_referencia);
  const dataFinalIdx = dividas.map((d) => toMonthIndex(d.data_final));
  const endIdx = Math.max(...dataFinalIdx) + 1;

  const points: EvolucaoDividaPonto[] = [];
  for (let idx = refIdx; idx <= endIdx; idx++) {
    const mes = fromMonthIndex(idx);
    const point: EvolucaoDividaPonto = { mes, label: mes, total: 0 };
    for (const d of dividas) {
      const dIdx = toMonthIndex(d.data_final);
      const remaining = Math.max(0, dIdx - idx + 1) * d.valor;
      point[d.credor] = Math.round(remaining * 100) / 100;
      point.total += remaining;
    }
    point.total = Math.round(point.total * 100) / 100;
    points.push(point);
  }
  return points;
}
