import type { Candle, DashboardAnalysis, Indicators, OperationPlan, Signal, TimeframeSignal } from "../types";

export function generateFallbackCandles(tf: string): Candle[] {
  const base = 70000;
  const candles: Candle[] = [];
  let price = base + Math.random() * 1000;
  const now = Date.now();
  const tfMs =
    {
      "1s": 1000,
      "1m": 60 * 1000,
      "3m": 3 * 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "2h": 2 * 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "8h": 8 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    }[tf] || 15 * 60 * 1000;

  for (let i = 80; i > 0; i -= 1) {
    const t = now - i * tfMs;
    const change = (Math.random() - 0.5) * 100;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 30;
    const low = Math.min(open, close) - Math.random() * 30;
    candles.push({ time: t / 1000, open, high, low, close, volume: Math.random() * 100 });
    price = close;
  }

  return candles;
}

export function calcSMA(data: Candle[], period: number) {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / period;
}

export function calcRSI(data: Candle[], period = 14) {
  if (data.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = data.length - period; i < data.length; i += 1) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function calcATR(data: Candle[], period = 14) {
  if (data.length < 2) return 0;
  const slice = data.slice(-(period + 1));
  const trueRanges = slice.slice(1).map((candle, index) => {
    const previousClose = slice[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  if (!trueRanges.length) return 0;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
}

export function calcIndicators(candles: Candle[]): Indicators {
  const sma20 = calcSMA(candles, 20);
  const sma50 = calcSMA(candles, 50);
  const rsi = calcRSI(candles);
  const current = candles[candles.length - 1]?.close || 0;
  let macd = "Neutral";
  if (sma20 > sma50 && current > sma20) macd = "Alcista";
  else if (sma20 < sma50 && current < sma20) macd = "Bajista";
  return { sma20, sma50, rsi, macd, current };
}

export function generateSignal(indicators: Indicators): Signal {
  const { rsi, sma20, sma50, current } = indicators;
  let score = 50;
  const reasons: string[] = [];
  let trend = "Neutral";
  let label = "Esperar";
  let title = "Esperar confirmación";

  if (current > sma20 && sma20 > sma50) {
    score += 20;
    trend = "Alcista";
    reasons.push("Precio sobre medias: tendencia alcista.");
  } else if (current < sma20 && sma20 < sma50) {
    score -= 20;
    trend = "Bajista";
    reasons.push("Precio bajo medias: tendencia bajista.");
  }

  if (rsi < 30) {
    score += 15;
    reasons.push("RSI en sobreventa: posible rebote.");
  } else if (rsi > 70) {
    score -= 15;
    reasons.push("RSI en sobrecompra: posible corrección.");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 65) {
    label = "Comprar";
    title = "Comprar ahora";
  } else if (score <= 35) {
    label = "Vender";
    title = "Vender / tomar ganancia";
  } else {
    label = "Esperar";
    title = `Esperar, pero con sesgo ${
      trend === "Alcista" ? "alcista" : trend === "Bajista" ? "bajista" : "neutral"
    }`;
  }

  return { score, trend, label, title, reasons };
}

export function getOperationPlan(
  indicators: Indicators,
  signal: Signal,
  capital: number,
  timeframe: string,
  analysis?: DashboardAnalysis | null,
): OperationPlan {
  const refCapital = capital > 0 ? capital : 100;
  const basePct =
    {
      "1s": 0.2,
      "1m": 0.3,
      "3m": 0.4,
      "5m": 0.5,
      "15m": 0.8,
      "30m": 1.0,
      "1h": 1.2,
      "2h": 1.4,
      "4h": 1.8,
      "6h": 2.0,
      "8h": 2.2,
      "12h": 2.5,
      "1d": 3.0,
    }[timeframe] || 0.8;

  const strengthFactor = Math.max(0.5, signal.score / 50);
  const volatilityFactor = analysis ? Math.max(0.9, Math.min(1.5, analysis.volatilityPct / 1.2)) : 1;
  const tpPct = basePct * strengthFactor * volatilityFactor;
  const supportGap = analysis?.supportDistancePct || tpPct * 0.6;
  const resistanceGap = analysis?.resistanceDistancePct || tpPct;
  const slPct = Math.max(basePct * 0.45, Math.min(tpPct * 0.65, supportGap > 0 ? supportGap * 0.95 : tpPct * 0.6));

  const entry = indicators.current;
  const tp = signal.label === "Vender"
    ? entry * (1 - Math.max(basePct * 0.5, Math.min(tpPct, supportGap || tpPct)) / 100)
    : entry * (1 + Math.max(basePct * 0.5, Math.min(tpPct, resistanceGap || tpPct)) / 100);
  const tp2Pct = Math.max(tpPct * 1.6, tpPct + (analysis?.volatilityPct || 0.6));
  const tp2 = signal.label === "Vender" ? entry * (1 - tp2Pct / 100) : entry * (1 + tp2Pct / 100);
  const sl = signal.label === "Vender" ? entry * (1 + slPct / 100) : entry * (1 - slPct / 100);
  const riskPct = slPct + 0.2;
  const benefitPct = Math.max(0, Math.abs(((tp - entry) / entry) * 100) - 0.2);
  const rrRatio = riskPct > 0 ? benefitPct / riskPct : 0;

  return {
    entry,
    tp,
    tp2,
    sl,
    riskPct,
    benefitPct,
    riskAmt: (refCapital * riskPct) / 100,
    benefitAmt: (refCapital * benefitPct) / 100,
    refCapital,
    rrRatio: Number(rrRatio.toFixed(2)),
    setupBias: analysis?.setupType,
    invalidation: sl,
  };
}

export function getSupportResistance(candles: Candle[]) {
  const prices = candles.slice(-20).flatMap((candle) => [candle.high, candle.low]);
  return {
    support: Math.min(...prices),
    resistance: Math.max(...prices),
  };
}

export function buildDashboardAnalysis(
  candles: Candle[],
  indicators: Indicators,
  signal: Signal,
  multiTimeframes: TimeframeSignal[],
) : DashboardAnalysis {
  const { support, resistance } = getSupportResistance(candles);
  const current = indicators.current;
  const atr = calcATR(candles);
  const volatilityPct = current > 0 ? (atr / current) * 100 : 0;
  const recentVolumes = candles.slice(-20).map((candle) => candle.volume || 0);
  const avgVolume = recentVolumes.length ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length : 0;
  const currentVolume = candles[candles.length - 1]?.volume || 0;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const alignmentCount = multiTimeframes.filter((item) => item.label === signal.label).length;
  const alignmentTotal = multiTimeframes.length || 1;
  const alignmentPct = (alignmentCount / alignmentTotal) * 100;
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4H" || item.timeframe === "1D");
  const higherTimeframeBias =
    higherFrames.filter((item) => item.label === "Comprar").length >= 2
      ? "Alcista"
      : higherFrames.filter((item) => item.label === "Vender").length >= 2
        ? "Bajista"
        : "Mixto";
  const supportDistancePct = current > 0 ? Math.max(0, ((current - support) / current) * 100) : 0;
  const resistanceDistancePct = current > 0 ? Math.max(0, ((resistance - current) / current) * 100) : 0;
  const range = resistance - support;
  const rangePositionPct = range > 0 ? ((current - support) / range) * 100 : 50;
  const volatilityLabel = volatilityPct > 2.5 ? "Alta" : volatilityPct > 1.2 ? "Media" : "Baja";
  const volumeLabel = volumeRatio > 1.25 ? "Volumen fuerte" : volumeRatio < 0.85 ? "Volumen débil" : "Volumen normal";

  let setupType = "Espera";
  if (signal.label === "Comprar" && higherTimeframeBias === "Alcista") {
    setupType = rangePositionPct < 45 ? "Pullback en tendencia" : "Continuación";
  } else if (signal.label === "Vender" && higherTimeframeBias === "Bajista") {
    setupType = rangePositionPct > 55 ? "Pullback bajista" : "Continuación bajista";
  } else if (signal.label !== "Esperar") {
    setupType = "Contra tendencia";
  }

  const confirmations: string[] = [];
  const warnings: string[] = [];

  if (alignmentCount >= 4) confirmations.push(`${alignmentCount}/${alignmentTotal} temporalidades alineadas`);
  else if (alignmentCount >= 3) confirmations.push(`Contexto usable con ${alignmentCount}/${alignmentTotal} marcos alineados`);
  else warnings.push(`Solo ${alignmentCount}/${alignmentTotal} temporalidades están alineadas`);

  if (volumeRatio > 1.1) confirmations.push(volumeLabel);
  else if (volumeRatio < 0.85) warnings.push(volumeLabel);

  if (signal.label === "Comprar" && resistanceDistancePct < 1.2) warnings.push("Resistencia cercana");
  if (signal.label === "Vender" && supportDistancePct < 1.2) warnings.push("Soporte cercano");
  if (signal.label === "Comprar" && supportDistancePct < 0.6) warnings.push("Entrada muy pegada al soporte");
  if (signal.label === "Vender" && resistanceDistancePct < 0.6) warnings.push("Entrada muy pegada a resistencia");

  if (higherTimeframeBias === signal.trend) confirmations.push(`Marco mayor ${higherTimeframeBias.toLowerCase()}`);
  else if (signal.label !== "Esperar" && higherTimeframeBias !== "Mixto") warnings.push(`Vas contra el marco mayor ${higherTimeframeBias.toLowerCase()}`);

  const setupQuality =
    alignmentCount >= 4 && volumeRatio > 1.1 && warnings.length <= 1
      ? "Alta"
      : alignmentCount >= 3 && warnings.length <= 2
        ? "Media"
        : "Baja";

  const riskLabel =
    warnings.length >= 3 || setupQuality === "Baja"
      ? "Agresivo"
      : volatilityPct > 2.5
        ? "Elevado"
        : "Controlado";

  return {
    alignmentCount,
    alignmentTotal,
    alignmentPct: Number(alignmentPct.toFixed(0)),
    alignmentLabel: alignmentCount >= 4 ? "Alta alineación" : alignmentCount >= 3 ? "Alineación mixta" : "Desalineado",
    higherTimeframeBias,
    support,
    resistance,
    supportDistancePct: Number(supportDistancePct.toFixed(2)),
    resistanceDistancePct: Number(resistanceDistancePct.toFixed(2)),
    rangePositionPct: Number(rangePositionPct.toFixed(1)),
    volatilityPct: Number(volatilityPct.toFixed(2)),
    volatilityLabel,
    volumeRatio: Number(volumeRatio.toFixed(2)),
    volumeLabel,
    setupType,
    setupQuality,
    riskLabel,
    confirmations,
    warnings,
  };
}
