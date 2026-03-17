import { parseJsonBody } from "./auth.js";
import {
  fetchBinancePublic,
  fetchBinanceSigned,
  getCredentialsForSession,
  getCredentialsForUsername,
  getPortfolioSnapshotForUsername,
  sendJson,
} from "./binance.js";
import { listSignalSnapshotsForUser, updateSignalExecutionLink } from "./signals.js";
import { updateSignalSnapshotForUser } from "./signals.js";
import { generateAdaptiveRecommendationsForUser } from "./strategyEngine.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EXECUTION_PROFILES_TABLE = process.env.SUPABASE_EXECUTION_PROFILES_TABLE || "execution_profiles";
const EXECUTION_ORDERS_TABLE = process.env.SUPABASE_EXECUTION_ORDERS_TABLE || "execution_orders";

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
  const note = String(profile.note || DEFAULT_PROFILE.note);
  const scopeOverrides = Array.isArray(profile.scopeOverrides) ? profile.scopeOverrides : [];
  return `${PROFILE_METADATA_PREFIX}${JSON.stringify({
    note,
    scopeOverrides: scopeOverrides.map((item) => ({
      id: String(item.id || `${item.strategyId || "scope"}-${item.timeframe || "all"}`),
      strategyId: String(item.strategyId || ""),
      timeframe: String(item.timeframe || ""),
      enabled: item.enabled !== false,
      minSignalScore: item.minSignalScore == null ? undefined : Number(item.minSignalScore),
      minRrRatio: item.minRrRatio == null ? undefined : Number(item.minRrRatio),
      note: String(item.note || ""),
    })),
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

function getProtectionPayload(responsePayload) {
  if (!responsePayload || typeof responsePayload !== "object") return null;
  return "protection" in responsePayload ? responsePayload.protection || null : null;
}

function getExecutionOriginLabel(record) {
  if (record.origin === "watcher") return "Auto por vigilante";
  if (record.signal_id) return "Desde señales";
  return "Manual usuario";
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

async function getExecutionProfileForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "updated_at.desc.nullslast,created_at.desc",
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`);
  return normalizeProfile(rows?.[0] || null, username);
}

async function getExecutionCenterForUser(username) {
  const [profile, portfolioPayload, signals, executionOrdersRaw] = await Promise.all([
    getExecutionProfileForUser(username),
    getPortfolioSnapshotForUsername(username, "1d"),
    listSignalSnapshotsForUser(username, { limit: 200 }),
    listExecutionOrdersForUser(username),
  ]);

  const executionOrders = await syncExecutionOrdersForUser(username, portfolioPayload, signals || [], executionOrdersRaw || []);
  const openExecutionSignalIds = new Set(
    executionOrders
      .filter((item) => isExecutionOpenStatus(item.lifecycle_status || item.status))
      .map((item) => Number(item.signal_id || 0))
      .filter(Boolean),
  );

  const dailyLossAbs = (signals || [])
    .filter((item) => item.outcome_status !== "pending")
    .filter((item) => new Date(item.updated_at || item.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .reduce((sum, item) => sum + Math.min(0, Number(item.outcome_pnl || 0)), 0);
  const accountValue = Number(portfolioPayload?.portfolio?.totalValue || 0);
  const dailyLossPct = accountValue > 0 ? Math.abs((dailyLossAbs / accountValue) * 100) : 0;
  const dailyAutoExecutions = buildDailyAutoExecutions(executionOrders);
  const recentLossStreak = buildRecentLossStreak(executionOrders);

  const pendingSignals = (signals || []).filter((item) => item.outcome_status === "pending");
  const candidates = [];
  for (const signal of pendingSignals.slice(0, 20)) {
    if (openExecutionSignalIds.has(Number(signal.id)) || (signal.execution_order_id && isExecutionOpenStatus(signal.execution_status))) {
      continue;
    }
    candidates.push(await buildSignalCandidate(signal, portfolioPayload, profile, {
      dailyLossPct,
      dailyAutoExecutions,
      recentLossStreak,
    }));
  }

  return {
    profile,
    account: {
      connected: Boolean(portfolioPayload?.connected),
      alias: portfolioPayload?.accountAlias || "",
      cashValue: Number(portfolioPayload?.portfolio?.cashValue || 0),
      totalValue: Number(portfolioPayload?.portfolio?.totalValue || 0),
      openOrdersCount: Number(portfolioPayload?.openOrders?.length || 0),
      dailyLossPct: Number(dailyLossPct.toFixed(2)),
      dailyAutoExecutions,
      recentLossStreak,
      autoExecutionRemaining: Math.max(0, profile.maxDailyAutoExecutions - dailyAutoExecutions),
    },
    candidates,
    recentOrders: executionOrders || [],
  };
}

async function saveExecutionProfileForUser(username, payload) {
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
    }),
  };

  const existing = await getExecutionProfileForUser(username).catch(() => null);
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
  return normalizeProfile(rows?.[0] || profile, username);
}

async function listExecutionOrdersForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "created_at.desc",
    limit: "60",
  });
  return supabaseRequest(`${EXECUTION_ORDERS_TABLE}?${params.toString()}`);
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
  const effectiveProfile = getEffectiveProfileForSignal(profile, signal);
  let side = signal.signal_label === "Comprar" ? "BUY" : signal.signal_label === "Vender" ? "SELL" : "";
  let qty = 0;
  let notionalUsd = 0;
  let status = "eligible";
  const dailyLossPct = Number(riskContext.dailyLossPct || 0);
  const dailyAutoExecutions = Number(riskContext.dailyAutoExecutions || 0);
  const recentLossStreak = Number(riskContext.recentLossStreak || 0);
  const decision = signal.signal_payload?.decision && typeof signal.signal_payload.decision === "object"
    ? signal.signal_payload.decision
    : null;

  if (!profile.enabled) reasons.push("El perfil de ejecución está desactivado.");
  if (!side) reasons.push("La señal actual no tiene dirección operable.");
  if (decision && decision.executionEligible === false) {
    reasons.push(String(decision.executionReason || "La señal quedó fuera del flujo operativo actual del sistema."));
  }
  if (Number(signal.signal_score || 0) < effectiveProfile.minSignalScore) {
    reasons.push(`La convicción (${signal.signal_score || 0}) está por debajo del mínimo ${effectiveProfile.minSignalScore}${effectiveProfile.override ? ` para ${effectiveProfile.override.strategyId} · ${effectiveProfile.override.timeframe}` : ""}.`);
  }
  if (Number(signal.rr_ratio || 0) > 0 && Number(signal.rr_ratio || 0) < effectiveProfile.minRrRatio) {
    reasons.push(`El RR (${signal.rr_ratio || 0}) está por debajo del mínimo ${effectiveProfile.minRrRatio}${effectiveProfile.override ? ` para ${effectiveProfile.override.strategyId} · ${effectiveProfile.override.timeframe}` : ""}.`);
  }
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
    score: Number(signal.signal_score || 0),
    rrRatio: Number(signal.rr_ratio || 0),
    decisionSource: String(decision?.source || "legacy"),
    decisionExperimentId: Number(decision?.primaryExperimentId || 0) || null,
    profileOverride: effectiveProfile.override
      ? {
        strategyId: effectiveProfile.override.strategyId,
        timeframe: effectiveProfile.override.timeframe,
        minSignalScore: effectiveProfile.minSignalScore,
        minRrRatio: effectiveProfile.minRrRatio,
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
  const openOrderIds = new Set((portfolioPayload?.openOrders || []).map((item) => Number(item.orderId || 0)).filter(Boolean));
  const nextOrders = [];

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

    const updates = {
      lifecycle_status: lifecycleStatus,
      protection_status: protectionStatus,
      signal_outcome_status: signalOutcomeStatus,
      realized_pnl: realizedPnl,
      last_synced_at: new Date().toISOString(),
      closed_at: closedAt,
    };

    const hasChanged = lifecycleStatus !== record.lifecycle_status
      || protectionStatus !== record.protection_status
      || signalOutcomeStatus !== record.signal_outcome_status
      || realizedPnl !== Number(record.realized_pnl || 0)
      || String(closedAt || "") !== String(record.closed_at || "");

    let nextRecord = { ...record, ...updates };
    if (hasChanged) {
      nextRecord = (await updateExecutionRecord(record.id, updates)) || nextRecord;
    }

    if (signal?.id) {
      const nextExecutionStatus = lifecycleStatus;
      const nextExecutionMode = String(record.mode || "");
      const shouldUpdateSignal = signal.execution_order_id !== record.id
        || signal.execution_status !== nextExecutionStatus
        || signal.execution_mode !== nextExecutionMode;
      if (shouldUpdateSignal) {
        const patchedSignal = await updateSignalExecutionLink(username, signal.id, {
          executionOrderId: record.id,
          executionStatus: nextExecutionStatus,
          executionMode: nextExecutionMode,
          executionUpdatedAt: new Date().toISOString(),
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
        }).catch(() => null);
        if (patchedSignal) {
          signalMap.set(Number(signal.id), patchedSignal);
          signal.outcome_status = signalOutcomeStatus;
          signal.outcome_pnl = realizedPnl;
          signal.note = closeNote;
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

async function updateExecutionProfile(req) {
  const { session } = await getCredentialsForSession(req);
  const body = parseJsonBody(req);
  return saveExecutionProfileForUser(session.username, body);
}

async function executeSignalTrade(req) {
  const { session, apiKey, apiSecret } = await getCredentialsForSession(req);
  const body = parseJsonBody(req);
  const signalId = Number(body.signalId || 0);
  const mode = body.mode === "execute" ? "execute" : "preview";
  return executeSignalTradeForUser(session.username, signalId, mode, {
    apiKey,
    apiSecret,
    origin: "manual",
  });
}

async function executeSignalTradeForUser(username, signalId, mode = "execute", options = {}) {
  if (!signalId) throw new Error("Debes indicar la señal que quieres operar.");
  const normalizedMode = mode === "execute" ? "execute" : "preview";
  const origin = options.origin || "manual";
  const credentials = options.apiKey && options.apiSecret
    ? { apiKey: options.apiKey, apiSecret: options.apiSecret }
    : await getCredentialsForUsername(username);
  const center = await getExecutionCenterForUser(username);
  const candidate = center.candidates.find((item) => item.signalId === signalId);
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
  };

  if (candidate.status !== "eligible" || normalizedMode === "preview") {
    const record = await insertExecutionRecord({
      ...recordBase,
      status: normalizedMode === "preview" ? "preview" : "blocked",
      lifecycle_status: normalizedMode === "preview" ? "preview" : "blocked",
      protection_status: "none",
      notes: candidate.reasons.join(" | ") || `Candidata lista para revisión ${origin === "watcher" ? "automática" : "manual"}`,
      response_payload: { candidate, origin },
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
    notes: `${origin === "watcher" ? "Orden automática del vigilante. " : "Orden Demo enviada desde Señales. "}${protectionResult.protectionNote}`,
    response_payload: {
      origin,
      order: result,
      protection: protectionResult,
    },
  });

  if (record?.id) {
    await updateSignalExecutionLink(username, candidate.signalId, {
      executionOrderId: record.id,
      executionStatus: record.lifecycle_status || "placed",
      executionMode: normalizedMode,
    }).catch(() => null);
  }

  return { mode: normalizedMode, candidate, record, order: result, protection: protectionResult };
}

export {
  executeSignalTrade,
  executeSignalTradeForUser,
  getExecutionCenter,
  getExecutionCenterForUser,
  getExecutionProfileForUser,
  saveExecutionProfileForUser,
  sendJson,
  updateExecutionProfile,
};
