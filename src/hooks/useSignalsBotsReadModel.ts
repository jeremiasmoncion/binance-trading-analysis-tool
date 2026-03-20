import { useMemo } from "react";
import { useSignalsBotsFeedSelector } from "../data-platform/selectors";
import {
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
import { useSelectedBotState } from "./useSelectedBot";

export function useSignalsBotsReadModel() {
  const feedData = useSignalsBotsFeedSelector();
  const { selectedBotId, state: registryState } = useSelectedBotState();

  return useMemo(() => {
    // Keep the feed/ranking derivation in one shared seam so template pages do
    // not each rebuild the same domain pipeline with slightly different rules.
    const registry = createBotRegistrySnapshot(registryState);
    const bots = selectBots(registry.state);
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];
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
      const acceptedSignals = selectAcceptedBotConsumableSignals(feed);
      const blockedSignals = selectBlockedBotConsumableSignals(feed);
      const accepted = acceptedSignals.length;
      const blocked = blockedSignals.length;
      const leadingSignal = acceptedSignals[0] || blockedSignals[0] || null;
      return {
        ...bot,
        accepted,
        blocked,
        acceptedSignals,
        blockedSignals,
        leadingSignal,
      };
    });
    const selectedBotCard = botCards.find((bot) => bot.id === selectedBotId) || botCards[0] || null;
    const selectedBotFeed = selectedBotCard
      ? createBotConsumableFeed(selectedBotCard, rankedSignals, rankedFeed.generatedAt)
      : signalBotFeed;
    const selectedBotApprovedSignals = selectAcceptedBotConsumableSignals(selectedBotFeed);
    const selectedBotBlockedSignals = selectBlockedBotConsumableSignals(selectedBotFeed);
    const rankedSignalById = new Map(rankedSignals.map((signal) => [signal.id, signal]));
    const selectedBotApprovedRankedSignals = selectedBotApprovedSignals
      .map((signal) => rankedSignalById.get(signal.id) || null)
      .filter((signal): signal is (typeof rankedSignals)[number] => Boolean(signal));
    const activeBots = botCards.filter((bot) => bot.status === "active");
    const totalTrades = botCards.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0);
    const totalProfit = botCards.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0);
    const averageWinRate = botCards.length
      ? botCards.reduce((sum, bot) => sum + bot.performance.winRate, 0) / botCards.length
      : 0;

    return {
      signalMemory: feedData.signalMemory,
      activeWatchlistCoins: feedData.activeWatchlistCoins,
      registry,
      bots,
      botCards,
      selectedBotCard,
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
      selectedBotFeed,
      selectedBotApprovedSignals,
      selectedBotApprovedRankedSignals,
      selectedBotBlockedSignals,
      botSummary: {
        totalBots: botCards.length,
        activeBots: activeBots.length,
        pausedBots: botCards.filter((bot) => bot.status === "paused").length,
        draftBots: botCards.filter((bot) => bot.status === "draft").length,
        totalTrades,
        totalProfit,
        averageWinRate,
      },
    };
  }, [feedData, registryState, selectedBotId]);
}
