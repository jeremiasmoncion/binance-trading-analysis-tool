import { useDataPlaneStore, shallowEqualSelection } from "./createDataPlaneStore";
import { marketDataPlaneStore } from "./marketDataPlane";
import { systemDataPlaneStore } from "./systemDataPlane";

export function useDashboardMarketSelector() {
  return useDataPlaneStore(marketDataPlaneStore, (state) => ({
    currentCoin: state.currentCoin,
    timeframe: state.timeframe,
    candles: state.candles,
    currentPrice: state.currentPrice,
    signal: state.signal,
    analysis: state.analysis,
    strategy: state.strategy,
    strategyCandidates: state.strategyCandidates,
    multiTimeframes: state.multiTimeframes,
  }), shallowEqualSelection);
}

export function useDashboardSystemSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    portfolio: state.snapshot.portfolio,
    execution: state.overlay.execution,
    dashboardSummary: state.overlay.dashboardSummary,
  }), shallowEqualSelection);
}

export function useMemorySystemSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    signalMemory: state.snapshot.signalMemory,
    execution: state.overlay.execution,
    watchlists: state.snapshot.watchlists,
    activeWatchlistName: state.snapshot.activeWatchlistName,
    refreshExecutionCenter: state.actions.refreshExecutionCenter,
  }), shallowEqualSelection);
}

export function usePortfolioSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    portfolio: state.snapshot.portfolio,
    portfolioPeriod: state.controls.portfolioPeriod,
    hideSmallAssets: state.controls.hideSmallAssets,
    refreshPortfolio: state.actions.refreshPortfolioWithFeedback,
    refreshPortfolioFull: state.actions.refreshPortfolio,
    setHideSmallAssets: state.actions.setHideSmallAssets,
  }), shallowEqualSelection);
}

export function useStatsSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    portfolio: state.snapshot.portfolio,
    execution: state.overlay.execution,
    signalMemory: state.snapshot.signalMemory,
  }), shallowEqualSelection);
}

export function useMarketSummarySelector() {
  return useDataPlaneStore(marketDataPlaneStore, (state) => ({
    currentCoin: state.currentCoin,
    signal: state.signal,
    indicators: state.indicators,
    market24h: state.market24h,
    support: state.support,
    resistance: state.resistance,
  }), shallowEqualSelection);
}

export function useWatchlistSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    watchlists: state.snapshot.watchlists,
    activeWatchlistName: state.snapshot.activeWatchlistName,
  }), shallowEqualSelection);
}

export function useProfileSystemSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    connection: state.snapshot.connection,
    availableUsers: state.controls.availableUsers,
    binanceForm: state.controls.binanceForm,
    setBinanceFormField: state.actions.setBinanceFormField,
    connectBinance: state.actions.connectBinance,
    disconnectBinance: state.actions.disconnectBinance,
    refreshProfileDataWithFeedback: state.actions.refreshProfileDataWithFeedback,
  }), shallowEqualSelection);
}
