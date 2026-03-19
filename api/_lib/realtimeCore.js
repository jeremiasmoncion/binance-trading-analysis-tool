import { getBinanceConnectionState, getPortfolioSnapshot } from "./binance.js";
import { getExecutionCenter, getExecutionDashboardSummary } from "./executionEngine.js";
import { buildMarketSnapshot } from "./marketRuntime.js";
import { listSignalSnapshotsForUser } from "./signals.js";
import { getSession } from "./auth.js";
import { listWatchlists } from "./watchlist.js";

function getSupportResistance(candles) {
  const items = Array.isArray(candles) ? candles.slice(-20) : [];
  if (!items.length) {
    return { support: 0, resistance: 0 };
  }

  const prices = items.flatMap((candle) => [Number(candle.high || 0), Number(candle.low || 0)])
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!prices.length) {
    return { support: 0, resistance: 0 };
  }

  return {
    support: Math.min(...prices),
    resistance: Math.max(...prices),
  };
}

function normalizeMarketBootstrapSnapshot(snapshot) {
  if (!snapshot) return null;
  const supportResistance = getSupportResistance(snapshot.candles || []);
  return {
    coin: snapshot.coin,
    timeframe: snapshot.timeframe,
    candles: snapshot.candles || [],
    currentPrice: Number(snapshot.currentPrice || 0),
    indicators: snapshot.indicators || null,
    signal: snapshot.primary?.signal || null,
    analysis: snapshot.primary?.analysis || null,
    strategy: snapshot.primary?.strategy || null,
    strategyCandidates: (snapshot.candidates || []).map((item) => ({
      strategy: item.strategy,
      signal: item.signal,
      analysis: item.analysis,
      plan: item.plan,
      rankScore: item.rankScore,
      isPrimary: Boolean(item.isPrimary),
    })),
    multiTimeframes: snapshot.multiTimeframes || [],
    support: Number(supportResistance.support || 0),
    resistance: Number(supportResistance.resistance || 0),
  };
}

export async function buildRealtimeCoreBootstrap(req, options = {}) {
  const session = getSession(req);
  if (!session) {
    throw new Error("Sesión no válida o vencida");
  }

  const coin = typeof req.query?.coin === "string" ? req.query.coin : (options.coin || "BTC/USDT");
  const timeframe = typeof req.query?.timeframe === "string" ? req.query.timeframe : (options.timeframe || "1h");
  const period = typeof req.query?.period === "string" ? req.query.period : (options.period || "1d");

  const [connection, portfolio, execution, dashboardSummary, marketSnapshot, signals, watchlistsPayload] = await Promise.all([
    getBinanceConnectionState(req).catch(() => null),
    getPortfolioSnapshot(req, period, "full").catch(() => null),
    getExecutionCenter(req).catch(() => null),
    getExecutionDashboardSummary(req).catch(() => null),
    buildMarketSnapshot(coin, timeframe).catch(() => null),
    listSignalSnapshotsForUser(session.username, { limit: 200 }).catch(() => []),
    listWatchlists(req).catch(() => ({ lists: [], activeListName: "Principal" })),
  ]);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    market: normalizeMarketBootstrapSnapshot(marketSnapshot),
    system: {
      connection,
      portfolio,
      execution,
      dashboardSummary,
      signalMemory: Array.isArray(signals) ? signals : [],
      watchlists: Array.isArray(watchlistsPayload?.lists) ? watchlistsPayload.lists : [],
      activeWatchlistName: String(watchlistsPayload?.activeListName || "Principal"),
      controls: {
        portfolioPeriod: period,
        hideSmallAssets: true,
        availableUsers: [],
      },
    },
  };
}

export async function buildRealtimeCoreSystemOverlay(req) {
  const session = getSession(req);
  if (!session) {
    throw new Error("Sesión no válida o vencida");
  }

  const [connection, execution, dashboardSummary] = await Promise.all([
    getBinanceConnectionState(req).catch(() => null),
    getExecutionCenter(req).catch(() => null),
    getExecutionDashboardSummary(req).catch(() => null),
  ]);

  return {
    connection,
    execution,
    dashboardSummary,
  };
}

export function buildRealtimeCoreHeartbeat(overlay) {
  return {
    connected: Boolean(overlay?.connection?.connected),
    generatedAt: new Date().toISOString(),
  };
}
