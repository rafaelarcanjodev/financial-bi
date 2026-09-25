# PADRÃO DO PROJETO: Consulte GEMINI.md

> **Atenção**: O projeto foi padronizado para **Google Gemini & Antigravity**. Todas as regras de schema, diretrizes financeiras da família, configurações e documentação oficial estão centralizadas em `GEMINI.md`.

---

# Regra fixa do schema de dados (`data/master.json`)

Este projeto le tudo de `data/master.json`, tipado em `lib/types.ts`. O contrato
de campos existentes e **FIXO** e deve ser tratado como uma API estavel:

- **E permitido** adicionar campos novos (em qualquer nivel do JSON) para
  suportar uma feature nova. Ao adicionar um campo, avise explicitamente na
  resposta que o campo e novo e pode exigir ajuste em `lib/types.ts` e nos
  componentes que leem `data/master.json` - novos campos nao quebram sozinhos,
  mas o codigo que ainda nao os conhece tambem nao vai usa-los.
- **NUNCA remova, renomeie, ou mude o tipo/formato** de um campo que ja existe
  em `data/master.json` ou em `lib/types.ts` sem que o usuario peca
  explicitamente. Isso inclui: mudar `valor` de string para number, remover
  uma chave de `dividas.ativas[]`, renomear `pessoas.RAFAEL` para outra coisa,
  etc. Esses campos sao lidos por varios componentes (`components/sections/*`)
  e por `lib/forecast.ts` - remover ou renomear quebra o build silenciosamente
  em alguns casos e visualmente (dado sumindo do dashboard) em outros.
- Ao estender um tipo em `lib/types.ts`, prefira marcar o campo novo como
  opcional (`campo?: Tipo`) quando fizer sentido, para que dados antigos
  (sem o campo ainda) continuem validando.
- `data/master.json._metadata.regra_schema` documenta esta mesma regra dentro
  do proprio arquivo de dados, para quem for editar o JSON fora de uma sessao
  do Claude Code.
- Esta mesma regra tambem vale do lado do Google Drive: o "JSON MASTER" que
  alimenta este projeto (pasta RAFAEL ARCANJO > FINANCEIRO > CLAUDE) deve
  seguir o mesmo contrato - campos podem ser adicionados, mas os existentes
  nao devem ser removidos/renomeados sem avisar que isso pode quebrar este BI.

### Schema v1.3 - seletor de mes (2026-09-05)

- `MasterData.historico_mensal?: Record<"YYYY-MM", MonthlySnapshot>` - snapshots
  reais de entradas/despesas/saldo_caixa/patrimonio para meses diferentes do
  `mes_referencia`. So preencher secoes com dado real confirmado; o BI nunca
  inventa valor para o que estiver ausente (so nao exibe aquela secao).
- `FaturaCartao.itens?: FaturaItemCartao[]` - detalhamento linha a linha de uma
  fatura de cartao (descricao, valor, parcela_atual/parcelas_totais). Vazio/
  ausente ate o usuario fornecer os dados reais de cada fatura.
- Dividas ativas (`dividas.ativas[].data_final`) e compras parceladas
  (`despesas.compras_parceladas[].parcela_atual/parcelas_totais`) SAO
  projetadas automaticamente para outros meses por `lib/months.ts`
  (`getMonthView`) - nao precisam de entrada em `historico_mensal`. Uma divida
  some da projecao apos o mes de `data_final`; uma compra parcelada some
  quando a parcela projetada excede `parcelas_totais` (e e reconstruida pra
  tras/pra frente a partir de `parcela_atual`).

### Schema v1.4 - previsibilidade de cartoes (2026-09-05)

- `Cartao.cronograma_estimado?: {mes, valor_estimado, observacao?}[]` - meses
  futuros projetados mas AINDA NAO confirmados (nunca misturar com `faturas`,
  que sao valores reais de fatura ja fechada).
- `Cartao.quitacao_prevista?: "YYYY-MM"` - mes em que a divida do cartao
  termina, se conhecido (usado para marcar meses seguintes como "quitado").
- `FaturaCartao.itens_completos?: boolean` e `FaturaCartao.observacao?: string` -
  usar quando a soma de `itens` NAO cobre o total da fatura (extracao parcial
  de imagens/extrato) ou quando ha alguma ressalva sobre a qualidade do dado.
- `lib/months.ts` (`getCardMonthEntry`) resolve, para um cartao e mes: fatura
  confirmada > cronograma estimado > quitado (apos `quitacao_prevista`) >
  ausente (BI nao exibe). `CardsSection` usa isso para o seletor de mes
  mostrar passado (fatura real) e futuro (estimativa) dos cartoes, nao so o
  consolidado historico.
- Fonte dos dados atuais de cartoes: `cartoes_faturas_historico.json` na
  pasta CLAUDE do Drive, convertido de "CARTAO UNICLASS/CLICK - FATURA E
  CRONOGRAMA (AGOSTO 2026)" (18/08/2026).

### Correcao no seletor de mes - despesas fixas sempre visiveis (2026-09-05)

- Bug: `getMonthView` so preenchia `despesas` (categorias de custo fixo -
  moradia, educacao, alimentacao...) para o mes vigente ou quando havia
  `historico_mensal` registrado. Para qualquer outro mes do seletor, a secao
  "Gasto por categoria" (Visao geral) e as categorias em "Despesas" sumiam
  por completo - mesmo sendo dado fixo/recorrente que a familia ja tem
  cadastrado, nao algo que "nao existe registro".
- Correcao: `MonthView` ganhou `despesasCategorias` (sempre preenchido, com
  os valores `previsto` das categorias - contas recorrentes sem data de
  termino conhecida valem para qualquer mes) e `despesasComPago` (true so
  quando o mes tem dado real de pagamento - vigente ou historico). `pago` e
  as StatTiles "Ja pago"/"Restante a pagar" so aparecem quando
  `despesasComPago` e true; o previsto por categoria aparece sempre.
- Regra geral confirmada pelo Rafael: **so** ocultar o que realmente nao tem
  valor, ja terminou, ou nunca teve registro (ex.: cartao sem fatura nem
  cronograma para aquele mes). Dado fixo que a familia ja tem (custos fixos
  recorrentes, dividas ativas, parcelas) deve aparecer em todos os meses
  onde ele se aplica.

## Pasta fixa no Google Drive (leitura/escrita)

Todo arquivo deste projeto que precisar ser lido ou criado no Google Drive
(JSON master, relatorios "STATUS FINANCEIRO", etc.) **deve** ficar dentro da
pasta abaixo. **Nunca** criar/ler arquivos direto em "Meu Drive" (root) ou em
qualquer outra pasta.

- Caminho: `RAFAEL ARCANJO > FINANCEIRO > CLAUDE`
- ID da pasta CLAUDE: `1Q7vqkYaErwydot6vDC79UzV77ggFYR9_`
- ID da pasta FINANCEIRO (pai): `1rrp1oGGHXdOlh2_EYnuhHVHxvEZg9Vn3`

Ao criar um arquivo novo no Drive para este projeto, sempre passe
`parentId: "1Q7vqkYaErwydot6vDC79UzV77ggFYR9_"` (ou o caminho equivalente na
ferramenta usada). Ao buscar o JSON master ou relatorios, restrinja a busca a
essa pasta (`parentId = '1Q7vqkYaErwydot6vDC79UzV77ggFYR9_'`) em vez de buscar
pelo Drive inteiro, para nao pegar copias antigas criadas por engano em outro
lugar.

### Estrutura atual da pasta CLAUDE (reorganizada em 2026-09-04)

**Regra fixa (pedida explicitamente pelo Rafael em 2026-09-04): a raiz da
pasta CLAUDE contem SOMENTE arquivos `.json`** - como um banco de dados onde
cada JSON e uma "tabela". Nenhum Google Doc, `.md` ou Sheet solto na raiz.
Se precisar registrar algo nao coberto pelos JSONs existentes, criar uma
estrutura JSON nova que faca sentido (nunca voltar a criar Doc/texto solto na
raiz). Documentos de texto existem SOMENTE dentro da subpasta `HISTORICO`,
como base historica - nunca sao fonte de dado atual.

JSONs na raiz:
- 6 JSONs mensais (dados vivos): `entradas_setembro_2026.json`,
  `saidas_setembro_2026.json`, `dividas_ativas_setembro_2026.json`,
  `dividas_atrasadas_setembro_2026.json`, `patrimonio_bloqueado_setembro_2026.json`,
  `resumo_mensal_setembro_2026.json`.
- `regras_financeiras.json` - fonte unica das 18 regras de gestao financeira +
  contrato de schema + protocolo de organizacao de arquivos (mesmo conteudo
  replicado abaixo neste CLAUDE.md).
- `estrutura_pasta.json` - descricao da propria estrutura da pasta (substitui
  o antigo README_ESTRUTURA.md).
- `holerites_referencia.json` - detalhamento itemizado de holerites + dados
  pessoais/bancarios sensiveis (CPF, PIS, conta). **Nao replicar em
  `data/master.json` nem exibir no BI.**
- `janeiro_2027_entradas_saidas.json`, `prognostico_6meses_set2026_fev2027.json`,
  `demonstrativo_saidas_6meses_set2026_fev2027.json` - projecoes de meses
  futuros (out/2026 a fev/2027), ainda nao replicadas em `data/master.json`.
- `plano_financeiro_dashboard_ago2026.json` - registro historico de uma
  planilha inicial (ago/2026), sem dado relevante alem do status.

Subpasta `HISTORICO` (id `1CpgmkVXcJ2u72JfHR9uwziIYJCoEELGy`) - todos os
documentos de texto/Docs/Sheets superados ou ja convertidos para JSON. Nada
foi deletado, so arquivado. Ao procurar dado "atual", nunca usar arquivos de
dentro de `HISTORICO`.

**Regra**: so `.json` na raiz da pasta CLAUDE e fonte de dados. Ao criar
qualquer arquivo novo no Drive para este projeto, criar como `.json`
estruturado - nunca como Google Doc/texto solto na raiz.

### Regras financeiras da familia (fonte: `regras_financeiras.json` no Drive)

Estas regras orientam como os dados financeiros da familia devem ser
interpretados/categorizados quando este projeto (ou uma sessao de Claude Code)
mexe em `data/master.json` ou le os JSONs do Drive. Nao sao regras de codigo,
sao regras de dominio financeiro:

1. Deteccao de duplicatas: desconfiar de valores repetidos (ex.: mesmo
   freelance aparecendo 2x) - confirmar antes de somar.
2. Guardar sempre holerites, contratos de freelance, faturas de cartao e
   dividas com todos os detalhes (nunca deletar informacao sem pensar bem).
3. Integridade: nunca remover informacao que ainda pode ser usada em
   planejamento futuro sem confirmacao explicita do Rafael.
4. Varredura geral antes de qualquer delete/update: listar consequencias,
   confirmar, so entao alterar.
5. Fechamento: todo planejamento deve fechar sem valores faltando (usar
   "Estimado ~R$ X" quando nao souber, nunca omitir).
6. Formatos que o Rafael pedir viram regra permanente e retroativa.
7. Salario sempre como Bruto -> Descontos itemizados -> Liquido (nunca so o
   liquido sem contexto).
8. Cartoes de credito: tabela mes a mes com Real vs Estimado.
9. Dividas em 3 listas: Ativas, Quitadas, Inativas/atrasadas.
10. Receitas separadas por tipo: Salarios, Beneficios, Bonus, Freelances.
11. Correcao do Rafael = atualizar retroativamente em todos os documentos
    impactados e avisar o que mudou.
12. Prognosticos sempre com Confirmado vs Estimado (nunca so estimativa).
13. Freelance real exclui a estimativa correspondente (nunca contar os dois).
14. Reparcelamento de cartao fica dentro da fatura do cartao, nao e divida
    separada.
15. Saidas sempre em 3 categorias: Despesas Fixas, Dividas Ativas, Dividas
    Atrasadas - nunca misturar.
16. VGBL e desconto/investimento (patrimonio bloqueado), nao e beneficio de
    caixa.
17. Patrimonio bloqueado (VGBL, FGTS, bens financiados/quitados) nunca entra
    no fluxo de caixa mensal, so na visao de patrimonio.
18. Previsao (futuro/estimado) e Status Financeiro (o que ja aconteceu) nunca
    se misturam; todo gasto ja pago e categorizado no item especifico, com
    data, decrementado do previsto daquela categoria.

Se o Rafael estabelecer uma regra nova nesta area, adicionar tanto aqui quanto
em `regras_financeiras.json` no Drive (nao so em um dos dois lugares).
