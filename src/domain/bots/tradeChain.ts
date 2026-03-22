import type { SignalSnapshot, ExecutionOrderRecord } from "../../types";
import type { BotDecisionRecord } from "./contracts";

export interface BotCanonicalTrade {
  id: string;
  orderId: number;
  signalId: number | null;
  signalSnapshotId: number | null;
  decisionId: string | null;
  symbol: string;
  timeframe: string;
  side: "BUY" | "SELL";
  source: string;
  mode: string;
  lifecycleStatus: string;
  outcomeStatus: string | null;
  hasOutcome: boolean;
  realizedPnlUsd: number | null;
  entryPrice: number | null;
  targetPrice: number | null;
  stopPrice: number | null;
  startedAt: string;
  endedAt: string;
  linkedBy: "execution-order-id" | "signal-id" | "decision-order-id" | "decision-signal-id";
}

function normalizeToken(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizePair(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function getOrderTimestamp(order: ExecutionOrderRecord) {
  return order.closed_at || order.last_synced_at || order.created_at;
}

function getOrderRecencyValue(order: ExecutionOrderRecord) {
  return new Date(getOrderTimestamp(order) || order.created_at || 0).getTime();
}

function getOrderSide(order: ExecutionOrderRecord) {
  const responsePayload = order.response_payload as {
    signal_context?: { direction?: string | null } | null;
    learning_snapshot?: { marketBias?: string | null; orderSide?: string | null } | null;
  } | null | undefined;
  return String(
    order.side
      || responsePayload?.signal_context?.direction
      || responsePayload?.learning_snapshot?.orderSide
      || responsePayload?.learning_snapshot?.marketBias
      || "",
  ).trim().toUpperCase();
}

function hasClosedExecutionOutcome(order: ExecutionOrderRecord) {
  if (order.signal_outcome_status && order.signal_outcome_status !== "pending") {
    return true;
  }

  const lifecycleStatus = normalizeToken(order.lifecycle_status || order.status);
  return lifecycleStatus.startsWith("closed") || lifecycleStatus === "filled";
}

function isRealTradeExecution(order: ExecutionOrderRecord) {
  const lifecycleStatus = normalizeToken(order.lifecycle_status || order.status);
  const mode = normalizeToken(order.mode);
  return mode === "execute"
    && lifecycleStatus !== "blocked"
    && lifecycleStatus !== "preview"
    && (
      Number(order.order_id || 0) > 0
      || lifecycleStatus === "placed"
      || lifecycleStatus.includes("protect")
      || lifecycleStatus === "filled"
      || lifecycleStatus.startsWith("closed")
    );
}

function shouldReplaceSignalOrder(current: ExecutionOrderRecord | undefined, candidate: ExecutionOrderRecord) {
  if (!current) return true;
  const currentReal = isRealTradeExecution(current);
  const candidateReal = isRealTradeExecution(candidate);
  if (candidateReal && !currentReal) return true;
  if (!candidateReal && currentReal) return false;
  return getOrderRecencyValue(candidate) >= getOrderRecencyValue(current);
}

function resolveSignalSide(signal: SignalSnapshot | null | undefined) {
  const direction = String(
    signal?.signal_payload?.context?.direction
      || signal?.signal_payload?.executionLearning?.direction
      || signal?.trend
      || signal?.signal_label
      || "",
  ).trim().toLowerCase();
  if (
    direction.includes("sell")
    || direction.includes("bear")
    || direction.includes("vender")
    || direction.includes("bajista")
  ) return "SELL" as const;
  if (
    direction.includes("buy")
    || direction.includes("bull")
    || direction.includes("comprar")
    || direction.includes("alcista")
  ) return "BUY" as const;
  return null;
}

function getDecisionSignalIds(decision: BotDecisionRecord) {
  return [
    normalizeSignalId(decision.signalSnapshotId),
    normalizeSignalId(decision.metadata?.signalId),
    normalizeSignalId(decision.metadata?.publishedSignalId),
  ].filter(Boolean);
}

function getDecisionExecutionOrderId(decision: BotDecisionRecord) {
  return normalizeSignalId(decision.metadata?.executionOrderId);
}

function buildTradeEntry(input: {
  order: ExecutionOrderRecord;
  signal: SignalSnapshot | null;
  decision: BotDecisionRecord | null;
  linkedBy: BotCanonicalTrade["linkedBy"];
}) {
  const order = input.order;
  const signal = input.signal;
  const decision = input.decision;
  const side = getOrderSide(order) || resolveSignalSide(signal);
  if (side !== "BUY" && side !== "SELL") return null;

  const signalId = signal?.id ? Number(signal.id) : normalizeSignalId(order.signal_id) || null;
  const outcomeStatus = String(
    order.signal_outcome_status
      || signal?.outcome_status
      || "",
  ).trim().toLowerCase() || null;

  return {
    id: `trade-${order.id}`,
    orderId: Number(order.id),
    signalId,
    signalSnapshotId: signal?.id ? Number(signal.id) : null,
    decisionId: decision?.id || null,
    symbol: normalizePair(order.coin || signal?.coin),
    timeframe: String(order.timeframe || signal?.timeframe || decision?.timeframe || "").trim(),
    side,
    source: String(
      order.response_payload?.learning_snapshot?.decisionSource
        || order.origin
        || decision?.source
        || "runtime",
    ),
    mode: String(order.mode || ""),
    lifecycleStatus: String(order.lifecycle_status || order.status || ""),
    outcomeStatus,
    hasOutcome: hasClosedExecutionOutcome(order) || Boolean(signal?.outcome_status && signal.outcome_status !== "pending"),
    realizedPnlUsd: Number.isFinite(Number(order.realized_pnl))
      ? Number(order.realized_pnl)
      : signal?.outcome_pnl == null
        ? null
        : Number(signal.outcome_pnl),
    entryPrice: Number(order.current_price || signal?.entry_price || decision?.metadata?.entryPrice || 0) || null,
    targetPrice: Number(signal?.tp_price || signal?.tp2_price || decision?.metadata?.targetPrice || 0) || null,
    stopPrice: Number(signal?.sl_price || 0) || null,
    startedAt: String(order.created_at || signal?.created_at || decision?.createdAt || ""),
    endedAt: String(getOrderTimestamp(order) || signal?.execution_updated_at || signal?.updated_at || signal?.created_at || decision?.updatedAt || decision?.createdAt || ""),
    linkedBy: input.linkedBy,
  } satisfies BotCanonicalTrade;
}

export function buildBotCanonicalTradeTimeline(input: {
  decisionTimeline: BotDecisionRecord[];
  executionOrders: ExecutionOrderRecord[];
  signals: SignalSnapshot[];
}) {
  const decisionTimeline = Array.isArray(input.decisionTimeline) ? input.decisionTimeline : [];
  const executionOrders = Array.isArray(input.executionOrders) ? input.executionOrders : [];
  const signals = Array.isArray(input.signals) ? input.signals : [];

  const decisionsByOrderId = new Map<number, BotDecisionRecord>();
  const decisionsBySignalId = new Map<number, BotDecisionRecord>();
  const signalsByExecutionOrderId = new Map<number, SignalSnapshot>();
  const signalsById = new Map<number, SignalSnapshot>();
  const latestOrderBySignalId = new Map<number, ExecutionOrderRecord>();

  for (const decision of decisionTimeline) {
    const orderId = getDecisionExecutionOrderId(decision);
    if (orderId && !decisionsByOrderId.has(orderId)) {
      decisionsByOrderId.set(orderId, decision);
    }
    for (const signalId of getDecisionSignalIds(decision)) {
      if (!decisionsBySignalId.has(signalId)) {
        decisionsBySignalId.set(signalId, decision);
      }
    }
  }

  for (const signal of signals) {
    const signalId = normalizeSignalId(signal.id);
    if (signalId && !signalsById.has(signalId)) {
      signalsById.set(signalId, signal);
    }
    const executionOrderId = normalizeSignalId(signal.execution_order_id);
    if (executionOrderId && !signalsByExecutionOrderId.has(executionOrderId)) {
      signalsByExecutionOrderId.set(executionOrderId, signal);
    }
  }

  for (const order of executionOrders) {
    const signalId = normalizeSignalId(order.signal_id);
    if (signalId && shouldReplaceSignalOrder(latestOrderBySignalId.get(signalId), order)) {
      latestOrderBySignalId.set(signalId, order);
    }
  }

  const trades = new Map<number, BotCanonicalTrade>();

  for (const signal of signals) {
    const signalId = normalizeSignalId(signal.id);
    const directOrderId = normalizeSignalId(signal.execution_order_id);
    const order = directOrderId
      ? executionOrders.find((entry) => Number(entry.id) === directOrderId) || null
      : signalId
        ? latestOrderBySignalId.get(signalId) || null
        : null;

    if (!order || !isRealTradeExecution(order)) continue;
    const decision = decisionsByOrderId.get(Number(order.id)) || (signalId ? decisionsBySignalId.get(signalId) || null : null);
    const trade = buildTradeEntry({
      order,
      signal,
      decision,
      linkedBy: directOrderId ? "execution-order-id" : "signal-id",
    });
    if (trade) trades.set(trade.orderId, trade);
  }

  for (const order of executionOrders) {
    if (!isRealTradeExecution(order) || trades.has(Number(order.id))) continue;
    const signalId = normalizeSignalId(order.signal_id);
    const signal = signalsByExecutionOrderId.get(Number(order.id))
      || (signalId ? signalsById.get(signalId) || null : null)
      || null;
    const decision = decisionsByOrderId.get(Number(order.id))
      || (signalId ? decisionsBySignalId.get(signalId) || null : null);
    if (!signal && !decision) continue;

    const trade = buildTradeEntry({
      order,
      signal,
      decision: decision || null,
      linkedBy: decisionsByOrderId.has(Number(order.id)) ? "decision-order-id" : "decision-signal-id",
    });
    if (trade) trades.set(trade.orderId, trade);
  }

  return Array.from(trades.values())
    .sort((left, right) => new Date(right.endedAt || right.startedAt || 0).getTime() - new Date(left.endedAt || left.startedAt || 0).getTime());
}
