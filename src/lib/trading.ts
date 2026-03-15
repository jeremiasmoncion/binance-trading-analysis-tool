import type { Candle, Indicators, OperationPlan, Signal } from "../types";

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
  const tpPct = basePct * strengthFactor;
  const slPct = tpPct * 0.6;

  const entry = indicators.current;
  const tp = entry * (1 + tpPct / 100);
  const sl = entry * (1 - slPct / 100);
  const riskPct = slPct + 0.2;
  const benefitPct = tpPct - 0.2;

  return {
    entry,
    tp,
    sl,
    riskPct,
    benefitPct,
    riskAmt: (refCapital * riskPct) / 100,
    benefitAmt: (refCapital * benefitPct) / 100,
    refCapital,
  };
}

export function getSupportResistance(candles: Candle[]) {
  const prices = candles.slice(-20).flatMap((candle) => [candle.high, candle.low]);
  return {
    support: Math.min(...prices),
    resistance: Math.max(...prices),
  };
}
