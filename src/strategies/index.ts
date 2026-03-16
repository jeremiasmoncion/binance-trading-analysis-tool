import { trendAlignmentV1Strategy } from "./trendAlignmentV1";
import type { StrategyDefinition } from "./types";

export const strategyRegistry: Record<string, StrategyDefinition> = {
  [trendAlignmentV1Strategy.descriptor.id]: trendAlignmentV1Strategy,
};

export const defaultStrategy = trendAlignmentV1Strategy;

export function getStrategy(id?: string) {
  if (!id) return defaultStrategy;
  return strategyRegistry[id] || defaultStrategy;
}
