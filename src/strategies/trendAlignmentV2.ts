import type { Signal, StrategyDescriptor } from "../types";
import { buildDashboardAnalysis } from "../lib/trading";
import type { StrategyDefinition, StrategyExecutionInput, StrategyExecutionResult } from "./types";

const descriptor: StrategyDescriptor = {
  id: "trend-alignment",
  version: "v2",
  label: "Trend Alignment v2",
  description: "Variante más estricta que prioriza alineación de marcos altos y penaliza entradas débiles o contradictorias.",
  category: "trend",
  preferredTimeframes: ["1h", "4h", "1d"],
  tradingStyle: "swing corto",
  holdingProfile: "medio",
  idealMarketConditions: ["tendencia limpia", "alta alineación", "volumen fuerte"],
  schedulerLabel: "revisión pausada",
  parameters: {
    trendWeight: 24,
    oversoldBoost: 10,
    overboughtPenalty: 10,
    higherFrameBonus: 12,
    mixedFramePenalty: 8,
    buyThreshold: 69,
    sellThreshold: 31,
  },
};

function createTrendAlignmentV2Signal(input: StrategyExecutionInput): Signal {
  const { indicators, multiTimeframes } = input;
  const { rsi, sma20, sma50, current } = indicators;
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4H" || item.timeframe === "1D");
  const bullishHigher = higherFrames.filter((item) => item.label === "Comprar").length;
  const bearishHigher = higherFrames.filter((item) => item.label === "Vender").length;
  const alignedFrames = multiTimeframes.filter((item) => item.label !== "Esperar");

  let score = 50;
  const reasons: string[] = [];
  let trend = "Neutral";
  let label = "Esperar";
  let title = "Esperar confirmación";

  if (current > sma20 && sma20 > sma50) {
    score += Number(descriptor.parameters.trendWeight) || 24;
    trend = "Alcista";
    reasons.push("Precio sobre medias con estructura alcista clara.");
  } else if (current < sma20 && sma20 < sma50) {
    score -= Number(descriptor.parameters.trendWeight) || 24;
    trend = "Bajista";
    reasons.push("Precio bajo medias con estructura bajista clara.");
  } else {
    reasons.push("Estructura principal todavía mixta.");
  }

  if (rsi < 28) {
    score += Number(descriptor.parameters.oversoldBoost) || 10;
    reasons.push("RSI muy bajo: posible rebote de calidad.");
  } else if (rsi > 72) {
    score -= Number(descriptor.parameters.overboughtPenalty) || 10;
    reasons.push("RSI muy alto: riesgo de corrección o agotamiento.");
  }

  if (bullishHigher >= 2) {
    score += Number(descriptor.parameters.higherFrameBonus) || 12;
    reasons.push("Marcos altos alineados al alza.");
  } else if (bearishHigher >= 2) {
    score -= Number(descriptor.parameters.higherFrameBonus) || 12;
    reasons.push("Marcos altos alineados a la baja.");
  } else if (alignedFrames.length > 0) {
    const mixedPenalty = Number(descriptor.parameters.mixedFramePenalty) || 8;
    score += trend === "Alcista" ? -mixedPenalty : trend === "Bajista" ? mixedPenalty : 0;
    reasons.push("Marcos altos mixtos: convicción reducida.");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= Number(descriptor.parameters.buyThreshold)) {
    label = "Comprar";
    title = "Comprar con confirmación";
  } else if (score <= Number(descriptor.parameters.sellThreshold)) {
    label = "Vender";
    title = "Vender con confirmación";
  } else {
    label = "Esperar";
    title = trend === "Alcista"
      ? "Esperar mejor confirmación alcista"
      : trend === "Bajista"
        ? "Esperar mejor confirmación bajista"
        : "Esperar definición del mercado";
  }

  return {
    score,
    trend,
    label,
    title,
    reasons,
  };
}

function execute(input: StrategyExecutionInput): StrategyExecutionResult {
  const signal = createTrendAlignmentV2Signal(input);
  const analysis = buildDashboardAnalysis(input.candles, input.indicators, signal, input.multiTimeframes);

  return {
    strategy: descriptor,
    signal,
    analysis,
  };
}

export const trendAlignmentV2Strategy: StrategyDefinition = {
  descriptor,
  execute,
};
