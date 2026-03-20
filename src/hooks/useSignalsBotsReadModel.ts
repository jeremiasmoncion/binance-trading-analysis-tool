import { useMemo } from "react";
import { useSignalsBotsFeedSelector } from "../data-platform/selectors";
import type { SignalSnapshot } from "../types";
import {
  EMPTY_MEMORY_SUMMARY,
  EMPTY_PERFORMANCE_SUMMARY,
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

function normalizePair(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function filterSignalsForBotPair<T extends { context: { symbol: string } }>(signals: T[], primaryPair: string) {
  const normalizedPair = normalizePair(primaryPair);
  if (!normalizedPair) return signals;
  const scoped = signals.filter((signal) => normalizePair(signal.context.symbol) === normalizedPair);
  return scoped.length ? scoped : signals;
}

function filterSnapshotsForBotPair<T extends { coin: string }>(signals: T[], primaryPair: string) {
  const normalizedPair = normalizePair(primaryPair);
  if (!normalizedPair) return signals;
  const scoped = signals.filter((signal) => normalizePair(signal.coin) === normalizedPair);
  return scoped.length ? scoped : signals;
}

function summarizeSignalsPerformance(primaryPair: string, signalMemory: SignalSnapshot[]) {
  const scopedSignals = filterSnapshotsForBotPair(signalMemory, primaryPair);
  const closedSignals = scopedSignals.filter((signal) => signal.outcome_status !== "pending");
  const winningSignals = closedSignals.filter((signal) => Number(signal.outcome_pnl || 0) > 0);
  const realizedPnlUsd = closedSignals.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
  const latestSignal = scopedSignals
    .slice()
    .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())[0] || null;

  return {
    memory: {
      ...EMPTY_MEMORY_SUMMARY,
      layer: "local" as const,
      lastUpdatedAt: latestSignal?.updated_at || latestSignal?.created_at || null,
      signalCount: scopedSignals.length,
      decisionCount: scopedSignals.filter((signal) => signal.signal_label !== "Esperar").length,
      outcomeCount: closedSignals.length,
      notes: latestSignal ? [`Última señal observada en ${latestSignal.coin} (${latestSignal.timeframe}).`] : [],
    },
    performance: {
      ...EMPTY_PERFORMANCE_SUMMARY,
      updatedAt: latestSignal?.updated_at || latestSignal?.created_at || null,
      closedSignals: closedSignals.length,
      winRate: closedSignals.length ? (winningSignals.length / closedSignals.length) * 100 : 0,
      realizedPnlUsd,
      avgPnlUsd: closedSignals.length ? realizedPnlUsd / closedSignals.length : 0,
      avgHoldMinutes: null,
      bestSymbol: latestSignal?.coin || null,
      worstSymbol: latestSignal?.coin || null,
    },
  };
}

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
      const primaryPair = bot.workspaceSettings.primaryPair || "";
      const acceptedSignals = filterSignalsForBotPair(selectAcceptedBotConsumableSignals(feed), primaryPair);
      const blockedSignals = filterSignalsForBotPair(selectBlockedBotConsumableSignals(feed), primaryPair);
      const scopedRankedSignals = filterSignalsForBotPair(rankedSignals, primaryPair);
      const accepted = acceptedSignals.length;
      const blocked = blockedSignals.length;
      const leadingSignal = acceptedSignals[0] || blockedSignals[0] || scopedRankedSignals[0] || null;
      const derivedRuntime = summarizeSignalsPerformance(primaryPair, feedData.signalMemory);
      return {
        ...bot,
        localMemory: {
          ...bot.localMemory,
          ...derivedRuntime.memory,
        },
        performance: {
          ...bot.performance,
          ...derivedRuntime.performance,
        },
        accepted,
        blocked,
        acceptedSignals,
        blockedSignals,
        scopedRankedSignals,
        leadingSignal,
      };
    });
    const selectedBotCard = botCards.find((bot) => bot.id === selectedBotId) || botCards[0] || null;
    const selectedBotFeed = selectedBotCard
      ? createBotConsumableFeed(
          selectedBotCard,
          selectedBotCard.scopedRankedSignals?.length ? selectedBotCard.scopedRankedSignals : rankedSignals,
          rankedFeed.generatedAt,
        )
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
