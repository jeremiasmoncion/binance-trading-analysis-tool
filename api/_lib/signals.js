import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SIGNALS_TABLE = process.env.SUPABASE_SIGNALS_TABLE || "signal_snapshots";

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para la memoria de señales");
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
  return response.json();
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

function buildSession(username) {
  return { username: String(username || "").trim() };
}

async function listSignalSnapshots(req) {
  const session = requireSession(req);
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${session.username}`,
    order: "created_at.desc",
    limit: "200",
  });
  return supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`);
}

async function listSignalSnapshotsForUser(username, options = {}) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: options.order || "created_at.desc",
    limit: String(options.limit || 200),
  });
  if (options.outcomeStatus) {
    params.set("outcome_status", `eq.${String(options.outcomeStatus)}`);
  }
  return supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`);
}

async function findRecentDuplicateSignal(session, body) {
  const createdAfter = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    select: "id,entry_price,setup_type,outcome_status,created_at",
    username: `eq.${session.username}`,
    coin: `eq.${String(body.coin)}`,
    timeframe: `eq.${String(body.timeframe)}`,
    signal_label: `eq.${String(body.signal?.label || "Esperar")}`,
    created_at: `gte.${createdAfter}`,
    order: "created_at.desc",
    limit: "10",
  });

  const rows = await supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`);
  const nextEntry = Number(body.plan?.entry || 0);
  const nextSetup = String(body.analysis?.setupType || "");

  return (rows || []).find((row) => {
    const rowEntry = Number(row.entry_price || 0);
    const entryGapPct =
      nextEntry > 0 && rowEntry > 0 ? Math.abs(((rowEntry - nextEntry) / nextEntry) * 100) : 0;
    return row.outcome_status === "pending"
      && String(row.setup_type || "") === nextSetup
      && entryGapPct <= 0.4;
  });
}

async function createSignalSnapshot(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  return createSignalSnapshotForUser(session.username, body);
}

async function createSignalSnapshotForUser(username, body) {
  const session = buildSession(username);
  if (!body?.coin || !body?.timeframe || !body?.signal) {
    throw new Error("Faltan datos para guardar la señal");
  }

  const duplicate = await findRecentDuplicateSignal(session, body);
  if (duplicate) {
    return duplicate;
  }

  const signal = body.signal || {};
  const analysis = body.analysis || {};
  const plan = body.plan || {};
  const strategy = body.strategy || {};
  const candidates = Array.isArray(body.strategyCandidates) ? body.strategyCandidates : [];
  const direction = String(signal.label || "Esperar").toLowerCase();
  const marketRegime =
    String(analysis.setupType || "").includes("Contra")
      ? "contra-tendencia"
      : String(analysis.higherTimeframeBias || "").toLowerCase() === "mixto"
        ? "mixto"
        : "tendencia";
  const levelContext =
    direction === "comprar"
      ? (Number(analysis.resistanceDistancePct || 0) < 1.2 ? "resistencia-cercana" : "espacio-limpio")
      : direction === "vender"
        ? (Number(analysis.supportDistancePct || 0) < 1.2 ? "soporte-cercano" : "espacio-limpio")
        : "neutral";
  const contextSignature = [
    String(analysis.setupType || "sin-setup"),
    String(analysis.setupQuality || "media"),
    String(analysis.higherTimeframeBias || "mixto"),
    String(analysis.volumeLabel || "volumen-normal"),
    String(analysis.riskLabel || "controlado"),
  ].join(" | ");
  const rows = await supabaseRequest(SIGNALS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      username: session.username,
      coin: String(body.coin),
      timeframe: String(body.timeframe),
      strategy_name: String(strategy.id || ""),
      strategy_version: String(strategy.version || ""),
      strategy_label: String(strategy.label || ""),
      signal_label: String(signal.label || "Esperar"),
      signal_score: Number(signal.score || 0),
      trend: String(signal.trend || ""),
      setup_type: String(analysis.setupType || ""),
      setup_quality: String(analysis.setupQuality || ""),
      risk_label: String(analysis.riskLabel || ""),
      support: Number(analysis.support || 0),
      resistance: Number(analysis.resistance || 0),
      entry_price: Number(plan.entry || 0),
      tp_price: Number(plan.tp || 0),
      tp2_price: Number(plan.tp2 || 0),
      sl_price: Number(plan.sl || 0),
      rr_ratio: Number(plan.rrRatio || 0),
      confirmations_count: Array.isArray(analysis.confirmations) ? analysis.confirmations.length : 0,
      warnings_count: Array.isArray(analysis.warnings) ? analysis.warnings.length : 0,
      outcome_status: "pending",
      outcome_pnl: 0,
      note: String(body.note || ""),
      signal_payload: {
        strategy,
        candidates: candidates.map((candidate) => ({
          strategy: candidate.strategy || {},
          signalLabel: String(candidate.signal?.label || ""),
          score: Number(candidate.signal?.score || 0),
          setupType: String(candidate.analysis?.setupType || ""),
          setupQuality: String(candidate.analysis?.setupQuality || ""),
          riskLabel: String(candidate.analysis?.riskLabel || ""),
          rankScore: Number(candidate.rankScore || 0),
          isPrimary: Boolean(candidate.isPrimary),
        })),
        signal,
        analysis,
        plan,
        multiTimeframes: body.multiTimeframes || [],
        context: {
          direction,
          marketRegime,
          timeframeBias: String(analysis.higherTimeframeBias || ""),
          volumeCondition: String(analysis.volumeLabel || ""),
          levelContext,
          alignmentScore: Number(analysis.alignmentPct || 0),
          contextSignature,
        },
      },
    },
  });
  return rows?.[0] || null;
}

async function updateSignalSnapshot(req, id) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  return updateSignalSnapshotForUser(session.username, id, body);
}

async function updateSignalSnapshotForUser(username, id, body) {
  const params = new URLSearchParams({
    id: `eq.${id}`,
    username: `eq.${String(username)}`,
  });

  const rows = await supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      outcome_status: String(body.outcomeStatus || "pending"),
      outcome_pnl: Number(body.outcomePnl || 0),
      note: String(body.note || ""),
    },
  });
  return rows?.[0] || null;
}

async function evaluatePendingSignalsForUser(username, priceMap, options = {}) {
  const pendingSignals = await listSignalSnapshotsForUser(username, {
    outcomeStatus: "pending",
    limit: options.limit || 200,
  });

  const updates = [];
  for (const item of pendingSignals || []) {
    const currentPrice = Number(priceMap?.[item.coin] || 0);
    if (currentPrice <= 0 || !item.entry_price) continue;

    const label = item.signal_label;
    const entry = Number(item.entry_price || 0);
    const tp = Number(item.tp_price || 0);
    const tp2 = Number(item.tp2_price || 0);
    const sl = Number(item.sl_price || 0);
    const refCapital = Number(item.signal_payload?.plan?.refCapital || 100);
    let outcomeStatus = null;
    let exitPrice = 0;

    if (label === "Comprar") {
      if (tp2 > 0 && currentPrice >= tp2) {
        outcomeStatus = "win";
        exitPrice = tp2;
      } else if (tp > 0 && currentPrice >= tp) {
        outcomeStatus = "win";
        exitPrice = tp;
      } else if (sl > 0 && currentPrice <= sl) {
        outcomeStatus = "loss";
        exitPrice = sl;
      }
    } else if (label === "Vender") {
      if (tp2 > 0 && currentPrice <= tp2) {
        outcomeStatus = "win";
        exitPrice = tp2;
      } else if (tp > 0 && currentPrice <= tp) {
        outcomeStatus = "win";
        exitPrice = tp;
      } else if (sl > 0 && currentPrice >= sl) {
        outcomeStatus = "loss";
        exitPrice = sl;
      }
    }

    if (!outcomeStatus || exitPrice <= 0) continue;

    const pnlPct = label === "Vender"
      ? ((entry - exitPrice) / entry) * 100
      : ((exitPrice - entry) / entry) * 100;
    const outcomePnl = Number(((refCapital * pnlPct) / 100).toFixed(4));
    const previousNote = item.note ? `${item.note} · ` : "";
    const notePrefix = options.notePrefix || "Auto-cerrada por el vigilante";
    const autoNote = `${previousNote}${notePrefix} el ${new Date().toLocaleString("es-DO")} a ${exitPrice.toFixed(6)}`;

    updates.push(updateSignalSnapshotForUser(username, item.id, {
      outcomeStatus,
      outcomePnl,
      note: autoNote,
    }));
  }

  if (!updates.length) return [];
  return Promise.all(updates);
}

export {
  createSignalSnapshot,
  createSignalSnapshotForUser,
  evaluatePendingSignalsForUser,
  listSignalSnapshots,
  listSignalSnapshotsForUser,
  sendJson,
  updateSignalSnapshot,
  updateSignalSnapshotForUser,
};
