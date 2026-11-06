# Financeiro Familia Arcanjo — BI local

> 🌐 **URL de Acesso ao Painel**: [http://localhost:3000](http://localhost:3000)  
> 🐳 **Container Docker**: `financial-bi` (Porta `3000:3000`)

Painel de BI local (roda no navegador) para visualizar os dados financeiros da
familia, a partir do JSON master integrado com Google Gemini & Antigravity.

Stack: **Next.js 16 + TypeScript + Tailwind v4 + Recharts**, com paleta de
cores validada para acessibilidade (daltonismo) e suporte a tema claro/escuro.

## Estrutura

```
financial-bi/
  app/              rotas Next.js (App Router)
  components/       componentes de UI e graficos
  lib/              tipos, formatacao (BRL) e paleta de cores
  data/master.json  <- fonte de dados local (edite este arquivo para atualizar)
  Dockerfile
  docker-compose.yml
```

## Acesso Rápido

- **Painel Web**: [http://localhost:3000](http://localhost:3000)
- **Status do Container**: `docker ps --filter "name=financial-bi"`

## Rodando localmente (sem Docker)

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Rodando com Docker

Para iniciar o container do BI em segundo plano:

```bash
docker compose up -d financial-bi
```

Ou para subir o ambiente completo (BI + Bot Telegram):

```bash
docker compose up -d --build
```

- **Acesso**: [http://localhost:3000](http://localhost:3000)
- O `docker-compose.yml` monta a pasta `./data` como volume (`:ro`): depois de editar `data/master.json`, as alterações são lidas automaticamente ou você pode rodar `docker compose restart financial-bi` (não precisa rebuildar a imagem).

## Atualizando os dados

O painel le tudo de **`data/master.json`**. Para atualizar:

1. Abra o documento "BASE DE CONHECIMENTO - JSON MASTER" (ou o relatorio
   "STATUS FINANCEIRO" mais recente) no Google Drive do projeto Financial
   Control.
2. Atualize os valores correspondentes em `data/master.json`, seguindo a
   mesma estrutura (`entradas`, `despesas`, `dividas`, `patrimonio`,
   `holerites`, `cartoes_credito`, `freelances_historico`, `renda_fixa_mensal`).
3. Salve o arquivo e recarregue o navegador (`npm run dev`) ou rode
   `docker compose restart` (Docker). Se voce tambem mudou codigo (nao so o
   JSON), rode `docker compose up --build` para reconstruir a imagem.

> Nao ha integracao automatica com o Google Drive nesta versao — a
> atualizacao e manual ou via bot, sincronizando os valores do JSON master no
> Google Drive. Dados sensiveis (CPF, PIS, numero de
> conta, etc.) foram deliberadamente deixados de fora do `master.json`,
> pois nao sao necessarios para o BI.

### Regra do schema (importante)

`data/master.json` e `lib/types.ts` formam um contrato fixo — ver
`GEMINI.md` para o detalhe completo. Resumindo: **e permitido adicionar campos
novos**, mas **nunca remover, renomear ou mudar o tipo de um campo existente**
sem querer quebrar o BI de propósito. `_metadata.regra_schema` no proprio JSON
repete esse aviso.

## Bot do Telegram (Agente Inteligente)

Alem do painel web, ha um bot do Telegram (`bot/`) equipado com um **Agente Inteligente Google Gemini** que le o mesmo `data/master.json`, responde conversas livres em linguagem natural, executa ferramentas (Function Calling) e envia alertas automaticos (caixa negativo, orcamento estourado, dividas atrasadas aumentando).

1. Crie um bot com o [@BotFather](https://t.me/BotFather) (`/newbot`) e copie
   o token gerado.
2. Copie `.env.example` para `.env` e configure:
   - `TELEGRAM_BOT_TOKEN`: seu token do bot.
   - `GEMINI_API_KEY`: sua API key do Google Gemini (obtida em aistudio.google.com).
   - `GEMINI_MODEL`: opcional, padrão `gemini-2.5-flash`.
3. Suba os containers: `docker compose up --build -d` (isso ja inclui o
   servico `telegram-bot`).
4. Abra o bot no Telegram e mande `/start` para virar o dono do bot (recebe
   resumos e alertas). O dono pode autorizar outros chats (ex: um grupo da
   familia) mandando `/start` la dentro tambem.
5. **Conversação com o Agente**: Você pode perguntar livremente em linguagem natural:
   - *"Quanto sobrou no orçamento de alimentação?"*
   - *"Paguei 50 no mercado hoje"*
   - *"Qual fatura vence primeiro e qual o valor?"*
   - *"Se eu comprar algo de 300 reais hoje, como fica o caixa?"*
6. **Comandos rápidos**: `/resumo`, `/dividas`, `/despesas`, `/patrimonio`, `/detalhado`, `/help`.
7. **Fotos e Recibos**: Envie foto de recibo/cupom fiscal para leitura automática via OCR.

## Secoes do painel

- **Visao geral** — KPIs do mes, recebido vs. pendente, dividas vs. patrimonio.
- **Previsibilidade** — custos fixos recorrentes (o que foi assumido/planejado,
  nao o que ja foi pago neste mes), saldo fixo mensal projetado e a evolucao
  das dividas com data final conhecida (estimativa linear ate a ultima
  parcela). Dividas atrasadas sem parcela mensal e dividas ativas sem prazo
  definido ficam fora da projecao de "queda a zero", mas as com prazo
  entram no grafico e as sem prazo aparecem numa lista separada.
- **Despesas** — categorias com previsto/pago (medidores) e compras parceladas.
- **Dividas e patrimonio** — dividas ativas/atrasadas por credor e composicao
  do patrimonio bloqueado.
- **Holerites** — bruto vs. liquido por competencia e descontos detalhados.
- **Cartoes e freelances** — faturas por cartao/mes e historico de freelances.
