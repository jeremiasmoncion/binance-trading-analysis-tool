import { useMemo } from "react";
import { useMarketCoreSelector, useSignalCoreSelector } from "../data-platform/selectors";
import {
  createPublishedSignalFeedBundleFromCandidates,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectAcceptedBotConsumableSignals,
  selectAiPrioritizedRankedSignals,
  selectHighConfidenceRankedSignals,
  selectInformationalRankedSignals,
  selectMarketDiscoveryRankedSignals,
  selectPriorityRankedSignals,
  selectPublishedSignals,
  selectRankedPublishedSignals,
  summarizeExecutionCandidateCohort,
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
    const operationalCandidates = signalCore.executionCandidates.map((candidate) => ({
      id: `candidate:${candidate.signalId}`,
      layer: "execution-candidate" as const,
      signalId: candidate.signalId,
      symbol: candidate.symbol,
      timeframe: candidate.timeframe,
      strategyId: candidate.strategyName,
      strategyVersion: candidate.strategyVersion,
      side: candidate.side,
      score: candidate.score,
      rrRatio: candidate.rrRatio,
      status: candidate.status,
      reasons: candidate.reasons,
    }));
    const eligibleExecutionCandidates = signalCore.executionCandidates.filter((candidate) => candidate.status === "eligible");
    const blockedExecutionCandidates = operationalCandidates.filter((candidate) => candidate.status === "blocked");
    const operablePublishedBundle = createPublishedSignalFeedBundleFromCandidates(eligibleExecutionCandidates, {
      watchlistSymbols: signalCore.activeWatchlistCoins,
      generatedAt: rankedFeed.generatedAt,
    });
    const operablePublishedFeed = operablePublishedBundle.all.items.length ? operablePublishedBundle.all : publishedFeed;
    const operableRankedFeed = operablePublishedBundle.all.items.length ? rankPublishedFeed(operablePublishedFeed) : rankedFeed;
    const operableSignals = selectPriorityRankedSignals(operableRankedFeed);
    const highConfidenceSignals = selectHighConfidenceRankedSignals(rankedFeed);
    const informationalSignals = selectInformationalRankedSignals(rankedFeed);
    const aiPrioritizedSignals = selectAiPrioritizedRankedSignals(rankedFeed);
    const observationalSignals = rankedSignals.filter((signal) => !operableSignals.some((candidate) => candidate.id === signal.id));
    const activeBot = selectedBot || registryState.bots[0] || null;
    const botSignalBase = operablePublishedBundle.all.items.length ? operableRankedFeed.items : rankedSignals;
    const botConsumableFeed = activeBot
      ? createBotConsumableFeed(activeBot, botSignalBase, operableRankedFeed.generatedAt)
      : null;
    const botConsumableSignals = botConsumableFeed ? selectAcceptedBotConsumableSignals(botConsumableFeed) : [];
    const latestScannerRun = signalCore.scannerStatus?.latestRun || null;
    const latestSchedulerRun = signalCore.scannerStatus?.latestSchedulerRun || null;
    const activeScannerTarget = signalCore.scannerStatus?.targets[0] || null;
    const eligibleSummary = summarizeExecutionCandidateCohort(eligibleExecutionCandidates);
    const blockedSummary = summarizeExecutionCandidateCohort(signalCore.executionCandidates.filter((candidate) => candidate.status === "blocked"));
    const scannerDiscovery = {
      activeListName: activeScannerTarget?.activeListName || signalCore.activeWatchlistName || "Sin watchlist activa",
      watchedCoinsCount: Number(activeScannerTarget?.coinsCount || signalCore.activeWatchlistCoins.length || 0),
      watchedCoins: activeScannerTarget?.coins?.length ? activeScannerTarget.coins : signalCore.activeWatchlistCoins,
      latestRunAt: latestScannerRun?.created_at || null,
      latestRunStatus: latestScannerRun?.status || null,
      latestRunFrames: Number(latestScannerRun?.frames_scanned || 0),
      latestRunSignalsCreated: Number(latestScannerRun?.signals_created || 0),
      latestRunSignalsClosed: Number(latestScannerRun?.signals_closed || 0),
    };
    const marketWideContext = {
      discoveryFeedSource: operablePublishedBundle.marketWide.items.length ? "execution-overlay" : "ranked-memory",
      latestScanSource: latestScannerRun?.scan_source || null,
      latestSchedulerRunAt: latestSchedulerRun?.created_at || null,
      latestSchedulerSignalsCreated: Number(latestSchedulerRun?.signals_created || 0),
      latestSchedulerSignalsClosed: Number(latestSchedulerRun?.signals_closed || 0),
      latestDiscoveryCount: marketWideSignals.length,
      activeCooldownUntil: signalCore.scannerStatus?.summary.autoExecutionCooldownUntil || null,
      cooldownActive: Boolean(signalCore.scannerStatus?.summary.autoExecutionCooldownActive),
    };
    const operationalContext = {
      feedSource: operablePublishedBundle.all.items.length ? "execution-overlay" : "ranked-memory",
      eligibleCount: eligibleSummary.total,
      blockedCount: blockedSummary.total,
      eligibleAvgScore: eligibleSummary.avgScore,
      blockedAvgScore: blockedSummary.avgScore,
      eligibleAvgRr: eligibleSummary.avgRr,
      blockedAvgRr: blockedSummary.avgRr,
      latestRunAutoOrdersPlaced: Number(latestScannerRun?.auto_orders_placed || 0),
      latestRunAutoOrdersBlocked: Number(latestScannerRun?.auto_orders_blocked || 0),
      latestRunAutoOrdersSkipped: Number(latestScannerRun?.auto_orders_skipped || 0),
      latestRunStatus: latestScannerRun?.status || null,
    };

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
        scannerDiscovery,
        marketWideContext,
        operationalContext,
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
          observationalSignals,
          informationalSignals,
          aiPrioritizedSignals,
          highConfidenceSignals,
          botConsumableSignals,
          eligibleExecutionCandidates: operationalCandidates.filter((candidate) => candidate.status === "eligible"),
          blockedExecutionCandidates,
        },
      },
    };
  }, [marketCore, registryState.bots, selectedBot, signalCore]);
}
