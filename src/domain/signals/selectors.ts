import type { BotConsumableSignal, PublishedSignal, SignalFeed } from "./contracts";

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

export function selectBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items;
}

export function selectAcceptedBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items.filter((signal) => signal.acceptedByPolicy);
}

export function selectBlockedBotConsumableSignals(feed: SignalFeed<BotConsumableSignal>): BotConsumableSignal[] {
  return feed.items.filter((signal) => !signal.acceptedByPolicy);
}
