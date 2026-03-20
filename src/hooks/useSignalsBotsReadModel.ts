import { useMemo } from "react";
import type { ExecutionOrderRecord, SignalSnapshot } from "../types";
import {
  EMPTY_MEMORY_SUMMARY,
  EMPTY_PERFORMANCE_SUMMARY,
  INITIAL_BOT_REGISTRY_STATE,
  type BotExecutionIntentLane,
  type BotExecutionIntentLaneStatus,
  type BotExecutionIntentStatus,
  type BotExecutionIntentSummary,
  type BotPerformanceBreakdown,
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

function getDecisionRr(decision: { metadata?: Record<string, unknown> }) {
  const value = Number(decision.metadata?.rrRatio || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getDecisionStyle(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.style || decision.metadata?.dominantStyle || "").trim();
  return value || null;
}

function getDecisionStrategyId(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.strategyId || "").trim();
  return value || null;
}

function getDecisionMarketContext(decision: { metadata?: Record<string, unknown>; marketContextSignature?: string | null }) {
  const value = String(decision.metadata?.marketRegime || decision.marketContextSignature || "").trim();
  return value || null;
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
      executionOrderId: normalizeSignalId(decision.metadata?.executionOrderId) || null,
      executionIntentStatus: String(decision.metadata?.executionIntentStatus || ""),
      executionIntentLane: String(decision.metadata?.executionIntentLane || ""),
      executionIntentLaneStatus: String(decision.metadata?.executionIntentLaneStatus || ""),
      executionStatus: String(decision.metadata?.executionStatus || ""),
      executionOutcomeStatus: String(decision.metadata?.executionOutcomeStatus || ""),
      executionLinkedAt: String(decision.metadata?.executionLinkedAt || ""),
      linkedBy: String(decision.metadata?.linkedBy || ""),
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
  marketContextSignature?: string | null;
  status: string;
}>): BotPerformanceBreakdown[] {
  const groups = new Map<string, {
    origin: BotPerformanceBreakdown["origin"];
    style: string | null;
    strategyId: string | null;
    timeframe: string | null;
    symbol: string | null;
    marketContext: string | null;
    totalSignals: number;
    closedSignals: number;
    wins: number;
    losses: number;
    realizedPnlUsd: number;
    rrValues: number[];
  }>();

  for (const decision of decisions) {
    const pnlUsd = getDecisionPnl(decision);
    const closed = decision.status !== "pending";
    const strategyId = getDecisionStrategyId(decision);
    const style = getDecisionStyle(decision);
    const rr = getDecisionRr(decision);
    const marketContext = getDecisionMarketContext(decision);
    const key = [
      decision.source || "signal",
      decision.symbol || "unknown",
      decision.timeframe || "unknown",
      strategyId || "none",
      style || "none",
      marketContext || "none",
    ].join("|");

    const current = groups.get(key) || {
      origin: decision.source === "manual" ? "manual" : decision.source === "signal-core" ? "signal" : decision.source.includes("ai") ? "auto" : "bot",
      style,
      strategyId,
      timeframe: decision.timeframe || null,
      symbol: decision.symbol || null,
      marketContext,
      totalSignals: 0,
      closedSignals: 0,
      wins: 0,
      losses: 0,
      realizedPnlUsd: 0,
      rrValues: [],
    };
    current.totalSignals += 1;
    current.closedSignals += closed ? 1 : 0;
    current.wins += pnlUsd > 0 ? 1 : 0;
    current.losses += pnlUsd < 0 ? 1 : 0;
    current.realizedPnlUsd += pnlUsd;
    if (rr != null) current.rrValues.push(rr);
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((item) => ({
      origin: item.origin,
      style: item.style,
      strategyId: item.strategyId,
      timeframe: item.timeframe,
      symbol: item.symbol,
      marketContext: item.marketContext,
      totalSignals: item.totalSignals,
      closedSignals: item.closedSignals,
      winRate: item.closedSignals ? (item.wins / item.closedSignals) * 100 : 0,
      realizedPnlUsd: item.realizedPnlUsd,
      rrAverage: item.rrValues.length ? item.rrValues.reduce((sum, value) => sum + value, 0) / item.rrValues.length : null,
      drawdownPct: null,
      profitFactor: item.losses ? Math.max(item.realizedPnlUsd, 0) / Math.abs(Math.min(item.realizedPnlUsd, 0) || 1) : item.realizedPnlUsd > 0 ? item.realizedPnlUsd : null,
      positivePct: item.closedSignals ? (item.wins / item.closedSignals) * 100 : null,
      negativePct: item.closedSignals ? (item.losses / item.closedSignals) * 100 : null,
    }))
    .sort((left, right) => Math.abs(right.realizedPnlUsd) - Math.abs(left.realizedPnlUsd));
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

function getOrderContextSignature(order: ExecutionOrderRecord) {
  return normalizeToken(String(order.response_payload?.learning_snapshot?.contextSignature || ""));
}

function getDecisionContextSignature(decision: { marketContextSignature?: string | null; metadata?: Record<string, unknown> }) {
  return normalizeToken(String(decision.marketContextSignature || decision.metadata?.marketContextSignature || ""));
}

function getDecisionExecutionOrderId(decision: { metadata?: Record<string, unknown> }) {
  const nextValue = Number(decision.metadata?.executionOrderId || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function getDecisionObservedAt(decision: { metadata?: Record<string, unknown>; createdAt?: string }) {
  const value = String(decision.metadata?.signalObservedAt || decision.createdAt || "").trim();
  return value || "";
}

function isWithinMinutes(left: string, right: string, maxMinutes: number) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  return Math.abs(leftTime - rightTime) <= maxMinutes * 60_000;
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
  decisionExecutionOrderIds: Set<number>,
  decisionPairs: Set<string>,
  strategyIds: Set<string>,
  contextSignatures: Set<string>,
  decisionObservedAtValues: string[],
) {
  const orderSignalId = normalizeSignalId(order.signal_id);
  const orderPair = normalizePair(order.coin);
  const orderTimeframe = normalizeToken(order.timeframe);
  const orderStrategyId = getOrderStrategyId(order);
  const orderStrategyName = normalizeToken(order.strategy_name);
  const orderContextSignature = getOrderContextSignature(order);
  const orderTimestamp = getOrderTimestamp(order);
  const pairKey = orderPair && orderTimeframe ? `${orderPair}:${orderTimeframe}` : "";

  let score = 0;
  let reason = "unmatched";

  if (decisionExecutionOrderIds.has(Number(order.id))) {
    score += 180;
    reason = "execution-order-id";
  }

  if (orderSignalId && decisionSignalIds.has(orderSignalId)) {
    score += 100;
    reason = "signal-id";
  }

  if (orderContextSignature && contextSignatures.has(orderContextSignature)) {
    score += 42;
    reason = reason === "unmatched" ? "context-signature" : reason;
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

  if (orderTimestamp && decisionObservedAtValues.some((value) => isWithinMinutes(value, orderTimestamp, 360))) {
    score += 10;
    reason = reason === "unmatched" ? "time-window" : reason;
  }

  const botTerms = [bot.slug, bot.name, bot.identity.family].map(normalizeToken).filter(Boolean);
  if (botTerms.some((term) => orderStrategyName.includes(term))) {
    score += 12;
    reason = reason === "unmatched" ? "strategy-name" : reason;
  }

  return {
    score,
    reason,
    direct: reason === "signal-id" || reason === "execution-order-id",
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
      marketContextSignature?: string | null;
      metadata: Record<string, unknown>;
      createdAt?: string;
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
          const decisionExecutionOrderIds = new Set(
            bot.decisions
              .map((decision) => getDecisionExecutionOrderId(decision))
              .filter(Boolean),
          );
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
          const contextSignatures = new Set(
            bot.decisions
              .map((decision) => getDecisionContextSignature(decision))
              .filter(Boolean),
          );
          const decisionObservedAtValues = bot.decisions
            .map((decision) => getDecisionObservedAt(decision))
            .filter(Boolean);
          return {
            bot,
            match: scoreExecutionOrderForBot(
              order,
              bot,
              decisionSignalIds,
              decisionExecutionOrderIds,
              decisionPairs,
              strategyIds,
              contextSignatures,
              decisionObservedAtValues,
            ),
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

function createExecutionBreakdowns(orders: ExecutionOrderRecord[]): BotPerformanceBreakdown[] {
  const groups = new Map<string, {
    origin: BotPerformanceBreakdown["origin"];
    style: string | null;
    strategyId: string | null;
    timeframe: string | null;
    symbol: string | null;
    marketContext: string | null;
    totalSignals: number;
    closedSignals: number;
    wins: number;
    losses: number;
    realizedPnlUsd: number;
    rrValues: number[];
  }>();

  for (const order of orders) {
    const pnlUsd = getOrderPnl(order);
    const closed = hasClosedExecutionOutcome(order);
    const learning = order.response_payload?.learning_snapshot;
    const rrValue = Number(learning?.rrRatio || 0);
    const strategyId = String(learning?.primaryStrategyId || order.strategy_name || "").trim() || null;
    const marketContext = String(learning?.marketRegime || learning?.contextSignature || "").trim() || null;
    const key = [
      getOrderSource(order) || "runtime",
      order.coin || "unknown",
      order.timeframe || "unknown",
      strategyId || "none",
      marketContext || "none",
    ].join("|");

    const current = groups.get(key) || {
      origin: order.origin === "manual-user" ? "manual" : order.origin?.includes("signal") ? "signal" : order.origin === "runtime" ? "auto" : "bot",
      style: null,
      strategyId,
      timeframe: order.timeframe || null,
      symbol: order.coin || null,
      marketContext,
      totalSignals: 0,
      closedSignals: 0,
      wins: 0,
      losses: 0,
      realizedPnlUsd: 0,
      rrValues: [],
    };
    current.totalSignals += 1;
    current.closedSignals += closed ? 1 : 0;
    current.wins += pnlUsd > 0 ? 1 : 0;
    current.losses += pnlUsd < 0 ? 1 : 0;
    current.realizedPnlUsd += pnlUsd;
    if (Number.isFinite(rrValue) && rrValue > 0) current.rrValues.push(rrValue);
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((item) => ({
      origin: item.origin,
      style: item.style,
      strategyId: item.strategyId,
      timeframe: item.timeframe,
      symbol: item.symbol,
      marketContext: item.marketContext,
      totalSignals: item.totalSignals,
      closedSignals: item.closedSignals,
      winRate: item.closedSignals ? (item.wins / item.closedSignals) * 100 : 0,
      realizedPnlUsd: item.realizedPnlUsd,
      rrAverage: item.rrValues.length ? item.rrValues.reduce((sum, value) => sum + value, 0) / item.rrValues.length : null,
      drawdownPct: null,
      profitFactor: item.losses ? Math.max(item.realizedPnlUsd, 0) / Math.abs(Math.min(item.realizedPnlUsd, 0) || 1) : item.realizedPnlUsd > 0 ? item.realizedPnlUsd : null,
      positivePct: item.closedSignals ? (item.wins / item.closedSignals) * 100 : null,
      negativePct: item.closedSignals ? (item.losses / item.closedSignals) * 100 : null,
    }))
    .sort((left, right) => Math.abs(right.realizedPnlUsd) - Math.abs(left.realizedPnlUsd));
}

function createBotActivityTimeline<
  TDecision extends {
    id: string;
    executionOrderId?: number | null;
    updatedAt?: string;
    createdAt?: string;
  },
  TOrder extends {
    orderId: number;
    updatedAt?: string;
    createdAt?: string;
  },
>(decisionTimeline: TDecision[], executionTimeline: TOrder[]) {
  const executionByOrderId = new Map(
    executionTimeline
      .filter((entry) => Number.isFinite(Number(entry.orderId)) && Number(entry.orderId) > 0)
      .map((entry) => [Number(entry.orderId), entry]),
  );
  const linkedOrderIds = new Set<number>();

  const logs = decisionTimeline.map((decision) => {
    const linkedOrderId = Number(decision.executionOrderId || 0);
    const linkedOrder = linkedOrderId ? executionByOrderId.get(linkedOrderId) || null : null;
    if (linkedOrderId) linkedOrderIds.add(linkedOrderId);

    return {
      kind: "decision" as const,
      decision,
      linkedOrder,
    };
  });

  const unmatchedOrders = executionTimeline
    .filter((order) => !linkedOrderIds.has(Number(order.orderId || 0)))
    .map((order) => ({
      kind: "order" as const,
      order,
    }));

  return [...logs, ...unmatchedOrders]
    .sort((left, right) => new Date(
      (right.kind === "decision"
        ? right.linkedOrder?.updatedAt || right.decision.updatedAt || right.decision.createdAt
        : right.order.updatedAt || right.order.createdAt) || 0,
    ).getTime() - new Date(
      (left.kind === "decision"
        ? left.linkedOrder?.updatedAt || left.decision.updatedAt || left.decision.createdAt
        : left.order.updatedAt || left.order.createdAt) || 0,
    ).getTime());
}

function formatOwnedOutcomePnl(pnlUsd: number | null | undefined) {
  const value = Number(pnlUsd || 0);
  if (!Number.isFinite(value)) return "$0.00";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}$${value.toFixed(Math.abs(value) >= 100 ? 0 : 2)}`;
}

function createOwnedMemorySummary<
  TDecision extends {
    id: string;
    symbol?: string | null;
    updatedAt?: string;
    createdAt?: string;
  },
  TOrder extends {
    orderId: number;
    symbol?: string | null;
    status?: string | null;
    hasOutcome?: boolean;
    pnlUsd?: number;
    updatedAt?: string;
    createdAt?: string;
  },
>(
  layer: "local" | "family" | "global",
  label: string,
  decisionTimeline: TDecision[],
  executionTimeline: TOrder[],
) {
  const activityTimeline = createBotActivityTimeline(decisionTimeline, executionTimeline);
  const latestEntry = activityTimeline[0] || null;
  const linkedOutcomeCount = activityTimeline.filter((entry) => entry.kind === "decision" && entry.linkedOrder?.hasOutcome).length;
  const standaloneOutcomeCount = activityTimeline.filter((entry) => entry.kind === "order" && entry.order.hasOutcome).length;
  const outcomeCount = linkedOutcomeCount + standaloneOutcomeCount;
  const decisionCount = activityTimeline.filter((entry) => entry.kind === "decision").length;
  const unresolvedDecisionCount = activityTimeline.filter((entry) => entry.kind === "decision" && !entry.linkedOrder).length;
  const unlinkedOrderCount = activityTimeline.filter((entry) => entry.kind === "order").length;
  const symbols = [...new Set(activityTimeline
    .map((entry) => entry.kind === "decision" ? entry.decision.symbol : entry.order.symbol)
    .filter(Boolean))];
  const latestEntryAt = latestEntry
    ? latestEntry.kind === "decision"
      ? latestEntry.linkedOrder?.updatedAt || latestEntry.decision.updatedAt || latestEntry.decision.createdAt || null
      : latestEntry.order.updatedAt || latestEntry.order.createdAt || null
    : null;
  const latestNote = latestEntry
    ? latestEntry.kind === "decision"
      ? latestEntry.linkedOrder?.hasOutcome
        ? `${label} latest owned outcome: ${latestEntry.decision.symbol} ${String(latestEntry.linkedOrder.status || "").toLowerCase()} ${formatOwnedOutcomePnl(latestEntry.linkedOrder.pnlUsd)}.`
        : `${label} latest decision: ${latestEntry.decision.symbol} still awaiting owned execution linkage.`
      : `${label} latest unlinked execution: ${latestEntry.order.symbol} ${String(latestEntry.order.status || "").toLowerCase()} ${formatOwnedOutcomePnl(latestEntry.order.pnlUsd)}.`
    : `No ${label.toLowerCase()} memory yet.`;

  return {
    layer,
    lastUpdatedAt: latestEntryAt,
    signalCount: activityTimeline.length,
    decisionCount,
    outcomeCount,
    notes: [
      latestNote,
      `${decisionCount} decisions, ${outcomeCount} owned outcomes, ${unlinkedOrderCount} unlinked executions.`,
      `${symbols.length} symbols touched across this ${label.toLowerCase()} layer.`,
      unresolvedDecisionCount ? `${unresolvedDecisionCount} decisions still need execution ownership.` : `${label} decisions are currently reconciled against owned execution history.`,
    ],
  };
}

function createOwnershipSummary<
  TDecision extends {
    id: string;
    symbol?: string | null;
    status?: string | null;
    executionOrderId?: number | null;
  },
  TOrder extends {
    orderId: number;
    symbol?: string | null;
    hasOutcome?: boolean;
  },
>(
  decisionTimeline: TDecision[],
  executionTimeline: TOrder[],
) {
  const activityTimeline = createBotActivityTimeline(decisionTimeline, executionTimeline);
  const linkedDecisions = activityTimeline.filter((entry) => entry.kind === "decision" && Boolean(entry.linkedOrder));
  const unresolvedDecisions = activityTimeline.filter((entry): entry is Extract<(typeof activityTimeline)[number], { kind: "decision" }> => (
    entry.kind === "decision"
    && !entry.linkedOrder
    && entry.decision.status !== "blocked"
    && entry.decision.status !== "dismissed"
  ));
  const unlinkedExecutions = activityTimeline.filter((entry): entry is Extract<(typeof activityTimeline)[number], { kind: "order" }> => entry.kind === "order");
  const ownedOutcomes = activityTimeline.filter((entry) => (
    entry.kind === "decision"
      ? Boolean(entry.linkedOrder?.hasOutcome)
      : Boolean(entry.order.hasOutcome)
  ));
  const reconciliationPct = decisionTimeline.length
    ? (linkedDecisions.length / decisionTimeline.length) * 100
    : 100;
  const unresolvedOwnershipCount = unresolvedDecisions.length + unlinkedExecutions.length;
  const ownedOutcomeRate = decisionTimeline.length
    ? (ownedOutcomes.length / decisionTimeline.length) * 100
    : 0;
  const unresolvedRate = activityTimeline.length
    ? (unresolvedOwnershipCount / activityTimeline.length) * 100
    : 0;
  const unresolvedDecisionRanking = summarizeSymbolFrequency(
    unresolvedDecisions.map((entry) => entry.decision.symbol),
  );
  const unlinkedExecutionRanking = summarizeSymbolFrequency(
    unlinkedExecutions.map((entry) => entry.order.symbol),
  );
  const unresolvedDecisionSymbols = [...new Set(unresolvedDecisions
    .map((entry) => entry.decision.symbol)
    .filter(Boolean))].slice(0, 3);
  const unlinkedExecutionSymbols = [...new Set(unlinkedExecutions
    .map((entry) => entry.order.symbol)
    .filter(Boolean))].slice(0, 3);
  const healthLabel = unresolvedOwnershipCount === 0
    ? "healthy"
    : reconciliationPct >= 75 && unresolvedRate <= 25
      ? "stable"
      : reconciliationPct >= 50
        ? "watch"
        : "needs-attention";
  const primaryIssue = unresolvedDecisions.length >= unlinkedExecutions.length
    ? "decision-linkage"
    : "execution-linkage";

  return {
    decisionCount: decisionTimeline.length,
    linkedDecisionCount: linkedDecisions.length,
    unresolvedDecisionCount: unresolvedDecisions.length,
    unlinkedExecutionCount: unlinkedExecutions.length,
    unresolvedOwnershipCount,
    ownedOutcomeCount: ownedOutcomes.length,
    reconciliationPct,
    ownedOutcomeRate,
    unresolvedRate,
    healthLabel,
    primaryIssue,
    unresolvedDecisionSymbols,
    unlinkedExecutionSymbols,
    unresolvedDecisionRanking,
    unlinkedExecutionRanking,
  };
}

function summarizeSymbolFrequency(symbols: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  symbols
    .filter((value): value is string => Boolean(value))
    .forEach((symbol) => {
      counts.set(symbol, (counts.get(symbol) || 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([symbol, count]) => ({ symbol, count }));
}

function getDecisionExecutionIntentStatus(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentStatus || "").trim() as BotExecutionIntentStatus | "";
  return value || null;
}

function getDecisionGuardrailCode(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.guardrailCode || "").trim();
  return value || null;
}

function getDecisionGuardrailReason(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.guardrailReason || "").trim();
  return value || null;
}

function getDecisionExecutionIntentLane(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentLane || "").trim() as BotExecutionIntentLane | "";
  return value || null;
}

function getDecisionExecutionIntentLaneStatus(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentLaneStatus || "").trim() as BotExecutionIntentLaneStatus | "";
  return value || null;
}

function createExecutionIntentSummary<
  TDecision extends {
    symbol?: string | null;
    createdAt?: string;
    updatedAt?: string;
    metadata?: Record<string, unknown>;
  },
>(decisions: TDecision[]): BotExecutionIntentSummary {
  const ranked = decisions
    .map((decision) => ({
      decision,
      intentStatus: getDecisionExecutionIntentStatus(decision),
      lane: getDecisionExecutionIntentLane(decision),
      laneStatus: getDecisionExecutionIntentLaneStatus(decision),
      updatedAt: decision.updatedAt || decision.createdAt || null,
    }))
    .filter((entry): entry is typeof entry & { intentStatus: BotExecutionIntentStatus } => Boolean(entry.intentStatus))
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());

  const latest = ranked[0] || null;

  return {
    totalCount: ranked.length,
    readyCount: ranked.filter((entry) => entry.intentStatus === "ready").length,
    approvalNeededCount: ranked.filter((entry) => entry.intentStatus === "approval-needed").length,
    assistOnlyCount: ranked.filter((entry) => entry.intentStatus === "assist-only").length,
    observeOnlyCount: ranked.filter((entry) => entry.intentStatus === "observe-only").length,
    guardrailBlockedCount: ranked.filter((entry) => entry.intentStatus === "guardrail-blocked").length,
    autoExecutableCount: ranked.filter((entry) => entry.intentStatus === "ready").length,
    queuedCount: ranked.filter((entry) => entry.laneStatus === "queued").length,
    awaitingApprovalCount: ranked.filter((entry) => entry.laneStatus === "awaiting-approval").length,
    blockedLaneCount: ranked.filter((entry) => entry.laneStatus === "blocked").length,
    linkedCount: ranked.filter((entry) => entry.laneStatus === "linked").length,
    latestIntentStatus: latest?.intentStatus || null,
    latestLane: latest?.lane || null,
    latestLaneStatus: latest?.laneStatus || null,
    latestIntentSymbol: latest?.decision.symbol || null,
    latestIntentAt: latest?.updatedAt || null,
    latestGuardrailCode: latest ? getDecisionGuardrailCode(latest.decision) : null,
    latestGuardrailReason: latest ? getDecisionGuardrailReason(latest.decision) : null,
    topReadySymbols: summarizeSymbolFrequency(
      ranked
        .filter((entry) => entry.intentStatus === "ready")
        .map((entry) => entry.decision.symbol),
    ),
    topBlockedSymbols: summarizeSymbolFrequency(
      ranked
        .filter((entry) => entry.laneStatus === "blocked")
        .map((entry) => entry.decision.symbol),
    ),
  };
}

function createAdaptationSummary(
  performanceBreakdowns: BotPerformanceBreakdown[],
  ownership: {
    ownedOutcomeRate: number;
    unresolvedRate: number;
    healthLabel: string;
    ownedOutcomeCount: number;
  },
  performance: {
    avgPnlUsd: number;
    bestSymbol?: string | null;
    worstSymbol?: string | null;
  },
) {
  const strongestBreakdown = performanceBreakdowns[0] || null;
  const weakestBreakdown = performanceBreakdowns
    .slice()
    .sort((left, right) => left.realizedPnlUsd - right.realizedPnlUsd)[0] || null;
  const trainingConfidence = ownership.ownedOutcomeRate >= 70 && ownership.healthLabel !== "needs-attention"
    ? "high"
    : ownership.ownedOutcomeRate >= 40
      ? "medium"
      : "low";

  return {
    trainingConfidence,
    bestEdge: strongestBreakdown
      ? `${strongestBreakdown.symbol || strongestBreakdown.strategyId || strongestBreakdown.timeframe || "Owned flow"} is leading.`
      : "The bot still needs more owned outcomes before a leading edge is clear.",
    weakness: weakestBreakdown && weakestBreakdown.realizedPnlUsd < 0
      ? `${weakestBreakdown.symbol || weakestBreakdown.strategyId || weakestBreakdown.timeframe || "One flow"} is still underperforming.`
      : "No persistent weak pocket is standing out yet.",
    adaptationBias: performance.avgPnlUsd > 0
      ? "Owned outcomes support keeping adaptive adjustments enabled."
      : "Adaptive adjustments should stay cautious until outcomes improve.",
    trustedOutcomeCount: ownership.ownedOutcomeCount,
    unresolvedRate: ownership.unresolvedRate,
    bestSymbol: performance.bestSymbol || strongestBreakdown?.symbol || null,
    weakestSymbol: performance.worstSymbol || weakestBreakdown?.symbol || null,
  };
}

function summarizeFleetAdaptation(
  bots: Array<{
    adaptationSummary?: {
      trainingConfidence: string;
    } | null;
    ownership: {
      ownedOutcomeCount: number;
      healthLabel: string;
    };
  }>,
) {
  const highConfidenceBots = bots.filter((bot) => bot.adaptationSummary?.trainingConfidence === "high").length;
  const mediumConfidenceBots = bots.filter((bot) => bot.adaptationSummary?.trainingConfidence === "medium").length;
  const lowConfidenceBots = bots.filter((bot) => bot.adaptationSummary?.trainingConfidence === "low").length;
  const learningReadyBots = bots.filter((bot) => bot.ownership.ownedOutcomeCount > 0 && bot.ownership.healthLabel !== "needs-attention").length;

  return {
    highConfidenceBots,
    mediumConfidenceBots,
    lowConfidenceBots,
    learningReadyBots,
  };
}

function createBotAttentionSummary(bot: {
  ownership: {
    unresolvedOwnershipCount: number;
    reconciliationPct: number;
  };
  adaptationSummary?: {
    trainingConfidence: string;
    adaptationBias: string;
  } | null;
}) {
  let score = 0;
  score += bot.ownership.unresolvedOwnershipCount * 10;
  score += Math.max(0, 100 - bot.ownership.reconciliationPct);

  if (bot.adaptationSummary?.trainingConfidence === "low") score += 20;
  if (bot.adaptationSummary?.trainingConfidence === "medium") score += 8;

  const priority = score >= 90 ? "urgent" : score >= 45 ? "watch" : score > 0 ? "monitor" : "clear";

  return {
    score,
    priority,
    note: bot.adaptationSummary?.adaptationBias || "Adaptation will stay conservative until owned outcomes improve.",
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
        ownership: createOwnershipSummary(bot.decisionTimeline, executionTimeline),
        executionIntentSummary: createExecutionIntentSummary(bot.decisions),
      };
    });
    const botCardsWithSharedMemory = botCardsWithExecution.map((bot) => {
      const familyBots = botCardsWithExecution.filter((candidate) => candidate.identity.family === bot.identity.family);
      const familyDecisionTimeline = familyBots.flatMap((candidate) => candidate.decisionTimeline);
      const familyExecutionTimeline = familyBots.flatMap((candidate) => candidate.executionTimeline);
      const globalDecisionTimeline = botCardsWithExecution.flatMap((candidate) => candidate.decisionTimeline);
      const globalExecutionTimeline = botCardsWithExecution.flatMap((candidate) => candidate.executionTimeline);

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
          bot.ownership,
          bot.performance,
        ),
      };
    }).map((bot) => ({
      ...bot,
      attention: createBotAttentionSummary(bot),
    }));

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
    const selectedBotActivityTimeline = createBotActivityTimeline(
      selectedBotDecisionTimeline,
      selectedBotExecutionTimeline,
    ).slice(0, 12);
    const selectedBotPerformanceBreakdowns = (selectedBotCard?.executionBreakdowns?.length
      ? selectedBotCard.executionBreakdowns
      : selectedBotCard?.performanceBreakdowns) || [];
    const selectedBotAdaptationSummary = selectedBotCard
      ? createAdaptationSummary(
          selectedBotPerformanceBreakdowns,
          selectedBotCard.ownership,
          selectedBotCard.performance,
        )
      : null;
    const selectedBotExecutionIntentSummary = selectedBotCard?.executionIntentSummary || null;
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
    const allBotActivityTimeline = createBotActivityTimeline(allBotDecisionTimeline, allBotExecutionTimeline);
    const totalTrades = botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0);
    const totalProfit = botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0);
    const averageWinRate = botCardsWithSharedMemory.length
      ? botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.performance.winRate, 0) / botCardsWithSharedMemory.length
      : 0;
    const unresolvedOwnershipCount = botCardsWithSharedMemory.reduce(
      (sum, bot) => sum + bot.ownership.unresolvedDecisionCount + bot.ownership.unlinkedExecutionCount,
      0,
    );
    const ownedOutcomeCount = botCardsWithSharedMemory.reduce((sum, bot) => sum + bot.ownership.ownedOutcomeCount, 0);
    const fleetAdaptation = summarizeFleetAdaptation(botCardsWithSharedMemory);
    const attentionCandidates = botCardsWithSharedMemory
      .filter((bot) => bot.attention.score > 0)
      .sort((left, right) => right.attention.score - left.attention.score);
    const attentionBots = attentionCandidates
      .slice(0, 3);

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
      selectedBotAdaptationSummary,
      selectedBotExecutionIntentSummary,
      attentionBots,
      attentionBotIds: attentionCandidates.map((bot) => bot.id),
      allBotDecisionTimeline,
      allBotExecutionTimeline,
      allBotActivityTimeline,
      botSummary: {
        totalBots: botCardsWithSharedMemory.length,
        activeBots: activeBots.length,
        pausedBots: botCardsWithSharedMemory.filter((bot) => bot.status === "paused").length,
        draftBots: botCardsWithSharedMemory.filter((bot) => bot.status === "draft").length,
        totalTrades,
        totalProfit,
        averageWinRate,
        unresolvedOwnershipCount,
        ownedOutcomeCount,
        learningReadyBots: fleetAdaptation.learningReadyBots,
        highConfidenceBots: fleetAdaptation.highConfidenceBots,
        mediumConfidenceBots: fleetAdaptation.mediumConfidenceBots,
        lowConfidenceBots: fleetAdaptation.lowConfidenceBots,
      },
    };
  }, [core, decisions, executionLogs.recentOrders, registryState, selectedBotId]);
}
