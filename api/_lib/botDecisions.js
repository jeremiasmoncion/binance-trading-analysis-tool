import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BOT_DECISIONS_TABLE = process.env.SUPABASE_BOT_DECISIONS_TABLE || "bot_decisions";

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para las decisiones de bots");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${details || "sin detalles"}`);
  }

  if (response.status === 204) return null;
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeDecisionPayload(value) {
  const source = value && typeof value === "object" ? value : {};
  const createdAt = source.createdAt || nowIso();
  return {
    id: String(source.id || source.decisionId || `decision-${Date.now()}`),
    botId: String(source.botId || ""),
    signalSnapshotId: source.signalSnapshotId == null ? null : Number(source.signalSnapshotId),
    symbol: String(source.symbol || source.metadata?.symbol || ""),
    timeframe: String(source.timeframe || source.metadata?.timeframe || ""),
    signalLayer: String(source.signalLayer || "observational"),
    action: String(source.action || "observe"),
    status: String(source.status || "pending"),
    source: String(source.source || "signal-core"),
    rationale: String(source.rationale || ""),
    executionEnvironment: String(source.executionEnvironment || "paper"),
    automationMode: String(source.automationMode || "observe"),
    marketContextSignature: source.marketContextSignature == null ? null : String(source.marketContextSignature),
    contextTags: normalizeArray(source.contextTags),
    metadata: source.metadata && typeof source.metadata === "object" ? source.metadata : {},
    createdAt,
    updatedAt: source.updatedAt || createdAt,
  };
}

function rowToDecision(row) {
  return normalizeDecisionPayload({
    ...(row?.decision_payload && typeof row.decision_payload === "object" ? row.decision_payload : {}),
    id: row?.decision_id,
    botId: row?.bot_id,
    signalSnapshotId: row?.signal_snapshot_id,
    symbol: row?.symbol,
    timeframe: row?.timeframe,
    signalLayer: row?.signal_layer,
    action: row?.action,
    status: row?.status,
    source: row?.source,
    marketContextSignature: row?.market_context_signature,
    createdAt: row?.created_at,
    updatedAt: row?.updated_at,
  });
}

function decisionToRow(username, decision) {
  const normalized = normalizeDecisionPayload(decision);
  return {
    username: String(username || "").trim(),
    decision_id: normalized.id,
    bot_id: normalized.botId,
    signal_snapshot_id: normalized.signalSnapshotId,
    symbol: normalized.symbol,
    timeframe: normalized.timeframe,
    signal_layer: normalized.signalLayer,
    action: normalized.action,
    status: normalized.status,
    source: normalized.source,
    market_context_signature: normalized.marketContextSignature,
    decision_payload: normalized,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

async function listBotDecisions(req) {
  const session = requireSession(req);
  const botId = typeof req.query?.botId === "string" ? req.query.botId : "";
  const limit = Number(req.query?.limit || 200);
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${session.username}`,
    order: "created_at.desc",
    limit: String(Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 200),
  });
  if (botId) {
    params.set("bot_id", `eq.${botId}`);
  }

  const rows = (await supabaseRequest(`${BOT_DECISIONS_TABLE}?${params.toString()}`)) || [];
  return {
    decisions: rows.map(rowToDecision),
    lastHydratedAt: nowIso(),
  };
}

async function createBotDecision(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const decision = normalizeDecisionPayload(body);
  if (!decision.botId) {
    throw new Error("La decisión necesita un botId");
  }

  const params = new URLSearchParams({
    select: "*",
    username: `eq.${session.username}`,
    bot_id: `eq.${decision.botId}`,
    decision_id: `eq.${decision.id}`,
    limit: "1",
  });
  const existingRows = await supabaseRequest(`${BOT_DECISIONS_TABLE}?${params.toString()}`);
  if (existingRows?.[0]) {
    return { decision: rowToDecision(existingRows[0]) };
  }

  const rows = await supabaseRequest(BOT_DECISIONS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [decisionToRow(session.username, decision)],
  });

  return {
    decision: rowToDecision(rows?.[0] || decisionToRow(session.username, decision)),
  };
}

async function updateBotDecision(req, decisionId) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const findParams = new URLSearchParams({
    select: "*",
    username: `eq.${session.username}`,
    decision_id: `eq.${String(decisionId)}`,
    limit: "1",
  });
  const existingRows = await supabaseRequest(`${BOT_DECISIONS_TABLE}?${findParams.toString()}`);
  const existingRow = existingRows?.[0];
  if (!existingRow) {
    throw new Error("No se encontró la decisión solicitada");
  }

  const existing = rowToDecision(existingRow);
  const nextDecision = normalizeDecisionPayload({
    ...existing,
    ...body,
    metadata: body?.metadata ? { ...existing.metadata, ...body.metadata } : existing.metadata,
    contextTags: body?.contextTags ?? existing.contextTags,
    updatedAt: nowIso(),
  });

  const updateParams = new URLSearchParams({
    username: `eq.${session.username}`,
    decision_id: `eq.${String(decisionId)}`,
  });
  const rows = await supabaseRequest(`${BOT_DECISIONS_TABLE}?${updateParams.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: decisionToRow(session.username, nextDecision),
  });

  return {
    decision: rowToDecision(rows?.[0] || decisionToRow(session.username, nextDecision)),
  };
}

export {
  createBotDecision,
  listBotDecisions,
  sendJson,
  updateBotDecision,
};
