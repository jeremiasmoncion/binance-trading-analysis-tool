export type ViewName =
  | "dashboard"
  | "balance"
  | "memory"
  | "market"
  | "calculator"
  | "compare"
  | "learn"
  | "profile";

export type AuthMode = "login" | "register";

export type Role = "admin" | "generic";

export interface UserSession {
  username: string;
  displayName?: string;
  role: Role;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  sma20: number;
  sma50: number;
  rsi: number;
  macd: string;
  current: number;
}

export interface Signal {
  score: number;
  trend: string;
  label: string;
  title: string;
  reasons: string[];
}

export interface OperationPlan {
  entry: number;
  tp: number;
  tp2?: number;
  sl: number;
  riskPct: number;
  benefitPct: number;
  riskAmt: number;
  benefitAmt: number;
  refCapital: number;
  rrRatio?: number;
  setupBias?: string;
  invalidation?: number;
}

export interface ComparisonCoin {
  symbol: string;
  price: number;
  change: number;
  impulse: string;
}

export interface TimeframeSignal {
  timeframe: string;
  label: string;
  note: string;
  trend?: string;
  score?: number;
  aligned?: boolean;
}

export interface DashboardAnalysis {
  alignmentCount: number;
  alignmentTotal: number;
  alignmentPct: number;
  alignmentLabel: string;
  higherTimeframeBias: string;
  support: number;
  resistance: number;
  supportDistancePct: number;
  resistanceDistancePct: number;
  rangePositionPct: number;
  volatilityPct: number;
  volatilityLabel: string;
  volumeRatio: number;
  volumeLabel: string;
  setupType: string;
  setupQuality: string;
  riskLabel: string;
  confirmations: string[];
  warnings: string[];
}

export type SignalOutcomeStatus = "pending" | "win" | "loss" | "invalidated";

export interface SignalSnapshot {
  id: number;
  coin: string;
  timeframe: string;
  signal_label: string;
  signal_score: number;
  trend?: string;
  setup_type?: string;
  setup_quality?: string;
  risk_label?: string;
  support?: number;
  resistance?: number;
  entry_price?: number;
  tp_price?: number;
  tp2_price?: number;
  sl_price?: number;
  rr_ratio?: number;
  confirmations_count?: number;
  warnings_count?: number;
  outcome_status: SignalOutcomeStatus;
  outcome_pnl: number;
  note?: string;
  created_at: string;
  updated_at?: string;
  signal_payload?: {
    signal?: Signal;
    analysis?: DashboardAnalysis;
    plan?: OperationPlan;
    multiTimeframes?: TimeframeSignal[];
    context?: {
      direction?: string;
      marketRegime?: string;
      timeframeBias?: string;
      volumeCondition?: string;
      levelContext?: string;
      alignmentScore?: number;
      contextSignature?: string;
    };
  };
}

export interface WatchlistGroup {
  name: string;
  coins: string[];
  isActive: boolean;
}

export interface BinanceSummary {
  uid?: string | number;
  accountType?: string;
  permissions?: string[];
  openOrdersCount?: number;
}

export interface BinanceConnection {
  connected: boolean;
  maskedApiKey?: string;
  accountAlias?: string;
  summary?: BinanceSummary;
}

export interface PortfolioAsset {
  asset: string;
  symbol: string;
  quantity: number;
  free: number;
  locked: number;
  currentPrice: number;
  avgEntryPrice: number;
  tradeCount: number;
  marketValue: number;
  investedValue: number;
  pnlValue: number;
  pnlPct: number;
  realizedPnl: number;
  periodChangeValue: number;
  periodChangePct: number;
}

export interface PortfolioTotals {
  period: string;
  totalValue: number;
  periodChangeValue: number;
  periodChangePct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  totalPnl: number;
  winnersCount: number;
  openPositionsCount: number;
  cashValue: number;
  positionsValue: number;
  investedValue: number;
  updatedAt?: string;
  hiddenLockedValue?: number;
  hiddenLockedAssetsCount?: number;
}

export interface PortfolioPayload {
  summary?: BinanceSummary;
  portfolio?: PortfolioTotals;
  assets: PortfolioAsset[];
  openOrders?: BinanceOrderSummary[];
  recentOrders?: BinanceOrderSummary[];
  recentTrades?: BinanceTradeSummary[];
}

export interface BinanceOrderSummary {
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  status: string;
  price: number;
  stopPrice: number;
  origQty: number;
  executedQty: number;
  quoteQty: number;
  time: number;
  updateTime: number;
}

export interface BinanceTradeSummary {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  value: number;
  commission: number;
  commissionAsset: string;
  time: number;
  orderId?: number;
  realizedPnl?: number;
}

export interface AppState {
  currentUser: UserSession | null;
  currentView: ViewName;
  authMode: AuthMode;
  currentCoin: string;
  timeframe: string;
  candles: Candle[];
  indicators: Indicators | null;
  signal: Signal | null;
  plan: OperationPlan | null;
  analysis?: DashboardAnalysis | null;
  multiTimeframes: TimeframeSignal[];
  binanceConnection: BinanceConnection | null;
  portfolioData: PortfolioPayload | null;
  portfolioPeriod: string;
  availableUsers: UserSession[];
  comparison: ComparisonCoin[];
  hideSmallAssets: boolean;
  signalMemory?: SignalSnapshot[];
}
