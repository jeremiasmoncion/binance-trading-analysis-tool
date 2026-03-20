import type { BotAutomationMode, BotExecutionEnvironment, BotTradingStyle } from "../bots/contracts";

export type SignalOrigin = "system" | "watchlist" | "market" | "user";

export type SignalLayer =
  | "system-signal"
  | "published-signal"
  | "bot-consumable-signal"
  | "execution-candidate";

export type SignalFeedKind = "watchlist" | "market-wide" | "bot-specific" | "high-confidence" | "style-specific";

export type SignalRankTier = "high-confidence" | "priority" | "standard" | "low-visibility";
export type SignalRankLane = "watchlist-first" | "market-discovery";

export interface SignalContextSnapshot {
  symbol: string;
  timeframe: string;
  score: number;
  strategyId: string;
  strategyVersion?: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  marketRegime?: string;
  source: SignalOrigin;
  observedAt: string;
}

export interface SystemSignal {
  id: string;
  layer: "system-signal";
  context: SignalContextSnapshot;
  reasons: string[];
  rankHint: number;
}

export interface PublishedSignal {
  id: string;
  layer: "published-signal";
  context: SignalContextSnapshot;
  reasons: string[];
  audience: "watchlist" | "market";
  visibilityScore: number;
  feedKinds: SignalFeedKind[];
}

export interface RankedPublishedSignal extends PublishedSignal {
  ranking: {
    rawScore: number;
    compositeScore: number;
    delta: number;
    tier: SignalRankTier;
    lane: SignalRankLane;
    movement: "promoted" | "steady" | "demoted";
    primaryReason: string;
    summary: string;
    boosts: string[];
    penalties: string[];
    rationale: string[];
  };
}

export interface BotConsumableSignal {
  id: string;
  layer: "bot-consumable-signal";
  context: SignalContextSnapshot;
  reasons: string[];
  botId: string;
  acceptedByPolicy: boolean;
  policyMatches: {
    universe: boolean;
    timeframe: boolean;
    strategy: boolean;
  };
  policyNotes: string[];
  styleAffinity: BotTradingStyle[];
  requiredAutomationMode: BotAutomationMode;
  allowedEnvironments: BotExecutionEnvironment[];
}

export interface SignalExecutionCandidate {
  id: string;
  layer: "execution-candidate";
  botId?: string;
  signalId: string;
  symbol: string;
  timeframe: string;
  score: number;
  side: "BUY" | "SELL";
  policyStatus: "eligible" | "blocked";
  reasons: string[];
}

export interface OperationalSignalCandidate {
  id: string;
  layer: "execution-candidate";
  signalId: number;
  symbol: string;
  timeframe: string;
  strategyId: string;
  strategyVersion?: string;
  side: "BUY" | "SELL" | "";
  score: number;
  rrRatio: number;
  status: "eligible" | "blocked";
  reasons: string[];
}

export interface SignalFeed<TSignal extends PublishedSignal | RankedPublishedSignal | BotConsumableSignal = PublishedSignal | RankedPublishedSignal | BotConsumableSignal> {
  kind: SignalFeedKind;
  generatedAt: string;
  items: TSignal[];
}
