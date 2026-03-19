import { getBinanceConnectionStateForUsername, getPortfolioSnapshotForUsername } from "./binance.js";
import {
  buildExecutionCenterFromDependencies,
  buildExecutionDashboardSummaryFromDependencies,
  getExecutionCenterForUser,
  getExecutionProfileForUser,
  listExecutionOrdersForUser,
} from "./executionEngine.js";
import { buildMarketSnapshot } from "./marketRuntime.js";
import { listSignalSnapshotsForUser } from "./signals.js";
import { resolveRealtimeCoreSession } from "./auth.js";
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
  const session = options.session || resolveRealtimeCoreSession(req);
  if (!session) {
    throw new Error("Sesión no válida o vencida");
  }

  const coin = typeof req.query?.coin === "string" ? req.query.coin : (options.coin || "BTC/USDT");
  const timeframe = typeof req.query?.timeframe === "string" ? req.query.timeframe : (options.timeframe || "1h");
  const period = typeof req.query?.period === "string" ? req.query.period : (options.period || "1d");
  const includeMarket = options.includeMarket === true;

  // First paint should reuse one canonical account snapshot; otherwise the bootstrap
  // fans out several full account reads and makes degraded startup much more likely.
  const [portfolio, profile, signals, executionOrdersRaw, marketSnapshot, watchlistsPayload] = await Promise.all([
    getPortfolioSnapshotForUsername(session.username, period, "full").catch(() => null),
    getExecutionProfileForUser(session.username).catch(() => null),
    listSignalSnapshotsForUser(session.username, { limit: 200 }).catch(() => []),
    listExecutionOrdersForUser(session.username).catch(() => []),
    includeMarket ? buildMarketSnapshot(coin, timeframe).catch(() => null) : Promise.resolve(null),
    listWatchlists(req).catch(() => ({ lists: [], activeListName: "Principal" })),
  ]);

  const connection = portfolio
    ? {
      connected: Boolean(portfolio.connected),
      snapshotMode: portfolio.snapshotMode || "full",
      username: session.username,
      accountAlias: portfolio.accountAlias || "",
      maskedApiKey: portfolio.maskedApiKey || "",
      updatedAt: portfolio.portfolio?.updatedAt || new Date().toISOString(),
      summary: portfolio.summary || null,
      connectionIssue: portfolio.connectionIssue || undefined,
    }
    : await getBinanceConnectionStateForUsername(session.username).catch(() => null);

  const [execution, dashboardSummary] = await Promise.all([
    buildExecutionCenterFromDependencies({
      username: session.username,
      profile,
      portfolioPayload: portfolio,
      signals,
      executionOrdersRaw,
    }).catch(() => null),
    buildExecutionDashboardSummaryFromDependencies({
      username: session.username,
      profile,
      portfolioPayload: portfolio,
      signals,
      executionOrdersRaw,
    }).catch(() => null),
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

export async function buildRealtimeCoreSystemOverlay(req, options = {}) {
  const session = options.session || resolveRealtimeCoreSession(req);
  if (!session) {
    throw new Error("Sesión no válida o vencida");
  }

  const [connection, portfolio, execution] = await Promise.all([
    getBinanceConnectionStateForUsername(session.username).catch(() => null),
    getPortfolioSnapshotForUsername(session.username, "1d", "live").catch(() => null),
    getExecutionCenterForUser(session.username).catch(() => null),
  ]);

  return {
    connection,
    portfolio,
    execution,
    dashboardSummary: buildRealtimeDashboardSummary({ connection, portfolio, execution }),
  };
}

export function buildRealtimeCoreHeartbeat(overlay) {
  return {
    connected: Boolean(overlay?.connection?.connected),
    generatedAt: new Date().toISOString(),
  };
}

function buildRealtimeDashboardSummary({ connection, portfolio, execution }) {
  const recentExecuteOrders = Array.isArray(execution?.recentOrders)
    ? execution.recentOrders.filter((item) => item.mode === "execute").slice(0, 20)
    : [];
  const candidates = Array.isArray(execution?.candidates) ? execution.candidates : [];
  const eligibleCount = candidates.filter((item) => item.status === "eligible").length;
  const blockedCount = candidates.filter((item) => item.status === "blocked").length;

  return {
    generatedAt: new Date().toISOString(),
    connection: {
      connected: Boolean(connection?.connected),
      accountAlias: portfolio?.accountAlias || connection?.accountAlias || "",
    },
    connectionIssue: portfolio?.connectionIssue || undefined,
    portfolio: portfolio?.portfolio || {
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
    topAssets: Array.isArray(portfolio?.assets) ? portfolio.assets.slice(0, 5) : [],
    execution: {
      profileEnabled: Boolean(execution?.profile?.enabled),
      activeBots: execution?.profile?.enabled ? 1 : 0,
      totalBots: 1,
      openOrdersCount: Number(execution?.account?.openOrdersCount || portfolio?.openOrders?.length || 0),
      dailyLossPct: Number(execution?.account?.dailyLossPct || 0),
      dailyAutoExecutions: Number(execution?.account?.dailyAutoExecutions || 0),
      recentLossStreak: Number(execution?.account?.recentLossStreak || 0),
      autoExecutionRemaining: Number(execution?.account?.autoExecutionRemaining || 0),
      eligibleCount,
      blockedCount,
      recentOrders: recentExecuteOrders,
    },
  };
}
