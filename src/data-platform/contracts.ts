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
  StrategyDecisionState,
  StrategyDescriptor,
  StrategyExperimentRecord,
  StrategyRecommendationRecord,
  StrategyRegistryEntry,
  StrategyVersionRecord,
  TimeframeSignal,
  WatchlistGroup,
  WatchlistScanExecution,
  WatchlistScannerStatus,
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
    strategyRegistry: StrategyRegistryEntry[];
    strategyVersions: StrategyVersionRecord[];
    strategyExperiments: StrategyExperimentRecord[];
    strategyRecommendations: StrategyRecommendationRecord[];
    strategyDecision: StrategyDecisionState | null;
    scannerStatus: WatchlistScannerStatus | null;
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
      targetLabel: string;
      serviceMode: string | null;
      activeChannels: number | null;
      activeSubscribers: number | null;
      pollIntervalMs: number | null;
    };
  };
  actions: {
    refreshSignals: () => Promise<unknown>;
    refreshPortfolio: (period?: string, mode?: "full" | "live") => Promise<unknown>;
    refreshPortfolioWithFeedback: (period?: string, mode?: "full" | "live") => Promise<unknown>;
    refreshExecutionCenter: () => Promise<unknown>;
    refreshDashboardSummary: (forceFresh?: boolean) => Promise<unknown>;
    refreshProfileDataWithFeedback: () => Promise<unknown>;
    refreshStrategyEngine: (options?: { forceFresh?: boolean; clearOnError?: boolean }) => Promise<unknown>;
    refreshScannerStatus: (options?: { forceFresh?: boolean; clearOnError?: boolean }) => Promise<unknown>;
    runScannerNow: () => Promise<WatchlistScanExecution | null>;
    setHideSmallAssets: (value: boolean) => void;
    setBinanceFormField: (field: "alias" | "apiKey" | "apiSecret", value: string) => void;
    connectBinance: () => Promise<unknown>;
    disconnectBinance: () => Promise<unknown>;
    refreshRealtimeCoreStatus: () => Promise<unknown>;
    toggleWatchlist: (coin: string) => Promise<void>;
    replaceWatchlistCoins: (name: string, coins: string[]) => Promise<void>;
    createWatchlist: (name: string) => Promise<void>;
    renameWatchlist: (name: string, nextName: string) => Promise<void>;
    deleteWatchlist: (name: string) => Promise<void>;
    setActiveWatchlist: (name: string) => Promise<void>;
  };
}

export interface AppDataArchitecturePhase {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  description: string;
}
