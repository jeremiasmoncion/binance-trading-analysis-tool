import { buildDashboardAnalysis, generateSignal } from "../lib/trading";
import type { StrategyDescriptor } from "../types";
import type { StrategyDefinition, StrategyExecutionInput, StrategyExecutionResult } from "./types";

const descriptor: StrategyDescriptor = {
  id: "trend-alignment",
  version: "v1",
  label: "Trend Alignment v1",
  description: "Estrategia base de tendencia, momentum y alineación entre temporalidades.",
  category: "trend",
  preferredTimeframes: ["15m", "1h", "4h"],
  tradingStyle: "intradía",
  holdingProfile: "corto a medio",
  idealMarketConditions: ["tendencia", "pullback ordenado"],
  parameters: {
    trendWeight: 20,
    oversoldBoost: 15,
    overboughtPenalty: 15,
    buyThreshold: 65,
    sellThreshold: 35,
  },
};

function execute(input: StrategyExecutionInput): StrategyExecutionResult {
  const signal = generateSignal(input.indicators);
  const analysis = buildDashboardAnalysis(input.candles, input.indicators, signal, input.multiTimeframes);

  return {
    strategy: descriptor,
    signal,
    analysis,
  };
}

export const trendAlignmentV1Strategy: StrategyDefinition = {
  descriptor,
  execute,
};
