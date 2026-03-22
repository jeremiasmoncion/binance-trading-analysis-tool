import type { ExecutionCandidate, ExecutionCenterPayload, ExecutionOrderRecord, ExecutionProfile } from "../types";

function normalizeToken(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBotContextId(order: ExecutionOrderRecord) {
  return String(order.response_payload?.botContext?.botId || "").trim();
}

function hasStringListChanged(current: string[] = [], next: string[] = []) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    if ((current[index] || "") !== (next[index] || "")) {
      return true;
    }
  }

  return false;
}

function hasScopeOverridesChanged(
  current: ExecutionProfile["scopeOverrides"] = [],
  next: ExecutionProfile["scopeOverrides"] = [],
) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      (currentItem?.id || "") !== (nextItem?.id || "")
      || (currentItem?.strategyId || "") !== (nextItem?.strategyId || "")
      || (currentItem?.timeframe || "") !== (nextItem?.timeframe || "")
      || Boolean(currentItem?.enabled) !== Boolean(nextItem?.enabled)
      || (currentItem?.action || "") !== (nextItem?.action || "")
      || Number(currentItem?.minSignalScore || 0) !== Number(nextItem?.minSignalScore || 0)
      || Number(currentItem?.minRrRatio || 0) !== Number(nextItem?.minRrRatio || 0)
      || (currentItem?.note || "") !== (nextItem?.note || "")
    ) {
      return true;
    }
  }

  return false;
}

function hasExecutionCandidatesChanged(current: ExecutionCandidate[], next: ExecutionCandidate[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.signalId !== nextItem.signalId
      || normalizeToken(currentItem.symbol) !== normalizeToken(nextItem.symbol)
      || normalizeToken(currentItem.timeframe) !== normalizeToken(nextItem.timeframe)
      || normalizeToken(currentItem.strategyName) !== normalizeToken(nextItem.strategyName)
      || normalizeToken(currentItem.strategyVersion) !== normalizeToken(nextItem.strategyVersion)
      || normalizeToken(currentItem.signalLabel) !== normalizeToken(nextItem.signalLabel)
      || normalizeToken(currentItem.status) !== normalizeToken(nextItem.status)
      || Number(currentItem.score || 0) !== Number(nextItem.score || 0)
      || Number(currentItem.adaptiveScore || 0) !== Number(nextItem.adaptiveScore || 0)
      || Number(currentItem.rrRatio || 0) !== Number(nextItem.rrRatio || 0)
      || Number(currentItem.notionalUsd || 0) !== Number(nextItem.notionalUsd || 0)
      || Number(currentItem.qty || 0) !== Number(nextItem.qty || 0)
      || Number(currentItem.currentPrice || 0) !== Number(nextItem.currentPrice || 0)
      || normalizeToken(currentItem.decisionSource) !== normalizeToken(nextItem.decisionSource)
      || Number(currentItem.decisionExperimentId || 0) !== Number(nextItem.decisionExperimentId || 0)
      || hasStringListChanged(currentItem.reasons, nextItem.reasons)
      || Number(currentItem.plan?.entry || 0) !== Number(nextItem.plan?.entry || 0)
      || Number(currentItem.plan?.tp || 0) !== Number(nextItem.plan?.tp || 0)
      || Number(currentItem.plan?.tp2 || 0) !== Number(nextItem.plan?.tp2 || 0)
      || Number(currentItem.plan?.sl || 0) !== Number(nextItem.plan?.sl || 0)
    ) {
      return true;
    }
  }

  return false;
}

export function hasExecutionOrdersChanged(current: ExecutionOrderRecord[], next: ExecutionOrderRecord[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.id !== nextItem.id
      || Number(currentItem.signal_id || 0) !== Number(nextItem.signal_id || 0)
      || normalizeToken(currentItem.coin) !== normalizeToken(nextItem.coin)
      || normalizeToken(currentItem.timeframe) !== normalizeToken(nextItem.timeframe)
      || normalizeToken(currentItem.side) !== normalizeToken(nextItem.side)
      || normalizeToken(currentItem.status) !== normalizeToken(nextItem.status)
      || normalizeToken(currentItem.lifecycle_status) !== normalizeToken(nextItem.lifecycle_status)
      || normalizeToken(currentItem.protection_status) !== normalizeToken(nextItem.protection_status)
      || normalizeToken(currentItem.signal_outcome_status) !== normalizeToken(nextItem.signal_outcome_status)
      || Number(currentItem.realized_pnl || 0) !== Number(nextItem.realized_pnl || 0)
      || Number(currentItem.order_id || 0) !== Number(nextItem.order_id || 0)
      || normalizeToken(currentItem.client_order_id) !== normalizeToken(nextItem.client_order_id)
      || normalizeBotContextId(currentItem) !== normalizeBotContextId(nextItem)
      || normalizeToken(currentItem.last_synced_at) !== normalizeToken(nextItem.last_synced_at)
      || normalizeToken(currentItem.closed_at) !== normalizeToken(nextItem.closed_at)
    ) {
      return true;
    }
  }

  return false;
}

export function hasExecutionCenterChanged(
  current: ExecutionCenterPayload | null,
  next: ExecutionCenterPayload | null,
) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return !(
    current.profile.enabled === next.profile.enabled
    && current.profile.autoExecuteEnabled === next.profile.autoExecuteEnabled
    && Number(current.profile.updatedAt ? Date.parse(current.profile.updatedAt) : 0) === Number(next.profile.updatedAt ? Date.parse(next.profile.updatedAt) : 0)
    && current.account.connected === next.account.connected
    && Number(current.account.cashValue || 0) === Number(next.account.cashValue || 0)
    && Number(current.account.totalValue || 0) === Number(next.account.totalValue || 0)
    && Number(current.account.openOrdersCount || 0) === Number(next.account.openOrdersCount || 0)
    && Number(current.account.dailyLossPct || 0) === Number(next.account.dailyLossPct || 0)
    && Number(current.account.dailyAutoExecutions || 0) === Number(next.account.dailyAutoExecutions || 0)
    && Number(current.account.recentLossStreak || 0) === Number(next.account.recentLossStreak || 0)
    && Number(current.account.autoExecutionRemaining || 0) === Number(next.account.autoExecutionRemaining || 0)
    && !hasStringListChanged(current.profile.allowedStrategies, next.profile.allowedStrategies)
    && !hasStringListChanged(current.profile.allowedTimeframes, next.profile.allowedTimeframes)
    && !hasScopeOverridesChanged(current.profile.scopeOverrides, next.profile.scopeOverrides)
    && !hasExecutionCandidatesChanged(current.candidates, next.candidates)
    && !hasExecutionOrdersChanged(current.recentOrders, next.recentOrders)
  );
}
