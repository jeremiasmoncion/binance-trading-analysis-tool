export type ViewName =
  | "dashboard"
  | "balance"
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
  sl: number;
  riskPct: number;
  benefitPct: number;
  riskAmt: number;
  benefitAmt: number;
  refCapital: number;
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
  periodChangeValue: number;
  periodChangePct: number;
}

export interface PortfolioTotals {
  period: string;
  totalValue: number;
  periodChangeValue: number;
  periodChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
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
  multiTimeframes: TimeframeSignal[];
  binanceConnection: BinanceConnection | null;
  portfolioData: PortfolioPayload | null;
  portfolioPeriod: string;
  availableUsers: UserSession[];
  comparison: ComparisonCoin[];
  hideSmallAssets: boolean;
}
