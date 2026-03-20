import { useMemo } from "react";
import type { ExecutionOrderRecord, SignalSnapshot } from "../types";
import {
  EMPTY_MEMORY_SUMMARY,
  EMPTY_PERFORMANCE_SUMMARY,
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
  summarizeBotPerformanceFromOrders,
  summarizeBotDecisionRuntime,
} from "../domain";
import { useExecutionLogsSelector } from "../data-platform/selectors";
import { useMarketSignalsCore } from "./useMarketSignalsCore";
import { useBotDecisionsState } from "./useBotDecisions";
import { useSelectedBotState } from "./useSelectedBot";

function getDecisionPnl(decision: { metadata?: Record<string, unknown> }) {
  const nextValue = Number(decision.metadata?.realizedPnlUsd || decision.metadata?.pnlUsd || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function getDecisionSummary(decision: { symbol: string; timeframe: string; action: string; status: string; source: string }) {
  return `${decision.action} • ${decision.symbol} • ${decision.timeframe} • ${decision.status} • ${decision.source}`;
}

function createDecisionTimeline(decisions: Array<{
  id: string;
  symbol: string;
  timeframe: string;
  action: string;
  status: string;
  source: string;
  executionEnvironment: string;
  automationMode: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>) {
  return decisions
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
    .map((decision) => ({
      id: decision.id,
      symbol: decision.symbol,
      timeframe: decision.timeframe,
      action: decision.action,
      status: decision.status,
      source: decision.source,
      environment: decision.executionEnvironment,
      automationMode: decision.automationMode,
      pnlUsd: getDecisionPnl(decision),
      entryPrice: Number(decision.metadata?.entryPrice || 0) || null,
      targetPrice: Number(decision.metadata?.targetPrice || 0) || null,
      strategyId: String(decision.metadata?.strategyId || ""),
      rankingTier: String(decision.metadata?.rankingTier || ""),
      observedAt: String(decision.metadata?.signalObservedAt || decision.createdAt),
      createdAt: decision.createdAt,
      updatedAt: decision.updatedAt,
      summary: getDecisionSummary(decision),
    }));
}

function createPerformanceBreakdowns(decisions: Array<{
  symbol: string;
  timeframe: string;
  source: string;
  metadata: Record<string, unknown>;
  status: string;
}>) {
  const groups = new Map<string, {
    dimension: string;
    label: string;
    total: number;
    closed: number;
    wins: number;
    pnlUsd: number;
  }>();

  for (const decision of decisions) {
    const pnlUsd = getDecisionPnl(decision);
    const closed = decision.status !== "pending";
    const dimensions = [
      { dimension: "symbol", label: decision.symbol || "Unknown" },
      { dimension: "timeframe", label: decision.timeframe || "Unknown" },
      { dimension: "source", label: decision.source || "Unknown" },
    ];

    for (const item of dimensions) {
      const key = `${item.dimension}:${item.label}`;
      const current = groups.get(key) || {
        dimension: item.dimension,
        label: item.label,
        total: 0,
        closed: 0,
        wins: 0,
        pnlUsd: 0,
      };
      current.total += 1;
      current.closed += closed ? 1 : 0;
      current.wins += pnlUsd > 0 ? 1 : 0;
      current.pnlUsd += pnlUsd;
      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      winRate: item.closed ? (item.wins / item.closed) * 100 : 0,
      avgPnlUsd: item.closed ? item.pnlUsd / item.closed : 0,
    }))
    .sort((left, right) => Math.abs(right.pnlUsd) - Math.abs(left.pnlUsd));
}

function createMemoryLayerSummary(
  layer: "family" | "global",
  decisions: Array<{
    symbol: string;
    timeframe: string;
    action: string;
    status: string;
    updatedAt: string;
    createdAt: string;
  }>,
  label: string,
) {
  const orderedDecisions = decisions
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
  const latestDecision = orderedDecisions[0] || null;
  const closedCount = orderedDecisions.filter((decision) => decision.status !== "pending").length;
  const symbols = [...new Set(orderedDecisions.map((decision) => decision.symbol).filter(Boolean))];

  return {
    layer,
    lastUpdatedAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
    signalCount: orderedDecisions.length,
    decisionCount: orderedDecisions.length,
    outcomeCount: closedCount,
    notes: latestDecision
      ? [
          `${label} last action: ${latestDecision.action} on ${latestDecision.symbol} (${latestDecision.timeframe}).`,
          `${symbols.length} symbols covered in this layer.`,
        ]
      : [`No ${label.toLowerCase()} memory yet.`],
  };
}

function createDisabledMemoryLayerSummary(layer: "family" | "global", label: string) {
  return {
    layer,
    lastUpdatedAt: null,
    signalCount: 0,
    decisionCount: 0,
    outcomeCount: 0,
    notes: [`${label} sharing is currently disabled.`],
  };
}

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

function normalizeToken(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function getOrderTimestamp(order: ExecutionOrderRecord) {
  return order.closed_at || order.last_synced_at || order.created_at;
}

function getOrderPnl(order: ExecutionOrderRecord) {
  const nextValue = Number(order.realized_pnl || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function getOrderStrategyId(order: ExecutionOrderRecord) {
  return normalizeToken(
    String(order.response_payload?.learning_snapshot?.primaryStrategyId || order.strategy_name || ""),
  );
}

function getOrderSource(order: ExecutionOrderRecord) {
  return String(
    order.response_payload?.learning_snapshot?.decisionSource
    || order.origin
    || order.mode
    || "runtime",
  );
}

function hasClosedExecutionOutcome(order: ExecutionOrderRecord) {
  if (order.signal_outcome_status && order.signal_outcome_status !== "pending") {
    return true;
  }

  const lifecycleStatus = normalizeToken(order.lifecycle_status || order.status);
  return lifecycleStatus.startsWith("closed") || lifecycleStatus === "filled";
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

function scoreExecutionOrderForBot(
  order: ExecutionOrderRecord,
  bot: {
    id: string;
    slug: string;
    name: string;
    identity: { family: string };
    executionEnvironment: string;
    workspaceSettings: { primaryPair: string };
    timeframePolicy: { allowedTimeframes: string[] };
  },
  decisionSignalIds: Set<number>,
  decisionPairs: Set<string>,
  strategyIds: Set<string>,
) {
  const orderSignalId = normalizeSignalId(order.signal_id);
  const orderPair = normalizePair(order.coin);
  const orderTimeframe = normalizeToken(order.timeframe);
  const orderStrategyId = getOrderStrategyId(order);
  const orderStrategyName = normalizeToken(order.strategy_name);
  const pairKey = orderPair && orderTimeframe ? `${orderPair}:${orderTimeframe}` : "";

  let score = 0;
  let reason = "unmatched";

  if (orderSignalId && decisionSignalIds.has(orderSignalId)) {
    score += 100;
    reason = "signal-id";
  }

  if (pairKey && decisionPairs.has(pairKey)) {
    score += 24;
    reason = reason === "unmatched" ? "pair-timeframe" : reason;
  }

  if (orderPair && normalizePair(bot.workspaceSettings.primaryPair) === orderPair) {
    score += 18;
  }

  if (orderTimeframe && bot.timeframePolicy.allowedTimeframes.some((item) => normalizeToken(item) === orderTimeframe)) {
    score += 8;
  }

  if (orderStrategyId && strategyIds.has(orderStrategyId)) {
    score += 10;
    reason = reason === "unmatched" ? "strategy" : reason;
  }

  if (normalizeToken(bot.executionEnvironment) === normalizeToken(order.mode)) {
    score += 6;
  }

  const botTerms = [bot.slug, bot.name, bot.identity.family].map(normalizeToken).filter(Boolean);
  if (botTerms.some((term) => orderStrategyName.includes(term))) {
    score += 12;
    reason = reason === "unmatched" ? "strategy-name" : reason;
  }

  return {
    score,
    reason,
    direct: reason === "signal-id",
  };
}

function resolveExecutionOwnership(
  botCards: Array<{
    id: string;
    slug: string;
    name: string;
    identity: { family: string };
    executionEnvironment: string;
    workspaceSettings: { primaryPair: string };
    timeframePolicy: { allowedTimeframes: string[] };
    strategyPolicy: { allowedStrategyIds: string[]; preferredStrategyIds: string[] };
    decisions: Array<{
      id: string;
      symbol: string;
      timeframe: string;
      metadata: Record<string, unknown>;
    }>;
  }>,
  executionOrders: ExecutionOrderRecord[],
) {
  const ordersByBotId = new Map<string, ExecutionOrderRecord[]>();
  for (const bot of botCards) {
    ordersByBotId.set(bot.id, []);
  }

  const allEntries = executionOrders
    .map((order) => {
      const ranked = botCards
        .map((bot) => {
          const decisionSignalIds = new Set(bot.decisions.flatMap((decision) => [
            normalizeSignalId(decision.metadata.signalId),
            normalizeSignalId(decision.metadata.publishedSignalId),
          ]).filter(Boolean));
          const decisionPairs = new Set(
            bot.decisions
              .map((decision) => {
                const pair = normalizePair(decision.symbol);
                const timeframe = normalizeToken(decision.timeframe);
                return pair && timeframe ? `${pair}:${timeframe}` : "";
              })
              .filter(Boolean),
          );
          const strategyIds = new Set(
            [...bot.strategyPolicy.allowedStrategyIds, ...bot.strategyPolicy.preferredStrategyIds]
              .map(normalizeToken)
              .filter(Boolean),
          );
          return {
            bot,
            match: scoreExecutionOrderForBot(order, bot, decisionSignalIds, decisionPairs, strategyIds),
          };
        })
        .sort((left, right) => right.match.score - left.match.score);

      const bestMatch = ranked[0] || null;
      const resolvedBot = bestMatch && bestMatch.match.score >= 40 ? bestMatch.bot : null;
      if (resolvedBot) {
        ordersByBotId.set(resolvedBot.id, [...(ordersByBotId.get(resolvedBot.id) || []), order]);
      }

      return {
        id: `order-${order.id}`,
        orderId: order.id,
        botId: resolvedBot?.id || null,
        botName: resolvedBot?.name || null,
        botMatchReason: bestMatch?.match.reason || "unmatched",
        botMatchConfidence: bestMatch?.match.direct ? "direct" : resolvedBot ? "heuristic" : "none",
        symbol: order.coin,
        timeframe: order.timeframe || "",
        strategyId: getOrderStrategyId(order) || null,
        source: getOrderSource(order),
        lifecycleStatus: String(order.lifecycle_status || order.status || ""),
        mode: order.mode,
        status: String(order.signal_outcome_status || order.lifecycle_status || order.status || ""),
        pnlUsd: getOrderPnl(order),
        notionalUsd: Number(order.notional_usd || 0) || 0,
        quantity: Number(order.quantity || 0) || 0,
        entryPrice: Number(order.current_price || 0) || null,
        signalId: normalizeSignalId(order.signal_id) || null,
        hasOutcome: hasClosedExecutionOutcome(order),
        createdAt: order.created_at,
        updatedAt: getOrderTimestamp(order),
      };
    })
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());

  return {
    ordersByBotId,
    allEntries,
  };
}

function createExecutionBreakdowns(orders: ExecutionOrderRecord[]) {
  const groups = new Map<string, {
    dimension: string;
    label: string;
    total: number;
    closed: number;
    wins: number;
    pnlUsd: number;
  }>();

  for (const order of orders) {
    const pnlUsd = getOrderPnl(order);
    const closed = hasClosedExecutionOutcome(order);
    const dimensions = [
      { dimension: "symbol", label: order.coin || "Unknown" },
      { dimension: "timeframe", label: order.timeframe || "Unknown" },
      { dimension: "source", label: getOrderSource(order) || "Unknown" },
    ];

    for (const item of dimensions) {
      const key = `${item.dimension}:${item.label}`;
      const current = groups.get(key) || {
        dimension: item.dimension,
        label: item.label,
        total: 0,
        closed: 0,
        wins: 0,
        pnlUsd: 0,
      };
      current.total += 1;
      current.closed += closed ? 1 : 0;
      current.wins += pnlUsd > 0 ? 1 : 0;
      current.pnlUsd += pnlUsd;
      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      winRate: item.closed ? (item.wins / item.closed) * 100 : 0,
      avgPnlUsd: item.closed ? item.pnlUsd / item.closed : 0,
    }))
    .sort((left, right) => Math.abs(right.pnlUsd) - Math.abs(left.pnlUsd));
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
    localMemory: {
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
    audit: {
      lastDecisionAt: latestSignal?.updated_at || latestSignal?.created_at || null,
      lastExecutionAt: closedSignals[0]?.updated_at || closedSignals[0]?.created_at || null,
      lastPolicyChangeAt: null,
    },
    activity: {
      lastSignalConsumedAt: latestSignal?.created_at || null,
      lastSignalLayer: null,
      lastDecisionAction: null,
      lastDecisionStatus: null,
      lastDecisionSymbol: latestSignal?.coin || null,
      lastDecisionSource: null,
      pendingCount: scopedSignals.filter((signal) => signal.outcome_status === "pending").length,
      approvedCount: 0,
      blockedCount: 0,
      executedCount: closedSignals.length,
      recentDecisionIds: [],
      recentSymbols: [...new Set(scopedSignals.map((signal) => signal.coin).filter(Boolean))].slice(0, 6),
    },
  };
}

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
      const botDecisions = decisions.filter((decision) => decision.botId === bot.id);
      const acceptedSignals = filterSignalsForBotPair(selectAcceptedBotConsumableSignals(feed), primaryPair);
      const blockedSignals = filterSignalsForBotPair(selectBlockedBotConsumableSignals(feed), primaryPair);
      const scopedRankedSignals = filterSignalsForBotPair(rankedSignals, primaryPair);
      const accepted = acceptedSignals.length;
      const blocked = blockedSignals.length;
      const leadingSignal = acceptedSignals[0] || blockedSignals[0] || scopedRankedSignals[0] || null;
      const derivedRuntime = botDecisions.length
        ? summarizeBotDecisionRuntime(botDecisions)
        : summarizeSignalsPerformance(primaryPair, core.signalCore.signalMemory);
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
    const executionOwnership = resolveExecutionOwnership(botCards, executionLogs.recentOrders || []);
    const botCardsWithExecution = botCards.map((bot) => {
      const executionOrders = executionOwnership.ordersByBotId.get(bot.id) || [];
      const executionTimeline = executionOwnership.allEntries.filter((entry) => entry.botId === bot.id);
      const executionPerformance = executionOrders.length
        ? summarizeBotPerformanceFromOrders(executionOrders)
        : null;
      const latestExecution = executionTimeline[0] || null;

      return {
        ...bot,
        localMemory: {
          ...bot.localMemory,
          outcomeCount: Math.max(bot.localMemory.outcomeCount, executionTimeline.filter((item) => item.hasOutcome).length),
          notes: executionTimeline.length
            ? [`${executionTimeline.length} execution outcomes linked back to this bot.`]
            : bot.localMemory.notes,
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
              executedCount: Math.max(bot.activity.executedCount, executionTimeline.filter((item) => item.hasOutcome).length),
              recentSymbols: [...new Set([
                latestExecution.symbol,
                ...bot.activity.recentSymbols,
                ...executionTimeline.map((item) => item.symbol),
              ].filter(Boolean))].slice(0, 6),
            }
          : bot.activity,
        executionOrders,
        executionTimeline,
        executionBreakdowns: createExecutionBreakdowns(executionOrders),
      };
    });
    const botCardsWithSharedMemory = botCardsWithExecution.map((bot) => {
      const familyBots = botCardsWithExecution.filter((candidate) => candidate.identity.family === bot.identity.family);
      const familyDecisions = familyBots.flatMap((candidate) => candidate.decisions);
      const globalDecisions = botCardsWithExecution.flatMap((candidate) => candidate.decisions);

      return {
        ...bot,
        familyMemory: {
          ...bot.familyMemory,
          ...(bot.memoryPolicy.familySharingEnabled
            ? createMemoryLayerSummary("family", familyDecisions, `Family ${bot.memoryPolicy.familyScope || bot.identity.family}`)
            : createDisabledMemoryLayerSummary("family", "Family")),
        },
        globalMemory: {
          ...bot.globalMemory,
          ...(bot.memoryPolicy.globalLearningEnabled
            ? createMemoryLayerSummary("global", globalDecisions, "Platform")
            : createDisabledMemoryLayerSummary("global", "Global")),
        },
      };
    });

    const selectedBotCard = botCardsWithSharedMemory.find((bot) => bot.id === selectedBotId) || botCardsWithSharedMemory[0] || null;
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
    const selectedBotDecisionTimeline = selectedBotCard?.decisionTimeline?.slice(0, 12) || [];
    const selectedBotExecutionTimeline = selectedBotCard?.executionTimeline?.slice(0, 12) || [];
    const selectedBotActivityTimeline = [
      ...selectedBotDecisionTimeline.map((entry) => ({ kind: "decision" as const, ...entry })),
      ...selectedBotExecutionTimeline.map((entry) => ({ kind: "execution" as const, ...entry })),
    ]
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
      .slice(0, 12);
    const selectedBotPerformanceBreakdowns = (selectedBotCard?.executionBreakdowns?.length
      ? selectedBotCard.executionBreakdowns
      : selectedBotCard?.performanceBreakdowns) || [];
    const rankedSignalById = new Map(rankedSignals.map((signal) => [signal.id, signal]));
    const selectedBotApprovedRankedSignals = selectedBotApprovedSignals
      .map((signal) => rankedSignalById.get(signal.id) || null)
      .filter((signal): signal is (typeof rankedSignals)[number] => Boolean(signal));
    const activeBots = botCardsWithSharedMemory.filter((bot) => bot.status === "active");
    const allBotDecisionTimeline = botCardsWithSharedMemory
      .flatMap((bot) => bot.decisionTimeline.map((entry) => ({
        ...entry,
        botId: bot.id,
        botName: bot.name,
      })))
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
    const allBotExecutionTimeline = executionOwnership.allEntries;
    const totalTrades = botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0);
    const totalProfit = botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0);
    const averageWinRate = botCardsWithSharedMemory.length
      ? botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.performance.winRate, 0) / botCardsWithSharedMemory.length
      : 0;

    return {
      signalMemory: core.signalCore.signalMemory,
      activeWatchlistCoins: core.signalCore.activeWatchlistCoins,
      marketCore: core.marketCore,
      signalCore: core.signalCore,
      registry,
      bots,
      botCards: botCardsWithSharedMemory,
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
      selectedBotDecisionTimeline,
      selectedBotExecutionTimeline,
      selectedBotActivityTimeline,
      selectedBotPerformanceBreakdowns,
      allBotDecisionTimeline,
      allBotExecutionTimeline,
      botSummary: {
        totalBots: botCardsWithSharedMemory.length,
        activeBots: activeBots.length,
        pausedBots: botCardsWithSharedMemory.filter((bot) => bot.status === "paused").length,
        draftBots: botCardsWithSharedMemory.filter((bot) => bot.status === "draft").length,
        totalTrades,
        totalProfit,
        averageWinRate,
      },
    };
  }, [core, decisions, executionLogs.recentOrders, registryState, selectedBotId]);
}
