import type {
  Bot,
  BotDecisionAction,
  BotDecisionRecord,
  BotDecisionSource,
} from "./contracts";
import type { RankedPublishedSignal } from "../signals/contracts";

export const CONTENTION_ACTIVE_LANE_STATUSES = new Set([
  "queued",
  "dispatch-requested",
  "previewed",
  "preview-recorded",
  "preview-expired",
]);

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function normalizeToken(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isOpenDecision(decision: BotDecisionRecord) {
  return decision.status === "pending" || decision.status === "approved" || decision.status === "executed";
}

export function evaluateExecutionGuardrails(bot: Bot, signal: RankedPublishedSignal, decisions: BotDecisionRecord[]) {
  const botOpenDecisions = decisions.filter((decision) => decision.botId === bot.id && isOpenDecision(decision));
  const symbolOpenDecisions = botOpenDecisions.filter((decision) => normalizeToken(decision.symbol) === normalizeToken(signal.context.symbol));
  const requestedNotionalUsd = Math.max(
    0,
    Math.min(
      Number(bot.capital.availableUsd || 0),
      Number(bot.riskPolicy.maxPositionUsd || 0),
    ),
  );
  const allocatedUsd = Math.max(Number(bot.capital.allocatedUsd || 0), requestedNotionalUsd, 1);
  const projectedSymbolExposurePct = ((symbolOpenDecisions.length + 1) * requestedNotionalUsd / allocatedUsd) * 100;

  if (!bot.executionPolicy.canOpenPositions) {
    return {
      status: "blocked" as const,
      reason: "Position opening is disabled by execution policy.",
      code: "execution-disabled",
      requestedNotionalUsd,
      openPositionCount: botOpenDecisions.length,
      symbolOpenCount: symbolOpenDecisions.length,
      projectedSymbolExposurePct,
    };
  }

  if (requestedNotionalUsd <= 0) {
    return {
      status: "blocked" as const,
      reason: "No available capital remains for a new bot-driven position.",
      code: "capital-unavailable",
      requestedNotionalUsd,
      openPositionCount: botOpenDecisions.length,
      symbolOpenCount: symbolOpenDecisions.length,
      projectedSymbolExposurePct,
    };
  }

  if (botOpenDecisions.length >= Number(bot.riskPolicy.maxOpenPositions || 0)) {
    return {
      status: "blocked" as const,
      reason: "The bot already reached its maximum concurrent positions.",
      code: "max-open-positions",
      requestedNotionalUsd,
      openPositionCount: botOpenDecisions.length,
      symbolOpenCount: symbolOpenDecisions.length,
      projectedSymbolExposurePct,
    };
  }

  if (symbolOpenDecisions.length > 0 && bot.overlapPolicy.executionOverlap === "block") {
    return {
      status: "blocked" as const,
      reason: `Execution overlap is blocked for ${signal.context.symbol}.`,
      code: "execution-overlap-blocked",
      requestedNotionalUsd,
      openPositionCount: botOpenDecisions.length,
      symbolOpenCount: symbolOpenDecisions.length,
      projectedSymbolExposurePct,
    };
  }

  if (projectedSymbolExposurePct > Number(bot.riskPolicy.maxSymbolExposurePct || 0)) {
    return {
      status: "blocked" as const,
      reason: `Projected symbol exposure for ${signal.context.symbol} exceeds the bot limit.`,
      code: "symbol-exposure-limit",
      requestedNotionalUsd,
      openPositionCount: botOpenDecisions.length,
      symbolOpenCount: symbolOpenDecisions.length,
      projectedSymbolExposurePct,
    };
  }

  return {
    status: "clear" as const,
    reason: "Guardrails allow the bot to progress this signal toward execution intent.",
    code: "clear",
    requestedNotionalUsd,
    openPositionCount: botOpenDecisions.length,
    symbolOpenCount: symbolOpenDecisions.length,
    projectedSymbolExposurePct,
  };
}

export function resolveOperationalIntent(signal: RankedPublishedSignal) {
  const executionEligible = Boolean(signal.intelligence?.executionEligible)
    || signal.ranking.tier === "high-confidence"
    || signal.ranking.tier === "priority";
  if (!executionEligible) {
    return {
      action: "observe" as BotDecisionAction,
      status: "approved" as const,
      source: "signal-core" as BotDecisionSource,
      rationale: `Bot operativo observo ${signal.context.symbol} porque la señal todavia no es elegible para ejecucion.`,
      executionIntentStatus: "observe-only",
      guardrail: null,
    };
  }

  return {
    action: "assist" as BotDecisionAction,
    status: "approved" as const,
    source: "ai-supervisor" as BotDecisionSource,
    rationale: `Bot operativo elevo ${signal.context.symbol} para revision asistida antes de ejecucion.`,
    executionIntentStatus: "approval-needed",
    guardrail: null,
  };
}

export function resolveAutomatedIntent(bot: Bot, signal: RankedPublishedSignal, decisions: BotDecisionRecord[]) {
  const baseIntent = resolveOperationalIntent(signal);
  if (bot.automationMode === "observe") return baseIntent;
  if (bot.automationMode === "assist") return baseIntent;

  const guardrail = evaluateExecutionGuardrails(bot, signal, decisions);
  if (guardrail.status === "blocked") {
    return {
      action: "block" as BotDecisionAction,
      status: "blocked" as const,
      source: "ai-supervisor" as BotDecisionSource,
      rationale: `Bot operativo bloqueo ${signal.context.symbol}: ${guardrail.reason}`,
      executionIntentStatus: "guardrail-blocked",
      guardrail,
    };
  }

  const canSelfExecute = (
    bot.executionPolicy.autoExecutionEnabled
    && !bot.executionPolicy.suggestionsOnly
    && !bot.executionPolicy.requiresHumanApproval
    && (bot.executionEnvironment !== "real" || bot.executionPolicy.realExecutionEnabled)
  );

  if (canSelfExecute) {
    return {
      action: "execute" as BotDecisionAction,
      status: "pending" as const,
      source: "ai-supervisor" as BotDecisionSource,
      rationale: `Bot operativo preparo ${signal.context.symbol} para ejecucion automatica tras pasar guardrails y politicas.`,
      executionIntentStatus: "ready",
      guardrail,
    };
  }

  return {
    action: "assist" as BotDecisionAction,
    status: "approved" as const,
    source: "ai-supervisor" as BotDecisionSource,
    rationale: `Bot operativo elevo ${signal.context.symbol} para aprobacion antes de ejecucion directa.`,
    executionIntentStatus: bot.executionPolicy.requiresHumanApproval ? "approval-needed" : "assist-only",
    guardrail,
  };
}

export function getIntentLaneForBot(bot: Bot) {
  if (bot.executionEnvironment === "real") return "real" as const;
  if (bot.executionEnvironment === "demo") return "demo" as const;
  return "paper" as const;
}

export function getDecisionIntentStatus(decision: BotDecisionRecord) {
  return String(decision.metadata?.executionIntentStatus || "").trim();
}

export function getDecisionIntentLaneStatus(decision: BotDecisionRecord) {
  return String(decision.metadata?.executionIntentLaneStatus || "").trim();
}

function isOlderThanHours(value: unknown, hours: number) {
  const timestamp = new Date(String(value || "")).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp > hours * 60 * 60 * 1000;
}

export function getEffectiveDecisionIntentLaneStatus(decision: BotDecisionRecord) {
  const laneStatus = getDecisionIntentLaneStatus(decision);
  if (laneStatus === "preview-recorded" && isOlderThanHours(decision.updatedAt || decision.createdAt, 6)) {
    return "preview-expired";
  }
  return laneStatus;
}

export function getBotPreviewChurnSummary(botId: string, decisions: BotDecisionRecord[]) {
  const botDecisions = decisions.filter((decision) => decision.botId === botId);
  const previewExpiredCount = botDecisions.filter((decision) => getEffectiveDecisionIntentLaneStatus(decision) === "preview-expired").length;
  const previewRefreshCount = botDecisions.reduce(
    (sum, decision) => sum + (Number(decision.metadata?.executionIntentPreviewRefreshCount || 0) || 0),
    0,
  );
  return {
    previewExpiredCount,
    previewRefreshCount,
    severePreviewChurn: previewExpiredCount >= 2 || previewRefreshCount >= 3,
  };
}

export function getBotReadyContentionSummary(bot: Bot, decisions: BotDecisionRecord[], bots: Bot[]) {
  const primaryPair = String(bot.workspaceSettings?.primaryPair || "").trim().toUpperCase();
  if (!primaryPair) {
    return {
      isContended: false,
      pair: null,
      peerBotIds: [] as string[],
      peerNames: [] as string[],
      peerCount: 0,
      severe: false,
      isLeader: true,
      leaderBotId: null,
      leaderBotName: null,
      queuePosition: 0,
    };
  }

  const peerBots = bots.filter((candidate) => (
    candidate.id !== bot.id
    && candidate.status === "active"
    && String(candidate.workspaceSettings?.primaryPair || "").trim().toUpperCase() === primaryPair
  ));

  const activeLaneDecisions = (candidateBotId: string) => decisions
    .filter((decision) => (
      decision.botId === candidateBotId
      && decision.metadata?.generatedByOperationalLoop
      && !decision.metadata?.executionOrderId
      && String(decision.metadata?.executionIntentLane || "").trim() === "paper"
      && CONTENTION_ACTIVE_LANE_STATUSES.has(getEffectiveDecisionIntentLaneStatus(decision))
    ))
    .sort((left, right) => {
      const leftTime = new Date(String(left.metadata?.executionIntentDispatchRequestedAt || left.updatedAt || left.createdAt || "")).getTime();
      const rightTime = new Date(String(right.metadata?.executionIntentDispatchRequestedAt || right.updatedAt || right.createdAt || "")).getTime();
      return leftTime - rightTime;
    });

  const contendingPeers = peerBots.filter((peer) => activeLaneDecisions(peer.id).length > 0);
  const orderedBots = [bot, ...contendingPeers]
    .filter((candidate, index, collection) => collection.findIndex((value) => value.id === candidate.id) === index)
    .sort((left, right) => {
      const leftDecision = activeLaneDecisions(left.id)[0];
      const rightDecision = activeLaneDecisions(right.id)[0];
      const leftTime = new Date(String(leftDecision?.metadata?.executionIntentDispatchRequestedAt || leftDecision?.updatedAt || leftDecision?.createdAt || "")).getTime() || Number.MAX_SAFE_INTEGER;
      const rightTime = new Date(String(rightDecision?.metadata?.executionIntentDispatchRequestedAt || rightDecision?.updatedAt || rightDecision?.createdAt || "")).getTime() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime || left.name.localeCompare(right.name);
    });
  const queuePosition = orderedBots.findIndex((candidate) => candidate.id === bot.id);
  const leader = orderedBots[0] || null;

  return {
    isContended: contendingPeers.length > 0,
    pair: primaryPair,
    peerBotIds: contendingPeers.map((peer) => peer.id),
    peerNames: contendingPeers.map((peer) => peer.name),
    peerCount: contendingPeers.length,
    severe: contendingPeers.length > 0 && queuePosition > 0,
    isLeader: queuePosition <= 0,
    leaderBotId: leader?.id || null,
    leaderBotName: leader?.name || null,
    queuePosition: queuePosition >= 0 ? queuePosition + 1 : 0,
  };
}

export function getDispatchModeForLane(lane: string) {
  if (lane === "paper") return "preview" as const;
  if (lane === "demo") return "execute" as const;
  return null;
}

export function getDispatchSignalId(decision: BotDecisionRecord) {
  return normalizeSignalId(decision.metadata?.signalId)
    || normalizeSignalId(decision.metadata?.publishedSignalId)
    || normalizeSignalId(decision.signalSnapshotId);
}

export function isReadyContentionBlockedDecision(decision: BotDecisionRecord) {
  return getDecisionIntentLaneStatus(decision) === "blocked"
    && String(decision.metadata?.executionIntentReason || "").toLowerCase().includes("ready contention is active");
}
