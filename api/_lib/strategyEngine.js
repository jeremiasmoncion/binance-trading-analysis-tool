import { getSession, parseJsonBody, sendJson } from "./auth.js";
import { isRunnableStrategyVersion } from "./marketRuntime.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STRATEGY_REGISTRY_TABLE = process.env.SUPABASE_STRATEGY_REGISTRY_TABLE || "strategy_registry";
const STRATEGY_VERSIONS_TABLE = process.env.SUPABASE_STRATEGY_VERSIONS_TABLE || "strategy_versions";
const STRATEGY_EXPERIMENTS_TABLE = process.env.SUPABASE_STRATEGY_EXPERIMENTS_TABLE || "strategy_experiments";
const STRATEGY_RECOMMENDATIONS_TABLE = process.env.SUPABASE_STRATEGY_RECOMMENDATIONS_TABLE || "strategy_recommendations";
const SIGNALS_TABLE = process.env.SUPABASE_SIGNALS_TABLE || "signal_snapshots";
const EXECUTION_PROFILES_TABLE = process.env.SUPABASE_EXECUTION_PROFILES_TABLE || "execution_profiles";
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
  return response.json();
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
    };
  } catch {
    return {
      note: noteValue,
      scopeOverrides: [],
    };
  }
}

function buildProfileNoteEnvelope(profile) {
  const note = String(profile.note || DEFAULT_EXECUTION_PROFILE.note);
  const scopeOverrides = Array.isArray(profile.scopeOverrides) ? profile.scopeOverrides : [];
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
    note: parsedNote.note || DEFAULT_EXECUTION_PROFILE.note,
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

async function getExecutionProfileForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "updated_at.desc.nullslast,created_at.desc",
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`).catch(() => []);
  return normalizeExecutionProfile(rows?.[0] || null, username);
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

export async function getSystemStrategyDecisionState(username) {
  let versions = [];
  let experiments = [];
  let executionProfile = null;
  let signals = [];

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

    [versions, experiments] = await Promise.all([
      supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionsParams.toString()}`).catch(() => []),
      supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${experimentsParams.toString()}`).catch(() => []),
    ]);
    executionProfile = await getExecutionProfileForUser(username).catch(() => null);
    signals = await supabaseRequest(`${SIGNALS_TABLE}?select=strategy_name,strategy_version,timeframe,outcome_status,outcome_pnl,signal_score,rr_ratio,updated_at,created_at&username=eq.${String(username)}&order=created_at.desc&limit=300`).catch(() => []);
  } catch {
    versions = [];
    experiments = [];
    executionProfile = null;
    signals = [];
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

export function applySystemStrategyDecision(snapshot, decisionState, context = {}) {
  const marketScope = context.marketScope || "watchlist";
  const timeframe = context.timeframe || snapshot?.timeframe || "";
  const promotedVersionByStrategy = decisionState?.promotedVersionByStrategy || {};
  const activeStrategies = Array.isArray(decisionState?.activeStrategyByScope) ? decisionState.activeStrategyByScope : [];
  const sandboxExperiments = Array.isArray(decisionState?.sandboxExperimentsByScope) ? decisionState.sandboxExperimentsByScope : [];
  const executionEligibleScopes = Array.isArray(decisionState?.executionEligibleScopes) ? decisionState.executionEligibleScopes : [];
  const adaptivePrimaryByScope = Array.isArray(decisionState?.adaptivePrimaryByScope) ? decisionState.adaptivePrimaryByScope : [];
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
    const scopeAction = String(scopeTuning?.action || "");
    const candidateBaseRank = Number(candidate.rankScore || candidate.signal?.score || candidate.signal?.signalScore || 0);
    const adaptiveBias = adaptivePrimary ? Math.min(28, 10 + Number(adaptivePrimary.confidence || 0) * 15) : 0;
    const scopeBias = scopeAction === "cut"
      ? -1000
      : scopeAction === "tighten"
        ? -18
        : scopeAction === "relax"
          ? 8
          : 0;

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
      scopeBias,
      adaptivePrimary,
      adaptiveBias,
      scopeTuning,
      effectiveRank: candidateBaseRank + scopeBias + adaptiveBias,
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
    return priority(right) - priority(left) || Number(right.effectiveRank || 0) - Number(left.effectiveRank || 0);
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
  return { total, wins, losses, pnl, winRate };
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

  const [versions, signals, executionProfile, existingRecommendations] = await Promise.all([
    supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionParams.toString()}`),
    supabaseRequest(`${SIGNALS_TABLE}?${signalsParams.toString()}`),
    getExecutionProfileForUser(normalizedUsername),
    supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?select=*`).catch(() => []),
  ]);

  const existingByKey = new Map((existingRecommendations || []).map((item) => [item.recommendation_key, item]));
  const rowsToUpsert = buildRecommendationRows(signals || [], versions || [], executionProfile)
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
    const policyAction = getScopeRecommendationPolicyAction(nextRow);
    if (policyAction === "auto-sandbox") {
      nextRow = await moveScopeRecommendationToSandbox(nextRow);
    }
    if (shouldAutoApplyScopeRecommendation(nextRow) || getScopeRecommendationPolicyAction(nextRow) === "auto-apply") {
      finalRows.push((await applyExecutionScopeRecommendation(normalizedUsername, nextRow)).recommendation);
      continue;
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

  return {
    recommendation: recommendationRows?.[0] || recommendation,
    profile: updatedProfile,
    activationMode: "execution-scope-override",
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
