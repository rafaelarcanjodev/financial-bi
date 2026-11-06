# Regras e Diretrizes do Projeto financial-bi (Google Gemini & Antigravity)

Este projeto adota **Google Gemini & Antigravity** como padrão oficial de IA e desenvolvimento agêntico.

---

## 1. Regra Fixa do Schema de Dados (`data/master.json`)

Este projeto lê tudo de `data/master.json`, tipado em `lib/types.ts`. O contrato de campos existentes é **FIXO** e deve ser tratado como uma API estável:

- **É permitido** adicionar campos novos (em qualquer nível do JSON) para suportar uma feature nova. Ao adicionar um campo, avise explicitamente na resposta que o campo é novo e pode exigir ajuste em `lib/types.ts` e nos componentes.
- **NUNCA remova, renomeie, ou mude o tipo/formato** de um campo que já existe em `data/master.json` ou em `lib/types.ts` sem que o usuário peça explicitamente.
- Ao estender um tipo em `lib/types.ts`, marque o campo novo como opcional (`campo?: Tipo`) para retrocompatibilidade.
- No Google Drive (pasta `FINANCEIRO_DATABASE`), o "JSON MASTER" deve seguir o mesmo contrato.

### Schema v1.3 - Seletor de Mês
- `MasterData.historico_mensal?: Record<"YYYY-MM", MonthlySnapshot>` - snapshots reais de entradas/despesas/saldo_caixa/patrimônio. Só preencher com dado real confirmado.
- `FaturaCartao.itens?: FaturaItemCartao[]` - detalhamento linha a linha da fatura.
- Dívidas ativas e compras parceladas são projetadas automaticamente por `lib/months.ts` (`getMonthView`).
- Custos fixos recorrentes (moradia, educação, alimentação, transporte): aparecem previstos em todos os meses aplicáveis no seletor.

### Schema v1.4 - Previsibilidade de Cartões
- `Cartao.cronograma_estimado?: {mes, valor_estimado, observacao?}[]` - meses futuros projetados (não misturar com faturas confirmadas).
- `Cartao.quitacao_prevista?: "YYYY-MM"` - mês de término da dívida do cartão.
- `FaturaCartao.itens_completos?: boolean` e `FaturaCartao.observacao?: string` - usar para anotações e ressalvas sobre completude de extratos.

### Schema v1.5 - Despesas Fixas Temporais
- `DespesaItem.data_inicio?: string | null` - "YYYY-MM" do primeiro mês em que a despesa fixa passa a vigorar (ex: `"2027-01"` para a mensalidade escolar da Alice). Omitido = vigora desde o início.
- `DespesaItem.data_fim?: string | null` - "YYYY-MM" do último mês em que a despesa vigora. Omitido = recorrente sem término.

---

## 2. Pasta Fixa no Google Drive (Banco de Dados JSON)

Todo arquivo deste projeto lido ou criado no Google Drive deve ficar obrigatoriamente dentro desta pasta:

- **Caminho**: `FINANCEIRO_DATABASE` *(localmente acessível em `G:\Meu Drive\FINANCEIRO_DATABASE`)*
- **ID da pasta FINANCEIRO_DATABASE**: `1Q7vqkYaErwydot6vDC79UzV77ggFYR9_`
- **ID da pasta FINANCEIRO (pai)**: `1rrp1oGGHXdOlh2_EYnuhHVHxvEZg9Vn3`
- **Subpasta HISTÓRICO**: `1CpgmkVXcJ2u72JfHR9uwziIYJCoEELGy` (exclusivamente snapshots e backups de tabelas `.json` anteriores; nunca usar como fonte de dados vivos).

### Tabelas Oficiais do Banco de Dados (.json)
1. `master.json`: Visão consolidada consumida diretamente pelo painel Next.js (`financial-bi`).
2. `entradas_setembro_2026.json`: Renda familiar, salários, benefícios e freelances.
3. `saidas_setembro_2026.json`: Despesas categorizadas, moradia, alimentação, compras parceladas e gastos avulsos.
4. `dividas_ativas_setembro_2026.json`: Empréstimos consignados em folha, financiamento de carro e parcelamentos ativos.
5. `dividas_atrasadas_setembro_2026.json`: Dívidas vencidas, credores e valores parados para quitação futura.
6. `patrimonio_bloqueado_setembro_2026.json`: Ativos não líquidos (VGBL, previdência, FGTS, veículos).
7. `resumo_mensal_setembro_2026.json`: Indicadores de caixa disponível, status e próximos passos.
8. `cartoes_faturas_historico.json`: Faturas detalhadas por cartão (Click, Uniclass, Nubank) + cronograma estimado futuro.
9. `holerites_referencia.json`: Detalhamento confidencial de holerites, CPF, PIS e contas bancárias (não exposto no BI).
10. `regras_financeiras.json`: Fonte única das 19 regras financeiras e diretrizes do banco.
11. `estrutura_pasta.json`: Dicionário de dados da estrutura da pasta.
12. `janeiro_2027_entradas_saidas.json`, `prognostico_6meses_set2026_fev2027.json`, `demonstrativo_saidas_6meses_set2026_fev2027.json`: Projeções futuras.
13. `plano_financeiro_dashboard_ago2026.json`: Registro histórico de agosto/2026.

> [!IMPORTANT]
> **Regra do Drive (Banco 100% JSON)**: A pasta de dados contém **SOMENTE arquivos `.json`** (atuando como tabelas de um banco de dados relacional). Textos avulsos, Docs, Sheets ou Markdowns são expressamente proibidos na base viva e histórica. Qualquer dado ou relatório deve ser modelado como JSON.
> **Regra de Backup**: Sempre que `data/master.json` for alterado localmente, sincronize imediatamente o JSON correspondente no Google Drive no mesmo turno, sem esperar confirmação ("sempre atualize, isso é regra pra manter o backup firme").
> **Normalização de Sincronização**: Sufixos de conflito gerados pelo Google Drive (como ` (1)`) devem ser imediatamente renomeados para o nome canônico do arquivo `.json`.

---

## 3. As 19 Regras de Gestão Financeira da Família

1. **Detecção de duplicatas**: Desconfiar de valores repetidos (ex.: mesmo freelance 2x) - confirmar antes de somar.
2. **Histórico completo**: Guardar sempre holerites, contratos de freelance, faturas e dívidas com todos os detalhes.
3. **Integridade**: Nunca remover informação que ainda pode ser usada em planejamento futuro sem confirmação explícita.
4. **Varredura pré-deleção**: Listar consequências antes de qualquer alteração estrutural ou delete.
5. **Fechamento**: Todo planejamento deve fechar sem valores faltando (usar "Estimado ~R$ X" quando não souber).
6. **Preferências do Rafael**: Formatos pedidos viram regra permanente e retroativa.
7. **Salário**: Sempre Bruto -> Descontos itemizados -> Líquido.
8. **Cartões de crédito**: Tabela mês a mês com Real vs Estimado.
9. **Dívidas em 3 listas**: Ativas, Quitadas, Inativas/atrasadas.
10. **Receitas separadas por tipo**: Salários, Benefícios, Bônus, Freelances.
11. **Correções**: Atualizar retroativamente em todos os documentos impactados e avisar o que mudou.
12. **Prognósticos**: Sempre com Confirmado vs Estimado.
13. **Freelances**: Entrada real substitui a estimativa correspondente (não somar ambos).
14. **Reparcelamento de cartão**: Pertence à fatura do cartão, não é dívida separada.
15. **Saídas em 3 categorias**: Despesas Fixas, Dívidas Ativas, Dívidas Atrasadas (não misturar).
16. **VGBL**: Desconto/investimento (patrimônio bloqueado), não benefício de caixa.
17. **Patrimônio bloqueado**: VGBL, FGTS e bens financiados/quitados não entram no fluxo de caixa mensal.
18. **Previsão vs Realizado**: Gastos pagos decrementam do previsto da respectiva categoria com data de pagamento.
19. **Banco de Dados Fiel 100% JSON**: Toda a base financeira (entradas, saídas, dívidas, faturas, patrimônio, holerites, regras e metadados) deve residir exclusivamente em arquivos `.json` estruturados e tipados. Arquivos de texto (.txt, .md, .gdoc, .gsheet) são terminantemente proibidos na base de dados para evitar divergências e fragmentação de dados.
20. **Preservação de Categorias e Subitens de Alimentação**: Qualquer custo de alimentação variável (almoços fora, refeições, lanches, pequenos gastos de comida, padaria) deve obrigatoriamente entrar na categoria 'Alimentação e Higiene' sob o item 'Almoços e Extras'. Qualquer gasto de mercado, feira ou açougue deve entrar no item 'Supermercado'. A categoria do gasto deve ser estritamente preservada, e os lançamentos individuais devem ser registrados como subitens (`detalhes`) com descrição e valor dentro do respectivo item.

---

## 4. Telegram Bot & Agente Financeiro (`bot/bot.mjs`)

O bot opera com um **Agente Inteligente Google Gemini** (`GEMINI_API_KEY`) utilizando Function Calling (Tools):

- **Conversação 100% em Linguagem Natural**: O bot opera puramente em diálogo fluido e inteligente em português, sem a necessidade de comandos de barra (/resumo, /dividas, /help) ou regras rígidas de texto.
- **Suporte a Multi-Tool Calling Paralelo**: Agrega consultas simultâneas (ex.: despesas + cartões + dívidas) em uma única resposta contextualizada.
- **Ferramentas do Agente**:
  - `consultar_resumo_financeiro`: Extrai visão geral de caixa, despesas, dívidas e patrimônio.
  - `consultar_despesas`: Consulta despesas por categoria ou compras parceladas.
  - `consultar_dividas_e_cartoes`: Consulta cartões, dívidas ativas e atrasadas.
  - `consultar_entradas`: Consulta salários, freelances e recebimentos pendentes.
  - `lancar_despesa`: Registra pagamentos e compras nas categorias corretas (com subitens para supermercado e almoços/extras).
  - `lancar_receita`: Registra recebimento de valores nas entradas.
  - `pagar_fatura_cartao`: Aplica pagamento em fatura (`applyCardPayment`), sincronizando com `dividas.ativas`.
  - `propor_ajuste_estrutural`: Para alterações complexas de schema/valores, gerando JSON Patch com botões de confirmação `[ Confirmar ] [ Cancelar ]`.
- **Comprovantes**: Leitura automática de comprovantes e notas fiscais por imagem/OCR.
