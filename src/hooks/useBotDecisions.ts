import { useCallback, useEffect, useState } from "react";
import { summarizeBotDecisionRuntime, type BotDecisionRecord } from "../domain";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import { botDecisionService } from "../services/api";
import type { ExecutionOrderRecord } from "../types";
import { updateBotProfile } from "./useSelectedBot";

interface BotDecisionRuntimeState {
  decisions: BotDecisionRecord[];
  lastHydratedAt: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
}

const BOT_DECISIONS_STORAGE_KEY = "crype-bot-decisions";
let runtimeState: BotDecisionRuntimeState = {
  decisions: [],
  lastHydratedAt: null,
  hydrated: false,
  loading: false,
  error: null,
};
let hydrationPromise: Promise<BotDecisionRecord[]> | null = null;
let decisionOutcomeSyncPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

function readCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BOT_DECISIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.decisions)) return null;
    return parsed as Pick<BotDecisionRuntimeState, "decisions" | "lastHydratedAt">;
  } catch {
    return null;
  }
}

function writeCache(decisions: BotDecisionRecord[], lastHydratedAt: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOT_DECISIONS_STORAGE_KEY, JSON.stringify({
    decisions,
    lastHydratedAt,
  }));
}

function setState(patch: Partial<BotDecisionRuntimeState>) {
  runtimeState = {
    ...runtimeState,
    ...patch,
  };
  if (patch.decisions) {
    writeCache(runtimeState.decisions, runtimeState.lastHydratedAt);
  }
  emit();
}

async function hydrate(forceFresh = false) {
  if (!forceFresh && runtimeState.hydrated) {
    return runtimeState.decisions;
  }
  if (!forceFresh && hydrationPromise) {
    return hydrationPromise;
  }

  if (!forceFresh) {
    const cached = readCache();
    if (cached) {
      setState({
        decisions: cached.decisions,
        lastHydratedAt: cached.lastHydratedAt,
        hydrated: true,
        loading: true,
        error: null,
      });
    } else {
      setState({ loading: true, error: null });
    }
  } else {
    setState({ loading: true, error: null });
  }

  hydrationPromise = botDecisionService.list()
    .then((payload) => {
      setState({
        decisions: payload.decisions || [],
        lastHydratedAt: payload.lastHydratedAt || new Date().toISOString(),
        hydrated: true,
        loading: false,
        error: null,
      });
      hydrationPromise = null;
      void syncDecisionOutcomesFromExecution();
      return runtimeState.decisions;
    })
    .catch((error) => {
      const cached = readCache();
      setState({
        decisions: cached?.decisions || runtimeState.decisions,
        lastHydratedAt: cached?.lastHydratedAt || runtimeState.lastHydratedAt,
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : "No se pudieron hidratar las decisiones de bots.",
      });
      hydrationPromise = null;
      return runtimeState.decisions;
    });

  return hydrationPromise;
}

function upsertDecision(nextDecision: BotDecisionRecord) {
  const existingIndex = runtimeState.decisions.findIndex((decision) => decision.id === nextDecision.id);
  const nextDecisions = existingIndex >= 0
    ? runtimeState.decisions.map((decision, index) => (index === existingIndex ? nextDecision : decision))
    : [nextDecision, ...runtimeState.decisions];
  setState({
    decisions: nextDecisions,
    lastHydratedAt: new Date().toISOString(),
    hydrated: true,
    loading: false,
  });
}

function normalizeToken(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function getExecutionOrdersSnapshot() {
  return systemDataPlaneStore.getState().overlay.execution?.recentOrders || [];
}

function getOrderTimestamp(order: ExecutionOrderRecord) {
  return order.closed_at || order.last_synced_at || order.created_at;
}

function getOrderStrategyId(order: ExecutionOrderRecord) {
  return normalizeToken(order.response_payload?.learning_snapshot?.primaryStrategyId || order.strategy_name || "");
}

function getOrderContextSignature(order: ExecutionOrderRecord) {
  return normalizeToken(order.response_payload?.learning_snapshot?.contextSignature || "");
}

function getDecisionStrategyId(decision: BotDecisionRecord) {
  return normalizeToken(decision.metadata?.strategyId || "");
}

function getDecisionExecutionOrderId(decision: BotDecisionRecord) {
  const nextValue = Number(decision.metadata?.executionOrderId || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function getDecisionObservedAt(decision: BotDecisionRecord) {
  const value = String(decision.metadata?.signalObservedAt || decision.createdAt || "").trim();
  return value || "";
}

function getDecisionContextSignature(decision: BotDecisionRecord) {
  return normalizeToken(decision.marketContextSignature || decision.metadata?.marketContextSignature || "");
}

function isWithinMinutes(left: string, right: string, maxMinutes: number) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  return Math.abs(leftTime - rightTime) <= maxMinutes * 60_000;
}

function hasClosedOutcome(order: ExecutionOrderRecord) {
  if (normalizeToken(order.signal_outcome_status) && normalizeToken(order.signal_outcome_status) !== "pending") {
    return true;
  }
  const status = normalizeToken(order.lifecycle_status || order.status);
  return status.startsWith("closed") || status === "filled";
}

function getDecisionSignalIds(decision: BotDecisionRecord) {
  return new Set([
    normalizeSignalId(decision.signalSnapshotId),
    normalizeSignalId(decision.metadata?.signalId),
    normalizeSignalId(decision.metadata?.publishedSignalId),
  ].filter(Boolean));
}

function buildDecisionOutcomePatch(decision: BotDecisionRecord, orders: ExecutionOrderRecord[]): Partial<BotDecisionRecord> | null {
  if (decision.status === "blocked" || decision.status === "dismissed") return null;

  const decisionSignalIds = getDecisionSignalIds(decision);
  const decisionSymbol = normalizeToken(decision.symbol);
  const decisionTimeframe = normalizeToken(decision.timeframe);
  const decisionStrategyId = getDecisionStrategyId(decision);
  const decisionExecutionOrderId = getDecisionExecutionOrderId(decision);
  const decisionObservedAt = getDecisionObservedAt(decision);
  const decisionContextSignature = getDecisionContextSignature(decision);

  const rankedOrders = orders
    .map((order) => {
      let score = 0;
      const orderSignalId = normalizeSignalId(order.signal_id);
      const orderSymbol = normalizeToken(order.coin);
      const orderTimeframe = normalizeToken(order.timeframe);
      const orderStrategyId = getOrderStrategyId(order);
      const orderContextSignature = getOrderContextSignature(order);
      const orderTimestamp = getOrderTimestamp(order);

      if (decisionExecutionOrderId && Number(order.id) === decisionExecutionOrderId) score += 160;
      if (decisionContextSignature && orderContextSignature && orderContextSignature === decisionContextSignature) score += 40;

      if (orderSignalId && decisionSignalIds.has(orderSignalId)) score += 100;
      if (decisionSymbol && orderSymbol === decisionSymbol) score += 20;
      if (decisionTimeframe && orderTimeframe === decisionTimeframe) score += 12;
      if (decisionStrategyId && orderStrategyId === decisionStrategyId) score += 10;
      if (normalizeToken(order.mode) === normalizeToken(decision.executionEnvironment)) score += 6;
      if (hasClosedOutcome(order)) score += 8;
      if (decisionObservedAt && orderTimestamp && isWithinMinutes(decisionObservedAt, orderTimestamp, 360)) score += 10;

      return { order, score };
    })
    .filter((item) => item.score >= 30)
    .sort((left, right) => (
      right.score - left.score
      || new Date(getOrderTimestamp(right.order) || 0).getTime() - new Date(getOrderTimestamp(left.order) || 0).getTime()
    ));

  const match = rankedOrders[0]?.order;
  if (!match) return null;

  const linkedBy = decisionSignalIds.size && normalizeSignalId(match.signal_id) && decisionSignalIds.has(normalizeSignalId(match.signal_id))
    ? "signal-id"
    : "heuristic";
  const isPreviewRecord = normalizeToken(match.mode) === "preview" || normalizeToken(match.lifecycle_status || match.status) === "preview";
  const nextMetadata = {
    ...decision.metadata,
    executionOrderId: match.id,
    executionOrderMode: match.mode,
    executionLinkedAt: getOrderTimestamp(match),
    executionIntentLaneStatus: isPreviewRecord ? "preview-recorded" : "linked",
    executionIntentLastUpdatedAt: getOrderTimestamp(match),
    executionStatus: String(match.lifecycle_status || match.status || ""),
    executionOutcomeStatus: match.signal_outcome_status || null,
    realizedPnlUsd: Number(match.realized_pnl || decision.metadata?.realizedPnlUsd || 0),
    pnlUsd: Number(match.realized_pnl || decision.metadata?.pnlUsd || 0),
    entryPrice: Number(match.current_price || decision.metadata?.entryPrice || 0) || null,
    notionalUsd: Number(match.notional_usd || 0) || null,
    quantity: Number(match.quantity || 0) || null,
    holdMinutes: match.closed_at
      ? Math.max(0, Math.round((new Date(match.closed_at).getTime() - new Date(match.created_at).getTime()) / 60_000))
      : decision.metadata?.holdMinutes ?? null,
    linkedBy,
  };
  const nextStatus = hasClosedOutcome(match)
    ? "closed"
    : isPreviewRecord && decision.status === "pending"
      ? "approved"
    : decision.status === "pending" && normalizeToken(match.mode) === "execute"
      ? "executed"
      : decision.status;

  const metadataChecks: Array<[string, unknown]> = [
    ["executionOrderId", nextMetadata.executionOrderId],
    ["executionStatus", nextMetadata.executionStatus],
    ["executionOutcomeStatus", nextMetadata.executionOutcomeStatus],
    ["realizedPnlUsd", nextMetadata.realizedPnlUsd],
    ["linkedBy", nextMetadata.linkedBy],
  ];
  const metadataChanged = metadataChecks.some(([key, value]) => decision.metadata?.[key] !== value);

  if (!metadataChanged && nextStatus === decision.status) return null;

  return {
    status: nextStatus,
    metadata: nextMetadata,
  };
}

async function syncDecisionOutcomesFromExecution() {
  if (decisionOutcomeSyncPromise) return decisionOutcomeSyncPromise;

  decisionOutcomeSyncPromise = (async () => {
    const executionOrders = getExecutionOrdersSnapshot();
    if (!executionOrders.length || !runtimeState.decisions.length) return;

    const changedBotIds = new Set<string>();
    for (const decision of runtimeState.decisions) {
      const patch = buildDecisionOutcomePatch(decision, executionOrders);
      if (!patch) continue;
      const response = await botDecisionService.update(decision.id, patch);
      upsertDecision(response.decision);
      changedBotIds.add(response.decision.botId);
    }

    for (const botId of changedBotIds) {
      await syncBotRuntime(botId);
    }
  })().finally(() => {
    decisionOutcomeSyncPromise = null;
  });

  return decisionOutcomeSyncPromise;
}

async function syncBotRuntime(botId: string) {
  const botDecisions = runtimeState.decisions.filter((decision) => decision.botId === botId);
  const runtimePatch = summarizeBotDecisionRuntime(botDecisions);
  await updateBotProfile(botId, runtimePatch);
}

export function useBotDecisionsState() {
  const [state, setLocalState] = useState(() => runtimeState);

  useEffect(() => subscribe(() => {
    setLocalState({ ...runtimeState });
  }), []);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    let previousFingerprint = "";
    return systemDataPlaneStore.subscribe(() => {
      const orders = getExecutionOrdersSnapshot();
      const nextFingerprint = orders
        .map((order) => `${order.id}:${order.signal_id || 0}:${order.lifecycle_status || order.status}:${order.realized_pnl || 0}`)
        .join("|");
      if (!nextFingerprint || nextFingerprint === previousFingerprint) return;
      previousFingerprint = nextFingerprint;
      void syncDecisionOutcomesFromExecution();
    });
  }, []);

  const createDecision = useCallback(async (payload: BotDecisionRecord) => {
    const response = await botDecisionService.create(payload);
    upsertDecision(response.decision);
    await syncDecisionOutcomesFromExecution();
    await syncBotRuntime(response.decision.botId);
    return response.decision;
  }, []);

  const updateDecision = useCallback(async (id: string, payload: Partial<BotDecisionRecord>) => {
    const response = await botDecisionService.update(id, payload);
    upsertDecision(response.decision);
    await syncDecisionOutcomesFromExecution();
    await syncBotRuntime(response.decision.botId);
    return response.decision;
  }, []);

  const refreshDecisions = useCallback((forceFresh = true) => hydrate(forceFresh), []);

  return {
    decisions: state.decisions,
    lastHydratedAt: state.lastHydratedAt,
    hydrated: state.hydrated,
    loading: state.loading,
    error: state.error,
    createDecision,
    updateDecision,
    refreshDecisions,
  };
}
