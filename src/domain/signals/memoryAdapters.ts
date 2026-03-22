import type { SignalSnapshot } from "../../types";
import { createSignalFeed } from "./classification";
import type { PublishedSignal, SignalFeed } from "./contracts";

export interface MemorySignalFeedBundle {
  all: SignalFeed<PublishedSignal>;
  watchlist: SignalFeed<PublishedSignal>;
  marketWide: SignalFeed<PublishedSignal>;
  highConfidence: SignalFeed<PublishedSignal>;
}

function normalizeDirection(value?: string): "BUY" | "SELL" | "NEUTRAL" {
  const normalized = String(value || "").trim().toLowerCase();

  if (["buy", "bullish", "long", "alcista"].includes(normalized)) {
    return "BUY";
  }

  if (["sell", "bearish", "short", "bajista"].includes(normalized)) {
    return "SELL";
  }

  return "NEUTRAL";
}

function buildReasons(snapshot: SignalSnapshot): string[] {
  const reasons = [
    snapshot.signal_label,
    snapshot.setup_type ? `Setup ${snapshot.setup_type}` : "",
    snapshot.risk_label ? `Riesgo ${snapshot.risk_label}` : "",
    snapshot.note || "",
  ].filter(Boolean);

  return reasons.length ? reasons : ["Señal registrada en memoria compartida."];
}

function buildVisibilityScore(snapshot: SignalSnapshot, isWatchlistSignal: boolean): number {
  const score = Number(snapshot.signal_score || 0);
  const confirmations = Number(snapshot.confirmations_count || 0);
  const executionEligible = snapshot.signal_payload?.decision?.executionEligible === true ? 6 : 0;
  const watchlistBoost = isWatchlistSignal ? 4 : 0;

  return score + confirmations + executionEligible + watchlistBoost;
}

export function mapSignalSnapshotToPublishedSignal(
  snapshot: SignalSnapshot,
  input: {
    watchlistSymbols?: string[];
    generatedAt?: string;
  } = {},
): PublishedSignal {
  const watchlistSymbols = new Set((input.watchlistSymbols || []).map((item) => item.toUpperCase()));
  const symbol = snapshot.coin.toUpperCase();
  const isWatchlistSignal = watchlistSymbols.has(symbol);
  const visibilityScore = buildVisibilityScore(snapshot, isWatchlistSignal);
  const score = Number(snapshot.signal_score || 0);
  const observedAt = snapshot.updated_at || snapshot.created_at || input.generatedAt || new Date().toISOString();

  return {
    id: `published:memory:${snapshot.id}`,
    layer: "published-signal",
    context: {
      symbol,
      timeframe: snapshot.timeframe,
      score,
      strategyId: snapshot.strategy_name || snapshot.signal_payload?.strategy?.id || "unknown",
      strategyVersion: snapshot.strategy_version || snapshot.signal_payload?.strategy?.version,
      direction: normalizeDirection(snapshot.signal_payload?.context?.direction || snapshot.trend),
      marketRegime: snapshot.signal_payload?.context?.marketRegime,
      source: isWatchlistSignal ? "watchlist" : "market",
      observedAt,
    },
    reasons: buildReasons(snapshot),
    audience: isWatchlistSignal ? "watchlist" : "market",
    visibilityScore,
    feedKinds: [
      isWatchlistSignal ? "watchlist" : "market-wide",
      ...(visibilityScore >= 65 ? ["high-confidence" as const] : []),
    ],
    // Preserve decision/scorer metadata from signal memory so Signal Core
    // can promote AI-prioritized and informational cohorts from real stored evidence.
    intelligence: {
      executionEligible: snapshot.signal_payload?.decision?.executionEligible === true,
      decisionSource: snapshot.signal_payload?.decision?.source,
      adaptiveScore: snapshot.signal_payload?.decision?.adaptiveScore,
      scorerLabel: snapshot.signal_payload?.decision?.scorer?.label,
      scorerConfidence: snapshot.signal_payload?.decision?.scorer?.confidence,
      contextSignature: snapshot.signal_payload?.context?.contextSignature,
    },
  };
}

export function createPublishedSignalFeedBundleFromMemory(
  snapshots: SignalSnapshot[],
  input: {
    watchlistSymbols?: string[];
    generatedAt?: string;
  } = {},
): MemorySignalFeedBundle {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const publishedSignals = snapshots.map((snapshot) => mapSignalSnapshotToPublishedSignal(snapshot, {
    watchlistSymbols: input.watchlistSymbols,
    generatedAt,
  }));

  return {
    all: createSignalFeed("market-wide", publishedSignals, generatedAt),
    watchlist: createSignalFeed("watchlist", publishedSignals.filter((signal) => signal.audience === "watchlist"), generatedAt),
    marketWide: createSignalFeed("market-wide", publishedSignals.filter((signal) => signal.audience === "market"), generatedAt),
    highConfidence: createSignalFeed("high-confidence", publishedSignals.filter((signal) => signal.feedKinds.includes("high-confidence")), generatedAt),
  };
}
