import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAP_TIMEFRAMES, POPULAR_COINS } from "../config/constants";
import { getViewRefreshPolicy } from "../data-platform/refreshPolicy";
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

function viewNeedsMarketComparison(view: ViewName) {
  return view === "market" || view === "compare";
}

function viewNeedsSymbolUniverse(view: ViewName) {
  return view === "market" || view === "compare" || view === "trading";
}

async function buildMultiTimeframePayloads(
  coin: string,
  activeTimeframe: string,
  activeCandles: Candle[],
) {
  return Promise.all(
    MAP_TIMEFRAMES.map(async (mapTf) => {
      // Reuse the active timeframe candles so a single refresh does not request
      // the same market snapshot twice before running the strategy engine.
      const tfCandles = mapTf === activeTimeframe
        ? activeCandles
        : ((await marketService.fetchCandles(coin, mapTf)) || generateFallbackCandles(mapTf));
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
}

export function useMarketData({ currentView }: UseMarketDataOptions) {
  const refreshPolicy = getViewRefreshPolicy(currentView);
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
  const multiTimeframesRef = useRef<TimeframeSignal[]>([]);
  const activeTimeframeRef = useRef(timeframe);
  const tickerFrameRef = useRef<number | null>(null);
  const klineFrameRef = useRef<number | null>(null);
  const latestTickerRef = useRef<{ price: number; change: number; high: number; low: number; volume: number } | null>(null);
  const latestKlineRef = useRef<Candle | null>(null);

  const coinLookup = useMemo(() => new Set(availableCoins), [availableCoins]);

  const supportResistance = useMemo(
    () => getSupportResistance(candles.length ? candles : generateFallbackCandles(timeframe)),
    [candles, timeframe],
  );

  const applyLiveDerivedState = useCallback((nextCandles: Candle[], livePrice?: number) => {
    const nextIndicators = calcIndicators(nextCandles);
    const nextSignalSeed = generateSignal(nextIndicators);
    const nextMultiTimeframes = updateLiveTimeframes(multiTimeframesRef.current, activeTimeframeRef.current, nextSignalSeed);
    const strategyExecution = runStrategyEngine({
      candles: nextCandles,
      indicators: nextIndicators,
      timeframe: activeTimeframeRef.current,
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
    multiTimeframesRef.current = alignedTimeframes;
  }, []);

  const fetchData = useCallback(async (coin = currentCoin, nextTimeframe = timeframe) => {
    setStatus("loading");
    try {
      const shouldLoadComparison = viewNeedsMarketComparison(currentView);
      const fetchedCandles = (await marketService.fetchCandles(coin, nextTimeframe)) || generateFallbackCandles(nextTimeframe);
      const [multiTfPayloads, ticker, nextComparison] = await Promise.all([
        buildMultiTimeframePayloads(coin, nextTimeframe, fetchedCandles),
        marketService.fetch24h(coin),
        shouldLoadComparison
          ? Promise.all(
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
          )
          : Promise.resolve<ComparisonCoin[]>([]),
      ]);

      const nextIndicators = calcIndicators(fetchedCandles);
      const nextMultiTimeframes = multiTfPayloads;
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
      multiTimeframesRef.current = alignedTimeframes;
      if (shouldLoadComparison) {
        setComparison(nextComparison);
      }
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
  }, [currentCoin, currentView, timeframe]);

  useEffect(() => {
    activeTimeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    multiTimeframesRef.current = multiTimeframes;
  }, [multiTimeframes]);

  useEffect(() => {
    if (!viewNeedsSymbolUniverse(currentView)) {
      return undefined;
    }

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
  }, [currentView]);

  useEffect(() => {
    if (!refreshPolicy.marketSnapshotIntervalMs) return undefined;
    // Refresh policy now provides the view-level ceiling. Smart cadence can still
    // slow refreshes down further, but it should not make a view poll faster than declared.
    const refreshInterval = Math.max(
      refreshPolicy.marketSnapshotIntervalMs,
      getSmartRefreshInterval(timeframe, strategy?.tradingStyle),
    );
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void fetchData();
    }, refreshInterval);
    return () => window.clearInterval(intervalId);
  }, [fetchData, refreshPolicy.marketSnapshotIntervalMs, timeframe, strategy?.tradingStyle]);

  useEffect(() => {
    if (!refreshPolicy.marketStreamsEnabled) return undefined;
    const closeStream = marketService.openTickerStream(currentCoin, (payload) => {
      latestTickerRef.current = {
        price: Number(payload.c || 0),
        change: Number(payload.P || 0),
        high: Number(payload.h || 0),
        low: Number(payload.l || 0),
        volume: Number(payload.v || 0),
      };

      if (tickerFrameRef.current === null) {
        tickerFrameRef.current = window.requestAnimationFrame(() => {
          tickerFrameRef.current = null;
          const snapshot = latestTickerRef.current;
          if (!snapshot) return;

          if (snapshot.price > 0) {
            setCurrentPrice(snapshot.price);
          }

          if (snapshot.price > 0 || snapshot.high > 0 || snapshot.low > 0 || snapshot.volume > 0) {
            setMarket24h({
              change: snapshot.change || 0,
              high: snapshot.high || 0,
              low: snapshot.low || 0,
              volume: `${(snapshot.volume / 1000).toFixed(1)} BTC`,
              updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
          }
        });
      }
    });

    return () => {
      if (tickerFrameRef.current !== null) {
        window.cancelAnimationFrame(tickerFrameRef.current);
        tickerFrameRef.current = null;
      }
      closeStream();
    };
  }, [currentCoin, refreshPolicy.marketStreamsEnabled]);

  useEffect(() => {
    if (!refreshPolicy.marketStreamsEnabled) return undefined;
    const closeStream = marketService.openKlineStream(currentCoin, timeframe, (payload) => {
      const kline = payload.k;
      if (!kline?.t) return;

      latestKlineRef.current = {
        time: Math.floor(kline.t / 1000),
        open: Number(kline.o || 0),
        high: Number(kline.h || 0),
        low: Number(kline.l || 0),
        close: Number(kline.c || 0),
        volume: Number(kline.v || 0),
      };

      if (klineFrameRef.current === null) {
        klineFrameRef.current = window.requestAnimationFrame(() => {
          klineFrameRef.current = null;
          const incomingCandle = latestKlineRef.current;
          if (!incomingCandle) return;

          setCandles((prevCandles) => {
            const source = prevCandles.length ? prevCandles : generateFallbackCandles(activeTimeframeRef.current);
            const nextCandles = mergeLiveCandle(source, incomingCandle);
            applyLiveDerivedState(nextCandles, incomingCandle.close);
            return nextCandles;
          });
        });
      }
    });

    return () => {
      if (klineFrameRef.current !== null) {
        window.cancelAnimationFrame(klineFrameRef.current);
        klineFrameRef.current = null;
      }
      closeStream();
    };
  }, [applyLiveDerivedState, currentCoin, refreshPolicy.marketStreamsEnabled, timeframe]);

  useEffect(() => {
    if (!refreshPolicy.marketStreamsEnabled || !viewNeedsMarketComparison(currentView)) return undefined;
    const comparisonSymbols = POPULAR_COINS.slice(0, 4);
    const closeComparisonStream = marketService.openComparisonStream(comparisonSymbols, (symbol, payload) => {
      const nextPrice = Number(payload.c || 0);
      const nextChange = Number(payload.P || 0);
      if (nextPrice <= 0 && nextChange === 0) return;

      setComparison((prev) => {
        if (!prev.length) return prev;
        let changed = false;
        const next = prev.map((item) => {
          if (item.symbol !== symbol) return item;
          changed = true;
          return {
            ...item,
            price: nextPrice > 0 ? nextPrice : item.price,
            change: Number.isFinite(nextChange) ? nextChange : item.change,
            impulse: nextChange > 2 ? "Fuerte" : nextChange > 0 ? "Moderado" : "Débil",
          };
        });
        return changed ? next : prev;
      });
    });

    return () => {
      closeComparisonStream();
    };
  }, [currentView, refreshPolicy.marketStreamsEnabled]);

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
