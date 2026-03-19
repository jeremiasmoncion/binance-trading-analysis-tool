import { getSupportResistance } from "../lib/trading";
import { marketDataPlaneStore } from "../data-platform/marketDataPlane";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import type { RealtimeCoreBootstrapPayload } from "./contracts";

export function applyRealtimeCoreBootstrap(bootstrap: RealtimeCoreBootstrapPayload) {
  if (bootstrap.market) {
    const supportResistance = Array.isArray(bootstrap.market.candles) && bootstrap.market.candles.length
      ? getSupportResistance(bootstrap.market.candles)
      : { support: 0, resistance: 0 };
    marketDataPlaneStore.setState((current) => ({
      ...current,
      meta: {
        ...current.meta,
        status: "ready",
        source: "bootstrap",
        lastFullSyncAt: Date.now(),
        lastError: null,
      },
      currentCoin: bootstrap.market?.coin || current.currentCoin,
      timeframe: bootstrap.market?.timeframe || current.timeframe,
      candles: bootstrap.market?.candles || current.candles,
      currentPrice: bootstrap.market?.currentPrice || current.currentPrice,
      indicators: bootstrap.market?.indicators || current.indicators,
      signal: bootstrap.market?.signal || current.signal,
      analysis: bootstrap.market?.analysis || current.analysis,
      strategy: bootstrap.market?.strategy || current.strategy,
      strategyCandidates: bootstrap.market?.strategyCandidates || current.strategyCandidates,
      multiTimeframes: bootstrap.market?.multiTimeframes || current.multiTimeframes,
      support: bootstrap.market?.support || supportResistance.support || current.support,
      resistance: bootstrap.market?.resistance || supportResistance.resistance || current.resistance,
    }));
  }

  systemDataPlaneStore.setState((current) => ({
    ...current,
    meta: {
      ...current.meta,
      status: "ready",
      source: "bootstrap",
      lastFullSyncAt: Date.now(),
      lastError: null,
    },
    snapshot: {
      connection: bootstrap.system.connection,
      portfolio: bootstrap.system.portfolio,
      signalMemory: bootstrap.system.signalMemory,
      watchlists: bootstrap.system.watchlists,
      activeWatchlistName: bootstrap.system.activeWatchlistName,
    },
    overlay: {
      execution: bootstrap.system.execution,
      dashboardSummary: bootstrap.system.dashboardSummary,
    },
    controls: {
      ...current.controls,
      portfolioPeriod: bootstrap.system.controls.portfolioPeriod,
      hideSmallAssets: bootstrap.system.controls.hideSmallAssets,
      availableUsers: bootstrap.system.controls.availableUsers,
    },
  }));
}
