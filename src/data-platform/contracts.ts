import type {
  BinanceConnection,
  Candle,
  ComparisonCoin,
  DashboardAnalysis,
  DashboardSummaryPayload,
  ExecutionCenterPayload,
  Indicators,
  PortfolioPayload,
  UserSession,
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
  support: number;
  resistance: number;
}

export interface SystemDataPlane {
  meta: DataPlaneMeta;
  snapshot: {
    connection: BinanceConnection | null;
    portfolio: PortfolioPayload | null;
    signalMemory: SignalSnapshot[];
    watchlists: WatchlistGroup[];
    activeWatchlistName: string;
  };
  overlay: {
    execution: ExecutionCenterPayload | null;
    dashboardSummary: DashboardSummaryPayload | null;
  };
  controls: {
    portfolioPeriod: string;
    hideSmallAssets: boolean;
    availableUsers: UserSession[];
    binanceForm: { alias: string; apiKey: string; apiSecret: string };
    realtimeCore: {
      configured: boolean;
      preferredMode: "external" | "serverless";
      activeMode: "external" | "serverless";
      healthy: boolean;
      lastCheckedAt: number | null;
    };
  };
  actions: {
    refreshSignals: () => Promise<unknown>;
    refreshPortfolio: (period?: string, mode?: "full" | "live") => Promise<unknown>;
    refreshPortfolioWithFeedback: (period?: string, mode?: "full" | "live") => Promise<unknown>;
    refreshExecutionCenter: () => Promise<unknown>;
    refreshDashboardSummary: (forceFresh?: boolean) => Promise<unknown>;
    refreshProfileDataWithFeedback: () => Promise<unknown>;
    setHideSmallAssets: (value: boolean) => void;
    setBinanceFormField: (field: "alias" | "apiKey" | "apiSecret", value: string) => void;
    connectBinance: () => Promise<unknown>;
    disconnectBinance: () => Promise<unknown>;
  };
}

export interface AppDataArchitecturePhase {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  description: string;
}
