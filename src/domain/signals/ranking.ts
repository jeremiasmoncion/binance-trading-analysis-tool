import type { PublishedSignal, RankedPublishedSignal, SignalFeed, SignalRankLane, SignalRankTier } from "./contracts";

function getLane(signal: PublishedSignal): SignalRankLane {
  return signal.audience === "watchlist" ? "watchlist-first" : "market-discovery";
}

function rankTierFromScore(input: {
  score: number;
  lane: SignalRankLane;
  majorPenaltyCount: number;
  boostCount: number;
}): SignalRankTier {
  const { score, lane, majorPenaltyCount, boostCount } = input;

  if (lane === "watchlist-first") {
    if (score >= 88 && majorPenaltyCount === 0 && boostCount >= 4) {
      return "high-confidence";
    }

    if (score >= 72) {
      return "priority";
    }

    if (score >= 52) {
      return "standard";
    }

    return "low-visibility";
  }

  if (score >= 94 && majorPenaltyCount === 0 && boostCount >= 5) {
    return "high-confidence";
  }

  if (score >= 80) {
    return "priority";
  }

  if (score >= 60) {
    return "standard";
  }

  return "low-visibility";
}

function dedupeNotes(notes: string[]): string[] {
  return Array.from(new Set(notes.filter(Boolean)));
}

export function rankPublishedSignal(signal: PublishedSignal): RankedPublishedSignal {
  let compositeScore = signal.visibilityScore;
  const lane = getLane(signal);
  const boosts: string[] = [];
  const penalties: string[] = [];
  const rationale: string[] = [];

  if (lane === "watchlist-first") {
    compositeScore += 8;
    boosts.push("Watchlist activa");
  } else {
    compositeScore -= 4;
    rationale.push("Descubrimiento de mercado general");
    penalties.push("Exige umbral más alto para discovery");
  }

  if (signal.context.score >= 70) {
    compositeScore += 10;
    boosts.push("Score base fuerte");
  } else if (signal.context.score < 45) {
    compositeScore -= 10;
    penalties.push("Score base bajo");
  }

  if (signal.feedKinds.includes("high-confidence")) {
    compositeScore += 12;
    boosts.push("Visibility score alto");
  }

  if (signal.context.timeframe === "1h" || signal.context.timeframe === "4h") {
    compositeScore += 6;
    boosts.push("Timeframe con mejor legibilidad");
  } else if (signal.context.timeframe === "5m") {
    compositeScore -= 6;
    penalties.push("Timeframe ruidoso");
  }

  if (signal.context.marketRegime && signal.context.marketRegime !== "unknown") {
    compositeScore += 4;
    boosts.push("Contexto de mercado identificado");
  } else {
    compositeScore -= 4;
    penalties.push("Contexto de mercado incompleto");
  }

  if (signal.reasons.length >= 3) {
    compositeScore += 4;
    boosts.push("Explicabilidad inicial suficiente");
  } else {
    compositeScore -= 4;
    penalties.push("Explicabilidad limitada");
  }

  if (signal.context.direction === "NEUTRAL") {
    compositeScore -= 8;
    penalties.push("Dirección poco definida");
  } else {
    boosts.push("Dirección operativa visible");
  }

  if (lane === "market-discovery" && signal.context.timeframe === "15m") {
    compositeScore -= 3;
    penalties.push("Discovery intradía más propenso a ruido");
  }

  const majorPenaltyCount = penalties.filter((note) => (
    note === "Score base bajo"
    || note === "Timeframe ruidoso"
    || note === "Dirección poco definida"
    || note === "Contexto de mercado incompleto"
  )).length;

  const tier = rankTierFromScore({
    score: compositeScore,
    lane,
    majorPenaltyCount,
    boostCount: boosts.length,
  });

  rationale.push(
    tier === "high-confidence"
      ? "Promovida al subset de alta confianza."
      : tier === "priority"
        ? "Promovida al tramo priorizado del feed."
        : tier === "standard"
          ? "Se mantiene visible, pero sin prioridad fuerte."
          : "Se mantiene en el feed crudo con baja prioridad.",
  );

  return {
    ...signal,
    ranking: {
      compositeScore,
      tier,
      lane,
      boosts: dedupeNotes(boosts),
      penalties: dedupeNotes(penalties),
      rationale: dedupeNotes(rationale),
    },
  };
}

export function rankPublishedFeed(feed: SignalFeed<PublishedSignal>): SignalFeed<RankedPublishedSignal> {
  return {
    kind: feed.kind,
    generatedAt: feed.generatedAt,
    items: feed.items
      .map(rankPublishedSignal)
      .sort((left, right) => right.ranking.compositeScore - left.ranking.compositeScore || right.visibilityScore - left.visibilityScore),
  };
}
