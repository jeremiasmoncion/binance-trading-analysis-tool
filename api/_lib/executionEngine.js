import { parseJsonBody } from "./auth.js";
import { listBotDecisionsForUser } from "./botDecisions.js";
import { listBotIdsForUser } from "./bots.js";
import {
  fetchBinancePublic,
  fetchBinanceSigned,
  getCredentialsForSession,
  getCredentialsForUsername,
  getPortfolioSnapshotForUsername,
  sendJson,
} from "./binance.js";
import {
  listSignalSnapshotsByIdsForUser,
  listSignalSnapshotsForUser,
  updateSignalExecutionLink,
  updateSignalExecutionStateForUser,
  updateSignalSnapshotForUser,
  upsertSignalFeatureSnapshotForUser,
} from "./signals.js";
import { generateAdaptiveRecommendationsForUser } from "./strategyEngine.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EXECUTION_PROFILES_TABLE = process.env.SUPABASE_EXECUTION_PROFILES_TABLE || "execution_profiles";
const EXECUTION_ORDERS_TABLE = process.env.SUPABASE_EXECUTION_ORDERS_TABLE || "execution_orders";
const EXECUTION_SCOPE_OVERRIDES_TABLE = process.env.SUPABASE_EXECUTION_SCOPE_OVERRIDES_TABLE || "execution_scope_overrides";
const AUTO_PROTECTION_RETRY_LIMIT = 3;
const AUTO_PROTECTION_RETRY_COOLDOWN_MS = 3 * 60 * 1000;

const DEFAULT_PROFILE = {
  enabled: true,
  autoExecuteEnabled: false,
  riskPerTradePct: 5,
  maxOpenPositions: 2,
  maxPositionUsd: 150,
  maxDailyLossPct: 3,
  minSignalScore: 60,
  minRrRatio: 1.5,
  maxDailyAutoExecutions: 3,
  cooldownAfterLosses: 2,
  allowedStrategies: ["trend-alignment", "breakout"],
  allowedTimeframes: ["15m", "1h", "4h"],
  note: "Perfil base para ejecutar Demo con control humano.",
};

const PROFILE_METADATA_PREFIX = "__CRYPE_EXECUTION_PROFILE__:";

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para el motor de ejecución");
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

function isMissingRelationError(error) {
  const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
  return message.includes("42p01") || message.includes("does not exist") || message.includes("relation");
}

function roundDown(value, step) {
  if (!step || step <= 0) return Number(value || 0);
  const rounded = Math.floor(Number(value || 0) / step) * step;
  return Number(rounded.toFixed(8));
}

function roundUp(value, step) {
  if (!step || step <= 0) return Number(value || 0);
  const rounded = Math.ceil(Number(value || 0) / step) * step;
  return Number(rounded.toFixed(8));
}

function getBaseAsset(coin) {
  return String(coin || "").replace("/USDT", "");
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseProfileNoteEnvelope(rawNote) {
  const noteValue = String(rawNote || "");
  if (!noteValue.startsWith(PROFILE_METADATA_PREFIX)) {
    return {
      note: noteValue,
      scopeOverrides: [],
      scorerPolicy: null,
    };
  }

  try {
    const parsed = JSON.parse(noteValue.slice(PROFILE_METADATA_PREFIX.length));
    return {
      note: String(parsed?.note || ""),
      scopeOverrides: Array.isArray(parsed?.scopeOverrides)
        ? parsed.scopeOverrides
          .map((item) => ({
            id: String(item?.id || `${item?.strategyId || "scope"}-${item?.timeframe || "all"}`),
            strategyId: String(item?.strategyId || ""),
            timeframe: String(item?.timeframe || ""),
            enabled: item?.enabled !== false,
            action: String(item?.action || ""),
            minSignalScore: item?.minSignalScore == null ? undefined : Number(item.minSignalScore),
            minRrRatio: item?.minRrRatio == null ? undefined : Number(item.minRrRatio),
            note: String(item?.note || ""),
          }))
          .filter((item) => item.strategyId && item.timeframe)
        : [],
      scorerPolicy: parsed?.scorerPolicy && typeof parsed.scorerPolicy === "object"
        ? {
          activeScorer: parsed.scorerPolicy.activeScorer ? String(parsed.scorerPolicy.activeScorer) : undefined,
          promotedAt: parsed.scorerPolicy.promotedAt ? String(parsed.scorerPolicy.promotedAt) : undefined,
          source: parsed.scorerPolicy.source ? String(parsed.scorerPolicy.source) : undefined,
          confidence: parsed.scorerPolicy.confidence == null ? undefined : Number(parsed.scorerPolicy.confidence),
        }
        : null,
    };
  } catch {
    return {
      note: noteValue,
      scopeOverrides: [],
      scorerPolicy: null,
    };
  }
}

function buildProfileNoteEnvelope(profile) {
  const note = String(profile.note || DEFAULT_PROFILE.note);
  const scopeOverrides = Array.isArray(profile.scopeOverrides) ? profile.scopeOverrides : [];
  const scorerPolicy = profile.scorerPolicy && typeof profile.scorerPolicy === "object"
    ? {
      activeScorer: profile.scorerPolicy.activeScorer ? String(profile.scorerPolicy.activeScorer) : undefined,
      promotedAt: profile.scorerPolicy.promotedAt ? String(profile.scorerPolicy.promotedAt) : undefined,
      source: profile.scorerPolicy.source ? String(profile.scorerPolicy.source) : undefined,
      confidence: profile.scorerPolicy.confidence == null ? undefined : Number(profile.scorerPolicy.confidence),
    }
    : null;
  return `${PROFILE_METADATA_PREFIX}${JSON.stringify({
    note,
    scopeOverrides: scopeOverrides.map((item) => ({
      id: String(item.id || `${item.strategyId || "scope"}-${item.timeframe || "all"}`),
      strategyId: String(item.strategyId || ""),
      timeframe: String(item.timeframe || ""),
      enabled: item.enabled !== false,
      action: String(item.action || ""),
      minSignalScore: item.minSignalScore == null ? undefined : Number(item.minSignalScore),
      minRrRatio: item.minRrRatio == null ? undefined : Number(item.minRrRatio),
      note: String(item.note || ""),
    })),
    scorerPolicy,
  })}`;
}

function normalizeProfile(row, username) {
  const parsedNote = parseProfileNoteEnvelope(row?.note);
  return {
    username,
    enabled: row?.enabled ?? DEFAULT_PROFILE.enabled,
    autoExecuteEnabled: row?.auto_execute_enabled ?? DEFAULT_PROFILE.autoExecuteEnabled,
    riskPerTradePct: Number(row?.risk_per_trade_pct ?? DEFAULT_PROFILE.riskPerTradePct),
    maxOpenPositions: Number(row?.max_open_positions ?? DEFAULT_PROFILE.maxOpenPositions),
    maxPositionUsd: Number(row?.max_position_usd ?? DEFAULT_PROFILE.maxPositionUsd),
    maxDailyLossPct: Number(row?.max_daily_loss_pct ?? DEFAULT_PROFILE.maxDailyLossPct),
    minSignalScore: Number(row?.min_signal_score ?? DEFAULT_PROFILE.minSignalScore),
    minRrRatio: Number(row?.min_rr_ratio ?? DEFAULT_PROFILE.minRrRatio),
    maxDailyAutoExecutions: Number(row?.max_daily_auto_executions ?? DEFAULT_PROFILE.maxDailyAutoExecutions),
    cooldownAfterLosses: Number(row?.cooldown_after_losses ?? DEFAULT_PROFILE.cooldownAfterLosses),
    allowedStrategies: normalizeArray(row?.allowed_strategies).length ? normalizeArray(row?.allowed_strategies) : DEFAULT_PROFILE.allowedStrategies,
    allowedTimeframes: normalizeArray(row?.allowed_timeframes).length ? normalizeArray(row?.allowed_timeframes) : DEFAULT_PROFILE.allowedTimeframes,
    scopeOverrides: parsedNote.scopeOverrides,
    scorerPolicy: parsedNote.scorerPolicy || null,
    note: parsedNote.note || DEFAULT_PROFILE.note,
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

function getScopeOverride(profile, signal) {
  const strategyId = String(signal.strategy_name || "");
  const timeframe = String(signal.timeframe || "");
  return (profile.scopeOverrides || []).find((item) => item.strategyId === strategyId && item.timeframe === timeframe) || null;
}

function getEffectiveProfileForSignal(profile, signal) {
  const override = getScopeOverride(profile, signal);
  return {
    override,
    minSignalScore: override?.enabled !== false && override?.minSignalScore != null
      ? Number(override.minSignalScore)
      : profile.minSignalScore,
    minRrRatio: override?.enabled !== false && override?.minRrRatio != null
      ? Number(override.minRrRatio)
      : profile.minRrRatio,
  };
}

function normalizeSignalEdgeContext(signal) {
  const payload = signal?.signal_payload && typeof signal.signal_payload === "object"
    ? signal.signal_payload
    : {};
  const analysis = payload.analysis && typeof payload.analysis === "object" ? payload.analysis : {};
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const decision = payload.decision && typeof payload.decision === "object" ? payload.decision : {};
  const scorer = decision.scorer && typeof decision.scorer === "object" ? decision.scorer : {};
  const contextBias = decision.contextBias && typeof decision.contextBias === "object" ? decision.contextBias : {};
  const featureModel = decision.featureModel && typeof decision.featureModel === "object" ? decision.featureModel : {};
  const effectiveScore = Number.isFinite(Number(decision.adaptiveScore))
    ? Number(decision.adaptiveScore)
    : Number(signal?.signal_score || 0);
  return {
    analysis,
    context,
    decision,
    scorer,
    contextBias,
    featureModel,
    effectiveScore,
    setupQuality: String(analysis.setupQuality || ""),
    riskLabel: String(analysis.riskLabel || ""),
    alignmentCount: Number(analysis.alignmentCount || 0),
    marketRegime: String(context.marketRegime || ""),
    volumeCondition: String(context.volumeCondition || ""),
  };
}

function evaluateSignalEdgeSafety(signal, profile, options = {}) {
  const mode = options.autoExecution ? "auto" : options.manualExecution ? "manual" : "demo";
  const thresholds = getEffectiveProfileForSignal(profile, signal);
  const edge = normalizeSignalEdgeContext(signal);
  const reasons = [];
  const applyAdaptiveExecutionGuards = mode !== "manual";
  const minScoreMargin = mode === "auto" ? 8 : 3;
  const minRrMargin = mode === "auto" ? 0.35 : 0.1;
  const scorerConfidence = Number(edge.scorer.confidence || 0);
  const contextSample = Number(edge.contextBias.sampleSize || 0);
  const contextAvgPnl = Number(edge.contextBias.avgPnl || 0);
  const contextWinRate = Number(edge.contextBias.winRate || 0);
  const featureSample = Number(edge.featureModel.sampleSize || 0);
  const featureAvgPnl = Number(edge.featureModel.avgPnl || 0);
  const featureWinRate = Number(edge.featureModel.winRate || 0);
  const featureConfidence = Number(edge.featureModel.preferredModelConfidence || edge.featureModel.confidence || 0);
  const scopeAction = String(edge.scorer.scopeAction || "");
  const decisionSource = String(edge.decision.source || "");
  const weakVolume = edge.volumeCondition.toLowerCase().includes("debil") || edge.volumeCondition.toLowerCase().includes("débil");
  const mixedRegime = edge.marketRegime.toLowerCase() === "mixto";
  const rrRatio = Number(signal?.rr_ratio || 0);

  if (applyAdaptiveExecutionGuards && edge.decision && edge.decision.executionEligible === false) {
    reasons.push(String(edge.decision.executionReason || "La IA dejó esta señal fuera del flujo operativo actual."));
  }

  if (applyAdaptiveExecutionGuards && scopeAction === "cut") {
    reasons.push("El scope quedó cortado por el motor adaptativo.");
  }

  if (applyAdaptiveExecutionGuards && scorerConfidence > 0 && scorerConfidence < (mode === "auto" ? 68 : 54)) {
    reasons.push(`La confianza del scorer (${scorerConfidence.toFixed(0)}%) todavía es baja para ${mode === "auto" ? "autoejecutar" : "pasar a demo"}.`);
  }

  if (applyAdaptiveExecutionGuards && edge.effectiveScore < Number(thresholds.minSignalScore || 0) + minScoreMargin) {
    reasons.push(`La convicción efectiva (${edge.effectiveScore.toFixed(1)}) no supera con margen el mínimo ${Number(thresholds.minSignalScore || 0).toFixed(1)}.`);
  }

  if (applyAdaptiveExecutionGuards && rrRatio > 0 && rrRatio < Number(thresholds.minRrRatio || 0) + minRrMargin) {
    reasons.push(`El RR (${rrRatio.toFixed(2)}) todavía está muy justo frente al mínimo ${Number(thresholds.minRrRatio || 0).toFixed(2)}.`);
  }

  if (applyAdaptiveExecutionGuards && scopeAction === "tighten" && edge.effectiveScore < Number(thresholds.minSignalScore || 0) + (mode === "auto" ? 12 : 6)) {
    reasons.push("Este scope está endurecido y la señal no trae suficiente colchón para justificar la entrada.");
  }

  if (applyAdaptiveExecutionGuards && featureSample >= 8 && featureAvgPnl < 0) {
    reasons.push(`El scope histórico viene perdiendo (${featureAvgPnl >= 0 ? "+" : ""}${featureAvgPnl.toFixed(2)} avg pnl en ${featureSample} cierres).`);
  }

  if (applyAdaptiveExecutionGuards && featureSample >= 10 && featureWinRate > 0 && featureWinRate < 46) {
    reasons.push(`El scope histórico sigue con acierto flojo (${featureWinRate.toFixed(0)}% en ${featureSample} cierres).`);
  }

  if (mode === "auto") {
    if (!["experiment-active", "promoted", "active"].includes(decisionSource)) {
      reasons.push("La autoejecución solo entra en señales que ya vienen del flujo operativo activo del motor.");
    }
    if (String(signal?.timeframe || "") === "5m") {
      reasons.push("La autoejecución 24/7 ya no entra en 5m para reducir ruido.");
    }
    if (edge.setupQuality !== "Alta") {
      reasons.push("La autoejecución solo deja pasar setups de calidad Alta.");
    }
    if (edge.alignmentCount < 4) {
      reasons.push("La autoejecución exige al menos 4 alineaciones reales.");
    }
    if (mixedRegime) {
      reasons.push("La autoejecución evita mercados mixtos hasta que el edge sea más claro.");
    }
    if (weakVolume) {
      reasons.push("La autoejecución evita volumen débil para no gastar intentos en rupturas flojas.");
    }
    if (edge.riskLabel.toLowerCase().includes("alto")) {
      reasons.push("La autoejecución no entra en setups marcados como riesgo alto.");
    }
    if (featureConfidence > 0 && featureConfidence < 64) {
      reasons.push(`El modelo todavía no trae suficiente confianza operativa para este scope (${featureConfidence.toFixed(0)}%).`);
    }
    if (edge.scorer.candidateReady && Number(edge.scorer.candidateDelta || 0) >= 6) {
      reasons.push("La autoejecución evita scopes donde el scorer activo todavía está siendo retado por un challenger listo.");
    }
  } else if (mode === "demo") {
    if (mixedRegime && weakVolume) {
      reasons.push("La señal llega con mercado mixto y volumen débil: combinación demasiado frágil para demo.");
    }
    if (decisionSource === "fallback" && featureSample >= 8 && featureAvgPnl < 0) {
      reasons.push("La señal quedó fuera del flujo preferido y el histórico del scope tampoco acompaña.");
    }
  }

  if (applyAdaptiveExecutionGuards && contextSample >= 5 && (contextAvgPnl < 0 || contextWinRate < 45)) {
    reasons.push(`El contexto equivalente viene flojo (${contextWinRate.toFixed(0)}% win rate, ${contextAvgPnl >= 0 ? "+" : ""}${contextAvgPnl.toFixed(2)} avg pnl).`);
  }

  return {
    reasons,
    effectiveProfile: thresholds,
    edge,
  };
}

function isExecutionOpenStatus(status) {
  return ["placed", "filled", "protected", "filled_unprotected", "open"].includes(String(status || ""));
}

function getExecutionWindowStart(hours = 24) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function buildRecentLossStreak(executionOrders) {
  const closedOrders = (executionOrders || [])
    .filter((item) => String(item.mode || "") === "execute")
    .filter((item) => String(item.lifecycle_status || "").startsWith("closed_"))
    .sort((a, b) => new Date(b.closed_at || b.last_synced_at || b.created_at).getTime() - new Date(a.closed_at || a.last_synced_at || a.created_at).getTime());

  let streak = 0;
  for (const order of closedOrders) {
    if (order.lifecycle_status === "closed_loss") {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function buildDailyAutoExecutions(executionOrders) {
  const minDate = getExecutionWindowStart(24);
  return (executionOrders || []).filter((item) => {
    if (item.origin !== "watcher") return false;
    if (item.mode !== "execute") return false;
    if (!["placed", "filled", "protected", "filled_unprotected", "closed_win", "closed_loss", "closed_invalidated"].includes(String(item.lifecycle_status || ""))) {
      return false;
    }
    return new Date(item.created_at).getTime() >= minDate;
  }).length;
}

function minutesBetween(startAt, endAt) {
  const startMs = new Date(startAt || 0).getTime();
  const endMs = new Date(endAt || 0).getTime();
  if (!startMs || !endMs || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

function buildExecutionLearningSnapshot({ signal, record, lifecycleStatus, protectionStatus, realizedPnl, closedAt }) {
  const payload = signal?.signal_payload && typeof signal.signal_payload === "object" ? signal.signal_payload : {};
  const plan = payload.plan && typeof payload.plan === "object" ? payload.plan : {};
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const decision = payload.decision && typeof payload.decision === "object" ? payload.decision : {};
  const entry = Number(signal?.entry_price || plan.entry || record?.current_price || 0);
  const tp = Number(signal?.tp_price || plan.tp || 0);
  const sl = Number(signal?.sl_price || plan.sl || 0);
  const rrRatio = Number(signal?.rr_ratio || plan.rrRatio || 0);
  const notionalUsd = Number(record?.notional_usd || record?.response_payload?.candidate?.notionalUsd || 0);
  const durationMinutes = closedAt ? minutesBetween(record?.created_at || signal?.created_at, closedAt) : 0;
  const pnlPctOnNotional = notionalUsd > 0 ? Number(((Number(realizedPnl || 0) / notionalUsd) * 100).toFixed(4)) : 0;
  const entryToTpPct = entry > 0 && tp > 0 ? Number((((tp - entry) / entry) * 100).toFixed(4)) : 0;
  const entryToSlPct = entry > 0 && sl > 0 ? Number((((entry - sl) / entry) * 100).toFixed(4)) : 0;
  const protection = getProtectionPayload(record?.response_payload);
  const retryState = getProtectionRetryState(record?.response_payload);

  return {
    updatedAt: new Date().toISOString(),
    origin: String(record?.origin || record?.response_payload?.origin || ""),
    mode: String(record?.mode || ""),
    lifecycleStatus: String(lifecycleStatus || record?.lifecycle_status || ""),
    protectionStatus: String(protectionStatus || record?.protection_status || ""),
    protectionMode: String(protection?.protectionMode || ""),
    protectionAttached: Boolean(protection?.protectionAttached),
    protectionRetries: Number(retryState.attempts || 0),
    orderSide: String(record?.side || ""),
    notionalUsd,
    quantity: Number(record?.quantity || 0),
    realizedPnl: Number(realizedPnl || 0),
    pnlPctOnNotional,
    durationMinutes,
    closeDetectedAt: closedAt || null,
    rrRatio,
    score: Number(signal?.signal_score || payload?.signal?.score || 0),
    direction: String(context.direction || ""),
    marketRegime: String(context.marketRegime || ""),
    timeframeBias: String(context.timeframeBias || ""),
    volumeCondition: String(context.volumeCondition || ""),
    levelContext: String(context.levelContext || ""),
    alignmentScore: Number(context.alignmentScore || 0),
    contextSignature: String(context.contextSignature || ""),
    decisionSource: String(decision.source || ""),
    decisionEligible: Boolean(decision.executionEligible),
    primaryStrategyId: String(decision.primaryStrategy?.id || signal?.strategy_name || ""),
    primaryStrategyVersion: String(decision.primaryStrategy?.version || signal?.strategy_version || ""),
    timeframe: String(signal?.timeframe || record?.timeframe || ""),
    coin: String(signal?.coin || record?.coin || ""),
    entryToTpPct,
    entryToSlPct,
  };
}

function getProtectionPayload(responsePayload) {
  if (!responsePayload || typeof responsePayload !== "object") return null;
  return "protection" in responsePayload ? responsePayload.protection || null : null;
}

function getProtectionRetryState(responsePayload) {
  if (!responsePayload || typeof responsePayload !== "object") return {};
  if (!("protectionRetryState" in responsePayload)) return {};
  const state = responsePayload.protectionRetryState;
  if (!state || typeof state !== "object") return {};
  return state;
}

function getExecutionOriginLabel(record) {
  if (record.origin === "watcher") return "Auto por vigilante";
  if (record.signal_id) return "Desde señales";
  return "Manual usuario";
}

function normalizeExecutionSideValue(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "BUY" || normalized === "SELL" ? normalized : "";
}

function getSignalExecutionSide(signal) {
  const payload = signal?.signal_payload && typeof signal.signal_payload === "object" ? signal.signal_payload : {};
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};
  const executionLearning = payload.executionLearning && typeof payload.executionLearning === "object"
    ? payload.executionLearning
    : {};
  return (
    normalizeExecutionSideValue(executionLearning.orderSide)
    || normalizeExecutionSideValue(context.direction)
    || (String(signal?.signal_label || "") === "Comprar"
      ? "BUY"
      : String(signal?.signal_label || "") === "Vender"
        ? "SELL"
        : "")
  );
}

function deriveExecutionSide(record, signal) {
  const responsePayload = record?.response_payload && typeof record.response_payload === "object"
    ? record.response_payload
    : {};
  const learningSnapshot = responsePayload.learning_snapshot && typeof responsePayload.learning_snapshot === "object"
    ? responsePayload.learning_snapshot
    : {};
  const orderPayload = responsePayload.order && typeof responsePayload.order === "object"
    ? responsePayload.order
    : {};
  const candidatePayload = responsePayload.candidate && typeof responsePayload.candidate === "object"
    ? responsePayload.candidate
    : {};

  return (
    normalizeExecutionSideValue(record?.side)
    || normalizeExecutionSideValue(orderPayload.side)
    || normalizeExecutionSideValue(candidatePayload.side)
    || normalizeExecutionSideValue(learningSnapshot.orderSide)
    || getSignalExecutionSide(signal)
  );
}

function collectMissingSignalIds(signalMap, executionOrders) {
  if (!(signalMap instanceof Map) || !Array.isArray(executionOrders) || !executionOrders.length) return [];
  return [...new Set(
    executionOrders
      .map((record) => Number(record?.signal_id || 0))
      .filter((signalId) => Number.isFinite(signalId) && signalId > 0 && !signalMap.has(signalId)),
  )];
}

function getPersistedExecutionLearning(signal) {
  const payload = signal?.signal_payload && typeof signal.signal_payload === "object" ? signal.signal_payload : {};
  const executionLearning = payload.executionLearning && typeof payload.executionLearning === "object"
    ? payload.executionLearning
    : null;
  return executionLearning;
}

function shouldPersistSignalExecutionLearning(signal, learningSnapshot, options = {}) {
  if (!signal || !learningSnapshot || typeof learningSnapshot !== "object") return false;
  const persisted = getPersistedExecutionLearning(signal);
  if (!persisted) return true;

  const expectedOrderId = Number(options.executionOrderId || 0) || null;
  const expectedExecutionStatus = String(options.executionStatus || "").trim();
  const expectedExecutionMode = String(options.executionMode || "").trim();

  return (
    String(persisted.lifecycleStatus || "") !== String(learningSnapshot.lifecycleStatus || "")
    || String(persisted.protectionStatus || "") !== String(learningSnapshot.protectionStatus || "")
    || String(persisted.orderSide || "") !== String(learningSnapshot.orderSide || "")
    || String(persisted.mode || "") !== String(learningSnapshot.mode || "")
    || Number(persisted.realizedPnl || 0) !== Number(learningSnapshot.realizedPnl || 0)
    || Number(signal.execution_order_id || 0) !== Number(expectedOrderId || 0)
    || String(signal.execution_status || "") !== expectedExecutionStatus
    || String(signal.execution_mode || "") !== expectedExecutionMode
  );
}

function getPrimaryOrderId(record) {
  return Number(record.order_id || record.response_payload?.order?.orderId || 0) || null;
}

function extractLinkedOrderIdsFromProtection(protectionOrder) {
  if (!protectionOrder || typeof protectionOrder !== "object") return {};
  const orders = Array.isArray(protectionOrder.orders) ? protectionOrder.orders : [];
  const orderReports = Array.isArray(protectionOrder.orderReports) ? protectionOrder.orderReports : [];
  const protectionOrderIds = [
    ...orders.map((item) => Number(item.orderId || 0)),
    ...orderReports.map((item) => Number(item.orderId || 0)),
  ].filter(Boolean);
  return {
    orderListId: Number(protectionOrder.orderListId || 0) || null,
    protectionOrderIds,
  };
}

function canAutoRetryProtection(record) {
  if (String(record.mode || "") !== "execute") return false;
  if (String(record.side || "").toUpperCase() !== "BUY") return false;
  if (String(record.lifecycle_status || record.status || "") !== "filled_unprotected") return false;

  const retryState = getProtectionRetryState(record.response_payload);
  const attempts = Number(retryState.attempts || 0);
  const lastAttemptAt = retryState.lastAttemptAt ? new Date(retryState.lastAttemptAt).getTime() : 0;
  if (attempts >= AUTO_PROTECTION_RETRY_LIMIT) return false;
  if (lastAttemptAt && Date.now() - lastAttemptAt < AUTO_PROTECTION_RETRY_COOLDOWN_MS) return false;
  return true;
}

function getExecutionOrderBotContextId(order) {
  const value = String(order?.response_payload?.botContext?.botId || "").trim();
  return value || "";
}

function getDecisionExecutionOrderId(decision) {
  const value = Number(decision?.metadata?.executionOrderId || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildExecutionOrderBotContextRepairs(executionOrders = [], decisions = [], validBotIds = []) {
  const validBotIdSet = new Set(
    (Array.isArray(validBotIds) ? validBotIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  const botContextByOrderId = new Map();

  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const orderId = getDecisionExecutionOrderId(decision);
    const botId = String(decision?.botId || "").trim();
    if (!orderId || !botId || (validBotIdSet.size && !validBotIdSet.has(botId)) || botContextByOrderId.has(orderId)) continue;
    botContextByOrderId.set(orderId, {
      botId,
    });
  }

  return (Array.isArray(executionOrders) ? executionOrders : [])
    .filter((order) => Number.isFinite(Number(order?.id || 0)) && Number(order.id) > 0)
    .map((order) => {
      const orderId = Number(order.id);
      const currentBotId = getExecutionOrderBotContextId(order);
      const currentBotIdIsValid = currentBotId && (!validBotIdSet.size || validBotIdSet.has(currentBotId));
      const botContext = botContextByOrderId.get(orderId) || null;
      if (botContext) {
        if (currentBotId === botContext.botId) return null;
        return {
          orderId,
          botContext,
        };
      }
      if (currentBotId && !currentBotIdIsValid) {
        return {
          orderId,
          botContext: null,
        };
      }
      return null;
    })
    .filter(Boolean);
}

async function repairExecutionOrderBotContextForUser(username, executionOrders = [], options = {}) {
  const safeOrders = Array.isArray(executionOrders) ? executionOrders : [];
  if (!safeOrders.length) {
    return safeOrders;
  }

  const validBotIds = Array.isArray(options.validBotIds)
    ? options.validBotIds
    : await listBotIdsForUser(username).catch(() => []);
  const validBotIdSet = new Set(validBotIds.map((value) => String(value || "").trim()).filter(Boolean));
  const hasRepairableOrders = safeOrders.some((order) => {
    const currentBotId = getExecutionOrderBotContextId(order);
    return !currentBotId || (validBotIdSet.size > 0 && !validBotIdSet.has(currentBotId));
  });
  if (!hasRepairableOrders) {
    return safeOrders;
  }

  const decisions = Array.isArray(options.decisions)
    ? options.decisions
    : await listBotDecisionsForUser(username, {
      limit: Number(options.decisionsLimit || 500),
    }).catch(() => []);
  const repairs = buildExecutionOrderBotContextRepairs(safeOrders, decisions, validBotIds);
  if (!repairs.length) {
    return safeOrders;
  }

  const patchedByOrderId = new Map();
  for (const repair of repairs) {
    const currentOrder = safeOrders.find((order) => Number(order?.id || 0) === repair.orderId);
    if (!currentOrder) continue;
    const nextPayload = {
      ...(currentOrder.response_payload && typeof currentOrder.response_payload === "object"
        ? currentOrder.response_payload
        : {}),
    };
    if (repair.botContext) {
      nextPayload.botContext = repair.botContext;
    } else {
      delete nextPayload.botContext;
    }
    const patched = await updateExecutionRecord(repair.orderId, {
      response_payload: nextPayload,
    }).catch(() => null);
    patchedByOrderId.set(repair.orderId, patched || {
      ...currentOrder,
      response_payload: nextPayload,
    });
  }

  if (!patchedByOrderId.size) {
    return safeOrders;
  }

  return safeOrders.map((order) => patchedByOrderId.get(Number(order?.id || 0)) || order);
}

async function getExecutionProfileForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "updated_at.desc.nullslast,created_at.desc",
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`);
  const normalized = normalizeProfile(rows?.[0] || null, username);
  try {
    const overrideParams = new URLSearchParams({
      select: "*",
      username: `eq.${String(username)}`,
      enabled: "eq.true",
      order: "updated_at.desc.nullslast,created_at.desc",
    });
    const overrideRows = await supabaseRequest(`${EXECUTION_SCOPE_OVERRIDES_TABLE}?${overrideParams.toString()}`);
    if (Array.isArray(overrideRows) && overrideRows.length) {
      normalized.scopeOverrides = overrideRows.map((item) => ({
        id: String(item.id || `${item.strategy_id || "scope"}-${item.timeframe || "all"}`),
        strategyId: String(item.strategy_id || ""),
        timeframe: String(item.timeframe || ""),
        enabled: item.enabled !== false,
        action: String(item.action || ""),
        minSignalScore: item.min_signal_score == null ? undefined : Number(item.min_signal_score),
        minRrRatio: item.min_rr_ratio == null ? undefined : Number(item.min_rr_ratio),
        note: String(item.note || ""),
      })).filter((item) => item.strategyId && item.timeframe);
    }
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
  return normalized;
}

async function syncExecutionScopeOverridesForUser(username, overrides = []) {
  try {
    const deleteParams = new URLSearchParams({ username: `eq.${String(username)}` });
    await supabaseRequest(`${EXECUTION_SCOPE_OVERRIDES_TABLE}?${deleteParams.toString()}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    if (!Array.isArray(overrides) || !overrides.length) return;
    await supabaseRequest(EXECUTION_SCOPE_OVERRIDES_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: overrides.map((item) => ({
        username: String(username),
        strategy_id: String(item.strategyId || ""),
        timeframe: String(item.timeframe || ""),
        enabled: item.enabled !== false,
        action: String(item.action || ""),
        min_signal_score: item.minSignalScore == null ? null : Number(item.minSignalScore),
        min_rr_ratio: item.minRrRatio == null ? null : Number(item.minRrRatio),
        note: String(item.note || ""),
        source: "profile-save",
      })).filter((item) => item.strategy_id && item.timeframe),
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

async function getExecutionCenterForUser(username) {
  const [profile, portfolioPayload, signals, executionOrdersRaw] = await Promise.all([
    getExecutionProfileForUser(username),
    getPortfolioSnapshotForUsername(username, "1d"),
    listSignalSnapshotsForUser(username, { limit: 200 }),
    listExecutionOrdersForUser(username),
  ]);

  return buildExecutionCenterFromDependencies({
    username,
    profile,
    portfolioPayload,
    signals,
    executionOrdersRaw,
  });
}

async function buildExecutionCenterFromDependencies({
  username,
  profile,
  portfolioPayload,
  signals,
  executionOrdersRaw,
}) {
  // The realtime bootstrap reuses this builder so first paint derives from one
  // canonical portfolio snapshot instead of re-reading the account repeatedly.
  const safeProfile = profile || DEFAULT_PROFILE;
  const safeSignals = signals || [];
  const safeExecutionOrdersRaw = executionOrdersRaw || [];

  const executionOrders = await repairExecutionOrderBotContextForUser(
    username,
    await syncExecutionOrdersForUser(username, portfolioPayload, safeSignals, safeExecutionOrdersRaw),
  );
  const openExecutionSignalIds = new Set(
    executionOrders
      .filter((item) => isExecutionOpenStatus(item.lifecycle_status || item.status))
      .map((item) => Number(item.signal_id || 0))
      .filter(Boolean),
  );

  const dailyLossAbs = safeSignals
    .filter((item) => item.outcome_status !== "pending")
    .filter((item) => new Date(item.updated_at || item.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .reduce((sum, item) => sum + Math.min(0, Number(item.outcome_pnl || 0)), 0);
  const accountValue = Number(portfolioPayload?.portfolio?.totalValue || 0);
  const dailyLossPct = accountValue > 0 ? Math.abs((dailyLossAbs / accountValue) * 100) : 0;
  const dailyAutoExecutions = buildDailyAutoExecutions(executionOrders);
  const recentLossStreak = buildRecentLossStreak(executionOrders);

  const pendingSignals = safeSignals.filter((item) => item.outcome_status === "pending");
  const candidates = [];
  for (const signal of pendingSignals.slice(0, 20)) {
    if (openExecutionSignalIds.has(Number(signal.id)) || (signal.execution_order_id && isExecutionOpenStatus(signal.execution_status))) {
      continue;
    }
    candidates.push(await buildSignalCandidate(signal, portfolioPayload, safeProfile, {
      dailyLossPct,
      dailyAutoExecutions,
      recentLossStreak,
    }));
  }

  return {
    profile: safeProfile,
    account: {
      connected: Boolean(portfolioPayload?.connected),
      alias: portfolioPayload?.accountAlias || "",
      cashValue: Number(portfolioPayload?.portfolio?.cashValue || 0),
      totalValue: Number(portfolioPayload?.portfolio?.totalValue || 0),
      openOrdersCount: Number(portfolioPayload?.openOrders?.length || 0),
      dailyLossPct: Number(dailyLossPct.toFixed(2)),
      dailyAutoExecutions,
      recentLossStreak,
      autoExecutionRemaining: Math.max(0, safeProfile.maxDailyAutoExecutions - dailyAutoExecutions),
    },
    candidates,
    recentOrders: executionOrders || [],
  };
}

function deriveDashboardCandidateCounts(signals = []) {
  let eligibleCount = 0;
  let blockedCount = 0;

  signals
    .filter((item) => item.outcome_status === "pending")
    .slice(0, 60)
    .forEach((signal) => {
      const decisionEligible = signal?.signal_payload?.decision?.executionEligible;
      if (typeof decisionEligible === "boolean") {
        if (decisionEligible) eligibleCount += 1;
        else blockedCount += 1;
        return;
      }

      const candidates = Array.isArray(signal?.signal_payload?.candidates) ? signal.signal_payload.candidates : [];
      const hasEligibleCandidate = candidates.some((candidate) => candidate?.executionEligible === true);
      const hasBlockedCandidate = candidates.length > 0 && candidates.every((candidate) => candidate?.executionEligible === false);

      if (hasEligibleCandidate) eligibleCount += 1;
      else if (hasBlockedCandidate) blockedCount += 1;
    });

  return { eligibleCount, blockedCount };
}

async function getExecutionDashboardSummaryForUser(username) {
  const [profile, portfolioPayload, signals, executionOrdersRaw] = await Promise.all([
    getExecutionProfileForUser(username),
    getPortfolioSnapshotForUsername(username, "1d", "full"),
    listSignalSnapshotsForUser(username, { limit: 80 }),
    listExecutionOrdersForUser(username),
  ]);

  return buildExecutionDashboardSummaryFromDependencies({
    profile,
    portfolioPayload,
    signals,
    executionOrdersRaw,
    username,
  });
}

async function buildExecutionDashboardSummaryFromDependencies({
  username,
  profile,
  portfolioPayload,
  signals,
  executionOrdersRaw,
}) {
  const safeProfile = profile || DEFAULT_PROFILE;
  const safeSignals = signals || [];
  const safeExecutionOrdersRaw = executionOrdersRaw || [];
  const executionOrders = await repairExecutionOrderBotContextForUser(
    username,
    await syncExecutionOrdersForUser(username, portfolioPayload, safeSignals, safeExecutionOrdersRaw),
  );
  const recentExecuteOrders = (executionOrders || [])
    .filter((item) => item.mode === "execute")
    .slice(0, 20);
  const recentClosedOrders24h = recentExecuteOrders.filter((item) => {
    const timestamp = new Date(item.closed_at || item.last_synced_at || item.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= Date.now() - 24 * 60 * 60 * 1000;
  });
  const dailyLossAbs = recentClosedOrders24h.reduce((sum, item) => sum + Math.min(0, Number(item.realized_pnl || 0)), 0);
  const accountValue = Number(portfolioPayload?.portfolio?.totalValue || 0);
  const dailyLossPct = accountValue > 0 ? Math.abs((dailyLossAbs / accountValue) * 100) : 0;
  const dailyAutoExecutions = buildDailyAutoExecutions(executionOrders || []);
  const recentLossStreak = buildRecentLossStreak(executionOrders || []);
  const { eligibleCount, blockedCount } = deriveDashboardCandidateCounts(safeSignals);

  return {
    generatedAt: new Date().toISOString(),
    connection: {
      connected: Boolean(portfolioPayload?.connected),
      accountAlias: portfolioPayload?.accountAlias || "",
    },
    connectionIssue: portfolioPayload?.connectionIssue || undefined,
    portfolio: portfolioPayload?.portfolio || {
      period: "1d",
      totalValue: 0,
      periodChangeValue: 0,
      periodChangePct: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      totalPnl: 0,
      winnersCount: 0,
      openPositionsCount: 0,
      cashValue: 0,
      positionsValue: 0,
      investedValue: 0,
    },
    topAssets: Array.isArray(portfolioPayload?.assets) ? portfolioPayload.assets.slice(0, 5) : [],
    execution: {
      profileEnabled: Boolean(safeProfile?.enabled),
      activeBots: safeProfile?.enabled ? 1 : 0,
      totalBots: 1,
      openOrdersCount: Number(portfolioPayload?.openOrders?.length || 0),
      dailyLossPct: Number(dailyLossPct.toFixed(2)),
      dailyAutoExecutions,
      recentLossStreak,
      autoExecutionRemaining: Math.max(0, Number(safeProfile?.maxDailyAutoExecutions || 0) - dailyAutoExecutions),
      eligibleCount,
      blockedCount,
      recentOrders: recentExecuteOrders,
    },
  };
}

async function saveExecutionProfileForUser(username, payload) {
  const existing = await getExecutionProfileForUser(username).catch(() => null);
  const profile = {
    username,
    enabled: payload.enabled ?? DEFAULT_PROFILE.enabled,
    auto_execute_enabled: payload.autoExecuteEnabled ?? DEFAULT_PROFILE.autoExecuteEnabled,
    risk_per_trade_pct: Number(payload.riskPerTradePct ?? DEFAULT_PROFILE.riskPerTradePct),
    max_open_positions: Number(payload.maxOpenPositions ?? DEFAULT_PROFILE.maxOpenPositions),
    max_position_usd: Number(payload.maxPositionUsd ?? DEFAULT_PROFILE.maxPositionUsd),
    max_daily_loss_pct: Number(payload.maxDailyLossPct ?? DEFAULT_PROFILE.maxDailyLossPct),
    min_signal_score: Number(payload.minSignalScore ?? DEFAULT_PROFILE.minSignalScore),
    min_rr_ratio: Number(payload.minRrRatio ?? DEFAULT_PROFILE.minRrRatio),
    max_daily_auto_executions: Number(payload.maxDailyAutoExecutions ?? DEFAULT_PROFILE.maxDailyAutoExecutions),
    cooldown_after_losses: Number(payload.cooldownAfterLosses ?? DEFAULT_PROFILE.cooldownAfterLosses),
    allowed_strategies: normalizeArray(payload.allowedStrategies),
    allowed_timeframes: normalizeArray(payload.allowedTimeframes),
    note: buildProfileNoteEnvelope({
      note: String(payload.note || DEFAULT_PROFILE.note),
      scopeOverrides: Array.isArray(payload.scopeOverrides) ? payload.scopeOverrides : [],
      scorerPolicy: payload.scorerPolicy && typeof payload.scorerPolicy === "object"
        ? payload.scorerPolicy
        : existing?.scorerPolicy,
    }),
  };

  let rows;
  if (existing?.updatedAt) {
    const params = new URLSearchParams({ username: `eq.${String(username)}` });
    rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: profile,
    });
  } else {
    rows = await supabaseRequest(EXECUTION_PROFILES_TABLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: profile,
    });
  }
  const normalized = normalizeProfile(rows?.[0] || profile, username);
  await syncExecutionScopeOverridesForUser(username, Array.isArray(payload.scopeOverrides) ? payload.scopeOverrides : []).catch(() => null);
  return normalized;
}

async function listExecutionOrdersForUser(username, options = {}) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: options.order || "created_at.desc",
    limit: String(options.limit || 60),
  });
  return supabaseRequest(`${EXECUTION_ORDERS_TABLE}?${params.toString()}`);
}

async function getExecutionOrderByIdForUser(username, id) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    id: `eq.${Number(id)}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_ORDERS_TABLE}?${params.toString()}`);
  return rows?.[0] || null;
}

async function insertExecutionRecord(record) {
  const rows = await supabaseRequest(EXECUTION_ORDERS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: record,
  });
  return rows?.[0] || null;
}

async function updateExecutionRecord(id, body) {
  const params = new URLSearchParams({
    id: `eq.${Number(id)}`,
  });
  const rows = await supabaseRequest(`${EXECUTION_ORDERS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body,
  });
  return rows?.[0] || null;
}

async function getSymbolRules(symbol) {
  const info = await fetchBinancePublic("/api/v3/exchangeInfo", { symbol });
  const market = Array.isArray(info?.symbols) ? info.symbols[0] : null;
  if (!market) {
    return { stepSize: 0.000001, minQty: 0, minNotional: 5 };
  }
  const lotSize = Array.isArray(market.filters)
    ? market.filters.find((item) => item.filterType === "LOT_SIZE")
    : null;
  const minNotionalFilter = Array.isArray(market.filters)
    ? market.filters.find((item) => item.filterType === "MIN_NOTIONAL" || item.filterType === "NOTIONAL")
    : null;
  return {
    stepSize: Number(lotSize?.stepSize || 0.000001),
    minQty: Number(lotSize?.minQty || 0),
    minNotional: Number(minNotionalFilter?.minNotional || 5),
    tickSize: Number(
      (Array.isArray(market.filters)
        ? market.filters.find((item) => item.filterType === "PRICE_FILTER")?.tickSize
        : null) || 0.0001
    ),
  };
}

async function attachProtectiveExit({
  apiKey,
  apiSecret,
  candidate,
  executedQty,
  rules,
}) {
  if (candidate.side !== "BUY") {
    return {
      protectionAttached: false,
      protectionMode: "not-applicable",
      protectionNote: "La venta spot no deja una nueva posición abierta para proteger con TP/SL.",
      protectionOrder: null,
    };
  }

  if (!(candidate.plan.tp > 0) || !(candidate.plan.sl > 0)) {
    return {
      protectionAttached: false,
      protectionMode: "missing-levels",
      protectionNote: "La señal no tenía TP o SL válidos para montar protección automática.",
      protectionOrder: null,
    };
  }

  const protectiveQty = roundDown(executedQty, rules.stepSize);
  if (protectiveQty <= 0 || protectiveQty < rules.minQty) {
    return {
      protectionAttached: false,
      protectionMode: "qty-too-small",
      protectionNote: "La cantidad ejecutada quedó por debajo del mínimo para montar la salida protegida.",
      protectionOrder: null,
    };
  }

  const takeProfitPrice = roundDown(candidate.plan.tp, rules.tickSize);
  const stopPrice = roundDown(candidate.plan.sl, rules.tickSize);
  const stopLimitPrice = roundDown(candidate.plan.sl * 0.997, rules.tickSize);

  if (!(takeProfitPrice > stopPrice) || !(stopPrice > stopLimitPrice)) {
    return {
      protectionAttached: false,
      protectionMode: "invalid-prices",
      protectionNote: "Los niveles TP/SL no quedaron en un orden válido para crear la protección.",
      protectionOrder: null,
    };
  }

  const protectionOrder = await fetchBinanceSigned(
    "/api/v3/order/oco",
    apiKey,
    apiSecret,
    {
      symbol: candidate.symbol,
      side: "SELL",
      quantity: protectiveQty,
      price: takeProfitPrice,
      stopPrice,
      stopLimitPrice,
      stopLimitTimeInForce: "GTC",
    },
    { method: "POST" },
  );

  return {
    protectionAttached: true,
    protectionMode: "oco",
    protectionNote: `Salida protegida creada con TP ${takeProfitPrice} y SL ${stopPrice}.`,
    protectionOrder,
  };
}

async function buildSignalCandidate(signal, portfolio, profile, riskContext = {}) {
  const symbol = signal.coin.replace("/", "");
  const priceTicker = await fetchBinancePublic("/api/v3/ticker/price", { symbol }).catch(() => ({ price: "0" }));
  const currentPrice = Number(priceTicker?.price || signal.entry_price || 0);
  const rules = await getSymbolRules(symbol);
  const reasons = [];
  const edgeSafety = evaluateSignalEdgeSafety(signal, profile, {
    autoExecution: false,
    manualExecution: Boolean(riskContext.manualExecution),
  });
  const effectiveProfile = edgeSafety.effectiveProfile;
  let side = signal.signal_label === "Comprar" ? "BUY" : signal.signal_label === "Vender" ? "SELL" : "";
  let qty = 0;
  let notionalUsd = 0;
  let status = "eligible";
  const dailyLossPct = Number(riskContext.dailyLossPct || 0);
  const dailyAutoExecutions = Number(riskContext.dailyAutoExecutions || 0);
  const recentLossStreak = Number(riskContext.recentLossStreak || 0);
  const decision = edgeSafety.edge.decision || null;
  const baseScore = Number(signal.signal_score || 0);
  const adaptiveScore = decision && Number.isFinite(Number(decision.adaptiveScore))
    ? Number(decision.adaptiveScore)
    : null;
  const effectiveScore = adaptiveScore != null ? adaptiveScore : baseScore;

  reasons.push(...edgeSafety.reasons);

  if (!profile.enabled) reasons.push("El perfil de ejecución está desactivado.");
  if (!side) reasons.push("La señal actual no tiene dirección operable.");
  if (profile.allowedStrategies.length && signal.strategy_name && !profile.allowedStrategies.includes(signal.strategy_name)) {
    reasons.push("La estrategia de esta señal no está autorizada en el perfil.");
  }
  if (profile.allowedTimeframes.length && signal.timeframe && !profile.allowedTimeframes.includes(signal.timeframe)) {
    reasons.push("La temporalidad de esta señal no está permitida en el perfil.");
  }
  if ((portfolio?.openOrders || []).length >= profile.maxOpenPositions && side === "BUY") {
    reasons.push("Ya alcanzaste el máximo de posiciones/órdenes abiertas configurado.");
  }
  if (dailyLossPct >= profile.maxDailyLossPct) {
    reasons.push("La pérdida acumulada del día ya supera el límite permitido.");
  }
  if (profile.autoExecuteEnabled && dailyAutoExecutions >= profile.maxDailyAutoExecutions) {
    reasons.push(`La auto-ejecución del día ya alcanzó el máximo de ${profile.maxDailyAutoExecutions} operaciones.`);
  }
  if (profile.autoExecuteEnabled && recentLossStreak >= profile.cooldownAfterLosses) {
    reasons.push(`La auto-ejecución está en enfriamiento por una racha de ${recentLossStreak} pérdidas seguidas.`);
  }

  if (side === "BUY" && currentPrice > 0) {
    const freeUsdt = Number(portfolio?.assets?.find((item) => item.asset === "USDT")?.free || portfolio?.portfolio?.cashValue || 0);
    const accountValue = Number(portfolio?.portfolio?.totalValue || freeUsdt || 0);
    const riskBudget = Math.min(
      freeUsdt,
      profile.maxPositionUsd,
      (accountValue * profile.riskPerTradePct) / 100,
    );
    qty = roundDown(riskBudget / currentPrice, rules.stepSize);
    notionalUsd = Number((qty * currentPrice).toFixed(4));
    if (qty <= 0 || qty < rules.minQty) reasons.push("El tamaño calculado no llega al mínimo permitido por Binance.");
    if (notionalUsd < rules.minNotional) reasons.push("El tamaño calculado no alcanza el notional mínimo del mercado.");
  }

  if (side === "SELL" && currentPrice > 0) {
    const asset = getBaseAsset(signal.coin);
    const currentPosition = portfolio?.assets?.find((item) => item.asset === asset);
    const freeQty = Number(currentPosition?.free || currentPosition?.quantity || 0);
    qty = roundDown(freeQty, rules.stepSize);
    notionalUsd = Number((qty * currentPrice).toFixed(4));
    if (qty <= 0 || qty < rules.minQty) reasons.push("No tienes cantidad libre suficiente para vender este activo.");
    if (notionalUsd < rules.minNotional) reasons.push("La posición actual no alcanza el notional mínimo del mercado.");
  }

  if (reasons.length) status = "blocked";

  return {
    signalId: signal.id,
    coin: signal.coin,
    symbol,
    timeframe: signal.timeframe,
    strategyName: signal.strategy_name || "",
    strategyVersion: signal.strategy_version || "",
    signalLabel: signal.signal_label,
    score: effectiveScore,
    baseScore,
    adaptiveScore,
    scorer: decision?.scorer || null,
    rrRatio: Number(signal.rr_ratio || 0),
    decisionSource: String(decision?.source || "legacy"),
    decisionExperimentId: Number(decision?.primaryExperimentId || 0) || null,
    profileOverride: effectiveProfile.override
      ? {
        strategyId: effectiveProfile.override.strategyId,
        timeframe: effectiveProfile.override.timeframe,
        minSignalScore: effectiveProfile.minSignalScore,
        minRrRatio: effectiveProfile.minRrRatio,
        action: String(effectiveProfile.override.action || ""),
        note: effectiveProfile.override.note || "",
      }
      : null,
    side,
    currentPrice,
    qty,
    notionalUsd,
    status,
    reasons,
    plan: {
      entry: Number(signal.entry_price || 0),
      tp: Number(signal.tp_price || 0),
      tp2: Number(signal.tp2_price || 0),
      sl: Number(signal.sl_price || 0),
    },
  };
}

function deriveClosedExecutionFromExchange(record, portfolioPayload) {
  const recentOrders = Array.isArray(portfolioPayload?.recentOrders) ? portfolioPayload.recentOrders : [];
  const recentTrades = Array.isArray(portfolioPayload?.recentTrades) ? portfolioPayload.recentTrades : [];
  const linkedIds = typeof record.linked_order_ids === "object" && record.linked_order_ids ? record.linked_order_ids : {};
  const protectionIds = Array.isArray(linkedIds.protectionOrderIds) ? linkedIds.protectionOrderIds.map((item) => Number(item || 0)).filter(Boolean) : [];
  if (!protectionIds.length) return null;

  const protectionOrders = recentOrders
    .filter((item) => protectionIds.includes(Number(item.orderId || 0)))
    .sort((a, b) => Number(b.updateTime || 0) - Number(a.updateTime || 0));
  const filledOrder = protectionOrders.find((item) => item.status === "FILLED");
  if (!filledOrder) return null;

  const matchingTrades = recentTrades.filter((item) => Number(item.orderId || 0) === Number(filledOrder.orderId || 0));
  const realizedPnl = matchingTrades.reduce((sum, item) => sum + Number(item.realizedPnl || 0), 0);
  const filledType = String(filledOrder.type || "");
  const outcomeStatus = filledType === "LIMIT_MAKER" ? "win" : filledType === "STOP_LOSS_LIMIT" ? "loss" : null;
  if (!outcomeStatus) return null;

  return {
    lifecycleStatus: outcomeStatus === "win" ? "closed_win" : "closed_loss",
    protectionStatus: "consumed",
    signalOutcomeStatus: outcomeStatus,
    realizedPnl,
    closedAt: new Date(Number(filledOrder.updateTime || Date.now())).toISOString(),
    closingOrder: filledOrder,
  };
}

async function syncExecutionOrdersForUser(username, portfolioPayload, signals, executionOrders) {
  if (!Array.isArray(executionOrders) || !executionOrders.length) return executionOrders || [];

  const signalMap = new Map((signals || []).map((item) => [Number(item.id), item]));
  const missingSignalIds = collectMissingSignalIds(signalMap, executionOrders);
  if (missingSignalIds.length) {
    const missingSignals = await listSignalSnapshotsByIdsForUser(username, missingSignalIds, {
      limit: missingSignalIds.length,
    }).catch(() => []);
    for (const signal of missingSignals) {
      const signalId = Number(signal?.id || 0);
      if (signalId > 0) signalMap.set(signalId, signal);
    }
  }
  const openOrderIds = new Set((portfolioPayload?.openOrders || []).map((item) => Number(item.orderId || 0)).filter(Boolean));
  const nextOrders = [];
  let cachedCredentials = null;

  for (const record of executionOrders) {
    const signal = record.signal_id ? signalMap.get(Number(record.signal_id)) : null;
    const mainOrderId = getPrimaryOrderId(record);
    const protection = getProtectionPayload(record.response_payload);
    const linkedIds = typeof record.linked_order_ids === "object" && record.linked_order_ids ? record.linked_order_ids : {};
    const protectionIds = Array.isArray(linkedIds.protectionOrderIds) ? linkedIds.protectionOrderIds.map((item) => Number(item || 0)).filter(Boolean) : [];
    const hasOpenProtection = protectionIds.some((item) => openOrderIds.has(item));

    let lifecycleStatus = String(record.lifecycle_status || record.status || "created");
    let protectionStatus = String(record.protection_status || "none");
    let signalOutcomeStatus = record.signal_outcome_status || null;
    let realizedPnl = Number(record.realized_pnl || 0);
    let closedAt = record.closed_at || null;
    const resolvedSide = deriveExecutionSide(record, signal);
    const exchangeClosure = deriveClosedExecutionFromExchange(record, portfolioPayload);

    if (record.status === "preview") {
      lifecycleStatus = "preview";
      protectionStatus = "none";
    } else if (record.status === "blocked") {
      lifecycleStatus = "blocked";
      protectionStatus = "none";
    } else if (exchangeClosure && (!signal?.outcome_status || signal.outcome_status === "pending")) {
      lifecycleStatus = exchangeClosure.lifecycleStatus;
      protectionStatus = exchangeClosure.protectionStatus;
      signalOutcomeStatus = exchangeClosure.signalOutcomeStatus;
      realizedPnl = Number(exchangeClosure.realizedPnl || 0);
      closedAt = exchangeClosure.closedAt;
    } else if (signal?.outcome_status && signal.outcome_status !== "pending") {
      signalOutcomeStatus = signal.outcome_status;
      realizedPnl = Number(signal.outcome_pnl || 0);
      closedAt = signal.updated_at || signal.created_at || closedAt;
      if (signal.outcome_status === "win") lifecycleStatus = "closed_win";
      if (signal.outcome_status === "loss") lifecycleStatus = "closed_loss";
      if (signal.outcome_status === "invalidated") lifecycleStatus = "closed_invalidated";
      protectionStatus = hasOpenProtection ? "active" : (protection?.protectionAttached ? "consumed" : protectionStatus);
    } else if (record.status === "placed") {
      if (hasOpenProtection || protection?.protectionAttached) {
        lifecycleStatus = "protected";
        protectionStatus = hasOpenProtection ? "active" : "active";
      } else if (protection?.protectionMode === "not-applicable") {
        lifecycleStatus = "filled";
        protectionStatus = "not-applicable";
      } else {
        lifecycleStatus = "filled_unprotected";
        protectionStatus = protection?.protectionMode === "failed" ? "failed" : "none";
      }
    }

    const learningSnapshot = buildExecutionLearningSnapshot({
      signal,
      record,
      lifecycleStatus,
      protectionStatus,
      realizedPnl,
      closedAt,
    });

    const updates = {
      lifecycle_status: lifecycleStatus,
      protection_status: protectionStatus,
      signal_outcome_status: signalOutcomeStatus,
      realized_pnl: realizedPnl,
      side: resolvedSide || record.side || null,
      last_synced_at: new Date().toISOString(),
      closed_at: closedAt,
      response_payload: {
        ...(record.response_payload && typeof record.response_payload === "object" ? record.response_payload : {}),
        learning_snapshot: learningSnapshot,
      },
    };

    const hasChanged = lifecycleStatus !== record.lifecycle_status
      || protectionStatus !== record.protection_status
      || signalOutcomeStatus !== record.signal_outcome_status
      || realizedPnl !== Number(record.realized_pnl || 0)
      || String((resolvedSide || record.side || "").toUpperCase()) !== String(record.side || "").toUpperCase()
      || String(closedAt || "") !== String(record.closed_at || "");

    let nextRecord = { ...record, ...updates };
    if (hasChanged) {
      nextRecord = (await updateExecutionRecord(record.id, updates)) || nextRecord;
    }

    if (signal?.id) {
      const nextExecutionStatus = lifecycleStatus;
      const nextExecutionMode = String(record.mode || "");
      const shouldPersistExecutionLearning = shouldPersistSignalExecutionLearning(signal, learningSnapshot, {
        executionOrderId: record.id,
        executionStatus: nextExecutionStatus,
        executionMode: nextExecutionMode,
      });
      const shouldUpdateSignal = signal.execution_order_id !== record.id
        || signal.execution_status !== nextExecutionStatus
        || signal.execution_mode !== nextExecutionMode;
      if (shouldUpdateSignal || shouldPersistExecutionLearning) {
        const patchedSignal = await updateSignalExecutionStateForUser(username, signal, {
          executionOrderId: record.id,
          executionStatus: nextExecutionStatus,
          executionMode: nextExecutionMode,
          executionUpdatedAt: new Date().toISOString(),
          ...(shouldPersistExecutionLearning ? {
            signalPayloadMerge: {
              executionLearning: learningSnapshot,
            },
          } : {}),
        }).catch(() => null);
        if (patchedSignal) signalMap.set(Number(signal.id), patchedSignal);
      }

      const shouldCloseSignalFromExecution = signal.outcome_status === "pending"
        && (signalOutcomeStatus === "win" || signalOutcomeStatus === "loss")
        && lifecycleStatus.startsWith("closed_");
      if (shouldCloseSignalFromExecution) {
        const originLabel = getExecutionOriginLabel(record);
        const closeNote = `${signal.note ? `${signal.note} · ` : ""}Cierre real de Binance Demo detectado por ${originLabel.toLowerCase()} el ${new Date(closedAt || Date.now()).toLocaleString("es-DO")}.`;
        const patchedSignal = await updateSignalSnapshotForUser(username, signal.id, {
          outcomeStatus: signalOutcomeStatus,
          outcomePnl: realizedPnl,
          note: closeNote,
          signalPayloadMerge: {
            executionLearning: learningSnapshot,
          },
        }).catch(() => null);
        if (patchedSignal) {
          signalMap.set(Number(signal.id), patchedSignal);
          signal.outcome_status = signalOutcomeStatus;
          signal.outcome_pnl = realizedPnl;
          signal.note = closeNote;
        }
        await upsertSignalFeatureSnapshotForUser(
          username,
          patchedSignal || signal,
        ).catch(() => null);
      }
    }

    const shouldAutoRetryProtection = canAutoRetryProtection(nextRecord) && !exchangeClosure;
    if (shouldAutoRetryProtection) {
      const retryState = getProtectionRetryState(nextRecord.response_payload);
      const attempts = Number(retryState.attempts || 0);
      const signalForRetry = nextRecord.signal_id ? signalMap.get(Number(nextRecord.signal_id)) : null;

      if (signalForRetry) {
        try {
          cachedCredentials = cachedCredentials || await getCredentialsForUsername(username);
          const candidate = {
            symbol: String(nextRecord.coin || signalForRetry.coin || "").replace("/", ""),
            side: "BUY",
            plan: {
              tp: Number(signalForRetry.tp_price || 0),
              sl: Number(signalForRetry.sl_price || 0),
            },
          };
          const asset = getBaseAsset(nextRecord.coin || signalForRetry.coin);
          const currentPosition = portfolioPayload?.assets?.find((item) => item.asset === asset);
          const freeQty = Number(currentPosition?.free || currentPosition?.quantity || 0);
          const fallbackExecutedQty = Number(nextRecord.response_payload?.order?.executedQty || nextRecord.quantity || 0);
          const protectiveQty = freeQty > 0 ? freeQty : fallbackExecutedQty;

          const protectionResult = await attachProtectiveExit({
            apiKey: cachedCredentials.apiKey,
            apiSecret: cachedCredentials.apiSecret,
            candidate,
            executedQty: protectiveQty,
            rules: await getSymbolRules(candidate.symbol),
          });

          if (protectionResult.protectionAttached) {
            const nextPayload = {
              ...(nextRecord.response_payload && typeof nextRecord.response_payload === "object" ? nextRecord.response_payload : {}),
              protection: protectionResult,
              protectionRetriedAt: new Date().toISOString(),
              protectionRetryState: {
                attempts: attempts + 1,
                lastAttemptAt: new Date().toISOString(),
                lastMode: "auto",
                lastSuccessAt: new Date().toISOString(),
              },
            };
            const patchedRecord = await updateExecutionRecord(nextRecord.id, {
              lifecycle_status: "protected",
              protection_status: "active",
              linked_order_ids: {
                ...(nextRecord.linked_order_ids && typeof nextRecord.linked_order_ids === "object" ? nextRecord.linked_order_ids : {}),
                ...extractLinkedOrderIdsFromProtection(protectionResult.protectionOrder),
              },
              last_synced_at: new Date().toISOString(),
              notes: `${String(nextRecord.notes || "").trim()} · Protección añadida automáticamente después de la apertura.`,
              response_payload: nextPayload,
            });
            nextRecord = patchedRecord || {
              ...nextRecord,
              lifecycle_status: "protected",
              protection_status: "active",
              response_payload: nextPayload,
            };

            if (signalForRetry?.id) {
              const patchedSignal = await updateSignalExecutionLink(username, signalForRetry.id, {
                executionOrderId: nextRecord.id,
                executionStatus: "protected",
                executionMode: String(nextRecord.mode || "execute"),
                executionUpdatedAt: new Date().toISOString(),
              }).catch(() => null);
              if (patchedSignal) signalMap.set(Number(signalForRetry.id), patchedSignal);
            }
          } else {
            throw new Error(protectionResult.protectionNote || "No se pudo montar la protección en este intento.");
          }
        } catch (error) {
          const nextPayload = {
            ...(nextRecord.response_payload && typeof nextRecord.response_payload === "object" ? nextRecord.response_payload : {}),
            protection: {
              ...(getProtectionPayload(nextRecord.response_payload) || {}),
              protectionAttached: false,
              protectionMode: "failed",
              protectionNote: error instanceof Error ? error.message : "La protección automática volvió a fallar.",
            },
            protectionRetryState: {
              attempts: attempts + 1,
              lastAttemptAt: new Date().toISOString(),
              lastMode: "auto",
              lastError: error instanceof Error ? error.message : "La protección automática volvió a fallar.",
            },
          };
          const patchedRecord = await updateExecutionRecord(nextRecord.id, {
            protection_status: "failed",
            last_synced_at: new Date().toISOString(),
            response_payload: nextPayload,
          });
          nextRecord = patchedRecord || {
            ...nextRecord,
            protection_status: "failed",
            response_payload: nextPayload,
          };
        }
      }
    }

    nextOrders.push(nextRecord);
  }

  const closedCount = nextOrders.filter((item) => String(item.lifecycle_status || "").startsWith("closed_")).length;
  if (closedCount > 0) {
    await generateAdaptiveRecommendationsForUser(username).catch(() => null);
  }

  return nextOrders;
}

async function getExecutionCenter(req) {
  const { session } = await getCredentialsForSession(req);
  return getExecutionCenterForUser(session.username);
}

async function getExecutionDashboardSummary(req) {
  const { session } = await getCredentialsForSession(req);
  return getExecutionDashboardSummaryForUser(session.username);
}

async function updateExecutionProfile(req) {
  const { session } = await getCredentialsForSession(req);
  const body = parseJsonBody(req);
  return saveExecutionProfileForUser(session.username, body);
}

async function executeSignalTrade(req) {
  const { session, apiKey, apiSecret } = await getCredentialsForSession(req);
  const body = parseJsonBody(req);
  if (body.action === "attachProtection") {
    return attachProtectionToExecutionOrderForUser(session.username, Number(body.executionOrderId || 0), {
      apiKey,
      apiSecret,
    });
  }
  const signalId = Number(body.signalId || 0);
  const mode = body.mode === "execute" ? "execute" : "preview";
  return executeSignalTradeForUser(session.username, signalId, mode, {
    apiKey,
    apiSecret,
    origin: body.origin || "manual",
    botId: body.botId || null,
    botName: body.botName || null,
  });
}

async function executeSignalTradeForUser(username, signalId, mode = "execute", options = {}) {
  if (!signalId) throw new Error("Debes indicar la señal que quieres operar.");
  const normalizedMode = mode === "execute" ? "execute" : "preview";
  const origin = options.origin || "manual";
  const botId = options.botId ? String(options.botId) : null;
  const botName = options.botName ? String(options.botName) : null;
  const credentials = options.apiKey && options.apiSecret
    ? { apiKey: options.apiKey, apiSecret: options.apiSecret }
    : await getCredentialsForUsername(username);
  const center = await getExecutionCenterForUser(username);
  const sourceSignals = await listSignalSnapshotsByIdsForUser(username, [signalId], { limit: 1 }).catch(() => []);
  const sourceSignal = (sourceSignals || [])[0] || null;
  const manualExecution = normalizedMode === "execute" && (origin === "manual" || origin === "bot-manual");
  let candidate = center.candidates.find((item) => item.signalId === signalId);
  if ((!candidate || (manualExecution && candidate.status !== "eligible")) && sourceSignal && String(sourceSignal.outcome_status || "") === "pending") {
    candidate = await buildSignalCandidate(sourceSignal, center.account.connected
      ? {
        connected: center.account.connected,
        portfolio: {
          cashValue: center.account.cashValue,
          totalValue: center.account.totalValue,
        },
        openOrders: Array.isArray(center.recentOrders)
          ? center.recentOrders.filter((item) => isExecutionOpenStatus(item.lifecycle_status || item.status))
          : [],
        assets: [],
      }
      : {
        connected: false,
        portfolio: {
          cashValue: center.account.cashValue,
          totalValue: center.account.totalValue,
        },
        openOrders: Array.isArray(center.recentOrders)
          ? center.recentOrders.filter((item) => isExecutionOpenStatus(item.lifecycle_status || item.status))
          : [],
        assets: [],
      }, center.profile, {
      dailyLossPct: center.account.dailyLossPct,
      dailyAutoExecutions: center.account.dailyAutoExecutions,
      recentLossStreak: center.account.recentLossStreak,
      manualExecution,
    }).catch(() => null);
  }
  if (!candidate) throw new Error("No encontramos esa señal abierta dentro de los candidatos actuales.");

  const recordBase = {
    username,
    signal_id: candidate.signalId,
    coin: candidate.coin,
    timeframe: candidate.timeframe,
    strategy_name: candidate.strategyName,
    strategy_version: candidate.strategyVersion,
    side: candidate.side,
    quantity: candidate.qty,
    notional_usd: candidate.notionalUsd,
    current_price: candidate.currentPrice,
    mode: normalizedMode,
    origin: origin === "watcher" || origin === "bot-auto" ? "runtime" : "manual-user",
  };

  if (candidate.status !== "eligible" || normalizedMode === "preview") {
    const record = await insertExecutionRecord({
      ...recordBase,
      status: normalizedMode === "preview" ? "preview" : "blocked",
      lifecycle_status: normalizedMode === "preview" ? "preview" : "blocked",
      protection_status: "none",
      notes: candidate.reasons.join(" | ") || `Candidata lista para revisión ${origin === "watcher" || origin === "bot-auto" ? "automática" : "manual"}`,
      response_payload: {
        candidate,
        origin,
        botContext: botId ? { botId, botName } : null,
      },
    });
    if (record?.id) {
      await updateSignalExecutionLink(username, candidate.signalId, {
        executionOrderId: record.id,
        executionStatus: record.lifecycle_status || record.status,
        executionMode: normalizedMode,
      }).catch(() => null);
    }
    return { mode: normalizedMode, candidate, record };
  }

  const result = await fetchBinanceSigned(
    "/api/v3/order",
    credentials.apiKey,
    credentials.apiSecret,
    {
      symbol: candidate.symbol,
      side: candidate.side,
      type: "MARKET",
      quantity: candidate.qty,
      newOrderRespType: "RESULT",
    },
    { method: "POST" },
  );

  const executedQty = Number(result.executedQty || candidate.qty || 0);
  let protectionResult = {
    protectionAttached: false,
    protectionMode: "not-attempted",
    protectionNote: "No se intentó crear protección todavía.",
    protectionOrder: null,
  };

  try {
    protectionResult = await attachProtectiveExit({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      candidate,
      executedQty,
      rules: await getSymbolRules(candidate.symbol),
    });
  } catch (error) {
    protectionResult = {
      protectionAttached: false,
      protectionMode: "failed",
      protectionNote: error instanceof Error
        ? `La orden principal salió, pero la protección falló: ${error.message}`
        : "La orden principal salió, pero la protección falló.",
      protectionOrder: null,
    };
  }

  const initialLearningSnapshot = buildExecutionLearningSnapshot({
    signal: sourceSignal,
    record: {
      ...recordBase,
      origin,
      response_payload: {
        order: result,
        protection: protectionResult,
        botContext: botId ? { botId, botName } : null,
      },
    },
    lifecycleStatus: protectionResult.protectionAttached
      ? "protected"
      : protectionResult.protectionMode === "not-applicable"
        ? "filled"
        : "filled_unprotected",
    protectionStatus: protectionResult.protectionAttached
      ? "active"
      : protectionResult.protectionMode === "not-applicable"
        ? "not-applicable"
        : protectionResult.protectionMode === "failed"
          ? "failed"
          : "none",
    realizedPnl: 0,
    closedAt: null,
  });

  const record = await insertExecutionRecord({
    ...recordBase,
    status: "placed",
    order_id: Number(result.orderId || 0) || null,
    client_order_id: String(result.clientOrderId || ""),
    lifecycle_status: protectionResult.protectionAttached
      ? "protected"
      : protectionResult.protectionMode === "not-applicable"
        ? "filled"
        : "filled_unprotected",
    protection_status: protectionResult.protectionAttached
      ? "active"
      : protectionResult.protectionMode === "not-applicable"
        ? "not-applicable"
        : protectionResult.protectionMode === "failed"
          ? "failed"
          : "none",
    linked_order_ids: {
      primaryOrderId: Number(result.orderId || 0) || null,
      ...extractLinkedOrderIdsFromProtection(protectionResult.protectionOrder),
    },
    last_synced_at: new Date().toISOString(),
    notes: `${origin === "watcher" || origin === "bot-auto" ? "Orden automática del vigilante. " : botName ? `Orden Demo enviada desde ${botName}. ` : "Orden Demo enviada desde Señales. "}${protectionResult.protectionNote}`,
    response_payload: {
      origin,
      botContext: botId ? { botId, botName } : null,
      order: result,
      protection: protectionResult,
      learning_snapshot: initialLearningSnapshot,
    },
  });

  if (record?.id) {
    await updateSignalExecutionStateForUser(username, sourceSignal || candidate.signalId, {
      executionOrderId: record.id,
      executionStatus: record.lifecycle_status || "placed",
      executionMode: normalizedMode,
      signalPayloadMerge: {
        executionLearning: initialLearningSnapshot,
      },
    }).catch(() => null);
    await upsertSignalFeatureSnapshotForUser(username, sourceSignal).catch(() => null);
  }

  return { mode: normalizedMode, candidate, record, order: result, protection: protectionResult };
}

async function attachProtectionToExecutionOrderForUser(username, executionOrderId, options = {}) {
  if (!executionOrderId) throw new Error("Debes indicar la orden demo que quieres proteger.");

  const record = await getExecutionOrderByIdForUser(username, executionOrderId);
  if (!record) throw new Error("No encontramos esa orden demo para este usuario.");
  if (record.mode !== "execute") throw new Error("Solo puedes proteger órdenes reales de ejecución demo.");

  const lifecycle = String(record.lifecycle_status || record.status || "");
  if (lifecycle.startsWith("closed_")) {
    throw new Error("Esa operación ya está cerrada y no necesita protección.");
  }
  if (lifecycle === "protected" || String(record.protection_status || "") === "active") {
    throw new Error("Esa operación ya tiene protección activa.");
  }
  if (String(record.side || "").toUpperCase() !== "BUY") {
    throw new Error("Solo las compras spot abiertas necesitan montar TP/SL después de ejecutar.");
  }

  const credentials = options.apiKey && options.apiSecret
    ? { apiKey: options.apiKey, apiSecret: options.apiSecret }
    : await getCredentialsForUsername(username);
  const portfolio = await getPortfolioSnapshotForUsername(username, "1d");
  const sourceSignals = await listSignalSnapshotsByIdsForUser(username, [record.signal_id], { limit: 1 }).catch(() => []);
  const signal = sourceSignals[0] || null;
  if (!signal) {
    throw new Error("No encontramos la señal asociada para reconstruir el plan de protección.");
  }

  const candidate = {
    symbol: String(record.coin || signal.coin || "").replace("/", ""),
    side: "BUY",
    plan: {
      tp: Number(signal.tp_price || 0),
      sl: Number(signal.sl_price || 0),
    },
  };

  const asset = getBaseAsset(record.coin || signal.coin);
  const currentPosition = portfolio?.assets?.find((item) => item.asset === asset);
  const freeQty = Number(currentPosition?.free || currentPosition?.quantity || 0);
  const fallbackExecutedQty = Number(record.response_payload?.order?.executedQty || record.quantity || 0);
  const protectiveQty = freeQty > 0 ? freeQty : fallbackExecutedQty;

  const protectionResult = await attachProtectiveExit({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    candidate,
    executedQty: protectiveQty,
    rules: await getSymbolRules(candidate.symbol),
  });

  if (!protectionResult.protectionAttached) {
    throw new Error(protectionResult.protectionNote || "No se pudo montar la protección en este intento.");
  }

  const nextPayload = {
    ...(record.response_payload && typeof record.response_payload === "object" ? record.response_payload : {}),
    protection: protectionResult,
    protectionRetriedAt: new Date().toISOString(),
  };

  const nextRecord = await updateExecutionRecord(record.id, {
    lifecycle_status: "protected",
    protection_status: "active",
    linked_order_ids: {
      ...(record.linked_order_ids && typeof record.linked_order_ids === "object" ? record.linked_order_ids : {}),
      ...extractLinkedOrderIdsFromProtection(protectionResult.protectionOrder),
    },
    last_synced_at: new Date().toISOString(),
    notes: `${String(record.notes || "").trim()} · Protección añadida después de la apertura.`,
    response_payload: nextPayload,
  });

  if (signal?.id) {
    const nextLearningSnapshot = buildExecutionLearningSnapshot({
      signal,
      record: nextRecord || {
        ...record,
        lifecycle_status: "protected",
        protection_status: "active",
        response_payload: nextPayload,
      },
      lifecycleStatus: "protected",
      protectionStatus: "active",
      realizedPnl: Number(record.realized_pnl || 0),
      closedAt: record.closed_at || null,
    });
    await updateSignalExecutionStateForUser(username, signal, {
      executionOrderId: record.id,
      executionStatus: "protected",
      executionMode: String(record.mode || "execute"),
      executionUpdatedAt: new Date().toISOString(),
      signalPayloadMerge: {
        executionLearning: nextLearningSnapshot,
      },
    }).catch(() => null);
  }

  return {
    success: true,
    record: nextRecord || {
      ...record,
      lifecycle_status: "protected",
      protection_status: "active",
      response_payload: nextPayload,
    },
    protection: protectionResult,
  };
}

async function reconcileExecutionRecordsForUser(username, options = {}) {
  const signalsLimit = Number(options.signalsLimit || 500);
  const ordersLimit = Number(options.ordersLimit || 500);
  const portfolioPayload = options.portfolioPayload || {
    openOrders: [],
    recentOrders: [],
    recentTrades: [],
    assets: [],
    portfolio: {
      cashValue: 0,
      totalValue: 0,
    },
  };
  const [signals, executionOrdersRaw] = await Promise.all([
    listSignalSnapshotsForUser(username, { limit: signalsLimit }),
    listExecutionOrdersForUser(username, { limit: ordersLimit }),
  ]);

  const signalMap = new Map((signals || []).map((item) => [Number(item.id), item]));
  const missingSignalIds = collectMissingSignalIds(signalMap, executionOrdersRaw || []);
  const reconciledOrders = await repairExecutionOrderBotContextForUser(
    username,
    await syncExecutionOrdersForUser(username, portfolioPayload, signals, executionOrdersRaw || []),
  );

  return {
    username,
    signalsLoaded: Array.isArray(signals) ? signals.length : 0,
    executionOrdersLoaded: Array.isArray(executionOrdersRaw) ? executionOrdersRaw.length : 0,
    missingSignalIdsResolved: missingSignalIds.length,
    reconciledOrders: Array.isArray(reconciledOrders) ? reconciledOrders.length : 0,
  };
}

const __executionEngineInternals = {
  buildExecutionOrderBotContextRepairs,
  collectMissingSignalIds,
  deriveExecutionSide,
  getDecisionExecutionOrderId,
  getExecutionOrderBotContextId,
  getSignalExecutionSide,
  normalizeExecutionSideValue,
  shouldPersistSignalExecutionLearning,
};

export {
  __executionEngineInternals,
  attachProtectionToExecutionOrderForUser,
  buildExecutionCenterFromDependencies,
  buildExecutionDashboardSummaryFromDependencies,
  evaluateSignalEdgeSafety,
  executeSignalTrade,
  executeSignalTradeForUser,
  getExecutionDashboardSummary,
  getExecutionDashboardSummaryForUser,
  getExecutionCenter,
  getExecutionCenterForUser,
  getExecutionProfileForUser,
  listExecutionOrdersForUser,
  reconcileExecutionRecordsForUser,
  saveExecutionProfileForUser,
  sendJson,
  updateExecutionProfile,
};
