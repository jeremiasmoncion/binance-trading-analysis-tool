import { buildDashboardAnalysis } from "../lib/trading";
import type { Signal, StrategyDescriptor } from "../types";
import type { StrategyDefinition, StrategyExecutionInput, StrategyExecutionResult } from "./types";

const descriptor: StrategyDescriptor = {
  id: "breakout",
  version: "v1",
  label: "Breakout v1",
  description: "Busca rupturas limpias con confirmación de volumen y sesgo del marco mayor.",
  category: "breakout",
  preferredTimeframes: ["5m", "15m", "1h"],
  tradingStyle: "scalping / intradía",
  holdingProfile: "rápido",
  idealMarketConditions: ["ruptura", "expansión", "volumen fuerte"],
  parameters: {
    lookbackCandles: 20,
    breakoutBufferPct: 0.1,
    volumeThreshold: 1.15,
    buyThreshold: 68,
    sellThreshold: 32,
  },
};

function createBreakoutSignal(input: StrategyExecutionInput): Signal {
  const { candles, indicators, multiTimeframes } = input;
  const lookback = Number(descriptor.parameters.lookbackCandles) || 20;
  const recentSlice = candles.slice(-(lookback + 1), -1);
  const highs = recentSlice.map((candle) => candle.high);
  const lows = recentSlice.map((candle) => candle.low);
  const recentHigh = highs.length ? Math.max(...highs) : indicators.current;
  const recentLow = lows.length ? Math.min(...lows) : indicators.current;
  const currentVolume = candles[candles.length - 1]?.volume || 0;
  const avgVolume = recentSlice.length
    ? recentSlice.reduce((sum, candle) => sum + (candle.volume || 0), 0) / recentSlice.length
    : currentVolume;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const bufferPct = Number(descriptor.parameters.breakoutBufferPct) || 0.1;
  const breakoutHigh = recentHigh * (1 + bufferPct / 100);
  const breakoutLow = recentLow * (1 - bufferPct / 100);
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4H" || item.timeframe === "1D");
  const bullishBias = higherFrames.filter((item) => item.label === "Comprar").length;
  const bearishBias = higherFrames.filter((item) => item.label === "Vender").length;

  let score = 50;
  const reasons: string[] = [];
  let trend = "Neutral";
  let label = "Esperar";
  let title = "Esperar ruptura";

  if (indicators.current >= breakoutHigh) {
    score += 24;
    trend = "Alcista";
    reasons.push("Precio rompiendo máximo reciente.");
  } else if (indicators.current <= breakoutLow) {
    score -= 24;
    trend = "Bajista";
    reasons.push("Precio rompiendo mínimo reciente.");
  } else {
    reasons.push("Precio aún dentro del rango reciente.");
  }

  if (volumeRatio >= Number(descriptor.parameters.volumeThreshold)) {
    score += trend === "Alcista" ? 12 : trend === "Bajista" ? -12 : 0;
    reasons.push("Volumen confirma el breakout.");
  } else {
    score += trend === "Alcista" ? -8 : trend === "Bajista" ? 8 : 0;
    reasons.push("Volumen todavía no confirma del todo.");
  }

  if (bullishBias >= 2) {
    score += 10;
    reasons.push("Marco mayor acompaña al alza.");
  } else if (bearishBias >= 2) {
    score -= 10;
    reasons.push("Marco mayor acompaña a la baja.");
  } else {
    reasons.push("Marco mayor mixto.");
  }

  if (indicators.rsi > 72 && trend === "Alcista") {
    score -= 8;
    reasons.push("RSI alto: breakout puede venir extendido.");
  }
  if (indicators.rsi < 28 && trend === "Bajista") {
    score += 8;
    reasons.push("RSI bajo: ruptura bajista puede estar extendida.");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= Number(descriptor.parameters.buyThreshold)) {
    label = "Comprar";
    title = "Comprar breakout";
  } else if (score <= Number(descriptor.parameters.sellThreshold)) {
    label = "Vender";
    title = "Vender breakdown";
  } else {
    label = "Esperar";
    title = trend === "Alcista" ? "Esperar confirmación del breakout" : trend === "Bajista" ? "Esperar confirmación del breakdown" : "Esperar ruptura";
  }

  return { score, trend, label, title, reasons };
}

function execute(input: StrategyExecutionInput): StrategyExecutionResult {
  const signal = createBreakoutSignal(input);
  const analysis = buildDashboardAnalysis(input.candles, input.indicators, signal, input.multiTimeframes);

  return {
    strategy: descriptor,
    signal,
    analysis,
  };
}

export const breakoutV1Strategy: StrategyDefinition = {
  descriptor,
  execute,
};
