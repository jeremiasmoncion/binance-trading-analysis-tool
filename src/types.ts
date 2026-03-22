export type ViewName =
  | "dashboard"
  | "balance"
  | "stats"
  | "signals"
  | "bots"
  | "trading"
  | "control-overview"
  | "control-bot-settings"
  | "control-execution-logs"
  | "ai-signal-bot"
  | "ai-dca-bot"
  | "ai-arbitrage-bot"
  | "ai-pump-screener"
  | "defi-center"
  | "yield-farming"
  | "staking-pools"
  | "liquidity-tracker"
  | "portfolio-tracker"
  | "wallets"
  | "defi-protocols"
  | "strategies-marketplace"
  | "bot-templates"
  | "preferences"
  | "notifications"
  | "security-api-keys"
  | "invite-friends"
  | "subscription"
  | "help-center"
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

export interface StrategyDescriptor {
  id: string;
  version: string;
  label: string;
  description: string;
  category?: string;
  preferredTimeframes: string[];
  tradingStyle: string;
  holdingProfile?: string;
  idealMarketConditions: string[];
  schedulerLabel?: string;
  parameters: Record<string, number | string | boolean>;
}

export interface StrategyRegistryEntry {
  id: number;
  strategy_id: string;
  label: string;
  description?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface StrategyVersionRecord {
  id: number;
  strategy_id: string;
  version: string;
  label: string;
  parameters: Record<string, number | string | boolean>;
  preferred_timeframes?: string[];
  trading_style?: string;
  holding_profile?: string;
  ideal_market_conditions?: string[];
  scheduler_label?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface StrategyExperimentRecord {
  id: number;
  experiment_key: string;
  base_strategy_id: string;
  candidate_strategy_id: string;
  candidate_version: string;
  market_scope?: string;
  timeframe_scope?: string;
  status: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface StrategyRecommendationRecord {
  id: number;
  recommendation_key: string;
  strategy_id: string;
  strategy_version: string;
  parameter_key: string;
  title: string;
  summary?: string;
  current_value?: number;
  suggested_value?: number;
  confidence?: number;
  status: string;
  evidence?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface StrategyDecisionState {
  username?: string;
  scorerPolicy?: {
    activeScorer?: string;
    promotedAt?: string;
    source?: string;
    confidence?: number;
  };
  activeStrategyByScope: Array<{
    strategyId: string;
    version: string;
    label?: string;
    status?: string;
    marketScope?: string;
    timeframeScope?: string;
  }>;
  promotedVersionByStrategy: Record<string, string>;
  sandboxExperimentsByScope: Array<{
    id: number;
    baseStrategyId: string;
    baseVersion?: string;
    candidateStrategyId: string;
    candidateVersion: string;
    marketScope?: string;
    timeframeScope?: string;
    status?: string;
    executionAllowed?: boolean;
    candidateRunnable?: boolean;
    metadata?: Record<string, unknown>;
  }>;
  executionEligibleScopes: Array<{
    experimentId: number;
    strategyId: string;
    version: string;
    marketScope?: string;
    timeframeScope?: string;
  }>;
  adaptivePrimaryByScope?: Array<{
    timeframe: string;
    strategyId: string;
    version: string;
    sampleSize: number;
    winRate: number;
    pnl: number;
    avgPnl: number;
    avgScore: number;
    avgRr: number;
    confidence: number;
    edgeScore: number;
    leadOverNext?: number | null;
  }>;
  contextBiasByScope?: Array<{
    strategyId: string;
    version: string;
    timeframe: string;
    marketRegime: string;
    direction: string;
    volumeCondition: string;
    sampleSize: number;
    winRate: number;
    pnl: number;
    avgPnl: number;
    avgScore: number;
    avgRr: number;
    biasScore: number;
  }>;
  featureModelByScope?: Array<{
    strategyId: string;
    version: string;
    timeframe: string;
    marketRegime: string;
    direction: string;
    volumeCondition: string;
    sampleSize: number;
    winRate: number;
    pnl: number;
    avgPnl: number;
    avgAdaptiveScore: number;
    avgRr: number;
    avgDurationMinutes: number;
    modelScore: number;
    modelV1Score?: number;
    modelV2Score?: number;
    modelV3Score?: number;
    modelV4Score?: number;
    preferredModel?: string;
    preferredModelConfidence?: number;
    confidence: number;
  }>;
  modelRegistry?: Array<{
    label: string;
    mode: "static" | "learned";
    windowType?: "recent" | "global" | "short";
    active?: boolean;
    ready?: boolean;
    sampleSize: number;
    confidence: number;
    avgPnl: number;
    winRate: number;
    rrWeight?: number;
    adaptiveScoreWeight?: number;
    durationPenaltyWeight?: number;
    reading?: string;
    status?: string;
    source?: string;
    updatedAt?: string;
    createdAt?: string;
  }>;
  modelConfigRegistry?: Array<{
    id?: number;
    label: string;
    mode: "static" | "learned";
    windowType?: "recent" | "global" | "short";
    active?: boolean;
    ready?: boolean;
    sampleSize: number;
    confidence: number;
    avgPnl: number;
    winRate: number;
    rrWeight?: number;
    adaptiveScoreWeight?: number;
    durationPenaltyWeight?: number;
    reading?: string;
    status?: string;
    source?: string;
    updatedAt?: string;
    createdAt?: string;
  }>;
  modelTrainingRunHistory?: Array<{
    id?: number;
    label: string;
    windowType: "recent" | "global" | "short";
    mode: "static" | "learned";
    sampleSize: number;
    confidence: number;
    avgPnl: number;
    winRate: number;
    rrWeight?: number;
    adaptiveScoreWeight?: number;
    durationPenaltyWeight?: number;
    summary: string;
    status?: string;
    createdAt?: string;
  }>;
  modelConfigHistory?: Array<{
    id?: number;
    activeScorer: string;
    source?: string;
    confidence?: number;
    summary?: string;
    createdAt?: string;
    status?: string;
  }>;
  modelWindowGovernanceHistory?: Array<{
    id?: number;
    activeScorer: string;
    candidateScorer: string;
    challengerMode?: string;
    alignedWindows: number;
    conflictingWindows: number;
    confidence: number;
    action: "observe" | "sandbox" | "promote" | "rollback";
    summary: string;
    windowVotes?: Array<{
      windowType: "recent" | "global" | "short";
      vote: "observe" | "promote" | "keep";
      sampleSize: number;
      edgeDelta: number;
      winRateDelta: number;
      confidence: number;
    }>;
    createdAt?: string;
  }>;
  scorerEvaluations?: Array<{
    scorer: string;
    challenger: string;
    active: boolean;
    windowType: "recent" | "global" | "short";
    sampleSize: number;
    challengerSampleSize: number;
    avgPnl: number;
    challengerAvgPnl: number;
    winRate: number;
    challengerWinRate: number;
    pnl: number;
    challengerPnl: number;
    edgeDelta: number;
    winRateDelta: number;
    confidence: number;
    action: "keep" | "promote" | "rollback" | "observe";
    readiness: "low" | "medium" | "high";
    summary: string;
  }>;
  shadowModelEvaluation?: {
    candidateScorer: string;
    activeScorer: string;
    readySampleSize: number;
    favorableSampleSize: number;
    nonFavorableSampleSize: number;
    favorableAvgPnl: number;
    nonFavorableAvgPnl: number;
    favorableWinRate: number;
    nonFavorableWinRate: number;
    confidence: number;
    action: "observe" | "promote";
    summary: string;
  } | null;
  modelWindowGovernance?: {
    activeScorer: string;
    candidateScorer: string;
    challengerMode?: "static" | "learned";
    alignedWindows: number;
    conflictingWindows: number;
    confidence: number;
    action: "observe" | "sandbox" | "promote" | "rollback";
    summary: string;
    windowVotes: Array<{
      windowType: "recent" | "global" | "short";
      activeAvgPnl: number;
      candidateAvgPnl: number;
      activeWinRate: number;
      candidateWinRate: number;
      edgeDelta: number;
      winRateDelta: number;
      sampleSize: number;
      confidence: number;
      vote: "observe" | "promote" | "keep";
      candidateReady?: boolean;
    }>;
  } | null;
  scorerEvaluationHistory?: Array<{
    id?: number;
    scorer: string;
    challenger: string;
    windowType: "recent" | "global" | "short";
    action: "keep" | "promote" | "rollback" | "observe";
    readiness: "low" | "medium" | "high";
    confidence: number;
    avgPnl: number;
    challengerAvgPnl: number;
    edgeDelta: number;
    summary: string;
    source?: string;
    status?: string;
    createdAt?: string;
  }>;
}

export interface StrategyValidationInvariant {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface StrategyValidationScorerRow {
  label: string;
  total: number;
  avgPnl: number;
  pnl: number;
  winRate: number;
  active: boolean;
}

export interface StrategyValidationReplayWindow {
  label: "Short" | "Recent" | "Global";
  key: "short" | "recent" | "global";
  total: number;
  activeScorer: string;
  challengerScorer: string;
  activeAvgPnl: number;
  challengerAvgPnl: number;
  activeWinRate: number;
  challengerWinRate: number;
  verdict: string;
}

export interface StrategyValidationScenario {
  title: string;
  status: "good" | "warning" | "neutral";
  summary: string;
}

export interface StrategyValidationReport {
  generatedAt: string;
  summary: {
    maturityScore: number;
    closedSignals: number;
    featureSnapshots: number;
    passedInvariants: number;
    warnedInvariants: number;
    failedInvariants: number;
    activeScorer: string;
  };
  invariants: StrategyValidationInvariant[];
  scorerTable: StrategyValidationScorerRow[];
  replayWindows: StrategyValidationReplayWindow[];
  scenarios: StrategyValidationScenario[];
  modelWindowGovernance: StrategyDecisionState["modelWindowGovernance"];
  modelWindowGovernanceHistory: NonNullable<StrategyDecisionState["modelWindowGovernanceHistory"]>;
}

export interface StrategyBacktestRun {
  id?: number;
  username?: string;
  label: string;
  triggerSource: string;
  activeScorer: string;
  maturityScore: number;
  closedSignals: number;
  featureSnapshots: number;
  passedInvariants: number;
  warnedInvariants: number;
  failedInvariants: number;
  summary: string;
  status?: "queued" | "running" | "completed";
  createdAt?: string;
  windows: StrategyValidationReplayWindow[];
}

export interface StrategyValidationLabPayload {
  report: StrategyValidationReport;
  runs: StrategyBacktestRun[];
  run?: StrategyBacktestRun | null;
  processed?: StrategyBacktestRun[];
  queue?: {
    pending: number;
    running: number;
  };
  backfill?: {
    scannedClosedSignals: number;
    executionLearningBackfilled: number;
    featureSnapshotsBackfilled: number;
  };
}

export interface RecommendationActivationResult {
  recommendation: StrategyRecommendationRecord;
  version?: StrategyVersionRecord | null;
  experiment?: StrategyExperimentRecord | null;
  profile?: ExecutionProfile | null;
  activationMode?: "strategy-experiment" | "execution-scope-override" | "scorer-promotion";
}

export interface StrategyCandidate {
  strategy: StrategyDescriptor;
  signal: Signal;
  analysis: DashboardAnalysis;
  rankScore: number;
  isPrimary?: boolean;
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

export interface AdaptiveScorerBreakdown {
  label?: string;
  baseScore?: number;
  adaptivePrimaryBias?: number;
  contextualBias?: number;
  modelBias?: number;
  scopeBias?: number;
  promotionBias?: number;
  finalScore?: number;
  confidence?: number;
  usedAdaptivePrimary?: boolean;
  usedContextBias?: boolean;
  usedFeatureModel?: boolean;
  promotedModel?: boolean;
  scopeAction?: string;
  candidateLabel?: string;
  candidateFinalScore?: number;
  candidateConfidence?: number;
  candidateModelBias?: number;
  candidateDelta?: number;
  candidateReady?: boolean;
  candidateMode?: "static" | "learned";
}

export type SignalOutcomeStatus = "pending" | "win" | "loss" | "invalidated";

export interface SignalSnapshot {
  id: number;
  coin: string;
  timeframe: string;
  strategy_name?: string;
  strategy_version?: string;
  strategy_label?: string;
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
  execution_order_id?: number;
  execution_status?: string;
  execution_mode?: string;
  execution_updated_at?: string;
  created_at: string;
  updated_at?: string;
  signal_payload?: {
    strategy?: StrategyDescriptor;
    candidates?: Array<{
      strategy: StrategyDescriptor;
      signalLabel: string;
      score: number;
      setupType?: string;
      setupQuality?: string;
      riskLabel?: string;
      rankScore?: number;
      isPrimary?: boolean;
      decisionSource?: string;
      experimentId?: number | null;
      executionEligible?: boolean;
    }>;
    signal?: Signal;
    analysis?: DashboardAnalysis;
    plan?: OperationPlan;
    multiTimeframes?: TimeframeSignal[];
    decision?: {
      marketScope?: string;
      timeframeScope?: string;
      source?: string;
      executionEligible?: boolean;
      executionReason?: string;
      primaryStrategy?: StrategyDescriptor;
      primaryExperimentId?: number | null;
      adaptiveScore?: number | null;
      scorer?: AdaptiveScorerBreakdown | null;
      contextBias?: {
        strategyId?: string;
        version?: string;
        timeframe?: string;
        marketRegime?: string;
        direction?: string;
        volumeCondition?: string;
        sampleSize?: number;
        winRate?: number;
        pnl?: number;
        avgPnl?: number;
        avgScore?: number;
        avgRr?: number;
        biasScore?: number;
      } | null;
      activeStrategies?: Array<{
        strategyId: string;
        version: string;
        label?: string;
        status?: string;
      }>;
      sandboxExperimentIds?: number[];
    };
    context?: {
      direction?: string;
      marketRegime?: string;
      timeframeBias?: string;
      volumeCondition?: string;
      levelContext?: string;
      alignmentScore?: number;
      contextSignature?: string;
    };
    executionLearning?: {
      updatedAt?: string;
      origin?: string;
      mode?: string;
      lifecycleStatus?: string;
      protectionStatus?: string;
      protectionMode?: string;
      protectionAttached?: boolean;
      protectionRetries?: number;
      orderSide?: string;
      notionalUsd?: number;
      quantity?: number;
      realizedPnl?: number;
      pnlPctOnNotional?: number;
      durationMinutes?: number;
      closeDetectedAt?: string | null;
      rrRatio?: number;
      score?: number;
      direction?: string;
      marketRegime?: string;
      timeframeBias?: string;
      volumeCondition?: string;
      levelContext?: string;
      alignmentScore?: number;
      contextSignature?: string;
      decisionSource?: string;
      decisionEligible?: boolean;
      primaryStrategyId?: string;
      primaryStrategyVersion?: string;
      timeframe?: string;
      coin?: string;
      entryToTpPct?: number;
      entryToSlPct?: number;
    };
  };
}

export interface WatchlistGroup {
  name: string;
  coins: string[];
  isActive: boolean;
}

export interface WatchlistScanRun {
  id: number;
  username: string;
  active_list_name?: string;
  scan_source: string;
  coins_count: number;
  frames_scanned: number;
  signals_created: number;
  signals_closed: number;
  status: string;
  errors?: string[];
  created_at: string;
  auto_orders_placed?: number;
  auto_orders_blocked?: number;
  auto_orders_skipped?: number;
  auto_execution_cooldown_until?: string | null;
}

export interface WatchlistScannerStatus {
  username?: string | null;
  targets: Array<{
    username: string;
    activeListName: string;
    coinsCount: number;
    coins: string[];
  }>;
  latestRun: WatchlistScanRun | null;
  latestSchedulerRun?: WatchlistScanRun | null;
  runs: WatchlistScanRun[];
  summary: {
    watchedUsers: number;
    watchedCoins: number;
    schedulerRuns?: number;
    autoExecutionCooldownUntil?: string | null;
    autoExecutionCooldownActive?: boolean;
    autoExecutionCooldownReason?: string;
  };
}

export interface WatchlistScanExecution {
  mode: "manual" | "scheduler";
  targets: Array<{
    username: string;
    activeListName: string;
    coinsCount: number;
    scannedFrames: number;
    signalsCreated: number;
    signalsClosed: number;
    autoOrdersPlaced: number;
    autoOrdersBlocked: number;
    autoOrdersSkipped?: number;
    errors: string[];
    runPersistError?: string | null;
    autoExecutionCooldownUntil?: string | null;
  }>;
  summary: {
    users: number;
    signalsCreated: number;
    signalsClosed: number;
    autoOrdersPlaced: number;
    autoOrdersBlocked: number;
    framesScanned: number;
    runPersistErrors?: string[];
  };
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
  snapshotMode?: "full" | "live";
  summary?: BinanceSummary;
  portfolio?: PortfolioTotals;
  assets: PortfolioAsset[];
  hiddenLockedAssets?: PortfolioAsset[];
  accountMovements?: BinanceAccountMovement[];
  openOrders?: BinanceOrderSummary[];
  recentOrders?: BinanceOrderSummary[];
  recentTrades?: BinanceTradeSummary[];
}

export interface BinanceOrderSummary {
  orderId?: number;
  clientOrderId?: string;
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
  originLabel?: string;
  sourceType?: "signals-auto" | "signals-manual" | "manual-user";
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
  originLabel?: string;
  sourceType?: "signals-auto" | "signals-manual" | "manual-user";
}

export interface BinanceAccountMovement {
  id: string;
  type: "deposit" | "withdrawal";
  asset: string;
  amount: number;
  estimatedUsdValue?: number;
  status: string;
  time: number;
  network?: string;
  address?: string;
  txId?: string;
}

export interface ExecutionProfile {
  username: string;
  enabled: boolean;
  autoExecuteEnabled: boolean;
  riskPerTradePct: number;
  maxOpenPositions: number;
  maxPositionUsd: number;
  maxDailyLossPct: number;
  minSignalScore: number;
  minRrRatio: number;
  maxDailyAutoExecutions: number;
  cooldownAfterLosses: number;
  allowedStrategies: string[];
  allowedTimeframes: string[];
  scopeOverrides?: ExecutionScopeOverride[];
  scorerPolicy?: {
    activeScorer?: string;
    promotedAt?: string;
    source?: string;
    confidence?: number;
  };
  note?: string;
  updatedAt?: string | null;
}

export interface ExecutionScopeOverride {
  id: string;
  strategyId: string;
  timeframe: string;
  enabled: boolean;
  action?: string;
  minSignalScore?: number;
  minRrRatio?: number;
  note?: string;
}

export interface ExecutionCandidate {
  signalId: number;
  coin: string;
  symbol: string;
  timeframe: string;
  strategyName: string;
  strategyVersion: string;
  signalLabel: string;
  score: number;
  baseScore?: number;
  adaptiveScore?: number | null;
  scorer?: AdaptiveScorerBreakdown | null;
  rrRatio: number;
  decisionSource?: string;
  decisionExperimentId?: number | null;
  profileOverride?: {
    strategyId: string;
    timeframe: string;
    minSignalScore: number;
    minRrRatio: number;
    action?: string;
    note?: string;
  } | null;
  side: "BUY" | "SELL" | "";
  currentPrice: number;
  qty: number;
  notionalUsd: number;
  status: "eligible" | "blocked";
  reasons: string[];
  plan: {
    entry: number;
    tp: number;
    tp2: number;
    sl: number;
  };
}

export interface ExecutionOrderRecord {
  id: number;
  username: string;
  signal_id?: number;
  coin: string;
  timeframe?: string;
  strategy_name?: string;
  strategy_version?: string;
  side?: string;
  quantity?: number;
  notional_usd?: number;
  current_price?: number;
  mode: string;
  status: string;
  order_id?: number;
  client_order_id?: string;
  origin?: string;
  lifecycle_status?: string;
  protection_status?: string;
  signal_outcome_status?: SignalOutcomeStatus;
  realized_pnl?: number;
  linked_order_ids?: Record<string, unknown>;
  last_synced_at?: string;
  closed_at?: string;
  notes?: string;
  response_payload?: Record<string, unknown> & {
    botContext?: {
      botId?: string | null;
      botName?: string | null;
    };
    learning_snapshot?: {
      updatedAt?: string;
      origin?: string;
      mode?: string;
      lifecycleStatus?: string;
      protectionStatus?: string;
      protectionMode?: string;
      protectionAttached?: boolean;
      protectionRetries?: number;
      orderSide?: string;
      notionalUsd?: number;
      quantity?: number;
      realizedPnl?: number;
      pnlPctOnNotional?: number;
      durationMinutes?: number;
      closeDetectedAt?: string | null;
      rrRatio?: number;
      score?: number;
      direction?: string;
      marketRegime?: string;
      timeframeBias?: string;
      volumeCondition?: string;
      levelContext?: string;
      alignmentScore?: number;
      contextSignature?: string;
      decisionSource?: string;
      decisionEligible?: boolean;
      primaryStrategyId?: string;
      primaryStrategyVersion?: string;
      timeframe?: string;
      coin?: string;
      entryToTpPct?: number;
      entryToSlPct?: number;
    };
  };
  created_at: string;
}

export interface ExecutionCenterPayload {
  profile: ExecutionProfile;
  account: {
    connected: boolean;
    alias?: string;
    cashValue: number;
    totalValue: number;
    openOrdersCount: number;
    dailyLossPct: number;
    dailyAutoExecutions?: number;
    recentLossStreak?: number;
    autoExecutionRemaining?: number;
  };
  candidates: ExecutionCandidate[];
  recentOrders: ExecutionOrderRecord[];
}

export interface DashboardSummaryPayload {
  generatedAt: string;
  connection: {
    connected: boolean;
    accountAlias?: string;
  };
  connectionIssue?: string;
  portfolio: PortfolioTotals;
  topAssets: PortfolioAsset[];
  execution: {
    profileEnabled: boolean;
    activeBots: number;
    totalBots: number;
    openOrdersCount: number;
    dailyLossPct: number;
    dailyAutoExecutions?: number;
    recentLossStreak?: number;
    autoExecutionRemaining?: number;
    eligibleCount: number;
    blockedCount: number;
    recentOrders: ExecutionOrderRecord[];
  };
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
