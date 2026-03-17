import { useCallback, useEffect, useMemo, useState } from "react";
import { MAP_TIMEFRAMES, POPULAR_COINS } from "../config/constants";
import { calcIndicators, generateFallbackCandles, generateSignal, getSupportResistance } from "../lib/trading";
import { runStrategyEngine } from "../strategies";
import { marketService } from "../services/api";
import type { Candle, ComparisonCoin, DashboardAnalysis, Indicators, Signal, StrategyCandidate, StrategyDescriptor, TimeframeSignal, ViewName } from "../types";

interface UseMarketDataOptions {
  currentView: ViewName;
}

const SMART_REFRESH_BY_TIMEFRAME: Record<string, number> = {
  "5m": 60_000,
  "15m": 120_000,
  "1h": 300_000,
  "4h": 900_000,
  "1d": 1_800_000,
};

const SMART_REFRESH_BY_STYLE: Record<string, number> = {
  "scalping / intradía": 60_000,
  "intradía": 180_000,
  "swing corto": 900_000,
};

function getSmartRefreshInterval(timeframe: string, tradingStyle?: string) {
  const timeframeBase = SMART_REFRESH_BY_TIMEFRAME[timeframe] || 300_000;
  const styleBase = SMART_REFRESH_BY_STYLE[tradingStyle || ""] || timeframeBase;
  return Math.max(60_000, Math.min(timeframeBase, styleBase));
}

function mergeLiveCandle(prevCandles: Candle[], incoming: Candle) {
  if (!prevCandles.length) {
    return [incoming];
  }

  const nextCandles = prevCandles.slice();
  const last = nextCandles[nextCandles.length - 1];

  if (last.time === incoming.time) {
    nextCandles[nextCandles.length - 1] = incoming;
    return nextCandles;
  }

  if (incoming.time > last.time) {
    nextCandles.push(incoming);
    return nextCandles.slice(-160);
  }

  const existingIndex = nextCandles.findIndex((candle) => candle.time === incoming.time);
  if (existingIndex >= 0) {
    nextCandles[existingIndex] = incoming;
  }

  return nextCandles;
}

function updateLiveTimeframes(items: TimeframeSignal[], activeTimeframe: string, nextSignal: Signal) {
  return items.map((item) => (
    item.timeframe === activeTimeframe
      ? {
        ...item,
        label: nextSignal.label,
        note: nextSignal.trend === "Neutral" ? "Sin sesgo claro" : nextSignal.trend,
        trend: nextSignal.trend,
        score: nextSignal.score,
        aligned: true,
      }
      : item
  ));
}

export function useMarketData({ currentView }: UseMarketDataOptions) {
  const [currentCoin, setCurrentCoin] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null);
  const [strategy, setStrategy] = useState<StrategyDescriptor>(runStrategyEngine({
    candles: generateFallbackCandles("1h"),
    indicators: calcIndicators(generateFallbackCandles("1h")),
    timeframe: "1h",
    multiTimeframes: [],
  }).primary.strategy);
  const [strategyCandidates, setStrategyCandidates] = useState<StrategyCandidate[]>([]);
  const [multiTimeframes, setMultiTimeframes] = useState<TimeframeSignal[]>([]);
  const [comparison, setComparison] = useState<ComparisonCoin[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [market24h, setMarket24h] = useState({ change: 0, high: 0, low: 0, volume: "0 BTC", updatedAt: "--:--" });
  const [availableCoins, setAvailableCoins] = useState<string[]>(POPULAR_COINS);

  const coinLookup = useMemo(() => new Set(availableCoins), [availableCoins]);

  const supportResistance = useMemo(
    () => getSupportResistance(candles.length ? candles : generateFallbackCandles(timeframe)),
    [candles, timeframe],
  );

  const applyLiveDerivedState = useCallback((nextCandles: Candle[], livePrice?: number) => {
    const nextIndicators = calcIndicators(nextCandles);
    const nextMultiTimeframes = updateLiveTimeframes(multiTimeframes, timeframe, generateSignal(nextIndicators));
    const strategyExecution = runStrategyEngine({
      candles: nextCandles,
      indicators: nextIndicators,
      timeframe,
      multiTimeframes: nextMultiTimeframes,
    });
    const nextSignal = strategyExecution.primary.signal;
    const nextAnalysis = strategyExecution.primary.analysis;
    const alignedTimeframes = nextMultiTimeframes.map((item) => ({
      ...item,
      aligned: item.label === nextSignal.label,
    }));

    setIndicators(nextIndicators);
    setSignal(nextSignal);
    setAnalysis(nextAnalysis);
    setStrategy(strategyExecution.primary.strategy);
    setStrategyCandidates(strategyExecution.candidates);
    setMultiTimeframes(alignedTimeframes);
    setCurrentPrice(livePrice && livePrice > 0 ? livePrice : nextIndicators.current);
  }, [multiTimeframes, timeframe]);

  const fetchData = useCallback(async (coin = currentCoin, nextTimeframe = timeframe) => {
    setStatus("loading");
    try {
      const fetchedCandles = (await marketService.fetchCandles(coin, nextTimeframe)) || generateFallbackCandles(nextTimeframe);
      const nextIndicators = calcIndicators(fetchedCandles);
      const nextMultiTimeframes = await Promise.all(
        MAP_TIMEFRAMES.map(async (mapTf) => {
          const tfCandles = (await marketService.fetchCandles(coin, mapTf)) || generateFallbackCandles(mapTf);
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
      );
      const strategyExecution = runStrategyEngine({
        candles: fetchedCandles,
        indicators: nextIndicators,
        timeframe: nextTimeframe,
        multiTimeframes: nextMultiTimeframes,
      });
      const nextSignal = strategyExecution.primary.signal;
      const nextAnalysis = strategyExecution.primary.analysis;
      const alignedTimeframes = nextMultiTimeframes.map((item) => ({
        ...item,
        aligned: item.label === nextSignal.label,
      }));

      const ticker = await marketService.fetch24h(coin);
      const nextComparison = await Promise.all(
        POPULAR_COINS.slice(0, 4).map(async (symbol) => {
          const data = await marketService.fetch24h(symbol);
          const change = Number(data.priceChangePercent || 0);
          return {
            symbol,
            price: Number(data.lastPrice || 0),
            change,
            impulse: change > 2 ? "Fuerte" : change > 0 ? "Moderado" : "Débil",
          };
        }),
      );

      setCurrentCoin(coin);
      setTimeframe(nextTimeframe);
      setCandles(fetchedCandles);
      setIndicators(nextIndicators);
      setCurrentPrice(nextIndicators.current);
      setSignal(nextSignal);
      setAnalysis(nextAnalysis);
      setStrategy(strategyExecution.primary.strategy);
      setStrategyCandidates(strategyExecution.candidates);
      setMultiTimeframes(alignedTimeframes);
      setComparison(nextComparison);
      setMarket24h({
        change: Number(ticker.priceChangePercent || 0),
        high: Number(ticker.highPrice || 0),
        low: Number(ticker.lowPrice || 0),
        volume: `${(Number(ticker.volume || 0) / 1000).toFixed(1)} BTC`,
        updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [currentCoin, timeframe]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const symbols = await marketService.fetchSymbols();
      if (!active || !symbols.length) return;

      const merged = Array.from(new Set([...POPULAR_COINS.filter((coin) => symbols.includes(coin)), ...symbols]));
      setAvailableCoins(merged);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentView !== "dashboard" && currentView !== "market") return undefined;
    const refreshInterval = getSmartRefreshInterval(timeframe, strategy?.tradingStyle);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchData();
    }, refreshInterval);
    return () => window.clearInterval(intervalId);
  }, [currentView, fetchData, timeframe, strategy?.tradingStyle]);

  useEffect(() => {
    const closeStream = marketService.openTickerStream(currentCoin, (payload) => {
      const nextPrice = Number(payload.c || 0);
      const nextChange = Number(payload.P || 0);
      const nextHigh = Number(payload.h || 0);
      const nextLow = Number(payload.l || 0);
      const nextVolume = Number(payload.v || 0);

      if (nextPrice > 0) {
        setCurrentPrice(nextPrice);
      }

      if (nextPrice > 0 || nextHigh > 0 || nextLow > 0 || nextVolume > 0) {
        setMarket24h({
          change: nextChange || 0,
          high: nextHigh || 0,
          low: nextLow || 0,
          volume: `${(nextVolume / 1000).toFixed(1)} BTC`,
          updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    return () => {
      closeStream();
    };
  }, [currentCoin]);

  useEffect(() => {
    const closeStream = marketService.openKlineStream(currentCoin, timeframe, (payload) => {
      const kline = payload.k;
      if (!kline?.t) return;

      const incomingCandle: Candle = {
        time: Math.floor(kline.t / 1000),
        open: Number(kline.o || 0),
        high: Number(kline.h || 0),
        low: Number(kline.l || 0),
        close: Number(kline.c || 0),
        volume: Number(kline.v || 0),
      };

      setCandles((prevCandles) => {
        const source = prevCandles.length ? prevCandles : generateFallbackCandles(timeframe);
        const nextCandles = mergeLiveCandle(source, incomingCandle);
        applyLiveDerivedState(nextCandles, incomingCandle.close);
        return nextCandles;
      });
    });

    return () => {
      closeStream();
    };
  }, [applyLiveDerivedState, currentCoin, timeframe]);

  return {
    currentCoin,
    timeframe,
    status,
    candles,
    currentPrice,
    indicators,
    signal,
    analysis,
    strategy,
    strategyCandidates,
    multiTimeframes,
    comparison,
    availableCoins,
    popularCoins: POPULAR_COINS.filter((coin) => coinLookup.has(coin)),
    market24h,
    supportResistance,
    refreshIntervalMs: getSmartRefreshInterval(timeframe, strategy?.tradingStyle),
    fetchData,
    selectCoin(coin: string) {
      const normalized = coin.trim().toUpperCase();
      if (!normalized || !coinLookup.has(normalized)) return false;
      void fetchData(normalized, timeframe);
      return true;
    },
    selectTimeframe(nextTimeframe: string) {
      void fetchData(currentCoin, nextTimeframe);
    },
  };
}
