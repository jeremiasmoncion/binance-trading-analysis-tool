import type { ReturnTypeUseBinanceData, ReturnTypeUseMarketData, ReturnTypeUseMemoryRuntime, ReturnTypeUseSignalMemory, ReturnTypeUseWatchlist } from "./syncTypes";
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
  memoryRuntime: ReturnTypeUseMemoryRuntime,
  watchlist: ReturnTypeUseWatchlist,
  isAuthenticated: boolean,
) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    meta: {
      ...current.meta,
      status: isAuthenticated
        ? (
          binance.portfolioData
          || binance.executionCenter
          || binance.dashboardSummary
          || memoryRuntime.strategyRegistry.length
          || memoryRuntime.strategyExperiments.length
          || memoryRuntime.strategyRecommendations.length
          || memoryRuntime.scannerStatus
          || current.snapshot.portfolio
          || current.overlay.execution
          || current.overlay.dashboardSummary
          || watchlist.lists.length
            ? "ready"
            : current.meta.status
        )
        : "idle",
      source: "snapshot",
      lastFullSyncAt: isAuthenticated && (binance.portfolioData || watchlist.lists.length)
        ? Date.now()
        : current.meta.lastFullSyncAt,
      lastOverlayAt: isAuthenticated && (binance.executionCenter || binance.dashboardSummary)
        ? Date.now()
        : current.meta.lastOverlayAt,
      lastError: null,
    },
    snapshot: {
      connection: isAuthenticated
        ? (binance.binanceConnection ?? current.snapshot.connection)
        : null,
      portfolio: isAuthenticated
        ? (binance.portfolioData ?? current.snapshot.portfolio)
        : null,
      signalMemory: current.snapshot.signalMemory,
      watchlists: isAuthenticated ? watchlist.lists : [],
      activeWatchlistName: isAuthenticated ? watchlist.activeListName : "Principal",
      strategyRegistry: isAuthenticated ? memoryRuntime.strategyRegistry : [],
      strategyVersions: isAuthenticated ? memoryRuntime.strategyVersions : [],
      strategyExperiments: isAuthenticated ? memoryRuntime.strategyExperiments : [],
      strategyRecommendations: isAuthenticated ? memoryRuntime.strategyRecommendations : [],
      strategyDecision: isAuthenticated ? memoryRuntime.strategyDecision : null,
      scannerStatus: isAuthenticated ? memoryRuntime.scannerStatus : null,
    },
    overlay: {
      execution: isAuthenticated
        ? (binance.executionCenter ?? current.overlay.execution)
        : null,
      dashboardSummary: isAuthenticated
        ? (binance.dashboardSummary ?? current.overlay.dashboardSummary)
        : null,
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
  serviceMode: string | null;
  activeChannels: number | null;
  activeSubscribers: number | null;
  pollIntervalMs: number | null;
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
        serviceMode: nextState.serviceMode,
        activeChannels: nextState.activeChannels,
        activeSubscribers: nextState.activeSubscribers,
        pollIntervalMs: nextState.pollIntervalMs,
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

export function syncSystemMemoryActions(actions: ReturnTypeUseMemoryRuntime) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    actions: {
      ...current.actions,
      refreshStrategyEngine: actions.refreshStrategyEngine,
      refreshScannerStatus: actions.refreshScannerStatus,
      runScannerNow: actions.runScannerNow,
    },
  }));
}

export function syncRealtimeCoreActions(actions: { refreshRealtimeCoreStatus: () => Promise<unknown> }) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    actions: {
      ...current.actions,
      refreshRealtimeCoreStatus: actions.refreshRealtimeCoreStatus,
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

export function syncSystemWatchlistActions(actions: ReturnTypeUseWatchlist) {
  systemDataPlaneStore.setState((current) => ({
    ...current,
    actions: {
      ...current.actions,
      toggleWatchlist: actions.toggleWatchlist,
      replaceWatchlistCoins: actions.replaceListCoins,
      createWatchlist: actions.createList,
      renameWatchlist: actions.renameList,
      deleteWatchlist: actions.deleteList,
      setActiveWatchlist: actions.setActiveList,
    },
  }));
}
