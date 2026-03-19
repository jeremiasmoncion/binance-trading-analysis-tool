import type { ReturnTypeUseBinanceData, ReturnTypeUseMarketData, ReturnTypeUseSignalMemory, ReturnTypeUseWatchlist } from "./syncTypes";
import { marketDataPlaneStore } from "./marketDataPlane";
import { systemDataPlaneStore } from "./systemDataPlane";

export function syncMarketDataPlane(market: ReturnTypeUseMarketData) {
  const nextStatus = market.status === "ok"
    ? "ready"
    : market.status === "loading"
      ? "loading"
      : market.status === "error"
        ? "error"
        : "idle";

  marketDataPlaneStore.setState((current) => ({
    ...current,
    meta: {
      ...current.meta,
      status: nextStatus,
      source: market.candles.length ? "stream" : "snapshot",
      lastFullSyncAt: market.candles.length ? current.meta.lastFullSyncAt || Date.now() : current.meta.lastFullSyncAt,
      lastStreamAt: market.currentPrice > 0 ? Date.now() : current.meta.lastStreamAt,
      lastError: nextStatus === "error" ? "No se pudo refrescar el mercado." : null,
    },
    currentCoin: market.currentCoin,
    timeframe: market.timeframe,
    candles: market.candles,
    currentPrice: market.currentPrice,
    indicators: market.indicators,
    signal: market.signal,
    analysis: market.analysis,
    strategy: market.strategy,
    strategyCandidates: market.strategyCandidates,
    multiTimeframes: market.multiTimeframes,
    comparison: market.comparison,
    market24h: market.market24h,
    support: market.supportResistance.support,
    resistance: market.supportResistance.resistance,
  }));
}

export function syncSystemDataPlane(
  binance: ReturnTypeUseBinanceData,
  signalMemory: ReturnTypeUseSignalMemory,
  watchlist: ReturnTypeUseWatchlist,
) {
  const hasSystemPayload = Boolean(
    binance.portfolioData
    || binance.executionCenter
    || binance.dashboardSummary
    || signalMemory.signals.length
    || watchlist.lists.length,
  );

  systemDataPlaneStore.setState((current) => ({
    ...current,
    meta: {
      ...current.meta,
      status: hasSystemPayload ? "ready" : "idle",
      source: "snapshot",
      lastFullSyncAt: hasSystemPayload ? Date.now() : current.meta.lastFullSyncAt,
      lastOverlayAt: binance.dashboardSummary ? Date.now() : current.meta.lastOverlayAt,
      lastError: null,
    },
    connection: binance.binanceConnection,
    portfolio: binance.portfolioData,
    execution: binance.executionCenter,
    dashboardSummary: binance.dashboardSummary,
    signalMemory: signalMemory.signals,
    watchlists: watchlist.lists,
    activeWatchlistName: watchlist.activeListName,
  }));
}
