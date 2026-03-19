import { createDataPlaneStore, useDataPlaneStore } from "./createDataPlaneStore";
import type { SystemDataPlane } from "./contracts";

const initialSystemDataPlane: SystemDataPlane = {
  meta: {
    status: "idle",
    source: "bootstrap",
    lastFullSyncAt: null,
    lastOverlayAt: null,
    lastStreamAt: null,
    lastError: null,
  },
  snapshot: {
    connection: null,
    portfolio: null,
    signalMemory: [],
    watchlists: [],
    activeWatchlistName: "Principal",
    strategyRegistry: [],
    strategyVersions: [],
    strategyExperiments: [],
    strategyRecommendations: [],
    strategyDecision: null,
    scannerStatus: null,
    validationReport: null,
    backtestRuns: [],
    backtestQueue: {
      pending: 0,
      running: 0,
    },
  },
  overlay: {
    execution: null,
    dashboardSummary: null,
  },
  controls: {
    portfolioPeriod: "1d",
    hideSmallAssets: true,
    availableUsers: [],
    binanceForm: { alias: "", apiKey: "", apiSecret: "" },
    realtimeCore: {
      configured: false,
      preferredMode: "serverless",
      activeMode: "serverless",
      healthy: true,
      lastCheckedAt: null,
      targetLabel: "Vercel interno",
      serviceMode: "serverless-fallback",
      activeChannels: null,
      activeSubscribers: null,
      pollIntervalMs: null,
    },
  },
  actions: {
    refreshSignals: async () => null,
    refreshPortfolio: async () => null,
    refreshPortfolioWithFeedback: async () => null,
    refreshExecutionCenter: async () => null,
    refreshDashboardSummary: async () => null,
    refreshProfileDataWithFeedback: async () => null,
    refreshStrategyEngine: async () => null,
    refreshScannerStatus: async () => null,
    runScannerNow: async () => null,
    refreshValidationLab: async () => null,
    enqueueValidationBacktest: async () => null,
    processValidationBacktestQueue: async () => null,
    backfillValidationDataset: async () => null,
    setHideSmallAssets: () => undefined,
    setBinanceFormField: () => undefined,
    connectBinance: async () => null,
    disconnectBinance: async () => null,
    refreshRealtimeCoreStatus: async () => null,
    toggleWatchlist: async () => undefined,
    replaceWatchlistCoins: async () => undefined,
    createWatchlist: async () => undefined,
    renameWatchlist: async () => undefined,
    deleteWatchlist: async () => undefined,
    setActiveWatchlist: async () => undefined,
  },
};

export const systemDataPlaneStore = createDataPlaneStore(initialSystemDataPlane);

export function useSystemDataPlane<TSelection>(selector: (state: SystemDataPlane) => TSelection) {
  return useDataPlaneStore(systemDataPlaneStore, selector);
}
