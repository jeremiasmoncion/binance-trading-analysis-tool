import type { BotConsumableSignal, PublishedSignal, RankedPublishedSignal, SignalFeed } from "./contracts";
import type { ExecutionCandidate } from "../../types";

export function selectPublishedSignals(feed: SignalFeed<PublishedSignal>): PublishedSignal[] {
  return feed.items;
}

export function selectPublishedSignalsByAudience(
  feed: SignalFeed<PublishedSignal>,
  audience: PublishedSignal["audience"],
): PublishedSignal[] {
  return feed.items.filter((signal) => signal.audience === audience);
}

export function selectHighConfidencePublishedSignals(
  feed: SignalFeed<PublishedSignal>,
  minVisibilityScore = 65,
): PublishedSignal[] {
  return feed.items.filter((signal) => signal.visibilityScore >= minVisibilityScore);
}

export function selectRankedPublishedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items;
}

export function selectPriorityRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => signal.ranking.tier === "priority" || signal.ranking.tier === "high-confidence");
}

export function selectHighConfidenceRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => signal.ranking.tier === "high-confidence");
}

export function selectDemotedRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => signal.ranking.tier === "low-visibility");
}

export function selectWatchlistFirstRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => signal.ranking.lane === "watchlist-first");
}

export function selectMarketDiscoveryRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => signal.ranking.lane === "market-discovery");
}

export function selectInformationalRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => {
    const hasAdaptivePush = Number(signal.intelligence?.adaptiveScore || 0) > Number(signal.context.score || 0);
    return !signal.intelligence?.executionEligible && !hasAdaptivePush && (
      signal.ranking.tier === "standard" || signal.ranking.tier === "low-visibility"
    );
  });
}

export function selectAiPrioritizedRankedSignals(feed: SignalFeed<RankedPublishedSignal>): RankedPublishedSignal[] {
  return feed.items.filter((signal) => {
    const adaptiveScore = Number(signal.intelligence?.adaptiveScore || 0);
    const baseScore = Number(signal.context.score || 0);
    const scorerConfidence = Number(signal.intelligence?.scorerConfidence || 0);
    const boostedByAdaptiveScore = adaptiveScore > baseScore;
    const scoredByAdaptiveModel = Boolean(signal.intelligence?.scorerLabel);
    const highConfidenceModel = scorerConfidence >= 60;
    const promotedByRanking = signal.ranking.movement === "promoted" && signal.ranking.boosts.some((boost) => (
      boost === "Visibility score alto" || boost === "Contexto de mercado identificado"
    ));

    return boostedByAdaptiveScore || (scoredByAdaptiveModel && highConfidenceModel) || promotedByRanking;
  });
}

export function selectBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items;
}

export function selectAcceptedBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items.filter((signal) => signal.acceptedByPolicy);
}

export function selectBlockedBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items.filter((signal) => !signal.acceptedByPolicy);
}

export function summarizeExecutionCandidateCohort(candidates: ExecutionCandidate[]) {
  const total = candidates.length;
  const avgScore = total
    ? candidates.reduce((sum, item) => sum + Number(item.score || 0), 0) / total
    : 0;
  const rrCandidates = candidates.filter((item) => Number(item.rrRatio || 0) > 0);
  const avgRr = rrCandidates.length
    ? rrCandidates.reduce((sum, item) => sum + Number(item.rrRatio || 0), 0) / rrCandidates.length
    : 0;

  return {
    total,
    avgScore,
    avgRr,
  };
}
