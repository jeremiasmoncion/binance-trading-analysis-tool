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

async function listSignalSnapshots(req) {
  const session = requireSession(req);
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${session.username}`,
    order: "created_at.desc",
    limit: "50",
  });
  return supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`);
}

async function createSignalSnapshot(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  if (!body?.coin || !body?.timeframe || !body?.signal) {
    throw new Error("Faltan datos para guardar la señal");
  }

  const signal = body.signal || {};
  const analysis = body.analysis || {};
  const plan = body.plan || {};
  const rows = await supabaseRequest(SIGNALS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      username: session.username,
      coin: String(body.coin),
      timeframe: String(body.timeframe),
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
        signal,
        analysis,
        plan,
        multiTimeframes: body.multiTimeframes || [],
      },
    },
  });
  return rows?.[0] || null;
}

async function updateSignalSnapshot(req, id) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const params = new URLSearchParams({
    id: `eq.${id}`,
    username: `eq.${session.username}`,
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

export {
  createSignalSnapshot,
  listSignalSnapshots,
  sendJson,
  updateSignalSnapshot,
};
