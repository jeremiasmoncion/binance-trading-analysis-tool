import type {
  BinanceConnection,
  Candle,
  ComparisonCoin,
  DashboardAnalysis,
  DashboardSummaryPayload,
  ExecutionCenterPayload,
  Indicators,
  PortfolioPayload,
  Signal,
  SignalSnapshot,
  StrategyCandidate,
  StrategyDescriptor,
  TimeframeSignal,
  WatchlistGroup,
} from "../types";

export type DataPlaneStatus = "idle" | "loading" | "ready" | "degraded" | "error";

export type DataPlaneSource = "bootstrap" | "snapshot" | "stream" | "overlay" | "manual";

export interface DataPlaneMeta {
  status: DataPlaneStatus;
  source: DataPlaneSource;
  lastFullSyncAt: number | null;
  lastOverlayAt: number | null;
  lastStreamAt: number | null;
  lastError: string | null;
}

export interface MarketDataPlane {
  meta: DataPlaneMeta;
  currentCoin: string;
  timeframe: string;
  candles: Candle[];
  currentPrice: number;
  indicators: Indicators | null;
  signal: Signal | null;
  analysis: DashboardAnalysis | null;
  strategy: StrategyDescriptor | null;
  strategyCandidates: StrategyCandidate[];
  multiTimeframes: TimeframeSignal[];
  comparison: ComparisonCoin[];
  market24h: {
    change: number;
    high: number;
    low: number;
    volume: string;
    updatedAt: string;
  };
}

export interface SystemDataPlane {
  meta: DataPlaneMeta;
  connection: BinanceConnection | null;
  portfolio: PortfolioPayload | null;
  execution: ExecutionCenterPayload | null;
  dashboardSummary: DashboardSummaryPayload | null;
  signalMemory: SignalSnapshot[];
  watchlists: WatchlistGroup[];
  activeWatchlistName: string;
}

export interface AppDataArchitecturePhase {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  description: string;
}
