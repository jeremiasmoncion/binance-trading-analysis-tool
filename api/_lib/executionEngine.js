import { parseJsonBody } from "./auth.js";
import {
  fetchBinancePublic,
  fetchBinanceSigned,
  getCredentialsForSession,
  getPortfolioSnapshot,
  sendJson,
} from "./binance.js";
import { listSignalSnapshotsForUser } from "./signals.js";

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
  allowedStrategies: ["trend-alignment", "breakout"],
  allowedTimeframes: ["15m", "1h", "4h"],
  note: "Perfil base para ejecutar Demo con control humano.",
};

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

function normalizeProfile(row, username) {
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
    allowedStrategies: normalizeArray(row?.allowed_strategies).length ? normalizeArray(row?.allowed_strategies) : DEFAULT_PROFILE.allowedStrategies,
    allowedTimeframes: normalizeArray(row?.allowed_timeframes).length ? normalizeArray(row?.allowed_timeframes) : DEFAULT_PROFILE.allowedTimeframes,
    note: String(row?.note || DEFAULT_PROFILE.note),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

async function getExecutionProfileForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`${EXECUTION_PROFILES_TABLE}?${params.toString()}`);
  return normalizeProfile(rows?.[0] || null, username);
}

async function saveExecutionProfileForUser(username, payload) {
  const profile = {
    username,
    enabled: Boolean(payload.enabled),
    auto_execute_enabled: Boolean(payload.autoExecuteEnabled),
    risk_per_trade_pct: Number(payload.riskPerTradePct || DEFAULT_PROFILE.riskPerTradePct),
    max_open_positions: Number(payload.maxOpenPositions || DEFAULT_PROFILE.maxOpenPositions),
    max_position_usd: Number(payload.maxPositionUsd || DEFAULT_PROFILE.maxPositionUsd),
    max_daily_loss_pct: Number(payload.maxDailyLossPct || DEFAULT_PROFILE.maxDailyLossPct),
    min_signal_score: Number(payload.minSignalScore || DEFAULT_PROFILE.minSignalScore),
    min_rr_ratio: Number(payload.minRrRatio || DEFAULT_PROFILE.minRrRatio),
    allowed_strategies: normalizeArray(payload.allowedStrategies),
    allowed_timeframes: normalizeArray(payload.allowedTimeframes),
    note: String(payload.note || DEFAULT_PROFILE.note),
  };

  const rows = await supabaseRequest(EXECUTION_PROFILES_TABLE, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: profile,
  });
  return normalizeProfile(rows?.[0] || profile, username);
}

async function listExecutionOrdersForUser(username) {
  const params = new URLSearchParams({
    select: "*",
    username: `eq.${String(username)}`,
    order: "created_at.desc",
    limit: "30",
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

async function buildSignalCandidate(signal, portfolio, profile, dailyLossPct) {
  const symbol = signal.coin.replace("/", "");
  const priceTicker = await fetchBinancePublic("/api/v3/ticker/price", { symbol }).catch(() => ({ price: "0" }));
  const currentPrice = Number(priceTicker?.price || signal.entry_price || 0);
  const rules = await getSymbolRules(symbol);
  const reasons = [];
  let side = signal.signal_label === "Comprar" ? "BUY" : signal.signal_label === "Vender" ? "SELL" : "";
  let qty = 0;
  let notionalUsd = 0;
  let status = "eligible";

  if (!profile.enabled) reasons.push("El perfil de ejecución está desactivado.");
  if (!side) reasons.push("La señal actual no tiene dirección operable.");
  if (Number(signal.signal_score || 0) < profile.minSignalScore) {
    reasons.push(`La convicción (${signal.signal_score || 0}) está por debajo del mínimo ${profile.minSignalScore}.`);
  }
  if (Number(signal.rr_ratio || 0) > 0 && Number(signal.rr_ratio || 0) < profile.minRrRatio) {
    reasons.push(`El RR (${signal.rr_ratio || 0}) está por debajo del mínimo ${profile.minRrRatio}.`);
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

async function getExecutionCenter(req) {
  const { session } = await getCredentialsForSession(req);
  const [profile, portfolioPayload, signals, executionOrders] = await Promise.all([
    getExecutionProfileForUser(session.username),
    getPortfolioSnapshot(req, "1d"),
    listSignalSnapshotsForUser(session.username, { outcomeStatus: "pending", limit: 30 }),
    listExecutionOrdersForUser(session.username),
  ]);

  const dailyLossAbs = (signals || [])
    .filter((item) => item.outcome_status !== "pending")
    .filter((item) => new Date(item.updated_at || item.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .reduce((sum, item) => sum + Math.min(0, Number(item.outcome_pnl || 0)), 0);
  const accountValue = Number(portfolioPayload?.portfolio?.totalValue || 0);
  const dailyLossPct = accountValue > 0 ? Math.abs((dailyLossAbs / accountValue) * 100) : 0;

  const pendingSignals = (signals || []).filter((item) => item.outcome_status === "pending");
  const candidates = [];
  for (const signal of pendingSignals.slice(0, 12)) {
    candidates.push(await buildSignalCandidate(signal, portfolioPayload, profile, dailyLossPct));
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
    },
    candidates,
    recentOrders: executionOrders || [],
  };
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
  if (!signalId) throw new Error("Debes indicar la señal que quieres operar.");

  const center = await getExecutionCenter(req);
  const candidate = center.candidates.find((item) => item.signalId === signalId);
  if (!candidate) throw new Error("No encontramos esa señal abierta dentro de los candidatos actuales.");

  const recordBase = {
    username: session.username,
    signal_id: candidate.signalId,
    coin: candidate.coin,
    timeframe: candidate.timeframe,
    strategy_name: candidate.strategyName,
    strategy_version: candidate.strategyVersion,
    side: candidate.side,
    quantity: candidate.qty,
    notional_usd: candidate.notionalUsd,
    current_price: candidate.currentPrice,
    mode,
  };

  if (candidate.status !== "eligible" || mode === "preview") {
    const record = await insertExecutionRecord({
      ...recordBase,
      status: mode === "preview" ? "preview" : "blocked",
      notes: candidate.reasons.join(" | ") || "Candidata lista para revisión manual",
      response_payload: { candidate },
    });
    return { mode, candidate, record };
  }

  const result = await fetchBinanceSigned(
    "/api/v3/order",
    apiKey,
    apiSecret,
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
      apiKey,
      apiSecret,
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
    notes: protectionResult.protectionNote,
    response_payload: {
      order: result,
      protection: protectionResult,
    },
  });

  return { mode, candidate, record, order: result, protection: protectionResult };
}

export {
  executeSignalTrade,
  getExecutionCenter,
  saveExecutionProfileForUser,
  sendJson,
  updateExecutionProfile,
};
