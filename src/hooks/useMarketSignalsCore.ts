import { useMemo } from "react";
import { useMarketCoreSelector, useSignalCoreSelector } from "../data-platform/selectors";
import {
  createPublishedSignalFeedBundleFromCandidates,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectAcceptedBotConsumableSignals,
  selectHighConfidenceRankedSignals,
  selectMarketDiscoveryRankedSignals,
  selectPriorityRankedSignals,
  selectPublishedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
  createBotConsumableFeed,
} from "../domain";
import { useSelectedBotState } from "./useSelectedBot";

export function useMarketSignalsCore() {
  const marketCore = useMarketCoreSelector();
  const signalCore = useSignalCoreSelector();
  const { state: registryState, selectedBot } = useSelectedBotState();

  return useMemo(() => {
    const publishedBundle = createPublishedSignalFeedBundleFromMemory(signalCore.signalMemory, {
      watchlistSymbols: signalCore.activeWatchlistCoins,
    });
    const publishedFeed = publishedBundle.all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const watchlistSignals = selectWatchlistFirstRankedSignals(rankedFeed);
    const marketWideSignals = selectMarketDiscoveryRankedSignals(rankedFeed);
    // Execution candidates already encode the old operational gate
    // (score, RR, reasons, side, eligible/blocked). Reuse that cohort first.
    const eligibleExecutionCandidates = signalCore.executionCandidates.filter((candidate) => candidate.status === "eligible");
    const operablePublishedBundle = createPublishedSignalFeedBundleFromCandidates(eligibleExecutionCandidates, {
      watchlistSymbols: signalCore.activeWatchlistCoins,
      generatedAt: rankedFeed.generatedAt,
    });
    const operablePublishedFeed = operablePublishedBundle.all.items.length ? operablePublishedBundle.all : publishedFeed;
    const operableRankedFeed = operablePublishedBundle.all.items.length ? rankPublishedFeed(operablePublishedFeed) : rankedFeed;
    const operableSignals = selectPriorityRankedSignals(operableRankedFeed);
    const highConfidenceSignals = selectHighConfidenceRankedSignals(rankedFeed);
    const activeBot = selectedBot || registryState.bots[0] || null;
    const botSignalBase = operablePublishedBundle.all.items.length ? operableRankedFeed.items : rankedSignals;
    const botConsumableFeed = activeBot
      ? createBotConsumableFeed(activeBot, botSignalBase, operableRankedFeed.generatedAt)
      : null;
    const botConsumableSignals = botConsumableFeed ? selectAcceptedBotConsumableSignals(botConsumableFeed) : [];

    return {
      marketCore: {
        currentCoin: marketCore.currentCoin,
        timeframe: marketCore.timeframe,
        currentPrice: marketCore.currentPrice,
        signal: marketCore.signal,
        analysis: marketCore.analysis,
        strategy: marketCore.strategy,
        strategyCandidates: marketCore.strategyCandidates,
        multiTimeframes: marketCore.multiTimeframes,
        market24h: marketCore.market24h,
        activeOpportunity: marketCore.strategyCandidates[0] || null,
      },
      signalCore: {
        signalMemory: signalCore.signalMemory,
        activeWatchlistName: signalCore.activeWatchlistName,
        activeWatchlistCoins: signalCore.activeWatchlistCoins,
        scannerStatus: signalCore.scannerStatus,
        executionCandidates: signalCore.executionCandidates,
        feeds: {
          published: publishedFeed,
          ranked: rankedFeed,
          watchlist: publishedBundle.watchlist,
          marketWide: publishedBundle.marketWide,
          operable: operableRankedFeed,
          highConfidencePublished: publishedBundle.highConfidence,
        },
        subsets: {
          publishedSignals: selectPublishedSignals(publishedFeed),
          rankedSignals,
          watchlistSignals,
          marketWideSignals,
          operableSignals,
          highConfidenceSignals,
          botConsumableSignals,
        },
      },
    };
  }, [marketCore, registryState.bots, selectedBot, signalCore]);
}
