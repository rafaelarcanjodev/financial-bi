import type { MasterData, DividaItem, CompraParcelada, Cartao, FaturaItemCartao, DespesaCategoria } from "./types";

/** "YYYY-MM" -> linear month index (for arithmetic across year boundaries). */
export function toMonthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function fromMonthIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function addMonths(mes: string, delta: number): string {
  return fromMonthIndex(toMonthIndex(mes) + delta);
}

export interface CompraParceladaProjetada extends CompraParcelada {
  parcela_atual: number;
  parcelas_totais: number;
}

export interface MonthView {
  mes: string;
  isVigente: boolean;
  /** Meses de diferenca em relacao ao mes_referencia (negativo = passado, positivo = futuro). */
  offset: number;
  /** So preenchido para o mes vigente ou quando ha historico_mensal registrado. */
  entradas?: MasterData["entradas"];
  /** So preenchido para o mes vigente ou quando ha historico_mensal registrado. */
  despesas?: MasterData["despesas"];
  /**
   * Categorias de despesa fixa recorrente (moradia, educacao, alimentacao...),
   * sempre presentes independente do mes - sao contas do dia a dia sem data de
   * termino conhecida, entao valem como "previsto" em qualquer mes. So o valor
   * `pago` de cada item e real quando `despesasComPago` for true (mes vigente
   * ou com historico_mensal registrado); nos demais meses vem zerado (ainda
   * nao aconteceu / nao e conhecido).
   */
  despesasCategorias: DespesaCategoria[];
  despesasComPago: boolean;
  saldo_caixa?: MasterData["saldo_caixa"];
  patrimonio?: MasterData["patrimonio"];
  /** Dividas ativas projetadas: some da lista apos o mes de data_final. */
  dividasAtivas: DividaItem[];
  /** Compras parceladas projetadas (passado e futuro), a partir de parcela_atual/parcelas_totais. */
  comprasParceladas: CompraParceladaProjetada[];
  totalDividasAtivas: number;
  totalComprasParceladas: number;
}

/**
 * Meses navegaveis pelo seletor: do mes mais antigo com parcela conhecida
 * (compra parcelada ou historico registrado) ate o mes em que a ultima
 * divida/parcelamento conhecido termina.
 */
export function mesesDisponiveis(data: MasterData): string[] {
  const refIdx = toMonthIndex(data._metadata.mes_referencia);
  let minIdx = refIdx;
  let maxIdx = refIdx;

  for (const mes of Object.keys(data.historico_mensal ?? {})) {
    const idx = toMonthIndex(mes);
    minIdx = Math.min(minIdx, idx);
    maxIdx = Math.max(maxIdx, idx);
  }

  for (const d of data.dividas.ativas) {
    if (d.data_final) maxIdx = Math.max(maxIdx, toMonthIndex(d.data_final));
    if (d.data_inicio) maxIdx = Math.max(maxIdx, toMonthIndex(d.data_inicio));
  }

  for (const c of data.despesas.compras_parceladas) {
    if (c.parcela_atual !== undefined && c.parcelas_totais !== undefined) {
      const restantes = c.parcelas_totais - c.parcela_atual;
      maxIdx = Math.max(maxIdx, refIdx + restantes);
      minIdx = Math.min(minIdx, refIdx - (c.parcela_atual - 1));
    }
  }

  for (const cartao of Object.values(data.cartoes_credito)) {
    for (const f of cartao.faturas) {
      const idx = toMonthIndex(f.mes);
      minIdx = Math.min(minIdx, idx);
      maxIdx = Math.max(maxIdx, idx);
    }
    for (const c of cartao.cronograma_estimado ?? []) {
      maxIdx = Math.max(maxIdx, toMonthIndex(c.mes));
    }
  }

  const meses: string[] = [];
  for (let idx = minIdx; idx <= maxIdx; idx++) meses.push(fromMonthIndex(idx));
  return meses;
}

export function getMonthView(data: MasterData, mes: string): MonthView {
  const refIdx = toMonthIndex(data._metadata.mes_referencia);
  const idx = toMonthIndex(mes);
  const offset = idx - refIdx;
  const isVigente = offset === 0;
  const historico = data.historico_mensal?.[mes];

  const dividasAtivas = data.dividas.ativas.filter((d) => {
    if (d.data_inicio && toMonthIndex(d.data_inicio) > idx) return false;
    if (!d.data_final) return true;
    return toMonthIndex(d.data_final) >= idx;
  });

  const comprasParceladas: CompraParceladaProjetada[] = [];
  for (const c of data.despesas.compras_parceladas) {
    if (c.parcela_atual === undefined || c.parcelas_totais === undefined) {
      if (isVigente) {
        comprasParceladas.push({ ...c, parcela_atual: 1, parcelas_totais: 1 });
      }
      continue;
    }
    const parcelaProjetada = c.parcela_atual + offset;
    if (parcelaProjetada >= 1 && parcelaProjetada <= c.parcelas_totais) {
      comprasParceladas.push({
        ...c,
        parcela_atual: parcelaProjetada,
        parcelas_totais: c.parcelas_totais,
        parcela: `${parcelaProjetada}/${c.parcelas_totais}`,
      });
    }
  }

  const despesasReal = isVigente ? data.despesas : historico?.despesas;
  const despesasComPago = !!despesasReal;
  const despesasCategorias: DespesaCategoria[] =
    despesasReal?.categorias ??
    data.despesas.categorias.map((cat) => ({
      nome: cat.nome,
      itens: cat.itens.map((item) => ({ item: item.item, previsto: item.previsto, pago: 0 })),
    }));

  return {
    mes,
    isVigente,
    offset,
    entradas: isVigente ? data.entradas : historico?.entradas,
    despesas: despesasReal,
    despesasCategorias,
    despesasComPago,
    saldo_caixa: isVigente ? data.saldo_caixa : historico?.saldo_caixa,
    patrimonio: isVigente ? data.patrimonio : historico?.patrimonio,
    dividasAtivas,
    comprasParceladas,
    totalDividasAtivas: dividasAtivas.reduce((s, d) => s + d.valor, 0),
    totalComprasParceladas: comprasParceladas.reduce((s, c) => s + c.total / c.parcelas_totais, 0),
  };
}

export interface CardMonthEntry {
  mes: string;
  valor: number;
  tipo: "confirmado" | "estimado" | "quitado";
  itens?: FaturaItemCartao[];
  itensCompletos?: boolean;
  observacao?: string;
  pago?: boolean;
  valorPago?: number;
}

/**
 * Resolve o valor/fatura de um cartao para um mes especifico: fatura real
 * confirmada > cronograma estimado > quitado (se ja passou de
 * quitacao_prevista) > undefined (sem dado - nao exibir).
 */
export function getCardMonthEntry(cartao: Cartao, mes: string): CardMonthEntry | undefined {
  const confirmada = cartao.faturas.find((f) => f.mes === mes);
  if (confirmada) {
    return {
      mes,
      valor: confirmada.valor,
      tipo: "confirmado",
      itens: confirmada.itens,
      itensCompletos: confirmada.itens_completos,
      observacao: confirmada.observacao,
      pago: confirmada.pago,
      valorPago: confirmada.valor_pago,
    };
  }

  const estimado = cartao.cronograma_estimado?.find((c) => c.mes === mes);
  if (estimado) {
    return { mes, valor: estimado.valor_estimado, tipo: "estimado", observacao: estimado.observacao };
  }

  if (cartao.quitacao_prevista && toMonthIndex(mes) >= toMonthIndex(cartao.quitacao_prevista)) {
    return { mes, valor: 0, tipo: "quitado" };
  }

  return undefined;
}
