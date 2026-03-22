import type { ExecutionOrderRecord, SignalSnapshot } from "../../types";
import type { Bot, BotDecisionRecord, BotPerformanceBreakdown } from "./contracts.ts";
import type { BotCanonicalTrade } from "./tradeChain.ts";
import type { BotConsumableSignal, PublishedSignal, RankedPublishedSignal } from "../signals/contracts.ts";
import { buildBotCanonicalTradeTimeline } from "./tradeChain.ts";
import { summarizeBotPerformanceFromOrders } from "./adapters.ts";
import {
  createAdaptationSummary,
  createBotAttentionSummary,
  createDisabledMemoryLayerSummary,
  createExecutionBreakdowns,
  createExecutionIntentSummary,
  createOperationalReadinessSummary,
  createOwnedMemorySummary,
  createOwnershipSummary,
  resolveExecutionOwnership,
  summarizeFleetAdaptation,
  summarizeFleetOperationalReadiness,
  summarizeFleetOperationalVerdict,
  summarizeFleetQueueChurn,
  summarizeFleetSafeLaneStability,
  summarizeReadyContention,
} from "./readModel.ts";

type DecisionTimelineEntry = {
  id: string;
  symbol: string;
  timeframe: string;
  action: string;
  status: string;
  source: string;
  environment: string;
  automationMode: string;
  pnlUsd: number;
  entryPrice: number | null;
  targetPrice: number | null;
  strategyId: string;
  executionOrderId: number | null;
  executionIntentStatus: string;
  executionIntentLane: string;
  executionIntentLaneStatus: string;
  executionIntentReason: string;
  executionIntentDispatchStatus: string;
  executionIntentDispatchMode: string;
  executionIntentDispatchAttemptedAt: string;
  executionIntentDispatchedAt: string;
  executionIntentPreviewRefreshCount: number;
  executionIntentPreviewChurnPardonCount: number;
  executionIntentPreviewChurnManualClearCount: number;
  executionIntentPreviewChurnHardResetCount: number;
  executionStatus: string;
  executionOutcomeStatus: string;
  executionLinkedAt: string;
  linkedBy: string;
  rankingTier: string;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
};

type OwnershipEntry = ReturnType<typeof resolveExecutionOwnership>["allEntries"][number];
type OwnershipSummary = ReturnType<typeof createOwnershipSummary>;
type ExecutionIntentSummary = ReturnType<typeof createExecutionIntentSummary>;
type ExecutionBreakdown = ReturnType<typeof createExecutionBreakdowns>[number];
type AdaptationSummary = ReturnType<typeof createAdaptationSummary>;
type AttentionSummary = ReturnType<typeof createBotAttentionSummary>;
type OperationalReadinessSummary = ReturnType<typeof createOperationalReadinessSummary>;
type FleetOperationalReadiness = ReturnType<typeof summarizeFleetOperationalReadiness>;
type ReadyContention = ReturnType<typeof summarizeReadyContention>;
type FleetQueueChurn = ReturnType<typeof summarizeFleetQueueChurn>;
type FleetSafeLaneStability = ReturnType<typeof summarizeFleetSafeLaneStability>;
type FleetOperationalVerdict = ReturnType<typeof summarizeFleetOperationalVerdict>;

export type BotWorkspaceCard = Bot & {
  accepted: number;
  blocked: number;
  acceptedSignals: BotConsumableSignal[];
  blockedSignals: BotConsumableSignal[];
  scopedRankedSignals: RankedPublishedSignal[];
  leadingSignal: BotConsumableSignal | PublishedSignal | RankedPublishedSignal | null;
  decisions: BotDecisionRecord[];
  decisionTimeline: DecisionTimelineEntry[];
  performanceBreakdowns: BotPerformanceBreakdown[];
};

export type BotExecutionWorkspaceCard = BotWorkspaceCard & {
  executionOrders: ExecutionOrderRecord[];
  executionTimeline: OwnershipEntry[];
  tradeTimeline: BotCanonicalTrade[];
  executionBreakdowns: ExecutionBreakdown[];
  ownership: OwnershipSummary;
  executionIntentSummary: ExecutionIntentSummary;
};

export type BotOperationalWorkspaceCard = BotExecutionWorkspaceCard & {
  adaptationSummary: AdaptationSummary;
  attention: AttentionSummary;
  operationalReadiness: OperationalReadinessSummary;
  readyContention: {
    isContended: boolean;
    pair: string | null;
    peerCount: number;
    peerNames: string[];
    isLeader: boolean;
    leaderBotName: string | null;
    queuePosition: number;
  };
};

export function createBotCardsWithExecutionContext(input: {
  botCards: BotWorkspaceCard[];
  recentOrders: ExecutionOrderRecord[] | null | undefined;
  signalMemory: SignalSnapshot[] | null | undefined;
}): {
  executionOwnership: ReturnType<typeof resolveExecutionOwnership>;
  botCardsWithExecution: BotExecutionWorkspaceCard[];
} {
  const executionOwnership = resolveExecutionOwnership(input.botCards, input.recentOrders || []);
  const botCardsWithExecution = input.botCards.map((bot) => {
    const executionOrders = executionOwnership.ordersByBotId.get(bot.id) || [];
    const executionTimeline = executionOwnership.allEntries.filter((entry) => entry.botId === bot.id);
    const tradeTimeline = buildBotCanonicalTradeTimeline({
      decisionTimeline: bot.decisions,
      executionOrders,
      signals: input.signalMemory || [],
    });
    const tradeOrderIds = new Set(tradeTimeline.map((entry) => entry.orderId));
    const canonicalExecutionOrders = executionOrders.filter((order) => tradeOrderIds.has(Number(order.id)));
    const executionPerformance = canonicalExecutionOrders.length
      ? summarizeBotPerformanceFromOrders(canonicalExecutionOrders)
      : null;
    const latestExecution = executionTimeline[0] || null;

    return {
      ...bot,
      localMemory: {
        ...bot.localMemory,
        ...createOwnedMemorySummary("local", "Local", bot.decisionTimeline, executionTimeline),
      },
      performance: executionPerformance
        ? {
            ...bot.performance,
            ...executionPerformance,
          }
        : bot.performance,
      audit: latestExecution
        ? {
            ...bot.audit,
            lastExecutionAt: latestExecution.updatedAt || latestExecution.createdAt,
          }
        : bot.audit,
      activity: latestExecution
        ? {
            ...bot.activity,
            executedCount: Math.max(bot.activity.executedCount, tradeTimeline.length),
            recentSymbols: [...new Set([
              latestExecution.symbol,
              ...bot.activity.recentSymbols,
              ...tradeTimeline.map((item) => item.symbol),
            ].filter(Boolean))].slice(0, 6),
          }
        : bot.activity,
      executionOrders,
      executionTimeline,
      tradeTimeline,
      executionBreakdowns: createExecutionBreakdowns(canonicalExecutionOrders),
      ownership: createOwnershipSummary(bot.decisionTimeline, executionTimeline),
      executionIntentSummary: createExecutionIntentSummary(bot.decisions),
    };
  });

  return {
    executionOwnership,
    botCardsWithExecution: botCardsWithExecution as BotExecutionWorkspaceCard[],
  };
}

export function createBotCardsWithOperationalContext(botCardsWithExecution: BotExecutionWorkspaceCard[]): {
  botCardsWithOperationalContention: BotOperationalWorkspaceCard[];
  fleetOperationalReadiness: FleetOperationalReadiness;
  readyContention: ReadyContention;
  fleetQueueChurn: FleetQueueChurn;
  fleetSafeLaneStability: FleetSafeLaneStability;
  fleetOperationalVerdict: FleetOperationalVerdict;
} {
  const botCardsWithSharedMemory = botCardsWithExecution.map((bot) => {
    const familyBots = botCardsWithExecution.filter((candidate) => candidate.identity.family === bot.identity.family);
    const familyDecisionTimeline = familyBots.flatMap((candidate) => candidate.decisionTimeline);
    const familyExecutionTimeline = familyBots.flatMap((candidate) => candidate.executionTimeline || []);
    const globalDecisionTimeline = botCardsWithExecution.flatMap((candidate) => candidate.decisionTimeline);
    const globalExecutionTimeline = botCardsWithExecution.flatMap((candidate) => candidate.executionTimeline || []);

    return {
      ...bot,
      familyMemory: {
        ...bot.familyMemory,
        ...(bot.memoryPolicy.familySharingEnabled
          ? createOwnedMemorySummary("family", "Family", familyDecisionTimeline, familyExecutionTimeline)
          : createDisabledMemoryLayerSummary("family", "Family")),
      },
      globalMemory: {
        ...bot.globalMemory,
        ...(bot.memoryPolicy.globalLearningEnabled
          ? createOwnedMemorySummary("global", "Platform", globalDecisionTimeline, globalExecutionTimeline)
          : createDisabledMemoryLayerSummary("global", "Global")),
      },
      adaptationSummary: createAdaptationSummary(
        bot.executionBreakdowns?.length ? bot.executionBreakdowns : bot.performanceBreakdowns,
        bot.ownership!,
        bot.performance,
      ),
      operationalReadiness: createOperationalReadinessSummary({
        status: bot.status,
        executionEnvironment: bot.executionEnvironment,
        executionIntentSummary: bot.executionIntentSummary,
      }),
    };
  });

  const fleetOperationalReadiness = summarizeFleetOperationalReadiness(botCardsWithSharedMemory);
  const readyContention = summarizeReadyContention(botCardsWithSharedMemory);
  const botCardsWithOperationalContention = botCardsWithSharedMemory.map((bot) => {
    const matchingEntry = readyContention.entries.find((entry) => entry.botIds.includes(bot.id)) || null;
    return {
      ...bot,
      readyContention: {
        isContended: Boolean(matchingEntry),
        pair: matchingEntry?.pair || (bot.workspaceSettings?.primaryPair || null),
        peerCount: matchingEntry ? Math.max(matchingEntry.count - 1, 0) : 0,
        peerNames: matchingEntry
          ? matchingEntry.botNames.filter((name) => name !== bot.name)
          : [],
        isLeader: matchingEntry ? matchingEntry.leaderBotId === bot.id : false,
        leaderBotName: matchingEntry?.leaderBotName || null,
        queuePosition: matchingEntry ? Math.max(matchingEntry.botIds.indexOf(bot.id) + 1, 0) : 0,
      },
    };
  }).map((bot) => {
    const attention = createBotAttentionSummary(bot);
    return {
      ...bot,
      attention,
      operationalReadiness: createOperationalReadinessSummary({
        status: bot.status,
        executionEnvironment: bot.executionEnvironment,
        attention,
        readyContention: bot.readyContention,
        executionIntentSummary: bot.executionIntentSummary,
      }),
    };
  });

  const fleetQueueChurn = summarizeFleetQueueChurn(botCardsWithOperationalContention);
  const fleetSafeLaneStability = summarizeFleetSafeLaneStability({
    totalBots: botCardsWithOperationalContention.length,
    operationalReadyBots: fleetOperationalReadiness.operationalReadyBots,
    recoveryBots: fleetOperationalReadiness.recoveryBots,
    finalReviewBots: fleetOperationalReadiness.finalReviewBots,
    contendedReadyBots: readyContention.contendedReadyBots,
    unstableQueueBots: fleetQueueChurn.unstableQueueBots,
  });
  const fleetOperationalVerdict = summarizeFleetOperationalVerdict({
    totalBots: botCardsWithOperationalContention.length,
    safeLaneStabilityState: fleetSafeLaneStability.state,
    safeLaneStabilityPct: fleetSafeLaneStability.stabilityPct,
    stableReadyBots: fleetSafeLaneStability.stableReadyBots,
    finalReviewBots: fleetOperationalReadiness.finalReviewBots,
    unstableQueueBots: fleetQueueChurn.unstableQueueBots,
    contendedReadyBots: readyContention.contendedReadyBots,
  });

  return {
    botCardsWithOperationalContention: botCardsWithOperationalContention as BotOperationalWorkspaceCard[],
    fleetOperationalReadiness,
    readyContention,
    fleetQueueChurn,
    fleetSafeLaneStability,
    fleetOperationalVerdict,
  };
}

export function createBotFleetSummary(input: {
  botCards: BotOperationalWorkspaceCard[];
  readyContention: ReadyContention;
  fleetOperationalReadiness: FleetOperationalReadiness;
  fleetQueueChurn: FleetQueueChurn;
  fleetSafeLaneStability: FleetSafeLaneStability;
  fleetOperationalVerdict: FleetOperationalVerdict;
  governedDemoGate: {
    state: string;
    note: string;
  };
  paperDemoOperationalStatus: {
    state: string;
    note: string;
    operationalBots: number;
    coveragePct: number;
  };
  botsOperationalNow: {
    state: string;
    note: string;
  };
}) {
  const activeBots = input.botCards.filter((bot) => bot.status === "active");
  const totalTrades = input.botCards.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0);
  const totalProfit = input.botCards.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0);
  const averageWinRate = input.botCards.length
    ? input.botCards.reduce((sum, bot) => sum + bot.performance.winRate, 0) / input.botCards.length
    : 0;
  const unresolvedOwnershipCount = input.botCards.reduce(
    (sum, bot) => sum + (bot.ownership?.unresolvedDecisionCount || 0) + (bot.ownership?.unlinkedExecutionCount || 0),
    0,
  );
  const ownedOutcomeCount = input.botCards.reduce((sum, bot) => sum + (bot.ownership?.ownedOutcomeCount || 0), 0);
  const fleetAdaptation = input.botCards.length ? summarizeFleetAdaptation(input.botCards) : {
    learningReadyBots: 0,
    highConfidenceBots: 0,
    mediumConfidenceBots: 0,
    lowConfidenceBots: 0,
  };
  const attentionCandidates = input.botCards
    .filter((bot) => (bot.attention?.score || 0) > 0)
    .sort((left, right) => (right.attention?.score || 0) - (left.attention?.score || 0));

  return {
    activeBots,
    attentionCandidates,
    attentionBots: attentionCandidates.slice(0, 3),
    botSummary: {
      totalBots: input.botCards.length,
      activeBots: activeBots.length,
      pausedBots: input.botCards.filter((bot) => bot.status === "paused").length,
      draftBots: input.botCards.filter((bot) => bot.status === "draft").length,
      totalTrades,
      totalProfit,
      averageWinRate,
      unresolvedOwnershipCount,
      ownedOutcomeCount,
      learningReadyBots: fleetAdaptation.learningReadyBots,
      highConfidenceBots: fleetAdaptation.highConfidenceBots,
      mediumConfidenceBots: fleetAdaptation.mediumConfidenceBots,
      lowConfidenceBots: fleetAdaptation.lowConfidenceBots,
      operationalReadyBots: input.fleetOperationalReadiness.operationalReadyBots,
      recoveryBots: input.fleetOperationalReadiness.recoveryBots,
      finalReviewBots: input.fleetOperationalReadiness.finalReviewBots,
      queueChurnBots: input.fleetQueueChurn.queueChurnBots,
      unstableQueueBots: input.fleetQueueChurn.unstableQueueBots,
      queueAutoPromotions: input.fleetQueueChurn.queueAutoPromotions,
      safeLaneStabilityState: input.fleetSafeLaneStability.state,
      safeLaneStabilityPct: input.fleetSafeLaneStability.stabilityPct,
      stableReadyBots: input.fleetSafeLaneStability.stableReadyBots,
      operationalVerdictState: input.fleetOperationalVerdict.state,
      operationalVerdictNote: input.fleetOperationalVerdict.note,
      governedDemoGateState: input.governedDemoGate.state,
      governedDemoGateNote: input.governedDemoGate.note,
      paperDemoOperationalState: input.paperDemoOperationalStatus.state,
      paperDemoOperationalNote: input.paperDemoOperationalStatus.note,
      paperDemoOperationalBots: input.paperDemoOperationalStatus.operationalBots,
      paperDemoOperationalCoveragePct: input.paperDemoOperationalStatus.coveragePct,
      botsOperationalNowState: input.botsOperationalNow.state,
      botsOperationalNowNote: input.botsOperationalNow.note,
      contendedReadySymbols: input.readyContention.contendedReadySymbols,
      contendedReadyBots: input.readyContention.contendedReadyBots,
    },
  };
}
