import type { StrategyCandidate } from "../types";
import { breakoutV1Strategy } from "./breakoutV1";
import { trendAlignmentV1Strategy } from "./trendAlignmentV1";
import { trendAlignmentV2Strategy } from "./trendAlignmentV2";
import type { StrategyDefinition, StrategyExecutionInput, StrategyExecutionResult } from "./types";

function strategyKey(strategy: StrategyDefinition) {
  return `${strategy.descriptor.id}:${strategy.descriptor.version}`;
}

export const strategyRegistry: Record<string, StrategyDefinition> = {
  [strategyKey(breakoutV1Strategy)]: breakoutV1Strategy,
  [strategyKey(trendAlignmentV1Strategy)]: trendAlignmentV1Strategy,
  [strategyKey(trendAlignmentV2Strategy)]: trendAlignmentV2Strategy,
};

export const defaultStrategy = trendAlignmentV2Strategy;

export function getStrategy(id?: string) {
  if (!id) return defaultStrategy;
  const byVersion = strategyRegistry[id];
  if (byVersion) return byVersion;
  const byId = Object.values(strategyRegistry).find((strategy) => strategy.descriptor.id === id);
  return byId || defaultStrategy;
}

function getRankScore(result: StrategyExecutionResult, timeframe: string) {
  const conviction = Math.abs(result.signal.score - 50);
  const actionableBonus = result.signal.label === "Esperar" ? 0 : 25;
  const setupBonus = result.analysis.setupQuality === "Alta" ? 12 : result.analysis.setupQuality === "Media" ? 6 : 0;
  const alignmentBonus = Math.round(result.analysis.alignmentCount * 1.5);
  const riskPenalty = result.analysis.riskLabel === "Agresivo" ? 12 : result.analysis.riskLabel === "Elevado" ? 6 : 0;
  const warningPenalty = Math.max(0, result.analysis.warnings.length - result.analysis.confirmations.length) * 2;
  const timeframeBonus = result.strategy.preferredTimeframes.includes(timeframe) ? 8 : -10;
  return actionableBonus + conviction + setupBonus + alignmentBonus + timeframeBonus - riskPenalty - warningPenalty;
}

export function runStrategyEngine(input: StrategyExecutionInput): {
  primary: StrategyCandidate;
  candidates: StrategyCandidate[];
} {
  const candidates = Object.values(strategyRegistry)
    .map((strategy) => strategy.execute(input))
    .map((result) => ({
      ...result,
      rankScore: getRankScore(result, input.timeframe),
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
