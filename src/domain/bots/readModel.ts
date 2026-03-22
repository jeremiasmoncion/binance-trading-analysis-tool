import type { ExecutionOrderRecord } from "../../types";
import type {
  BotExecutionIntentLane,
  BotExecutionIntentLaneStatus,
  BotExecutionIntentStatus,
  BotExecutionIntentSummary,
  BotPerformanceBreakdown,
} from "./contracts";

export function normalizePair(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeToken(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

export function getDecisionPnl(decision: { metadata?: Record<string, unknown> }) {
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

export function createDecisionTimeline(decisions: Array<{
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
      executionIntentLaneStatus: getEffectiveDecisionExecutionIntentLaneStatus(decision, 6) || "",
      executionIntentReason: String(decision.metadata?.executionIntentReason || decision.metadata?.guardrailReason || ""),
      executionIntentDispatchStatus: String(decision.metadata?.executionIntentDispatchStatus || ""),
      executionIntentDispatchMode: String(decision.metadata?.executionIntentDispatchMode || ""),
      executionIntentDispatchAttemptedAt: String(decision.metadata?.executionIntentDispatchAttemptedAt || ""),
      executionIntentDispatchedAt: String(decision.metadata?.executionIntentDispatchedAt || ""),
      executionIntentPreviewRefreshCount: Number(decision.metadata?.executionIntentPreviewRefreshCount || 0) || 0,
      executionIntentPreviewChurnPardonCount: Number(decision.metadata?.executionIntentPreviewChurnPardonCount || 0) || 0,
      executionIntentPreviewChurnManualClearCount: Number(decision.metadata?.executionIntentPreviewChurnManualClearCount || 0) || 0,
      executionIntentPreviewChurnHardResetCount: Number(decision.metadata?.executionIntentPreviewChurnHardResetCount || 0) || 0,
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

export function dedupeRankedSignals<T extends { id: string }>(signals: T[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
}

export function dedupeRankedSignalsByScope<T extends { id: string; context: { symbol: string; timeframe: string } }>(signals: T[]) {
  const seenScopes = new Set<string>();
  return signals.filter((signal) => {
    const scopeKey = `${normalizePair(signal.context.symbol)}|${normalizeToken(signal.context.timeframe)}`;
    if (seenScopes.has(scopeKey)) return false;
    seenScopes.add(scopeKey);
    return true;
  });
}

export function getPublishedSignalIdFromBotConsumableId(value: unknown) {
  const normalized = String(value || "").trim();
  const markerIndex = normalized.indexOf(":bot:");
  return markerIndex >= 0 ? normalized.slice(0, markerIndex) : normalized;
}

export function getDecisionPublishedSignalKey(decision: { metadata?: Record<string, unknown>; signalSnapshotId?: number | null }) {
  const publishedSignalId = getPublishedSignalIdFromBotConsumableId(decision.metadata?.publishedSignalId);
  if (publishedSignalId) return publishedSignalId;
  const signalId = getPublishedSignalIdFromBotConsumableId(decision.metadata?.signalId);
  if (signalId) return signalId;
  const snapshotId = normalizeSignalId(decision.signalSnapshotId);
  return snapshotId ? String(snapshotId) : "";
}

export function createPerformanceBreakdowns(decisions: Array<{
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

export function getOrderTimestamp(order: ExecutionOrderRecord) {
  return order.closed_at || order.last_synced_at || order.created_at;
}

export function getOrderPnl(order: ExecutionOrderRecord) {
  const nextValue = Number(order.realized_pnl || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function getOrderStrategyId(order: ExecutionOrderRecord) {
  return normalizeToken(
    String(order.response_payload?.learning_snapshot?.primaryStrategyId || order.strategy_name || ""),
  );
}

export function getOrderContextSignature(order: ExecutionOrderRecord) {
  return normalizeToken(String(order.response_payload?.learning_snapshot?.contextSignature || ""));
}

export function getOrderBotContextId(order: ExecutionOrderRecord) {
  const payload = order.response_payload as { botContext?: { botId?: string | null } } | null | undefined;
  const value = String(payload?.botContext?.botId || "").trim();
  return value || "";
}

export function getDecisionContextSignature(decision: { marketContextSignature?: string | null; metadata?: Record<string, unknown> }) {
  return normalizeToken(String(decision.marketContextSignature || decision.metadata?.marketContextSignature || ""));
}

export function getDecisionExecutionOrderId(decision: { metadata?: Record<string, unknown> }) {
  const nextValue = Number(decision.metadata?.executionOrderId || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

export function getDecisionObservedAt(decision: { metadata?: Record<string, unknown>; createdAt?: string }) {
  const value = String(decision.metadata?.signalObservedAt || decision.createdAt || "").trim();
  return value || "";
}

export function isWithinMinutes(left: string, right: string, maxMinutes: number) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  return Math.abs(leftTime - rightTime) <= maxMinutes * 60_000;
}

export function getOrderSource(order: ExecutionOrderRecord) {
  return String(
    order.response_payload?.learning_snapshot?.decisionSource
    || order.origin
    || order.mode
    || "runtime",
  );
}

export function getOrderSide(order: ExecutionOrderRecord) {
  const responsePayload = order.response_payload as {
    signal_context?: { direction?: string | null } | null;
    learning_snapshot?: { marketBias?: string | null } | null;
  } | null | undefined;
  return String(
    order.side
    || responsePayload?.signal_context?.direction
    || responsePayload?.learning_snapshot?.marketBias
    || "",
  ).trim().toUpperCase();
}

export function hasClosedExecutionOutcome(order: ExecutionOrderRecord) {
  if (order.signal_outcome_status && order.signal_outcome_status !== "pending") {
    return true;
  }

  const lifecycleStatus = normalizeToken(order.lifecycle_status || order.status);
  return lifecycleStatus.startsWith("closed") || lifecycleStatus === "filled";
}

export function filterSignalsForBotScope<T extends { context: { symbol: string; timeframe: string } }>(
  signals: T[],
  symbols: string[],
  primaryPair: string,
  allowedTimeframes: string[] = [],
) {
  const normalizedSymbols = [...new Set(
    (symbols || [])
      .map((symbol) => normalizePair(symbol))
      .filter(Boolean),
  )];
  const normalizedPrimaryPair = normalizePair(primaryPair);
  const scope = normalizedSymbols.length
    ? normalizedSymbols
    : normalizedPrimaryPair
      ? [normalizedPrimaryPair]
      : [];
  const normalizedTimeframes = [...new Set(
    (allowedTimeframes || [])
      .map((timeframe) => normalizeToken(timeframe))
      .filter(Boolean),
  )];

  return signals.filter((signal) => {
    const symbolMatches = !scope.length || scope.includes(normalizePair(signal.context.symbol));
    const timeframeMatches = !normalizedTimeframes.length || normalizedTimeframes.includes(normalizeToken(signal.context.timeframe));
    return symbolMatches && timeframeMatches;
  });
}

export function resolveBotScopeSymbols(
  bot: {
    universePolicy?: {
      kind?: string | null;
      symbols?: string[] | null;
    } | null;
    workspaceSettings?: {
      primaryPair?: string | null;
    } | null;
  },
  activeWatchlistCoins: string[],
) {
  const explicitSymbols = [...new Set(
    (bot.universePolicy?.symbols || [])
      .map((symbol) => normalizePair(symbol))
      .filter(Boolean),
  )];
  const watchlistSymbols = [...new Set(
    (activeWatchlistCoins || [])
      .map((symbol) => normalizePair(symbol))
      .filter(Boolean),
  )];
  const primaryPair = normalizePair(bot.workspaceSettings?.primaryPair || "");
  const kind = String(bot.universePolicy?.kind || "").trim().toLowerCase();

  if (kind === "watchlist") {
    return explicitSymbols.length
      ? [...new Set([...watchlistSymbols, ...explicitSymbols])]
      : watchlistSymbols;
  }

  if (kind === "hybrid") {
    return [...new Set([...explicitSymbols, ...watchlistSymbols])];
  }

  if (explicitSymbols.length) return explicitSymbols;
  if (watchlistSymbols.length && !primaryPair) return watchlistSymbols;
  return primaryPair ? [primaryPair] : [];
}

export function summarizeSymbolFrequency(symbols: Array<string | null | undefined>) {
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

export function getDecisionExecutionIntentStatus(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentStatus || "").trim() as BotExecutionIntentStatus | "";
  return value || null;
}

export function getDecisionGuardrailCode(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.guardrailCode || "").trim();
  return value || null;
}

export function getDecisionGuardrailReason(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.guardrailReason || decision.metadata?.executionIntentReason || "").trim();
  return value || null;
}

export function getDecisionExecutionIntentLane(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentLane || "").trim() as BotExecutionIntentLane | "";
  return value || null;
}

export function getDecisionExecutionIntentLaneStatus(decision: { metadata?: Record<string, unknown> }) {
  const value = String(decision.metadata?.executionIntentLaneStatus || "").trim() as BotExecutionIntentLaneStatus | "";
  return value || null;
}

function isOlderThanHours(value: string | null | undefined, hours: number) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp > hours * 60 * 60 * 1000;
}

export function getEffectiveDecisionExecutionIntentLaneStatus(
  decision: { metadata?: Record<string, unknown>; updatedAt?: string; createdAt?: string },
  previewStaleHours: number,
) {
  const laneStatus = getDecisionExecutionIntentLaneStatus(decision);
  if (laneStatus === "preview-recorded" && isOlderThanHours(decision.updatedAt || decision.createdAt || null, previewStaleHours)) {
    return "preview-expired" as const;
  }
  return laneStatus;
}

export function createExecutionIntentSummary<
  TDecision extends {
    symbol?: string | null;
    createdAt?: string;
    updatedAt?: string;
    metadata?: Record<string, unknown>;
  },
>(decisions: TDecision[]): BotExecutionIntentSummary {
  const previewStaleHours = 6;
  const ranked = decisions
    .map((decision) => ({
      decision,
      intentStatus: getDecisionExecutionIntentStatus(decision),
      lane: getDecisionExecutionIntentLane(decision),
      laneStatus: getEffectiveDecisionExecutionIntentLaneStatus(decision, previewStaleHours),
      previewRefreshCount: Number(decision.metadata?.executionIntentPreviewRefreshCount || 0) || 0,
      previewPardonCount: Number(decision.metadata?.executionIntentPreviewChurnPardonCount || 0) || 0,
      previewManualClearCount: Number(decision.metadata?.executionIntentPreviewChurnManualClearCount || 0) || 0,
      previewHardResetCount: Number(decision.metadata?.executionIntentPreviewChurnHardResetCount || 0) || 0,
      readyContentionAutoPromotionCount: Number(decision.metadata?.executionIntentReadyContentionAutoPromotionCount || 0) || 0,
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
    dispatchRequestedCount: ranked.filter((entry) => entry.laneStatus === "dispatch-requested").length,
    dispatchedCount: ranked.filter((entry) => entry.laneStatus === "previewed" || entry.laneStatus === "preview-recorded" || entry.laneStatus === "preview-expired" || entry.laneStatus === "execution-submitted").length,
    previewedCount: ranked.filter((entry) => entry.laneStatus === "previewed" || entry.laneStatus === "preview-recorded" || entry.laneStatus === "preview-expired").length,
    previewRecordedCount: ranked.filter((entry) => entry.laneStatus === "preview-recorded").length,
    previewExpiredCount: ranked.filter((entry) => entry.laneStatus === "preview-expired").length,
    previewFreshCount: ranked.filter((entry) => entry.laneStatus === "previewed").length,
    previewStaleCount: ranked.filter((entry) => entry.laneStatus === "preview-expired").length,
    refreshedPreviewCount: ranked.filter((entry) => entry.previewRefreshCount > 0).length,
    previewRefreshCount: ranked.reduce((sum, entry) => sum + entry.previewRefreshCount, 0),
    pardonedPreviewCount: ranked.filter((entry) => entry.previewPardonCount > 0).length,
    previewPardonCount: ranked.reduce((sum, entry) => sum + entry.previewPardonCount, 0),
    manuallyClearedPreviewCount: ranked.filter((entry) => entry.previewManualClearCount > 0).length,
    previewManualClearCount: ranked.reduce((sum, entry) => sum + entry.previewManualClearCount, 0),
    hardResetPreviewCount: ranked.filter((entry) => entry.previewHardResetCount > 0).length,
    previewHardResetCount: ranked.reduce((sum, entry) => sum + entry.previewHardResetCount, 0),
    autoPromotedContentionIntentCount: ranked.filter((entry) => entry.readyContentionAutoPromotionCount > 0).length,
    readyContentionAutoPromotionCount: ranked.reduce((sum, entry) => sum + entry.readyContentionAutoPromotionCount, 0),
    executionSubmittedCount: ranked.filter((entry) => entry.laneStatus === "execution-submitted").length,
    awaitingApprovalCount: ranked.filter((entry) => entry.laneStatus === "awaiting-approval").length,
    blockedLaneCount: ranked.filter((entry) => entry.laneStatus === "blocked").length,
    linkedCount: ranked.filter((entry) => entry.laneStatus === "linked").length,
    latestIntentStatus: latest?.intentStatus || null,
    latestLane: latest?.lane || null,
    latestLaneStatus: latest?.laneStatus || null,
    latestIntentSymbol: latest?.decision.symbol ? String(latest.decision.symbol) : null,
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
        .filter((entry) => entry.intentStatus === "guardrail-blocked")
        .map((entry) => entry.decision.symbol),
    ),
  };
}

export function createAdaptationSummary(
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

export function summarizeFleetAdaptation(
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

export function createOperationalReadinessSummary(bot: {
  status: string;
  executionEnvironment: string;
  attention?: {
    priority?: string;
  } | null;
  readyContention?: {
    isContended?: boolean;
    peerCount?: number;
    isLeader?: boolean;
  } | null;
  executionIntentSummary?: {
    readyCount: number;
    queuedCount: number;
    dispatchRequestedCount: number;
    previewExpiredCount: number;
    previewPardonCount: number;
    previewManualClearCount: number;
    previewHardResetCount: number;
    readyContentionAutoPromotionCount: number;
  } | null;
}) {
  const summary = bot.executionIntentSummary;
  const isPaperLane = bot.executionEnvironment === "paper";
  const contentionActive = Boolean(bot.readyContention?.isContended);
  const contentionPeerCount = Number(bot.readyContention?.peerCount || 0);
  const queueAutoPromotionCount = summary?.readyContentionAutoPromotionCount || 0;
  const unstableQueueChurn = queueAutoPromotionCount >= 3;
  const finalReviewOnly = isPaperLane
    && (summary?.previewHardResetCount || 0) > 0
    && (bot.attention?.priority || "") === "urgent";
  const recoveryActive = isPaperLane && (
    (summary?.previewExpiredCount || 0) > 0
    || (summary?.previewPardonCount || 0) > 0
    || (summary?.previewManualClearCount || 0) > 0
    || (summary?.previewHardResetCount || 0) > 0
    || unstableQueueChurn
  );
  const dispatchReady = bot.status === "active"
    && !finalReviewOnly
    && (bot.attention?.priority || "") !== "urgent"
    && !unstableQueueChurn
    && (!contentionActive || Boolean(bot.readyContention?.isLeader))
    && (((summary?.readyCount || 0) + (summary?.queuedCount || 0) + (summary?.dispatchRequestedCount || 0)) > 0);

  const state = finalReviewOnly
    ? "final-review"
    : dispatchReady
      ? "ready"
      : recoveryActive
        ? "recovery"
        : "monitor";

  return {
    state,
    isPaperLane,
    finalReviewOnly,
    recoveryActive,
    dispatchReady,
    contentionActive,
    contentionPeerCount,
    unstableQueueChurn,
  };
}

export function summarizeFleetOperationalReadiness(
  bots: Array<{
    operationalReadiness: {
      state: string;
      dispatchReady: boolean;
      recoveryActive: boolean;
      finalReviewOnly: boolean;
    };
  }>,
) {
  return {
    operationalReadyBots: bots.filter((bot) => bot.operationalReadiness.dispatchReady).length,
    recoveryBots: bots.filter((bot) => bot.operationalReadiness.recoveryActive && !bot.operationalReadiness.finalReviewOnly).length,
    finalReviewBots: bots.filter((bot) => bot.operationalReadiness.finalReviewOnly).length,
  };
}

export function summarizeFleetQueueChurn(
  bots: Array<{
    executionIntentSummary?: {
      readyContentionAutoPromotionCount?: number;
    } | null;
  }>,
) {
  return {
    queueChurnBots: bots.filter((bot) => (bot.executionIntentSummary?.readyContentionAutoPromotionCount || 0) > 0).length,
    unstableQueueBots: bots.filter((bot) => (bot.executionIntentSummary?.readyContentionAutoPromotionCount || 0) >= 3).length,
    queueAutoPromotions: bots.reduce((sum, bot) => sum + (bot.executionIntentSummary?.readyContentionAutoPromotionCount || 0), 0),
  };
}

export function summarizeFleetSafeLaneStability(input: {
  totalBots: number;
  operationalReadyBots: number;
  recoveryBots: number;
  finalReviewBots: number;
  contendedReadyBots: number;
  unstableQueueBots: number;
}) {
  const stableReadyBots = Math.max(0, input.operationalReadyBots - input.contendedReadyBots);
  const stabilityPct = input.totalBots > 0
    ? (stableReadyBots / input.totalBots) * 100
    : 0;

  const state = input.finalReviewBots > 0 || input.unstableQueueBots > 1
    ? "fragile"
    : input.recoveryBots > 0 || input.contendedReadyBots > 0 || input.unstableQueueBots > 0
      ? "watch"
      : stableReadyBots > 0
        ? "stable"
        : "forming";

  return {
    state,
    stabilityPct,
    stableReadyBots,
  };
}

export function summarizeFleetOperationalVerdict(input: {
  totalBots: number;
  safeLaneStabilityState: string;
  safeLaneStabilityPct: number;
  stableReadyBots: number;
  finalReviewBots: number;
  unstableQueueBots: number;
  contendedReadyBots: number;
}) {
  const state = input.safeLaneStabilityState === "stable" && input.safeLaneStabilityPct >= 50
    ? "close"
    : input.safeLaneStabilityState === "watch"
      ? "validating"
      : input.safeLaneStabilityState === "fragile"
        ? "not-ready"
        : "forming";

  const note = state === "close"
    ? `${input.stableReadyBots} bots look stably ready and the safe lane is nearing an operational threshold.`
    : state === "validating"
      ? `${input.contendedReadyBots} contended ready bots and ${input.unstableQueueBots} unstable queue bots still keep the lane in validation.`
      : state === "not-ready"
        ? `${input.finalReviewBots} bots are already in final review or queue instability is still too high for an operational verdict.`
        : "The safe lane is still forming and needs more stable ready capacity before it can be considered operational.";

  return {
    state,
    note,
  };
}

export function summarizeBotOperationalVerdict(bot: {
  operationalReadiness?: {
    state?: string;
    finalReviewOnly?: boolean;
    unstableQueueChurn?: boolean;
    contentionActive?: boolean;
  } | null;
  executionIntentSummary?: {
    readyCount?: number;
    dispatchRequestedCount?: number;
    queuedCount?: number;
    readyContentionAutoPromotionCount?: number;
  } | null;
}) {
  const readinessState = String(bot.operationalReadiness?.state || "").trim();
  const autoPromotionCount = bot.executionIntentSummary?.readyContentionAutoPromotionCount || 0;
  const activeIntentCount = (bot.executionIntentSummary?.readyCount || 0)
    + (bot.executionIntentSummary?.queuedCount || 0)
    + (bot.executionIntentSummary?.dispatchRequestedCount || 0);

  const state = readinessState === "final-review"
    ? "not-ready"
    : readinessState === "ready"
      ? "close"
      : readinessState === "recovery" || bot.operationalReadiness?.unstableQueueChurn || bot.operationalReadiness?.contentionActive
        ? "validating"
        : "forming";

  const note = state === "close"
    ? `${activeIntentCount} active safe-lane intents are still progressing under a clean enough readiness envelope.`
    : state === "validating"
      ? `${autoPromotionCount} queue auto-promotions and current recovery/contension pressure are still keeping this bot in validation.`
      : state === "not-ready"
        ? "This bot exhausted the current governed path and should not be treated as operational in the safe lane."
        : "This bot is still forming a stable enough safe-lane rhythm to be considered operational.";

  return {
    state,
    note,
  };
}

export function summarizeGovernedDemoGate(input: {
  operationalVerdictState: string;
  operationalVerdictNote: string;
  stableReadyBots: number;
}) {
  const verdictState = String(input.operationalVerdictState || "").trim();
  const state = verdictState === "close" ? "open" : "closed";
  const note = state === "open"
    ? `${input.stableReadyBots} stable ready bots currently keep the governed demo gate open.`
    : `Governed demo stays closed until the fleet operational verdict reaches close. ${input.operationalVerdictNote}`.trim();

  return {
    state,
    note,
  };
}

export function summarizePaperDemoOperationalStatus(input: {
  governedDemoGateState: string;
  governedDemoGateNote: string;
  stableReadyBots: number;
  totalBots: number;
}) {
  const gateState = String(input.governedDemoGateState || "").trim();
  const state = gateState === "open" && input.stableReadyBots > 0 ? "operational" : "not-operational";
  const note = state === "operational"
    ? `${input.stableReadyBots} stable ready bots currently keep the governed paper/demo lane operational.`
    : `The governed paper/demo lane is not operational yet. ${input.governedDemoGateNote}`.trim();

  return {
    state,
    note,
    operationalBots: state === "operational" ? input.stableReadyBots : 0,
    coveragePct: input.totalBots > 0 ? (input.stableReadyBots / input.totalBots) * 100 : 0,
  };
}

export function summarizeBotsOperationalNow(input: {
  paperDemoOperationalState: string;
  paperDemoOperationalNote: string;
  operationalBots: number;
}) {
  const state = String(input.paperDemoOperationalState || "").trim() === "operational"
    ? "yes"
    : "no";
  const note = state === "yes"
    ? `${input.operationalBots} bots are currently operational in the governed paper/demo lane.`
    : `Bots are not operational in the governed paper/demo lane yet. ${input.paperDemoOperationalNote}`.trim();

  return {
    state,
    note,
  };
}

export function summarizeReadyContention(
  bots: Array<{
    id: string;
    name: string;
    decisions?: Array<{
      createdAt?: string;
      updatedAt?: string;
      metadata?: {
        executionIntentLane?: string | null;
        executionIntentLaneStatus?: string | null;
        executionIntentDispatchRequestedAt?: string | null;
        generatedByOperationalLoop?: boolean | null;
        executionOrderId?: number | null;
      } | null;
    }>;
    workspaceSettings?: {
      primaryPair?: string | null;
    } | null;
    operationalReadiness: {
      dispatchReady: boolean;
    };
  }>,
) {
  const readyBots = bots.filter((bot) => bot.operationalReadiness.dispatchReady);
  const readyBotsByPair = new Map<string, typeof readyBots>();
  const rankBotTimestamp = (bot: typeof readyBots[number]) => {
    const activeDecision = (bot.decisions || [])
      .filter((decision) => (
        decision.metadata?.generatedByOperationalLoop
        && !decision.metadata?.executionOrderId
        && String(decision.metadata?.executionIntentLane || "").trim() === "paper"
        && ["queued", "dispatch-requested", "previewed", "preview-recorded", "preview-expired"].includes(String(decision.metadata?.executionIntentLaneStatus || "").trim())
      ))
      .sort((left, right) => {
        const leftTime = new Date(String(left.metadata?.executionIntentDispatchRequestedAt || left.updatedAt || left.createdAt || "")).getTime();
        const rightTime = new Date(String(right.metadata?.executionIntentDispatchRequestedAt || right.updatedAt || right.createdAt || "")).getTime();
        return leftTime - rightTime;
      })[0];
    return new Date(String(activeDecision?.metadata?.executionIntentDispatchRequestedAt || activeDecision?.updatedAt || activeDecision?.createdAt || "")).getTime() || Number.MAX_SAFE_INTEGER;
  };

  readyBots.forEach((bot) => {
    const pair = (bot.workspaceSettings?.primaryPair || "").trim().toUpperCase();
    if (!pair) return;
    const existing = readyBotsByPair.get(pair) || [];
    existing.push(bot);
    readyBotsByPair.set(pair, existing);
  });

  const entries = Array.from(readyBotsByPair.entries())
    .filter(([, pairBots]) => pairBots.length > 1)
    .map(([pair, pairBots]) => {
      const orderedBots = pairBots
        .slice()
        .sort((left, right) => rankBotTimestamp(left) - rankBotTimestamp(right) || left.name.localeCompare(right.name));
      return {
        pair,
        botIds: orderedBots.map((bot) => bot.id),
        botNames: orderedBots.map((bot) => bot.name),
        leaderBotId: orderedBots[0]?.id || null,
        leaderBotName: orderedBots[0]?.name || null,
        count: orderedBots.length,
      };
    })
    .sort((left, right) => right.count - left.count || left.pair.localeCompare(right.pair));

  return {
    entries,
    contendedReadySymbols: entries.length,
    contendedReadyBots: new Set(entries.flatMap((entry) => entry.botIds)).size,
  };
}

export function createBotAttentionSummary(bot: {
  ownership: {
    unresolvedOwnershipCount: number;
    reconciliationPct: number;
  };
  readyContention?: {
    isContended?: boolean;
    pair?: string | null;
    peerCount?: number;
    peerNames?: string[];
    isLeader?: boolean;
    leaderBotName?: string | null;
    queuePosition?: number;
  } | null;
  executionIntentSummary?: {
    previewExpiredCount: number;
    previewRefreshCount: number;
    refreshedPreviewCount: number;
    previewPardonCount: number;
    pardonedPreviewCount: number;
    previewManualClearCount: number;
    manuallyClearedPreviewCount: number;
    previewHardResetCount: number;
    hardResetPreviewCount: number;
    readyContentionAutoPromotionCount: number;
    autoPromotedContentionIntentCount: number;
  } | null;
  adaptationSummary?: {
    trainingConfidence: string;
    adaptationBias: string;
  } | null;
}) {
  let score = 0;
  const previewExpiredCount = bot.executionIntentSummary?.previewExpiredCount || 0;
  const previewRefreshCount = bot.executionIntentSummary?.previewRefreshCount || 0;
  const previewPardonCount = bot.executionIntentSummary?.previewPardonCount || 0;
  const previewManualClearCount = bot.executionIntentSummary?.previewManualClearCount || 0;
  const previewHardResetCount = bot.executionIntentSummary?.previewHardResetCount || 0;
  const readyContentionAutoPromotionCount = bot.executionIntentSummary?.readyContentionAutoPromotionCount || 0;
  const autoPromotedContentionIntentCount = bot.executionIntentSummary?.autoPromotedContentionIntentCount || 0;
  const contentionActive = Boolean(bot.readyContention?.isContended);
  const contentionPeerCount = Number(bot.readyContention?.peerCount || 0);
  const severePreviewChurn = previewExpiredCount >= 2 || previewRefreshCount >= 3;
  const unstableQueueChurn = readyContentionAutoPromotionCount >= 3;
  score += bot.ownership.unresolvedOwnershipCount * 10;
  score += Math.max(0, 100 - bot.ownership.reconciliationPct);
  score += previewExpiredCount * 12;
  score += Math.min(previewRefreshCount * 6, 30);
  score += Math.min(previewPardonCount * 8, 24);
  score += Math.min(previewManualClearCount * 12, 36);
  score += Math.min(previewHardResetCount * 18, 36);
  score += contentionActive && !bot.readyContention?.isLeader ? Math.min(contentionPeerCount * 14, 28) : 0;
  score += Math.min(readyContentionAutoPromotionCount * 5, 20);
  if (severePreviewChurn) score += 20;
  if (unstableQueueChurn) score += 15;

  if (bot.adaptationSummary?.trainingConfidence === "low") score += 20;
  if (bot.adaptationSummary?.trainingConfidence === "medium") score += 8;

  const priority = severePreviewChurn || score >= 90 ? "urgent" : score >= 45 ? "watch" : score > 0 ? "monitor" : "clear";
  const noteParts = [bot.adaptationSummary?.adaptationBias || "Adaptation will stay conservative until owned outcomes improve."];
  if (previewExpiredCount > 0) {
    noteParts.push(`${previewExpiredCount} expired previews still need attention.`);
  }
  if (previewRefreshCount > 0) {
    noteParts.push(`${previewRefreshCount} preview refreshes already happened across ${bot.executionIntentSummary?.refreshedPreviewCount || 0} intents.`);
  }
  if (previewPardonCount > 0) {
    noteParts.push(`${previewPardonCount} churn pardons were already granted across ${bot.executionIntentSummary?.pardonedPreviewCount || 0} intents.`);
  }
  if (previewManualClearCount > 0) {
    noteParts.push(`${previewManualClearCount} manual clears were already used across ${bot.executionIntentSummary?.manuallyClearedPreviewCount || 0} intents.`);
  }
  if (previewHardResetCount > 0) {
    noteParts.push(`${previewHardResetCount} hard resets were already used across ${bot.executionIntentSummary?.hardResetPreviewCount || 0} intents.`);
    noteParts.push("Hard reset is now the final paper-lane override before the bot stays in manual review.");
  }
  if (contentionActive) {
    noteParts.push(
      bot.readyContention?.isLeader
        ? `This bot currently leads the shared ready queue on ${bot.readyContention?.pair || "the same pair"}${bot.readyContention?.peerNames?.length ? ` ahead of ${bot.readyContention.peerNames.join(", ")}` : ""}.`
        : `${contentionPeerCount + 1} ready bots are currently overlapping on ${bot.readyContention?.pair || "the same pair"}${bot.readyContention?.leaderBotName ? ` and ${bot.readyContention.leaderBotName} is ahead in the shared queue` : ""}${bot.readyContention?.peerNames?.length ? ` (${bot.readyContention.peerNames.join(", ")})` : ""}.`,
    );
  }
  if (readyContentionAutoPromotionCount > 0) {
    noteParts.push(`${readyContentionAutoPromotionCount} queue auto-promotions already happened across ${autoPromotedContentionIntentCount} intents.`);
  }
  if (severePreviewChurn) {
    noteParts.push("Paper preview churn is now severe enough to escalate the bot into urgent attention.");
  }
  if (unstableQueueChurn) {
    noteParts.push("Queue auto-promotions are happening often enough to keep this bot out of a clean ready state.");
  }

  return {
    score,
    priority,
    note: noteParts.join(" "),
  };
}

export function createDisabledMemoryLayerSummary(layer: "family" | "global", label: string) {
  return {
    layer,
    lastUpdatedAt: null,
    signalCount: 0,
    decisionCount: 0,
    outcomeCount: 0,
    notes: [`${label} sharing is currently disabled.`],
  };
}

export function scoreExecutionOrderForBot(
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

  if (getOrderBotContextId(order) === bot.id) {
    score += 260;
    reason = "bot-context";
  }

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
    direct: reason === "bot-context" || reason === "signal-id" || reason === "execution-order-id",
  };
}

export function resolveExecutionOwnership(
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
        side: getOrderSide(order),
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

export function createExecutionBreakdowns(orders: ExecutionOrderRecord[]): BotPerformanceBreakdown[] {
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

export function createBotActivityTimeline<
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

export function formatOwnedOutcomePnl(pnlUsd: number | null | undefined) {
  const value = Number(pnlUsd || 0);
  if (!Number.isFinite(value)) return "$0.00";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}$${value.toFixed(Math.abs(value) >= 100 ? 0 : 2)}`;
}

export function createOwnedMemorySummary<
  TDecision extends {
    id: string;
    symbol?: string | null;
    executionIntentLaneStatus?: string | null;
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
        : String(latestEntry.decision.executionIntentLaneStatus || "").trim() === "preview-recorded"
          ? `${label} latest paper preview: ${latestEntry.decision.symbol} is now recorded in the shared execution plane.`
          : String(latestEntry.decision.executionIntentLaneStatus || "").trim() === "preview-expired"
            ? `${label} latest paper preview: ${latestEntry.decision.symbol} is now stale and should be refreshed before reuse.`
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

export function createOwnershipSummary<
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
