import { useMemo } from "react";
import type { SignalSnapshot } from "../types";
import {
  EMPTY_MEMORY_SUMMARY,
  EMPTY_PERFORMANCE_SUMMARY,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
} from "../domain";
import type { BotDecisionRecord } from "../domain";
import { useMarketSignalsCore } from "./useMarketSignalsCore";
import { useBotDecisionsState } from "./useBotDecisions";
import { useSelectedBotState } from "./useSelectedBot";

function dedupeRankedSignals<T extends { id: string }>(signals: T[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
}

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

function summarizeDecisionPerformance(decisions: BotDecisionRecord[]) {
  const terminalDecisions = decisions.filter((decision) => decision.status !== "pending");
  const executedDecisions = terminalDecisions.filter((decision) => decision.action === "execute" || decision.status === "executed" || decision.status === "closed");
  const realizedPnlUsd = terminalDecisions.reduce((sum, decision) => {
    const nextPnl = Number(decision.metadata?.realizedPnlUsd || decision.metadata?.pnlUsd || 0);
    return sum + (Number.isFinite(nextPnl) ? nextPnl : 0);
  }, 0);
  const winningDecisions = terminalDecisions.filter((decision) => Number(decision.metadata?.realizedPnlUsd || decision.metadata?.pnlUsd || 0) > 0);
  const latestDecision = decisions
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())[0] || null;

  return {
    memory: {
      ...EMPTY_MEMORY_SUMMARY,
      layer: "local" as const,
      lastUpdatedAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
      signalCount: decisions.length,
      decisionCount: decisions.length,
      outcomeCount: terminalDecisions.length,
      notes: latestDecision ? [`Última decisión registrada en ${latestDecision.symbol} (${latestDecision.timeframe}).`] : [],
    },
    performance: {
      ...EMPTY_PERFORMANCE_SUMMARY,
      updatedAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
      closedSignals: executedDecisions.length,
      winRate: terminalDecisions.length ? (winningDecisions.length / terminalDecisions.length) * 100 : 0,
      realizedPnlUsd,
      avgPnlUsd: terminalDecisions.length ? realizedPnlUsd / terminalDecisions.length : 0,
      avgHoldMinutes: null,
      bestSymbol: latestDecision?.symbol || null,
      worstSymbol: latestDecision?.symbol || null,
    },
  };
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
  const core = useMarketSignalsCore();
  const { selectedBotId, state: registryState } = useSelectedBotState();
  const { decisions } = useBotDecisionsState();

  return useMemo(() => {
    // Keep the feed/ranking derivation in one shared seam so template pages do
    // not each rebuild the same domain pipeline with slightly different rules.
    const registry = createBotRegistrySnapshot(registryState);
    const bots = selectBots(registry.state);
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];
    const publishedFeed = core.signalCore.feeds.published;
    const rankedFeed = core.signalCore.feeds.ranked;
    const rankedSignals = core.signalCore.subsets.rankedSignals;
    const prioritySignals = core.signalCore.taxonomy.operable;
    const highConfidenceSignals = core.signalCore.subsets.highConfidenceSignals;
    const watchlistFirstSignals = core.signalCore.subsets.watchlistSignals;
    const marketDiscoverySignals = core.signalCore.subsets.marketWideSignals;
    const observationalSignals = core.signalCore.taxonomy.observational;
    const informationalSignals = core.signalCore.taxonomy.informational;
    const aiPrioritizedSignals = core.signalCore.taxonomy.aiPrioritized;
    // Keep bots mounted on the explicit Signal Core taxonomy instead of
    // consuming the wide ranked feed directly.
    const botReadyRankedSignals = dedupeRankedSignals([
      ...aiPrioritizedSignals,
      ...prioritySignals,
      ...watchlistFirstSignals,
      ...marketDiscoverySignals,
      ...observationalSignals,
      ...informationalSignals,
    ]);
    const signalBotFeed = createBotConsumableFeed(signalBot, botReadyRankedSignals, rankedFeed.generatedAt);
    const signalBotApprovedSignals = selectAcceptedBotConsumableSignals(signalBotFeed);
    const signalBotBlockedSignals = selectBlockedBotConsumableSignals(signalBotFeed);
    const botCards = bots.map((bot) => {
      const feed = createBotConsumableFeed(bot, botReadyRankedSignals, rankedFeed.generatedAt);
      const primaryPair = bot.workspaceSettings.primaryPair || "";
      const botDecisions = decisions.filter((decision) => decision.botId === bot.id);
      const acceptedSignals = filterSignalsForBotPair(selectAcceptedBotConsumableSignals(feed), primaryPair);
      const blockedSignals = filterSignalsForBotPair(selectBlockedBotConsumableSignals(feed), primaryPair);
      const scopedRankedSignals = filterSignalsForBotPair(rankedSignals, primaryPair);
      const accepted = acceptedSignals.length;
      const blocked = blockedSignals.length;
      const leadingSignal = acceptedSignals[0] || blockedSignals[0] || scopedRankedSignals[0] || null;
      const derivedRuntime = botDecisions.length
        ? summarizeDecisionPerformance(botDecisions)
        : summarizeSignalsPerformance(primaryPair, core.signalCore.signalMemory);
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
        decisions: botDecisions,
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
    const selectedBotDecisions = selectedBotCard?.decisions || [];
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
      signalMemory: core.signalCore.signalMemory,
      activeWatchlistCoins: core.signalCore.activeWatchlistCoins,
      marketCore: core.marketCore,
      signalCore: core.signalCore,
      registry,
      bots,
      botCards,
      selectedBotCard,
      signalBot,
      publishedFeed,
      rankedFeed,
      rankedSignals,
      informationalSignals,
      observationalSignals,
      aiPrioritizedSignals,
      botReadyRankedSignals,
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
      selectedBotDecisions,
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
  }, [core, decisions, registryState, selectedBotId]);
}
