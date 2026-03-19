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
    },
  },
  actions: {
    refreshSignals: async () => null,
    refreshPortfolio: async () => null,
    refreshPortfolioWithFeedback: async () => null,
    refreshExecutionCenter: async () => null,
    refreshDashboardSummary: async () => null,
    refreshProfileDataWithFeedback: async () => null,
    setHideSmallAssets: () => undefined,
    setBinanceFormField: () => undefined,
    connectBinance: async () => null,
    disconnectBinance: async () => null,
  },
};

export const systemDataPlaneStore = createDataPlaneStore(initialSystemDataPlane);

export function useSystemDataPlane<TSelection>(selector: (state: SystemDataPlane) => TSelection) {
  return useDataPlaneStore(systemDataPlaneStore, selector);
}
