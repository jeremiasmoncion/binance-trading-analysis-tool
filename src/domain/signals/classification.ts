import type { ExecutionCandidate } from "../../types";
import type { Bot } from "../bots/contracts";
import type {
  BotConsumableSignal,
  PublishedSignal,
  SignalExecutionCandidate,
  SignalFeed,
  SignalFeedKind,
  SystemSignal,
} from "./contracts";

function normalizeDirection(side: ExecutionCandidate["side"]): "BUY" | "SELL" | "NEUTRAL" {
  if (side === "BUY" || side === "SELL") {
    return side;
  }

  return "NEUTRAL";
}

export function createSystemSignalFromCandidate(candidate: ExecutionCandidate, observedAt: string): SystemSignal {
  return {
    id: `system:${candidate.signalId}`,
    layer: "system-signal",
    context: {
      symbol: candidate.symbol,
      timeframe: candidate.timeframe,
      score: candidate.score,
      strategyId: candidate.strategyName,
      strategyVersion: candidate.strategyVersion,
      direction: normalizeDirection(candidate.side),
      source: "system",
      observedAt,
    },
    reasons: candidate.reasons,
    rankHint: candidate.score,
  };
}

export function publishSystemSignal(
  signal: SystemSignal,
  input: {
    audience: PublishedSignal["audience"];
    feedKinds: SignalFeedKind[];
    visibilityScore?: number;
  },
): PublishedSignal {
  return {
    id: signal.id.replace("system:", "published:"),
    layer: "published-signal",
    context: signal.context,
    reasons: signal.reasons,
    audience: input.audience,
    visibilityScore: input.visibilityScore ?? signal.rankHint,
    feedKinds: input.feedKinds,
  };
}

export function createBotConsumableSignal(bot: Bot, signal: PublishedSignal): BotConsumableSignal {
  const styleAffinity = bot.stylePolicy.multiStyleEnabled
    ? bot.stylePolicy.allowedStyles
    : [bot.stylePolicy.dominantStyle];
  const acceptedTimeframe = bot.timeframePolicy.allowedTimeframes.includes(signal.context.timeframe);

  return {
    id: `${signal.id}:bot:${bot.id}`,
    layer: "bot-consumable-signal",
    context: signal.context,
    reasons: signal.reasons,
    botId: bot.id,
    acceptedByPolicy: acceptedTimeframe,
    styleAffinity,
    requiredAutomationMode: bot.automationMode,
    allowedEnvironments: [bot.executionEnvironment],
  };
}

export function toSignalExecutionCandidate(
  signal: BotConsumableSignal,
  input: { side: "BUY" | "SELL"; policyStatus: "eligible" | "blocked"; reasons?: string[] },
): SignalExecutionCandidate {
  return {
    id: `${signal.id}:execution`,
    layer: "execution-candidate",
    botId: signal.botId,
    signalId: signal.id,
    symbol: signal.context.symbol,
    timeframe: signal.context.timeframe,
    score: signal.context.score,
    side: input.side,
    policyStatus: input.policyStatus,
    reasons: input.reasons ?? signal.reasons,
  };
}

export function createSignalFeed<TSignal extends PublishedSignal | BotConsumableSignal>(
  kind: SignalFeedKind,
  items: TSignal[],
  generatedAt = new Date().toISOString(),
): SignalFeed<TSignal> {
  return {
    kind,
    generatedAt,
    items: [...items].sort((left, right) => right.context.score - left.context.score),
  };
}
