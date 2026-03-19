import type {
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
  UserSession,
  WatchlistGroup,
  Candle,
} from "../types";

export type RealtimeCoreChannel = "market" | "system" | "control";

export type RealtimeCoreEventType =
  | "market.snapshot.updated"
  | "market.tick.received"
  | "system.snapshot.updated"
  | "system.overlay.updated"
  | "system.control.updated"
  | "system.heartbeat";

export interface RealtimeCoreMarketBootstrap {
  coin: string;
  timeframe: string;
  candles: Candle[];
  currentPrice: number;
  indicators: Indicators | null;
  signal: Signal | null;
  analysis: DashboardAnalysis | null;
  strategy: StrategyDescriptor | null;
  strategyCandidates: StrategyCandidate[];
  multiTimeframes: TimeframeSignal[];
  support: number;
  resistance: number;
}

export interface RealtimeCoreSystemBootstrap {
  connection: import("../types").BinanceConnection | null;
  portfolio: PortfolioPayload | null;
  execution: ExecutionCenterPayload | null;
  dashboardSummary: DashboardSummaryPayload | null;
  signalMemory: SignalSnapshot[];
  watchlists: WatchlistGroup[];
  activeWatchlistName: string;
  controls: {
    portfolioPeriod: string;
    hideSmallAssets: boolean;
    availableUsers: UserSession[];
  };
}

export interface RealtimeCoreSystemOverlayPayload {
  connection: import("../types").BinanceConnection | null;
  portfolio: PortfolioPayload | null;
  execution: ExecutionCenterPayload | null;
  dashboardSummary: DashboardSummaryPayload | null;
}

export interface RealtimeCoreHeartbeatPayload {
  connected: boolean;
  generatedAt: string;
}

export interface RealtimeCoreHealthPayload {
  ok: boolean;
  service: string;
  mode?: string;
  now: string;
  activeChannels?: number;
  activeSubscribers?: number;
  pollIntervalMs?: number;
}

export interface RealtimeCoreBootstrapPayload {
  version: number;
  generatedAt: string;
  market: RealtimeCoreMarketBootstrap | null;
  system: RealtimeCoreSystemBootstrap;
}

export interface RealtimeCoreEventEnvelope<TPayload = unknown> {
  id: string;
  channel: RealtimeCoreChannel;
  type: RealtimeCoreEventType;
  createdAt: string;
  payload: TPayload;
}
