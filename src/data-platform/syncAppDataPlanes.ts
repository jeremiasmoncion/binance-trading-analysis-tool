import type { ReturnTypeUseBinanceData, ReturnTypeUseMarketData, ReturnTypeUseMemoryRuntime, ReturnTypeUseSignalMemory, ReturnTypeUseValidationLabRuntime, ReturnTypeUseWatchlist } from "./syncTypes";
import type { DashboardSummaryPayload, PortfolioAsset } from "../types";
import { marketDataPlaneStore } from "./marketDataPlane";
import { systemDataPlaneStore } from "./systemDataPlane";

function mergeDashboardSummaryPreservingCollections(
  currentSummary: DashboardSummaryPayload | null,
  nextSummary: DashboardSummaryPayload | null | undefined,
): DashboardSummaryPayload | null {
  if (!nextSummary || typeof nextSummary !== "object") {
    return currentSummary ?? null;
  }

  if (!currentSummary || typeof currentSummary !== "object") {
    return nextSummary;
  }

  const currentTopAssets = Array.isArray((currentSummary as { topAssets?: PortfolioAsset[] }).topAssets)
    ? (currentSummary as { topAssets: PortfolioAsset[] }).topAssets
    : [];
  const nextTopAssets = Array.isArray((nextSummary as { topAssets?: PortfolioAsset[] }).topAssets)
    ? (nextSummary as { topAssets: PortfolioAsset[] }).topAssets
    : [];
  const currentPortfolio = currentSummary.portfolio || null;
  const nextPortfolio = nextSummary.portfolio || null;
  const currentPositionsValue = Number(currentPortfolio?.positionsValue || 0);
  const nextPositionsValue = Number(nextPortfolio?.positionsValue || 0);
  const currentTotalValue = Number(currentPortfolio?.totalValue || 0);
  const nextTotalValue = Number(nextPortfolio?.totalValue || 0);
  const nextCashValue = Number(nextPortfolio?.cashValue || 0);
  const collapsedToMostlyCash = nextTotalValue > 0 && nextCashValue / nextTotalValue >= 0.9;
  const collapsedPositions = currentPositionsValue > 0 && nextPositionsValue <= currentPositionsValue * 0.25;
  const collapsedTotalValue = currentTotalValue > 0 && nextTotalValue <= currentTotalValue * 0.75;

  // Dashboard summary is a lightweight operational overlay. If it drops from a
  // diversified portfolio to almost pure cash in one frame, prefer the last
  // good summary and let the next healthy cycle confirm a real liquidation.
  if (collapsedTotalValue && collapsedPositions && collapsedToMostlyCash) {
    return {
      ...nextSummary,
      portfolio: currentPortfolio,
      topAssets: currentTopAssets,
    };
  }

  // Dashboard summary can stay "useful" for KPI totals while the lightweight
  // overlay omits top assets. Preserve the last good collection so dashboard
  // navigation does not blank the assets card on a later revisit.
  if (!nextTopAssets.length && currentTopAssets.length) {
    return {
      ...nextSummary,
      topAssets: currentTopAssets,
    };
  }

  return nextSummary;
}

function hasMarketPlanePayloadChanged(current: ReturnType<typeof marketDataPlaneStore.getState>, market: ReturnTypeUseMarketData, nextStatus: "ready" | "loading" | "error" | "idle") {
  return !(
    current.meta.status === nextStatus
    && current.currentCoin === market.currentCoin
    && current.timeframe === market.timeframe
    && current.availableCoins === market.availableCoins
    && current.popularCoins === market.popularCoins
    && current.candles === market.candles
    && current.currentPrice === market.currentPrice
    && current.indicators === market.indicators
    && current.signal === market.signal
    && current.analysis === market.analysis
    && current.strategy === market.strategy
    && current.strategyCandidates === market.strategyCandidates
    && current.multiTimeframes === market.multiTimeframes
    && current.comparison === market.comparison
    && current.market24h === market.market24h
    && current.support === market.supportResistance.support
    && current.resistance === market.supportResistance.resistance
  );
}

function hasSystemPlanePayloadChanged(
  current: ReturnType<typeof systemDataPlaneStore.getState>,
  next: ReturnType<typeof systemDataPlaneStore.getState>,
) {
  return !(
    current.meta.status === next.meta.status
    && current.meta.source === next.meta.source
    && current.snapshot.connection === next.snapshot.connection
    && current.snapshot.portfolio === next.snapshot.portfolio
    && current.snapshot.signalMemory === next.snapshot.signalMemory
    && current.snapshot.watchlists === next.snapshot.watchlists
    && current.snapshot.activeWatchlistName === next.snapshot.activeWatchlistName
    && current.snapshot.strategyRegistry === next.snapshot.strategyRegistry
    && current.snapshot.strategyVersions === next.snapshot.strategyVersions
    && current.snapshot.strategyExperiments === next.snapshot.strategyExperiments
    && current.snapshot.strategyRecommendations === next.snapshot.strategyRecommendations
    && current.snapshot.strategyDecision === next.snapshot.strategyDecision
    && current.snapshot.scannerStatus === next.snapshot.scannerStatus
    && current.snapshot.validationReport === next.snapshot.validationReport
    && current.snapshot.backtestRuns === next.snapshot.backtestRuns
    && current.snapshot.backtestQueue.pending === next.snapshot.backtestQueue.pending
    && current.snapshot.backtestQueue.running === next.snapshot.backtestQueue.running
    && current.overlay.execution === next.overlay.execution
    && current.overlay.dashboardSummary === next.overlay.dashboardSummary
    && current.controls.portfolioPeriod === next.controls.portfolioPeriod
    && current.controls.hideSmallAssets === next.controls.hideSmallAssets
    && current.controls.availableUsers === next.controls.availableUsers
    && current.controls.binanceForm.alias === next.controls.binanceForm.alias
    && current.controls.binanceForm.apiKey === next.controls.binanceForm.apiKey
    && current.controls.binanceForm.apiSecret === next.controls.binanceForm.apiSecret
  );
}

function hasMarketActionPayloadChanged(
  current: ReturnType<typeof marketDataPlaneStore.getState>,
  nextActions: ReturnType<typeof marketDataPlaneStore.getState>["actions"],
) {
  return !(
    current.actions.selectCoin === nextActions.selectCoin
    && current.actions.selectTimeframe === nextActions.selectTimeframe
    && current.actions.refreshMarket === nextActions.refreshMarket
  );
}

function hasSystemActionPayloadChanged(
  current: ReturnType<typeof systemDataPlaneStore.getState>,
  nextActions: ReturnType<typeof systemDataPlaneStore.getState>["actions"],
) {
  return !(
    current.actions.refreshSignals === nextActions.refreshSignals
    && current.actions.updateSignalMemoryEntry === nextActions.updateSignalMemoryEntry
    && current.actions.refreshPortfolio === nextActions.refreshPortfolio
    && current.actions.refreshPortfolioWithFeedback === nextActions.refreshPortfolioWithFeedback
    && current.actions.refreshExecutionCenter === nextActions.refreshExecutionCenter
    && current.actions.refreshDashboardSummary === nextActions.refreshDashboardSummary
    && current.actions.updateExecutionProfile === nextActions.updateExecutionProfile
    && current.actions.executeDemoSignal === nextActions.executeDemoSignal
    && current.actions.attachExecutionProtection === nextActions.attachExecutionProtection
    && current.actions.refreshProfileDataWithFeedback === nextActions.refreshProfileDataWithFeedback
    && current.actions.refreshStrategyEngine === nextActions.refreshStrategyEngine
    && current.actions.createStrategyExperiment === nextActions.createStrategyExperiment
    && current.actions.updateStrategyExperiment === nextActions.updateStrategyExperiment
    && current.actions.promoteStrategyExperiment === nextActions.promoteStrategyExperiment
    && current.actions.generateStrategyRecommendations === nextActions.generateStrategyRecommendations
    && current.actions.activateStrategyRecommendation === nextActions.activateStrategyRecommendation
    && current.actions.refreshScannerStatus === nextActions.refreshScannerStatus
    && current.actions.runScannerNow === nextActions.runScannerNow
    && current.actions.refreshValidationLab === nextActions.refreshValidationLab
    && current.actions.enqueueValidationBacktest === nextActions.enqueueValidationBacktest
    && current.actions.processValidationBacktestQueue === nextActions.processValidationBacktestQueue
    && current.actions.backfillValidationDataset === nextActions.backfillValidationDataset
    && current.actions.setHideSmallAssets === nextActions.setHideSmallAssets
    && current.actions.setBinanceFormField === nextActions.setBinanceFormField
    && current.actions.connectBinance === nextActions.connectBinance
    && current.actions.disconnectBinance === nextActions.disconnectBinance
    && current.actions.refreshRealtimeCoreStatus === nextActions.refreshRealtimeCoreStatus
    && current.actions.toggleWatchlist === nextActions.toggleWatchlist
    && current.actions.replaceWatchlistCoins === nextActions.replaceWatchlistCoins
    && current.actions.createWatchlist === nextActions.createWatchlist
    && current.actions.renameWatchlist === nextActions.renameWatchlist
    && current.actions.deleteWatchlist === nextActions.deleteWatchlist
    && current.actions.setActiveWatchlist === nextActions.setActiveWatchlist
  );
}

export function syncMarketDataPlane(market: ReturnTypeUseMarketData) {
  const nextStatus = market.status === "ok"
    ? "ready"
    : market.status === "loading"
      ? "loading"
      : market.status === "error"
        ? "error"
        : "idle";

  marketDataPlaneStore.setState((current) => {
    // Keep the market plane quiet unless the payload meaningfully changed.
    // The hook still refreshes often, but selectors should not pay for no-op
    // syncs that only recreate the same plane object.
    if (!hasMarketPlanePayloadChanged(current, market, nextStatus)) {
      return current;
    }

    return {
      ...current,
      meta: {
        ...current.meta,
        status: nextStatus,
        source: market.candles.length ? "stream" : "snapshot",
        lastFullSyncAt: market.candles.length && current.candles !== market.candles ? Date.now() : current.meta.lastFullSyncAt,
        lastStreamAt: market.currentPrice > 0 && current.currentPrice !== market.currentPrice ? Date.now() : current.meta.lastStreamAt,
        lastError: nextStatus === "error" ? "No se pudo refrescar el mercado." : null,
      },
      currentCoin: market.currentCoin,
      timeframe: market.timeframe,
      availableCoins: market.availableCoins,
      popularCoins: market.popularCoins,
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
    };
  });
}

export function syncMarketDataPlaneActions(actions: ReturnTypeUseMarketData) {
  marketDataPlaneStore.setState((current) => {
    const nextActions = {
      selectCoin: actions.selectCoin,
      selectTimeframe: actions.selectTimeframe,
      refreshMarket: actions.fetchData,
    };

    // Action sync runs often from App. Keep the existing plane object when the
    // handler references are identical so selector consumers do not rerender
    // just because the shell performed another sync pass.
    if (!hasMarketActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncSystemDataPlane(
  binance: ReturnTypeUseBinanceData,
  memoryRuntime: ReturnTypeUseMemoryRuntime,
  validationLabRuntime: ReturnTypeUseValidationLabRuntime,
  watchlist: ReturnTypeUseWatchlist,
  isAuthenticated: boolean,
) {
  systemDataPlaneStore.setState((current) => {
    const nextStatus = isAuthenticated
      ? (
        binance.portfolioData
        || binance.executionCenter
        || binance.dashboardSummary
        || memoryRuntime.strategyRegistry.length
        || memoryRuntime.strategyExperiments.length
        || memoryRuntime.strategyRecommendations.length
        || memoryRuntime.scannerStatus
        || validationLabRuntime.validationReport
        || validationLabRuntime.backtestRuns.length
        || current.snapshot.portfolio
        || current.overlay.execution
        || current.overlay.dashboardSummary
        || watchlist.lists.length
          ? "ready"
          : current.meta.status
      )
      : "idle";

    const nextState = {
      ...current,
      meta: {
        ...current.meta,
        status: nextStatus,
        source: "snapshot" as const,
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
        signalMemory: isAuthenticated ? current.snapshot.signalMemory : [],
        watchlists: isAuthenticated ? watchlist.lists : [],
        activeWatchlistName: isAuthenticated ? watchlist.activeListName : "Principal",
        strategyRegistry: isAuthenticated ? memoryRuntime.strategyRegistry : [],
        strategyVersions: isAuthenticated ? memoryRuntime.strategyVersions : [],
        strategyExperiments: isAuthenticated ? memoryRuntime.strategyExperiments : [],
        strategyRecommendations: isAuthenticated ? memoryRuntime.strategyRecommendations : [],
        strategyDecision: isAuthenticated ? memoryRuntime.strategyDecision : null,
        scannerStatus: isAuthenticated ? memoryRuntime.scannerStatus : null,
        validationReport: isAuthenticated ? validationLabRuntime.validationReport : null,
        backtestRuns: isAuthenticated ? validationLabRuntime.backtestRuns : [],
        backtestQueue: isAuthenticated ? validationLabRuntime.backtestQueue : { pending: 0, running: 0 },
      },
      overlay: {
        execution: isAuthenticated
          ? (binance.executionCenter ?? current.overlay.execution)
          : null,
        dashboardSummary: isAuthenticated
          ? mergeDashboardSummaryPreservingCollections(current.overlay.dashboardSummary, binance.dashboardSummary)
          : null,
      },
      controls: {
        ...current.controls,
        portfolioPeriod: binance.portfolioPeriod,
        hideSmallAssets: binance.hideSmallAssets,
        availableUsers: binance.availableUsers,
        binanceForm: binance.binanceForm,
      },
    };

    // The system plane receives many sync attempts from shared hooks. If the
    // effective payload did not change, keep the exact same object so selector
    // consumers do not rerender just because App ran another sync pass.
    if (!hasSystemPlanePayloadChanged(current, nextState)) {
      return current;
    }

    return nextState;
  });
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
  systemDataPlaneStore.setState((current) => {
    const nextRealtimeCore = {
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
    };

    if (
      current.controls.realtimeCore.configured === nextRealtimeCore.configured
      && current.controls.realtimeCore.preferredMode === nextRealtimeCore.preferredMode
      && current.controls.realtimeCore.activeMode === nextRealtimeCore.activeMode
      && current.controls.realtimeCore.healthy === nextRealtimeCore.healthy
      && current.controls.realtimeCore.targetLabel === nextRealtimeCore.targetLabel
      && current.controls.realtimeCore.serviceMode === nextRealtimeCore.serviceMode
      && current.controls.realtimeCore.activeChannels === nextRealtimeCore.activeChannels
      && current.controls.realtimeCore.activeSubscribers === nextRealtimeCore.activeSubscribers
      && current.controls.realtimeCore.pollIntervalMs === nextRealtimeCore.pollIntervalMs
    ) {
      return current;
    }

    return {
      ...current,
      controls: {
        ...current.controls,
        realtimeCore: nextRealtimeCore,
      },
    };
  });
}

export function syncSystemDataPlaneActions(actions: ReturnTypeUseBinanceData) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      refreshPortfolio: actions.refreshPortfolio,
      refreshPortfolioWithFeedback: actions.refreshPortfolioWithFeedback,
      refreshExecutionCenter: actions.refreshExecutionCenter,
      refreshDashboardSummary: actions.refreshDashboardSummary,
      updateExecutionProfile: actions.updateExecutionProfile,
      executeDemoSignal: actions.executeDemoSignal,
      attachExecutionProtection: actions.attachExecutionProtection,
      refreshProfileDataWithFeedback: actions.refreshProfileDataWithFeedback,
      setHideSmallAssets: actions.setHideSmallAssets,
      setBinanceFormField: actions.setBinanceFormField,
      connectBinance: actions.connect,
      disconnectBinance: actions.disconnect,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncSystemMemoryActions(actions: ReturnTypeUseMemoryRuntime) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      refreshStrategyEngine: actions.refreshStrategyEngine,
      createStrategyExperiment: actions.createStrategyExperiment,
      updateStrategyExperiment: actions.updateStrategyExperiment,
      promoteStrategyExperiment: actions.promoteStrategyExperiment,
      generateStrategyRecommendations: actions.generateStrategyRecommendations,
      activateStrategyRecommendation: actions.activateStrategyRecommendation,
      refreshScannerStatus: actions.refreshScannerStatus,
      runScannerNow: actions.runScannerNow,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncSystemValidationLabActions(actions: ReturnTypeUseValidationLabRuntime) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      refreshValidationLab: actions.refreshValidationLab,
      enqueueValidationBacktest: actions.enqueueValidationBacktest,
      processValidationBacktestQueue: actions.processValidationBacktestQueue,
      backfillValidationDataset: actions.backfillValidationDataset,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncRealtimeCoreActions(actions: { refreshRealtimeCoreStatus: () => Promise<unknown> }) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      refreshRealtimeCoreStatus: actions.refreshRealtimeCoreStatus,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncSystemSignalActions(actions: ReturnTypeUseSignalMemory) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      refreshSignals: actions.refreshSignals,
      updateSignalMemoryEntry: actions.updateSignal,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}

export function syncSystemWatchlistActions(actions: ReturnTypeUseWatchlist) {
  systemDataPlaneStore.setState((current) => {
    const nextActions = {
      ...current.actions,
      toggleWatchlist: actions.toggleWatchlist,
      replaceWatchlistCoins: actions.replaceListCoins,
      createWatchlist: actions.createList,
      renameWatchlist: actions.renameList,
      deleteWatchlist: actions.deleteList,
      setActiveWatchlist: actions.setActiveList,
    };

    if (!hasSystemActionPayloadChanged(current, nextActions)) {
      return current;
    }

    return {
      ...current,
      actions: nextActions,
    };
  });
}
