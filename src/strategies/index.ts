import type { StrategyCandidate } from "../types";
import { breakoutV1Strategy } from "./breakoutV1";
import { trendAlignmentV1Strategy } from "./trendAlignmentV1";
import type { StrategyDefinition, StrategyExecutionInput, StrategyExecutionResult } from "./types";

export const strategyRegistry: Record<string, StrategyDefinition> = {
  [breakoutV1Strategy.descriptor.id]: breakoutV1Strategy,
  [trendAlignmentV1Strategy.descriptor.id]: trendAlignmentV1Strategy,
};

export const defaultStrategy = trendAlignmentV1Strategy;

export function getStrategy(id?: string) {
  if (!id) return defaultStrategy;
  return strategyRegistry[id] || defaultStrategy;
}

function getRankScore(result: StrategyExecutionResult) {
  const conviction = Math.abs(result.signal.score - 50);
  const actionableBonus = result.signal.label === "Esperar" ? 0 : 25;
  const setupBonus = result.analysis.setupQuality === "Alta" ? 12 : result.analysis.setupQuality === "Media" ? 6 : 0;
  const alignmentBonus = Math.round(result.analysis.alignmentCount * 1.5);
  const riskPenalty = result.analysis.riskLabel === "Agresivo" ? 12 : result.analysis.riskLabel === "Elevado" ? 6 : 0;
  const warningPenalty = Math.max(0, result.analysis.warnings.length - result.analysis.confirmations.length) * 2;
  return actionableBonus + conviction + setupBonus + alignmentBonus - riskPenalty - warningPenalty;
}

export function runStrategyEngine(input: StrategyExecutionInput): {
  primary: StrategyCandidate;
  candidates: StrategyCandidate[];
} {
  const candidates = Object.values(strategyRegistry)
    .map((strategy) => strategy.execute(input))
    .map((result) => ({
      ...result,
      rankScore: getRankScore(result),
    }))
    .sort((a, b) => b.rankScore - a.rankScore || b.signal.score - a.signal.score)
    .map((result, index) => ({
      ...result,
      isPrimary: index === 0,
    }));

  return {
    primary: candidates[0],
    candidates,
  };
}
