import { useMemo } from "react";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createDecisionTimeline,
  createBotConsumableFeed,
  createBotActivityTimeline,
  createBotCardsWithExecutionContext,
  createBotCardsWithOperationalContext,
  createBotFleetSummary,
  createPerformanceBreakdowns,
  createBotRegistrySnapshot,
  dedupeRankedSignals,
  dedupeRankedSignalsByScope,
  filterSignalsForBotScope,
  getDecisionPublishedSignalKey,
  getPublishedSignalIdFromBotConsumableId,
  resolveBotScopeSymbols,
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
  summarizeBotOperationalVerdict,
  summarizeBotsOperationalNow,
  summarizeGovernedDemoGate,
  summarizePaperDemoOperationalStatus,
  summarizeBotDecisionRuntime,
} from "../domain";
import { useExecutionLogsSelector } from "../data-platform/selectors";
import { useMarketSignalsCore } from "./useMarketSignalsCore";
import { useBotDecisionsState } from "./useBotDecisions";
import { useSelectedBotState } from "./useSelectedBot";

export function useSignalsBotsReadModel() {
  const core = useMarketSignalsCore();
  const { selectedBotId, state: registryState } = useSelectedBotState();
  const { decisions } = useBotDecisionsState();
  const executionLogs = useExecutionLogsSelector();

  return useMemo(() => {
    // Keep the feed/ranking derivation in one shared seam so template pages do
    // not each rebuild the same domain pipeline with slightly different rules.
    const registry = createBotRegistrySnapshot(registryState);
    const bots = selectBots(registry.state);
    const fallbackSignalBot = INITIAL_BOT_REGISTRY_STATE.bots.find((bot) => bot.slug === "signal-bot-core") || INITIAL_BOT_REGISTRY_STATE.bots[0];
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0] || fallbackSignalBot;
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
      const botScopeSymbols = resolveBotScopeSymbols(bot, core.signalCore.activeWatchlistCoins || []);
      const botDecisions = decisions.filter((decision) => decision.botId === bot.id);
      const acceptedSignals = filterSignalsForBotScope(
        selectAcceptedBotConsumableSignals(feed),
        botScopeSymbols,
        primaryPair,
        bot.timeframePolicy?.allowedTimeframes || [],
      );
      const blockedSignals = filterSignalsForBotScope(
        selectBlockedBotConsumableSignals(feed),
        botScopeSymbols,
        primaryPair,
        bot.timeframePolicy?.allowedTimeframes || [],
      );
      const scopedRankedSignals = filterSignalsForBotScope(
        rankedSignals,
        botScopeSymbols,
        primaryPair,
        bot.timeframePolicy?.allowedTimeframes || [],
      );
      const accepted = acceptedSignals.length;
      const blocked = blockedSignals.length;
      const leadingSignal = acceptedSignals[0] || blockedSignals[0] || scopedRankedSignals[0] || null;
      const hasOwnedRuntime =
        botDecisions.length > 0
        || Boolean(bot.localMemory.lastUpdatedAt || bot.performance.updatedAt || bot.audit.lastDecisionAt || bot.audit.lastExecutionAt);
      const derivedRuntime = botDecisions.length
        ? summarizeBotDecisionRuntime(botDecisions)
        : hasOwnedRuntime
          ? {
              localMemory: bot.localMemory,
              performance: bot.performance,
              audit: bot.audit,
              activity: bot.activity,
            }
          : {
              localMemory: bot.localMemory,
              performance: bot.performance,
              audit: {},
              activity: bot.activity,
            };
      return {
        ...bot,
        localMemory: {
          ...bot.localMemory,
          ...derivedRuntime.localMemory,
        },
        performance: {
          ...bot.performance,
          ...derivedRuntime.performance,
        },
        audit: {
          ...bot.audit,
          ...(botDecisions.length ? derivedRuntime.audit : {}),
        },
        activity: {
          ...bot.activity,
          ...(botDecisions.length ? derivedRuntime.activity : {}),
        },
        accepted,
        blocked,
        acceptedSignals,
        blockedSignals,
        scopedRankedSignals,
        leadingSignal,
        decisions: botDecisions,
        decisionTimeline: createDecisionTimeline(botDecisions),
        performanceBreakdowns: createPerformanceBreakdowns(botDecisions),
      };
    });
    const { executionOwnership, botCardsWithExecution } = createBotCardsWithExecutionContext({
      botCards,
      recentOrders: executionLogs.recentOrders || [],
      signalMemory: core.signalCore.signalMemory,
    });
    const {
      botCardsWithOperationalContention,
      fleetOperationalReadiness,
      readyContention,
      fleetQueueChurn,
      fleetSafeLaneStability,
      fleetOperationalVerdict,
    } = createBotCardsWithOperationalContext(botCardsWithExecution);

    const selectedBotCard = botCardsWithOperationalContention.find((bot) => bot.id === selectedBotId) || botCardsWithOperationalContention[0] || null;
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
    const selectedBotHandledSignalKeys = new Set(
      selectedBotDecisions
        .map((decision) => getDecisionPublishedSignalKey(decision))
        .filter(Boolean),
    );
    const selectedBotDecisionTimeline = selectedBotCard?.decisionTimeline || [];
    const selectedBotExecutionTimeline = selectedBotCard?.executionTimeline || [];
    const selectedBotTradeTimeline = selectedBotCard?.tradeTimeline || [];
    const selectedBotActivityTimeline = createBotActivityTimeline(
      selectedBotDecisionTimeline,
      selectedBotExecutionTimeline,
    );
    const selectedBotPerformanceBreakdowns = (selectedBotCard?.executionBreakdowns?.length
      ? selectedBotCard.executionBreakdowns
      : selectedBotCard?.performanceBreakdowns) || [];
    const selectedBotAdaptationSummary = selectedBotCard?.adaptationSummary || null;
    const selectedBotExecutionIntentSummary = selectedBotCard?.executionIntentSummary || null;
    const selectedBotOperationalVerdict = selectedBotCard
      ? summarizeBotOperationalVerdict({
          operationalReadiness: selectedBotCard.operationalReadiness,
          executionIntentSummary: selectedBotCard.executionIntentSummary,
        })
      : null;
    const governedDemoGate = summarizeGovernedDemoGate({
      operationalVerdictState: fleetOperationalVerdict.state,
      operationalVerdictNote: fleetOperationalVerdict.note,
      stableReadyBots: fleetSafeLaneStability.stableReadyBots,
    });
    const paperDemoOperationalStatus = summarizePaperDemoOperationalStatus({
      governedDemoGateState: governedDemoGate.state,
      governedDemoGateNote: governedDemoGate.note,
      stableReadyBots: fleetSafeLaneStability.stableReadyBots,
      totalBots: botCardsWithOperationalContention.length,
    });
    const botsOperationalNow = summarizeBotsOperationalNow({
      paperDemoOperationalState: paperDemoOperationalStatus.state,
      paperDemoOperationalNote: paperDemoOperationalStatus.note,
      operationalBots: paperDemoOperationalStatus.operationalBots,
    });
    const rankedSignalById = new Map(rankedSignals.map((signal) => [signal.id, signal]));
    const selectedBotApprovedRankedSignals = dedupeRankedSignalsByScope(dedupeRankedSignals(
      selectedBotApprovedSignals
        .map((signal) => rankedSignalById.get(getPublishedSignalIdFromBotConsumableId(signal.id)) || null)
        .filter((signal): signal is (typeof rankedSignals)[number] => Boolean(signal)),
    )).filter((signal) => !selectedBotHandledSignalKeys.has(getPublishedSignalIdFromBotConsumableId(signal.id)));
    const selectedBotScopedRankedSignals = dedupeRankedSignalsByScope(dedupeRankedSignals(
      selectedBotCard?.scopedRankedSignals || [],
    )).filter((signal) => !selectedBotHandledSignalKeys.has(getPublishedSignalIdFromBotConsumableId(signal.id)));
    const allBotDecisionTimeline = botCardsWithOperationalContention
      .flatMap((bot) => bot.decisionTimeline.map((entry) => ({
        ...entry,
        botId: bot.id,
        botName: bot.name,
      })))
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
    const allBotExecutionTimeline = executionOwnership.allEntries;
    const allBotTradeTimeline = botCardsWithOperationalContention.flatMap((bot) => bot.tradeTimeline || []);
    const allBotActivityTimeline = createBotActivityTimeline(allBotDecisionTimeline, allBotExecutionTimeline);
    const {
      attentionCandidates,
      attentionBots,
      botSummary,
    } = createBotFleetSummary({
      botCards: botCardsWithOperationalContention,
      readyContention,
      fleetOperationalReadiness,
      fleetQueueChurn,
      fleetSafeLaneStability,
      fleetOperationalVerdict,
      governedDemoGate,
      paperDemoOperationalStatus,
      botsOperationalNow,
    });

    return {
      signalMemory: core.signalCore.signalMemory,
      activeWatchlistCoins: core.signalCore.activeWatchlistCoins,
      marketCore: core.marketCore,
      signalCore: core.signalCore,
      registry,
      bots,
      botCards: botCardsWithOperationalContention,
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
      selectedBotScopedRankedSignals,
      selectedBotBlockedSignals,
      selectedBotDecisions,
      selectedBotDecisionTimeline,
      selectedBotExecutionTimeline,
      selectedBotTradeTimeline,
      selectedBotActivityTimeline,
      selectedBotPerformanceBreakdowns,
      selectedBotAdaptationSummary,
      selectedBotExecutionIntentSummary,
      selectedBotOperationalVerdict,
      governedDemoGate,
      paperDemoOperationalStatus,
      botsOperationalNow,
      attentionBots,
      attentionBotIds: attentionCandidates.map((bot) => bot.id),
      readyContention,
      allBotDecisionTimeline,
      allBotExecutionTimeline,
      allBotTradeTimeline,
      allBotActivityTimeline,
      botSummary,
    };
  }, [core, decisions, executionLogs.recentOrders, registryState, selectedBotId]);
}
