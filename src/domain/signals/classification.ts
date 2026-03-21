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

function matchesBotUniverse(bot: Bot, signal: PublishedSignal): { matched: boolean; note: string } {
  const explicitSymbols = (bot.universePolicy.symbols || []).filter(Boolean);

  if (bot.universePolicy.kind === "watchlist") {
    if (explicitSymbols.length) {
      const matched = signal.audience === "watchlist" || explicitSymbols.includes(signal.context.symbol);
      return {
        matched,
        note: matched
          ? "Coincide con watchlist o con la lista explicita de pares del bot."
          : "Fuera del universo watchlist y de los pares activos del bot.",
      };
    }
    return {
      matched: signal.audience === "watchlist",
      note: signal.audience === "watchlist" ? "Coincide con universo watchlist." : "Fuera del universo watchlist del bot.",
    };
  }

  if (bot.universePolicy.kind === "custom-list") {
    const matched = explicitSymbols.includes(signal.context.symbol);
    return {
      matched,
      note: matched ? "Coincide con la lista propia del bot." : "La moneda no esta en la lista propia del bot.",
    };
  }

  if (bot.universePolicy.kind === "hybrid") {
    const matched = signal.audience === "watchlist" || explicitSymbols.includes(signal.context.symbol);
    return {
      matched,
      note: matched ? "Coincide con el universo hibrido del bot." : "Fuera del universo hibrido del bot.",
    };
  }

  return {
    matched: true,
    note: "Universo filtrado a nivel de mercado.",
  };
}

export function createBotConsumableSignal(bot: Bot, signal: PublishedSignal): BotConsumableSignal {
  const styleAffinity = bot.stylePolicy.multiStyleEnabled
    ? bot.stylePolicy.allowedStyles
    : [bot.stylePolicy.dominantStyle];
  const acceptedTimeframe = bot.timeframePolicy.allowedTimeframes.includes(signal.context.timeframe);
  const acceptedStrategy = !bot.strategyPolicy.allowedStrategyIds.length || bot.strategyPolicy.allowedStrategyIds.includes(signal.context.strategyId);
  const universeMatch = matchesBotUniverse(bot, signal);
  const acceptedByPolicy = universeMatch.matched && acceptedTimeframe && acceptedStrategy;
  const policyNotes = [
    universeMatch.note,
    acceptedTimeframe ? "Timeframe permitido por el bot." : "Timeframe fuera de la politica del bot.",
    acceptedStrategy ? "Estrategia permitida por el bot." : "Estrategia fuera de la politica del bot.",
  ];

  return {
    id: `${signal.id}:bot:${bot.id}`,
    layer: "bot-consumable-signal",
    context: signal.context,
    reasons: signal.reasons,
    botId: bot.id,
    acceptedByPolicy,
    policyMatches: {
      universe: universeMatch.matched,
      timeframe: acceptedTimeframe,
      strategy: acceptedStrategy,
    },
    policyNotes,
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
