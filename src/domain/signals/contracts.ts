import type { BotAutomationMode, BotExecutionEnvironment, BotTradingStyle } from "../bots/contracts";

export type SignalOrigin = "system" | "watchlist" | "market" | "user";

export type SignalLayer =
  | "system-signal"
  | "published-signal"
  | "bot-consumable-signal"
  | "execution-candidate";

export type SignalFeedKind = "watchlist" | "market-wide" | "bot-specific" | "high-confidence" | "style-specific";

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

export interface BotConsumableSignal {
  id: string;
  layer: "bot-consumable-signal";
  context: SignalContextSnapshot;
  reasons: string[];
  botId: string;
  acceptedByPolicy: boolean;
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

export interface SignalFeed<TSignal extends PublishedSignal | BotConsumableSignal = PublishedSignal | BotConsumableSignal> {
  kind: SignalFeedKind;
  generatedAt: string;
  items: TSignal[];
}
