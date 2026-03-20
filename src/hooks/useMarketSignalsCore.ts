import { useMemo } from "react";
import { useMarketCoreSelector, useSignalCoreSelector } from "../data-platform/selectors";
import {
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
    const operableSignals = selectPriorityRankedSignals(rankedFeed);
    const highConfidenceSignals = selectHighConfidenceRankedSignals(rankedFeed);
    const activeBot = selectedBot || registryState.bots[0] || null;
    const botConsumableFeed = activeBot
      ? createBotConsumableFeed(activeBot, rankedSignals, rankedFeed.generatedAt)
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
        feeds: {
          published: publishedFeed,
          ranked: rankedFeed,
          watchlist: publishedBundle.watchlist,
          marketWide: publishedBundle.marketWide,
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
