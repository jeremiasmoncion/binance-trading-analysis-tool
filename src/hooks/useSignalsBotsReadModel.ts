import { useMemo } from "react";
import { useSignalsBotsFeedSelector } from "../data-platform/selectors";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
  selectHighConfidenceRankedSignals,
  selectMarketDiscoveryRankedSignals,
  selectPriorityRankedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
} from "../domain";

function findSignalBot() {
  const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
  const bots = selectBots(registry.state);
  const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];

  return {
    registry,
    bots,
    signalBot,
  };
}

export function useSignalsBotsReadModel() {
  const feedData = useSignalsBotsFeedSelector();

  return useMemo(() => {
    // Keep the feed/ranking derivation in one shared seam so template pages do
    // not each rebuild the same domain pipeline with slightly different rules.
    const { registry, bots, signalBot } = findSignalBot();
    const publishedFeed = createPublishedSignalFeedBundleFromMemory(feedData.signalMemory, {
      watchlistSymbols: feedData.activeWatchlistCoins,
    }).all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const prioritySignals = selectPriorityRankedSignals(rankedFeed);
    const highConfidenceSignals = selectHighConfidenceRankedSignals(rankedFeed);
    const watchlistFirstSignals = selectWatchlistFirstRankedSignals(rankedFeed);
    const marketDiscoverySignals = selectMarketDiscoveryRankedSignals(rankedFeed);
    const signalBotFeed = createBotConsumableFeed(signalBot, rankedSignals, rankedFeed.generatedAt);
    const signalBotApprovedSignals = selectAcceptedBotConsumableSignals(signalBotFeed);
    const signalBotBlockedSignals = selectBlockedBotConsumableSignals(signalBotFeed);
    const botCards = bots.map((bot) => {
      const feed = createBotConsumableFeed(bot, rankedSignals, rankedFeed.generatedAt);
      const accepted = selectAcceptedBotConsumableSignals(feed).length;
      const blocked = selectBlockedBotConsumableSignals(feed).length;
      return {
        ...bot,
        accepted,
        blocked,
      };
    });

    return {
      signalMemory: feedData.signalMemory,
      activeWatchlistCoins: feedData.activeWatchlistCoins,
      registry,
      bots,
      botCards,
      signalBot,
      publishedFeed,
      rankedFeed,
      rankedSignals,
      prioritySignals,
      highConfidenceSignals,
      watchlistFirstSignals,
      marketDiscoverySignals,
      signalBotFeed,
      signalBotApprovedSignals,
      signalBotBlockedSignals,
    };
  }, [feedData]);
}
