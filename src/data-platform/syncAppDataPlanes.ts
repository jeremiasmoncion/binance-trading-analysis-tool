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
  watchlist: ReturnTypeUseWatchlist,
) {
  const hasSystemPayload = Boolean(
    binance.portfolioData
    || binance.executionCenter
    || binance.dashboardSummary
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
    snapshot: {
      connection: binance.binanceConnection,
      portfolio: binance.portfolioData,
      signalMemory: current.snapshot.signalMemory,
      watchlists: watchlist.lists,
      activeWatchlistName: watchlist.activeListName,
    },
    overlay: {
      execution: binance.executionCenter,
      dashboardSummary: binance.dashboardSummary,
    },
    controls: {
      ...current.controls,
      portfolioPeriod: binance.portfolioPeriod,
      hideSmallAssets: binance.hideSmallAssets,
      availableUsers: binance.availableUsers,
      binanceForm: binance.binanceForm,
    },
  }));
}

export function syncRealtimeCoreControl(nextState: {
  configured: boolean;
  preferredMode: "external" | "serverless";
  activeMode: "external" | "serverless";
  healthy: boolean;
  targetLabel: string;
}) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    controls: {
      ...current.controls,
      realtimeCore: {
        configured: nextState.configured,
        preferredMode: nextState.preferredMode,
        activeMode: nextState.activeMode,
        healthy: nextState.healthy,
        lastCheckedAt: Date.now(),
        targetLabel: nextState.targetLabel,
      },
    },
  }));
}

export function syncSystemDataPlaneActions(actions: ReturnTypeUseBinanceData) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    actions: {
      ...current.actions,
      refreshPortfolio: actions.refreshPortfolio,
      refreshPortfolioWithFeedback: actions.refreshPortfolioWithFeedback,
      refreshExecutionCenter: actions.refreshExecutionCenter,
      refreshDashboardSummary: actions.refreshDashboardSummary,
      refreshProfileDataWithFeedback: actions.refreshProfileDataWithFeedback,
      setHideSmallAssets: actions.setHideSmallAssets,
      setBinanceFormField: actions.setBinanceFormField,
      connectBinance: actions.connect,
      disconnectBinance: actions.disconnect,
    },
  }));
}

export function syncSystemSignalActions(actions: ReturnTypeUseSignalMemory) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    actions: {
      ...current.actions,
      refreshSignals: actions.refreshSignals,
    },
  }));
}
