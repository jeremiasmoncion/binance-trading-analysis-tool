export type BotStatus = "draft" | "active" | "paused" | "archived";

export type BotExecutionEnvironment = "paper" | "demo" | "real";

export type BotAutomationMode = "observe" | "assist" | "auto";

export type BotUniversePolicyKind = "watchlist" | "custom-list" | "hybrid" | "market-filter";

export type BotTradingStyle = "scalping" | "swing" | "long";

export type BotExecutionArbitrationMode = "exclusive" | "priority" | "shared";

export type BotExecutionOverlapMode = "block" | "allow-with-approval" | "allow";

export type BotMemoryLayer = "local" | "family" | "global";
export type BotDecisionAction = "observe" | "accept" | "block" | "assist" | "execute" | "close" | "adjust";
export type BotDecisionSource = "signal-core" | "market-core" | "manual" | "ai-analyst" | "ai-adjuster" | "ai-supervisor";
export type BotDecisionStatus = "pending" | "approved" | "blocked" | "executed" | "dismissed" | "closed";
export type BotSignalLayer = "informative" | "observational" | "operable" | "ai-prioritized";
export type BotPerformanceOrigin = "manual" | "signal" | "bot" | "auto";

export interface BotUniversePolicy {
  kind: BotUniversePolicyKind;
  watchlistIds: string[];
  symbols: string[];
  filters?: {
    quoteAssets?: string[];
    baseAssets?: string[];
    min24hVolumeUsd?: number;
    preferredTimeframes?: string[];
    allowedMarketRegimes?: string[];
  };
}

export interface BotStylePolicy {
  dominantStyle: BotTradingStyle;
  allowedStyles: BotTradingStyle[];
  multiStyleEnabled: boolean;
}

export interface BotTimeframePolicy {
  preferredTimeframes: string[];
  allowedTimeframes: string[];
}

export interface BotStrategyPolicy {
  allowedStrategyIds: string[];
  preferredStrategyIds: string[];
  adaptiveAdjustmentsEnabled: boolean;
}

export interface BotRiskPolicy {
  maxPositionUsd: number;
  maxOpenPositions: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  cooldownAfterLosses: number;
  maxSymbolExposurePct: number;
  realExecutionRequiresApproval: boolean;
}

export interface BotExecutionPolicy {
  canOpenPositions: boolean;
  suggestionsOnly: boolean;
  requiresHumanApproval: boolean;
  autoExecutionEnabled: boolean;
  realExecutionEnabled: boolean;
}

export interface BotAiPolicy {
  analystEnabled: boolean;
  adjusterEnabled: boolean;
  supervisorEnabled: boolean;
  unrestrictedModeEnabled: boolean;
  requiresConfirmationFor: Array<"strategy-change" | "risk-change" | "real-order" | "capital-change">;
  isolationScope: "standard" | "isolated";
}

export interface BotOverlapPolicy {
  observationOverlap: "allow" | "limited" | "exclusive";
  signalOverlap: "allow" | "dedupe-by-origin" | "exclusive";
  executionOverlap: BotExecutionOverlapMode;
  arbitrationMode: BotExecutionArbitrationMode;
  priority: number;
  exclusiveUniverse: boolean;
}

export interface MemorySummary {
  layer: BotMemoryLayer;
  lastUpdatedAt: string | null;
  signalCount: number;
  decisionCount: number;
  outcomeCount: number;
  notes: string[];
}

export interface PerformanceSummary {
  updatedAt: string | null;
  closedSignals: number;
  winRate: number;
  realizedPnlUsd: number;
  avgPnlUsd: number;
  avgHoldMinutes: number | null;
  bestSymbol?: string | null;
  worstSymbol?: string | null;
}

export interface BotCapitalAllocation {
  allocatedUsd: number;
  availableUsd: number;
  accountingScope: string;
}

export interface BotWorkspaceSettings {
  primaryPair: string;
  rangeLower: number | null;
  rangeUpper: number | null;
  gridCount: number | null;
  stopLossPct: number | null;
  takeProfitPct: number | null;
  autoCompoundProfits: boolean;
}

export interface BotAuditSummary {
  lastDecisionAt: string | null;
  lastExecutionAt: string | null;
  lastPolicyChangeAt: string | null;
}

export interface BotDecisionRecord {
  id: string;
  botId: string;
  signalSnapshotId: number | null;
  symbol: string;
  timeframe: string;
  signalLayer: BotSignalLayer;
  action: BotDecisionAction;
  status: BotDecisionStatus;
  source: BotDecisionSource;
  rationale: string;
  executionEnvironment: BotExecutionEnvironment;
  automationMode: BotAutomationMode;
  marketContextSignature: string | null;
  contextTags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BotPerformanceBreakdown {
  origin: BotPerformanceOrigin;
  style: string | null;
  strategyId: string | null;
  timeframe: string | null;
  symbol: string | null;
  marketContext: string | null;
  totalSignals: number;
  closedSignals: number;
  winRate: number;
  realizedPnlUsd: number;
  rrAverage: number | null;
  drawdownPct: number | null;
  profitFactor: number | null;
  positivePct: number | null;
  negativePct: number | null;
}

export interface BotConversationAction {
  id: string;
  botId: string | null;
  threadScope: "platform" | "bot";
  intentLabel: string;
  structuredAction: string;
  requiresConfirmation: boolean;
  approvalStatus: "pending" | "approved" | "rejected" | "executed";
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Bot {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: BotStatus;
  executionEnvironment: BotExecutionEnvironment;
  automationMode: BotAutomationMode;
  capital: BotCapitalAllocation;
  workspaceSettings: BotWorkspaceSettings;
  universePolicy: BotUniversePolicy;
  stylePolicy: BotStylePolicy;
  timeframePolicy: BotTimeframePolicy;
  strategyPolicy: BotStrategyPolicy;
  riskPolicy: BotRiskPolicy;
  executionPolicy: BotExecutionPolicy;
  aiPolicy: BotAiPolicy;
  overlapPolicy: BotOverlapPolicy;
  localMemory: MemorySummary;
  familyMemory: MemorySummary;
  globalMemory: MemorySummary;
  performance: PerformanceSummary;
  audit: BotAuditSummary;
  tags: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface BotRegistryState {
  bots: Bot[];
  selectedBotId: string | null;
  lastHydratedAt: string | null;
}
