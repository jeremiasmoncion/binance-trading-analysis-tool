import { createDataPlaneStore, useDataPlaneStore } from "./createDataPlaneStore";
import type { MarketDataPlane } from "./contracts";

const initialMarketDataPlane: MarketDataPlane = {
  meta: {
    status: "idle",
    source: "bootstrap",
    lastFullSyncAt: null,
    lastOverlayAt: null,
    lastStreamAt: null,
    lastError: null,
  },
  currentCoin: "BTC/USDT",
  timeframe: "1h",
  candles: [],
  currentPrice: 0,
  indicators: null,
  signal: null,
  analysis: null,
  strategy: null,
  strategyCandidates: [],
  multiTimeframes: [],
  comparison: [],
  market24h: {
    change: 0,
    high: 0,
    low: 0,
    volume: "0 BTC",
    updatedAt: "--:--",
  },
};

export const marketDataPlaneStore = createDataPlaneStore(initialMarketDataPlane);

export function useMarketDataPlane<TSelection>(selector: (state: MarketDataPlane) => TSelection) {
  return useDataPlaneStore(marketDataPlaneStore, selector);
}
