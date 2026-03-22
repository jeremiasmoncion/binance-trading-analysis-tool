import { useEffect, useMemo, useRef } from "react";
import {
  createBotConsumableFeed,
  getBotPreviewChurnSummary,
  getBotReadyContentionSummary,
  getDecisionIntentLaneStatus,
  getDecisionIntentStatus,
  getDispatchModeForLane,
  getDispatchSignalId,
  getIntentLaneForBot,
  isReadyContentionBlockedDecision,
  normalizeSignalId,
  resolveAutomatedIntent,
  selectAcceptedBotConsumableSignals,
  type Bot,
  type BotDecisionRecord,
  type RankedPublishedSignal,
} from "../domain";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import { useBotDecisionsState } from "./useBotDecisions";
import { useMarketSignalsCore } from "./useMarketSignalsCore";
import { useSignalsBotsReadModel } from "./useSignalsBotsReadModel";
import { useSelectedBotState } from "./useSelectedBot";

const MAX_PREVIEW_CHURN_PARDONS = 2;
const MAX_PREVIEW_CHURN_MANUAL_CLEARS = 1;
const MAX_PREVIEW_CHURN_HARD_RESETS = 1;
function dedupeRankedSignals<T extends { id: string }>(signals: T[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
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

function hasActivePreviewChurnPardon(decision: BotDecisionRecord) {
  const grantedAt = String(decision.metadata?.executionIntentPreviewChurnPardonGrantedAt || "").trim();
  const consumedAt = String(decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || "").trim();
  if (!grantedAt) return false;
  if (!consumedAt) return true;
  return new Date(grantedAt).getTime() > new Date(consumedAt).getTime();
}

function getPreviewChurnPardonCount(decision: BotDecisionRecord) {
  return Number(decision.metadata?.executionIntentPreviewChurnPardonCount || 0) || 0;
}

function hasActivePreviewChurnManualClear(decision: BotDecisionRecord) {
  const grantedAt = String(decision.metadata?.executionIntentPreviewChurnManualClearGrantedAt || "").trim();
  const consumedAt = String(decision.metadata?.executionIntentPreviewChurnManualClearConsumedAt || "").trim();
  if (!grantedAt) return false;
  if (!consumedAt) return true;
  return new Date(grantedAt).getTime() > new Date(consumedAt).getTime();
}

function getPreviewChurnManualClearCount(decision: BotDecisionRecord) {
  return Number(decision.metadata?.executionIntentPreviewChurnManualClearCount || 0) || 0;
}

function hasActivePreviewChurnHardReset(decision: BotDecisionRecord) {
  const grantedAt = String(decision.metadata?.executionIntentPreviewChurnHardResetGrantedAt || "").trim();
  const consumedAt = String(decision.metadata?.executionIntentPreviewChurnHardResetConsumedAt || "").trim();
  if (!grantedAt) return false;
  if (!consumedAt) return true;
  return new Date(grantedAt).getTime() > new Date(consumedAt).getTime();
}

function getPreviewChurnHardResetCount(decision: BotDecisionRecord) {
  return Number(decision.metadata?.executionIntentPreviewChurnHardResetCount || 0) || 0;
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
    && ["dispatch-requested", "previewed", "preview-recorded", "execution-submitted", "linked", "blocked"].includes(currentLaneStatus)
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
  const botsReadModel = useSignalsBotsReadModel();
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

  const readyContentionAutoPromotions = useMemo(() => {
    if (!botsHydrated || !decisionsHydrated) return [];

    const botById = new Map(registryState.bots.map((bot) => [bot.id, bot]));
    const activeBots = registryState.bots.filter((bot) => bot.status === "active");
    return decisions
      .map((decision) => {
        const bot = botById.get(decision.botId);
        if (!bot || bot.status !== "active") return null;
        if (!decision.metadata?.generatedByOperationalLoop) return null;
        if (!isReadyContentionBlockedDecision(decision)) return null;
        if (decision.metadata?.executionOrderId) return null;
        const contention = getBotReadyContentionSummary(bot, decisions, activeBots);
        if (contention.severe) return null;
        return { decision, contention };
      })
      .filter((entry): entry is { decision: BotDecisionRecord; contention: ReturnType<typeof getBotReadyContentionSummary> } => Boolean(entry));
  }, [botsHydrated, decisions, decisionsHydrated, registryState.bots]);

  const queuedIntentAutoPromotions = useMemo(() => {
    if (!botsHydrated || !decisionsHydrated) return [];

    const botById = new Map(registryState.bots.map((bot) => [bot.id, bot]));
    const activeBots = registryState.bots.filter((bot) => bot.status === "active");
    return decisions
      .map((decision) => {
        const bot = botById.get(decision.botId);
        if (!bot || bot.status !== "active") return null;
        if (!decision.metadata?.generatedByOperationalLoop) return null;
        if (decision.metadata?.executionOrderId) return null;
        if (getDecisionIntentStatus(decision) !== "ready") return null;
        if (getDecisionIntentLaneStatus(decision) !== "queued") return null;
        const contention = getBotReadyContentionSummary(bot, decisions, activeBots);
        if (getIntentLaneForBot(bot) === "paper" && contention.severe) return null;
        return { bot, decision, contention };
      })
      .filter((entry): entry is { bot: Bot; decision: BotDecisionRecord; contention: ReturnType<typeof getBotReadyContentionSummary> } => Boolean(entry));
  }, [botsHydrated, decisions, decisionsHydrated, registryState.bots]);

  useEffect(() => {
    if (!readyContentionAutoPromotions.length) return;

    let cancelled = false;
    void (async () => {
      for (const { decision, contention } of readyContentionAutoPromotions) {
        if (cancelled) return;
        await updateDecision(decision.id, {
          status: "approved",
          metadata: {
            ...decision.metadata,
            executionIntentStatus: "ready",
            executionIntentLaneStatus: "dispatch-requested",
            executionIntentLastUpdatedAt: new Date().toISOString(),
            executionIntentDispatchRequestedAt: new Date().toISOString(),
            executionIntentReadyContentionAutoPromotionCount: Number(decision.metadata?.executionIntentReadyContentionAutoPromotionCount || 0) + 1,
            executionIntentReadyContentionAutoPromotedAt: new Date().toISOString(),
            executionIntentReason: contention.isLeader
              ? `Ready contention cleared enough for automatic promotion because this bot now leads ${contention.pair || decision.symbol}.`
              : `Ready contention cleared enough for automatic promotion because no peer bot is still ahead on ${contention.pair || decision.symbol}.`,
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readyContentionAutoPromotions, updateDecision]);

  useEffect(() => {
    if (!queuedIntentAutoPromotions.length) return;

    let cancelled = false;
    void (async () => {
      for (const { bot, decision, contention } of queuedIntentAutoPromotions) {
        if (cancelled) return;
        const lane = getIntentLaneForBot(bot);
        await updateDecision(decision.id, {
          status: decision.status === "blocked" ? "approved" : decision.status,
          metadata: {
            ...decision.metadata,
            executionIntentLaneStatus: "dispatch-requested",
            executionIntentLastUpdatedAt: new Date().toISOString(),
            executionIntentDispatchRequestedAt: new Date().toISOString(),
            executionIntentReadyAutoPromotionCount: Number(decision.metadata?.executionIntentReadyAutoPromotionCount || 0) + 1,
            executionIntentReadyAutoPromotedAt: new Date().toISOString(),
            executionIntentReason: lane === "paper"
              ? contention.isLeader
                ? `Ready intent promoted automatically because this bot leads the ${contention.pair || decision.symbol} paper queue.`
                : `Ready intent promoted automatically because no peer bot is currently ahead on ${contention.pair || decision.symbol}.`
              : `Ready intent promoted automatically for governed ${lane} dispatch.`,
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queuedIntentAutoPromotions, updateDecision]);

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
      const activeBots = registryState.bots.filter((bot) => bot.status === "active");
      for (const { bot, decision } of pendingDispatches) {
        if (cancelled) return;
        if (dispatchInFlightRef.current.has(decision.id)) continue;
        dispatchInFlightRef.current.add(decision.id);

        try {
          const lane = String(decision.metadata?.executionIntentLane || "").trim();
          const dispatchMode = getDispatchModeForLane(lane);
          const signalId = getDispatchSignalId(decision);
          const now = new Date().toISOString();
          const previewChurn = getBotPreviewChurnSummary(decision.botId, decisions);
          const readyContention = getBotReadyContentionSummary(bot, decisions, activeBots);

          if (!dispatchMode) {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentPreviewChurnPardonConsumedAt: decision.metadata?.executionIntentPreviewChurnPardonGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || null,
                executionIntentDispatchStatus: "blocked",
                executionIntentReason: `The ${lane || "unknown"} lane cannot dispatch through the shared paper/demo adapter.`,
              },
            });
            continue;
          }

          if (dispatchMode === "preview" && readyContention.severe) {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentDispatchStatus: "blocked",
                executionIntentDispatchMode: dispatchMode,
                executionIntentDispatchSignalId: signalId,
                executionIntentReason: `Paper preview dispatch paused because ready contention is active on ${readyContention.pair || decision.symbol} and ${readyContention.leaderBotName || "another bot"} currently leads queue position 1 while this intent is in position ${readyContention.queuePosition || 2}.`,
              },
            });
            continue;
          }

          if (
            dispatchMode === "preview"
            && previewChurn.severePreviewChurn
            && !hasActivePreviewChurnPardon(decision)
            && !hasActivePreviewChurnManualClear(decision)
            && !hasActivePreviewChurnHardReset(decision)
          ) {
            const pardonCount = getPreviewChurnPardonCount(decision);
            const manualClearCount = getPreviewChurnManualClearCount(decision);
            const hardResetCount = getPreviewChurnHardResetCount(decision);
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentPreviewChurnPardonConsumedAt: decision.metadata?.executionIntentPreviewChurnPardonGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || null,
                executionIntentPreviewChurnManualClearConsumedAt: decision.metadata?.executionIntentPreviewChurnManualClearGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnManualClearConsumedAt || null,
                executionIntentPreviewChurnHardResetConsumedAt: decision.metadata?.executionIntentPreviewChurnHardResetGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnHardResetConsumedAt || null,
                executionIntentDispatchStatus: "blocked",
                executionIntentDispatchMode: dispatchMode,
                executionIntentDispatchSignalId: signalId,
                executionIntentReason:
                  hardResetCount >= MAX_PREVIEW_CHURN_HARD_RESETS
                    ? `Paper preview dispatch paused because preview churn is severe and the hard reset limit was reached (${previewChurn.previewExpiredCount} expired / ${previewChurn.previewRefreshCount} refreshes / ${pardonCount} pardons / ${manualClearCount} manual clears / ${hardResetCount} hard resets).`
                    : manualClearCount >= MAX_PREVIEW_CHURN_MANUAL_CLEARS
                    ? `Paper preview dispatch paused because preview churn is severe and the manual clear limit was reached (${previewChurn.previewExpiredCount} expired / ${previewChurn.previewRefreshCount} refreshes / ${pardonCount} pardons / ${manualClearCount} manual clears).`
                    : pardonCount >= MAX_PREVIEW_CHURN_PARDONS
                      ? `Paper preview dispatch paused because preview churn is severe and the pardon limit was reached (${previewChurn.previewExpiredCount} expired / ${previewChurn.previewRefreshCount} refreshes / ${pardonCount} pardons).`
                      : `Paper preview dispatch paused because preview churn is severe (${previewChurn.previewExpiredCount} expired / ${previewChurn.previewRefreshCount} refreshes).`,
              },
            });
            continue;
          }

          if (
            dispatchMode === "execute"
            && String(botsReadModel.botSummary.operationalVerdictState || "").trim() !== "close"
          ) {
            await updateDecision(decision.id, {
              status: "blocked",
              metadata: {
                ...decision.metadata,
                executionIntentLaneStatus: "blocked",
                executionIntentLastUpdatedAt: now,
                executionIntentDispatchAttemptedAt: now,
                executionIntentDispatchStatus: "blocked",
                executionIntentDispatchMode: dispatchMode,
                executionIntentDispatchSignalId: signalId,
                executionIntentReason: `Demo dispatch paused because the fleet operational verdict is ${String(botsReadModel.botSummary.operationalVerdictState || "forming").trim() || "forming"} and only close currently unlocks governed demo flow: ${botsReadModel.botSummary.operationalVerdictNote || "the governed paper/demo lane is not stable enough yet."}`,
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
                executionIntentPreviewChurnPardonConsumedAt: decision.metadata?.executionIntentPreviewChurnPardonGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || null,
                executionIntentPreviewChurnManualClearConsumedAt: decision.metadata?.executionIntentPreviewChurnManualClearGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnManualClearConsumedAt || null,
                executionIntentPreviewChurnHardResetConsumedAt: decision.metadata?.executionIntentPreviewChurnHardResetGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnHardResetConsumedAt || null,
                executionIntentDispatchStatus: "blocked",
                executionIntentReason: "The bot intent is missing a published signal id for paper/demo dispatch.",
              },
            });
            continue;
          }

          const payload = await systemDataPlaneStore.getState().actions.executeDemoSignal(signalId, dispatchMode, {
            botId: bot.id,
            botName: bot.name,
            origin: "bot-auto",
          }) as {
            candidate?: { status?: string; reasons?: string[] };
            record?: { id?: number | null };
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
                executionIntentPreviewChurnPardonConsumedAt: decision.metadata?.executionIntentPreviewChurnPardonGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || null,
                executionIntentPreviewChurnManualClearConsumedAt: decision.metadata?.executionIntentPreviewChurnManualClearGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnManualClearConsumedAt || null,
                executionIntentPreviewChurnHardResetConsumedAt: decision.metadata?.executionIntentPreviewChurnHardResetGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnHardResetConsumedAt || null,
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
              executionIntentPreviewChurnPardonConsumedAt: decision.metadata?.executionIntentPreviewChurnPardonGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnPardonConsumedAt || null,
              executionIntentPreviewChurnManualClearConsumedAt: decision.metadata?.executionIntentPreviewChurnManualClearGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnManualClearConsumedAt || null,
              executionIntentPreviewChurnHardResetConsumedAt: decision.metadata?.executionIntentPreviewChurnHardResetGrantedAt ? now : decision.metadata?.executionIntentPreviewChurnHardResetConsumedAt || null,
              executionIntentDispatchStatus: candidateStatus || "submitted",
              executionIntentDispatchMode: dispatchMode,
              executionIntentDispatchSignalId: signalId,
              executionOrderId: Number(payload?.record?.id || 0) || decision.metadata?.executionOrderId || null,
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
  }, [botsReadModel.botSummary.operationalVerdictNote, botsReadModel.botSummary.operationalVerdictState, decisions, pendingDispatches, registryState.bots, updateDecision]);
}
