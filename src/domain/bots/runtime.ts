import type {
  BotActivitySummary,
  BotAuditSummary,
  BotDecisionRecord,
  MemorySummary,
  PerformanceSummary,
} from "./contracts";
import { EMPTY_ACTIVITY_SUMMARY, EMPTY_MEMORY_SUMMARY, EMPTY_PERFORMANCE_SUMMARY } from "./defaults";

function getDecisionPnl(decision: BotDecisionRecord) {
  const value = Number(decision.metadata?.realizedPnlUsd || decision.metadata?.pnlUsd || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDecisionHoldMinutes(decision: BotDecisionRecord) {
  const explicitHoldMinutes = Number(decision.metadata?.holdMinutes || 0);
  if (Number.isFinite(explicitHoldMinutes) && explicitHoldMinutes > 0) {
    return explicitHoldMinutes;
  }

  const createdAt = new Date(decision.createdAt || 0).getTime();
  const updatedAt = new Date(decision.updatedAt || decision.createdAt || 0).getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || updatedAt <= createdAt) {
    return null;
  }

  return Math.round((updatedAt - createdAt) / 60_000);
}

export function summarizeBotDecisionRuntime(decisions: BotDecisionRecord[]): {
  localMemory: MemorySummary;
  performance: PerformanceSummary;
  audit: BotAuditSummary;
  activity: BotActivitySummary;
} {
  const orderedDecisions = decisions
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());
  const latestDecision = orderedDecisions[0] || null;
  const terminalDecisions = orderedDecisions.filter((decision) => decision.status !== "pending");
  const executedDecisions = terminalDecisions.filter((decision) => (
    decision.action === "execute"
    || decision.action === "close"
    || decision.status === "executed"
    || decision.status === "closed"
  ));
  const winningDecisions = executedDecisions.filter((decision) => getDecisionPnl(decision) > 0);
  const realizedPnlUsd = executedDecisions.reduce((sum, decision) => sum + getDecisionPnl(decision), 0);
  const holdDurations = executedDecisions
    .map(getDecisionHoldMinutes)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const bestDecision = executedDecisions.reduce<BotDecisionRecord | null>((best, current) => {
    if (!best) return current;
    return getDecisionPnl(current) > getDecisionPnl(best) ? current : best;
  }, null);
  const worstDecision = executedDecisions.reduce<BotDecisionRecord | null>((worst, current) => {
    if (!worst) return current;
    return getDecisionPnl(current) < getDecisionPnl(worst) ? current : worst;
  }, null);
  const notes = latestDecision
    ? [
        `Ultima decision ${latestDecision.action} en ${latestDecision.symbol} (${latestDecision.timeframe}).`,
        `Estado reciente: ${latestDecision.status}.`,
      ]
    : [];

  return {
    localMemory: {
      ...EMPTY_MEMORY_SUMMARY,
      layer: "local",
      lastUpdatedAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
      signalCount: orderedDecisions.length,
      decisionCount: orderedDecisions.length,
      outcomeCount: terminalDecisions.length,
      notes,
    },
    performance: {
      ...EMPTY_PERFORMANCE_SUMMARY,
      updatedAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
      closedSignals: executedDecisions.length,
      winRate: executedDecisions.length ? (winningDecisions.length / executedDecisions.length) * 100 : 0,
      realizedPnlUsd,
      avgPnlUsd: executedDecisions.length ? realizedPnlUsd / executedDecisions.length : 0,
      avgHoldMinutes: holdDurations.length
        ? holdDurations.reduce((sum, value) => sum + value, 0) / holdDurations.length
        : null,
      bestSymbol: bestDecision?.symbol || null,
      worstSymbol: worstDecision?.symbol || null,
    },
    audit: {
      lastDecisionAt: latestDecision?.updatedAt || latestDecision?.createdAt || null,
      lastExecutionAt: executedDecisions[0]?.updatedAt || executedDecisions[0]?.createdAt || null,
      lastPolicyChangeAt: latestDecision?.metadata?.policyUpdatedAt
        ? String(latestDecision.metadata.policyUpdatedAt)
        : null,
    },
    activity: {
      ...EMPTY_ACTIVITY_SUMMARY,
      lastSignalConsumedAt: latestDecision?.createdAt || null,
      lastSignalLayer: latestDecision?.signalLayer || null,
      lastDecisionAction: latestDecision?.action || null,
      lastDecisionStatus: latestDecision?.status || null,
      lastDecisionSymbol: latestDecision?.symbol || null,
      lastDecisionSource: latestDecision?.source || null,
      pendingCount: orderedDecisions.filter((decision) => decision.status === "pending").length,
      approvedCount: orderedDecisions.filter((decision) => decision.status === "approved").length,
      blockedCount: orderedDecisions.filter((decision) => decision.status === "blocked" || decision.status === "dismissed").length,
      executedCount: executedDecisions.length,
      recentDecisionIds: orderedDecisions.slice(0, 8).map((decision) => decision.id),
      recentSymbols: [...new Set(orderedDecisions.map((decision) => decision.symbol).filter(Boolean))].slice(0, 6),
    },
  };
}
