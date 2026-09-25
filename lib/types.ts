export interface ValorItem {
  item: string;
  valor: number;
}

export interface DespesaItem {
  item: string;
  previsto: number;
  pago: number;
  /**
   * Added in schema v1.3. Lancamentos individuais do mes para itens que
   * funcionam como "guarda-chuva" (ex: Almocos e Extras) - cada gasto novo
   * vira uma entrada aqui em vez de só somar em `pago`. Optional so older
   * items keep validating.
   */
  detalhes?: { descricao: string; valor: number }[];
}

export interface DespesaCategoria {
  nome: string;
  itens: DespesaItem[];
}

export interface CompraParcelada {
  item: string;
  total: number;
  pago_mes: number;
  parcela: string;
  /** Added in schema v1.1 - optional so older data files keep validating. */
  parcela_atual?: number;
  /** Added in schema v1.1 - optional so older data files keep validating. */
  parcelas_totais?: number;
}

export interface DividaItem {
  credor: string;
  valor: number;
  /**
   * Added in schema v1.1. "YYYY-MM" of the last installment, or null when
   * there is no known payoff date (excluded from the forecast projection).
   * Optional so older data files keep validating.
   */
  data_final?: string | null;
  /**
   * Added in schema v1.6. "YYYY-MM" of the first month this debt applies -
   * for a debt that already exists but only starts being charged later.
   * Omitted/null means it already applies from mes_referencia onward.
   */
  data_inicio?: string | null;
}

export interface RendaFixaMensal {
  pessoa: string;
  liquido: number;
  beneficios: number;
  total: number;
}

export interface PatrimonioItem {
  item: string;
  valor: number;
  adicao_mensal: number;
}

export interface DescontoHolerite {
  descricao: string;
  valor: number;
}

export interface Holerite {
  competencia: string;
  status: string;
  bruto: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number | null;
  descontos: DescontoHolerite[];
}

/**
 * Added in schema v1.3. Um lancamento dentro de uma fatura de cartao
 * (uma compra/parcela especifica). Opcional - so preenchido quando o
 * detalhamento linha a linha da fatura estiver disponivel.
 */
export interface FaturaItemCartao {
  descricao: string;
  valor: number;
  /** Parcela atual desta compra nesta fatura, se for parcelada. */
  parcela_atual?: number;
  /** Total de parcelas desta compra, se for parcelada. */
  parcelas_totais?: number;
}

export interface FaturaCartao {
  mes: string;
  valor: number;
  /** Added in schema v1.3 - detalhamento linha a linha, quando disponivel. */
  itens?: FaturaItemCartao[];
  /**
   * Added in schema v1.4. false quando a soma de "itens" NAO cobre o valor
   * total da fatura (extracao parcial de imagens/extrato). Omitir quando nao
   * houver itens ou quando a soma bater com o total.
   */
  itens_completos?: boolean;
  /** Added in schema v1.4 - nota sobre a origem/qualidade do dado desta fatura. */
  observacao?: string;
  /** Added in schema v1.5 - se esta fatura ja foi paga (true so quando quitada por completo). Omitir quando nao souber. */
  pago?: boolean;
  /** Added in schema v1.5 - quanto ja foi pago desta fatura, quando for pagamento parcial (valor_pago < valor). */
  valor_pago?: number;
}

/**
 * Added in schema v1.4. Projecao de uma fatura futura AINDA NAO confirmada
 * (baseada em parcelas conhecidas ou estimativa) - nunca misturar com
 * `faturas`, que sao valores reais de fatura ja fechada.
 */
export interface CronogramaEstimadoItem {
  mes: string;
  valor_estimado: number;
  observacao?: string;
}

export interface Cartao {
  banco: string;
  status: string;
  faturas: FaturaCartao[];
  /** Added in schema v1.4 - meses futuros projetados, ainda nao confirmados. */
  cronograma_estimado?: CronogramaEstimadoItem[];
  /** Added in schema v1.4 - "YYYY-MM" em que a divida deste cartao termina, se conhecido. */
  quitacao_prevista?: string;
}

export interface FreelanceRecebimento {
  mes: string;
  valor: number;
  /**
   * Added in schema v1.7. "confirmado" (ja recebido), "estimado" (previsto,
   * sem confirmacao) ou "pendente" (esperado neste mes mas ainda nao chegou).
   * Omitido = tratado como confirmado (compatibilidade com dado antigo).
   */
  status?: "confirmado" | "estimado" | "pendente";
}

export interface Freelance {
  cliente: string;
  status: string;
  recebimentos: FreelanceRecebimento[];
}

export interface Pessoa {
  nome: string;
  funcao: string | null;
  empresa: string | null;
  admissao: string | null;
}

export interface MasterData {
  _metadata: {
    versao: string;
    fonte: string;
    ultima_atualizacao: string;
    mes_referencia: string;
    responsavel: string;
    regra_schema?: string;
  };
  pessoas: Record<string, Pessoa>;
  entradas: {
    recebido: ValorItem[];
    pendente: ValorItem[];
    total_recebido: number;
    total_pendente: number;
    total_esperado: number;
  };
  despesas: {
    categorias: DespesaCategoria[];
    compras_parceladas: CompraParcelada[];
    resumo: { previsto_total: number; pago_total: number };
  };
  dividas: {
    ativas: DividaItem[];
    atrasadas: DividaItem[];
    total_ativas: number;
    total_atrasadas: number;
  };
  patrimonio: { itens: PatrimonioItem[]; total: number };
  saldo_caixa: {
    recebido: number;
    pago: number;
    caixa_atual: number;
    ainda_precisa_pagar: number;
  };
  holerites: Record<string, Holerite[]>;
  beneficios_mensais: Record<string, Record<string, number>>;
  /** Added in schema v1.1 - optional so older data files keep validating. */
  renda_fixa_mensal?: RendaFixaMensal[];
  cartoes_credito: Record<string, Cartao>;
  freelances_historico: Freelance[];
  /**
   * Added in schema v1.3. Snapshots de meses diferentes do mes_referencia
   * (passado ou futuro), usados pelo seletor de mes. Cada chave e "YYYY-MM".
   * So preencha secoes que realmente tem dado real para aquele mes - o BI
   * simplesmente nao exibe o que estiver ausente, nunca inventa valor.
   * Dividas ativas e compras parceladas do mes vigente ja sao projetadas
   * automaticamente para outros meses (via data_final / parcela_atual) e
   * NAO precisam de entrada aqui.
   */
  historico_mensal?: Record<string, MonthlySnapshot>;
}

/** Added in schema v1.3 - ver MasterData.historico_mensal. */
export interface MonthlySnapshot {
  entradas?: MasterData["entradas"];
  despesas?: MasterData["despesas"];
  saldo_caixa?: MasterData["saldo_caixa"];
  patrimonio?: MasterData["patrimonio"];
}
