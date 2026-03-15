import { useCallback, useEffect, useMemo, useState } from "react";
import { COINS, MAP_TIMEFRAMES } from "../config/constants";
import { calcIndicators, generateFallbackCandles, generateSignal, getSupportResistance } from "../lib/trading";
import { marketService } from "../services/api";
import type { Candle, ComparisonCoin, Indicators, Signal, TimeframeSignal, ViewName } from "../types";

interface UseMarketDataOptions {
  currentView: ViewName;
}

export function useMarketData({ currentView }: UseMarketDataOptions) {
  const [currentCoin, setCurrentCoin] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [multiTimeframes, setMultiTimeframes] = useState<TimeframeSignal[]>([]);
  const [comparison, setComparison] = useState<ComparisonCoin[]>([]);
  const [market24h, setMarket24h] = useState({ change: 0, high: 0, low: 0, volume: "0 BTC", updatedAt: "--:--" });

  const supportResistance = useMemo(
    () => getSupportResistance(candles.length ? candles : generateFallbackCandles(timeframe)),
    [candles, timeframe],
  );

  const fetchData = useCallback(async (coin = currentCoin, nextTimeframe = timeframe) => {
    setStatus("loading");
    try {
      const fetchedCandles = (await marketService.fetchCandles(coin, nextTimeframe)) || generateFallbackCandles(nextTimeframe);
      const nextIndicators = calcIndicators(fetchedCandles);
      const nextSignal = generateSignal(nextIndicators);

      const nextMultiTimeframes = await Promise.all(
        MAP_TIMEFRAMES.map(async (mapTf) => {
          const tfCandles = (await marketService.fetchCandles(coin, mapTf)) || generateFallbackCandles(mapTf);
          const tfSignal = generateSignal(calcIndicators(tfCandles));
          return {
            timeframe: mapTf,
            label: tfSignal.label,
            note: tfSignal.trend === "Neutral" ? "Sin sesgo claro" : tfSignal.trend,
          };
        }),
      );

      const ticker = await marketService.fetch24h(coin);
      const nextComparison = await Promise.all(
        COINS.slice(0, 4).map(async (symbol) => {
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
      setSignal(nextSignal);
      setMultiTimeframes(nextMultiTimeframes);
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
    if (currentView !== "dashboard" && currentView !== "market") return undefined;
    const intervalId = window.setInterval(() => {
      void fetchData();
    }, 45000);
    return () => window.clearInterval(intervalId);
  }, [currentView, fetchData]);

  return {
    currentCoin,
    timeframe,
    status,
    candles,
    indicators,
    signal,
    multiTimeframes,
    comparison,
    market24h,
    supportResistance,
    fetchData,
    selectCoin(coin: string) {
      if (!coin) return;
      void fetchData(coin, timeframe);
    },
    selectTimeframe(nextTimeframe: string) {
      void fetchData(currentCoin, nextTimeframe);
    },
  };
}
