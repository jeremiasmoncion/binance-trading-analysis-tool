import { getSession, parseJsonBody, sendJson } from "./auth.js";
import { isRunnableStrategyVersion } from "./marketRuntime.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const STRATEGY_REGISTRY_TABLE = process.env.SUPABASE_STRATEGY_REGISTRY_TABLE || "strategy_registry";
const STRATEGY_VERSIONS_TABLE = process.env.SUPABASE_STRATEGY_VERSIONS_TABLE || "strategy_versions";
const STRATEGY_EXPERIMENTS_TABLE = process.env.SUPABASE_STRATEGY_EXPERIMENTS_TABLE || "strategy_experiments";
const STRATEGY_RECOMMENDATIONS_TABLE = process.env.SUPABASE_STRATEGY_RECOMMENDATIONS_TABLE || "strategy_recommendations";
const SIGNALS_TABLE = process.env.SUPABASE_SIGNALS_TABLE || "signal_snapshots";
const ACTIVE_VERSION_STATUSES = new Set(["active", "promoted", "running"]);
const SANDBOX_EXPERIMENT_STATUSES = new Set(["sandbox", "active", "running"]);

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
  } catch {
    versions = [];
    experiments = [];
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
  };
}

export function applySystemStrategyDecision(snapshot, decisionState, context = {}) {
  const marketScope = context.marketScope || "watchlist";
  const timeframe = context.timeframe || snapshot?.timeframe || "";
  const promotedVersionByStrategy = decisionState?.promotedVersionByStrategy || {};
  const activeStrategies = Array.isArray(decisionState?.activeStrategyByScope) ? decisionState.activeStrategyByScope : [];
  const sandboxExperiments = Array.isArray(decisionState?.sandboxExperimentsByScope) ? decisionState.sandboxExperimentsByScope : [];
  const executionEligibleScopes = Array.isArray(decisionState?.executionEligibleScopes) ? decisionState.executionEligibleScopes : [];
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

    let decisionSource = "inactive";
    if (executionRule) decisionSource = "experiment-active";
    else if (promotedVersionByStrategy[strategyId] === version) decisionSource = "promoted";
    else if (activeRule) decisionSource = "active";
    else if (sandboxRule) decisionSource = "sandbox";

    return {
      ...candidate,
      decisionSource,
      experimentId: sandboxRule?.id || executionRule?.experimentId || null,
      executionEligible: Boolean(executionRule || activeRule || promotedVersionByStrategy[strategyId] === version),
    };
  });

  const operationalPrimary = enrichedCandidates.find((candidate) => candidate.decisionSource === "experiment-active")
    || enrichedCandidates.find((candidate) => candidate.decisionSource === "promoted")
    || enrichedCandidates.find((candidate) => candidate.decisionSource === "active")
    || enrichedCandidates[0]
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
    executionReason: operationalPrimary?.executionEligible
      ? "La señal pertenece al flujo operativo actual del sistema."
      : "La lectura quedó fuera del motor activo y se guarda solo como observación.",
    primaryStrategy: operationalPrimary?.strategy || snapshot?.primary?.strategy || {},
    primaryExperimentId: operationalPrimary?.experimentId || null,
    activeStrategies: activeStrategies
      .filter((item) => scopeMatches(item, { marketScope, timeframe }))
      .map((item) => ({
        strategyId: item.strategyId,
        version: item.version,
        label: item.label,
        status: item.status,
      })),
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

    const [registry, versions, experiments, recommendations] = await Promise.all([
      supabaseRequest(`${STRATEGY_REGISTRY_TABLE}?${registryParams.toString()}`),
      supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionsParams.toString()}`),
      supabaseRequest(`${STRATEGY_EXPERIMENTS_TABLE}?${experimentsParams.toString()}`),
      supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?${recommendationsParams.toString()}`),
    ]);

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

function buildRecommendationRows(signals, versions) {
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
    recommendations.push({
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
    recommendations.push({
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
    recommendations.push({
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
    select: "strategy_name,strategy_version,outcome_status,outcome_pnl,signal_payload",
    username: `eq.${normalizedUsername}`,
    order: "created_at.desc",
    limit: "300",
  });

  const [versions, signals] = await Promise.all([
    supabaseRequest(`${STRATEGY_VERSIONS_TABLE}?${versionParams.toString()}`),
    supabaseRequest(`${SIGNALS_TABLE}?${signalsParams.toString()}`),
  ]);

  const rowsToUpsert = buildRecommendationRows(signals || [], versions || []);
  if (!rowsToUpsert.length) return [];

  const rows = await supabaseRequest(`${STRATEGY_RECOMMENDATIONS_TABLE}?on_conflict=recommendation_key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: rowsToUpsert,
  });

  return rows || [];
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

export async function activateAdaptiveRecommendation(req) {
  requireSession(req);
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

  const baseVersion = (versions || []).find(
    (item) => item.strategy_id === recommendation.strategy_id && item.version === recommendation.strategy_version,
  );
  if (!baseVersion) {
    throw new Error("No se encontró la versión base para esta recomendación");
  }

  const evidence = recommendation.evidence && typeof recommendation.evidence === "object" ? recommendation.evidence : {};
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
