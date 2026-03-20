import { useEffect, useMemo, useRef } from "react";
import {
  createBotConsumableFeed,
  selectAcceptedBotConsumableSignals,
  type Bot,
  type BotDecisionAction,
  type BotDecisionRecord,
  type BotDecisionSource,
  type RankedPublishedSignal,
} from "../domain";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import { useBotDecisionsState } from "./useBotDecisions";
import { useMarketSignalsCore } from "./useMarketSignalsCore";
import { useSelectedBotState } from "./useSelectedBot";

function dedupeRankedSignals<T extends { id: string }>(signals: T[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
}

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function normalizeToken(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function mapSignalLayer(signal: RankedPublishedSignal) {
  const adaptiveScore = Number(signal.intelligence?.adaptiveScore || 0);
  const baseScore = Number(signal.context.score || 0);
  const hasAdaptivePromotion = adaptiveScore > baseScore || Boolean(signal.intelligence?.scorerLabel);
  if (hasAdaptivePromotion) return "ai-prioritized" as const;
  if (signal.intelligence?.executionEligible) return "operable" as const;
  return signal.ranking.tier === "low-visibility" || signal.ranking.tier === "standard"
    ? "observational" as const
    : "operable" as const;
}

function getMarketContextSignature(signal: RankedPublishedSignal) {
  return signal.intelligence?.contextSignature || `${signal.context.symbol}:${signal.context.timeframe}:${signal.ranking.tier}`;
}

function hasExistingDecision(decisions: BotDecisionRecord[], botId: string, signalId: string) {
  return decisions.some((decision) => (
    decision.botId === botId
    && (
      String(decision.metadata?.publishedSignalId || "") === signalId
      || String(decision.metadata?.signalId || "") === signalId
      || normalizeSignalId(decision.signalSnapshotId) === normalizeSignalId(signalId)
    )
    && decision.status !== "dismissed"
  ));
}

function isOpenDecision(decision: BotDecisionRecord) {
  return decision.status === "pending" || decision.status === "approved" || decision.status === "executed";
}

function evaluateExecutionGuardrails(bot: Bot, signal: RankedPublishedSignal, decisions: BotDecisionRecord[]) {
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

function resolveOperationalIntent(signal: RankedPublishedSignal) {
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

function resolveAutomatedIntent(bot: Bot, signal: RankedPublishedSignal, decisions: BotDecisionRecord[]) {
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

function buildOperationalDecision(bot: Bot, signal: RankedPublishedSignal, decisions: BotDecisionRecord[]): BotDecisionRecord {
  const intent = resolveAutomatedIntent(bot, signal, decisions);
  const now = new Date().toISOString();

  return {
    id: `${bot.id}-${signal.id}-${intent.action}-${Date.now()}`,
    botId: bot.id,
    signalSnapshotId: normalizeSignalId(signal.id) || null,
    symbol: signal.context.symbol,
    timeframe: signal.context.timeframe,
    signalLayer: mapSignalLayer(signal),
    action: intent.action,
    status: intent.status,
    source: intent.source,
    rationale: intent.rationale,
    executionEnvironment: bot.executionEnvironment,
    automationMode: bot.automationMode,
    marketContextSignature: getMarketContextSignature(signal),
    contextTags: [
      signal.ranking.tier,
      signal.context.symbol,
      signal.context.timeframe,
      bot.automationMode,
    ],
    metadata: {
      signalId: signal.id,
      publishedSignalId: signal.id,
      strategyId: signal.context.strategyId || null,
      strategyVersion: signal.context.strategyVersion || null,
      signalFeedKinds: signal.feedKinds,
      signalObservedAt: signal.context.observedAt,
      executionEligible: Boolean(signal.intelligence?.executionEligible),
      scorerLabel: signal.intelligence?.scorerLabel || null,
      scorerConfidence: Number(signal.intelligence?.scorerConfidence || 0) || null,
      adaptiveScore: Number(signal.intelligence?.adaptiveScore || 0) || null,
      rankingTier: signal.ranking.tier,
      compositeScore: signal.ranking.compositeScore,
      marketRegime: signal.context.marketRegime || null,
      executionIntentStatus: intent.executionIntentStatus,
      requiresHumanApproval: bot.executionPolicy.requiresHumanApproval,
      autoExecutionEnabled: bot.executionPolicy.autoExecutionEnabled,
      canOpenPositions: bot.executionPolicy.canOpenPositions,
      requestedNotionalUsd: intent.guardrail?.requestedNotionalUsd ?? null,
      openPositionCount: intent.guardrail?.openPositionCount ?? null,
      symbolOpenCount: intent.guardrail?.symbolOpenCount ?? null,
      projectedSymbolExposurePct: intent.guardrail?.projectedSymbolExposurePct ?? null,
      guardrailCode: intent.guardrail?.code || null,
      guardrailReason: intent.guardrail?.reason || null,
      generatedByOperationalLoop: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function getIntentLaneForBot(bot: Bot) {
  if (bot.executionEnvironment === "real") return "real" as const;
  if (bot.executionEnvironment === "demo") return "demo" as const;
  return "paper" as const;
}

function getDecisionIntentStatus(decision: BotDecisionRecord) {
  return String(decision.metadata?.executionIntentStatus || "").trim();
}

function getDecisionIntentLaneStatus(decision: BotDecisionRecord) {
  return String(decision.metadata?.executionIntentLaneStatus || "").trim();
}

function getDispatchModeForLane(lane: string) {
  if (lane === "paper") return "preview" as const;
  if (lane === "demo") return "execute" as const;
  return null;
}

function getDispatchSignalId(decision: BotDecisionRecord) {
  return normalizeSignalId(decision.metadata?.signalId)
    || normalizeSignalId(decision.metadata?.publishedSignalId)
    || normalizeSignalId(decision.signalSnapshotId);
}

function buildIntentLanePatch(bot: Bot, decision: BotDecisionRecord): Partial<BotDecisionRecord> | null {
  if (!decision.metadata?.generatedByOperationalLoop) return null;
  if (decision.metadata?.executionOrderId) return null;

  const lane = getIntentLaneForBot(bot);
  const intentStatus = getDecisionIntentStatus(decision);
  if (!intentStatus) return null;

  let laneStatus = "";
  if (intentStatus === "ready") laneStatus = "queued";
  else if (intentStatus === "approval-needed") laneStatus = "awaiting-approval";
  else if (intentStatus === "assist-only") laneStatus = "assist-only";
  else if (intentStatus === "observe-only") laneStatus = "observe-only";
  else if (intentStatus === "guardrail-blocked") laneStatus = "blocked";

  if (!laneStatus) return null;

  const currentLane = String(decision.metadata?.executionIntentLane || "").trim();
  const currentLaneStatus = getDecisionIntentLaneStatus(decision);
  const currentIntentStatus = String(decision.metadata?.executionIntentLastStatus || "").trim();
  if (
    currentLane === lane
    && intentStatus === "ready"
    && ["dispatch-requested", "previewed", "execution-submitted", "linked", "blocked"].includes(currentLaneStatus)
    && currentIntentStatus === intentStatus
  ) {
    return null;
  }
  if (
    currentLane === lane
    && intentStatus === "approval-needed"
    && currentLaneStatus === "blocked"
    && currentIntentStatus === intentStatus
  ) {
    return null;
  }
  if (currentLane === lane && currentLaneStatus === laneStatus && currentIntentStatus === intentStatus) {
    return null;
  }

  return {
    metadata: {
      ...decision.metadata,
      executionIntentId: String(decision.metadata?.executionIntentId || `${bot.id}:${decision.id}`),
      executionIntentLane: lane,
      executionIntentLaneStatus: laneStatus,
      executionIntentLastStatus: intentStatus,
      executionIntentQueuedAt: String(decision.metadata?.executionIntentQueuedAt || new Date().toISOString()),
      executionIntentLastUpdatedAt: new Date().toISOString(),
      executionIntentReadyForPaperDemo: lane !== "real" && laneStatus === "queued",
      executionIntentRequiresApproval: laneStatus === "awaiting-approval",
      executionIntentReason: String(decision.metadata?.guardrailReason || decision.rationale || ""),
    },
  };
}

export function useBotOperationalLoop() {
  const { state: registryState, hydrated: botsHydrated } = useSelectedBotState();
  const { decisions, hydrated: decisionsHydrated, createDecision, updateDecision } = useBotDecisionsState();
  const core = useMarketSignalsCore();
  const loopFingerprintRef = useRef("");
  const intentLaneFingerprintRef = useRef("");
  const dispatchInFlightRef = useRef(new Set<string>());

  const candidates = useMemo(() => {
    const botReadyRankedSignals = dedupeRankedSignals([
      ...core.signalCore.taxonomy.aiPrioritized,
      ...core.signalCore.taxonomy.operable,
      ...core.signalCore.subsets.watchlistSignals,
      ...core.signalCore.subsets.marketWideSignals,
      ...core.signalCore.taxonomy.observational,
      ...core.signalCore.taxonomy.informational,
    ]);
    const rankedSignalById = new Map(botReadyRankedSignals.map((signal) => [signal.id, signal]));

    return registryState.bots
      .filter((bot) => bot.status === "active")
      .flatMap((bot) => {
        const feed = createBotConsumableFeed(bot, botReadyRankedSignals, core.signalCore.feeds.ranked.generatedAt);
        const acceptedSignals = selectAcceptedBotConsumableSignals(feed)
          .map((signal) => {
            const publishedSignalId = signal.id.split(":bot:")[0];
            return rankedSignalById.get(publishedSignalId) || null;
          })
          .filter((signal): signal is RankedPublishedSignal => Boolean(signal))
          .filter((signal) => !hasExistingDecision(decisions, bot.id, signal.id))
          .slice(0, 1);
        return acceptedSignals.map((signal) => ({ bot, signal }));
      });
  }, [core.signalCore.feeds.ranked.generatedAt, core.signalCore.subsets.marketWideSignals, core.signalCore.subsets.watchlistSignals, core.signalCore.taxonomy.aiPrioritized, core.signalCore.taxonomy.informational, core.signalCore.taxonomy.observational, core.signalCore.taxonomy.operable, decisions, registryState.bots]);

  useEffect(() => {
    if (!botsHydrated || !decisionsHydrated || !candidates.length) return;

    const fingerprint = candidates
      .map(({ bot, signal }) => {
        const intent = resolveAutomatedIntent(bot, signal, decisions);
        return `${bot.id}:${signal.id}:${intent.action}:${intent.status}`;
      })
      .join("|");

    if (!fingerprint || fingerprint === loopFingerprintRef.current) return;
    loopFingerprintRef.current = fingerprint;

    let cancelled = false;
    void (async () => {
      for (const { bot, signal } of candidates) {
        if (cancelled) return;
        await createDecision(buildOperationalDecision(bot, signal, decisions));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [botsHydrated, candidates, createDecision, decisions, decisionsHydrated]);

  const pendingIntentLanePatches = useMemo(() => {
    if (!botsHydrated || !decisionsHydrated) return [];

    const botById = new Map(registryState.bots.map((bot) => [bot.id, bot]));
    return decisions
      .map((decision) => {
        const bot = botById.get(decision.botId);
        if (!bot || bot.status !== "active") return null;
        const patch = buildIntentLanePatch(bot, decision);
        return patch ? { decision, patch } : null;
      })
      .filter((entry): entry is { decision: BotDecisionRecord; patch: Partial<BotDecisionRecord> } => Boolean(entry));
  }, [botsHydrated, decisions, decisionsHydrated, registryState.bots]);

  useEffect(() => {
    if (!pendingIntentLanePatches.length) return;

    const fingerprint = pendingIntentLanePatches
      .map(({ decision, patch }) => `${decision.id}:${String(patch.metadata?.executionIntentLaneStatus || "")}:${String(patch.metadata?.executionIntentLane || "")}`)
      .join("|");
    if (!fingerprint || fingerprint === intentLaneFingerprintRef.current) return;
    intentLaneFingerprintRef.current = fingerprint;

    let cancelled = false;
    void (async () => {
      for (const { decision, patch } of pendingIntentLanePatches) {
        if (cancelled) return;
        await updateDecision(decision.id, patch);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingIntentLanePatches, updateDecision]);

  const pendingDispatches = useMemo(() => {
    if (!botsHydrated || !decisionsHydrated) return [];

    const botById = new Map(registryState.bots.map((bot) => [bot.id, bot]));
    return decisions
      .map((decision) => {
        const bot = botById.get(decision.botId);
        if (!bot || bot.status !== "active") return null;
        if (!decision.metadata?.generatedByOperationalLoop) return null;
        if (decision.metadata?.executionOrderId) return null;
        if (getDecisionIntentLaneStatus(decision) !== "dispatch-requested") return null;
        return { bot, decision };
      })
      .filter((entry): entry is { bot: Bot; decision: BotDecisionRecord } => Boolean(entry));
  }, [botsHydrated, decisions, decisionsHydrated, registryState.bots]);

  useEffect(() => {
    if (!pendingDispatches.length) return;

    let cancelled = false;
    void (async () => {
      for (const { decision } of pendingDispatches) {
        if (cancelled) return;
        if (dispatchInFlightRef.current.has(decision.id)) continue;
        dispatchInFlightRef.current.add(decision.id);

        try {
          const lane = String(decision.metadata?.executionIntentLane || "").trim();
          const dispatchMode = getDispatchModeForLane(lane);
          const signalId = getDispatchSignalId(decision);
          const now = new Date().toISOString();

          if (!dispatchMode) {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentDispatchStatus: "blocked",
                executionIntentReason: `The ${lane || "unknown"} lane cannot dispatch through the shared paper/demo adapter.`,
              },
            });
            continue;
          }

          if (!signalId) {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentDispatchStatus: "blocked",
                executionIntentReason: "The bot intent is missing a published signal id for paper/demo dispatch.",
              },
            });
            continue;
          }

          const payload = await systemDataPlaneStore.getState().actions.executeDemoSignal(signalId, dispatchMode) as {
            candidate?: { status?: string; reasons?: string[] };
            protection?: { protectionAttached?: boolean; protectionNote?: string };
          } | null;

          const candidateStatus = String(payload?.candidate?.status || "").trim().toLowerCase();
          const candidateReason = payload?.candidate?.reasons?.[0] || "";

          if (!payload || candidateStatus === "blocked") {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentDispatchStatus: candidateStatus || "failed",
                executionIntentDispatchMode: dispatchMode,
                executionIntentDispatchSignalId: signalId,
                executionIntentReason: candidateReason || `The ${lane} dispatch adapter could not progress ${decision.symbol}.`,
              },
            });
            continue;
          }

          await updateDecision(decision.id, {
            status: dispatchMode === "execute" && decision.status !== "closed" ? "pending" : decision.status,
            metadata: {
              ...decision.metadata,
              executionIntentLaneStatus: dispatchMode === "execute" ? "execution-submitted" : "previewed",
              executionIntentLastUpdatedAt: now,
              executionIntentDispatchAttemptedAt: now,
              executionIntentDispatchedAt: now,
              executionIntentDispatchStatus: candidateStatus || "submitted",
              executionIntentDispatchMode: dispatchMode,
              executionIntentDispatchSignalId: signalId,
              executionIntentDispatchProtectionAttached: Boolean(payload?.protection?.protectionAttached),
              executionIntentReason: dispatchMode === "execute"
                ? "Dispatched through the shared demo execution adapter."
                : "Dispatched through the shared paper preview adapter.",
            },
          });
        } finally {
          dispatchInFlightRef.current.delete(decision.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingDispatches, updateDecision]);
}
