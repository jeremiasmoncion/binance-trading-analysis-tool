const BINANCE_PUBLIC_API_URL = "https://api.binance.com";
const BINANCE_PUBLIC_FALLBACK_URLS = [
  BINANCE_PUBLIC_API_URL,
  process.env.BINANCE_MARKET_DATA_URL || "https://demo-api.binance.com",
];
const MAP_TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

const STRATEGY_DEFINITIONS = [
  {
    id: "trend-alignment",
    version: "v1",
    label: "Trend Alignment v1",
    description: "Estrategia base de tendencia, momentum y alineación entre temporalidades.",
    category: "trend",
    preferredTimeframes: ["15m", "1h", "4h"],
    tradingStyle: "intradía",
    holdingProfile: "corto a medio",
    idealMarketConditions: ["tendencia", "pullback ordenado"],
    schedulerLabel: "revisión intermedia",
    parameters: {
      trendWeight: 20,
      oversoldBoost: 15,
      overboughtPenalty: 15,
      buyThreshold: 65,
      sellThreshold: 35,
    },
    kind: "trend-v1",
  },
  {
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
    kind: "trend-v2",
  },
  {
    id: "breakout",
    version: "v1",
    label: "Breakout v1",
    description: "Busca rupturas limpias con confirmación de volumen y sesgo del marco mayor.",
    category: "breakout",
    preferredTimeframes: ["5m", "15m", "1h"],
    tradingStyle: "scalping / intradía",
    holdingProfile: "rápido",
    idealMarketConditions: ["ruptura", "expansión", "volumen fuerte"],
    schedulerLabel: "revisión rápida",
    parameters: {
      lookbackCandles: 20,
      breakoutBufferPct: 0.1,
      volumeThreshold: 1.15,
      buyThreshold: 68,
      sellThreshold: 32,
    },
    kind: "breakout-v1",
  },
];

const TIMEFRAME_SCAN_INTERVAL_MS = {
  "5m": 5 * 60 * 1000,
  "15m": 10 * 60 * 1000,
  "1h": 15 * 60 * 1000,
  "4h": 60 * 60 * 1000,
  "1d": 4 * 60 * 60 * 1000,
};

async function fetchBinancePublic(path, params = {}) {
  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  );

  let lastError = null;

  for (const baseUrl of BINANCE_PUBLIC_FALLBACK_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}${search.toString() ? `?${search.toString()}` : ""}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.msg || `No se pudo consultar Binance Spot en ${baseUrl}`);
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No se pudo consultar Binance Spot");
}

function calcSMA(data, period) {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / period;
}

function calcRSI(data, period = 14) {
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

function calcATR(data, period = 14) {
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

function calcIndicators(candles) {
  const sma20 = calcSMA(candles, 20);
  const sma50 = calcSMA(candles, 50);
  const rsi = calcRSI(candles);
  const current = candles[candles.length - 1]?.close || 0;
  let macd = "Neutral";
  if (sma20 > sma50 && current > sma20) macd = "Alcista";
  else if (sma20 < sma50 && current < sma20) macd = "Bajista";
  return { sma20, sma50, rsi, macd, current };
}

function generateSignal(indicators, parameters = {}) {
  const { rsi, sma20, sma50, current } = indicators;
  let score = 50;
  const reasons = [];
  let trend = "Neutral";
  let label = "Esperar";
  let title = "Esperar confirmación";

  if (current > sma20 && sma20 > sma50) {
    score += Number(parameters.trendWeight || 20);
    trend = "Alcista";
    reasons.push("Precio sobre medias: tendencia alcista.");
  } else if (current < sma20 && sma20 < sma50) {
    score -= Number(parameters.trendWeight || 20);
    trend = "Bajista";
    reasons.push("Precio bajo medias: tendencia bajista.");
  }

  if (rsi < 30) {
    score += Number(parameters.oversoldBoost || 15);
    reasons.push("RSI en sobreventa: posible rebote.");
  } else if (rsi > 70) {
    score -= Number(parameters.overboughtPenalty || 15);
    reasons.push("RSI en sobrecompra: posible corrección.");
  }

  score = Math.max(0, Math.min(100, score));
  const buyThreshold = Number(parameters.buyThreshold || 65);
  const sellThreshold = Number(parameters.sellThreshold || 35);

  if (score >= buyThreshold) {
    label = "Comprar";
    title = "Comprar ahora";
  } else if (score <= sellThreshold) {
    label = "Vender";
    title = "Vender / tomar ganancia";
  } else {
    title = `Esperar, pero con sesgo ${
      trend === "Alcista" ? "alcista" : trend === "Bajista" ? "bajista" : "neutral"
    }`;
  }

  return { score, trend, label, title, reasons };
}

function getSupportResistance(candles) {
  const prices = candles.slice(-20).flatMap((candle) => [candle.high, candle.low]);
  return {
    support: Math.min(...prices),
    resistance: Math.max(...prices),
  };
}

function buildDashboardAnalysis(candles, indicators, signal, multiTimeframes) {
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
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
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

  const confirmations = [];
  const warnings = [];

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
    warnings.length >= 3 || volatilityPct > 3
      ? "Agresivo"
      : warnings.length === 2 || volatilityPct > 1.8
        ? "Elevado"
        : "Controlado";

  return {
    alignmentCount,
    alignmentTotal,
    alignmentPct: Number(alignmentPct.toFixed(0)),
    alignmentLabel: alignmentCount >= 4 ? "Alta alineación" : alignmentCount >= 3 ? "Alineación útil" : "Alineación débil",
    higherTimeframeBias,
    support,
    resistance,
    supportDistancePct: Number(supportDistancePct.toFixed(2)),
    resistanceDistancePct: Number(resistanceDistancePct.toFixed(2)),
    rangePositionPct: Number(rangePositionPct.toFixed(2)),
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

function getOperationPlan(indicators, signal, capital, timeframe, analysis) {
  const refCapital = capital > 0 ? capital : 100;
  const basePct =
    {
      "5m": 0.5,
      "15m": 0.8,
      "1h": 1.2,
      "4h": 1.8,
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

function createTrendAlignmentV2Signal(input, descriptor) {
  const { indicators, multiTimeframes } = input;
  const { rsi, sma20, sma50, current } = indicators;
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
  const bullishHigher = higherFrames.filter((item) => item.label === "Comprar").length;
  const bearishHigher = higherFrames.filter((item) => item.label === "Vender").length;
  const alignedFrames = multiTimeframes.filter((item) => item.label !== "Esperar");
  const params = descriptor.parameters || {};

  let score = 50;
  const reasons = [];
  let trend = "Neutral";
  let label = "Esperar";
  let title = "Esperar confirmación";

  if (current > sma20 && sma20 > sma50) {
    score += Number(params.trendWeight || 24);
    trend = "Alcista";
    reasons.push("Precio sobre medias con estructura alcista clara.");
  } else if (current < sma20 && sma20 < sma50) {
    score -= Number(params.trendWeight || 24);
    trend = "Bajista";
    reasons.push("Precio bajo medias con estructura bajista clara.");
  } else {
    reasons.push("Estructura principal todavía mixta.");
  }

  if (rsi < 28) {
    score += Number(params.oversoldBoost || 10);
    reasons.push("RSI muy bajo: posible rebote de calidad.");
  } else if (rsi > 72) {
    score -= Number(params.overboughtPenalty || 10);
    reasons.push("RSI muy alto: riesgo de corrección o agotamiento.");
  }

  if (bullishHigher >= 2) {
    score += Number(params.higherFrameBonus || 12);
    reasons.push("Marcos altos alineados al alza.");
  } else if (bearishHigher >= 2) {
    score -= Number(params.higherFrameBonus || 12);
    reasons.push("Marcos altos alineados a la baja.");
  } else if (alignedFrames.length > 0) {
    const mixedPenalty = Number(params.mixedFramePenalty || 8);
    score += trend === "Alcista" ? -mixedPenalty : trend === "Bajista" ? mixedPenalty : 0;
    reasons.push("Marcos altos mixtos: convicción reducida.");
  }

  score = Math.max(0, Math.min(100, score));
  if (score >= Number(params.buyThreshold || 69)) {
    label = "Comprar";
    title = "Comprar con confirmación";
  } else if (score <= Number(params.sellThreshold || 31)) {
    label = "Vender";
    title = "Vender con confirmación";
  } else {
    title = trend === "Alcista"
      ? "Esperar mejor confirmación alcista"
      : trend === "Bajista"
        ? "Esperar mejor confirmación bajista"
        : "Esperar definición del mercado";
  }

  return { score, trend, label, title, reasons };
}

function createBreakoutSignal(input, descriptor) {
  const { candles, indicators, multiTimeframes } = input;
  const params = descriptor.parameters || {};
  const lookback = Number(params.lookbackCandles || 20);
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
  const bufferPct = Number(params.breakoutBufferPct || 0.1);
  const breakoutHigh = recentHigh * (1 + bufferPct / 100);
  const breakoutLow = recentLow * (1 - bufferPct / 100);
  const higherFrames = multiTimeframes.filter((item) => item.timeframe === "4h" || item.timeframe === "1d");
  const bullishBias = higherFrames.filter((item) => item.label === "Comprar").length;
  const bearishBias = higherFrames.filter((item) => item.label === "Vender").length;

  let score = 50;
  const reasons = [];
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

  if (volumeRatio >= Number(params.volumeThreshold || 1.15)) {
    score += trend === "Alcista" ? 12 : trend === "Bajista" ? -12 : 0;
    reasons.push("Volumen confirma la ruptura.");
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
    reasons.push("RSI alto: ruptura puede venir extendida.");
  }
  if (indicators.rsi < 28 && trend === "Bajista") {
    score += 8;
    reasons.push("RSI bajo: ruptura bajista puede estar extendida.");
  }

  score = Math.max(0, Math.min(100, score));
  if (score >= Number(params.buyThreshold || 68)) {
    label = "Comprar";
    title = "Comprar ruptura";
  } else if (score <= Number(params.sellThreshold || 32)) {
    label = "Vender";
    title = "Vender breakdown";
  } else {
    title = trend === "Alcista" ? "Esperar confirmación de la ruptura" : trend === "Bajista" ? "Esperar confirmación del breakdown" : "Esperar ruptura";
  }

  return { score, trend, label, title, reasons };
}

function getRankScore(candidate, timeframe) {
  const conviction = Math.abs(candidate.signal.score - 50);
  const actionableBonus = candidate.signal.label === "Esperar" ? 0 : 25;
  const setupBonus = candidate.analysis.setupQuality === "Alta" ? 12 : candidate.analysis.setupQuality === "Media" ? 6 : 0;
  const alignmentBonus = Math.round(candidate.analysis.alignmentCount * 1.5);
  const riskPenalty = candidate.analysis.riskLabel === "Agresivo" ? 12 : candidate.analysis.riskLabel === "Elevado" ? 6 : 0;
  const warningPenalty = Math.max(0, candidate.analysis.warnings.length - candidate.analysis.confirmations.length) * 2;
  const timeframeBonus = candidate.strategy.preferredTimeframes.includes(timeframe) ? 8 : -10;
  return actionableBonus + conviction + setupBonus + alignmentBonus + timeframeBonus - riskPenalty - warningPenalty;
}

function executeStrategy(descriptor, input) {
  const signal = descriptor.kind === "trend-v2"
    ? createTrendAlignmentV2Signal(input, descriptor)
    : descriptor.kind === "breakout-v1"
      ? createBreakoutSignal(input, descriptor)
      : generateSignal(input.indicators, descriptor.parameters);
  const analysis = buildDashboardAnalysis(input.candles, input.indicators, signal, input.multiTimeframes);
  return { strategy: descriptor, signal, analysis };
}

export async function fetchCandles(symbol, timeframe, limit = 80) {
  const payload = await fetchBinancePublic("/api/v3/klines", {
    symbol: symbol.replace("/", ""),
    interval: timeframe,
    limit,
  });
  return (payload || []).map((row) => ({
    time: Number(row[0]) / 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

export async function fetchTickerPrice(symbol) {
  const payload = await fetchBinancePublic("/api/v3/ticker/24hr", {
    symbol: symbol.replace("/", ""),
  });
  return {
    lastPrice: Number(payload.lastPrice || 0),
    changePct: Number(payload.priceChangePercent || 0),
  };
}

export function getScannableTimeframes() {
  return Array.from(new Set(STRATEGY_DEFINITIONS.flatMap((item) => item.preferredTimeframes)));
}

export function getTimeframeScanInterval(timeframe) {
  return TIMEFRAME_SCAN_INTERVAL_MS[timeframe] || 15 * 60 * 1000;
}

export async function buildMarketSnapshot(coin, timeframe, options = {}) {
  const candleCache = options.candleCache || null;
  const loadCandles = async (targetTimeframe) => {
    const cacheKey = `${coin}|${targetTimeframe}`;
    if (candleCache?.has(cacheKey)) {
      return candleCache.get(cacheKey);
    }
    const candleRequest = fetchCandles(coin, targetTimeframe)
      .then((candles) => {
        if (candleCache) {
          candleCache.set(cacheKey, candles);
        }
        return candles;
      })
      .catch((error) => {
        if (candleCache) {
          candleCache.delete(cacheKey);
        }
        throw error;
      });
    if (candleCache) {
      candleCache.set(cacheKey, candleRequest);
    }
    return candleRequest;
  };

  const [candles, multiTimeframes] = await Promise.all([
    loadCandles(timeframe),
    Promise.all(
      MAP_TIMEFRAMES.map(async (mapTf) => {
        const tfCandles = await loadCandles(mapTf);
        const tfSignal = generateSignal(calcIndicators(tfCandles));
        return {
          timeframe: mapTf,
          label: tfSignal.label,
          note: tfSignal.trend === "Neutral" ? "Sin sesgo claro" : tfSignal.trend,
          trend: tfSignal.trend,
          score: tfSignal.score,
          aligned: false,
        };
      }),
    ),
  ]);

  const indicators = calcIndicators(candles);
  const candidates = STRATEGY_DEFINITIONS
    .map((strategy) => {
      const result = executeStrategy(strategy, { candles, indicators, timeframe, multiTimeframes });
      return { ...result, rankScore: getRankScore(result, timeframe) };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.signal.score - a.signal.score)
    .map((item, index) => ({ ...item, isPrimary: index === 0 }));

  const primary = candidates[0];
  const alignedTimeframes = multiTimeframes.map((item) => ({
    ...item,
    aligned: item.label === primary.signal.label,
  }));
  const analysis = primary.analysis;
  const plan = getOperationPlan(indicators, primary.signal, 100, timeframe, analysis);

  return {
    coin,
    timeframe,
    candles,
    indicators,
    currentPrice: indicators.current,
    multiTimeframes: alignedTimeframes,
    primary,
    candidates,
    plan,
  };
}
