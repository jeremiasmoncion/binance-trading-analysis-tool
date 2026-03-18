import { getSession, parseJsonBody, sendJson } from "./auth.js";
import { isRunnableStrategyVersion } from "./marketRuntime.js";
import { backfillSignalLearningDatasetForUser } from "./signals.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STRATEGY_REGISTRY_TABLE = process.env.SUPABASE_STRATEGY_REGISTRY_TABLE || "strategy_registry";
const STRATEGY_VERSIONS_TABLE = process.env.SUPABASE_STRATEGY_VERSIONS_TABLE || "strategy_versions";
const STRATEGY_EXPERIMENTS_TABLE = process.env.SUPABASE_STRATEGY_EXPERIMENTS_TABLE || "strategy_experiments";
const STRATEGY_RECOMMENDATIONS_TABLE = process.env.SUPABASE_STRATEGY_RECOMMENDATIONS_TABLE || "strategy_recommendations";
const SIGNALS_TABLE = process.env.SUPABASE_SIGNALS_TABLE || "signal_snapshots";
const EXECUTION_PROFILES_TABLE = process.env.SUPABASE_EXECUTION_PROFILES_TABLE || "execution_profiles";
const EXECUTION_SCOPE_OVERRIDES_TABLE = process.env.SUPABASE_EXECUTION_SCOPE_OVERRIDES_TABLE || "execution_scope_overrides";
const ADAPTIVE_ACTIONS_LOG_TABLE = process.env.SUPABASE_ADAPTIVE_ACTIONS_LOG_TABLE || "adaptive_actions_log";
const SIGNAL_FEATURE_SNAPSHOTS_TABLE = process.env.SUPABASE_SIGNAL_FEATURE_SNAPSHOTS_TABLE || "signal_feature_snapshots";
const AI_MODEL_CONFIGS_TABLE = process.env.SUPABASE_AI_MODEL_CONFIGS_TABLE || "ai_model_configs";
const BACKTEST_RUNS_TABLE = process.env.SUPABASE_BACKTEST_RUNS_TABLE || "backtest_runs";
const BACKTEST_RUN_WINDOWS_TABLE = process.env.SUPABASE_BACKTEST_RUN_WINDOWS_TABLE || "backtest_run_windows";
const ACTIVE_VERSION_STATUSES = new Set(["active", "promoted", "running"]);
const SANDBOX_EXPERIMENT_STATUSES = new Set(["sandbox", "active", "running"]);
const PROFILE_METADATA_PREFIX = "__CRYPE_EXECUTION_PROFILE__:";

const DEFAULT_EXECUTION_PROFILE = {
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

const FALLBACK_REGISTRY = [
  {
    id: 1,
    strategy_id: "trend-alignment",
    label: "Trend Alignment",
    description: "Estrategia base de tendencia, momentum y alineación de marcos.",
    category: "trend",
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    strategy_id: "breakout",
    label: "Breakout",
    description: "Estrategia de ruptura con confirmación de volumen y contexto mayor.",
    category: "breakout",
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const FALLBACK_VERSIONS = [
  {
    id: 1,
    strategy_id: "trend-alignment",
    version: "v1",
    label: "Trend Alignment v1",
    preferred_timeframes: ["15m", "1h", "4h"],
    trading_style: "intradía",
    holding_profile: "corto a medio",
    ideal_market_conditions: ["tendencia", "pullback ordenado"],
    parameters: {
      trendWeight: 20,
      oversoldBoost: 15,
      overboughtPenalty: 15,
      buyThreshold: 65,
      sellThreshold: 35,
    },
    notes: "Versión inicial basada en tendencia, RSI y alineación.",
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    strategy_id: "trend-alignment",
    version: "v2",
    label: "Trend Alignment v2",
    preferred_timeframes: ["1h", "4h", "1d"],
    trading_style: "swing corto",
    holding_profile: "medio",
    ideal_market_conditions: ["tendencia limpia", "alta alineación", "volumen fuerte"],
    parameters: {
      trendWeight: 24,
      oversoldBoost: 10,
      overboughtPenalty: 10,
      higherFrameBonus: 12,
      mixedFramePenalty: 8,
      buyThreshold: 69,
      sellThreshold: 31,
    },
    notes: "Variante más estricta que prioriza marcos altos y penaliza contextos mixtos.",
    status: "experimental",
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    strategy_id: "breakout",
    version: "v1",
    label: "Breakout v1",
    preferred_timeframes: ["5m", "15m", "1h"],
    trading_style: "scalping / intradía",
    holding_profile: "rápido",
    ideal_market_conditions: ["ruptura", "expansión", "volumen fuerte"],
    parameters: {
      lookbackCandles: 20,
      breakoutBufferPct: 0.1,
      volumeThreshold: 1.15,
      buyThreshold: 68,
      sellThreshold: 32,
    },
    notes: "Versión inicial basada en ruptura de rango y volumen.",
    status: "active",
    created_at: new Date().toISOString(),
  },
];

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase no está configurado para el motor de estrategias");
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

function isMissingRelationError(error) {
  const message = String(error instanceof Error ? error.message : error || "").toLowerCase();
  return message.includes("42p01") || message.includes("does not exist") || message.includes("relation");
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function parseRequestBody(req) {
  if (req?.body !== undefined && req?.body !== null) {
    return parseJsonBody(req);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
  const note = String(profile.note || DEFAULT_EXECUTION_PROFILE.note);
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

function normalizeExecutionProfile(row, username) {
  const parsedNote = parseProfileNoteEnvelope(row?.note);
  return {
    username,
    enabled: row?.enabled ?? DEFAULT_EXECUTION_PROFILE.enabled,
    autoExecuteEnabled: row?.auto_execute_enabled ?? DEFAULT_EXECUTION_PROFILE.autoExecuteEnabled,
    riskPerTradePct: Number(row?.risk_per_trade_pct ?? DEFAULT_EXECUTION_PROFILE.riskPerTradePct),
    maxOpenPositions: Number(row?.max_open_positions ?? DEFAULT_EXECUTION_PROFILE.maxOpenPositions),
    maxPositionUsd: Number(row?.max_position_usd ?? DEFAULT_EXECUTION_PROFILE.maxPositionUsd),
    maxDailyLossPct: Number(row?.max_daily_loss_pct ?? DEFAULT_EXECUTION_PROFILE.maxDailyLossPct),
    minSignalScore: Number(row?.min_signal_score ?? DEFAULT_EXECUTION_PROFILE.minSignalScore),
    minRrRatio: Number(row?.min_rr_ratio ?? DEFAULT_EXECUTION_PROFILE.minRrRatio),
    maxDailyAutoExecutions: Number(row?.max_daily_auto_executions ?? DEFAULT_EXECUTION_PROFILE.maxDailyAutoExecutions),
    cooldownAfterLosses: Number(row?.cooldown_after_losses ?? DEFAULT_EXECUTION_PROFILE.cooldownAfterLosses),
    allowedStrategies: normalizeArray(row?.allowed_strategies).length ? normalizeArray(row?.allowed_strategies) : DEFAULT_EXECUTION_PROFILE.allowedStrategies,
    allowedTimeframes: normalizeArray(row?.allowed_timeframes).length ? normalizeArray(row?.allowed_timeframes) : DEFAULT_EXECUTION_PROFILE.allowedTimeframes,
    scopeOverrides: parsedNote.scopeOverrides,
    scorerPolicy: parsedNote.scorerPolicy || null,
    note: parsedNote.note || DEFAULT_EXECUTION_PROFILE.note,
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

async function getExecutionProfileForUser(username, modelConfigs = null) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "updated_at.desc.nullslast,created_at.desc",
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`).catch(() => []);
  const normalized = normalizeExecutionProfile(rows?.[0] || null, username);
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
  const configRows = Array.isArray(modelConfigs) ? modelConfigs : await fetchModelConfigsForUser(username).catch(() => []);
  const activeModelConfig = normalizeModelConfigRegistry(configRows).find((item) => item.active) || null;
  if (activeModelConfig?.label) {
    normalized.scorerPolicy = {
      activeScorer: activeModelConfig.label,
      promotedAt: activeModelConfig.updatedAt || activeModelConfig.createdAt,
      source: activeModelConfig.source || normalized.scorerPolicy?.source,
      confidence: activeModelConfig.confidence ?? normalized.scorerPolicy?.confidence,
    };
  }
  return normalized;
}

async function upsertExecutionScopeOverrideForUser(username, override, sourceMeta = {}) {
  const body = [{
    username: String(username),
    strategy_id: String(override.strategyId || ""),
    timeframe: String(override.timeframe || ""),
    enabled: override.enabled !== false,
    action: String(override.action || ""),
    min_signal_score: override.minSignalScore == null ? null : Number(override.minSignalScore),
    min_rr_ratio: override.minRrRatio == null ? null : Number(override.minRrRatio),
    note: String(override.note || ""),
    source: String(sourceMeta.source || "system"),
    recommendation_id: sourceMeta.recommendationId == null ? null : Number(sourceMeta.recommendationId),
    experiment_id: sourceMeta.experimentId == null ? null : Number(sourceMeta.experimentId),
  }];
  try {
    await supabaseRequest(`${EXECUTION_SCOPE_OVERRIDES_TABLE}?on_conflict=username,strategy_id,timeframe`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body,
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

async function insertAdaptiveActionLogForUser(username, payload) {
  try {
    await supabaseRequest(ADAPTIVE_ACTIONS_LOG_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: [{
        username: String(username),
        action_type: String(payload.actionType || ""),
        target_type: String(payload.targetType || ""),
        target_key: String(payload.targetKey || ""),
        strategy_id: payload.strategyId ? String(payload.strategyId) : null,
        strategy_version: payload.strategyVersion ? String(payload.strategyVersion) : null,
        timeframe: payload.timeframe ? String(payload.timeframe) : null,
        recommendation_id: payload.recommendationId == null ? null : Number(payload.recommendationId),
        experiment_id: payload.experimentId == null ? null : Number(payload.experimentId),
        signal_id: payload.signalId == null ? null : Number(payload.signalId),
        execution_order_id: payload.executionOrderId == null ? null : Number(payload.executionOrderId),
        source: String(payload.source || "system"),
        status: String(payload.status || "applied"),
        summary: String(payload.summary || ""),
        details: payload.details && typeof payload.details === "object" ? payload.details : {},
      }],
    });
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
}

async function fetchRecentAdaptiveActions(username, targetType, limit = 12) {
  try {
    const params = new URLSearchParams({
      select: "id,action_type,target_type,target_key,source,status,summary,details,created_at",
      username: `eq.${String(username)}`,
      target_type: `eq.${String(targetType)}`,
      order: "created_at.desc",
      limit: String(limit),
    });
    return await supabaseRequest(`${ADAPTIVE_ACTIONS_LOG_TABLE}?${params.toString()}`);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    return [];
  }
}

function buildScorerEvaluationSignature(evaluation) {
  return JSON.stringify({
    scorer: String(evaluation?.scorer || ""),
    challenger: String(evaluation?.challenger || ""),
    windowType: String(evaluation?.windowType || "recent"),
    action: String(evaluation?.action || "observe"),
    readiness: String(evaluation?.readiness || "low"),
    sampleSize: Number(evaluation?.sampleSize || 0),
    challengerSampleSize: Number(evaluation?.challengerSampleSize || 0),
    avgPnl: Number(Number(evaluation?.avgPnl || 0).toFixed(2)),
    challengerAvgPnl: Number(Number(evaluation?.challengerAvgPnl || 0).toFixed(2)),
    winRate: Number(Number(evaluation?.winRate || 0).toFixed(2)),
    challengerWinRate: Number(Number(evaluation?.challengerWinRate || 0).toFixed(2)),
    edgeDelta: Number(Number(evaluation?.edgeDelta || 0).toFixed(2)),
    winRateDelta: Number(Number(evaluation?.winRateDelta || 0).toFixed(2)),
    confidence: Number(Number(evaluation?.confidence || 0).toFixed(1)),
  });
}

function buildModelTrainingRunSignature(run) {
  return JSON.stringify({
    label: String(run?.label || ""),
    windowType: String(run?.windowType || "global"),
    mode: String(run?.mode || "learned"),
    sampleSize: Number(run?.sampleSize || 0),
    confidence: Number(Number(run?.confidence || 0).toFixed(1)),
    avgPnl: Number(Number(run?.avgPnl || 0).toFixed(2)),
    winRate: Number(Number(run?.winRate || 0).toFixed(2)),
    rrWeight: Number(Number(run?.rrWeight || 0).toFixed(3)),
    adaptiveScoreWeight: Number(Number(run?.adaptiveScoreWeight || 0).toFixed(4)),
    durationPenaltyWeight: Number(Number(run?.durationPenaltyWeight || 0).toFixed(3)),
  });
}

function buildModelWindowGovernanceSignature(governance) {
  return JSON.stringify({
    activeScorer: String(governance?.activeScorer || ""),
    candidateScorer: String(governance?.candidateScorer || ""),
    action: String(governance?.action || "observe"),
    alignedWindows: Number(governance?.alignedWindows || 0),
    conflictingWindows: Number(governance?.conflictingWindows || 0),
    confidence: Number(Number(governance?.confidence || 0).toFixed(1)),
    windowVotes: Array.isArray(governance?.windowVotes)
      ? governance.windowVotes.map((item) => ({
        windowType: String(item?.windowType || "global"),
        vote: String(item?.vote || "observe"),
        sampleSize: Number(item?.sampleSize || 0),
        edgeDelta: Number(Number(item?.edgeDelta || 0).toFixed(2)),
        winRateDelta: Number(Number(item?.winRateDelta || 0).toFixed(2)),
        confidence: Number(Number(item?.confidence || 0).toFixed(1)),
      }))
      : [],
  });
}

async function recordScorerEvaluationHistory(username, scorerEvaluations) {
  const rows = Array.isArray(scorerEvaluations) ? scorerEvaluations : [];
  if (!rows.length) return;

  const recentLogs = await fetchRecentAdaptiveActions(username, "scorer-model-evaluation", 8);
  const latestByWindow = new Map();
  for (const row of recentLogs || []) {
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    const windowType = String(details.windowType || "");
    if (windowType && !latestByWindow.has(windowType)) {
      latestByWindow.set(windowType, row);
    }
  }

  for (const evaluation of rows) {
    const windowType = String(evaluation?.windowType || "recent");
    const signature = buildScorerEvaluationSignature(evaluation);
    const latest = latestByWindow.get(windowType);
    const latestDetails = latest?.details && typeof latest.details === "object" ? latest.details : {};
    if (String(latestDetails.signature || "") === signature) continue;

    await insertAdaptiveActionLogForUser(username, {
      actionType: "model-evaluation",
      targetType: "scorer-model-evaluation",
      targetKey: `${windowType}:${evaluation.scorer}->${evaluation.challenger}`,
      source: "adaptive-governance",
      status: evaluation.action,
      summary: evaluation.summary,
      details: {
        signature,
        windowType,
        scorer: evaluation.scorer,
        challenger: evaluation.challenger,
        sampleSize: Number(evaluation.sampleSize || 0),
        challengerSampleSize: Number(evaluation.challengerSampleSize || 0),
        avgPnl: Number(evaluation.avgPnl || 0),
        challengerAvgPnl: Number(evaluation.challengerAvgPnl || 0),
        pnl: Number(evaluation.pnl || 0),
        challengerPnl: Number(evaluation.challengerPnl || 0),
        winRate: Number(evaluation.winRate || 0),
        challengerWinRate: Number(evaluation.challengerWinRate || 0),
        edgeDelta: Number(evaluation.edgeDelta || 0),
        winRateDelta: Number(evaluation.winRateDelta || 0),
        confidence: Number(evaluation.confidence || 0),
        readiness: String(evaluation.readiness || "low"),
      },
    }).catch(() => null);
  }
}

async function recordModelWindowGovernanceHistory(username, governance) {
  if (!governance?.candidateScorer) return;
  const recentLogs = await fetchRecentAdaptiveActions(username, "model-window-governance", 6);
  const signature = buildModelWindowGovernanceSignature(governance);
  const latest = (recentLogs || [])[0];
  const latestDetails = latest?.details && typeof latest.details === "object" ? latest.details : {};
  if (String(latestDetails.signature || "") === signature) return;

  await insertAdaptiveActionLogForUser(username, {
    actionType: "model-window-governance",
    targetType: "model-window-governance",
    targetKey: `${governance.activeScorer}->${governance.candidateScorer}`,
    source: "adaptive-governance",
    status: String(governance.action || "observe"),
    summary: String(governance.summary || ""),
    details: {
      signature,
      activeScorer: governance.activeScorer,
      candidateScorer: governance.candidateScorer,
      challengerMode: governance.challengerMode,
      alignedWindows: Number(governance.alignedWindows || 0),
      conflictingWindows: Number(governance.conflictingWindows || 0),
      confidence: Number(governance.confidence || 0),
      windowVotes: Array.isArray(governance.windowVotes) ? governance.windowVotes : [],
    },
  }).catch(() => null);
}

function normalizeModelTrainingRunHistory(rows) {
  return (rows || []).map((row) => {
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    return {
      id: row?.id,
      label: String(details.label || row?.target_key || ""),
      windowType: String(details.windowType || "global"),
      mode: String(details.mode || "learned"),
      sampleSize: Number(details.sampleSize || 0),
      confidence: Number(details.confidence || 0),
      avgPnl: Number(details.avgPnl || 0),
      winRate: Number(details.winRate || 0),
      rrWeight: details.rrWeight == null ? undefined : Number(details.rrWeight),
      adaptiveScoreWeight: details.adaptiveScoreWeight == null ? undefined : Number(details.adaptiveScoreWeight),
      durationPenaltyWeight: details.durationPenaltyWeight == null ? undefined : Number(details.durationPenaltyWeight),
      summary: String(row?.summary || details.summary || ""),
      status: row?.status ? String(row.status) : undefined,
      createdAt: row?.created_at ? String(row.created_at) : undefined,
    };
  });
}

function normalizeModelConfigHistory(rows) {
  return (rows || []).map((row) => {
    if (row?.active_scorer || row?.label) {
      return {
        id: row?.id,
        activeScorer: String(row?.active_scorer || row?.label || ""),
        source: row?.source ? String(row.source) : undefined,
        confidence: row?.confidence == null ? undefined : Number(row.confidence),
        summary: row?.summary ? String(row.summary) : undefined,
        createdAt: row?.created_at ? String(row.created_at) : undefined,
        status: row?.status ? String(row.status) : undefined,
      };
    }
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    const scorerPolicy = details.scorerPolicy && typeof details.scorerPolicy === "object" ? details.scorerPolicy : {};
    return {
      id: row?.id,
      activeScorer: String(scorerPolicy.activeScorer || row?.target_key || ""),
      source: scorerPolicy.source ? String(scorerPolicy.source) : undefined,
      confidence: scorerPolicy.confidence == null ? undefined : Number(scorerPolicy.confidence),
      summary: row?.summary ? String(row.summary) : undefined,
      createdAt: row?.created_at ? String(row.created_at) : undefined,
      status: row?.status ? String(row.status) : undefined,
    };
  });
}

function normalizeModelWindowGovernanceHistory(rows) {
  return (rows || []).map((row) => {
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    return {
      id: row?.id == null ? undefined : Number(row.id),
      activeScorer: String(details.activeScorer || ""),
      candidateScorer: String(details.candidateScorer || row?.target_key || ""),
      challengerMode: details.challengerMode ? String(details.challengerMode) : undefined,
      alignedWindows: Number(details.alignedWindows || 0),
      conflictingWindows: Number(details.conflictingWindows || 0),
      confidence: Number(details.confidence || 0),
      action: String(row?.status || "observe"),
      summary: String(row?.summary || ""),
      windowVotes: Array.isArray(details.windowVotes) ? details.windowVotes : [],
      createdAt: row?.created_at ? String(row.created_at) : undefined,
    };
  }).filter((item) => item.activeScorer || item.candidateScorer);
}

function normalizeBacktestRuns(rows, windowsByRunId = new Map()) {
  return (rows || []).map((row) => {
    const reportPayload = row?.report_payload && typeof row.report_payload === "object" ? row.report_payload : {};
    const rawWindows = windowsByRunId.get(Number(row?.id)) || reportPayload.replayWindows || [];
    const windows = (rawWindows || []).map((item) => ({
      label: String(item.label || "Recent"),
      key: String(item.key || String(item.label || "recent").toLowerCase()),
      total: Number(item.total || item.sampleSize || 0),
      activeScorer: String(item.activeScorer || ""),
      challengerScorer: String(item.challengerScorer || ""),
      activeAvgPnl: Number(item.activeAvgPnl || 0),
      challengerAvgPnl: Number(item.challengerAvgPnl || 0),
      activeWinRate: Number(item.activeWinRate || 0),
      challengerWinRate: Number(item.challengerWinRate || 0),
      verdict: String(item.verdict || ""),
    }));
    return {
      id: row?.id == null ? undefined : Number(row.id),
      label: String(row?.label || reportPayload?.label || "Run manual"),
      triggerSource: String(row?.trigger_source || reportPayload?.triggerSource || "manual"),
      activeScorer: String(row?.active_scorer || reportPayload?.summary?.activeScorer || "adaptive-v1"),
      maturityScore: Number(row?.maturity_score ?? reportPayload?.summary?.maturityScore ?? 0),
      closedSignals: Number(row?.closed_signals ?? reportPayload?.summary?.closedSignals ?? 0),
      featureSnapshots: Number(row?.feature_snapshots ?? reportPayload?.summary?.featureSnapshots ?? 0),
      passedInvariants: Number(row?.passed_invariants ?? reportPayload?.summary?.passedInvariants ?? 0),
      warnedInvariants: Number(row?.warned_invariants ?? reportPayload?.summary?.warnedInvariants ?? 0),
      failedInvariants: Number(row?.failed_invariants ?? reportPayload?.summary?.failedInvariants ?? 0),
      summary: String(row?.summary || reportPayload?.summaryText || "Sin resumen"),
      status: String(row?.status || reportPayload?.runStatus || "completed"),
      createdAt: row?.created_at ? String(row.created_at) : undefined,
      windows,
    };
  });
}

function buildValidationReportFromStoredRun(run) {
  if (!run) return null;
  const payload = run.report_payload && typeof run.report_payload === "object" ? run.report_payload : {};
  const report = payload && typeof payload === "object" && Array.isArray(payload.invariants)
    ? payload
    : null;
  if (!report) return null;
  return {
    generatedAt: String(report.generatedAt || run.created_at || new Date().toISOString()),
    summary: {
      maturityScore: Number(report.summary?.maturityScore || run.maturity_score || 0),
      closedSignals: Number(report.summary?.closedSignals || run.closed_signals || 0),
      featureSnapshots: Number(report.summary?.featureSnapshots || run.feature_snapshots || 0),
      passedInvariants: Number(report.summary?.passedInvariants || run.passed_invariants || 0),
      warnedInvariants: Number(report.summary?.warnedInvariants || run.warned_invariants || 0),
      failedInvariants: Number(report.summary?.failedInvariants || run.failed_invariants || 0),
      activeScorer: String(report.summary?.activeScorer || run.active_scorer || "adaptive-v1"),
    },
    invariants: Array.isArray(report.invariants) ? report.invariants : [],
    scorerTable: Array.isArray(report.scorerTable) ? report.scorerTable : [],
    replayWindows: Array.isArray(report.replayWindows) ? report.replayWindows : [],
    scenarios: Array.isArray(report.scenarios) ? report.scenarios : [],
    modelWindowGovernance: report.modelWindowGovernance || null,
    modelWindowGovernanceHistory: Array.isArray(report.modelWindowGovernanceHistory) ? report.modelWindowGovernanceHistory : [],
  };
}

function buildValidationReportFromRunSummary(run) {
  if (!run) return null;
  return {
    generatedAt: String(run.createdAt || new Date().toISOString()),
    summary: {
      maturityScore: Number(run.maturityScore || 0),
      closedSignals: Number(run.closedSignals || 0),
      featureSnapshots: Number(run.featureSnapshots || 0),
      passedInvariants: Number(run.passedInvariants || 0),
      warnedInvariants: Number(run.warnedInvariants || 0),
      failedInvariants: Number(run.failedInvariants || 0),
      activeScorer: String(run.activeScorer || "adaptive-v1"),
    },
    invariants: [],
    scorerTable: [],
    replayWindows: Array.isArray(run.windows) ? run.windows : [],
    scenarios: [
      {
        title: "Última corrida guardada",
        status: Number(run.failedInvariants || 0) > 0 ? "warning" : "neutral",
        summary: String(run.summary || "La última corrida guardada se usa como lectura rápida del laboratorio."),
      },
    ],
    modelWindowGovernance: null,
    modelWindowGovernanceHistory: [],
  };
}

function normalizeModelConfigRegistry(rows) {
  return (rows || []).map((row) => {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    return {
      id: row?.id,
      label: String(row?.label || row?.active_scorer || ""),
      mode: String(row?.mode || "learned"),
      windowType: String(row?.window_type || metadata.windowType || "global"),
      active: row?.active === true,
      ready: row?.ready !== false,
      sampleSize: Number(row?.sample_size || 0),
      confidence: Number(row?.confidence || 0),
      avgPnl: Number(row?.avg_pnl || 0),
      winRate: Number(row?.win_rate || 0),
      rrWeight: row?.rr_weight == null ? undefined : Number(row.rr_weight),
      adaptiveScoreWeight: row?.adaptive_score_weight == null ? undefined : Number(row.adaptive_score_weight),
      durationPenaltyWeight: row?.duration_penalty_weight == null ? undefined : Number(row.duration_penalty_weight),
      reading: row?.summary ? String(row.summary) : undefined,
      status: row?.status ? String(row.status) : undefined,
      source: row?.source ? String(row.source) : undefined,
      updatedAt: row?.updated_at ? String(row.updated_at) : undefined,
      createdAt: row?.created_at ? String(row.created_at) : undefined,
    };
  }).filter((item) => item.label);
}

async function fetchModelConfigsForUser(username) {
  try {
    return await supabaseRequest(
      `${AI_MODEL_CONFIGS_TABLE}?select=*&username=eq.${encodeURIComponent(String(username))}&order=updated_at.desc.nullslast,created_at.desc`,
    );
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function upsertModelConfigsForUser(username, modelRuns, activeScorer) {
  const rows = Array.isArray(modelRuns) ? modelRuns : [];
  if (!rows.length) return [];
  try {
    return await supabaseRequest(AI_MODEL_CONFIGS_TABLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: rows.map((run) => ({
        username,
        label: String(run.label || ""),
        active_scorer: String(run.label || ""),
        mode: String(run.mode || "learned"),
        window_type: String(run.windowType || "global"),
        active: String(activeScorer || "").toLowerCase() === String(run.label || "").toLowerCase(),
        ready: Boolean(run.ready),
        sample_size: Number(run.sampleSize || 0),
        confidence: Number(run.confidence || 0),
        avg_pnl: Number(run.avgPnl || 0),
        win_rate: Number(run.winRate || 0),
        rr_weight: run.rrWeight == null ? null : Number(run.rrWeight),
        adaptive_score_weight: run.adaptiveScoreWeight == null ? null : Number(run.adaptiveScoreWeight),
        duration_penalty_weight: run.durationPenaltyWeight == null ? null : Number(run.durationPenaltyWeight),
        source: "training-run",
        status: run.ready ? "ready" : "observe",
        summary: String(run.reading || ""),
        metadata: {
          windowType: run.windowType,
          sampleSize: run.sampleSize,
          confidence: run.confidence,
        },
      })),
    });
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function fetchBacktestRunsForUser(username, limit = 12) {
  try {
    const params = new URLSearchParams({
      select: "*",
      username: `eq.${String(username)}`,
      order: "created_at.desc",
      limit: String(limit),
    });
    const runs = await supabaseRequest(`${BACKTEST_RUNS_TABLE}?${params.toString()}`);
    const runIds = (runs || []).map((item) => Number(item.id)).filter(Boolean);
    const windowsByRunId = new Map();
    if (runIds.length) {
      const windowParams = new URLSearchParams({
        select: "*",
        run_id: `in.(${runIds.join(",")})`,
        order: "created_at.desc",
      });
      const windows = await supabaseRequest(`${BACKTEST_RUN_WINDOWS_TABLE}?${windowParams.toString()}`).catch(() => []);
      for (const row of windows || []) {
        const runId = Number(row?.run_id || 0);
        if (!runId) continue;
        if (!windowsByRunId.has(runId)) windowsByRunId.set(runId, []);
        windowsByRunId.get(runId).push({
          label: String(row?.window_label || "Recent"),
          key: String(row?.window_key || String(row?.window_label || "recent").toLowerCase()),
          total: Number(row?.sample_size || 0),
          activeScorer: String(row?.active_scorer || ""),
          challengerScorer: String(row?.challenger_scorer || ""),
          activeAvgPnl: Number(row?.active_avg_pnl || 0),
          challengerAvgPnl: Number(row?.challenger_avg_pnl || 0),
          activeWinRate: Number(row?.active_win_rate || 0),
          challengerWinRate: Number(row?.challenger_win_rate || 0),
          verdict: String(row?.verdict || ""),
        });
      }
    }
    return normalizeBacktestRuns(runs, windowsByRunId);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const fallbackRows = await fetchRecentAdaptiveActions(username, "backtest-run", limit);
  return normalizeBacktestRuns((fallbackRows || []).map((row) => ({
    id: row?.id,
    label: row?.target_key,
    trigger_source: row?.source,
    active_scorer: row?.details?.summary?.activeScorer,
    maturity_score: row?.details?.summary?.maturityScore,
    closed_signals: row?.details?.summary?.closedSignals,
    feature_snapshots: row?.details?.summary?.featureSnapshots,
    passed_invariants: row?.details?.summary?.passedInvariants,
    warned_invariants: row?.details?.summary?.warnedInvariants,
    failed_invariants: row?.details?.summary?.failedInvariants,
    summary: row?.summary,
    report_payload: row?.details,
    created_at: row?.created_at,
  })));
}

async function fetchLatestBacktestRunRowForUser(username) {
  try {
    const params = new URLSearchParams({
      select: "*",
      username: `eq.${String(username)}`,
      order: "created_at.desc",
      limit: "1",
    });
    const rows = await supabaseRequest(`${BACKTEST_RUNS_TABLE}?${params.toString()}`);
    return rows?.[0] || null;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const fallbackRows = await fetchRecentAdaptiveActions(username, "backtest-run", 1);
  const row = fallbackRows?.[0];
  if (!row) return null;
  return {
    id: row?.id,
    label: row?.target_key,
    trigger_source: row?.source,
    active_scorer: row?.details?.summary?.activeScorer,
    maturity_score: row?.details?.summary?.maturityScore,
    closed_signals: row?.details?.summary?.closedSignals,
    feature_snapshots: row?.details?.summary?.featureSnapshots,
    passed_invariants: row?.details?.summary?.passedInvariants,
    warned_invariants: row?.details?.summary?.warnedInvariants,
    failed_invariants: row?.details?.summary?.failedInvariants,
    summary: row?.summary,
    report_payload: row?.details,
    created_at: row?.created_at,
  };
}

async function createPendingBacktestRunForUser(username, options = {}) {
  const runLabel = String(options.label || `Run ${new Date().toLocaleString("es-DO")}`);
  const requestedAt = new Date().toISOString();
  const runPayload = {
    username: String(username),
    label: runLabel,
    trigger_source: String(options.triggerSource || "manual"),
    active_scorer: String(options.activeScorer || "adaptive-v1"),
    maturity_score: 0,
    closed_signals: 0,
    feature_snapshots: 0,
    passed_invariants: 0,
    warned_invariants: 0,
    failed_invariants: 0,
    summary: "Corrida en cola. Todavía no se ha procesado.",
    report_payload: {
      runStatus: "queued",
      requestedAt,
      label: runLabel,
      triggerSource: String(options.triggerSource || "manual"),
      summaryText: "Corrida en cola. Todavía no se ha procesado.",
    },
  };

  try {
    const rows = await supabaseRequest(BACKTEST_RUNS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [runPayload],
    });
    return normalizeBacktestRuns(rows || [runPayload])[0] || null;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  await insertAdaptiveActionLogForUser(username, {
    actionType: "backtest-run",
    targetType: "backtest-run",
    targetKey: runLabel,
    source: String(options.triggerSource || "manual"),
    status: "queued",
    summary: "Corrida en cola. Todavía no se ha procesado.",
    details: runPayload.report_payload,
  }).catch(() => null);

  return {
    label: runLabel,
    triggerSource: String(options.triggerSource || "manual"),
    activeScorer: String(options.activeScorer || "adaptive-v1"),
    maturityScore: 0,
    closedSignals: 0,
    featureSnapshots: 0,
    passedInvariants: 0,
    warnedInvariants: 0,
    failedInvariants: 0,
    summary: "Corrida en cola. Todavía no se ha procesado.",
    status: "queued",
    createdAt: requestedAt,
    windows: [],
  };
}

async function updateBacktestRunForUser(username, runId, report, options = {}) {
  const runLabel = String(options.label || `Run ${new Date().toLocaleString("es-DO")}`);
  const runStatus = String(options.runStatus || "completed");
  const summaryText = `${report.summary.activeScorer} · madurez ${report.summary.maturityScore}/100 · ${report.summary.closedSignals} cierres auditados`;
  const runPayload = {
    label: runLabel,
    trigger_source: String(options.triggerSource || "manual"),
    active_scorer: String(report.summary.activeScorer || "adaptive-v1"),
    maturity_score: Number(report.summary.maturityScore || 0),
    closed_signals: Number(report.summary.closedSignals || 0),
    feature_snapshots: Number(report.summary.featureSnapshots || 0),
    passed_invariants: Number(report.summary.passedInvariants || 0),
    warned_invariants: Number(report.summary.warnedInvariants || 0),
    failed_invariants: Number(report.summary.failedInvariants || 0),
    summary: summaryText,
    report_payload: {
      ...report,
      runStatus,
      label: runLabel,
      triggerSource: String(options.triggerSource || "manual"),
      summaryText,
      completedAt: new Date().toISOString(),
    },
  };

  try {
    const params = new URLSearchParams({
      id: `eq.${Number(runId)}`,
      username: `eq.${String(username)}`,
    });
    const rows = await supabaseRequest(`${BACKTEST_RUNS_TABLE}?${params.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: runPayload,
    });
    await supabaseRequest(`${BACKTEST_RUN_WINDOWS_TABLE}?run_id=eq.${Number(runId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }).catch((error) => {
      if (!isMissingRelationError(error)) throw error;
    });
    if (Array.isArray(report.replayWindows) && report.replayWindows.length) {
      await supabaseRequest(BACKTEST_RUN_WINDOWS_TABLE, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: report.replayWindows.map((item) => ({
          run_id: Number(runId),
          window_key: String(item.key || String(item.label || "recent").toLowerCase()),
          window_label: String(item.label || "Recent"),
          sample_size: Number(item.total || item.sampleSize || 0),
          active_scorer: String(item.activeScorer || ""),
          challenger_scorer: String(item.challengerScorer || ""),
          active_avg_pnl: Number(item.activeAvgPnl || 0),
          challenger_avg_pnl: Number(item.challengerAvgPnl || 0),
          active_win_rate: Number(item.activeWinRate || 0),
          challenger_win_rate: Number(item.challengerWinRate || 0),
          verdict: String(item.verdict || ""),
        })),
      }).catch((error) => {
        if (!isMissingRelationError(error)) throw error;
      });
    }
    return normalizeBacktestRuns(rows || [runPayload])[0] || null;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  return persistBacktestRunForUser(username, report, options);
}

async function fetchQueuedBacktestRunsForUser(username, limit = 4) {
  const runs = await fetchBacktestRunsForUser(username, limit + 8).catch(() => []);
  return (runs || []).filter((item) => item.status === "queued" || item.status === "running").slice(0, limit);
}

async function persistBacktestRunForUser(username, report, options = {}) {
  const runLabel = String(options.label || `Run ${new Date().toLocaleString("es-DO")}`);
  const summaryText = `${report.summary.activeScorer} · madurez ${report.summary.maturityScore}/100 · ${report.summary.closedSignals} cierres auditados`;
  const runPayload = {
    username: String(username),
    label: runLabel,
    trigger_source: String(options.triggerSource || "manual"),
    active_scorer: String(report.summary.activeScorer || "adaptive-v1"),
    maturity_score: Number(report.summary.maturityScore || 0),
    closed_signals: Number(report.summary.closedSignals || 0),
    feature_snapshots: Number(report.summary.featureSnapshots || 0),
    passed_invariants: Number(report.summary.passedInvariants || 0),
    warned_invariants: Number(report.summary.warnedInvariants || 0),
    failed_invariants: Number(report.summary.failedInvariants || 0),
    summary: summaryText,
    report_payload: {
      ...report,
      label: runLabel,
      triggerSource: String(options.triggerSource || "manual"),
      summaryText,
    },
  };

  try {
    const rows = await supabaseRequest(BACKTEST_RUNS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [runPayload],
    });
    const runRow = rows?.[0];
    const runId = Number(runRow?.id || 0);
    if (runId && Array.isArray(report.replayWindows) && report.replayWindows.length) {
      await supabaseRequest(BACKTEST_RUN_WINDOWS_TABLE, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: report.replayWindows.map((item) => ({
          run_id: runId,
          window_key: String(item.key || String(item.label || "recent").toLowerCase()),
          window_label: String(item.label || "Recent"),
          sample_size: Number(item.total || item.sampleSize || 0),
          active_scorer: String(item.activeScorer || ""),
          challenger_scorer: String(item.challengerScorer || ""),
          active_avg_pnl: Number(item.activeAvgPnl || 0),
          challenger_avg_pnl: Number(item.challengerAvgPnl || 0),
          active_win_rate: Number(item.activeWinRate || 0),
          challenger_win_rate: Number(item.challengerWinRate || 0),
          verdict: String(item.verdict || ""),
        })),
      }).catch((error) => {
        if (!isMissingRelationError(error)) throw error;
      });
    }
    return normalizeBacktestRuns(rows || [runPayload])[0] || null;
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  await insertAdaptiveActionLogForUser(username, {
    actionType: "backtest-run",
    targetType: "backtest-run",
    targetKey: runLabel,
    source: String(options.triggerSource || "manual"),
    status: "completed",
    summary: summaryText,
    details: {
      ...runPayload.report_payload,
      replayWindows: report.replayWindows,
    },
  }).catch(() => null);

  return {
    label: runLabel,
    triggerSource: String(options.triggerSource || "manual"),
    activeScorer: String(report.summary.activeScorer || "adaptive-v1"),
    maturityScore: Number(report.summary.maturityScore || 0),
    closedSignals: Number(report.summary.closedSignals || 0),
    featureSnapshots: Number(report.summary.featureSnapshots || 0),
    passedInvariants: Number(report.summary.passedInvariants || 0),
    warnedInvariants: Number(report.summary.warnedInvariants || 0),
    failedInvariants: Number(report.summary.failedInvariants || 0),
    summary: summaryText,
    createdAt: new Date().toISOString(),
    windows: Array.isArray(report.replayWindows) ? report.replayWindows : [],
  };
}

async function setActiveModelConfigForUser(username, candidateScorer, scorerPolicy, modelRegistry = []) {
  const configs = Array.isArray(modelRegistry) && modelRegistry.length
    ? modelRegistry
    : await fetchModelConfigsForUser(username).catch(() => []);
  const rows = (configs || []).filter((item) => item && (item.label || item.active_scorer));
  if (!rows.length) return [];
  try {
    return await supabaseRequest(AI_MODEL_CONFIGS_TABLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: rows.map((row) => {
        const label = String(row.label || row.active_scorer || "");
        return {
          username,
          label,
          active_scorer: label,
          mode: String(row.mode || "learned"),
          window_type: String(row.windowType || row.window_type || "global"),
          active: label.toLowerCase() === String(candidateScorer || "").toLowerCase(),
          ready: row.ready !== false,
          sample_size: Number(row.sampleSize || row.sample_size || 0),
          confidence: Number(row.confidence || 0),
          avg_pnl: Number(row.avgPnl || row.avg_pnl || 0),
          win_rate: Number(row.winRate || row.win_rate || 0),
          rr_weight: row.rrWeight == null && row.rr_weight == null ? null : Number(row.rrWeight ?? row.rr_weight),
          adaptive_score_weight: row.adaptiveScoreWeight == null && row.adaptive_score_weight == null ? null : Number(row.adaptiveScoreWeight ?? row.adaptive_score_weight),
          duration_penalty_weight: row.durationPenaltyWeight == null && row.duration_penalty_weight == null ? null : Number(row.durationPenaltyWeight ?? row.duration_penalty_weight),
          source: scorerPolicy?.source ? String(scorerPolicy.source) : "governance",
          status: label.toLowerCase() === String(candidateScorer || "").toLowerCase() ? "active" : (row.ready !== false ? "ready" : "observe"),
          summary: label.toLowerCase() === String(candidateScorer || "").toLowerCase()
            ? `Configuración activa del modelo ahora apunta a ${label}`
            : String(row.reading || row.summary || ""),
          metadata: {
            scorerPolicy,
            windowType: row.windowType || row.window_type || "global",
          },
        };
      }),
    });
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

function buildLearnedModelRun(label, rows, windowType, scorerPolicy) {
  const cleanRows = (rows || []).filter((row) => row && row.realized_pnl != null);
  const total = cleanRows.length;
  const positiveRows = cleanRows.filter((row) => Number(row.realized_pnl || 0) > 0);
  const negativeRows = cleanRows.filter((row) => Number(row.realized_pnl || 0) <= 0);
  const avg = (list, field) => list.length ? list.reduce((sum, row) => sum + Number(row[field] || 0), 0) / list.length : 0;
  const winRate = total ? (positiveRows.length / total) * 100 : 0;
  const avgPnl = avg(cleanRows, "realized_pnl");
  const posAvgRr = avg(positiveRows, "rr_ratio");
  const negAvgRr = avg(negativeRows, "rr_ratio");
  const posAvgAdaptive = avg(positiveRows, "adaptive_score");
  const negAvgAdaptive = avg(negativeRows, "adaptive_score");
  const posAvgDuration = avg(positiveRows, "duration_minutes");
  const negAvgDuration = avg(negativeRows, "duration_minutes");
  const recentBoost = windowType === "short" ? 0.52 : windowType === "recent" ? 0.35 : 0;
  const rrWeight = Number((3.2 + recentBoost + Math.max(0, posAvgRr - negAvgRr) * 4.2).toFixed(2));
  const adaptiveScoreWeight = Number((0.035 + (windowType === "short" ? 0.006 : windowType === "recent" ? 0.004 : 0) + Math.max(0, posAvgAdaptive - negAvgAdaptive) * 0.0035).toFixed(4));
  const durationPenaltyWeight = Number((0.18 + (windowType === "short" ? 0.05 : windowType === "recent" ? 0.03 : 0) + Math.max(0, posAvgDuration - negAvgDuration) / 240).toFixed(3));
  const confidence = Number(clampScore(
    total * (windowType === "short" ? 3.25 : windowType === "recent" ? 3 : 2.8)
      + Math.max(0, winRate - 48) * 1.1
      + Math.max(0, posAvgRr - 1) * 16,
    0,
    100,
  ).toFixed(1));
  const activeScorer = String(scorerPolicy?.activeScorer || "").trim().toLowerCase();
  return {
    label,
    windowType,
    mode: "learned",
    active: activeScorer === label,
    ready: total >= (windowType === "short" ? 16 : windowType === "recent" ? 14 : 18) && confidence >= (windowType === "short" ? 70 : windowType === "recent" ? 66 : 62),
    sampleSize: total,
    confidence,
    avgPnl: Number(avgPnl.toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    rrWeight,
    adaptiveScoreWeight,
    durationPenaltyWeight,
    reading: windowType === "short"
      ? `Corrida corta de ${label} entrenada para reaccionar rápido a cambios recientes del edge.`
      : windowType === "recent"
      ? `Corrida reciente de ${label} entrenada con ventana corta y sesgo a edge actual.`
      : `Corrida global de ${label} entrenada con todo el dataset estructurado.`,
  };
}

function buildModelTrainingRuns(rows, scorerPolicy) {
  const sorted = (rows || [])
    .filter((row) => row && row.realized_pnl != null)
    .slice()
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  const globalRows = sorted;
  const recentRows = sorted.slice(0, 160);
  const shortRows = sorted.slice(0, 80);
  return [
    buildLearnedModelRun("model-v2", globalRows, "global", scorerPolicy),
    buildLearnedModelRun("model-v3", recentRows, "recent", scorerPolicy),
    buildLearnedModelRun("model-v4", shortRows, "short", scorerPolicy),
  ];
}

async function recordModelTrainingRunHistory(username, modelTrainingRuns) {
  const rows = Array.isArray(modelTrainingRuns) ? modelTrainingRuns : [];
  if (!rows.length) return;
  const recentLogs = await fetchRecentAdaptiveActions(username, "model-training-run", 12);
  const latestByKey = new Map();
  for (const row of recentLogs || []) {
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    const key = `${String(details.label || row?.target_key || "")}:${String(details.windowType || "global")}`;
    if (key && !latestByKey.has(key)) latestByKey.set(key, row);
  }
  for (const run of rows) {
    const key = `${String(run.label || "")}:${String(run.windowType || "global")}`;
    const signature = buildModelTrainingRunSignature(run);
    const latest = latestByKey.get(key);
    const latestDetails = latest?.details && typeof latest.details === "object" ? latest.details : {};
    if (String(latestDetails.signature || "") === signature) continue;
    await insertAdaptiveActionLogForUser(username, {
      actionType: "training-run",
      targetType: "model-training-run",
      targetKey: String(run.label || ""),
      source: "model-training",
      status: run.ready ? "ready" : "observe",
      summary: String(run.reading || `${run.label} actualizado en ventana ${run.windowType}`),
      details: {
        signature,
        label: run.label,
        windowType: run.windowType,
        mode: run.mode,
        sampleSize: run.sampleSize,
        confidence: run.confidence,
        avgPnl: run.avgPnl,
        winRate: run.winRate,
        rrWeight: run.rrWeight,
        adaptiveScoreWeight: run.adaptiveScoreWeight,
        durationPenaltyWeight: run.durationPenaltyWeight,
        summary: run.reading,
      },
    }).catch(() => null);
  }
}

async function persistModelConfigRegistry(username, modelTrainingRuns, scorerPolicy) {
  const rows = Array.isArray(modelTrainingRuns) ? modelTrainingRuns : [];
  if (!rows.length) return [];
  return upsertModelConfigsForUser(username, rows, scorerPolicy?.activeScorer || "");
}

function normalizeScorerEvaluationHistory(rows) {
  return (rows || []).map((row) => {
    const details = row?.details && typeof row.details === "object" ? row.details : {};
    return {
      id: row?.id == null ? undefined : Number(row.id),
      scorer: String(details.scorer || ""),
      challenger: String(details.challenger || ""),
      windowType: String(details.windowType || "recent"),
      action: String(row?.status || details.action || "observe"),
      readiness: String(details.readiness || "low"),
      confidence: Number(details.confidence || 0),
      avgPnl: Number(details.avgPnl || 0),
      challengerAvgPnl: Number(details.challengerAvgPnl || 0),
      edgeDelta: Number(details.edgeDelta || 0),
      summary: String(row?.summary || ""),
      source: row?.source ? String(row.source) : undefined,
      status: row?.status ? String(row.status) : undefined,
      createdAt: row?.created_at ? String(row.created_at) : undefined,
    };
  }).filter((item) => item.scorer && item.challenger);
}

function getExecutionScopeThresholds(profile, strategyId, timeframe) {
  const override = (profile.scopeOverrides || []).find((item) => item.strategyId === strategyId && item.timeframe === timeframe);
  return {
    minSignalScore: override?.enabled !== false && override?.minSignalScore != null
      ? Number(override.minSignalScore)
      : Number(profile.minSignalScore || DEFAULT_EXECUTION_PROFILE.minSignalScore),
    minRrRatio: override?.enabled !== false && override?.minRrRatio != null
      ? Number(override.minRrRatio)
      : Number(profile.minRrRatio || DEFAULT_EXECUTION_PROFILE.minRrRatio),
    action: String(override?.action || ""),
    override: override || null,
  };
}

function getScopeOverrideAction(override) {
  const explicitAction = String(override?.action || "").trim();
  if (explicitAction) return explicitAction;
  const note = String(override?.note || "").toLowerCase();
  if (note.includes("corte")) return "cut";
  if (note.includes("apertura")) return "relax";
  if (note.includes("ajuste")) return "tighten";
  return "";
}

function roundToStep(value, step = 1) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Number((Math.round(numericValue / step) * step).toFixed(step >= 1 ? 0 : 2));
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new Error("Sesión no válida o vencida");
  return session;
}

function splitScope(scope) {
  if (!scope || scope === "all") return [];
  return String(scope)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scopeMatches({ marketScope, timeframeScope }, context) {
  const matchesMarket = !marketScope
    || marketScope === "all"
    || marketScope === context.marketScope
    || (marketScope === "watchlist" && context.marketScope === "watchlist");
  const timeframeValues = splitScope(timeframeScope);
  const matchesTimeframe = !timeframeValues.length || timeframeValues.includes(context.timeframe);
  return matchesMarket && matchesTimeframe;
}

function inferBaseVersion(experiment) {
  const metadata = experiment?.metadata && typeof experiment.metadata === "object" ? experiment.metadata : {};
  if (typeof metadata.baseVersion === "string" && metadata.baseVersion.trim()) {
    return metadata.baseVersion.trim();
  }
  if (experiment?.base_strategy_id === experiment?.candidate_strategy_id && experiment?.candidate_version !== "v1") {
    return "v1";
  }
  return "";
}

function pickActiveVersions(versions) {
  const activeByStrategy = new Map();
  const promotedByStrategy = {};
  const ordered = [...(versions || [])].sort((a, b) =>
    new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime(),
  );

  ordered.forEach((item) => {
    if (!isRunnableStrategyVersion(item.strategy_id, item.version)) return;
    const normalizedStatus = String(item.status || "").toLowerCase();
    if (normalizedStatus === "promoted" && !promotedByStrategy[item.strategy_id]) {
      promotedByStrategy[item.strategy_id] = item.version;
    }
    if (!ACTIVE_VERSION_STATUSES.has(normalizedStatus)) return;
    if (!activeByStrategy.has(item.strategy_id)) {
      activeByStrategy.set(item.strategy_id, item);
    }
  });

  FALLBACK_VERSIONS.forEach((item) => {
    if (!isRunnableStrategyVersion(item.strategy_id, item.version)) return;
    if (!activeByStrategy.has(item.strategy_id) && ACTIVE_VERSION_STATUSES.has(String(item.status || "").toLowerCase())) {
      activeByStrategy.set(item.strategy_id, item);
    }
  });

  return { activeByStrategy, promotedByStrategy };
}

export async function getSystemStrategyDecisionState(username, options = {}) {
  const includeHistory = options.includeHistory !== false;
  let versions = [];
  let experiments = [];
  let executionProfile = null;
  let signals = [];
  let featureSnapshots = [];
  let scorerEvaluationHistory = [];
  let modelTrainingRunHistory = [];
  let modelConfigHistory = [];
  let modelWindowGovernanceHistory = [];
  let modelConfigRegistry = [];

  try {
    const versionsParams = new URLSearchParams({
      select: "*",
      order: "strategy_id.asc,created_at.desc",
    });
    const experimentsParams = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "100",
    });

    [versions, experiments, featureSnapshots, scorerEvaluationHistory, modelTrainingRunHistory, modelConfigHistory, modelWindowGovernanceHistory, modelConfigRegistry] = await Promise.all([
      supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionsParams.toString()}`).catch(() => []),
      supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${experimentsParams.toString()}`).catch(() => []),
      supabaseRequest(`${SIGNAL_FEATURE_SNAPSHOTS_TABLE}?select=strategy_id,strategy_version,timeframe,direction,market_regime,volume_condition,signal_score,adaptive_score,scorer_confidence,rr_ratio,realized_pnl,duration_minutes,created_at&username=eq.${String(username)}&order=created_at.desc&limit=320`).catch(() => []),
      includeHistory ? fetchRecentAdaptiveActions(username, "scorer-model-evaluation", 10).catch(() => []) : Promise.resolve([]),
      includeHistory ? fetchRecentAdaptiveActions(username, "model-training-run", 12).catch(() => []) : Promise.resolve([]),
      includeHistory ? fetchRecentAdaptiveActions(username, "model-config", 8).catch(() => []) : Promise.resolve([]),
      includeHistory ? fetchRecentAdaptiveActions(username, "model-window-governance", 8).catch(() => []) : Promise.resolve([]),
      fetchModelConfigsForUser(username).catch(() => []),
    ]);
    executionProfile = await getExecutionProfileForUser(username, modelConfigRegistry).catch(() => null);
    signals = await supabaseRequest(`${SIGNALS_TABLE}?select=strategy_name,strategy_version,timeframe,outcome_status,outcome_pnl,signal_score,rr_ratio,updated_at,created_at,signal_label,signal_payload&username=eq.${String(username)}&order=created_at.desc&limit=${includeHistory ? 300 : 220}`).catch(() => []);
  } catch {
    versions = [];
    experiments = [];
    executionProfile = null;
    signals = [];
    featureSnapshots = [];
    scorerEvaluationHistory = [];
    modelTrainingRunHistory = [];
    modelConfigHistory = [];
    modelWindowGovernanceHistory = [];
    modelConfigRegistry = [];
  }

  const resolvedVersions = versions?.length ? versions : FALLBACK_VERSIONS;
  const { activeByStrategy, promotedByStrategy } = pickActiveVersions(resolvedVersions);
  const sandboxExperiments = (experiments || [])
    .filter((item) => SANDBOX_EXPERIMENT_STATUSES.has(String(item.status || "").toLowerCase()))
    .map((item) => ({
      ...item,
      base_version: inferBaseVersion(item),
      candidate_runnable: isRunnableStrategyVersion(item.candidate_strategy_id, item.candidate_version),
      execution_allowed: Boolean(
        item.status === "active"
          || item.status === "running"
          || (item.metadata && typeof item.metadata === "object" && item.metadata.allowExecution === true),
      ),
    }));
  const normalizedTrainingRunHistory = normalizeModelTrainingRunHistory(modelTrainingRunHistory || []);
  const latestTrainingRuns = [];
  const seenTrainingKeys = new Set();
  for (const row of normalizedTrainingRunHistory) {
    const key = `${row.label}:${row.windowType}`;
    if (seenTrainingKeys.has(key)) continue;
    seenTrainingKeys.add(key);
    latestTrainingRuns.push(row);
  }
  const normalizedModelConfigRegistry = normalizeModelConfigRegistry(modelConfigRegistry || []);
  const modelRegistry = buildModelRegistry(featureSnapshots || [], executionProfile, latestTrainingRuns, normalizedModelConfigRegistry);
  const modelWindowGovernance = buildModelWindowGovernance(latestTrainingRuns, modelRegistry, executionProfile);

  return {
    username,
    activeStrategyByScope: Array.from(activeByStrategy.values()).map((item) => ({
      strategyId: item.strategy_id,
      version: item.version,
      label: item.label,
      status: item.status,
      marketScope: "watchlist",
      timeframeScope: getPreferredTimeframeScope(resolvedVersions, item.strategy_id, item.version),
    })),
    promotedVersionByStrategy: promotedByStrategy,
    sandboxExperimentsByScope: sandboxExperiments.map((item) => ({
      id: item.id,
      baseStrategyId: item.base_strategy_id,
      baseVersion: item.base_version,
      candidateStrategyId: item.candidate_strategy_id,
      candidateVersion: item.candidate_version,
      marketScope: item.market_scope || "all",
      timeframeScope: item.timeframe_scope || "all",
      status: item.status,
      executionAllowed: item.execution_allowed,
      candidateRunnable: item.candidate_runnable,
      metadata: item.metadata || {},
    })),
    executionEligibleScopes: sandboxExperiments
      .filter((item) => item.execution_allowed && item.candidate_runnable)
      .map((item) => ({
        experimentId: item.id,
        strategyId: item.candidate_strategy_id,
        version: item.candidate_version,
        marketScope: item.market_scope || "all",
        timeframeScope: item.timeframe_scope || "all",
      })),
    adaptivePrimaryByScope: buildAdaptivePrimaryByScope(signals || []),
    contextBiasByScope: buildContextBiasByScope(signals || []),
    modelRegistry,
    modelWindowGovernance,
    featureModelByScope: buildFeatureModelByScope(featureSnapshots || [], modelRegistry),
    scorerEvaluations: buildScorerEvaluations(signals || [], executionProfile),
    shadowModelEvaluation: buildShadowModelEvaluation(signals || [], executionProfile),
    scorerEvaluationHistory: includeHistory ? normalizeScorerEvaluationHistory(scorerEvaluationHistory || []) : [],
    modelTrainingRunHistory: includeHistory ? normalizedTrainingRunHistory : [],
    modelConfigHistory: includeHistory ? (normalizedModelConfigRegistry.length ? normalizeModelConfigHistory(modelConfigRegistry || []) : normalizeModelConfigHistory(modelConfigHistory || [])) : [],
    modelWindowGovernanceHistory: includeHistory ? normalizeModelWindowGovernanceHistory(modelWindowGovernanceHistory || []) : [],
    modelConfigRegistry: normalizedModelConfigRegistry,
    scorerPolicy: executionProfile?.scorerPolicy || null,
    scopeTuningByScope: (executionProfile?.scopeOverrides || []).map((item) => ({
      strategyId: item.strategyId,
      timeframe: item.timeframe,
      enabled: item.enabled !== false,
      action: getScopeOverrideAction(item),
      minSignalScore: item.minSignalScore == null ? null : Number(item.minSignalScore),
      minRrRatio: item.minRrRatio == null ? null : Number(item.minRrRatio),
      note: String(item.note || ""),
    })),
  };
}

function buildAdaptivePrimaryByScope(signals) {
  const groups = new Map();
  for (const signal of (signals || [])) {
    if (!signal || signal.outcome_status === "pending") continue;
    const strategyId = String(signal.strategy_name || "");
    const version = String(signal.strategy_version || "");
    const timeframe = String(signal.timeframe || "");
    if (!strategyId || !version || !timeframe) continue;
    const key = `${timeframe}:${strategyId}:${version}`;
    const current = groups.get(key) || {
      timeframe,
      strategyId,
      version,
      signals: [],
    };
    current.signals.push(signal);
    groups.set(key, current);
  }

  const byTimeframe = new Map();
  for (const group of groups.values()) {
    const stats = summarizeSignals(group.signals);
    if (stats.total < 5) continue;
    const avgScore = group.signals.reduce((sum, item) => sum + Number(item.signal_score || 0), 0) / stats.total;
    const avgRr = group.signals.reduce((sum, item) => sum + Number(item.rr_ratio || 0), 0) / stats.total;
    const avgPnl = stats.total ? stats.pnl / stats.total : 0;
    const confidence = Math.min(0.97, 0.5 + stats.total * 0.03 + Math.max(0, stats.winRate - 50) * 0.004 + Math.max(0, avgPnl) * 0.05);
    const edgeScore = Number((
      stats.pnl * 2.4
      + avgPnl * 8
      + (stats.winRate - 50) * 0.9
      + Math.min(stats.total, 20) * 0.5
      + avgScore * 0.05
      + avgRr * 4
    ).toFixed(2));
    const current = byTimeframe.get(group.timeframe) || [];
    current.push({
      timeframe: group.timeframe,
      strategyId: group.strategyId,
      version: group.version,
      sampleSize: stats.total,
      winRate: Number(stats.winRate.toFixed(2)),
      pnl: Number(stats.pnl.toFixed(2)),
      avgPnl: Number(avgPnl.toFixed(2)),
      avgScore: Number(avgScore.toFixed(1)),
      avgRr: Number(avgRr.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      edgeScore,
    });
    byTimeframe.set(group.timeframe, current);
  }

  const preferred = [];
  for (const candidates of byTimeframe.values()) {
    const ordered = [...candidates].sort((left, right) => right.edgeScore - left.edgeScore);
    const winner = ordered[0];
    const runnerUp = ordered[1];
    if (!winner) continue;
    if (winner.edgeScore <= 0 && winner.winRate < 54) continue;
    if (runnerUp && winner.edgeScore - runnerUp.edgeScore < 4 && winner.sampleSize < 10) continue;
    preferred.push({
      ...winner,
      leadOverNext: runnerUp ? Number((winner.edgeScore - runnerUp.edgeScore).toFixed(2)) : null,
    });
  }

  return preferred;
}

function buildAdaptivePrimaryPromotionRecommendations(signals, versions) {
  const adaptiveLeaders = buildAdaptivePrimaryByScope(signals);
  const resolvedVersions = versions?.length ? versions : FALLBACK_VERSIONS;
  const { activeByStrategy, promotedByStrategy } = pickActiveVersions(resolvedVersions);
  const recommendations = [];

  for (const leader of adaptiveLeaders) {
    const strategyId = String(leader.strategyId || "");
    const timeframe = String(leader.timeframe || "");
    const candidateVersion = String(leader.version || "");
    const activeVersion = String(
      promotedByStrategy[strategyId]
      || activeByStrategy.get(strategyId)?.version
      || "",
    );

    if (!strategyId || !timeframe || !candidateVersion || !activeVersion) continue;
    if (candidateVersion === activeVersion) continue;
    if (leader.sampleSize < 8 || Number(leader.confidence || 0) < 0.72) continue;
    if (Number(leader.edgeScore || 0) <= 0) continue;

    recommendations.push({
      recommendation_key: `adaptive-primary:${strategyId}:${timeframe}:${activeVersion}->${candidateVersion}`,
      strategy_id: strategyId,
      strategy_version: activeVersion,
      parameter_key: "primaryVersionByTimeframe",
      title: `Probar ${candidateVersion} como primaria en ${timeframe}`,
      summary: `${candidateVersion} viene liderando ${timeframe} con mejor edge reciente que ${activeVersion}. Conviene abrir una prueba segura y validar si debe gobernar este marco.`,
      current_value: 0,
      suggested_value: Number(leader.edgeScore || 0),
      confidence: Number(leader.confidence || 0),
      status: leader.sampleSize >= 12 && Number(leader.confidence || 0) >= 0.8 ? "sandbox" : "draft",
      evidence: {
        recommendationType: "adaptive-primary-promotion",
        timeframe,
        marketScope: "watchlist",
        timeframeScope: timeframe,
        sampleSize: leader.sampleSize,
        confidence: leader.confidence,
        edgeScore: leader.edgeScore,
        leadOverNext: leader.leadOverNext,
        winRate: leader.winRate,
        pnl: leader.pnl,
        avgPnl: leader.avgPnl,
        avgScore: leader.avgScore,
        avgRr: leader.avgRr,
        baseVersion: activeVersion,
        candidateVersion,
        promotionMode: "timeframe-primary-challenge",
      },
    });
  }

  return recommendations;
}

function buildAdaptiveScorerPromotionRecommendations(signals, executionProfile) {
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "").trim().toLowerCase();
  const scoredSignals = closedSignals.filter((item) => item.signal_payload?.decision?.scorer?.label);
  const scorerLabels = new Set(scoredSignals.map((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase()).filter(Boolean));
  const scorerStats = {};
  scorerLabels.forEach((label) => {
    const rows = scoredSignals.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === label);
    scorerStats[label] = summarizeSignals(rows);
  });
  const recommendations = [];
  const effectiveActiveScorer = activeScorer || "adaptive-v1";
  const activeStats = scorerStats[effectiveActiveScorer] || summarizeSignals([]);
  const activeAvgPnl = activeStats.total ? activeStats.pnl / activeStats.total : 0;
  const promotionTarget = choosePromotionChallenger(effectiveActiveScorer, scorerStats);
  if (promotionTarget && activeStats.total >= 5 && promotionTarget.stats?.total >= 5) {
    const challengerAvgPnl = Number(promotionTarget.stats.pnl || 0) / Number(promotionTarget.stats.total || 1);
    const edgeDelta = Number((challengerAvgPnl - activeAvgPnl).toFixed(2));
    const winRateDelta = Number((Number(promotionTarget.stats.winRate || 0) - Number(activeStats.winRate || 0)).toFixed(2));
    const promotionConfidence = Math.min(
      0.97,
      0.58
        + Math.min(Number(promotionTarget.stats.total || 0), 20) * 0.018
        + Math.max(0, edgeDelta) * 0.06
        + Math.max(0, winRateDelta) * 0.006,
    );
    if (edgeDelta >= 0.18 && winRateDelta >= 0) {
      recommendations.push({
        recommendation_key: `adaptive-scorer:${effectiveActiveScorer}->${promotionTarget.scorer}`,
        strategy_id: "adaptive-scorer",
        strategy_version: effectiveActiveScorer,
        parameter_key: "scorerPolicy",
        title: `Promover ${promotionTarget.scorer} como scorer principal`,
        summary: `${promotionTarget.scorer} ya está cerrando mejor que ${effectiveActiveScorer}. Conviene validarlo y, si mantiene edge, dejarlo pesar más en el motor.`,
        current_value: Number(activeAvgPnl.toFixed(2)),
        suggested_value: Number(challengerAvgPnl.toFixed(2)),
        confidence: Number(promotionConfidence.toFixed(2)),
        status: Number(promotionTarget.stats.total || 0) >= 10 && edgeDelta >= 0.3 && winRateDelta >= 2 ? "sandbox" : "draft",
        evidence: {
          recommendationType: "adaptive-scorer-promotion",
          action: "promote",
          baseScorer: effectiveActiveScorer,
          candidateScorer: promotionTarget.scorer,
          sampleSizeBase: Number(activeStats.total || 0),
          sampleSizeCandidate: Number(promotionTarget.stats.total || 0),
          avgPnlBase: Number(activeAvgPnl.toFixed(2)),
          avgPnlCandidate: Number(challengerAvgPnl.toFixed(2)),
          pnlBase: Number(activeStats.pnl.toFixed(2)),
          pnlCandidate: Number(Number(promotionTarget.stats.pnl || 0).toFixed(2)),
          winRateBase: Number(Number(activeStats.winRate || 0).toFixed(2)),
          winRateCandidate: Number(Number(promotionTarget.stats.winRate || 0).toFixed(2)),
          edgeDelta,
          winRateDelta,
          promotionMode: "adaptive-scorer-challenge",
        },
      });
    }
  }

  const recentActiveSignals = scoredSignals
    .filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === effectiveActiveScorer)
    .slice()
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime())
    .slice(0, 20);
  const recentActiveStats = summarizeSignals(recentActiveSignals);
  const baseline = chooseRollbackBaseline(effectiveActiveScorer, scorerStats);
  const baselineAvgPnl = baseline?.stats?.total ? Number(baseline.stats.pnl || 0) / Number(baseline.stats.total || 1) : 0;
  const baselineWinRate = Number(baseline?.stats?.winRate || 0);
  if (
    baseline
    && recentActiveStats.total >= 5
    && (
      recentActiveStats.pnl < 0
      || recentActiveStats.winRate < 45
      || (recentActiveStats.avgPnl < baselineAvgPnl && recentActiveStats.winRate <= baselineWinRate)
    )
  ) {
    const rollbackConfidence = Math.min(
      0.96,
      0.58 + Math.min(recentActiveStats.total, 12) * 0.024 + Math.max(0, Math.abs(recentActiveStats.avgPnl - baselineAvgPnl)) * 0.08,
    );
    recommendations.push({
      recommendation_key: `adaptive-scorer:${effectiveActiveScorer}->${baseline.scorer}`,
      strategy_id: "adaptive-scorer",
      strategy_version: effectiveActiveScorer,
      parameter_key: "scorerPolicy",
      title: `Replegar ${effectiveActiveScorer} y volver a ${baseline.scorer}`,
      summary: `El scorer activo ya no está defendiendo el edge reciente. Conviene devolver el control a ${baseline.scorer}, que viene resistiendo mejor con evidencia real.`,
      current_value: Number(recentActiveStats.avgPnl.toFixed(2)),
      suggested_value: Number(baselineAvgPnl.toFixed(2)),
      confidence: Number(rollbackConfidence.toFixed(2)),
      status: recentActiveStats.total >= 8 && recentActiveStats.avgPnl < baselineAvgPnl ? "sandbox" : "draft",
      evidence: {
        recommendationType: "adaptive-scorer-promotion",
        action: "rollback",
        baseScorer: effectiveActiveScorer,
        candidateScorer: baseline.scorer,
        sampleSizeCurrent: Number(scorerStats[effectiveActiveScorer]?.total || 0),
        sampleSizeRecent: recentActiveStats.total,
        sampleSizeBaseline: Number(baseline.stats?.total || 0),
        avgPnlCurrent: Number((Number(scorerStats[effectiveActiveScorer]?.total || 0) ? Number(scorerStats[effectiveActiveScorer]?.pnl || 0) / Number(scorerStats[effectiveActiveScorer]?.total || 1) : 0).toFixed(2)),
        avgPnlRecent: Number(recentActiveStats.avgPnl.toFixed(2)),
        avgPnlBaseline: Number(baselineAvgPnl.toFixed(2)),
        winRateCurrent: Number(Number(scorerStats[effectiveActiveScorer]?.winRate || 0).toFixed(2)),
        winRateRecent: Number(recentActiveStats.winRate.toFixed(2)),
        winRateBaseline: Number(baselineWinRate.toFixed(2)),
        edgeDelta: Number((recentActiveStats.avgPnl - baselineAvgPnl).toFixed(2)),
        winRateDelta: Number((recentActiveStats.winRate - baselineWinRate).toFixed(2)),
        promotionMode: "model-scorer-rollback",
      },
    });
  }

  return recommendations;
}

function chooseRollbackBaseline(activeScorer, scorerStats) {
  const options = Object.entries(scorerStats || {})
    .filter(([label, stats]) => label !== activeScorer && Number(stats?.total || 0) >= 5)
    .sort((left, right) => {
      const leftAvg = Number(left[1]?.total || 0) ? Number(left[1].pnl || 0) / Number(left[1].total || 1) : 0;
      const rightAvg = Number(right[1]?.total || 0) ? Number(right[1].pnl || 0) / Number(right[1].total || 1) : 0;
      return rightAvg - leftAvg || Number(right[1]?.winRate || 0) - Number(left[1]?.winRate || 0);
    });
  return options[0] ? { scorer: options[0][0], stats: options[0][1] } : null;
}

function choosePromotionChallenger(activeScorer, scorerStats) {
  const options = Object.entries(scorerStats || {})
    .filter(([label, stats]) => label !== activeScorer && Number(stats?.total || 0) >= 5)
    .sort((left, right) => {
      const leftAvg = Number(left[1]?.total || 0) ? Number(left[1].pnl || 0) / Number(left[1].total || 1) : 0;
      const rightAvg = Number(right[1]?.total || 0) ? Number(right[1].pnl || 0) / Number(right[1].total || 1) : 0;
      if (rightAvg !== leftAvg) return rightAvg - leftAvg;
      if (Number(right[1]?.winRate || 0) !== Number(left[1]?.winRate || 0)) return Number(right[1]?.winRate || 0) - Number(left[1]?.winRate || 0);
      const rightLearned = String(right[0] || "").startsWith("model-") ? 1 : 0;
      const leftLearned = String(left[0] || "").startsWith("model-") ? 1 : 0;
      return rightLearned - leftLearned;
    });
  return options[0] ? { scorer: options[0][0], stats: options[0][1] } : null;
}

function buildShadowModelEvaluation(signals, executionProfile) {
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "adaptive-v1").trim().toLowerCase() || "adaptive-v1";
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const grouped = new Map();
  for (const item of closedSignals) {
    const candidateScorer = String(item.signal_payload?.decision?.scorer?.candidateLabel || "").toLowerCase();
    if (!candidateScorer || candidateScorer === activeScorer) continue;
    const rows = grouped.get(candidateScorer) || [];
    rows.push(item);
    grouped.set(candidateScorer, rows);
  }
  const evaluations = Array.from(grouped.entries()).map(([candidateScorer, rows]) => {
    const readyRows = rows.filter((item) => item.signal_payload?.decision?.scorer?.candidateReady);
    if (readyRows.length < 6) {
      return {
        candidateScorer,
        activeScorer,
        readySampleSize: readyRows.length,
        favorableSampleSize: 0,
        nonFavorableSampleSize: 0,
        favorableAvgPnl: 0,
        nonFavorableAvgPnl: 0,
        favorableWinRate: 0,
        nonFavorableWinRate: 0,
        confidence: 0,
        action: "observe",
        summary: `Todavía no hay suficiente muestra lista para evaluar ${candidateScorer} como challenger real.`,
      };
    }

    const favorable = readyRows.filter((item) => Number(item.signal_payload?.decision?.scorer?.candidateDelta || 0) > 0);
    const nonFavorable = readyRows.filter((item) => Number(item.signal_payload?.decision?.scorer?.candidateDelta || 0) <= 0);
    const favorableStats = summarizeSignals(favorable);
    const nonFavorableStats = summarizeSignals(nonFavorable);
    const favorableAvgPnl = favorableStats.total ? favorableStats.pnl / favorableStats.total : 0;
    const nonFavorableAvgPnl = nonFavorableStats.total ? nonFavorableStats.pnl / nonFavorableStats.total : 0;
    const edgeDelta = Number((favorableAvgPnl - nonFavorableAvgPnl).toFixed(2));
    const winRateDelta = Number((favorableStats.winRate - nonFavorableStats.winRate).toFixed(2));
    const confidence = Number(Math.min(
      98,
      38
        + Math.min(readyRows.length, 24) * 1.8
        + Math.max(0, edgeDelta) * 9
        + Math.max(0, winRateDelta) * 0.8,
    ).toFixed(1));
    const promotable = favorableStats.total >= 6
      && favorableAvgPnl > 0
      && favorableStats.winRate >= 55
      && edgeDelta >= 0.25
      && confidence >= 68;

    return {
      candidateScorer,
      activeScorer,
      readySampleSize: readyRows.length,
      favorableSampleSize: favorableStats.total,
      nonFavorableSampleSize: nonFavorableStats.total,
      favorableAvgPnl: Number(favorableAvgPnl.toFixed(2)),
      nonFavorableAvgPnl: Number(nonFavorableAvgPnl.toFixed(2)),
      favorableWinRate: Number(favorableStats.winRate.toFixed(2)),
      nonFavorableWinRate: Number(nonFavorableStats.winRate.toFixed(2)),
      confidence,
      action: promotable ? "promote" : "observe",
      summary: promotable
        ? `${candidateScorer} ya está mostrando mejor edge cuando su score sombra favorece la lectura. Puede pasar a desafiar formalmente al scorer activo.`
        : `${candidateScorer} ya está acumulando muestra útil, pero todavía no deja una ventaja suficientemente clara para promoción.`,
    };
  });
  const best = evaluations.sort((left, right) => {
    if (left.action !== right.action) return left.action === "promote" ? -1 : 1;
    return Number(right.confidence || 0) - Number(left.confidence || 0) || Number(right.favorableAvgPnl || 0) - Number(left.favorableAvgPnl || 0);
  })[0];
  return best || {
    candidateScorer: activeScorer === "model-v1" ? "model-v2" : "model-v1",
    activeScorer,
    readySampleSize: 0,
    favorableSampleSize: 0,
    nonFavorableSampleSize: 0,
    favorableAvgPnl: 0,
    nonFavorableAvgPnl: 0,
    favorableWinRate: 0,
    nonFavorableWinRate: 0,
    confidence: 0,
    action: "observe",
    summary: "Todavía no hay challengers con muestra suficiente para observación real.",
  };
}

function buildModelV1PromotionRecommendations(signals, executionProfile) {
  const evaluation = buildShadowModelEvaluation(signals, executionProfile);
  if (!evaluation || evaluation.action !== "promote") return [];
  if (evaluation.activeScorer === evaluation.candidateScorer) return [];
  return [{
    recommendation_key: `adaptive-scorer:${evaluation.activeScorer}->${evaluation.candidateScorer}`,
    strategy_id: "adaptive-scorer",
    strategy_version: evaluation.activeScorer,
    parameter_key: "scorerPolicy",
    title: `Promover ${evaluation.candidateScorer} como challenger formal`,
    summary: `El modelo versionado ${evaluation.candidateScorer} ya está mostrando ventaja suficiente en modo sombra. Conviene pasarlo a desafío formal frente al scorer activo.`,
    current_value: Number(evaluation.nonFavorableAvgPnl.toFixed(2)),
    suggested_value: Number(evaluation.favorableAvgPnl.toFixed(2)),
    confidence: Number((evaluation.confidence / 100).toFixed(2)),
    status: evaluation.favorableSampleSize >= 8 && evaluation.confidence >= 78 ? "sandbox" : "draft",
    evidence: {
      recommendationType: "adaptive-scorer-promotion",
      action: "promote",
      baseScorer: evaluation.activeScorer,
      candidateScorer: evaluation.candidateScorer,
      sampleSizeReady: evaluation.readySampleSize,
      sampleSizeFavorable: evaluation.favorableSampleSize,
      sampleSizeOther: evaluation.nonFavorableSampleSize,
      avgPnlFavorable: evaluation.favorableAvgPnl,
      avgPnlOther: evaluation.nonFavorableAvgPnl,
      winRateFavorable: evaluation.favorableWinRate,
      winRateOther: evaluation.nonFavorableWinRate,
      edgeDelta: Number((evaluation.favorableAvgPnl - evaluation.nonFavorableAvgPnl).toFixed(2)),
      promotionMode: "shadow-model-challenge",
    },
  }];
}

function buildScorerEvaluations(signals, executionProfile) {
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const scoredSignals = closedSignals
    .filter((item) => item.signal_payload?.decision?.scorer?.label)
    .slice()
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime());
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "adaptive-v1").trim().toLowerCase() || "adaptive-v1";
  const windows = [
    { key: "recent", rows: scoredSignals.slice(0, 20) },
    { key: "global", rows: scoredSignals },
  ];

  return windows.map((window) => {
    const labels = new Set(window.rows.map((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase()).filter(Boolean));
    const scorerStats = {};
    labels.forEach((label) => {
      const rows = window.rows.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === label);
      scorerStats[label] = summarizeSignals(rows);
    });
    const chosen = choosePromotionChallenger(activeScorer, scorerStats);
    const fallbackChallenger = activeScorer === "adaptive-v1" ? "adaptive-v2" : "adaptive-v1";
    const challenger = chosen?.scorer || fallbackChallenger;
    const activeRows = window.rows.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === activeScorer);
    const challengerRows = window.rows.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === challenger);
    const activeStats = summarizeSignals(activeRows);
    const challengerStats = summarizeSignals(challengerRows);
    const activeAvgPnl = activeStats.total ? activeStats.pnl / activeStats.total : 0;
    const challengerAvgPnl = challengerStats.total ? challengerStats.pnl / challengerStats.total : 0;
    const edgeDelta = Number((challengerAvgPnl - activeAvgPnl).toFixed(2));
    const winRateDelta = Number((challengerStats.winRate - activeStats.winRate).toFixed(2));
    const enoughSample = activeStats.total >= 5 && challengerStats.total >= 5;
    const confidence = Number(Math.min(
      99,
      35
        + Math.min(activeStats.total, 20) * 1.5
        + Math.min(challengerStats.total, 20) * 1.5
        + Math.max(0, Math.abs(edgeDelta)) * 8
        + Math.max(0, Math.abs(winRateDelta)) * 0.8,
    ).toFixed(1));

    let action = "observe";
    let readiness = "low";
    let summary = "Todavía no hay suficiente muestra para gobernar el scorer con seguridad.";

    if (enoughSample) {
      readiness = confidence >= 78 ? "high" : confidence >= 60 ? "medium" : "low";
      if (challengerAvgPnl > activeAvgPnl && challengerStats.winRate >= activeStats.winRate) {
        action = activeScorer === "adaptive-v1" ? "promote" : "rollback";
        summary = activeScorer === "adaptive-v1"
          ? `El scorer challenger ${challenger} ya supera al scorer activo y merece avanzar hacia promoción.`
          : `El scorer activo ya no está defendiendo mejor el edge y conviene preparar rollback hacia ${challenger}.`;
      } else if (activeAvgPnl >= challengerAvgPnl) {
        action = "keep";
        summary = "El scorer activo sigue defendiendo mejor el edge en esta ventana.";
      } else if (activeScorer !== "adaptive-v1" && activeAvgPnl < challengerAvgPnl && activeStats.winRate <= challengerStats.winRate) {
        action = "rollback";
        summary = "El scorer activo se está degradando frente a la alternativa y conviene preparar rollback.";
      } else {
        action = "observe";
        summary = "Los scorers están mezclados; conviene seguir observando antes de promover o revertir.";
      }
    }

    return {
      scorer: activeScorer,
      challenger,
      active: true,
      windowType: window.key,
      sampleSize: activeStats.total,
      challengerSampleSize: challengerStats.total,
      avgPnl: Number(activeAvgPnl.toFixed(2)),
      challengerAvgPnl: Number(challengerAvgPnl.toFixed(2)),
      winRate: Number(activeStats.winRate.toFixed(2)),
      challengerWinRate: Number(challengerStats.winRate.toFixed(2)),
      pnl: Number(activeStats.pnl.toFixed(2)),
      challengerPnl: Number(challengerStats.pnl.toFixed(2)),
      edgeDelta,
      winRateDelta,
      confidence,
      action,
      readiness,
      summary,
    };
  });
}

function chooseBestModelChallenger(activeScorer, modelRegistry = [], modelTrainingRuns = []) {
  const active = String(activeScorer || "").trim().toLowerCase();
  const runGroups = new Map();
  for (const run of (modelTrainingRuns || [])) {
    const label = String(run?.label || "").trim().toLowerCase();
    if (!label.startsWith("model-")) continue;
    const current = runGroups.get(label) || [];
    current.push(run);
    runGroups.set(label, current);
  }

  const candidates = (modelRegistry || [])
    .filter((item) => item && item.label && String(item.label).toLowerCase().startsWith("model-"))
    .filter((item) => String(item.label).toLowerCase() !== active)
    .map((item) => {
      const label = String(item.label || "").toLowerCase();
      const runs = runGroups.get(label) || [];
      const avgPnl = runs.length
        ? runs.reduce((sum, run) => sum + Number(run.avgPnl || 0), 0) / runs.length
        : Number(item.avgPnl || 0);
      const avgWinRate = runs.length
        ? runs.reduce((sum, run) => sum + Number(run.winRate || 0), 0) / runs.length
        : Number(item.winRate || 0);
      const avgConfidence = runs.length
        ? runs.reduce((sum, run) => sum + Number(run.confidence || 0), 0) / runs.length
        : Number(item.confidence || 0);
      const readyWindows = runs.filter((run) => Boolean(run.ready)).length;
      const rank = Number((
        avgPnl * 8
        + (avgWinRate - 50) * 0.55
        + avgConfidence * 0.18
        + readyWindows * 4
        + Math.min(Number(item.sampleSize || 0), 30) * 0.18
      ).toFixed(2));
      return {
        label,
        rank,
        readyWindows,
        runs,
        spec: item,
      };
    })
    .sort((left, right) => {
      if (Boolean(right.spec?.ready) !== Boolean(left.spec?.ready)) return Number(Boolean(right.spec?.ready)) - Number(Boolean(left.spec?.ready));
      if (right.readyWindows !== left.readyWindows) return right.readyWindows - left.readyWindows;
      return Number(right.rank || 0) - Number(left.rank || 0) || Number(right.spec?.confidence || 0) - Number(left.spec?.confidence || 0);
    });

  return candidates[0] || null;
}

function buildModelWindowGovernance(modelTrainingRuns, modelRegistry, executionProfile) {
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "adaptive-v1").trim().toLowerCase() || "adaptive-v1";
  const challenger = chooseBestModelChallenger(activeScorer, modelRegistry, modelTrainingRuns);
  if (!challenger) {
    return {
      activeScorer,
      candidateScorer: "",
      windowVotes: [],
      alignedWindows: 0,
      conflictingWindows: 0,
      action: "observe",
      confidence: 0,
      summary: "Todavia no hay un modelo challenger con suficiente estructura para gobernanza multi-ventana.",
    };
  }

  const runsByLabelWindow = new Map();
  for (const run of (modelTrainingRuns || [])) {
    const label = String(run?.label || "").trim().toLowerCase();
    const windowType = String(run?.windowType || "global").trim().toLowerCase();
    if (!label) continue;
    runsByLabelWindow.set(`${label}:${windowType}`, run);
  }

  const windowOrder = ["short", "recent", "global"];
  const windowVotes = windowOrder.map((windowType) => {
    const activeRun = runsByLabelWindow.get(`${activeScorer}:${windowType}`) || null;
    const candidateRun = runsByLabelWindow.get(`${challenger.label}:${windowType}`) || null;
    const activeAvgPnl = Number(activeRun?.avgPnl || 0);
    const candidateAvgPnl = Number(candidateRun?.avgPnl || 0);
    const activeWinRate = Number(activeRun?.winRate || 0);
    const candidateWinRate = Number(candidateRun?.winRate || 0);
    const sampleSize = Math.max(Number(activeRun?.sampleSize || 0), Number(candidateRun?.sampleSize || 0));
    const edgeDelta = Number((candidateAvgPnl - activeAvgPnl).toFixed(2));
    const winRateDelta = Number((candidateWinRate - activeWinRate).toFixed(2));
    const enoughSample = Number(activeRun?.sampleSize || 0) >= 5 && Number(candidateRun?.sampleSize || 0) >= 5;
    let vote = "observe";
    if (enoughSample && edgeDelta >= 0.12 && winRateDelta >= -1) vote = "promote";
    else if (enoughSample && edgeDelta <= -0.12 && winRateDelta <= 1) vote = "keep";
    const confidence = Number(Math.min(
      98,
      28
        + Math.min(sampleSize, 20) * 2.1
        + Math.max(0, Math.abs(edgeDelta)) * 14
        + Math.max(0, Math.abs(winRateDelta)) * 0.7,
    ).toFixed(1));
    return {
      windowType,
      activeAvgPnl: Number(activeAvgPnl.toFixed(2)),
      candidateAvgPnl: Number(candidateAvgPnl.toFixed(2)),
      activeWinRate: Number(activeWinRate.toFixed(2)),
      candidateWinRate: Number(candidateWinRate.toFixed(2)),
      edgeDelta,
      winRateDelta,
      sampleSize,
      confidence,
      vote,
      candidateReady: Boolean(candidateRun?.ready || challenger.spec?.ready),
    };
  });

  const promoteVotes = windowVotes.filter((item) => item.vote === "promote");
  const keepVotes = windowVotes.filter((item) => item.vote === "keep");
  const alignedWindows = promoteVotes.length;
  const conflictingWindows = keepVotes.length;
  const meanConfidence = windowVotes.length
    ? windowVotes.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / windowVotes.length
    : 0;

  let action = "observe";
  let summary = `${challenger.label} todavia necesita una alineacion mas clara entre ventanas para retar al modelo activo.`;
  if (alignedWindows >= 2 && conflictingWindows === 0 && meanConfidence >= 68) {
    action = activeScorer.startsWith("model-") ? "promote" : "promote";
    summary = `${challenger.label} ya alinea ${alignedWindows} ventanas con mejor edge que ${activeScorer}. Puede pasar a una gobernanza mas automatica.`;
  } else if (activeScorer.startsWith("model-") && conflictingWindows >= 2 && meanConfidence >= 64) {
    action = "rollback";
    summary = `${activeScorer} ya no defiende bien varias ventanas frente a ${challenger.label}. Conviene preparar rollback conservador.`;
  } else if (alignedWindows >= 1 && meanConfidence >= 58) {
    action = "sandbox";
    summary = `${challenger.label} ya tiene al menos una ventana favorable y merece seguir retando en sandbox multi-ventana.`;
  }

  return {
    activeScorer,
    candidateScorer: challenger.label,
    challengerMode: challenger.spec?.mode || "learned",
    windowVotes,
    alignedWindows,
    conflictingWindows,
    action,
    confidence: Number(meanConfidence.toFixed(1)),
    summary,
  };
}

function buildModelWindowGovernanceRecommendations(governance) {
  if (!governance?.candidateScorer || !["promote", "rollback", "sandbox"].includes(String(governance.action || ""))) {
    return [];
  }
  const promoteWindows = (governance.windowVotes || []).filter((item) => item.vote === "promote");
  const keepWindows = (governance.windowVotes || []).filter((item) => item.vote === "keep");
  const avgPromoteEdge = promoteWindows.length
    ? promoteWindows.reduce((sum, item) => sum + Number(item.edgeDelta || 0), 0) / promoteWindows.length
    : 0;
  const avgKeepEdge = keepWindows.length
    ? keepWindows.reduce((sum, item) => sum + Number(item.edgeDelta || 0), 0) / keepWindows.length
    : 0;
  const status = governance.action === "sandbox"
    ? "sandbox"
    : governance.alignedWindows >= 2 && Number(governance.confidence || 0) >= 74
      ? "sandbox"
      : "draft";
  return [{
    recommendation_key: `adaptive-scorer:multi-window:${governance.activeScorer}->${governance.candidateScorer}`,
    strategy_id: "adaptive-scorer",
    strategy_version: governance.activeScorer,
    parameter_key: "scorerPolicy",
    title: governance.action === "rollback"
      ? `Rollback multi-ventana hacia ${governance.candidateScorer}`
      : governance.action === "sandbox"
        ? `Seguir probando ${governance.candidateScorer} por ventanas`
        : `Promover ${governance.candidateScorer} por evidencia multi-ventana`,
    summary: governance.summary,
    current_value: Number(avgKeepEdge.toFixed(2)),
    suggested_value: Number(avgPromoteEdge.toFixed(2)),
    confidence: Number((Number(governance.confidence || 0) / 100).toFixed(2)),
    status,
    evidence: {
      recommendationType: "adaptive-scorer-promotion",
      action: governance.action === "rollback" ? "rollback" : "promote",
      baseScorer: governance.activeScorer,
      candidateScorer: governance.candidateScorer,
      alignedWindows: governance.alignedWindows,
      conflictingWindows: governance.conflictingWindows,
      windowVotes: governance.windowVotes,
      sampleSizeReady: Math.max(...(governance.windowVotes || []).map((item) => Number(item.sampleSize || 0)), 0),
      promotionMode: "multi-window-model-governance",
      governanceConfidence: governance.confidence,
    },
  }];
}

function normalizeContextMarketRegime(signal) {
  const context = signal?.signal_payload?.context && typeof signal.signal_payload.context === "object"
    ? signal.signal_payload.context
    : {};
  if (context.marketRegime) return String(context.marketRegime);
  const setupType = String(signal?.signal_payload?.analysis?.setupType || signal?.setup_type || "");
  if (setupType.toLowerCase().includes("contra")) return "contra-tendencia";
  return "tendencia";
}

function normalizeContextDirection(signal) {
  const context = signal?.signal_payload?.context && typeof signal.signal_payload.context === "object"
    ? signal.signal_payload.context
    : {};
  if (context.direction) return String(context.direction);
  const label = String(signal?.signal_label || "");
  if (label === "Comprar") return "comprar";
  if (label === "Vender") return "vender";
  return "neutral";
}

function normalizeContextVolumeCondition(signal) {
  const context = signal?.signal_payload?.context && typeof signal.signal_payload.context === "object"
    ? signal.signal_payload.context
    : {};
  if (context.volumeCondition) return String(context.volumeCondition);
  return String(signal?.signal_payload?.analysis?.volumeLabel || "volumen-normal");
}

function buildContextBiasByScope(signals) {
  const groups = new Map();
  for (const signal of (signals || [])) {
    if (!signal || signal.outcome_status === "pending") continue;
    const strategyId = String(signal.strategy_name || "");
    const version = String(signal.strategy_version || "");
    const timeframe = String(signal.timeframe || "");
    if (!strategyId || !version || !timeframe) continue;
    const marketRegime = normalizeContextMarketRegime(signal);
    const direction = normalizeContextDirection(signal);
    const volumeCondition = normalizeContextVolumeCondition(signal);
    const key = [strategyId, version, timeframe, marketRegime, direction, volumeCondition].join(":");
    const current = groups.get(key) || {
      strategyId,
      version,
      timeframe,
      marketRegime,
      direction,
      volumeCondition,
      signals: [],
    };
    current.signals.push(signal);
    groups.set(key, current);
  }

  const rows = [];
  for (const group of groups.values()) {
    const stats = summarizeSignals(group.signals);
    if (stats.total < 4) continue;
    const avgScore = group.signals.reduce((sum, item) => sum + Number(item.signal_score || 0), 0) / stats.total;
    const avgRr = group.signals.reduce((sum, item) => sum + Number(item.rr_ratio || 0), 0) / stats.total;
    const avgPnl = stats.total ? stats.pnl / stats.total : 0;
    const biasScore = Number((
      stats.pnl * 2.1
      + avgPnl * 7
      + (stats.winRate - 50) * 0.8
      + Math.min(stats.total, 14) * 0.35
      + avgScore * 0.04
      + avgRr * 3
    ).toFixed(2));
    if (Math.abs(biasScore) < 3 && stats.total < 7) continue;
    rows.push({
      strategyId: group.strategyId,
      version: group.version,
      timeframe: group.timeframe,
      marketRegime: group.marketRegime,
      direction: group.direction,
      volumeCondition: group.volumeCondition,
      sampleSize: stats.total,
      winRate: Number(stats.winRate.toFixed(2)),
      pnl: Number(stats.pnl.toFixed(2)),
      avgPnl: Number(avgPnl.toFixed(2)),
      avgScore: Number(avgScore.toFixed(1)),
      avgRr: Number(avgRr.toFixed(2)),
      biasScore,
    });
  }

  return rows.sort((left, right) => Math.abs(right.biasScore) - Math.abs(left.biasScore)).slice(0, 60);
}

function buildModelRegistry(rows, scorerPolicy, modelTrainingRuns = [], modelConfigs = []) {
  const cleanRows = (rows || []).filter((row) => row && row.realized_pnl != null);
  const total = cleanRows.length;
  const positiveRows = cleanRows.filter((row) => Number(row.realized_pnl || 0) > 0);
  const negativeRows = cleanRows.filter((row) => Number(row.realized_pnl || 0) <= 0);
  const avg = (list, field) => list.length ? list.reduce((sum, row) => sum + Number(row[field] || 0), 0) / list.length : 0;
  const winRate = total ? (positiveRows.length / total) * 100 : 0;
  const avgPnl = avg(cleanRows, "realized_pnl");
  const posAvgRr = avg(positiveRows, "rr_ratio");
  const negAvgRr = avg(negativeRows, "rr_ratio");
  const posAvgAdaptive = avg(positiveRows, "adaptive_score");
  const negAvgAdaptive = avg(negativeRows, "adaptive_score");
  const posAvgDuration = avg(positiveRows, "duration_minutes");
  const negAvgDuration = avg(negativeRows, "duration_minutes");
  const normalizedConfigs = Array.isArray(modelConfigs) ? modelConfigs : [];
  const activeConfig = normalizedConfigs.find((item) => item.active) || null;
  const activeScorer = String(activeConfig?.label || scorerPolicy?.activeScorer || "adaptive-v1").trim().toLowerCase() || "adaptive-v1";

  const runByLabel = new Map((modelTrainingRuns || []).map((item) => [String(item.label || ""), item]));
  const configByLabel = new Map(normalizedConfigs.map((item) => [String(item.label || ""), item]));
  const learnedGlobal = runByLabel.get("model-v2");
  const learnedRecent = runByLabel.get("model-v3");
  const learnedShort = runByLabel.get("model-v4");
  const learnedRrWeight = Number((3.2 + Math.max(0, posAvgRr - negAvgRr) * 4.2).toFixed(2));
  const learnedAdaptiveWeight = Number((0.035 + Math.max(0, posAvgAdaptive - negAvgAdaptive) * 0.0035).toFixed(4));
  const learnedDurationPenalty = Number((0.18 + Math.max(0, posAvgDuration - negAvgDuration) / 240).toFixed(3));
  const learnedConfidence = Number(clampScore(total * 2.8 + Math.max(0, winRate - 48) * 1.1 + Math.max(0, posAvgRr - 1) * 16, 0, 100).toFixed(1));

  return [
    {
      label: "model-v1",
      mode: "static",
      active: activeScorer === "model-v1",
      ready: configByLabel.get("model-v1") ? Boolean(configByLabel.get("model-v1").ready) : total >= 12,
      sampleSize: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").sampleSize || total) : total,
      confidence: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").confidence || 0) : Number(clampScore(total * 2 + Math.max(0, winRate - 48) * 0.9, 0, 100).toFixed(1)),
      avgPnl: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").avgPnl || avgPnl) : Number(avgPnl.toFixed(2)),
      winRate: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").winRate || winRate) : Number(winRate.toFixed(2)),
      rrWeight: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").rrWeight || 3.5) : 3.5,
      adaptiveScoreWeight: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").adaptiveScoreWeight || 0.03) : 0.03,
      durationPenaltyWeight: configByLabel.get("model-v1") ? Number(configByLabel.get("model-v1").durationPenaltyWeight || 0.25) : 0.25,
      reading: configByLabel.get("model-v1")?.reading || "Modelo base estático sobre features agregados.",
    },
    {
      label: "model-v2",
      mode: "learned",
      active: activeScorer === "model-v2",
      ready: configByLabel.get("model-v2") ? Boolean(configByLabel.get("model-v2").ready) : learnedGlobal ? Boolean(learnedGlobal.ready) : total >= 18 && learnedConfidence >= 62,
      sampleSize: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").sampleSize || total) : learnedGlobal ? Number(learnedGlobal.sampleSize || total) : total,
      confidence: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").confidence || learnedConfidence) : learnedGlobal ? Number(learnedGlobal.confidence || learnedConfidence) : learnedConfidence,
      avgPnl: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").avgPnl || avgPnl) : learnedGlobal ? Number(learnedGlobal.avgPnl || avgPnl) : Number(avgPnl.toFixed(2)),
      winRate: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").winRate || winRate) : learnedGlobal ? Number(learnedGlobal.winRate || winRate) : Number(winRate.toFixed(2)),
      rrWeight: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").rrWeight || learnedRrWeight) : learnedGlobal ? Number(learnedGlobal.rrWeight || learnedRrWeight) : learnedRrWeight,
      adaptiveScoreWeight: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").adaptiveScoreWeight || learnedAdaptiveWeight) : learnedGlobal ? Number(learnedGlobal.adaptiveScoreWeight || learnedAdaptiveWeight) : learnedAdaptiveWeight,
      durationPenaltyWeight: configByLabel.get("model-v2") ? Number(configByLabel.get("model-v2").durationPenaltyWeight || learnedDurationPenalty) : learnedGlobal ? Number(learnedGlobal.durationPenaltyWeight || learnedDurationPenalty) : learnedDurationPenalty,
      reading: configByLabel.get("model-v2")?.reading || learnedGlobal?.reading || "Modelo aprendido desde el dataset real de ejecución y features.",
    },
    {
      label: "model-v3",
      mode: "learned",
      active: activeScorer === "model-v3",
      ready: configByLabel.get("model-v3") ? Boolean(configByLabel.get("model-v3").ready) : learnedRecent ? Boolean(learnedRecent.ready) : false,
      sampleSize: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").sampleSize || 0) : learnedRecent ? Number(learnedRecent.sampleSize || 0) : 0,
      confidence: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").confidence || 0) : learnedRecent ? Number(learnedRecent.confidence || 0) : 0,
      avgPnl: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").avgPnl || avgPnl) : learnedRecent ? Number(learnedRecent.avgPnl || 0) : Number(avgPnl.toFixed(2)),
      winRate: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").winRate || winRate) : learnedRecent ? Number(learnedRecent.winRate || 0) : Number(winRate.toFixed(2)),
      rrWeight: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").rrWeight || learnedRrWeight) : learnedRecent ? Number(learnedRecent.rrWeight || learnedRrWeight) : learnedRrWeight,
      adaptiveScoreWeight: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").adaptiveScoreWeight || learnedAdaptiveWeight) : learnedRecent ? Number(learnedRecent.adaptiveScoreWeight || learnedAdaptiveWeight) : learnedAdaptiveWeight,
      durationPenaltyWeight: configByLabel.get("model-v3") ? Number(configByLabel.get("model-v3").durationPenaltyWeight || learnedDurationPenalty) : learnedRecent ? Number(learnedRecent.durationPenaltyWeight || learnedDurationPenalty) : learnedDurationPenalty,
      reading: configByLabel.get("model-v3")?.reading || learnedRecent?.reading || "Modelo learned reciente preparado para desafiar al modelo global cuando ya haya muestra suficiente.",
    },
    {
      label: "model-v4",
      mode: "learned",
      active: activeScorer === "model-v4",
      ready: configByLabel.get("model-v4") ? Boolean(configByLabel.get("model-v4").ready) : learnedShort ? Boolean(learnedShort.ready) : false,
      sampleSize: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").sampleSize || 0) : learnedShort ? Number(learnedShort.sampleSize || 0) : 0,
      confidence: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").confidence || 0) : learnedShort ? Number(learnedShort.confidence || 0) : 0,
      avgPnl: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").avgPnl || avgPnl) : learnedShort ? Number(learnedShort.avgPnl || 0) : Number(avgPnl.toFixed(2)),
      winRate: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").winRate || winRate) : learnedShort ? Number(learnedShort.winRate || 0) : Number(winRate.toFixed(2)),
      rrWeight: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").rrWeight || learnedRrWeight) : learnedShort ? Number(learnedShort.rrWeight || learnedRrWeight) : learnedRrWeight,
      adaptiveScoreWeight: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").adaptiveScoreWeight || learnedAdaptiveWeight) : learnedShort ? Number(learnedShort.adaptiveScoreWeight || learnedAdaptiveWeight) : learnedAdaptiveWeight,
      durationPenaltyWeight: configByLabel.get("model-v4") ? Number(configByLabel.get("model-v4").durationPenaltyWeight || learnedDurationPenalty) : learnedShort ? Number(learnedShort.durationPenaltyWeight || learnedDurationPenalty) : learnedDurationPenalty,
      reading: configByLabel.get("model-v4")?.reading || learnedShort?.reading || "Modelo learned corto preparado para reaccionar a cambios rápidos del edge reciente.",
    },
  ];
}

function computeFeatureModelScore(group, modelSpec) {
  const sampleSize = Number(group.sampleSize || 0);
  const pnl = Number(group.pnl || 0);
  const avgPnl = Number(group.avgPnl || 0);
  const winRate = Number(group.winRate || 0);
  const avgAdaptiveScore = Number(group.avgAdaptiveScore || 0);
  const avgRr = Number(group.avgRr || 0);
  const avgDurationMinutes = Number(group.avgDurationMinutes || 0);
  const rrWeight = Number(modelSpec?.rrWeight || 3.5);
  const adaptiveScoreWeight = Number(modelSpec?.adaptiveScoreWeight || 0.03);
  const durationPenaltyWeight = Number(modelSpec?.durationPenaltyWeight || 0.25);
  return Number((
    pnl * 2.5
    + avgPnl * 10
    + (winRate - 50) * 1.1
    + Math.min(sampleSize, 30) * 0.45
    + avgAdaptiveScore * adaptiveScoreWeight
    + avgRr * rrWeight
    - Math.min(avgDurationMinutes / 60, 10) * durationPenaltyWeight
  ).toFixed(2));
}

function getFeatureModelScoreForLabel(featureModel, label) {
  if (!featureModel || !label) return Number(featureModel?.modelScore || 0);
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "model-v1") return Number(featureModel.modelV1Score ?? featureModel.modelScore ?? 0);
  if (normalized === "model-v2") return Number(featureModel.modelV2Score ?? featureModel.modelScore ?? 0);
  if (normalized === "model-v3") return Number(featureModel.modelV3Score ?? featureModel.modelV2Score ?? featureModel.modelScore ?? 0);
  if (normalized === "model-v4") return Number(featureModel.modelV4Score ?? featureModel.modelV3Score ?? featureModel.modelV2Score ?? featureModel.modelScore ?? 0);
  return Number(featureModel.modelScore || 0);
}

function buildFeatureModelByScope(rows, modelRegistry = []) {
  const groups = new Map();
  for (const row of (rows || [])) {
    if (!row) continue;
    const strategyId = String(row.strategy_id || "");
    const version = String(row.strategy_version || "");
    const timeframe = String(row.timeframe || "");
    if (!strategyId || !version || !timeframe) continue;
    const marketRegime = String(row.market_regime || "tendencia");
    const direction = String(row.direction || "neutral");
    const volumeCondition = String(row.volume_condition || "volumen-normal");
    const key = [strategyId, version, timeframe, marketRegime, direction, volumeCondition].join(":");
    const current = groups.get(key) || {
      strategyId,
      version,
      timeframe,
      marketRegime,
      direction,
      volumeCondition,
      rows: [],
    };
    current.rows.push(row);
    groups.set(key, current);
  }

  const models = [];
  for (const group of groups.values()) {
    const sampleSize = group.rows.length;
    if (sampleSize < 5) continue;
    const wins = group.rows.filter((item) => Number(item.realized_pnl || 0) > 0).length;
    const pnl = group.rows.reduce((sum, item) => sum + Number(item.realized_pnl || 0), 0);
    const avgPnl = sampleSize ? pnl / sampleSize : 0;
    const avgAdaptiveScore = sampleSize
      ? group.rows.reduce((sum, item) => sum + Number(item.adaptive_score || item.signal_score || 0), 0) / sampleSize
      : 0;
    const avgRr = sampleSize
      ? group.rows.reduce((sum, item) => sum + Number(item.rr_ratio || 0), 0) / sampleSize
      : 0;
    const avgDuration = sampleSize
      ? group.rows.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0) / sampleSize
      : 0;
    const winRate = sampleSize ? (wins / sampleSize) * 100 : 0;
    const groupMetrics = {
      sampleSize,
      pnl,
      avgPnl,
      winRate,
      avgAdaptiveScore,
      avgRr,
      avgDurationMinutes: avgDuration,
    };
    const scoreByLabel = new Map(
      (modelRegistry || []).map((item) => [String(item.label || ""), computeFeatureModelScore(groupMetrics, item)]),
    );
    const modelV1Score = Number(scoreByLabel.get("model-v1") || 0);
    const modelV2Score = Number(scoreByLabel.get("model-v2") || 0);
    const modelV3Score = Number(scoreByLabel.get("model-v3") || modelV2Score || 0);
    const modelV4Score = Number(scoreByLabel.get("model-v4") || modelV3Score || modelV2Score || 0);
    const modelScore = modelV1Score;
    if (Math.abs(modelScore) < 2 && sampleSize < 8) continue;
    const confidence = Number(
      clampScore(
        sampleSize * 4 + Math.max(0, winRate - 48) * 0.7 + Math.max(0, avgRr - 1) * 8,
        0,
        100,
      ).toFixed(1),
    );
    const preferredCandidate = (modelRegistry || [])
      .filter((item) => item && item.label)
      .map((item) => ({
        label: String(item.label),
        score: Number(scoreByLabel.get(String(item.label)) || 0),
        ready: Boolean(item.ready),
        confidence: Number(item.confidence || 0),
      }))
      .sort((left, right) => right.score - left.score || right.confidence - left.confidence)[0] || null;
    const fallbackPreferred = modelV4Score > modelV3Score && modelV4Score > modelV2Score && modelV4Score > modelV1Score
      ? "model-v4"
      : modelV3Score > modelV2Score && modelV3Score > modelV1Score
        ? "model-v3"
        : modelV2Score > modelV1Score
          ? "model-v2"
          : "model-v1";
    const preferredModel = preferredCandidate?.label || fallbackPreferred;
    const preferredScore = Number(scoreByLabel.get(preferredModel) || modelV1Score);
    const competingScores = Array.from(scoreByLabel.values()).sort((left, right) => right - left);
    const nextBestScore = Number(competingScores[1] || 0);
    models.push({
      strategyId: group.strategyId,
      version: group.version,
      timeframe: group.timeframe,
      marketRegime: group.marketRegime,
      direction: group.direction,
      volumeCondition: group.volumeCondition,
      sampleSize,
      winRate: Number(winRate.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      avgPnl: Number(avgPnl.toFixed(2)),
      avgAdaptiveScore: Number(avgAdaptiveScore.toFixed(1)),
      avgRr: Number(avgRr.toFixed(2)),
      avgDurationMinutes: Number(avgDuration.toFixed(1)),
      modelScore,
      modelV1Score: Number(modelV1Score.toFixed(2)),
      modelV2Score: Number(modelV2Score.toFixed(2)),
      modelV3Score: Number(modelV3Score.toFixed(2)),
      modelV4Score: Number(modelV4Score.toFixed(2)),
      preferredModel,
      preferredModelConfidence: Number(
        clampScore(
          confidence + Math.max(0, Math.abs(preferredScore - nextBestScore)) * 0.8,
          0,
          100,
        ).toFixed(1),
      ),
      confidence,
    });
  }

  return models.sort((left, right) => Math.abs(right.modelScore) - Math.abs(left.modelScore)).slice(0, 80);
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function buildModelShadowScorer({
  baseSignalScore,
  adaptiveBias,
  contextualBias,
  featureModel,
  scopeAction,
  modelSpec,
}) {
  if (!featureModel || !modelSpec?.label) return null;
  const label = String(modelSpec.label);
  const mode = String(modelSpec.mode || "static") === "learned" ? "learned" : "static";
  const baseModelScore = getFeatureModelScoreForLabel(featureModel, label);
  const multiplier = label === "model-v3" ? 0.92 : label === "model-v2" ? 0.86 : 0.82;
  const modelBias = Math.max(-38, Math.min(38, baseModelScore * multiplier));
  const scopeAdjustment = scopeAction === "relax" ? (mode === "learned" ? 6 : 5) : scopeAction === "tighten" ? (mode === "learned" ? -10 : -8) : 0;
  const promotionBias = mode === "learned" ? 4 : 0;
  const finalScore = scopeAction === "cut"
    ? 0
    : clampScore(
      baseSignalScore
      + adaptiveBias * (mode === "learned" ? 0.28 : 0.35)
      + contextualBias * (mode === "learned" ? 0.52 : 0.55)
      + modelBias
      + scopeAdjustment
      + promotionBias,
    );
  const confidence = clampScore(
    Number(featureModel.preferredModelConfidence || featureModel.confidence || 0) * (mode === "learned" ? 0.82 : 0.75)
    + Math.min(mode === "learned" ? 32 : 28, Number(featureModel.sampleSize || 0) * (mode === "learned" ? 1.9 : 1.7))
    + Math.max(0, Number(featureModel.avgRr || 0) - 1) * (mode === "learned" ? 11 : 10)
    + Math.max(0, Number(featureModel.winRate || 0) - 50) * (mode === "learned" ? 0.42 : 0.35),
    0,
    100,
  );
  const candidateReady = label === "model-v4"
    ? Number(featureModel.sampleSize || 0) >= 16
      && Number(featureModel.preferredModelConfidence || featureModel.confidence || 0) >= 72
      && Number(featureModel.modelV4Score || 0) > Number(featureModel.modelV3Score || 0)
    : label === "model-v3"
    ? Number(featureModel.sampleSize || 0) >= 14
      && Number(featureModel.preferredModelConfidence || featureModel.confidence || 0) >= 68
      && Number(featureModel.modelV3Score || 0) > Number(featureModel.modelV2Score || 0)
    : label === "model-v2"
      ? Number(featureModel.sampleSize || 0) >= 12
        && Number(featureModel.preferredModelConfidence || featureModel.confidence || 0) >= 64
        && Number(featureModel.modelV2Score || 0) > Number(featureModel.modelV1Score || 0)
      : Number(featureModel.sampleSize || 0) >= 8 && Number(featureModel.confidence || 0) >= 58;
  return {
    label,
    finalScore: Number(finalScore.toFixed(1)),
    confidence: Number(confidence.toFixed(1)),
    modelBias: Number(modelBias.toFixed(1)),
    candidateReady,
    mode,
  };
}

function buildModelShadowCandidates({
  baseSignalScore,
  adaptiveBias,
  contextualBias,
  featureModel,
  scopeAction,
  modelRegistry = [],
  activeScorer = "",
}) {
  const preferLearned = !String(activeScorer || "").toLowerCase().startsWith("model-");
  return (modelRegistry || [])
    .filter((item) => item && item.label && String(item.label).toLowerCase() !== String(activeScorer || "").toLowerCase())
    .map((item) => buildModelShadowScorer({
      baseSignalScore,
      adaptiveBias,
      contextualBias,
      featureModel,
      scopeAction,
      modelSpec: item,
    }))
    .filter(Boolean)
    .sort((left, right) => {
      if (Boolean(right.candidateReady) !== Boolean(left.candidateReady)) return Number(Boolean(right.candidateReady)) - Number(Boolean(left.candidateReady));
      if (preferLearned && right.mode !== left.mode) return right.mode === "learned" ? 1 : -1;
      return Number(right.finalScore || 0) - Number(left.finalScore || 0) || Number(right.confidence || 0) - Number(left.confidence || 0);
    });
}

function buildAdaptiveScorer({
  baseSignalScore,
  adaptivePrimary,
  contextBias,
  featureModel,
  scopeAction,
  scorerPolicy,
  modelRegistry,
}) {
  const adaptiveBias = adaptivePrimary ? Math.min(28, 10 + Number(adaptivePrimary.confidence || 0) * 15) : 0;
  const contextualBias = contextBias ? Math.max(-18, Math.min(18, Number(contextBias.biasScore || 0) * 0.6)) : 0;
  const activeScorer = String(scorerPolicy?.activeScorer || "").trim().toLowerCase();
  const promotedAdaptiveV2 = activeScorer === "adaptive-v2";
  const promotedModel = activeScorer.startsWith("model-") || promotedAdaptiveV2;
  const activeModelScore = activeScorer.startsWith("model-")
    ? getFeatureModelScoreForLabel(featureModel, activeScorer)
    : Number(featureModel?.modelScore || 0);
  const modelMultiplier = activeScorer === "model-v4" ? 0.98 : activeScorer === "model-v3" ? 0.95 : activeScorer === "model-v2" ? 0.9 : activeScorer === "model-v1" ? 0.82 : promotedAdaptiveV2 ? 0.7 : 0.45;
  const promotionBias = promotedModel && featureModel ? (activeScorer === "model-v4" ? 14 : activeScorer === "model-v3" ? 12 : activeScorer === "model-v2" ? 10 : activeScorer === "model-v1" ? 8 : 6) : 0;
  const modelBias = featureModel ? Math.max(-34, Math.min(34, activeModelScore * modelMultiplier)) : 0;
  const scopeBias = scopeAction === "cut"
    ? -1000
    : scopeAction === "tighten"
      ? -18
      : scopeAction === "relax"
        ? 8
        : 0;
  const finalScore = scopeAction === "cut"
    ? 0
    : clampScore(baseSignalScore + adaptiveBias + contextualBias + modelBias + promotionBias + (scopeAction === "relax" ? 4 : scopeAction === "tighten" ? -6 : 0));
  const confidence = clampScore(
    (adaptivePrimary ? Number(adaptivePrimary.confidence || 0) * 55 : 0)
    + (contextBias ? Math.min(35, Number(contextBias.sampleSize || 0) * 3 + Math.max(0, Number(contextBias.winRate || 0) - 50) * 0.4) : 0)
    + (featureModel ? Math.min(45, Number(featureModel.confidence || 0) * 0.45 + Number(featureModel.sampleSize || 0) * 1.8) : 0)
    + (promotedModel && featureModel ? 10 : 0)
    + (scopeAction ? 10 : 0),
    0,
    100,
  );
  const shadowCandidates = buildModelShadowCandidates({
    baseSignalScore,
    adaptiveBias,
    contextualBias,
    featureModel,
    scopeAction,
    modelRegistry,
    activeScorer,
  });
  const preferredCandidate = shadowCandidates[0] || null;
  const scorerLabel = activeScorer.startsWith("model-")
    ? activeScorer
    : promotedAdaptiveV2
      ? "adaptive-v2"
      : featureModel
        ? "adaptive-v2"
        : "adaptive-v1";

  return {
    label: scorerLabel,
    baseScore: Number(baseSignalScore.toFixed(1)),
    adaptivePrimaryBias: Number(adaptiveBias.toFixed(1)),
    contextualBias: Number(contextualBias.toFixed(1)),
    modelBias: Number(modelBias.toFixed(1)),
    promotionBias: Number(promotionBias.toFixed(1)),
    scopeBias: Number(scopeBias.toFixed(1)),
    finalScore: Number(finalScore.toFixed(1)),
    confidence: Number(confidence.toFixed(1)),
    usedAdaptivePrimary: Boolean(adaptivePrimary),
    usedContextBias: Boolean(contextBias),
    usedFeatureModel: Boolean(featureModel),
    promotedModel,
    activeModelVersion: activeScorer.startsWith("model-") ? activeScorer : promotedAdaptiveV2 ? "adaptive-v2" : "adaptive-v1",
    scopeAction: String(scopeAction || ""),
    candidateLabel: preferredCandidate?.label,
    candidateFinalScore: preferredCandidate?.finalScore,
    candidateConfidence: preferredCandidate?.confidence,
    candidateModelBias: preferredCandidate?.modelBias,
    candidateDelta: preferredCandidate ? Number((preferredCandidate.finalScore - finalScore).toFixed(1)) : undefined,
    candidateReady: preferredCandidate?.candidateReady,
    candidateMode: preferredCandidate?.mode,
  };
}

export function applySystemStrategyDecision(snapshot, decisionState, context = {}) {
  const marketScope = context.marketScope || "watchlist";
  const timeframe = context.timeframe || snapshot?.timeframe || "";
  const promotedVersionByStrategy = decisionState?.promotedVersionByStrategy || {};
  const activeStrategies = Array.isArray(decisionState?.activeStrategyByScope) ? decisionState.activeStrategyByScope : [];
  const sandboxExperiments = Array.isArray(decisionState?.sandboxExperimentsByScope) ? decisionState.sandboxExperimentsByScope : [];
  const executionEligibleScopes = Array.isArray(decisionState?.executionEligibleScopes) ? decisionState.executionEligibleScopes : [];
  const adaptivePrimaryByScope = Array.isArray(decisionState?.adaptivePrimaryByScope) ? decisionState.adaptivePrimaryByScope : [];
  const contextBiasByScope = Array.isArray(decisionState?.contextBiasByScope) ? decisionState.contextBiasByScope : [];
  const featureModelByScope = Array.isArray(decisionState?.featureModelByScope) ? decisionState.featureModelByScope : [];
  const modelRegistry = Array.isArray(decisionState?.modelRegistry) ? decisionState.modelRegistry : [];
  const scorerPolicy = decisionState?.scorerPolicy || null;
  const scopeTuningByScope = Array.isArray(decisionState?.scopeTuningByScope) ? decisionState.scopeTuningByScope : [];
  const candidates = Array.isArray(snapshot?.candidates) ? snapshot.candidates : [];

  const enrichedCandidates = candidates.map((candidate) => {
    const strategyId = candidate.strategy?.id;
    const version = candidate.strategy?.version;
    const activeRule = activeStrategies.find((item) =>
      item.strategyId === strategyId
        && item.version === version
        && scopeMatches(item, { marketScope, timeframe }),
    );
    const sandboxRule = sandboxExperiments.find((item) =>
      item.candidateStrategyId === strategyId
        && item.candidateVersion === version
        && item.candidateRunnable
        && scopeMatches(item, { marketScope, timeframe }),
    );
    const executionRule = executionEligibleScopes.find((item) =>
      item.strategyId === strategyId
        && item.version === version
        && scopeMatches(item, { marketScope, timeframe }),
    );
    const scopeTuning = scopeTuningByScope.find((item) =>
      item.strategyId === strategyId
        && item.timeframe === timeframe
        && item.enabled !== false
    );
    const adaptivePrimary = adaptivePrimaryByScope.find((item) =>
      item.strategyId === strategyId
        && item.version === version
        && item.timeframe === timeframe
    );
    const candidateDirection = String(candidate.signal?.label || "").toLowerCase() === "comprar"
      ? "comprar"
      : String(candidate.signal?.label || "").toLowerCase() === "vender"
        ? "vender"
        : "neutral";
    const candidateMarketRegime = String(
      candidate.analysis?.setupType?.toLowerCase().includes("contra")
        ? "contra-tendencia"
        : candidate.analysis?.higherTimeframeBias?.toLowerCase() === "mixto"
          ? "mixto"
          : "tendencia",
    );
    const candidateVolumeCondition = String(candidate.analysis?.volumeLabel || "volumen-normal");
    const contextBias = contextBiasByScope.find((item) =>
      item.strategyId === strategyId
        && item.version === version
        && item.timeframe === timeframe
        && item.marketRegime === candidateMarketRegime
        && item.direction === candidateDirection
        && item.volumeCondition === candidateVolumeCondition
    );
    const featureModel = featureModelByScope.find((item) =>
      item.strategyId === strategyId
        && item.version === version
        && item.timeframe === timeframe
        && item.marketRegime === candidateMarketRegime
        && item.direction === candidateDirection
        && item.volumeCondition === candidateVolumeCondition
    );
    const scopeAction = String(scopeTuning?.action || "");
    const candidateBaseRank = Number(candidate.rankScore || candidate.signal?.score || candidate.signal?.signalScore || 0);
    const baseSignalScore = Number(candidate.signal?.score || candidate.signal?.signalScore || 0);
    const scorer = buildAdaptiveScorer({
      baseSignalScore,
      adaptivePrimary,
      contextBias,
      featureModel,
      scopeAction,
      scorerPolicy,
      modelRegistry,
    });

    let decisionSource = "inactive";
    if (executionRule) decisionSource = "experiment-active";
    else if (promotedVersionByStrategy[strategyId] === version) decisionSource = "promoted";
    else if (activeRule) decisionSource = "active";
    else if (sandboxRule) decisionSource = "sandbox";
    if (scopeAction === "cut") decisionSource = "suppressed";

    return {
      ...candidate,
      decisionSource,
      experimentId: sandboxRule?.id || executionRule?.experimentId || null,
      scopeAction,
      adaptivePrimary,
      scopeTuning,
      contextBias,
      featureModel,
      scorer,
      effectiveRank: candidateBaseRank + scorer.scopeBias + scorer.adaptivePrimaryBias,
      adaptiveScore: scorer.finalScore,
      featureAdjustedRank: candidateBaseRank + scorer.scopeBias + scorer.adaptivePrimaryBias + scorer.contextualBias,
      executionEligible: scopeAction === "cut"
        ? false
        : Boolean(executionRule || activeRule || promotedVersionByStrategy[strategyId] === version),
    };
  });

  const rankedCandidates = [...enrichedCandidates].sort((left, right) => {
    const priority = (candidate) => {
      if (candidate.decisionSource === "experiment-active") return 4;
      if (candidate.decisionSource === "promoted") return 3;
      if (candidate.decisionSource === "active") return 2;
      if (candidate.decisionSource === "sandbox") return 1;
      if (candidate.decisionSource === "suppressed") return -1;
      return 0;
    };
    return priority(right) - priority(left) || Number(right.featureAdjustedRank || right.effectiveRank || 0) - Number(left.featureAdjustedRank || left.effectiveRank || 0);
  });

  const operationalPrimary = rankedCandidates.find((candidate) => candidate.decisionSource === "experiment-active" && candidate.executionEligible)
    || rankedCandidates.find((candidate) => candidate.decisionSource === "promoted" && candidate.executionEligible)
    || rankedCandidates.find((candidate) => candidate.decisionSource === "active" && candidate.executionEligible)
    || rankedCandidates.find((candidate) => candidate.executionEligible)
    || rankedCandidates.find((candidate) => candidate.decisionSource !== "suppressed")
    || rankedCandidates[0]
    || snapshot?.primary;

  const strategyCandidates = enrichedCandidates.map((candidate) => ({
    ...candidate,
    isPrimary: Boolean(
      candidate.strategy?.id === operationalPrimary?.strategy?.id
        && candidate.strategy?.version === operationalPrimary?.strategy?.version,
    ),
  }));

  const decision = {
    marketScope,
    timeframeScope: timeframe,
    source: operationalPrimary?.decisionSource || "fallback",
    executionEligible: Boolean(operationalPrimary?.executionEligible),
    executionReason: operationalPrimary?.scopeAction === "cut"
      ? "Este scope quedó cortado por el motor adaptativo y se guarda solo como observación."
      : operationalPrimary?.executionEligible
      ? "La señal pertenece al flujo operativo actual del sistema."
      : "La lectura quedó fuera del motor activo y se guarda solo como observación.",
    primaryStrategy: operationalPrimary?.strategy || snapshot?.primary?.strategy || {},
    primaryExperimentId: operationalPrimary?.experimentId || null,
    primaryScopeAction: operationalPrimary?.scopeAction || "",
    adaptivePrimary: operationalPrimary?.adaptivePrimary || null,
    contextBias: operationalPrimary?.contextBias || null,
    adaptiveScore: operationalPrimary?.adaptiveScore ?? null,
    scorer: operationalPrimary?.scorer || null,
    activeStrategies: activeStrategies
      .filter((item) => scopeMatches(item, { marketScope, timeframe }))
      .map((item) => ({
        strategyId: item.strategyId,
        version: item.version,
        label: item.label,
        status: item.status,
      })),
    scopeTuning: operationalPrimary?.scopeTuning || null,
    sandboxExperimentIds: sandboxExperiments
      .filter((item) => item.candidateRunnable && scopeMatches(item, { marketScope, timeframe }))
      .map((item) => item.id),
  };

  return {
    strategy: operationalPrimary?.strategy || snapshot?.primary?.strategy,
    signal: operationalPrimary?.signal || snapshot?.primary?.signal,
    analysis: operationalPrimary?.analysis || snapshot?.primary?.analysis,
    plan: operationalPrimary?.plan || snapshot?.plan,
    strategyCandidates,
    decision,
  };
}

export async function listStrategyEngine(req) {
  const session = requireSession(req);

  try {
    const registryParams = new URLSearchParams({
      select: "*",
      order: "strategy_id.asc",
    });
    const versionsParams = new URLSearchParams({
      select: "*",
      order: "strategy_id.asc,version.asc",
    });
    const experimentsParams = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "50",
    });
    const recommendationsParams = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "50",
    });

    const [registry, versions, experiments, initialRecommendations] = await Promise.all([
      supabaseRequest(`${STRATEGY_REGISTRY_TABLE}?${registryParams.toString()}`),
      supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionsParams.toString()}`),
      supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${experimentsParams.toString()}`),
      supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?${recommendationsParams.toString()}`),
    ]);

    let recommendations = initialRecommendations || [];
    if (!recommendations.length) {
      recommendations = await generateAdaptiveRecommendationsForUser(session.username).catch(() => []);
    }

    return {
      registry: registry || [],
      versions: versions || [],
      experiments: experiments || [],
      recommendations: recommendations || [],
      decision: await getSystemStrategyDecisionState(session.username),
    };
  } catch {
    return {
      registry: FALLBACK_REGISTRY,
      versions: FALLBACK_VERSIONS,
      experiments: [],
      recommendations: [],
      decision: await getSystemStrategyDecisionState(session.username),
    };
  }
}

function getVersionParameters(versions, strategyId, version) {
  const match = (versions || []).find((item) => item.strategy_id === strategyId && item.version === version);
  return match?.parameters || {};
}

function getVersionProfile(versions, strategyId, version) {
  const match = (versions || []).find((item) => item.strategy_id === strategyId && item.version === version);
  return {
    preferredTimeframes: Array.isArray(match?.preferred_timeframes) ? match.preferred_timeframes : [],
    tradingStyle: match?.trading_style || "",
    holdingProfile: match?.holding_profile || "",
    idealMarketConditions: Array.isArray(match?.ideal_market_conditions) ? match.ideal_market_conditions : [],
  };
}

function summarizeSignals(signals) {
  const total = signals.length;
  const wins = signals.filter((item) => item.outcome_status === "win").length;
  const losses = signals.filter((item) => item.outcome_status === "loss").length;
  const pnl = signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const winRate = total ? (wins / total) * 100 : 0;
  const avgPnl = total ? pnl / total : 0;
  return { total, wins, losses, pnl, winRate, avgPnl };
}

function getSignalDirection(item) {
  const raw = String(item.signal_label || item.signal_payload?.signal?.label || item.signal_payload?.context?.direction || "").toLowerCase();
  if (raw.includes("compr")) return "buy";
  if (raw.includes("vend")) return "sell";
  return "wait";
}

function pushRecommendation(recommendations, row) {
  if (!row) return;
  if (recommendations.some((item) => item.recommendation_key === row.recommendation_key)) return;
  recommendations.push(row);
}

function buildDirectionalThresholdRecommendation({ strategyId, version, params, signals }) {
  const stats = summarizeSignals(signals);
  if (stats.total < 6) return null;

  const buySignals = signals.filter((item) => getSignalDirection(item) === "buy");
  const sellSignals = signals.filter((item) => getSignalDirection(item) === "sell");
  const dominantDirection = buySignals.length >= sellSignals.length ? "buy" : "sell";
  const weakPerformance = stats.pnl <= 0 || stats.winRate < 48;
  const strongPerformance = stats.pnl > 0 && stats.winRate >= 58;
  if (!weakPerformance && !strongPerformance) return null;

  if (dominantDirection === "buy") {
    const currentValue = Number(params.buyThreshold || 65);
    return {
      recommendation_key: `${strategyId}:${version}:buy-threshold-${weakPerformance ? "tighten" : "relax"}`,
      strategy_id: strategyId,
      strategy_version: version,
      parameter_key: "buyThreshold",
      title: weakPerformance ? "Pedir más convicción en compras" : "Abrir un poco más el filtro comprador",
      summary: weakPerformance
        ? "Las compras de esta versión están dejando un rendimiento flojo. Conviene exigir más puntuación antes de tratarlas como entrada válida."
        : "Las compras de esta versión están respondiendo bien con muestra suficiente. Vale la pena relajar un poco el umbral para capturar más oportunidades limpias.",
      current_value: currentValue,
      suggested_value: weakPerformance ? Math.min(92, currentValue + 2) : Math.max(52, currentValue - 2),
      confidence: Math.min(0.93, 0.56 + stats.total * 0.025 + Math.abs(stats.pnl) / 150),
      status: "draft",
      evidence: {
        sampleSize: stats.total,
        winRate: stats.winRate,
        pnl: stats.pnl,
        dominantDirection,
      },
    };
  }

  const currentValue = Number(params.sellThreshold || 35);
  return {
    recommendation_key: `${strategyId}:${version}:sell-threshold-${weakPerformance ? "tighten" : "relax"}`,
    strategy_id: strategyId,
    strategy_version: version,
    parameter_key: "sellThreshold",
    title: weakPerformance ? "Pedir más convicción en ventas" : "Abrir un poco más el filtro vendedor",
    summary: weakPerformance
      ? "Las ventas de esta versión están dejando un rendimiento flojo. Conviene exigir una lectura bajista más fuerte antes de validarlas."
      : "Las ventas de esta versión están respondiendo bien con muestra suficiente. Se puede probar un umbral algo menos estricto para capturar más setups útiles.",
    current_value: currentValue,
    suggested_value: weakPerformance ? Math.max(8, currentValue - 2) : Math.min(48, currentValue + 2),
    confidence: Math.min(0.93, 0.56 + stats.total * 0.025 + Math.abs(stats.pnl) / 150),
    status: "draft",
    evidence: {
      sampleSize: stats.total,
      winRate: stats.winRate,
      pnl: stats.pnl,
      dominantDirection,
    },
  };
}

function buildBreakoutBufferRecommendation(params, signals) {
  const fastFrames = signals.filter((item) => ["5m", "15m"].includes(String(item.timeframe || "").toLowerCase()));
  const stats = summarizeSignals(fastFrames);
  if (stats.total < 5 || (stats.pnl >= 0 && stats.winRate >= 48)) return null;
  const currentValue = Number(params.breakoutBufferPct || 0.1);
  return {
    recommendation_key: "breakout:v1:breakout-buffer-pct",
    strategy_id: "breakout",
    strategy_version: "v1",
    parameter_key: "breakoutBufferPct",
    title: "Dar más margen al breakout en marcos rápidos",
    summary: "Las rupturas en 5m y 15m están entrando demasiado pegadas al ruido del rango. Conviene pedir un poco más de distancia antes de validarlas.",
    current_value: currentValue,
    suggested_value: Number((currentValue + 0.05).toFixed(2)),
    confidence: Math.min(0.9, 0.58 + stats.total * 0.025 + Math.abs(stats.pnl) / 120),
    status: "draft",
    evidence: {
      sampleSize: stats.total,
      winRate: stats.winRate,
      pnl: stats.pnl,
      timeframeBand: "5m-15m",
    },
  };
}

function buildExecutionScopeOverrideRecommendations(signals, profile) {
  const scopedGroups = new Map();
  for (const signal of signals) {
    const strategyId = String(signal.strategy_name || "");
    const timeframe = String(signal.timeframe || "");
    if (!strategyId || !timeframe) continue;
    const key = `${strategyId}:${timeframe}`;
    const current = scopedGroups.get(key) || {
      strategyId,
      timeframe,
      versionCounts: new Map(),
      signals: [],
    };
    const versionKey = String(signal.strategy_version || "v1");
    current.versionCounts.set(versionKey, Number(current.versionCounts.get(versionKey) || 0) + 1);
    current.signals.push(signal);
    scopedGroups.set(key, current);
  }

  const recommendations = [];
  for (const group of scopedGroups.values()) {
    const stats = summarizeSignals(group.signals);
    if (stats.total < 6) continue;

    const thresholds = getExecutionScopeThresholds(profile, group.strategyId, group.timeframe);
    const avgScore = group.signals.reduce((sum, item) => sum + Number(item.signal_score || 0), 0) / stats.total;
    const avgRr = group.signals.reduce((sum, item) => sum + Number(item.rr_ratio || 0), 0) / stats.total;
    const strongPerformance = stats.pnl > 0 && stats.winRate >= 56;
    const severeWeakPerformance = stats.total >= 8 && (
      stats.avgPnl <= -0.6
      || (stats.winRate <= 38 && stats.pnl < 0)
      || (stats.pnl <= -4 && stats.winRate <= 45)
    );
    const weakPerformance = severeWeakPerformance || stats.pnl < 0 || stats.winRate <= 43;
    if (!strongPerformance && !weakPerformance) continue;

    const dominantVersion = [...group.versionCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "v1";
    const scopeAction = strongPerformance ? "relax" : severeWeakPerformance ? "cut" : "tighten";
    const suggestedScore = strongPerformance
      ? Math.max(18, Math.min(thresholds.minSignalScore - 6, roundToStep(avgScore - 2)))
      : severeWeakPerformance
        ? Math.min(96, Math.max(thresholds.minSignalScore + 14, roundToStep(avgScore + 10)))
        : Math.min(92, Math.max(thresholds.minSignalScore + 6, roundToStep(avgScore + 4)));
    const suggestedRr = strongPerformance
      ? Math.max(0.15, Math.min(thresholds.minRrRatio - 0.12, roundToStep(avgRr - 0.05, 0.05)))
      : severeWeakPerformance
        ? Math.min(3, Math.max(thresholds.minRrRatio + 0.35, roundToStep(avgRr + 0.25, 0.05)))
        : Math.min(3, Math.max(thresholds.minRrRatio + 0.15, roundToStep(avgRr + 0.1, 0.05)));

    if (
      Math.abs(suggestedScore - thresholds.minSignalScore) < 2
      && Math.abs(suggestedRr - thresholds.minRrRatio) < 0.05
    ) {
      continue;
    }

    const confidenceBase = severeWeakPerformance ? 0.6 : 0.54;
    const confidence = Math.min(0.96, confidenceBase + stats.total * 0.025 + Math.abs(stats.pnl) / 160);
    const status = stats.total >= (severeWeakPerformance ? 7 : 8) && confidence >= (severeWeakPerformance ? 0.68 : 0.7) ? "sandbox" : "draft";
    recommendations.push({
      recommendation_key: `execution-scope:${group.strategyId}:${group.timeframe}:${scopeAction}`,
      strategy_id: group.strategyId,
      strategy_version: dominantVersion,
      parameter_key: "executionScope",
      title: strongPerformance
        ? `Abrir más ${group.strategyId} en ${group.timeframe}`
        : severeWeakPerformance
          ? `Cortar ${group.strategyId} en ${group.timeframe}`
          : `Endurecer ${group.strategyId} en ${group.timeframe}`,
      summary: strongPerformance
        ? `Este scope está respondiendo mejor que la media con muestra suficiente. Conviene darle un filtro demo más flexible para capturar más setups útiles.`
        : severeWeakPerformance
          ? `Este scope está destruyendo edge con suficiente muestra real. Conviene casi cerrarlo en demo hasta que deje de meter ruido.`
          : `Este scope está dejando una lectura floja. Conviene subir el filtro demo aquí antes de seguir ejecutándolo igual que el resto.`,
      current_value: thresholds.minSignalScore,
      suggested_value: suggestedScore,
      confidence,
      status,
      evidence: {
        recommendationType: "execution-scope-override",
        timeframe: group.timeframe,
        sampleSize: stats.total,
        winRate: stats.winRate,
        pnl: stats.pnl,
        avgPnl: Number(stats.avgPnl.toFixed(2)),
        avgScore: Number(avgScore.toFixed(1)),
        avgRr: Number(avgRr.toFixed(2)),
        currentMinSignalScore: thresholds.minSignalScore,
        suggestedMinSignalScore: suggestedScore,
        currentMinRrRatio: Number(thresholds.minRrRatio.toFixed(2)),
        suggestedMinRrRatio: Number(suggestedRr.toFixed(2)),
        scopeStrength: strongPerformance ? "strong" : severeWeakPerformance ? "critical-weak" : "weak",
        scopeAction,
        severity: severeWeakPerformance ? "high" : strongPerformance ? "opportunity" : "medium",
        overrideAlreadyPresent: Boolean(thresholds.override),
        promotionMode: strongPerformance ? "manual-relax" : severeWeakPerformance ? "priority-cut" : "controlled-tighten",
      },
    });
  }

  return recommendations;
}

function mergeRecommendationRow(existing, nextRow) {
  if (!existing) return nextRow;
  const preservedEvidence = existing.evidence && typeof existing.evidence === "object" ? existing.evidence : {};
  const nextEvidence = nextRow.evidence && typeof nextRow.evidence === "object" ? nextRow.evidence : {};
  const preservedStatus = existing.status === "active" || existing.status === "sandbox" ? existing.status : nextRow.status;
  return {
    ...nextRow,
    id: existing.id,
    status: preservedStatus,
    evidence: {
      ...nextEvidence,
      ...preservedEvidence,
      ...nextEvidence,
    },
  };
}

function shouldAutoApplyScopeRecommendation(recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const scopeAction = String(evidence.scopeAction || "");
  return (
    evidence.recommendationType === "execution-scope-override"
    && recommendation.status === "sandbox"
    && (
      (
        evidence.scopeStrength === "weak"
        && Number(evidence.sampleSize || 0) >= 12
        && Number(recommendation.confidence || 0) >= 0.78
      ) || (
        scopeAction === "cut"
        && Number(evidence.sampleSize || 0) >= 8
        && Number(recommendation.confidence || 0) >= 0.72
      )
    )
    && !evidence.appliedAt
  );
}

function getScopeRecommendationPolicyAction(recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const scopeAction = String(evidence.scopeAction || "");
  const sampleSize = Number(evidence.sampleSize || 0);
  const confidence = Number(recommendation.confidence || 0);

  if (recommendation.status === "draft") {
    if (scopeAction === "cut" && sampleSize >= 7 && confidence >= 0.68) {
      return "auto-sandbox";
    }
    if (scopeAction === "tighten" && sampleSize >= 10 && confidence >= 0.74) {
      return "auto-sandbox";
    }
    if (scopeAction === "relax" && sampleSize >= 12 && confidence >= 0.82) {
      return "auto-sandbox";
    }
  }

  if (recommendation.status === "sandbox") {
    if (scopeAction === "cut" && sampleSize >= 8 && confidence >= 0.72) {
      return "auto-apply";
    }
    if (scopeAction === "tighten" && sampleSize >= 14 && confidence >= 0.82) {
      return "auto-apply";
    }
  }

  return "";
}

function getAdaptiveScorerRecommendationPolicyAction(recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const action = String(evidence.action || "promote");
  const candidateScorer = String(evidence.candidateScorer || "").trim().toLowerCase();
  const confidence = Number(recommendation.confidence || 0);
  const sampleReady = Number(
    evidence.sampleSizeReady
      || evidence.sampleSizeRecent
      || evidence.sampleSizeV2
      || evidence.sampleSizeCurrent
      || 0,
  );
  const alignedWindows = Number(evidence.alignedWindows || 0);
  const multiWindowGovernance = String(evidence.promotionMode || "") === "multi-window-model-governance";

  if (recommendation.status === "draft") {
    if (multiWindowGovernance && action === "promote" && alignedWindows >= 2 && sampleReady >= 8 && confidence >= 0.74) return "auto-sandbox";
    if (multiWindowGovernance && action === "rollback" && alignedWindows >= 1 && sampleReady >= 8 && confidence >= 0.72) return "auto-sandbox";
    if (action === "rollback" && sampleReady >= 6 && confidence >= 0.7) return "auto-sandbox";
    if (candidateScorer.startsWith("model-") && sampleReady >= 8 && confidence >= 0.78) return "auto-sandbox";
  }

  if (recommendation.status === "sandbox") {
    if (multiWindowGovernance && action === "promote" && alignedWindows >= 2 && sampleReady >= 10 && confidence >= 0.82) return "auto-apply";
    if (multiWindowGovernance && action === "rollback" && alignedWindows >= 2 && sampleReady >= 10 && confidence >= 0.8) return "auto-apply";
    if (action === "rollback" && sampleReady >= 8 && confidence >= 0.78) return "auto-apply";
    if (candidateScorer.startsWith("model-") && sampleReady >= 12 && confidence >= 0.86) return "auto-apply";
  }

  return "";
}

async function moveScopeRecommendationToSandbox(recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const rows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "sandbox",
        evidence: {
          ...evidence,
          sandboxAt: evidence.sandboxAt || new Date().toISOString(),
          policyAutomation: {
            type: "auto-sandbox",
            action: evidence.scopeAction || "",
            appliedAt: new Date().toISOString(),
          },
        },
      },
    },
  );
  return rows?.[0] || recommendation;
}

async function moveAdaptiveScorerRecommendationToSandbox(recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const rows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "sandbox",
        evidence: {
          ...evidence,
          sandboxAt: evidence.sandboxAt || new Date().toISOString(),
          policyAutomation: {
            type: "auto-sandbox",
            action: evidence.action || "",
            appliedAt: new Date().toISOString(),
          },
        },
      },
    },
  );
  return rows?.[0] || recommendation;
}

function buildRecommendationRows(signals, versions, executionProfile) {
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  if (!closedSignals.length) return [];

  const trendV2Signals = closedSignals.filter((item) => item.strategy_name === "trend-alignment" && item.strategy_version === "v2");
  const breakoutSignals = closedSignals.filter((item) => item.strategy_name === "breakout" && item.strategy_version === "v1");

  const mixedTrendSignals = trendV2Signals.filter((item) => {
    const context = item.signal_payload?.context || {};
    return context.marketRegime === "mixto" || context.timeframeBias === "Mixto";
  });
  const alignedTrendSignals = trendV2Signals.filter((item) => {
    const context = item.signal_payload?.context || {};
    const alignment = Number(context.alignmentScore || 0);
    return alignment >= 70 && String(context.volumeCondition || "").toLowerCase().includes("fuerte");
  });
  const weakBreakoutSignals = breakoutSignals.filter((item) => {
    const context = item.signal_payload?.context || {};
    const volumeCondition = String(context.volumeCondition || "").toLowerCase();
    return volumeCondition.includes("débil") || volumeCondition.includes("debil");
  });

  const trendV2Params = getVersionParameters(versions, "trend-alignment", "v2");
  const breakoutV1Params = getVersionParameters(versions, "breakout", "v1");
  const recommendations = [];

  const mixedStats = summarizeSignals(mixedTrendSignals);
  if (mixedStats.total >= 4 && (mixedStats.pnl < 0 || mixedStats.winRate < 45)) {
    const currentValue = Number(trendV2Params.mixedFramePenalty || 8);
    pushRecommendation(recommendations, {
      recommendation_key: "trend-alignment:v2:mixed-frame-penalty",
      strategy_id: "trend-alignment",
      strategy_version: "v2",
      parameter_key: "mixedFramePenalty",
      title: "Ser más estricto cuando el mercado está mezclado",
      summary: "La versión v2 está fallando más en contextos donde los marcos se contradicen. Conviene subir el castigo a ese escenario antes de dejar pasar una señal fuerte.",
      current_value: currentValue,
      suggested_value: currentValue + 2,
      confidence: Math.min(0.92, 0.55 + mixedStats.total * 0.03 + Math.abs(mixedStats.pnl) / 100),
      status: "draft",
      evidence: {
        sampleSize: mixedStats.total,
        winRate: mixedStats.winRate,
        pnl: mixedStats.pnl,
        marketRegime: "mixto",
      },
    });
  }

  const alignedStats = summarizeSignals(alignedTrendSignals);
  if (alignedStats.total >= 4 && alignedStats.pnl > 0 && alignedStats.winRate >= 50) {
    const currentValue = Number(trendV2Params.higherFrameBonus || 12);
    pushRecommendation(recommendations, {
      recommendation_key: "trend-alignment:v2:higher-frame-bonus",
      strategy_id: "trend-alignment",
      strategy_version: "v2",
      parameter_key: "higherFrameBonus",
      title: "Dar más peso a marcos altos bien alineados",
      summary: "Cuando la alineación alta viene con volumen fuerte, la estrategia responde bien. Vale la pena premiar un poco más ese contexto para reforzar señales limpias.",
      current_value: currentValue,
      suggested_value: currentValue + 2,
      confidence: Math.min(0.94, 0.58 + alignedStats.total * 0.03 + alignedStats.winRate / 200),
      status: "draft",
      evidence: {
        sampleSize: alignedStats.total,
        winRate: alignedStats.winRate,
        pnl: alignedStats.pnl,
        alignmentBand: "alta",
      },
    });
  }

  const breakoutStats = summarizeSignals(weakBreakoutSignals);
  if (breakoutStats.total >= 4 && (breakoutStats.pnl < 0 || breakoutStats.winRate < 45)) {
    const currentValue = Number(breakoutV1Params.volumeThreshold || 1.15);
    pushRecommendation(recommendations, {
      recommendation_key: "breakout:v1:volume-threshold",
      strategy_id: "breakout",
      strategy_version: "v1",
      parameter_key: "volumeThreshold",
      title: "Exigir más volumen en las rupturas",
      summary: "Las rupturas con volumen débil están dejando demasiadas señales flojas. Conviene subir el filtro antes de tratarlas como oportunidad válida.",
      current_value: currentValue,
      suggested_value: Number((currentValue + 0.1).toFixed(2)),
      confidence: Math.min(0.9, 0.56 + breakoutStats.total * 0.03 + Math.abs(breakoutStats.pnl) / 100),
      status: "draft",
      evidence: {
        sampleSize: breakoutStats.total,
        winRate: breakoutStats.winRate,
        pnl: breakoutStats.pnl,
        volumeCondition: "débil",
      },
    });
  }

  pushRecommendation(
    recommendations,
    buildDirectionalThresholdRecommendation({
      strategyId: "trend-alignment",
      version: "v1",
      params: getVersionParameters(versions, "trend-alignment", "v1"),
      signals: closedSignals.filter((item) => item.strategy_name === "trend-alignment" && item.strategy_version === "v1"),
    }),
  );

  pushRecommendation(
    recommendations,
    buildDirectionalThresholdRecommendation({
      strategyId: "trend-alignment",
      version: "v2",
      params: trendV2Params,
      signals: trendV2Signals,
    }),
  );

  pushRecommendation(
    recommendations,
    buildDirectionalThresholdRecommendation({
      strategyId: "breakout",
      version: "v1",
      params: breakoutV1Params,
      signals: breakoutSignals,
    }),
  );

  pushRecommendation(recommendations, buildBreakoutBufferRecommendation(breakoutV1Params, breakoutSignals));
  for (const row of buildExecutionScopeOverrideRecommendations(closedSignals, executionProfile)) {
    pushRecommendation(recommendations, row);
  }
  for (const row of buildAdaptivePrimaryPromotionRecommendations(closedSignals, versions)) {
    pushRecommendation(recommendations, row);
  }
  for (const row of buildAdaptiveScorerPromotionRecommendations(closedSignals, executionProfile)) {
    pushRecommendation(recommendations, row);
  }

  for (const row of buildModelV1PromotionRecommendations(closedSignals, executionProfile)) {
    pushRecommendation(recommendations, row);
  }

  return recommendations;
}

function getPreferredTimeframeScope(versions, strategyId, version) {
  const profile = getVersionProfile(versions, strategyId, version);
  return profile.preferredTimeframes.length ? profile.preferredTimeframes.join(",") : "all";
}

export async function generateAdaptiveRecommendations(req) {
  const session = requireSession(req);
  return generateAdaptiveRecommendationsForUser(session.username);
}

function buildValidationInvariants({
  executionProfile,
  decisionState,
  signals,
  featureSnapshots,
}) {
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const signalsWithScorer = closedSignals.filter((item) => item.signal_payload?.decision?.scorer?.label);
  const signalsWithExecutionLearning = closedSignals.filter((item) => item.signal_payload?.executionLearning);
  const modelConfigRegistry = Array.isArray(decisionState?.modelConfigRegistry) ? decisionState.modelConfigRegistry : [];
  const activeConfigs = modelConfigRegistry.filter((item) => item.active);
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "");
  const matchingActiveConfig = activeConfigs.find((item) => String(item.label || "").toLowerCase() === activeScorer.toLowerCase());
  const featureCoverage = closedSignals.length ? (featureSnapshots.length / closedSignals.length) * 100 : 0;
  return [
    {
      key: "scorer-coverage",
      label: "Cobertura de scorer en señales cerradas",
      status: signalsWithScorer.length >= Math.max(8, Math.floor(closedSignals.length * 0.6)) ? "pass" : "warn",
      detail: `${signalsWithScorer.length}/${closedSignals.length || 0} señales cerradas guardan scorer explicable.`,
      severity: signalsWithScorer.length >= Math.max(8, Math.floor(closedSignals.length * 0.6)) ? "low" : "medium",
    },
    {
      key: "execution-learning-coverage",
      label: "Cobertura de aprendizaje de ejecución",
      status: signalsWithExecutionLearning.length >= Math.max(6, Math.floor(closedSignals.length * 0.45)) ? "pass" : "warn",
      detail: `${signalsWithExecutionLearning.length}/${closedSignals.length || 0} señales cerradas ya traen executionLearning persistido.`,
      severity: signalsWithExecutionLearning.length >= Math.max(6, Math.floor(closedSignals.length * 0.45)) ? "low" : "medium",
    },
    {
      key: "single-active-model-config",
      label: "Un solo modelo activo en configs",
      status: activeConfigs.length === 1 ? "pass" : activeConfigs.length === 0 ? "warn" : "fail",
      detail: activeConfigs.length === 1
        ? `La configuración persistida apunta a ${activeConfigs[0].label}.`
        : activeConfigs.length === 0
          ? "No hay un modelo activo persistido en ai_model_configs."
          : `Se detectaron ${activeConfigs.length} modelos activos a la vez.`,
      severity: activeConfigs.length === 1 ? "low" : activeConfigs.length === 0 ? "medium" : "high",
    },
    {
      key: "scorer-policy-aligned",
      label: "Alineación entre scorerPolicy y model config",
      status: !activeScorer || matchingActiveConfig ? "pass" : "warn",
      detail: !activeScorer
        ? "Todavía no hay scorerPolicy activo formal."
        : matchingActiveConfig
          ? `El scorerPolicy activo (${activeScorer}) coincide con ai_model_configs.`
          : `El scorerPolicy activo (${activeScorer}) todavía no coincide con un config activo persistido.`,
      severity: !activeScorer || matchingActiveConfig ? "low" : "medium",
    },
    {
      key: "feature-coverage",
      label: "Cobertura de feature snapshots",
      status: featureCoverage >= 70 ? "pass" : featureCoverage >= 40 ? "warn" : "fail",
      detail: `${featureSnapshots.length} filas estructuradas para ${closedSignals.length || 0} señales cerradas (${featureCoverage.toFixed(0)}%).`,
      severity: featureCoverage >= 70 ? "low" : featureCoverage >= 40 ? "medium" : "high",
    },
  ];
}

function buildValidationScorerTable(signals, executionProfile) {
  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const scorerGroups = new Map();
  for (const item of closedSignals) {
    const label = String(item.signal_payload?.decision?.scorer?.label || "unscored").toLowerCase();
    const current = scorerGroups.get(label) || [];
    current.push(item);
    scorerGroups.set(label, current);
  }
  const rows = Array.from(scorerGroups.entries()).map(([label, items]) => {
    const stats = summarizeSignals(items);
    return {
      label,
      total: stats.total,
      avgPnl: Number(stats.avgPnl.toFixed(2)),
      pnl: Number(stats.pnl.toFixed(2)),
      winRate: Number(stats.winRate.toFixed(2)),
      active: String(executionProfile?.scorerPolicy?.activeScorer || "").toLowerCase() === label,
    };
  }).sort((left, right) => Number(right.avgPnl || 0) - Number(left.avgPnl || 0));
  return rows;
}

function buildReplayWindows(signals, executionProfile, decisionState) {
  const closedSignals = (signals || [])
    .filter((item) => item.outcome_status && item.outcome_status !== "pending")
    .slice()
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime());
  const windows = [
    { label: "short", size: 20 },
    { label: "recent", size: 50 },
    { label: "global", size: 120 },
  ];
  const activeScorer = String(executionProfile?.scorerPolicy?.activeScorer || "adaptive-v1").toLowerCase();
  const bestCandidate = String(
    decisionState?.modelWindowGovernance?.candidateScorer
    || decisionState?.shadowModelEvaluation?.candidateScorer
    || "",
  ).toLowerCase();

  return windows.map((window) => {
    const rows = closedSignals.slice(0, window.size);
    const activeRows = rows.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === activeScorer);
    const challengerRows = bestCandidate
      ? rows.filter((item) => String(item.signal_payload?.decision?.scorer?.label || "").toLowerCase() === bestCandidate)
      : [];
    const activeStats = summarizeSignals(activeRows);
    const challengerStats = summarizeSignals(challengerRows);
    const activeAvg = Number(activeStats.avgPnl.toFixed(2));
    const challengerAvg = Number(challengerStats.avgPnl.toFixed(2));
    const verdict = !bestCandidate
      ? "Sin challenger claro todavía"
      : challengerStats.total < 5 || activeStats.total < 5
        ? "Muestra corta"
        : challengerAvg > activeAvg && challengerStats.winRate >= activeStats.winRate
          ? `${bestCandidate} habría defendido mejor esta ventana`
          : `${activeScorer} sigue defendiendo mejor esta ventana`;
    return {
      label: window.label.charAt(0).toUpperCase() + window.label.slice(1),
      key: window.label,
      total: rows.length,
      sampleSize: rows.length,
      activeScorer,
      challengerScorer: bestCandidate || "--",
      activeAvgPnl: activeAvg,
      challengerAvgPnl: challengerAvg,
      activeWinRate: Number(activeStats.winRate.toFixed(2)),
      challengerWinRate: Number(challengerStats.winRate.toFixed(2)),
      verdict,
    };
  });
}

function buildValidationScenarios(decisionState, replayWindows) {
  const scenarios = [];
  const modelWindowGovernance = decisionState?.modelWindowGovernance || null;
  if (modelWindowGovernance) {
    scenarios.push({
      title: "Gobernanza multi-ventana",
      status: modelWindowGovernance.action === "promote" ? "good" : modelWindowGovernance.action === "rollback" ? "warning" : "neutral",
      summary: modelWindowGovernance.summary,
    });
  }
  const latestGovernance = Array.isArray(decisionState?.modelWindowGovernanceHistory)
    ? decisionState.modelWindowGovernanceHistory[0]
    : null;
  if (latestGovernance) {
    scenarios.push({
      title: "Última decisión formal",
      status: latestGovernance.action === "promote" ? "good" : latestGovernance.action === "rollback" ? "warning" : "neutral",
      summary: latestGovernance.summary || `${latestGovernance.activeScorer} -> ${latestGovernance.candidateScorer}`,
    });
  }
  replayWindows.forEach((item) => {
    scenarios.push({
      title: `Replay ${item.label}`,
      status: item.verdict.includes("habría defendido mejor") ? "warning" : item.verdict.includes("sigue defendiendo mejor") ? "good" : "neutral",
      summary: `${item.activeScorer} ${item.activeAvgPnl >= 0 ? "+" : ""}${item.activeAvgPnl} vs ${item.challengerScorer} ${item.challengerAvgPnl >= 0 ? "+" : ""}${item.challengerAvgPnl}. ${item.verdict}`,
    });
  });
  return scenarios.slice(0, 6);
}

export async function getStrategyValidationReportForUser(username) {
  const normalizedUsername = String(username || "").trim();
  const [signals, featureSnapshots, executionProfile, scorerEvaluationHistory, modelTrainingRunHistory, modelConfigHistory, modelWindowGovernanceHistory, modelConfigRegistry] = await Promise.all([
    supabaseRequest(`${SIGNALS_TABLE}?select=id,outcome_status,outcome_pnl,signal_score,rr_ratio,updated_at,created_at,signal_payload,execution_order_id,strategy_name,strategy_version,timeframe,signal_label&username=eq.${normalizedUsername}&order=created_at.desc&limit=220`).catch(() => []),
    supabaseRequest(`${SIGNAL_FEATURE_SNAPSHOTS_TABLE}?select=*&username=eq.${normalizedUsername}&order=created_at.desc&limit=320`).catch(() => []),
    getExecutionProfileForUser(normalizedUsername).catch(() => null),
    fetchRecentAdaptiveActions(normalizedUsername, "scorer-model-evaluation", 8).catch(() => []),
    fetchRecentAdaptiveActions(normalizedUsername, "model-training-run", 10).catch(() => []),
    fetchRecentAdaptiveActions(normalizedUsername, "model-config", 6).catch(() => []),
    fetchRecentAdaptiveActions(normalizedUsername, "model-window-governance", 6).catch(() => []),
    fetchModelConfigsForUser(normalizedUsername).catch(() => []),
  ]);

  const normalizedModelConfigRegistry = normalizeModelConfigRegistry(modelConfigRegistry || []);
  const normalizedTrainingRunHistory = normalizeModelTrainingRunHistory(modelTrainingRunHistory || []);
  const latestTrainingRuns = [];
  const seenTrainingKeys = new Set();
  for (const row of normalizedTrainingRunHistory) {
    const key = `${row.label}:${row.windowType}`;
    if (seenTrainingKeys.has(key)) continue;
    seenTrainingKeys.add(key);
    latestTrainingRuns.push(row);
  }
  const modelRegistry = buildModelRegistry(featureSnapshots || [], executionProfile, latestTrainingRuns, normalizedModelConfigRegistry);
  const modelWindowGovernance = buildModelWindowGovernance(latestTrainingRuns, modelRegistry, executionProfile);
  const decisionState = {
    scorerPolicy: executionProfile?.scorerPolicy || null,
    modelConfigRegistry: normalizedModelConfigRegistry,
    modelWindowGovernance,
    modelWindowGovernanceHistory: normalizeModelWindowGovernanceHistory(modelWindowGovernanceHistory || []),
  };

  const closedSignals = (signals || []).filter((item) => item.outcome_status && item.outcome_status !== "pending");
  const invariants = buildValidationInvariants({
    executionProfile: executionProfile || { scorerPolicy: decisionState?.scorerPolicy || null },
    decisionState,
    signals,
    featureSnapshots,
  });
  const scorerTable = buildValidationScorerTable(signals || [], executionProfile || { scorerPolicy: decisionState?.scorerPolicy || null });
  const replayWindows = buildReplayWindows(signals || [], { scorerPolicy: decisionState?.scorerPolicy || null }, decisionState);
  const scenarios = buildValidationScenarios(decisionState, replayWindows);
  const passed = invariants.filter((item) => item.status === "pass").length;
  const failed = invariants.filter((item) => item.status === "fail").length;
  const warned = invariants.filter((item) => item.status === "warn").length;
  const maturityScore = Math.max(
    0,
    Math.min(
      100,
      42
        + passed * 9
        - failed * 8
        + (decisionState?.modelWindowGovernance?.action === "promote" ? 10 : decisionState?.modelWindowGovernance?.action === "sandbox" ? 6 : 0)
        + (decisionState?.scorerPolicy?.activeScorer?.startsWith("model-") ? 10 : 0)
        + (closedSignals.length >= 40 ? 8 : closedSignals.length >= 20 ? 4 : 0),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      maturityScore: Number(maturityScore.toFixed(0)),
      closedSignals: closedSignals.length,
      featureSnapshots: featureSnapshots.length,
      passedInvariants: passed,
      warnedInvariants: warned,
      failedInvariants: failed,
      activeScorer: decisionState?.scorerPolicy?.activeScorer || "adaptive-v1",
    },
    invariants,
    scorerTable,
    replayWindows,
    scenarios,
    modelWindowGovernance: decisionState?.modelWindowGovernance || null,
    modelWindowGovernanceHistory: decisionState?.modelWindowGovernanceHistory || [],
  };
}

export async function getStrategyValidationLabForUser(username) {
  const runs = await fetchBacktestRunsForUser(username, 12).catch(() => []);
  const latestRun = Array.isArray(runs) && runs.find((item) => item.status !== "queued" && item.status !== "running") ? runs.find((item) => item.status !== "queued" && item.status !== "running") : (Array.isArray(runs) && runs.length ? runs[0] : null);
  const report = buildValidationReportFromRunSummary(latestRun) || await getStrategyValidationReportForUser(username);
  return {
    report,
    runs,
    queue: {
      pending: (runs || []).filter((item) => item.status === "queued").length,
      running: (runs || []).filter((item) => item.status === "running").length,
    },
  };
}

export async function getStrategyValidationReport(req) {
  const session = requireSession(req);
  return getStrategyValidationReportForUser(session.username);
}

export async function getStrategyValidationLab(req) {
  const session = requireSession(req);
  return getStrategyValidationLabForUser(session.username);
}

export async function runStrategyBacktestForUser(username, options = {}) {
  const run = await createPendingBacktestRunForUser(username, options);
  const runs = await fetchBacktestRunsForUser(username, 12).catch(() => []);
  const latestRun = Array.isArray(runs) && runs.find((item) => item.status !== "queued" && item.status !== "running") ? runs.find((item) => item.status !== "queued" && item.status !== "running") : null;
  const report = buildValidationReportFromRunSummary(latestRun);
  return {
    report: report || {
      generatedAt: new Date().toISOString(),
      summary: {
        maturityScore: 0,
        closedSignals: 0,
        featureSnapshots: 0,
        passedInvariants: 0,
        warnedInvariants: 0,
        failedInvariants: 0,
        activeScorer: run?.activeScorer || "adaptive-v1",
      },
      invariants: [],
      scorerTable: [],
      replayWindows: [],
      scenarios: [],
      modelWindowGovernance: null,
      modelWindowGovernanceHistory: [],
    },
    run,
    runs,
    queue: {
      pending: (runs || []).filter((item) => item.status === "queued").length,
      running: (runs || []).filter((item) => item.status === "running").length,
    },
  };
}

export async function runStrategyBacktest(req) {
  const session = requireSession(req);
  const body = await parseRequestBody(req);
  return runStrategyBacktestForUser(session.username, {
    label: body?.label,
    triggerSource: body?.triggerSource || "manual",
  });
}

export async function processQueuedStrategyBacktestsForUser(username, options = {}) {
  const queuedRuns = await fetchQueuedBacktestRunsForUser(username, Number(options.limit || 1));
  const processed = [];

  for (const queuedRun of queuedRuns) {
    const report = await getStrategyValidationReportForUser(username);
    const completedRun = await updateBacktestRunForUser(username, queuedRun.id, report, {
      label: queuedRun.label,
      triggerSource: queuedRun.triggerSource || options.triggerSource || "queue-processor",
      runStatus: "completed",
    });
    processed.push(completedRun || queuedRun);
  }

  const runs = await fetchBacktestRunsForUser(username, 12).catch(() => []);
  const latestRun = Array.isArray(runs) && runs.find((item) => item.status !== "queued" && item.status !== "running") ? runs.find((item) => item.status !== "queued" && item.status !== "running") : null;
  const report = buildValidationReportFromRunSummary(latestRun) || {
    generatedAt: new Date().toISOString(),
    summary: {
      maturityScore: 0,
      closedSignals: 0,
      featureSnapshots: 0,
      passedInvariants: 0,
      warnedInvariants: 0,
      failedInvariants: 0,
      activeScorer: processed[0]?.activeScorer || "adaptive-v1",
    },
    invariants: [],
    scorerTable: [],
    replayWindows: [],
    scenarios: [],
    modelWindowGovernance: null,
    modelWindowGovernanceHistory: [],
  };
  return {
    processed,
    runs,
    report,
    queue: {
      pending: (runs || []).filter((item) => item.status === "queued").length,
      running: (runs || []).filter((item) => item.status === "running").length,
    },
  };
}

export async function processQueuedStrategyBacktests(req) {
  const session = requireSession(req);
  const body = await parseRequestBody(req);
  return processQueuedStrategyBacktestsForUser(session.username, {
    limit: body?.limit,
    triggerSource: body?.triggerSource || "admin-queue-processor",
  });
}

export async function backfillStrategyLearningDatasetForUser(username, options = {}) {
  const backfill = await backfillSignalLearningDatasetForUser(username, options);
  const report = await getStrategyValidationReportForUser(username);
  const run = await persistBacktestRunForUser(username, report, {
    label: options.label || "Post-backfill validation",
    triggerSource: options.triggerSource || "dataset-backfill",
  });
  const runs = await fetchBacktestRunsForUser(username, 12).catch(() => []);
  return { backfill, report, run, runs };
}

export async function backfillStrategyLearningDataset(req) {
  const session = requireSession(req);
  const body = await parseRequestBody(req);
  return backfillStrategyLearningDatasetForUser(session.username, {
    label: body?.label,
    triggerSource: body?.triggerSource || "admin-backfill",
    limit: body?.limit,
  });
}

export async function generateAdaptiveRecommendationsForUser(username) {
  const normalizedUsername = String(username || "").trim();

  const versionParams = new URLSearchParams({
    select: "*",
    order: "strategy_id.asc,version.asc",
  });
  const signalsParams = new URLSearchParams({
    select: "strategy_name,strategy_version,signal_label,timeframe,signal_score,rr_ratio,outcome_status,outcome_pnl,signal_payload",
    username: `eq.${normalizedUsername}`,
    order: "created_at.desc",
    limit: "300",
  });

  const [versions, signals, executionProfile, existingRecommendations, featureSnapshots, modelConfigRegistry] = await Promise.all([
    supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionParams.toString()}`),
    supabaseRequest(`${SIGNALS_TABLE}?${signalsParams.toString()}`),
    getExecutionProfileForUser(normalizedUsername),
    supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?select=*`).catch(() => []),
    supabaseRequest(`${SIGNAL_FEATURE_SNAPSHOTS_TABLE}?select=*&username=eq.${normalizedUsername}&order=created_at.desc&limit=500`).catch(() => []),
    fetchModelConfigsForUser(normalizedUsername).catch(() => []),
  ]);

  const scorerEvaluations = buildScorerEvaluations(signals || [], executionProfile);
  await recordScorerEvaluationHistory(normalizedUsername, scorerEvaluations).catch(() => null);
  const modelTrainingRuns = buildModelTrainingRuns(featureSnapshots || [], executionProfile);
  await recordModelTrainingRunHistory(normalizedUsername, modelTrainingRuns).catch(() => null);
  await persistModelConfigRegistry(normalizedUsername, modelTrainingRuns, executionProfile?.scorerPolicy || null).catch(() => null);
  const normalizedModelConfigRegistry = normalizeModelConfigRegistry(modelConfigRegistry || []);
  const modelRegistry = buildModelRegistry(featureSnapshots || [], executionProfile, modelTrainingRuns, normalizedModelConfigRegistry);
  const modelWindowGovernance = buildModelWindowGovernance(modelTrainingRuns, modelRegistry, executionProfile);
  await recordModelWindowGovernanceHistory(normalizedUsername, modelWindowGovernance).catch(() => null);

  const existingByKey = new Map((existingRecommendations || []).map((item) => [item.recommendation_key, item]));
  const rowsToUpsert = [
    ...buildRecommendationRows(signals || [], versions || [], executionProfile),
    ...buildModelWindowGovernanceRecommendations(modelWindowGovernance),
  ]
    .map((item) => mergeRecommendationRow(existingByKey.get(item.recommendation_key), item));
  if (!rowsToUpsert.length) return [];

  const rows = await supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?on_conflict=recommendation_key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: rowsToUpsert,
  });

  const finalRows = [];
  for (const row of rows || []) {
    let nextRow = row;
    const evidence = nextRow.evidence && typeof nextRow.evidence === "object" ? nextRow.evidence : {};
    if (evidence.recommendationType === "execution-scope-override") {
      const policyAction = getScopeRecommendationPolicyAction(nextRow);
      if (policyAction === "auto-sandbox") {
        nextRow = await moveScopeRecommendationToSandbox(nextRow);
      }
      if (shouldAutoApplyScopeRecommendation(nextRow) || getScopeRecommendationPolicyAction(nextRow) === "auto-apply") {
        finalRows.push((await applyExecutionScopeRecommendation(normalizedUsername, nextRow)).recommendation);
        continue;
      }
    } else if (evidence.recommendationType === "adaptive-scorer-promotion") {
      const scorerPolicyAction = getAdaptiveScorerRecommendationPolicyAction(nextRow);
      if (scorerPolicyAction === "auto-sandbox") {
        nextRow = await moveAdaptiveScorerRecommendationToSandbox(nextRow);
      }
      if (getAdaptiveScorerRecommendationPolicyAction(nextRow) === "auto-apply") {
        finalRows.push((await applyAdaptiveScorerPromotionRecommendation(normalizedUsername, nextRow)).recommendation);
        continue;
      }
    }
    finalRows.push(nextRow);
  }

  return finalRows;
}

function getRecommendationVariantVersion(baseVersion, versions, recommendationId) {
  const prefix = `${baseVersion}-rec`;
  const taken = new Set(
    (versions || [])
      .map((item) => item.version)
      .filter((version) => typeof version === "string" && version.startsWith(prefix)),
  );

  let index = 1;
  let candidate = `${prefix}${index}`;
  while (taken.has(candidate) || taken.has(`${candidate}-r${recommendationId}`)) {
    index += 1;
    candidate = `${prefix}${index}`;
  }

  return `${candidate}-r${recommendationId}`;
}

async function applyExecutionScopeRecommendation(username, recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const timeframe = String(evidence.timeframe || "");
  const minSignalScore = Number(evidence.suggestedMinSignalScore ?? recommendation.suggested_value);
  const minRrRatio = Number(evidence.suggestedMinRrRatio ?? evidence.currentMinRrRatio ?? 0);
  const scopeAction = String(evidence.scopeAction || "tighten");
  const automatedPolicy =
    evidence.policyAutomation && typeof evidence.policyAutomation === "object"
      ? evidence.policyAutomation
      : null;
  if (!timeframe || !Number.isFinite(minSignalScore) || !Number.isFinite(minRrRatio)) {
    throw new Error("La recomendación no trae un scope demo válido para aplicar");
  }

  const currentProfile = await getExecutionProfileForUser(username);
  const nextOverride = {
    id: `${recommendation.strategy_id}-${timeframe}`,
    strategyId: recommendation.strategy_id,
    timeframe,
    enabled: true,
    action: scopeAction,
    minSignalScore,
    minRrRatio,
    note: `${scopeAction === "cut" ? "Corte" : scopeAction === "relax" ? "Apertura" : "Ajuste"} aplicado desde ${recommendation.recommendation_key}`,
  };
  const scopeOverrides = (currentProfile.scopeOverrides || []).filter(
    (item) => !(item.strategyId === nextOverride.strategyId && item.timeframe === nextOverride.timeframe),
  );
  scopeOverrides.push(nextOverride);

  const rows = await supabaseRequest(EXECUTION_PROFILES_TABLE, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: [{
      username,
      enabled: currentProfile.enabled,
      auto_execute_enabled: currentProfile.autoExecuteEnabled,
      risk_per_trade_pct: currentProfile.riskPerTradePct,
      max_open_positions: currentProfile.maxOpenPositions,
      max_position_usd: currentProfile.maxPositionUsd,
      max_daily_loss_pct: currentProfile.maxDailyLossPct,
      min_signal_score: currentProfile.minSignalScore,
      min_rr_ratio: currentProfile.minRrRatio,
      max_daily_auto_executions: currentProfile.maxDailyAutoExecutions,
      cooldown_after_losses: currentProfile.cooldownAfterLosses,
      allowed_strategies: currentProfile.allowedStrategies,
      allowed_timeframes: currentProfile.allowedTimeframes,
      note: buildProfileNoteEnvelope({
        note: currentProfile.note,
        scopeOverrides,
      }),
    }],
  });

  const updatedProfile = normalizeExecutionProfile(rows?.[0] || null, username);
  await upsertExecutionScopeOverrideForUser(username, nextOverride, {
    source: automatedPolicy ? "policy-automation" : "adaptive-recommendation",
    recommendationId: recommendation.id,
    experimentId: evidence.experimentId,
  }).catch(() => null);
  const recommendationRows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "active",
        evidence: {
          ...evidence,
          appliedAt: new Date().toISOString(),
          appliedOverride: nextOverride,
          policyAutomation: automatedPolicy ? {
            ...automatedPolicy,
            finalState: "active",
            finalAppliedAt: new Date().toISOString(),
          } : evidence.policyAutomation,
        },
      },
    },
  );

  await insertAdaptiveActionLogForUser(username, {
    actionType: scopeAction === "cut" ? "scope-cut" : scopeAction === "relax" ? "scope-relax" : "scope-tighten",
    targetType: "execution-scope-override",
    targetKey: `${recommendation.strategy_id}:${timeframe}`,
    strategyId: recommendation.strategy_id,
    strategyVersion: recommendation.strategy_version,
    timeframe,
    recommendationId: recommendation.id,
    experimentId: evidence.experimentId,
    source: automatedPolicy ? "policy-automation" : "adaptive-recommendation",
    status: "applied",
    summary: `${scopeAction === "cut" ? "Corte" : scopeAction === "relax" ? "Apertura" : "Ajuste"} aplicado para ${recommendation.strategy_id} · ${timeframe}`,
    details: {
      recommendationKey: recommendation.recommendation_key,
      suggestedMinSignalScore: minSignalScore,
      suggestedMinRrRatio: minRrRatio,
      override: nextOverride,
      automatedPolicy,
    },
  }).catch(() => null);

  return {
    recommendation: recommendationRows?.[0] || recommendation,
    profile: updatedProfile,
    activationMode: "execution-scope-override",
  };
}

async function applyAdaptiveScorerPromotionRecommendation(username, recommendation) {
  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  const candidateScorer = String(evidence.candidateScorer || "adaptive-v2").trim() || "adaptive-v2";
  const scorerAction = String(evidence.action || "promote");
  const currentProfile = await getExecutionProfileForUser(username);
  const scorerPolicy = {
    activeScorer: candidateScorer,
    promotedAt: new Date().toISOString(),
    source: String(recommendation.recommendation_key || "adaptive-scorer-promotion"),
    confidence: Number(recommendation.confidence || 0),
  };

  const rows = await supabaseRequest(
    `${EXECUTION_PROFILES_TABLE}?username=eq.${encodeURIComponent(username)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        note: buildProfileNoteEnvelope({
          ...currentProfile,
          note: currentProfile.note,
          scopeOverrides: currentProfile.scopeOverrides || [],
          scorerPolicy,
        }),
      },
    },
  );

  const updatedProfile = normalizeExecutionProfile(rows?.[0] || null, username);
  const updatedEvidence = {
    ...evidence,
    appliedScorerPolicy: scorerPolicy,
    activatedAt: scorerPolicy.promotedAt,
  };
  const recommendationRows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "active",
        evidence: updatedEvidence,
      },
    },
  );

  await insertAdaptiveActionLogForUser(username, {
    username,
    actionType: scorerAction === "rollback" ? "rollback" : "promote",
    targetType: "scorer-policy",
    targetKey: candidateScorer,
    recommendationId: recommendation.id,
    source: "adaptive-recommendation",
    status: "applied",
    summary: scorerAction === "rollback"
      ? `Scorer ${candidateScorer} retomó el control del motor tras rollback`
      : `Scorer ${candidateScorer} promovido como capa principal del motor adaptativo`,
    details: {
      recommendationKey: recommendation.recommendation_key,
      scorerPolicy,
      evidence: updatedEvidence,
    },
  }).catch(() => null);

  await insertAdaptiveActionLogForUser(username, {
    username,
    actionType: "activate-model-config",
    targetType: "model-config",
    targetKey: candidateScorer,
    recommendationId: recommendation.id,
    source: "adaptive-recommendation",
    status: "active",
    summary: `Configuración activa del modelo ahora apunta a ${candidateScorer}`,
    details: {
      scorerPolicy,
      recommendationKey: recommendation.recommendation_key,
      evidence: updatedEvidence,
    },
  }).catch(() => null);

  await setActiveModelConfigForUser(username, candidateScorer, scorerPolicy).catch(() => null);

  return {
    recommendation: recommendationRows?.[0] || recommendation,
    profile: updatedProfile,
    activationMode: "scorer-promotion",
  };
}

export async function activateAdaptiveRecommendation(req) {
  const session = requireSession(req);
  const body = parseJsonBody(req);
  const recommendationId = Number(body.recommendationId || 0);
  if (!recommendationId) {
    throw new Error("Falta la recomendación a convertir");
  }

  const recommendationRows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?select=*&id=eq.${recommendationId}&limit=1`,
  );
  const versions = await supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?select=*`);

  const recommendation = recommendationRows?.[0];
  if (!recommendation) {
    throw new Error("No se encontró la recomendación solicitada");
  }

  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
  if (evidence.recommendationType === "execution-scope-override") {
    if (recommendation.status === "draft") {
      const sandboxRows = await supabaseRequest(
        `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: {
            status: "sandbox",
            evidence: {
              ...evidence,
              sandboxAt: new Date().toISOString(),
            },
          },
        },
      );
      return {
        recommendation: sandboxRows?.[0] || { ...recommendation, status: "sandbox" },
        profile: null,
        activationMode: "execution-scope-override",
      };
    }
    return applyExecutionScopeRecommendation(session.username, recommendation);
  }

  if (evidence.recommendationType === "adaptive-scorer-promotion") {
    if (recommendation.status === "draft") {
      const sandboxRows = await supabaseRequest(
        `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${Number(recommendation.id)}&select=*`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: {
            status: "sandbox",
            evidence: {
              ...evidence,
              sandboxAt: new Date().toISOString(),
            },
          },
        },
      );
      return {
        recommendation: sandboxRows?.[0] || { ...recommendation, status: "sandbox" },
        profile: null,
        activationMode: "scorer-promotion",
      };
    }
    return applyAdaptiveScorerPromotionRecommendation(session.username, recommendation);
  }

  if (evidence.recommendationType === "adaptive-primary-promotion") {
    if (evidence.experimentId) {
      const experimentRows = await supabaseRequest(
        `${STRATEGY_EXPERIMENTS_TABLE}?select=*&id=eq.${Number(evidence.experimentId)}&limit=1`,
      ).catch(() => []);

      return {
        recommendation,
        version: null,
        experiment: experimentRows?.[0] || null,
      };
    }

    const marketScope = String(evidence.marketScope || "watchlist");
    const timeframeScope = String(evidence.timeframeScope || evidence.timeframe || "all");
    const baseVersion = String(evidence.baseVersion || recommendation.strategy_version || "").trim();
    const candidateVersion = String(evidence.candidateVersion || "").trim();
    if (!baseVersion || !candidateVersion) {
      throw new Error("La recomendación no trae una comparación clara de versiones para este timeframe.");
    }

    const experimentKey = [
      recommendation.strategy_id,
      baseVersion,
      candidateVersion,
      marketScope,
      timeframeScope,
      "adaptive-primary",
      Date.now(),
    ].join(":");

    const experimentRows = await supabaseRequest(STRATEGY_EXPERIMENTS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [{
        experiment_key: experimentKey,
        base_strategy_id: recommendation.strategy_id,
        candidate_strategy_id: recommendation.strategy_id,
        candidate_version: candidateVersion,
        market_scope: marketScope,
        timeframe_scope: timeframeScope,
        status: "sandbox",
        summary: `Prueba segura para validar si ${candidateVersion} debe liderar ${timeframeScope} por encima de ${baseVersion}.`,
        metadata: {
          createdFrom: "adaptive-primary-promotion",
          baseVersion,
          candidateVersion,
          recommendationId: recommendation.id,
          recommendationKey: recommendation.recommendation_key,
          timeframe: timeframeScope,
        },
      }],
    });

    const experiment = experimentRows?.[0];
    if (!experiment) {
      throw new Error("No se pudo crear la prueba segura para la promoción por timeframe.");
    }

    const updatedEvidence = {
      ...evidence,
      experimentId: experiment.id,
      activatedAt: new Date().toISOString(),
    };

    const updatedRecommendationRows = await supabaseRequest(
      `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${recommendation.id}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: {
          status: "sandbox",
          evidence: updatedEvidence,
        },
      },
    );

    return {
      recommendation: updatedRecommendationRows?.[0] || { ...recommendation, status: "sandbox", evidence: updatedEvidence },
      version: null,
      experiment,
    };
  }

  const baseVersion = (versions || []).find(
    (item) => item.strategy_id === recommendation.strategy_id && item.version === recommendation.strategy_version,
  );
  if (!baseVersion) {
    throw new Error("No se encontró la versión base para esta recomendación");
  }

  if (evidence.candidateVersion && evidence.experimentId) {
    const experimentRows = await supabaseRequest(
      `${STRATEGY_EXPERIMENTS_TABLE}?select=*&id=eq.${Number(evidence.experimentId)}&limit=1`,
    ).catch(() => []);

    return {
      recommendation,
      version: baseVersion,
      experiment: experimentRows?.[0] || null,
    };
  }

  const nextVersion = getRecommendationVariantVersion(recommendation.strategy_version, versions || [], recommendationId);
  const baseProfile = getVersionProfile(versions || [], recommendation.strategy_id, recommendation.strategy_version);
  const nextParameters = {
    ...(baseVersion.parameters || {}),
    [recommendation.parameter_key]: recommendation.suggested_value,
  };

  const createdVersionRows = await supabaseRequest(STRATEGY_VERSIONS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{
      strategy_id: recommendation.strategy_id,
      version: nextVersion,
      label: `${baseVersion.label || recommendation.strategy_id} candidata ${nextVersion}`,
      parameters: nextParameters,
      preferred_timeframes: baseProfile.preferredTimeframes,
      trading_style: baseProfile.tradingStyle,
      holding_profile: baseProfile.holdingProfile,
      ideal_market_conditions: baseProfile.idealMarketConditions,
      notes: `Variante creada desde la recomendación ${recommendation.recommendation_key}. Ajusta ${recommendation.parameter_key} de ${recommendation.current_value} a ${recommendation.suggested_value}.`,
      status: "experimental",
    }],
  });

  const createdVersion = createdVersionRows?.[0];
  if (!createdVersion) {
    throw new Error("No se pudo crear la variante candidata");
  }

  const experimentKey = [
    recommendation.strategy_id,
    recommendation.strategy_version,
    nextVersion,
    "watchlist",
    "all",
    Date.now(),
  ].join(":");

  const experimentRows = await supabaseRequest(STRATEGY_EXPERIMENTS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{
      experiment_key: experimentKey,
      base_strategy_id: recommendation.strategy_id,
      candidate_strategy_id: recommendation.strategy_id,
      candidate_version: nextVersion,
      market_scope: "watchlist",
      timeframe_scope: getPreferredTimeframeScope(versions || [], recommendation.strategy_id, recommendation.strategy_version),
      status: "sandbox",
      summary: `Prueba segura creada desde ${recommendation.title}. Compara ${recommendation.strategy_version} contra ${nextVersion}.`,
      metadata: {
        createdFrom: "adaptive-recommendation",
        baseVersion: recommendation.strategy_version,
        recommendationId: recommendation.id,
        recommendationKey: recommendation.recommendation_key,
        parameterKey: recommendation.parameter_key,
        currentValue: recommendation.current_value,
        suggestedValue: recommendation.suggested_value,
      },
    }],
  });

  const experiment = experimentRows?.[0];
  if (!experiment) {
    throw new Error("No se pudo crear la prueba segura asociada");
  }

  const updatedEvidence = {
    ...evidence,
    candidateVersion: nextVersion,
    experimentId: experiment.id,
    activatedAt: new Date().toISOString(),
  };

  const updatedRecommendationRows = await supabaseRequest(
    `${STRATEGY_RECOMMENDATIONS_TABLE}?id=eq.${recommendation.id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "sandbox",
        evidence: updatedEvidence,
      },
    },
  );

  return {
    recommendation: updatedRecommendationRows?.[0] || { ...recommendation, status: "sandbox", evidence: updatedEvidence },
    version: createdVersion,
    experiment,
  };
}

export async function createStrategyExperiment(req) {
  requireSession(req);
  const body = parseJsonBody(req);

  const baseStrategyId = String(body.baseStrategyId || "").trim();
  const candidateStrategyId = String(body.candidateStrategyId || "").trim();
  const candidateVersion = String(body.candidateVersion || "v1").trim();
  const marketScope = String(body.marketScope || "all").trim();
  const timeframeScope = String(body.timeframeScope || "all").trim();
  const summary = String(body.summary || "").trim();
  const status = String(body.status || "draft").trim();
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const baseVersion = typeof body.baseVersion === "string" && body.baseVersion.trim()
    ? body.baseVersion.trim()
    : (baseStrategyId === candidateStrategyId && candidateVersion !== "v1" ? "v1" : "");

  if (!baseStrategyId || !candidateStrategyId || !candidateVersion) {
    throw new Error("Faltan datos para crear el experimento");
  }

  const versions = await supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?select=*`).catch(() => []);
  const resolvedTimeframeScope = timeframeScope === "all"
    ? getPreferredTimeframeScope(versions || [], candidateStrategyId, candidateVersion)
    : timeframeScope;

  const experimentKey = [
    baseStrategyId,
    candidateStrategyId,
    candidateVersion,
    marketScope || "all",
    resolvedTimeframeScope || "all",
    Date.now(),
  ].join(":");

  try {
    const rows = await supabaseRequest(STRATEGY_EXPERIMENTS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [{
        experiment_key: experimentKey,
        base_strategy_id: baseStrategyId,
        candidate_strategy_id: candidateStrategyId,
        candidate_version: candidateVersion,
        market_scope: marketScope,
        timeframe_scope: resolvedTimeframeScope,
        status,
        summary,
        metadata: {
          createdFrom: "signals-lab",
          ...(baseVersion ? { baseVersion } : {}),
          ...metadata,
        },
      }],
    });

    return rows?.[0] || null;
  } catch {
    return {
      id: Date.now(),
      experiment_key: experimentKey,
      base_strategy_id: baseStrategyId,
      candidate_strategy_id: candidateStrategyId,
      candidate_version: candidateVersion,
      market_scope: marketScope,
      timeframe_scope: timeframeScope,
      status,
      summary,
      metadata: { createdFrom: "signals-lab", fallback: true, ...(baseVersion ? { baseVersion } : {}), ...metadata },
      created_at: new Date().toISOString(),
    };
  }
}

export async function updateStrategyExperiment(req) {
  requireSession(req);
  const body = parseJsonBody(req);
  const id = Number(body.id || 0);
  if (!id) throw new Error("Falta el experimento a actualizar");

  if (body.action === "promote") {
    const experimentRows = await supabaseRequest(
      `${STRATEGY_EXPERIMENTS_TABLE}?select=*&id=eq.${id}&limit=1`,
    );
    const experiment = experimentRows?.[0];
    if (!experiment) throw new Error("No se encontró el experimento a promover");
    if (!isRunnableStrategyVersion(experiment.candidate_strategy_id, experiment.candidate_version)) {
      throw new Error("Esta candidata todavía no es una versión ejecutable por el watcher.");
    }

    const versions = await supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?select=*`).catch(() => []);
    const candidateVersionRows = (versions || []).filter((item) => item.strategy_id === experiment.candidate_strategy_id);
    const currentPromoted = candidateVersionRows.filter((item) =>
      item.version !== experiment.candidate_version
        && ACTIVE_VERSION_STATUSES.has(String(item.status || "").toLowerCase()),
    );

    await Promise.all(currentPromoted.map((item) => {
      const params = new URLSearchParams({
        strategy_id: `eq.${item.strategy_id}`,
        version: `eq.${item.version}`,
      });
      return supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${params.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: {
          status: "experimental",
        },
      }).catch(() => null);
    }));

    const candidateParams = new URLSearchParams({
      strategy_id: `eq.${experiment.candidate_strategy_id}`,
      version: `eq.${experiment.candidate_version}`,
    });
    await supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${candidateParams.toString()}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: {
        status: "promoted",
      },
    });

    const metadata = experiment.metadata && typeof experiment.metadata === "object" ? experiment.metadata : {};
    const promotedRows = await supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "active",
        metadata: {
          ...metadata,
          allowExecution: true,
          promotedAt: new Date().toISOString(),
          promotedVersion: experiment.candidate_version,
          demotedVersions: currentPromoted.map((item) => item.version),
          baseVersion: inferBaseVersion(experiment),
        },
      },
    });

    return promotedRows?.[0] || null;
  }

  const patch = {};
  if (body.status) patch.status = String(body.status);
  if (typeof body.summary === "string") patch.summary = String(body.summary);
  if (body.metadata && typeof body.metadata === "object") patch.metadata = body.metadata;
  if (!Object.keys(patch).length) {
    throw new Error("No hay cambios para actualizar");
  }

  const params = new URLSearchParams({
    id: `eq.${id}`,
  });

  const rows = await supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: patch,
  });

  return rows?.[0] || null;
}

export { sendJson };
