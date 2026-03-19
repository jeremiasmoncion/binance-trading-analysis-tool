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
    portfolio: state.portfolio,
    execution: state.execution,
    dashboardSummary: state.dashboardSummary,
  }), shallowEqualSelection);
}

export function useMemorySystemSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    signalMemory: state.signalMemory,
    execution: state.execution,
    watchlists: state.watchlists,
    activeWatchlistName: state.activeWatchlistName,
  }), shallowEqualSelection);
}

export function usePortfolioSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    portfolio: state.portfolio,
  }), shallowEqualSelection);
}

export function useStatsSelector() {
  return useDataPlaneStore(systemDataPlaneStore, (state) => ({
    portfolio: state.portfolio,
    execution: state.execution,
    signalMemory: state.signalMemory,
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
    watchlists: state.watchlists,
    activeWatchlistName: state.activeWatchlistName,
  }), shallowEqualSelection);
}
