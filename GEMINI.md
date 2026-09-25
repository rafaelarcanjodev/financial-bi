# Regras e Diretrizes do Projeto financial-bi (Google Gemini & Antigravity)

Este projeto adota **Google Gemini & Antigravity** como padrão oficial de IA e desenvolvimento agêntico.

---

## 1. Regra Fixa do Schema de Dados (`data/master.json`)

Este projeto lê tudo de `data/master.json`, tipado em `lib/types.ts`. O contrato de campos existentes é **FIXO** e deve ser tratado como uma API estável:

- **É permitido** adicionar campos novos (em qualquer nível do JSON) para suportar uma feature nova. Ao adicionar um campo, avise explicitamente na resposta que o campo é novo e pode exigir ajuste em `lib/types.ts` e nos componentes.
- **NUNCA remova, renomeie, ou mude o tipo/formato** de um campo que já existe em `data/master.json` ou em `lib/types.ts` sem que o usuário peça explicitamente.
- Ao estender um tipo em `lib/types.ts`, marque o campo novo como opcional (`campo?: Tipo`) para retrocompatibilidade.
- No Google Drive (pasta `RAFAEL ARCANJO > FINANCEIRO > CLAUDE`), o "JSON MASTER" deve seguir o mesmo contrato.

### Schema v1.3 - Seletor de Mês
- `MasterData.historico_mensal?: Record<"YYYY-MM", MonthlySnapshot>` - snapshots reais de entradas/despesas/saldo_caixa/patrimônio. Só preencher com dado real confirmado.
- `FaturaCartao.itens?: FaturaItemCartao[]` - detalhamento linha a linha da fatura.
- Dívidas ativas e compras parceladas são projetadas automaticamente por `lib/months.ts` (`getMonthView`).

### Schema v1.4 - Previsibilidade de Cartões
- `Cartao.cronograma_estimado?: {mes, valor_estimado, observacao?}[]` - meses futuros projetados (não misturar com faturas confirmadas).
- `Cartao.quitacao_prevista?: "YYYY-MM"` - mês de término da dívida do cartão.
- Regra de visibilidade: custos fixos recorrentes, dívidas ativas e parcelas aparecem em todos os meses aplicáveis.

---

## 2. Pasta Fixa no Google Drive (Leitura & Escrita)

Todo arquivo deste projeto lido ou criado no Google Drive deve ficar obrigatoriamente dentro desta pasta:

- **Caminho**: `RAFAEL ARCANJO > FINANCEIRO > CLAUDE` *(nome histórico da pasta de banco de dados no Drive)*
- **ID da pasta CLAUDE**: `1Q7vqkYaErwydot6vDC79UzV77ggFYR9_`
- **ID da pasta FINANCEIRO (pai)**: `1rrp1oGGHXdOlh2_EYnuhHVHxvEZg9Vn3`
- **Subpasta HISTÓRICO**: `1CpgmkVXcJ2u72JfHR9uwziIYJCoEELGy` (somente arquivos arquivados/antigos; nunca usar como fonte de dados vivos).

> [!IMPORTANT]
> **Regra do Drive**: A raiz da pasta contém **SOMENTE arquivos `.json`** (atuando como tabelas de banco de dados). Nunca crie Docs, Sheets ou arquivos de texto na raiz do Drive. Qualquer novo relatório deve ser modelado como JSON.
> **Regra de Backup**: Sempre que `data/master.json` for alterado localmente, sincronize imediatamente o JSON correspondente no Google Drive no mesmo turno, sem esperar confirmação ("sempre atualize, isso é regra pra manter o backup firme").

---

## 3. As 18 Regras de Gestão Financeira da Família

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

---

## 4. Telegram Bot & Agente Financeiro (`bot/bot.mjs`)

O bot opera com um **Agente Inteligente Google Gemini** (`GEMINI_API_KEY`) utilizando Function Calling (Tools):

- **Conversação Natural**: Responde perguntas livres de saldo, caixa, dívidas e faturas.
- **Ferramentas do Agente**:
  - `consultar_resumo_financeiro`: Extrai visão geral de caixa, despesas, dívidas e patrimônio.
  - `consultar_detalhes`: Consulta detalhada de categorias, cartões, compras parceladas e receitas.
  - `lancar_despesa`: Registra pagamentos e compras nas categorias corretas.
  - `lancar_receita`: Registra recebimento de valores nas entradas.
  - `pagar_fatura_cartao`: Aplica pagamento em fatura (`applyCardPayment`), sincronizando com `dividas.ativas`.
  - `propor_ajuste_estrutural`: Para alterações complexas de schema/valores (substituindo `/corrigir`), gerando JSON Patch com botões de confirmação `[ Confirmar ] [ Cancelar ]`.
- **Dívidas fixas**: Empréstimos fixos são informativos e orientam para ajuste estrutural.
- **Fallback**: Se `GEMINI_API_KEY` não for configurada, o bot opera via regex tradicional e comandos barra.
