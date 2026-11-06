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

  /** Projeção analítica do mês (aplicável para meses vigentes e futuros) */
  totalCartoesMes: number;
  totalDespesasFixasPrevistas: number;
  totalSaidasPrevistas: number;
  entradasProjetadas: {
    total_esperado: number;
    itens: { item: string; valor: number; tipo: string }[];
  };
  resultadoPrevisto: number;
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
    if (d.data_inicio) {
      maxIdx = Math.max(maxIdx, toMonthIndex(d.data_inicio));
      minIdx = Math.min(minIdx, toMonthIndex(d.data_inicio));
    }
  }

  for (const c of data.despesas.compras_parceladas) {
    const startMes = c.mes_inicio || c.data_inicio;
    if (startMes && c.parcelas_totais) {
      const startIdx = toMonthIndex(startMes);
      minIdx = Math.min(minIdx, startIdx);
      maxIdx = Math.max(maxIdx, startIdx + c.parcelas_totais - 1);
    } else if (c.parcela_atual !== undefined && c.parcelas_totais !== undefined) {
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

  for (const cat of data.despesas.categorias) {
    for (const item of cat.itens) {
      if (item.data_inicio) {
        maxIdx = Math.max(maxIdx, toMonthIndex(item.data_inicio));
      }
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

    const startMes = c.mes_inicio || c.data_inicio;
    let parcelaProjetada: number;
    if (startMes) {
      const startIdx = toMonthIndex(startMes);
      if (idx < startIdx) {
        // Compra com início futuro que ainda não começou neste mês
        continue;
      }
      parcelaProjetada = idx - startIdx + 1;
    } else {
      parcelaProjetada = c.parcela_atual + offset;
    }

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
    despesasReal
      ? despesasReal.categorias.map((cat) => ({
          nome: cat.nome,
          itens: cat.itens.filter((item) => {
            if (item.data_inicio && toMonthIndex(item.data_inicio) > idx) return false;
            if (item.data_fim && toMonthIndex(item.data_fim) < idx) return false;
            return true;
          }),
        }))
      : data.despesas.categorias.map((cat) => ({
          nome: cat.nome,
          itens: cat.itens
            .filter((item) => {
              if (item.data_inicio && toMonthIndex(item.data_inicio) > idx) return false;
              if (item.data_fim && toMonthIndex(item.data_fim) < idx) return false;
              return true;
            })
            .map((item) => ({
              item: item.item,
              previsto: item.previsto,
              pago: 0,
              detalhes: item.detalhes,
              data_inicio: item.data_inicio,
              data_fim: item.data_fim,
            })),
        }));

  const totalDividasAtivas = dividasAtivas.reduce((s, d) => s + d.valor, 0);
  const totalComprasParceladas = comprasParceladas.reduce(
    (s, c) => s + (c.parcelas_totais > 0 ? c.total / c.parcelas_totais : c.pago_mes),
    0
  );
  const totalDespesasFixasPrevistas = despesasCategorias.reduce(
    (s, cat) => s + cat.itens.reduce((si, i) => si + i.previsto, 0),
    0
  );

  // Faturas ou cronograma estimado dos cartões no mês
  let totalCartoesMes = 0;
  for (const cartao of Object.values(data.cartoes_credito)) {
    const entry = getCardMonthEntry(cartao, mes);
    if (entry && entry.tipo !== "quitado") {
      totalCartoesMes += entry.valor;
    }
  }

  // Projeção inteligente de entradas para o mês
  let entradasProjetadas: MonthView["entradasProjetadas"];
  if (isVigente) {
    entradasProjetadas = {
      total_esperado: data.entradas.total_esperado,
      itens: [
        ...data.entradas.recebido.map((r) => ({ item: r.item, valor: r.valor, tipo: "recebido" })),
        ...data.entradas.pendente.map((p) => ({ item: p.item, valor: p.valor, tipo: "pendente" })),
      ],
    };
  } else if (historico?.entradas) {
    entradasProjetadas = {
      total_esperado: historico.entradas.total_esperado,
      itens: [
        ...historico.entradas.recebido.map((r) => ({ item: r.item, valor: r.valor, tipo: "recebido" })),
        ...historico.entradas.pendente.map((p) => ({ item: p.item, valor: p.valor, tipo: "pendente" })),
      ],
    };
  } else {
    // Projeção futura com base na renda fixa recorrente da família
    const rendaRafael = data.renda_fixa_mensal?.find((r) => r.pessoa.toUpperCase().includes("RAFAEL"));
    const rendaNatasha = data.renda_fixa_mensal?.find((r) => r.pessoa.toUpperCase().includes("NATASHA"));
    const itensFuturos = [
      { item: "Salário Natasha (Líquido)", valor: rendaNatasha?.liquido ?? 5244.31, tipo: "previsto" },
      { item: "VR Natasha", valor: data.beneficios_mensais.NATASHA?.VR ?? 722.1, tipo: "previsto" },
      { item: "Salário Rafael (Líquido)", valor: rendaRafael?.liquido ?? 2860.7, tipo: "previsto" },
      { item: "VR Rafael (Líquido)", valor: data.beneficios_mensais.RAFAEL?.VR ?? 646.1, tipo: "previsto" },
      { item: "VHO Rafael", valor: data.beneficios_mensais.RAFAEL?.VHO ?? 133, tipo: "previsto" },
    ];

    // Inclui contrato contínuo do Caminho Louvor
    itensFuturos.push({ item: "Freelance Caminho do Louvor", valor: 850.0, tipo: "previsto" });

    // Inclui freelances cadastrados com previsão para este mês específico a partir de freelances_historico
    for (const f of data.freelances_historico ?? []) {
      for (const rec of f.recebimentos ?? []) {
        if (rec.mes.startsWith(mes)) {
          // Evita duplicar se já foi adicionado
          const desc = `Freelance ${f.cliente}`;
          if (!itensFuturos.some((it) => it.item.toLowerCase().includes(f.cliente.toLowerCase()))) {
            itensFuturos.push({
              item: desc,
              valor: rec.valor,
              tipo: "previsto",
            });
          }
        }
      }
    }

    // Entradas extras sazonais confirmadas
    if (mes === "2026-11") {
      itensFuturos.push({ item: "13º Salário Natasha (20/nov)", valor: 3500.0, tipo: "previsto" });
      itensFuturos.push({ item: "13º Salário Rafael (30/nov)", valor: 3000.0, tipo: "previsto" });
    } else if (mes === "2026-12") {
      itensFuturos.push({ item: "Bônus de Férias (28/dez)", valor: 500.0, tipo: "previsto" });
    }

    const totalEsperado = itensFuturos.reduce((s, i) => s + i.valor, 0);
    entradasProjetadas = {
      total_esperado: Math.round(totalEsperado * 100) / 100,
      itens: itensFuturos,
    };
  }

  const totalSaidasPrevistas = Math.round(
    (totalDespesasFixasPrevistas + totalDividasAtivas + totalComprasParceladas + totalCartoesMes) * 100
  ) / 100;
  const resultadoPrevisto = Math.round((entradasProjetadas.total_esperado - totalSaidasPrevistas) * 100) / 100;

  // Patrimônio projetado acumulado (não desaparece nos meses futuros)
  const patrimonioProjetado = isVigente
    ? data.patrimonio
    : historico?.patrimonio ?? {
        total:
          Math.round(
            data.patrimonio.itens.reduce(
              (s, it) => s + (it.valor + (it.adicao_mensal || 0) * Math.max(0, offset)),
              0
            ) * 100
          ) / 100,
        itens: data.patrimonio.itens.map((it) => ({
          item: it.item,
          valor: Math.round((it.valor + (it.adicao_mensal || 0) * Math.max(0, offset)) * 100) / 100,
          adicao_mensal: it.adicao_mensal,
        })),
      };

  return {
    mes,
    isVigente,
    offset,
    entradas: isVigente ? data.entradas : historico?.entradas,
    despesas: despesasReal,
    despesasCategorias,
    despesasComPago,
    saldo_caixa: isVigente ? data.saldo_caixa : historico?.saldo_caixa,
    patrimonio: patrimonioProjetado,
    dividasAtivas,
    comprasParceladas,
    totalDividasAtivas,
    totalComprasParceladas,
    totalCartoesMes,
    totalDespesasFixasPrevistas,
    totalSaidasPrevistas,
    entradasProjetadas,
    resultadoPrevisto,
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
