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

function resolveOperationalIntent(bot: Bot, signal: RankedPublishedSignal) {
  const executionEligible = Boolean(signal.intelligence?.executionEligible)
    || signal.ranking.tier === "high-confidence"
    || signal.ranking.tier === "priority";
  const canSelfExecute = (
    bot.automationMode === "auto"
    && executionEligible
    && bot.executionPolicy.canOpenPositions
    && bot.executionPolicy.autoExecutionEnabled
    && !bot.executionPolicy.suggestionsOnly
    && !bot.executionPolicy.requiresHumanApproval
    && (bot.executionEnvironment !== "real" || bot.executionPolicy.realExecutionEnabled)
  );

  if (canSelfExecute) {
    return {
      action: "execute" as BotDecisionAction,
      status: "pending" as const,
      source: "ai-supervisor" as BotDecisionSource,
      rationale: `Bot operativo listo para ejecutar ${signal.context.symbol} automaticamente tras pasar politicas y elegibilidad.`,
      executionIntentStatus: "ready",
    };
  }

  if (bot.automationMode === "assist" || (bot.automationMode === "auto" && executionEligible)) {
    return {
      action: "assist" as BotDecisionAction,
      status: "approved" as const,
      source: "ai-supervisor" as BotDecisionSource,
      rationale: `Bot operativo elevo ${signal.context.symbol} para revision asistida antes de ejecucion.`,
      executionIntentStatus: bot.executionPolicy.requiresHumanApproval ? "approval-needed" : "assist-only",
    };
  }

  return {
    action: "observe" as BotDecisionAction,
    status: "approved" as const,
    source: "signal-core" as BotDecisionSource,
    rationale: `Bot operativo observo ${signal.context.symbol} dentro de su feed consumible y politicas actuales.`,
    executionIntentStatus: "observe-only",
  };
}

function buildOperationalDecision(bot: Bot, signal: RankedPublishedSignal): BotDecisionRecord {
  const intent = resolveOperationalIntent(bot, signal);
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
      generatedByOperationalLoop: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function useBotOperationalLoop() {
  const { state: registryState, hydrated: botsHydrated } = useSelectedBotState();
  const { decisions, hydrated: decisionsHydrated, createDecision } = useBotDecisionsState();
  const core = useMarketSignalsCore();
  const loopFingerprintRef = useRef("");

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
        const intent = resolveOperationalIntent(bot, signal);
        return `${bot.id}:${signal.id}:${intent.action}:${intent.status}`;
      })
      .join("|");

    if (!fingerprint || fingerprint === loopFingerprintRef.current) return;
    loopFingerprintRef.current = fingerprint;

    let cancelled = false;
    void (async () => {
      for (const { bot, signal } of candidates) {
        if (cancelled) return;
        await createDecision(buildOperationalDecision(bot, signal));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [botsHydrated, candidates, createDecision, decisionsHydrated]);
}
