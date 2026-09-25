import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT_DIR, "data", "master.json");
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, "state");
const STATE_PATH = path.join(STATE_DIR, "bot-state.json");
const OCR_CACHE_DIR = process.env.OCR_CACHE_DIR || path.join(STATE_DIR, "ocr-cache");
const ALERT_INTERVAL_MS = Number(process.env.ALERT_INTERVAL_MS || 30 * 60 * 1000);
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN nao definido. Configure no .env e reinicie.");
  process.exit(1);
}

let ocrWorker = null;
async function getOcrWorker() {
  if (!ocrWorker) {
    await mkdir(OCR_CACHE_DIR, { recursive: true });
    console.log("Inicializando OCR (Tesseract, idioma pt)...");
    ocrWorker = await createWorker("por", 1, { cachePath: OCR_CACHE_DIR });
    console.log("OCR pronto.");
  }
  return ocrWorker;
}

let geminiClient = null;
function getGeminiClient() {
  if (!GEMINI_API_KEY) return null;
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return geminiClient;
}

let anthropicClient = null;
function getAnthropicClient() {
  if (!ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return anthropicClient;
}

function defaultState() {
  return {
    ownerUserId: null,
    authorizedChats: [],
    lastUpdateId: 0,
    caixaNegativo: false,
    itensEstourados: [],
    atrasadasTotal: 0,
    pending: {},
  };
}

async function loadState() {
  let state;
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    state = JSON.parse(raw);
  } catch {
    state = defaultState();
  }

  // Migracao: versao antiga tinha so "ownerChatId" (chat privado = mesmo id
  // do usuario no Telegram). Vira o novo dono + primeiro chat autorizado.
  if (state.ownerChatId && !state.ownerUserId) {
    state.ownerUserId = state.ownerChatId;
    state.authorizedChats = [state.ownerChatId];
    delete state.ownerChatId;
  }
  if (!Array.isArray(state.authorizedChats)) state.authorizedChats = [];
  if (typeof state.ownerUserId === "undefined") state.ownerUserId = null;

  return state;
}

async function saveState(state) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

async function loadData() {
  const raw = await readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeData(data) {
  const tmp = `${DATA_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, DATA_PATH);
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function brl(n) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function sendMessage(chatId, text, buttons) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.warn("Falha no envio com HTML, tentando como texto puro:", json.description);
      delete body.parse_mode;
      await fetch(`${API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  } catch (err) {
    console.error("Falha ao enviar mensagem", err);
  }
}

async function answerCallback(id, text) {
  try {
    await fetch(`${API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: id, text }),
    });
  } catch (err) {
    console.error("Falha ao responder callback", err);
  }
}

// ---------- Relatorios ----------

function formatResumo(data) {
  const { entradas, despesas, dividas, patrimonio, saldo_caixa, _metadata } = data;
  const pctDespesas =
    despesas.resumo.previsto_total > 0
      ? ((despesas.resumo.pago_total / despesas.resumo.previsto_total) * 100).toFixed(1)
      : "0.0";
  return [
    "<b>Financeiro Familia Arcanjo</b>",
    `Referencia: ${_metadata.mes_referencia} (atualizado ${_metadata.ultima_atualizacao})`,
    "",
    "<b>Caixa</b>",
    `Recebido: ${brl(saldo_caixa.recebido)}`,
    `Pago: ${brl(saldo_caixa.pago)}`,
    `Caixa atual: ${brl(saldo_caixa.caixa_atual)}`,
    `Ainda precisa pagar: ${brl(saldo_caixa.ainda_precisa_pagar)}`,
    "",
    "<b>Despesas do mes</b>",
    `Previsto: ${brl(despesas.resumo.previsto_total)}`,
    `Pago: ${brl(despesas.resumo.pago_total)} (${pctDespesas}%)`,
    "",
    "<b>Dividas</b>",
    `Ativas: ${brl(dividas.total_ativas)}`,
    `Atrasadas: ${brl(dividas.total_atrasadas)}`,
    `Total: ${brl(dividas.total_ativas + dividas.total_atrasadas)}`,
    "",
    `<b>Patrimonio bloqueado</b>: ${brl(patrimonio.total)}`,
    "",
    "<b>Entradas</b>",
    `Recebido: ${brl(entradas.total_recebido)}`,
    `Pendente: ${brl(entradas.total_pendente)}`,
  ].join("\n");
}

function formatDividas(data) {
  const { dividas } = data;
  const lines = [`<b>Dividas Ativas</b> (${brl(dividas.total_ativas)})`];
  for (const d of dividas.ativas) {
    lines.push(`- ${d.credor}: ${brl(d.valor)}${d.data_final ? ` (ate ${d.data_final})` : ""}`);
  }
  lines.push("", `<b>Dividas Atrasadas</b> (${brl(dividas.total_atrasadas)})`);
  for (const d of dividas.atrasadas) {
    lines.push(`- ${d.credor}: ${brl(d.valor)}`);
  }
  return lines.join("\n");
}

function formatDespesas(data) {
  const lines = ["<b>Despesas por categoria</b>"];
  for (const cat of data.despesas.categorias) {
    const previsto = cat.itens.reduce((s, i) => s + i.previsto, 0);
    const pago = cat.itens.reduce((s, i) => s + i.pago, 0);
    const pct = previsto > 0 ? ((pago / previsto) * 100).toFixed(0) : "0";
    lines.push("", `<b>${cat.nome}</b> - ${pct}% (${brl(pago)} / ${brl(previsto)})`);
    for (const item of cat.itens) {
      const flag = item.pago > item.previsto ? " ⚠️ ESTOUROU" : "";
      lines.push(`  ${item.item}: ${brl(item.pago)} / ${brl(item.previsto)}${flag}`);
    }
  }
  if (data.despesas.compras_parceladas.length > 0) {
    lines.push("", "<b>Compras parceladas</b>");
    for (const cp of data.despesas.compras_parceladas) {
      lines.push(`  ${cp.item}: ${brl(cp.pago_mes)} (parcela ${cp.parcela}, total ${brl(cp.total)})`);
    }
  }
  return lines.join("\n");
}

function formatPatrimonio(data) {
  const lines = [`<b>Patrimonio Bloqueado</b> (${brl(data.patrimonio.total)})`];
  for (const it of data.patrimonio.itens) {
    lines.push(`- ${it.item}: ${brl(it.valor)} (+${brl(it.adicao_mensal)}/mes)`);
  }
  return lines.join("\n");
}

function formatEntradasDetalhado(data) {
  const { entradas } = data;
  const lines = [`<b>Entradas - Recebido</b> (${brl(entradas.total_recebido)})`];
  for (const e of entradas.recebido) {
    lines.push(`- ${e.item}: ${brl(e.valor)}`);
  }
  lines.push("", `<b>Entradas - Pendente</b> (${brl(entradas.total_pendente)})`);
  for (const e of entradas.pendente) {
    lines.push(`- ${e.item}: ${brl(e.valor)}`);
  }
  return lines.join("\n");
}

const HELP = [
  "<b>🤖 Agente Financeiro Inteligente (Google Gemini)</b>",
  "Você pode conversar normalmente em português livre ou usar os comandos abaixo:",
  "",
  "<b>Exemplos de conversação livre:</b>",
  '• <i>"Quanto ainda tenho para gastar no mercado?"</i>',
  '• <i>"Gastei 45 no almoço"</i>',
  '• <i>"Recebi 500 do freelance"</i>',
  '• <i>"Paguei o cartão Click 800"</i>',
  '• <i>"Qual fatura vence primeiro?"</i>',
  '• <i>"Se eu comprar algo de 400 agora, o caixa aguenta?"</i>',
  "",
  "<b>Comandos rápidos:</b>",
  "/resumo - visão geral do mês (caixa, despesas, dívidas)",
  "/detalhado - detalhamento completo item a item",
  "/dividas - cartões, dívidas ativas e atrasadas",
  "/despesas - despesas categorizadas e parceladas",
  "/patrimonio - patrimônio bloqueado",
  '/corrigir - ajustes estruturais (ex: "/corrigir adicione parcela de 300")',
  "/help - esta mensagem de ajuda",
  "",
  "📷 Envie fotos de recibos ou notas fiscais para leitura automática por OCR.",
].join("\n");

// ---------- Lancamento de gastos ----------

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "gastei", "paguei", "gasto", "pagamento", "de", "da", "do", "no", "na",
  "em", "com", "reais", "real", "hoje", "comprei", "compra", "r",
]);

function parseExpenseMessage(text) {
  const amountMatch =
    text.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i) ||
    text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!amountMatch) return null;

  let raw = amountMatch[1];
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;

  const description =
    text.slice(0, amountMatch.index) + text.slice(amountMatch.index + amountMatch[0].length);
  const tokens = normalize(description)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));

  return { value: round2(value), tokens, rawDescription: description.trim() };
}

const INCOME_TRIGGERS = ["recebi", "recebimento", "receber", "recebido", "entrou", "caiu"];
const INCOME_STOPWORDS = new Set(["recebi", "recebimento", "receber", "recebido", "entrou", "caiu"]);

function parseIncomeMessage(text) {
  const norm = normalize(text);
  if (!INCOME_TRIGGERS.some((t) => norm.includes(t))) return null;

  const amountMatch =
    text.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i) ||
    text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!amountMatch) return null;

  let raw = amountMatch[1];
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) return null;

  const description =
    text.slice(0, amountMatch.index) + text.slice(amountMatch.index + amountMatch[0].length);
  const tokens = normalize(description)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t) && !INCOME_STOPWORDS.has(t));

  return { value: round2(value), tokens, rawDescription: description.trim() };
}

function parseAmountToken(raw) {
  let s = raw;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(s);
  return Number.isFinite(v) ? round2(v) : 0;
}

function parseReceiptText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const amountRegex = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g;

  let totalValue = null;
  for (const line of lines) {
    if (/total/i.test(line)) {
      const matches = [...line.matchAll(amountRegex)];
      if (matches.length > 0) {
        totalValue = parseAmountToken(matches[matches.length - 1][0]);
        break;
      }
    }
  }

  if (totalValue == null) {
    const allAmounts = [];
    for (const line of lines) {
      for (const m of line.matchAll(amountRegex)) {
        const v = parseAmountToken(m[0]);
        if (v > 0) allAmounts.push(v);
      }
    }
    if (allAmounts.length > 0) totalValue = Math.max(...allAmounts);
  }

  const description = lines[0] || "";
  const tokens = normalize(description)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));

  return {
    value: totalValue,
    tokens,
    rawDescription: description,
    rawText: lines.join(" | ").slice(0, 300),
  };
}

async function handlePhoto(chatId, photos, state) {
  await sendMessage(chatId, "📷 Lendo a imagem (OCR)... isso pode levar alguns segundos.");
  try {
    const best = photos[photos.length - 1];
    const fileRes = await fetch(`${API}/getFile?file_id=${best.file_id}`);
    const fileJson = await fileRes.json();
    if (!fileJson.ok) {
      await sendMessage(chatId, "Nao consegui baixar a imagem do Telegram. Tenta de novo.");
      return;
    }
    const imgRes = await fetch(`${FILE_API}/${fileJson.result.file_path}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const worker = await getOcrWorker();
    const { data } = await worker.recognize(buffer);

    if (!data.text || !data.text.trim()) {
      await sendMessage(chatId, "Nao consegui ler nenhum texto na imagem. Manda o gasto por texto mesmo.");
      return;
    }

    const parsed = parseReceiptText(data.text);
    if (parsed.value == null) {
      await sendMessage(
        chatId,
        `Li a imagem mas nao achei um valor. Texto reconhecido:\n<i>${parsed.rawText}</i>\n\nManda o valor manualmente, tipo "gastei 45,90 mercado".`
      );
      return;
    }

    await presentExpenseChoice(
      chatId,
      parsed,
      state,
      `📷 OCR leu: <i>${parsed.rawText}</i>`
    );
  } catch (err) {
    console.error("Erro no OCR", err);
    await sendMessage(chatId, "Erro ao processar a imagem. Tenta de novo ou manda o gasto por texto.");
  }
}

// Mapeia chave de cartoes_credito -> credor correspondente em dividas.ativas,
// para (a) achar a fatura do mes vigente quando alguem manda "paguei cartao X"
// e (b) evitar oferecer o mesmo cartao duas vezes (uma como "cartao", outra
// como "divida" generica).
const CARD_CREDOR = {
  UNICLASS: "Cartao Uniclass",
  CLICK: "Cartao Click",
  NUBANK_RAFAEL: "Cartao Nubank Rafael",
};

function collectCandidates(data) {
  const list = [];
  data.despesas.categorias.forEach((cat, ci) => {
    cat.itens.forEach((item, ii) => {
      list.push({
        tipo: "despesa",
        categoriaIndex: ci,
        itemIndex: ii,
        categoria: cat.nome,
        item: item.item,
        previsto: item.previsto,
        pago: item.pago,
      });
    });
  });
  data.despesas.compras_parceladas.forEach((cp, pi) => {
    list.push({
      tipo: "parcelada",
      parceladaIndex: pi,
      categoria: "Compras parceladas",
      item: cp.item,
      previsto: cp.total,
      pago: cp.pago_mes,
    });
  });

  const mesRef = data._metadata.mes_referencia;
  for (const [key, cartao] of Object.entries(data.cartoes_credito || {})) {
    const fatura = cartao.faturas.find((f) => f.mes === mesRef);
    if (!fatura || fatura.pago) continue; // sem fatura do mes vigente ou ja quitada - nada a pagar
    list.push({
      tipo: "cartao",
      cartaoKey: key,
      categoria: "Cartoes de credito",
      item: CARD_CREDOR[key] || `Cartao ${key}`,
      previsto: fatura.valor,
      pago: fatura.valor_pago ?? 0,
    });
  }

  const cardCredores = new Set(Object.values(CARD_CREDOR));
  data.dividas.ativas.forEach((d, di) => {
    if (cardCredores.has(d.credor)) return; // esse cartao ja aparece como "cartao" acima
    list.push({
      tipo: "divida",
      dividaIndex: di,
      categoria: "Dividas ativas",
      item: d.credor,
      previsto: d.valor,
      pago: 0,
    });
  });

  return list;
}

function collectIncomeCandidates(data) {
  return data.entradas.pendente.map((item, idx) => ({
    tipo: "pendente",
    index: idx,
    item: item.item,
    valor: item.valor,
  }));
}

function applyIncome(data, choice, amount) {
  const pend = data.entradas.pendente[choice.index];
  if (pend) {
    pend.valor = round2(pend.valor - amount);
    if (pend.valor <= 0) data.entradas.pendente.splice(choice.index, 1);
  }
  const existing = data.entradas.recebido.find((r) => r.item === choice.item);
  if (existing) existing.valor = round2(existing.valor + amount);
  else data.entradas.recebido.push({ item: choice.item, valor: amount });
  recomputeTotals(data);
}

async function presentIncomeChoice(chatId, parsed, state) {
  const data = await loadData();
  const candidates = collectIncomeCandidates(data);
  const scored = candidates
    .map((c) => ({ ...c, score: scoreCandidate(parsed.tokens, c) }))
    .sort((a, b) => b.score - a.score);

  const withScore = scored.filter((c) => c.score > 0).slice(0, 5);
  const options = withScore.length > 0 ? withScore : scored.slice(0, 5);

  const buttons = options.map((c, idx) => [
    { text: `${c.item} (esperado ${brl(c.valor)})`, callback_data: `pickinc:${idx}` },
  ]);
  buttons.push([{ text: "➕ Entrada nova/extra", callback_data: "newincome" }]);
  buttons.push([{ text: "❌ Cancelar", callback_data: "cancel" }]);

  state.pending[chatId] = { type: "choosing_income", amount: parsed.value, description: parsed.rawDescription, options };
  await saveState(state);

  await sendMessage(
    chatId,
    `Recebimento de <b>${brl(parsed.value)}</b>${parsed.rawDescription ? ` (${parsed.rawDescription})` : ""}. De qual entrada pendente?`,
    buttons
  );
}

async function createNewIncomeItem(chatId, pending, itemName, state) {
  if (!itemName) {
    await sendMessage(chatId, "Nome vazio, manda de novo o nome da entrada.");
    return;
  }
  const data = await loadData();
  const amount = pending.amount;
  const existing = data.entradas.recebido.find((r) => r.item === itemName);
  if (existing) existing.valor = round2(existing.valor + amount);
  else data.entradas.recebido.push({ item: itemName, valor: amount });

  recomputeTotals(data);
  await writeData(data);
  delete state.pending[chatId];
  await saveState(state);

  await sendMessage(chatId, `Entrada "${itemName}" registrada com ${brl(amount)} recebido.`);
}

function scoreCandidate(tokens, candidate) {
  const itemTokens = normalize(candidate.item).split(" ").filter(Boolean);
  let score = 0;
  for (const t of tokens) {
    if (itemTokens.includes(t)) score += 2;
    else if (itemTokens.some((it) => it.length > 2 && (it.includes(t) || t.includes(it)))) score += 1;
  }
  return score;
}

function recomputeTotals(data) {
  let previstoTotal = 0;
  let pagoTotal = 0;
  for (const cat of data.despesas.categorias) {
    for (const item of cat.itens) {
      previstoTotal += item.previsto;
      pagoTotal += item.pago;
    }
  }
  for (const cp of data.despesas.compras_parceladas) {
    previstoTotal += cp.total;
    pagoTotal += cp.pago_mes;
  }
  data.despesas.resumo.previsto_total = round2(previstoTotal);
  data.despesas.resumo.pago_total = round2(pagoTotal);

  const recebidoTotal = round2(data.entradas.recebido.reduce((s, i) => s + i.valor, 0));
  const pendenteTotal = round2(data.entradas.pendente.reduce((s, i) => s + i.valor, 0));
  data.entradas.total_recebido = recebidoTotal;
  data.entradas.total_pendente = pendenteTotal;
  data.entradas.total_esperado = round2(recebidoTotal + pendenteTotal);

  data.dividas.total_ativas = round2(data.dividas.ativas.reduce((s, d) => s + d.valor, 0));
  data.dividas.total_atrasadas = round2(data.dividas.atrasadas.reduce((s, d) => s + d.valor, 0));

  data.patrimonio.total = round2(data.patrimonio.itens.reduce((s, i) => s + i.valor, 0));

  data.saldo_caixa.recebido = recebidoTotal;
  data.saldo_caixa.pago = round2(pagoTotal);
  data.saldo_caixa.caixa_atual = round2(recebidoTotal - pagoTotal);
  data.saldo_caixa.ainda_precisa_pagar = round2(previstoTotal - pagoTotal + data.dividas.total_ativas);
  data._metadata.ultima_atualizacao = new Date().toISOString().slice(0, 10);
}

function applyJsonPatch(data, patch) {
  for (const op of patch) {
    const parts = op.path
      .split("/")
      .slice(1)
      .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
    let target = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = Array.isArray(target) ? Number(parts[i]) : parts[i];
      target = target[key];
    }
    const lastKey = parts[parts.length - 1];

    if (op.op === "add") {
      if (Array.isArray(target)) {
        if (lastKey === "-") target.push(op.value);
        else target.splice(Number(lastKey), 0, op.value);
      } else {
        target[lastKey] = op.value;
      }
    } else if (op.op === "replace") {
      const key = Array.isArray(target) ? Number(lastKey) : lastKey;
      target[key] = op.value;
    } else if (op.op === "remove") {
      if (Array.isArray(target)) target.splice(Number(lastKey), 1);
      else delete target[lastKey];
    } else {
      throw new Error(`Operacao de patch desconhecida: ${op.op}`);
    }
  }
}

const CORRECTION_SYSTEM_PROMPT = `Voce ajusta o arquivo JSON financeiro data/master.json da familia Arcanjo, a partir de uma instrucao em portugues.

REGRAS FIXAS DO SCHEMA:
- E permitido adicionar campos novos em qualquer nivel (nova secao, novo item de lista, novo campo num objeto), inclusive criar arrays de historico novos (ex: "historico": [{"mes":"2026-08","valor":123.45}]) quando fizer sentido para registrar dados de meses passados que o schema atual nao cobre.
- NUNCA remova, renomeie ou mude o tipo/formato de um campo que ja existe.
- NUNCA invente valores numericos. Se a instrucao nao disser um valor explicito e ele nao puder ser deduzido com certeza dos proprios dados (ex: "total" e "parcelas" de uma compra parcelada existente), marque needs_clarification=true e faca uma pergunta objetiva em vez de adivinhar.
- Nao recalcule totais/resumos (despesas.resumo, saldo_caixa, entradas.total_*, dividas.total_*, patrimonio.total) - isso e recalculado automaticamente depois do seu patch. So altere os dados de base (itens, listas).

FORMATO DE RESPOSTA - responda APENAS com um objeto JSON, sem nenhum texto antes ou depois:
{"summary": "resumo curto e humano da mudanca proposta", "patch": [{"op":"add"|"replace"|"remove", "path":"/caminho/estilo/json-pointer", "value": <novo valor, omitir se op=remove>}], "warnings": ["aviso sobre campo novo que pode exigir ajuste no BI, se houver"], "needs_clarification": false, "question": ""}

Os "path" seguem JSON Pointer (RFC 6901): comecam com "/", indices de array sao numeros (ex: "/despesas/compras_parceladas/0/pago_mes"). Para adicionar um item ao FINAL de uma lista existente, use "/-" no final do path do array (ex: "/despesas/compras_parceladas/-") com o objeto completo como value. Se needs_clarification for true, "patch" deve ser uma lista vazia.`;

async function requestCorrectionWithGemini(instruction, data) {
  const client = getGeminiClient();
  if (!client) return { error: "no_key" };

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: `DADOS ATUAIS (data/master.json):\n${JSON.stringify(data)}\n\nINSTRUCAO:\n${instruction}`,
      config: {
        systemInstruction: CORRECTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return { error: "no_text" };
    return { result: JSON.parse(text) };
  } catch (err) {
    console.error("Erro na chamada da API Google Gemini para correcao", err);
    return { error: "api_error" };
  }
}

async function requestCorrectionAnthropic(instruction, data) {
  const client = getAnthropicClient();
  if (!client) return { error: "no_key" };

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      system: CORRECTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `DADOS ATUAIS (data/master.json):\n${JSON.stringify(data)}\n\nINSTRUCAO:\n${instruction}`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return { error: "no_text" };
    const match = textBlock.text.match(/\{[\s\S]*\}/);
    if (!match) return { error: "no_json" };
    return { result: JSON.parse(match[0]) };
  } catch (err) {
    console.error("Erro na chamada da API Anthropic", err);
    return { error: "api_error" };
  }
}

async function requestCorrection(instruction, data) {
  if (getGeminiClient()) {
    const geminiRes = await requestCorrectionWithGemini(instruction, data);
    if (!geminiRes.error) return geminiRes;
    console.warn("Falha no Gemini para correcao, tentando fallback...");
  }
  return requestCorrectionAnthropic(instruction, data);
}

async function handleCorrectionCommand(chatId, instruction, state) {
  if (!instruction) {
    await sendMessage(
      chatId,
      'Manda assim: "/corrigir adicione uma parcela paga do tizerpatida no mes de agosto".'
    );
    return;
  }
  if (!getGeminiClient() && !getAnthropicClient()) {
    await sendMessage(chatId, "Nenhuma API Key de IA configurada. Defina GEMINI_API_KEY no .env e reinicie o bot.");
    return;
  }

  await sendMessage(chatId, "🤔 Analisando o pedido com IA...");

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error("Erro ao ler dados para correcao", err);
    await sendMessage(chatId, "Erro ao ler os dados financeiros.");
    return;
  }

  const { result, error } = await requestCorrection(instruction, data);
  if (error) {
    console.error("Erro na correcao:", error);
    await sendMessage(chatId, "Nao consegui interpretar a correcao. Tenta reformular.");
    return;
  }
  if (result.needs_clarification) {
    await sendMessage(chatId, `❓ ${result.question || "Preciso de mais detalhes para fazer essa mudanca."}`);
    return;
  }
  if (!Array.isArray(result.patch) || result.patch.length === 0) {
    await sendMessage(chatId, "Nao identifiquei nenhuma mudanca a fazer nos dados.");
    return;
  }

  // Valida o patch numa copia antes de propor - evita confirmar algo que quebra.
  try {
    const testCopy = JSON.parse(JSON.stringify(data));
    applyJsonPatch(testCopy, result.patch);
    recomputeTotals(testCopy);
  } catch (err) {
    console.error("Patch proposto invalido", err, result.patch);
    await sendMessage(chatId, "A correcao proposta ficou invalida. Tenta reformular o pedido.");
    return;
  }

  state.pending[chatId] = { type: "confirm_patch", patch: result.patch, summary: result.summary };
  await saveState(state);

  const warn =
    Array.isArray(result.warnings) && result.warnings.length > 0
      ? `\n\n⚠️ ${result.warnings.join(" ")}`
      : "";
  await sendMessage(
    chatId,
    `<b>Proposta:</b> ${result.summary}${warn}\n\nConfirma?`,
    [
      [
        { text: "✅ Confirmar", callback_data: "confirm_patch" },
        { text: "❌ Cancelar", callback_data: "cancel" },
      ],
    ]
  );
}

// Registra um pagamento contra a fatura do mes vigente de um cartao e
// reflete o restante pendente em dividas.ativas (mesma logica usada para
// reconciliar manualmente um pagamento de fatura): quita por completo
// (fatura.pago=true, remove de dividas.ativas) ou registra pagamento
// parcial (fatura.valor_pago, dividas.ativas.valor = restante).
function applyCardPayment(data, choice, amount) {
  const cartao = data.cartoes_credito[choice.cartaoKey];
  const mesRef = data._metadata.mes_referencia;
  const fatura = cartao?.faturas.find((f) => f.mes === mesRef);
  if (!fatura) return;

  const jaPago = fatura.valor_pago ?? 0;
  const novoPago = round2(jaPago + amount);
  const credorNome = CARD_CREDOR[choice.cartaoKey];

  if (novoPago >= fatura.valor - 0.005) {
    fatura.pago = true;
    delete fatura.valor_pago;
    if (credorNome) {
      const idx = data.dividas.ativas.findIndex((d) => d.credor === credorNome);
      if (idx !== -1) data.dividas.ativas.splice(idx, 1);
    }
  } else {
    fatura.valor_pago = novoPago;
    fatura.pago = false;
    if (credorNome) {
      const restante = round2(fatura.valor - novoPago);
      const divida = data.dividas.ativas.find((d) => d.credor === credorNome);
      if (divida) divida.valor = restante;
      else data.dividas.ativas.push({ credor: credorNome, valor: restante, data_final: mesRef });
    }
  }
}

function applyExpense(data, choice, amount, description) {
  if (choice.tipo === "despesa") {
    const item = data.despesas.categorias[choice.categoriaIndex].itens[choice.itemIndex];
    item.pago = round2(item.pago + amount);
    if (Array.isArray(item.detalhes)) {
      item.detalhes.push({ descricao: description || item.item, valor: amount });
    }
  } else if (choice.tipo === "cartao") {
    applyCardPayment(data, choice, amount);
  } else {
    data.despesas.compras_parceladas[choice.parceladaIndex].pago_mes = round2(
      data.despesas.compras_parceladas[choice.parceladaIndex].pago_mes + amount
    );
  }
  recomputeTotals(data);
}

// ---------- Agente Inteligente Google Gemini (Function Calling) ----------

const AGENT_SYSTEM_INSTRUCTION = `Aja como o coach e planejador financeiro pessoal de elite do Rafael e da Familia Arcanjo, operando como um Agente Autonomo inteligente integrado ao ecossistema Google Gemini & Antigravity.

Seu objetivo e ajudar o Rafael e sua familia a organizar financas, eliminar dividas estrategicamente, otimizar gastos e construir patrimonio familiar sustentavel a longo prazo.

DIRETRIZES DE COMUNICACAO E COMPORTAMENTO:
1. Seja firme, realista, pratico e analitico. Evite respostas genericas ou excessivamente motivacionais; priorize sempre dados reais, planilhas, numeros exatos e acoes concretas.
2. Questione premissas financeiras fracas, aponte lacunas no orcamento ou no planejamento e apresente contrapontos tecnicos, francos e fundamentados sempre que necessario.
3. Use sempre termos tecnicos corretos em portugues do Brasil (evite aportuguesamentos desnecessarios ou falsos cognatos).
4. Mantenha o foco em metas claras e inegociaveis: fluxo de caixa positivo e saudavel, controle rigoroso de despesas, quitacao agressiva de dividas (especialmente rotativo de cartao e juros altos) e estrategias inteligentes de alocacao de capital e construcao de patrimonio.
5. CONVERSACAO LIVRE E ABERTA (GUARDRAILS AMPLOS): Converse livremente sobre qualquer assunto de financas, investimentos, economia familiar, renegociacoes, duvidas conceituais, simulacoes de compras ("posso comprar tal coisa?", "vale a pena parcelar?") e estrategias de amortizacao. Nunca devolva mensagens frias, de erro de formato ou meras listas de comandos para perguntas financeiras abertas. Aja como um parceiro e estrategista financeiro pessoal.

CAPACIDADES AGENTICAS E USO DAS FERRAMENTAS:
- Ao responder sobre a situacao atual ("quais contas a pagar em setembro?", "como esta meu caixa?", "quanto devo no cartao?"), execute IMEDIATAMENTE as ferramentas reais ('consultar_resumo_financeiro', 'consultar_despesas', 'consultar_dividas_e_cartoes', 'consultar_entradas') para extrair os numeros exatos de data/master.json e embasar seu diagnostico.
- Quando for o primeiro contato ou pedido de diagnostico: faca um raio-X rapido do cenario real atual (entradas, gastos fixos, dividas e caixa livre) e proponha os proximos 3 passos praticos e imediatos da semana.
- Para lancamentos rotineiros:
  * Gastos do dia a dia: use 'lancar_despesa'.
  * Entradas recebidas: use 'lancar_receita'.
  * Pagamento de faturas de cartao (UNICLASS, CLICK, NUBANK_RAFAEL): use 'pagar_fatura_cartao'.
- Para alteracoes estruturais no orcamento (novas dividas de longo prazo, renegociacao, mudancas de contrato): use 'propor_ajuste_estrutural' para exibir os botoes de confirmacao [ Confirmar ] [ Cancelar ].
- Patrimonio bloqueado (VGBL, FGTS, bens) e reserva bloqueada, nao entra no caixa liquido disponivel para despesas correntes.
- Formatacao: responda com formatacao HTML valida compativel com o Telegram (<b>negrito</b>, <i>italico</i>, <code>codigo</code>). NAO use markdown asteriscos (**) pois o Telegram opera em modo HTML.
`;

const AGENT_TOOLS = [
  {
    name: "consultar_resumo_financeiro",
    description: "Retorna o resumo financeiro consolidado do mes vigente: saldo de caixa atual, total recebido, total pago, valor ainda pendente de pagamento, total de despesas do mes (previsto vs pago), total de dividas ativas e atrasadas, e patrimonio bloqueado.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "consultar_despesas",
    description: "Consulta as despesas do mes vigente categorizadas (Alimentacao, Moradia, Transporte, etc.) ou compras parceladas, com valores previstos, pagos e saldo restante.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoria: {
          type: Type.STRING,
          description: "Nome opcional da categoria (ex: 'Alimentacao', 'Transporte', 'Moradia', 'Lazer'). Se omitido, retorna todas.",
        },
      },
    },
  },
  {
    name: "consultar_dividas_e_cartoes",
    description: "Consulta a situacao dos cartoes de credito (fatura do mes, valor pago, status pago/pendente para UNICLASS, CLICK, NUBANK_RAFAEL), compras parceladas e dividas ativas/atrasadas.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "consultar_entradas",
    description: "Consulta as receitas do mes: salarios, beneficios, freelances e outras entradas recebidas ou pendentes.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "lancar_despesa",
    description: "Registra um gasto ou pagamento realizado em um item de despesa do orcamento mensal. Atualiza os totais de forma automatica.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoria: {
          type: Type.STRING,
          description: "Nome da categoria existente (ex: Alimentacao, Transporte, Moradia, etc.)",
        },
        item: {
          type: Type.STRING,
          description: "Nome do item dentro da categoria (ex: Mercado, Combustivel, Farmacia)",
        },
        valor: {
          type: Type.NUMBER,
          description: "Valor pago em reais (numero positivo)",
        },
        descricao: {
          type: Type.STRING,
          description: "Descricao ou observacao do gasto",
        },
        criar_item_se_nao_existir: {
          type: Type.BOOLEAN,
          description: "Se verdadeiro e o item nao existir, cria o novo item na categoria com previsto=valor.",
        },
      },
      required: ["categoria", "item", "valor"],
    },
  },
  {
    name: "lancar_receita",
    description: "Registra uma entrada/recebimento de valor no caixa (ex: salario, adiantamento, beneficio VR/VA, freelance).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item: {
          type: Type.STRING,
          description: "Nome ou origem da entrada (ex: Salario Rafael, VR, Freelance)",
        },
        valor: {
          type: Type.NUMBER,
          description: "Valor recebido em reais",
        },
      },
      required: ["item", "valor"],
    },
  },
  {
    name: "pagar_fatura_cartao",
    description: "Registra pagamento parcial ou total da fatura do mes de um cartao de credito (UNICLASS, CLICK, NUBANK_RAFAEL) e sincroniza automaticamente com as dividas ativas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        cartao: {
          type: Type.STRING,
          description: "Identificador do cartao: 'UNICLASS', 'CLICK' ou 'NUBANK_RAFAEL'",
        },
        valor: {
          type: Type.NUMBER,
          description: "Valor pago na fatura",
        },
      },
      required: ["cartao", "valor"],
    },
  },
  {
    name: "propor_ajuste_estrutural",
    description: "Propoe uma alteracao estrutural no arquivo data/master.json via JSON Patch (RFC 6901) para situacoes complexas: novas dividas recorrentes, prazos, exclusoes, parcelamentos ou correcoes passadas. O bot enviara botoes de confirmacao para o usuario antes de gravar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        resumo: {
          type: Type.STRING,
          description: "Resumo claro e humano da alteracao proposta",
        },
        patch: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              op: { type: Type.STRING, description: "add, replace ou remove" },
              path: { type: Type.STRING, description: "Caminho estilo JSON Pointer (/despesas/...)" },
              value: { type: Type.STRING, description: "Valor novo (se aplicavel)" },
            },
            required: ["op", "path"],
          },
          description: "Lista de operacoes JSON Patch",
        },
        avisos: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Avisos sobre impactos ou campos novos",
        },
      },
      required: ["resumo", "patch"],
    },
  },
];

async function executeAgentTool(name, args, state, chatId) {
  const data = await loadData();
  switch (name) {
    case "consultar_resumo_financeiro": {
      return {
        mes_referencia: data._metadata.mes_referencia,
        saldo_caixa: data.saldo_caixa,
        despesas_resumo: data.despesas.resumo,
        dividas: {
          total_ativas: data.dividas.total_ativas,
          total_atrasadas: data.dividas.total_atrasadas,
          total: round2(data.dividas.total_ativas + data.dividas.total_atrasadas),
        },
        patrimonio_total: data.patrimonio.total,
        entradas: {
          recebido: data.entradas.total_recebido,
          pendente: data.entradas.total_pendente,
          esperado: data.entradas.total_esperado,
        },
      };
    }
    case "consultar_despesas": {
      const catFilter = args?.categoria ? normalize(args.categoria) : null;
      const cats = data.despesas.categorias
        .filter((c) => !catFilter || normalize(c.nome).includes(catFilter))
        .map((c) => ({
          categoria: c.nome,
          total_previsto: round2(c.itens.reduce((s, i) => s + i.previsto, 0)),
          total_pago: round2(c.itens.reduce((s, i) => s + i.pago, 0)),
          itens: c.itens.map((it) => ({
            item: it.item,
            previsto: it.previsto,
            pago: it.pago,
            restante: round2(it.previsto - it.pago),
            estourou: it.pago > it.previsto,
          })),
        }));
      return {
        categorias: cats,
        compras_parceladas: data.despesas.compras_parceladas.map((cp) => ({
          item: cp.item,
          pago_mes: cp.pago_mes,
          total: cp.total,
          parcela: cp.parcela,
        })),
      };
    }
    case "consultar_dividas_e_cartoes": {
      const mesRef = data._metadata.mes_referencia;
      const cartoes = {};
      for (const [key, c] of Object.entries(data.cartoes_credito || {})) {
        const fatura = c.faturas?.find((f) => f.mes === mesRef) || null;
        cartoes[key] = {
          nome: c.nome || key,
          limite: c.limite,
          fatura_mes_atual: fatura
            ? {
                mes: fatura.mes,
                valor: fatura.valor,
                pago: fatura.pago,
                valor_pago: fatura.valor_pago ?? (fatura.pago ? fatura.valor : 0),
                restante: fatura.pago ? 0 : round2(fatura.valor - (fatura.valor_pago ?? 0)),
              }
            : null,
          quitacao_prevista: c.quitacao_prevista,
        };
      }
      return {
        cartoes,
        dividas_ativas: data.dividas.ativas,
        dividas_atrasadas: data.dividas.atrasadas,
        compras_parceladas: data.despesas.compras_parceladas,
      };
    }
    case "consultar_entradas": {
      return {
        total_recebido: data.entradas.total_recebido,
        total_pendente: data.entradas.total_pendente,
        recebido: data.entradas.recebido,
        pendente: data.entradas.pendente,
      };
    }
    case "lancar_despesa": {
      const amount = Number(args.valor);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { erro: "Valor numerico invalido para despesa." };
      }
      const catNorm = normalize(args.categoria || "");
      let catIdx = data.despesas.categorias.findIndex((c) => normalize(c.nome).includes(catNorm));
      if (catIdx === -1 && args.item) {
        catIdx = data.despesas.categorias.findIndex((c) =>
          c.itens.some((it) => normalize(it.item).includes(normalize(args.item)))
        );
      }
      if (catIdx === -1) {
        if (args.criar_item_se_nao_existir && args.categoria) {
          data.despesas.categorias.push({ nome: args.categoria, itens: [] });
          catIdx = data.despesas.categorias.length - 1;
        } else {
          return {
            erro: `Categoria '${args.categoria}' nao encontrada. Categorias disponiveis: ${data.despesas.categorias.map((c) => c.nome).join(", ")}.`,
          };
        }
      }
      const cat = data.despesas.categorias[catIdx];
      const itemNorm = normalize(args.item || "");
      let item = cat.itens.find((it) => normalize(it.item) === itemNorm);
      if (!item) {
        item = cat.itens.find((it) => normalize(it.item).includes(itemNorm) || itemNorm.includes(normalize(it.item)));
      }
      if (!item) {
        if (args.criar_item_se_nao_existir) {
          item = { item: args.item, previsto: amount, pago: amount };
          cat.itens.push(item);
        } else {
          return {
            erro: `Item '${args.item}' nao encontrado na categoria '${cat.nome}'. Itens existentes: ${cat.itens.map((i) => i.item).join(", ")}. Defina criar_item_se_nao_existir=true para adicionar novo item.`,
          };
        }
      }

      item.pago = round2(item.pago + amount);
      if (Array.isArray(item.detalhes)) {
        item.detalhes.push({ descricao: args.descricao || item.item, valor: amount });
      }

      recomputeTotals(data);
      await writeData(data);
      return {
        sucesso: true,
        categoria: cat.nome,
        item: item.item,
        valor_lancado: amount,
        total_pago: item.pago,
        previsto: item.previsto,
        restante: round2(item.previsto - item.pago),
        estourou: item.pago > item.previsto,
        caixa_atual: data.saldo_caixa.caixa_atual,
      };
    }
    case "lancar_receita": {
      const amount = Number(args.valor);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { erro: "Valor numerico invalido para receita." };
      }
      const itemNorm = normalize(args.item || "");
      const pendIdx = data.entradas.pendente.findIndex(
        (p) => normalize(p.item).includes(itemNorm) || itemNorm.includes(normalize(p.item))
      );
      if (pendIdx !== -1) {
        const pend = data.entradas.pendente[pendIdx];
        pend.valor = round2(pend.valor - amount);
        if (pend.valor <= 0) data.entradas.pendente.splice(pendIdx, 1);
      }

      const existing = data.entradas.recebido.find(
        (r) => normalize(r.item).includes(itemNorm) || itemNorm.includes(normalize(r.item))
      );
      if (existing) {
        existing.valor = round2(existing.valor + amount);
      } else {
        data.entradas.recebido.push({ item: args.item, valor: amount });
      }

      recomputeTotals(data);
      await writeData(data);
      return {
        sucesso: true,
        item: existing ? existing.item : args.item,
        valor_recebido: amount,
        total_recebido_mes: data.entradas.total_recebido,
        total_pendente_mes: data.entradas.total_pendente,
        caixa_atual: data.saldo_caixa.caixa_atual,
      };
    }
    case "pagar_fatura_cartao": {
      const cardKey = (args.cartao || "").toUpperCase().trim();
      if (!CARD_CREDOR[cardKey]) {
        return { erro: `Cartao '${args.cartao}' invalido. Opcoes validas: UNICLASS, CLICK, NUBANK_RAFAEL.` };
      }
      const amount = Number(args.valor);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { erro: "Valor invalido para pagamento de fatura." };
      }
      applyCardPayment(data, { cartaoKey: cardKey }, amount);
      recomputeTotals(data);
      await writeData(data);

      const mesRef = data._metadata.mes_referencia;
      const fatura = data.cartoes_credito[cardKey]?.faturas.find((f) => f.mes === mesRef);
      return {
        sucesso: true,
        cartao: cardKey,
        valor_pago: amount,
        fatura_quitada: fatura?.pago ?? false,
        fatura_restante: fatura?.pago ? 0 : round2((fatura?.valor ?? 0) - (fatura?.valor_pago ?? 0)),
        caixa_atual: data.saldo_caixa.caixa_atual,
      };
    }
    case "propor_ajuste_estrutural": {
      if (!Array.isArray(args.patch) || args.patch.length === 0) {
        return { erro: "Nenhuma operacao de patch valida fornecida." };
      }
      try {
        const testCopy = JSON.parse(JSON.stringify(data));
        applyJsonPatch(testCopy, args.patch);
        recomputeTotals(testCopy);
      } catch (err) {
        return { erro: `Patch proposto e invalido ou causou erro: ${err.message}` };
      }

      state.pending[chatId] = {
        type: "confirm_patch",
        patch: args.patch,
        summary: args.resumo,
      };
      await saveState(state);

      const warn = Array.isArray(args.avisos) && args.avisos.length > 0 ? `\n\n⚠️ ${args.avisos.join(" ")}` : "";
      await sendMessage(
        chatId,
        `<b>Proposta de Ajuste:</b>\n${args.resumo}${warn}\n\nConfirma a alteracao?`,
        [
          [
            { text: "✅ Confirmar", callback_data: "confirm_patch" },
            { text: "❌ Cancelar", callback_data: "cancel" },
          ],
        ]
      );
      return {
        pendente_confirmacao: true,
        mensagem: "Botoes de confirmacao enviados para o usuario no Telegram.",
      };
    }
    default:
      return { erro: `Ferramenta '${name}' nao reconhecida.` };
  }
}

const geminiChatSessions = new Map();

function getOrCreateGeminiChat(chatId, modelName) {
  const key = `${chatId}:${modelName}`;
  let chat = geminiChatSessions.get(key);
  if (!chat) {
    const client = getGeminiClient();
    if (!client) return null;
    chat = client.chats.create({
      model: modelName,
      config: {
        systemInstruction: AGENT_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: AGENT_TOOLS }],
      },
    });
    geminiChatSessions.set(key, chat);
  }
  return chat;
}

async function runGeminiAgentWithModel(modelName, chatId, userText, state) {
  const chat = getOrCreateGeminiChat(chatId, modelName);
  if (!chat) return null;

  let response = await chat.sendMessage({ message: userText });
  let loops = 0;
  const maxLoops = 6;

  while (response.functionCalls && response.functionCalls.length > 0 && loops < maxLoops) {
    loops++;
    for (const call of response.functionCalls) {
      console.log(`[Gemini Agent (${modelName})] Executando tool '${call.name}':`, JSON.stringify(call.args));
      const result = await executeAgentTool(call.name, call.args, state, chatId);
      response = await chat.sendMessage({
        message: {
          functionResponse: {
            name: call.name,
            response: result,
          },
        },
      });
    }
  }

  return response.text || null;
}

async function runGeminiAgent(chatId, userText, state) {
  const client = getGeminiClient();
  if (!client) return false;

  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ];
  const uniqueModels = [...new Set(candidateModels)];

  for (const model of uniqueModels) {
    try {
      const text = await runGeminiAgentWithModel(model, chatId, userText, state);
      if (text) {
        await sendMessage(chatId, text);
        return true;
      }
    } catch (err) {
      console.warn(`[Gemini Agent] Falha com modelo '${model}': ${err.message || err.status}. Tentando proximo...`);
      geminiChatSessions.delete(`${chatId}:${model}`);
    }
  }

  await sendMessage(
    chatId,
    "⚠️ No momento os servidores da IA estao com alta demanda temporaria. Por favor, tente novamente em instantes."
  );
  return true;
}

async function presentExpenseChoice(chatId, parsed, state, header) {
  const data = await loadData();
  const candidates = collectCandidates(data);
  const scored = candidates
    .map((c) => ({ ...c, score: scoreCandidate(parsed.tokens, c) }))
    .sort((a, b) => b.score - a.score);

  const withScore = scored.filter((c) => c.score > 0).slice(0, 5);
  const options = withScore.length > 0 ? withScore : scored.slice(0, 5);

  const buttons = options.map((c, idx) => [
    { text: `${c.categoria} / ${c.item} (${brl(c.pago)}/${brl(c.previsto)})`, callback_data: `pick:${idx}` },
  ]);
  buttons.push([{ text: "➕ Novo item", callback_data: "newitem" }]);
  buttons.push([{ text: "❌ Cancelar", callback_data: "cancel" }]);

  state.pending[chatId] = { type: "choosing", amount: parsed.value, description: parsed.rawDescription, options };
  await saveState(state);

  const intro = header ? `${header}\n\n` : "";
  await sendMessage(
    chatId,
    `${intro}Gasto de <b>${brl(parsed.value)}</b>${parsed.rawDescription ? ` (${parsed.rawDescription})` : ""}. Em qual item lancar?`,
    buttons
  );
}

async function handleExpenseText(chatId, text, state) {
  const pending = state.pending[chatId];

  if (pending?.type === "awaiting_item_name") {
    await createNewItem(chatId, pending, text.trim(), state);
    return;
  }
  if (pending?.type === "awaiting_income_name") {
    await createNewIncomeItem(chatId, pending, text.trim(), state);
    return;
  }

  const incomeParsed = parseIncomeMessage(text);
  if (incomeParsed) {
    await presentIncomeChoice(chatId, incomeParsed, state);
    return;
  }

  const parsed = parseExpenseMessage(text);
  if (!parsed) {
    await sendMessage(
      chatId,
      'Nao entendi o valor. Manda assim: "gastei 50 no mercado", "R$50 combustivel" ou "recebi 500 do VR". Ou usa /help.'
    );
    return;
  }

  await presentExpenseChoice(chatId, parsed, state);
}

async function createNewItem(chatId, pending, itemName, state) {
  if (!itemName) {
    await sendMessage(chatId, "Nome vazio, manda de novo o nome do item.");
    return;
  }
  const data = await loadData();
  const amount = pending.amount;

  if (pending.categoriaRef === "parcelada") {
    data.despesas.compras_parceladas.push({
      item: itemName,
      total: amount,
      pago_mes: amount,
      parcela: "1/1",
      parcela_atual: 1,
      parcelas_totais: 1,
    });
  } else {
    const catIndex = Number(pending.categoriaRef);
    const cat = data.despesas.categorias[catIndex];
    if (!cat) {
      await sendMessage(chatId, "Categoria invalida, cancelado.");
      delete state.pending[chatId];
      await saveState(state);
      return;
    }
    cat.itens.push({ item: itemName, previsto: amount, pago: amount });
  }

  recomputeTotals(data);
  await writeData(data);
  delete state.pending[chatId];
  await saveState(state);

  await sendMessage(
    chatId,
    `Novo item "${itemName}" criado com ${brl(amount)} pago.\n\nSe for um gasto que se repete todo mes, me avisa depois pra eu ajustar o valor "previsto" certo (por enquanto ficou igual ao pago).`
  );
}

async function handleCallback(callback, state) {
  const chatId = callback.message.chat.id;
  await answerCallback(callback.id);

  if (!state.authorizedChats.includes(chatId)) return;

  const pending = state.pending[chatId];
  const data0 = callback.data;

  if (data0 === "cancel") {
    delete state.pending[chatId];
    await saveState(state);
    await sendMessage(chatId, "Cancelado.");
    return;
  }

  if (data0 === "confirm_patch") {
    if (!pending || pending.type !== "confirm_patch") return;
    try {
      const data = await loadData();
      applyJsonPatch(data, pending.patch);
      recomputeTotals(data);
      await writeData(data);
      await sendMessage(chatId, `✅ Aplicado: ${pending.summary}`);
    } catch (err) {
      console.error("Erro ao aplicar patch confirmado", err);
      await sendMessage(chatId, "Erro ao aplicar a correcao. Nada foi alterado.");
    }
    delete state.pending[chatId];
    await saveState(state);
    return;
  }

  if (data0 === "newitem") {
    if (!pending) return;
    const data = await loadData();
    const buttons = data.despesas.categorias.map((cat, idx) => [
      { text: cat.nome, callback_data: `newcat:${idx}` },
    ]);
    buttons.push([{ text: "Compra avulsa / parcelada", callback_data: "newcat:parcelada" }]);
    buttons.push([{ text: "❌ Cancelar", callback_data: "cancel" }]);
    state.pending[chatId] = { ...pending, type: "choosing_category" };
    await saveState(state);
    await sendMessage(chatId, "Em qual categoria criar o novo item?", buttons);
    return;
  }

  if (data0.startsWith("newcat:")) {
    if (!pending) return;
    const categoriaRef = data0.slice("newcat:".length);
    state.pending[chatId] = { ...pending, type: "awaiting_item_name", categoriaRef };
    await saveState(state);
    await sendMessage(chatId, "Qual o nome do novo item?");
    return;
  }

  if (data0.startsWith("pick:")) {
    if (!pending || pending.type !== "choosing") return;
    const idx = Number(data0.slice("pick:".length));
    const choice = pending.options[idx];
    if (!choice) return;

    delete state.pending[chatId];
    await saveState(state);

    if (choice.tipo === "divida") {
      await sendMessage(
        chatId,
        `<b>${choice.item}</b> e uma divida com parcela mensal fixa (${brl(choice.previsto)}) - nao e controlada como paga/pendente mes a mes no BI (normalmente ja debitada em folha ou ja contabilizada no previsto). Nada foi alterado.\n\nSe a parcela mudou de valor ou foi quitada de vez, usa /corrigir.`
      );
      return;
    }

    const data = await loadData();
    applyExpense(data, choice, pending.amount, pending.description);
    await writeData(data);

    if (choice.tipo === "cartao") {
      const fatura = data.cartoes_credito[choice.cartaoKey]?.faturas.find(
        (f) => f.mes === data._metadata.mes_referencia
      );
      const status = fatura?.pago
        ? "Fatura quitada este mes."
        : `Restante da fatura: ${brl(fatura.valor - (fatura.valor_pago ?? 0))}.`;
      await sendMessage(
        chatId,
        `Pagamento de ${brl(pending.amount)} registrado em <b>${choice.item}</b> (fatura ${data._metadata.mes_referencia}).\n${status}`
      );
      return;
    }

    await sendMessage(
      chatId,
      `Lancado: ${brl(pending.amount)} em <b>${choice.categoria} / ${choice.item}</b>.\nNovo total: ${brl(choice.pago + pending.amount)} / ${brl(choice.previsto)}.`
    );
    return;
  }

  if (data0 === "newincome") {
    if (!pending) return;
    state.pending[chatId] = { type: "awaiting_income_name", amount: pending.amount };
    await saveState(state);
    await sendMessage(chatId, "Qual o nome/origem dessa entrada?");
    return;
  }

  if (data0.startsWith("pickinc:")) {
    if (!pending || pending.type !== "choosing_income") return;
    const idx = Number(data0.slice("pickinc:".length));
    const choice = pending.options[idx];
    if (!choice) return;

    const data = await loadData();
    applyIncome(data, choice, pending.amount);
    await writeData(data);
    delete state.pending[chatId];
    await saveState(state);

    await sendMessage(chatId, `Recebido: ${brl(pending.amount)} em <b>${choice.item}</b>.`);
    return;
  }
}

// ---------- Comandos ----------

async function handleCommand(chatId, fromId, text, state) {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();

  if (cmd === "/start") {
    if (!state.ownerUserId) {
      state.ownerUserId = fromId;
      state.authorizedChats = [chatId];
      await sendMessage(chatId, "Bot registrado! Este chat vai receber os resumos e alertas financeiros.\n\n" + HELP);
    } else if (fromId === state.ownerUserId) {
      if (!state.authorizedChats.includes(chatId)) {
        state.authorizedChats.push(chatId);
        await sendMessage(chatId, "Chat autorizado! Agora este chat (grupo ou privado) tem acesso total ao bot.\n\n" + HELP);
      } else {
        await sendMessage(chatId, "Este chat ja esta autorizado.\n\n" + HELP);
      }
    } else {
      await sendMessage(chatId, "Apenas o dono do bot pode autorizar novos chats.");
    }
    await saveState(state);
    return;
  }

  if (!state.authorizedChats.includes(chatId)) {
    await sendMessage(chatId, "Nao autorizado. Peca para o dono do bot mandar /start neste chat.");
    return;
  }

  if (cmd === "/corrigir") {
    const instruction = text.trim().slice("/corrigir".length).trim();
    await handleCorrectionCommand(chatId, instruction, state);
    return;
  }

  try {
    const data = await loadData();
    if (cmd === "/resumo") await sendMessage(chatId, formatResumo(data));
    else if (cmd === "/dividas") await sendMessage(chatId, formatDividas(data));
    else if (cmd === "/despesas") await sendMessage(chatId, formatDespesas(data));
    else if (cmd === "/patrimonio") await sendMessage(chatId, formatPatrimonio(data));
    else if (cmd === "/detalhado") {
      await sendMessage(chatId, formatResumo(data));
      await sendMessage(chatId, formatDespesas(data));
      await sendMessage(chatId, formatDividas(data));
      await sendMessage(chatId, `${formatPatrimonio(data)}\n\n${formatEntradasDetalhado(data)}`);
    } else if (cmd === "/help") await sendMessage(chatId, HELP);
    else await sendMessage(chatId, "Comando nao reconhecido.\n\n" + HELP);
  } catch (err) {
    console.error("Erro ao processar comando", err);
    await sendMessage(chatId, "Erro ao ler os dados financeiros. Tente novamente.");
  }
}

async function handleIncoming(chatId, fromId, text, state) {
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    await handleCommand(chatId, fromId, trimmed, state);
    return;
  }

  if (!state.ownerUserId) {
    await sendMessage(chatId, "Manda /start primeiro para registrar este chat.");
    return;
  }
  if (!state.authorizedChats.includes(chatId)) {
    await sendMessage(chatId, "Nao autorizado. Peca para o dono do bot mandar /start neste chat.");
    return;
  }

  const pending = state.pending[chatId];
  if (pending?.type === "awaiting_item_name" || pending?.type === "awaiting_income_name") {
    await handleExpenseText(chatId, trimmed, state);
    return;
  }

  // Se o Gemini estiver configurado, processa com o Agente Inteligente
  if (getGeminiClient()) {
    try {
      const handled = await runGeminiAgent(chatId, trimmed, state);
      if (handled) return;
    } catch (err) {
      console.error("Falha no Gemini Agent, usando fallback regex:", err);
    }
  }

  try {
    await handleExpenseText(chatId, trimmed, state);
  } catch (err) {
    console.error("Erro ao lancar gasto", err);
    await sendMessage(chatId, "Erro ao processar o gasto. Tente novamente.");
  }
}

// ---------- Polling e alertas ----------

async function pollUpdates(state) {
  try {
    const res = await fetch(`${API}/getUpdates?offset=${state.lastUpdateId + 1}&timeout=10`, {
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    if (!json.ok) return;

    for (const update of json.result) {
      state.lastUpdateId = update.update_id;
      if (update.callback_query) {
        await handleCallback(update.callback_query, state);
      } else if (update.message?.photo) {
        const chatId = update.message.chat.id;
        if (state.authorizedChats.includes(chatId)) {
          await handlePhoto(chatId, update.message.photo, state);
        } else if (!state.ownerUserId) {
          await sendMessage(chatId, "Manda /start primeiro para registrar este chat.");
        } else {
          await sendMessage(chatId, "Nao autorizado. Peca para o dono do bot mandar /start neste chat.");
        }
      } else if (update.message?.text) {
        await handleIncoming(update.message.chat.id, update.message.from?.id, update.message.text, state);
      }
    }
    await saveState(state);
  } catch (err) {
    if (err.name !== "TimeoutError" && err.name !== "AbortError") {
      console.error("Erro no polling:", err.message);
    }
  }
}

async function broadcast(state, text) {
  for (const chatId of state.authorizedChats) {
    await sendMessage(chatId, text);
  }
}

async function checkAlerts(state) {
  if (state.authorizedChats.length === 0) return;
  let data;
  try {
    data = await loadData();
  } catch {
    return;
  }

  const negativo = data.saldo_caixa.caixa_atual < 0;
  if (negativo && !state.caixaNegativo) {
    await broadcast(state, `⚠️ ALERTA: caixa disponivel ficou negativo (${brl(data.saldo_caixa.caixa_atual)}).`);
  }
  state.caixaNegativo = negativo;

  const estourados = [];
  for (const cat of data.despesas.categorias) {
    for (const item of cat.itens) {
      if (item.pago > item.previsto) estourados.push(`${cat.nome} / ${item.item}`);
    }
  }
  const novos = estourados.filter((k) => !state.itensEstourados.includes(k));
  for (const k of novos) {
    await broadcast(state, `⚠️ ALERTA: orcamento estourado em "${k}".`);
  }
  state.itensEstourados = estourados;

  if (data.dividas.total_atrasadas > state.atrasadasTotal) {
    await broadcast(
      state,
      `⚠️ ALERTA: total de dividas atrasadas subiu para ${brl(data.dividas.total_atrasadas)}.`
    );
  }
  state.atrasadasTotal = data.dividas.total_atrasadas;

  await saveState(state);
}

async function main() {
  const state = await loadState();
  state.pending = state.pending || {};
  console.log("Bot financeiro iniciado. Aguardando comandos...");

  (async () => {
    for (;;) {
      try {
        await pollUpdates(state);
      } catch (err) {
        console.error("Erro no polling", err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  setInterval(() => {
    checkAlerts(state).catch((e) => console.error("Erro nos alertas", e));
  }, ALERT_INTERVAL_MS);
  checkAlerts(state).catch((e) => console.error("Erro nos alertas", e));
}

main();
