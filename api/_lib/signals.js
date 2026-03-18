import { getSession, parseJsonBody, sendJson } from "./auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SIGNALS_TABLE = process.env.SUPABASE_SIGNALS_TABLE || "signal_snapshots";
const SIGNAL_FEATURE_SNAPSHOTS_TABLE = process.env.SUPABASE_SIGNAL_FEATURE_SNAPSHOTS_TABLE || "signal_feature_snapshots";

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
    select: String(options.select || "*"),
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
  const decision = body.decision && typeof body.decision === "object" ? body.decision : null;
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
          decisionSource: String(candidate.decisionSource || ""),
          experimentId: candidate.experimentId ?? null,
          executionEligible: Boolean(candidate.executionEligible),
        })),
        signal,
        analysis,
        plan,
        multiTimeframes: body.multiTimeframes || [],
        decision,
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
  const existingRows = await supabaseRequest(
    `${SIGNALS_TABLE}?id=eq.${id}&username=eq.${String(username)}&select=*&limit=1`,
  );
  const existing = existingRows?.[0] || null;
  const nextPayload = body.signalPayloadMerge && typeof body.signalPayloadMerge === "object"
    ? {
      ...(existing?.signal_payload && typeof existing.signal_payload === "object" ? existing.signal_payload : {}),
      ...body.signalPayloadMerge,
    }
    : undefined;
  const nextOutcomeStatus = body.outcomeStatus == null ? String(existing?.outcome_status || "pending") : String(body.outcomeStatus || "pending");
  const nextOutcomePnl = body.outcomePnl == null ? Number(existing?.outcome_pnl || 0) : Number(body.outcomePnl || 0);
  const nextNote = body.note == null ? String(existing?.note || "") : String(body.note || "");

  const params = new URLSearchParams({
    id: `eq.${id}`,
    username: `eq.${String(username)}`,
  });

  const rows = await supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      outcome_status: nextOutcomeStatus,
      outcome_pnl: nextOutcomePnl,
      note: nextNote,
      ...(nextPayload ? { signal_payload: nextPayload } : {}),
    },
  });
  const nextSignal = rows?.[0] || null;
  if (nextSignal && nextOutcomeStatus !== "pending") {
    await upsertSignalFeatureSnapshotForUser(username, nextSignal).catch(() => null);
  }
  return nextSignal;
}

async function updateSignalExecutionLink(username, id, body) {
  const params = new URLSearchParams({
    id: `eq.${id}`,
    username: `eq.${String(username)}`,
  });

  const rows = await supabaseRequest(`${SIGNALS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      execution_order_id: body.executionOrderId ?? null,
      execution_status: body.executionStatus || null,
      execution_mode: body.executionMode || null,
      execution_updated_at: body.executionUpdatedAt || new Date().toISOString(),
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

function buildSignalFeatureSnapshotRow(username, signal, existingRow = null) {
  const payload = signal?.signal_payload && typeof signal.signal_payload === "object" ? signal.signal_payload : {};
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const decision = payload.decision && typeof payload.decision === "object" ? payload.decision : {};
  const learning = payload.executionLearning && typeof payload.executionLearning === "object" ? payload.executionLearning : {};
  return {
    username: String(username),
    signal_snapshot_id: Number(signal?.id || 0) || null,
    execution_order_id: signal?.execution_order_id == null ? null : Number(signal.execution_order_id),
    coin: String(signal?.coin || ""),
    timeframe: String(signal?.timeframe || ""),
    strategy_id: String(signal?.strategy_name || decision.primaryStrategy?.id || ""),
    strategy_version: String(signal?.strategy_version || decision.primaryStrategy?.version || ""),
    direction: String(learning.direction || context.direction || ""),
    market_regime: String(learning.marketRegime || context.marketRegime || ""),
    timeframe_bias: String(learning.timeframeBias || context.timeframeBias || ""),
    volume_condition: String(learning.volumeCondition || context.volumeCondition || ""),
    level_context: String(learning.levelContext || context.levelContext || ""),
    context_signature: String(learning.contextSignature || context.contextSignature || ""),
    setup_type: String(signal?.setup_type || payload.analysis?.setupType || ""),
    setup_quality: String(signal?.setup_quality || payload.analysis?.setupQuality || ""),
    risk_label: String(signal?.risk_label || payload.analysis?.riskLabel || ""),
    signal_score: signal?.signal_score == null ? null : Number(signal.signal_score),
    adaptive_score: decision.adaptiveScore == null ? null : Number(decision.adaptiveScore),
    scorer_confidence: decision.scorer?.confidence == null ? null : Number(decision.scorer.confidence),
    rr_ratio: signal?.rr_ratio == null ? null : Number(signal.rr_ratio),
    notional_usd: learning.notionalUsd == null ? null : Number(learning.notionalUsd),
    realized_pnl: signal?.outcome_pnl == null ? (learning.realizedPnl == null ? null : Number(learning.realizedPnl)) : Number(signal.outcome_pnl),
    pnl_pct_on_notional: learning.pnlPctOnNotional == null ? null : Number(learning.pnlPctOnNotional),
    duration_minutes: learning.durationMinutes == null ? null : Number(learning.durationMinutes),
    protection_status: String(learning.protectionStatus || signal?.execution_status || existingRow?.protection_status || ""),
    protection_retries: learning.protectionRetries == null ? null : Number(learning.protectionRetries),
    execution_mode: String(learning.mode || signal?.execution_mode || ""),
    lifecycle_status: String(learning.lifecycleStatus || signal?.outcome_status || ""),
    decision_source: String(learning.decisionSource || decision.source || ""),
    decision_eligible: typeof learning.decisionEligible === "boolean"
      ? learning.decisionEligible
      : (typeof decision.executionEligible === "boolean" ? decision.executionEligible : null),
    entry_to_tp_pct: learning.entryToTpPct == null ? null : Number(learning.entryToTpPct),
    entry_to_sl_pct: learning.entryToSlPct == null ? null : Number(learning.entryToSlPct),
    feature_payload: {
      ...(existingRow?.feature_payload && typeof existingRow.feature_payload === "object" ? existingRow.feature_payload : {}),
      ...(learning && typeof learning === "object" ? learning : {}),
      source: learning?.source || "signal-memory",
      outcomeStatus: String(signal?.outcome_status || ""),
      outcomePnl: Number(signal?.outcome_pnl || 0),
      strategyLabel: String(signal?.strategy_label || ""),
    },
  };
}

async function upsertSignalFeatureSnapshotForUser(username, signal) {
  if (!signal?.id || !signal?.outcome_status || signal.outcome_status === "pending") return null;
  try {
    const params = new URLSearchParams({
      select: "*",
      signal_snapshot_id: `eq.${Number(signal.id)}`,
      order: "created_at.desc",
      limit: "1",
    });
    const existingRows = await supabaseRequest(`${SIGNAL_FEATURE_SNAPSHOTS_TABLE}?${params.toString()}`).catch(() => []);
    const existing = existingRows?.[0] || null;
    const row = buildSignalFeatureSnapshotRow(username, signal, existing);
    if (existing?.id) {
      const patchParams = new URLSearchParams({ id: `eq.${Number(existing.id)}` });
      const rows = await supabaseRequest(`${SIGNAL_FEATURE_SNAPSHOTS_TABLE}?${patchParams.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: row,
      });
      return rows?.[0] || existing;
    }
    const rows = await supabaseRequest(SIGNAL_FEATURE_SNAPSHOTS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [row],
    });
    return rows?.[0] || null;
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
    if (message.includes("42p01") || message.includes("relation") || message.includes("does not exist")) return null;
    throw error;
  }
}

async function backfillSignalLearningDatasetForUser(username, options = {}) {
  const signals = await listSignalSnapshotsForUser(username, {
    limit: options.limit || 400,
    order: "created_at.desc",
  }).catch(() => []);
  const closedSignals = (signals || []).filter((item) => item?.outcome_status && item.outcome_status !== "pending");
  let executionLearningBackfilled = 0;
  let featureSnapshotsBackfilled = 0;

  for (const signal of closedSignals) {
    const payload = signal.signal_payload && typeof signal.signal_payload === "object" ? signal.signal_payload : {};
    const hasExecutionLearning = payload.executionLearning && typeof payload.executionLearning === "object";
    if (!hasExecutionLearning) {
      const fallbackLearning = {
        source: "historical-backfill",
        updatedAt: new Date().toISOString(),
        timeframe: String(signal.timeframe || ""),
        coin: String(signal.coin || ""),
        direction: String(payload.context?.direction || ""),
        marketRegime: String(payload.context?.marketRegime || ""),
        timeframeBias: String(payload.context?.timeframeBias || ""),
        volumeCondition: String(payload.context?.volumeCondition || ""),
        levelContext: String(payload.context?.levelContext || ""),
        contextSignature: String(payload.context?.contextSignature || ""),
        decisionSource: String(payload.decision?.source || ""),
        decisionEligible: typeof payload.decision?.executionEligible === "boolean" ? payload.decision.executionEligible : null,
        primaryStrategyId: String(payload.decision?.primaryStrategy?.id || signal.strategy_name || ""),
        primaryStrategyVersion: String(payload.decision?.primaryStrategy?.version || signal.strategy_version || ""),
        rrRatio: signal.rr_ratio == null ? null : Number(signal.rr_ratio),
        score: signal.signal_score == null ? null : Number(signal.signal_score),
        realizedPnl: signal.outcome_pnl == null ? null : Number(signal.outcome_pnl),
        lifecycleStatus: String(signal.outcome_status || ""),
      };
      const patched = await updateSignalSnapshotForUser(username, signal.id, {
        signalPayloadMerge: { executionLearning: fallbackLearning },
      }).catch(() => null);
      if (patched) {
        signal.signal_payload = patched.signal_payload;
        executionLearningBackfilled += 1;
      }
    }
    const persisted = await upsertSignalFeatureSnapshotForUser(username, signal).catch(() => null);
    if (persisted) featureSnapshotsBackfilled += 1;
  }

  return {
    scannedClosedSignals: closedSignals.length,
    executionLearningBackfilled,
    featureSnapshotsBackfilled,
  };
}

export {
  backfillSignalLearningDatasetForUser,
  createSignalSnapshot,
  createSignalSnapshotForUser,
  evaluatePendingSignalsForUser,
  listSignalSnapshots,
  listSignalSnapshotsForUser,
  sendJson,
  upsertSignalFeatureSnapshotForUser,
  updateSignalExecutionLink,
  updateSignalSnapshot,
  updateSignalSnapshotForUser,
};
