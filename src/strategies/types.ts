import type { Candle, DashboardAnalysis, Indicators, Signal, StrategyDescriptor, TimeframeSignal } from "../types";

export interface StrategyExecutionInput {
  candles: Candle[];
  indicators: Indicators;
  timeframe: string;
  multiTimeframes: TimeframeSignal[];
}

export interface StrategyExecutionResult {
  strategy: StrategyDescriptor;
  signal: Signal;
  analysis: DashboardAnalysis;
}

export interface StrategyDefinition {
  descriptor: StrategyDescriptor;
  execute(input: StrategyExecutionInput): StrategyExecutionResult;
}
