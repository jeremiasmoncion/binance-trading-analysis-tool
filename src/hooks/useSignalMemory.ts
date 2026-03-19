import { useCallback, useEffect, useRef, useState } from "react";
import { getViewRefreshPolicy } from "../data-platform/refreshPolicy";
import { marketDataPlaneStore } from "../data-platform/marketDataPlane";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import { signalService } from "../services/api";
import type { DashboardAnalysis, OperationPlan, Signal, SignalOutcomeStatus, SignalSnapshot, StrategyCandidate, StrategyDescriptor, TimeframeSignal, UserSession, ViewName } from "../types";

interface UseSignalMemoryOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

export function useSignalMemory({ currentUser, currentView }: UseSignalMemoryOptions) {
  const refreshPolicy = getViewRefreshPolicy(currentView);
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const pendingSaveKeysRef = useRef<Set<string>>(new Set());
  const evaluationInFlightRef = useRef(false);
  const lastEvaluationAtRef = useRef(0);

  const publishSignalsToPlane = useCallback((nextSignals: SignalSnapshot[]) => {
    systemDataPlaneStore.setState((current) => ({
      ...current,
      meta: {
        ...current.meta,
        status: "ready",
        source: "snapshot",
        lastFullSyncAt: Date.now(),
        lastError: null,
      },
      snapshot: {
        ...current.snapshot,
        signalMemory: nextSignals,
      },
    }));
  }, []);

  const buildClientPriceMap = useCallback((context?: { currentCoin?: string; currentPrice?: number | null }) => {
    const marketState = marketDataPlaneStore.getState();
    const prices = new Map<string, number>();

    if (marketState.currentCoin && Number(marketState.currentPrice || 0) > 0) {
      prices.set(marketState.currentCoin, Number(marketState.currentPrice));
    }

    marketState.comparison.forEach((item) => {
      if (item.symbol && Number(item.price || 0) > 0) {
        prices.set(item.symbol, Number(item.price));
      }
    });

    if (context?.currentCoin && Number(context.currentPrice || 0) > 0) {
      prices.set(context.currentCoin, Number(context.currentPrice));
    }

    return prices;
  }, []);

  const refreshSignals = useCallback(async () => {
    if (!currentUser) return;
    try {
      const payload = await signalService.list();
      const nextSignals = payload.signals || [];
      setSignals(nextSignals);
      publishSignalsToPlane(nextSignals);
    } catch {
      systemDataPlaneStore.setState((current) => ({
        ...current,
        meta: {
          ...current.meta,
          status: current.snapshot.signalMemory.length ? "degraded" : current.meta.status,
          lastError: "No se pudo refrescar la memoria de señales.",
        },
      }));
    }
  }, [currentUser, publishSignalsToPlane]);

  const saveSignal = useCallback(async (payload: {
    coin: string;
    timeframe: string;
    signal: Signal | null;
    analysis: DashboardAnalysis | null;
    plan: OperationPlan | null;
    multiTimeframes: TimeframeSignal[];
    strategy?: StrategyDescriptor | null;
    strategyCandidates?: StrategyCandidate[];
    note?: string;
  }) => {
    if (!currentUser || !payload.signal) return;
    await signalService.create({
      coin: payload.coin,
      timeframe: payload.timeframe,
      signal: payload.signal,
      analysis: payload.analysis,
      plan: payload.plan,
      multiTimeframes: payload.multiTimeframes,
      strategy: payload.strategy || undefined,
      strategyCandidates: payload.strategyCandidates || [],
      note: payload.note,
    });
    await refreshSignals();
  }, [currentUser, refreshSignals]);

  const maybeAutoSaveSignal = useCallback(async (payload: {
    coin: string;
    timeframe: string;
    signal: Signal | null;
    analysis: DashboardAnalysis | null;
    plan: OperationPlan | null;
    multiTimeframes: TimeframeSignal[];
    strategy?: StrategyDescriptor | null;
    strategyCandidates?: StrategyCandidate[];
  }) => {
    if (!currentUser || !payload.signal || !payload.analysis || !payload.plan) return;
    const shouldAutoSave =
      payload.signal.label !== "Esperar"
      || (payload.analysis.setupQuality === "Alta" && payload.analysis.alignmentCount >= 4);

    if (!shouldAutoSave) return;

    const key = [
      payload.coin,
      payload.timeframe,
      payload.signal.label,
      payload.analysis.setupType,
      Math.round((payload.plan.entry || 0) * 100) / 100,
    ].join("|");

    if (pendingSaveKeysRef.current.has(key)) return;

    const duplicate = signals.find((item) => {
      const createdAt = new Date(item.created_at).getTime();
      const ageMs = Date.now() - createdAt;
      const entryGapPct =
        payload.plan && item.entry_price
          ? Math.abs(((Number(item.entry_price) - payload.plan.entry) / payload.plan.entry) * 100)
          : 0;
      return item.coin === payload.coin
        && item.timeframe === payload.timeframe
        && item.signal_label === payload.signal?.label
        && (item.setup_type || "") === (payload.analysis?.setupType || "")
        && item.outcome_status === "pending"
        && ageMs <= 6 * 60 * 60 * 1000
        && entryGapPct <= 0.4;
    });

    if (duplicate) return;

    pendingSaveKeysRef.current.add(key);
    try {
      await signalService.create({
        coin: payload.coin,
        timeframe: payload.timeframe,
        signal: payload.signal,
        analysis: payload.analysis,
        plan: payload.plan,
        multiTimeframes: payload.multiTimeframes,
        strategy: payload.strategy || undefined,
        strategyCandidates: payload.strategyCandidates || [],
        note: "Auto-guardada por CRYPE",
      });
      await refreshSignals();
    } finally {
      pendingSaveKeysRef.current.delete(key);
    }
  }, [currentUser, refreshSignals, signals]);

  const updateSignal = useCallback(async (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => {
    await signalService.update(id, { outcomeStatus, outcomePnl, note });
    await refreshSignals();
  }, [refreshSignals]);

  const evaluatePendingSignals = useCallback(async (context?: { currentCoin?: string; currentPrice?: number | null }) => {
    if (!currentUser || evaluationInFlightRef.current) return;
    if (Date.now() - lastEvaluationAtRef.current < 15000) return;

    const pendingSignals = signals.filter((item) => item.outcome_status === "pending");
    if (!pendingSignals.length) return;

    evaluationInFlightRef.current = true;
    lastEvaluationAtRef.current = Date.now();

    try {
      // Client-side signal evaluation is now only allowed to use prices that
      // are already inside the shared market plane. Off-screen coins should be
      // resolved by the backend watcher instead of spawning parallel market IO.
      const prices = buildClientPriceMap(context);
      const updates: Array<Promise<unknown>> = [];

      pendingSignals.forEach((item) => {
        const currentPrice = prices.get(item.coin) || 0;
        if (currentPrice <= 0 || !item.entry_price) return;

        const label = item.signal_label;
        const entry = Number(item.entry_price || 0);
        const tp = Number(item.tp_price || 0);
        const tp2 = Number(item.tp2_price || 0);
        const sl = Number(item.sl_price || 0);
        const refCapital = Number(item.signal_payload?.plan?.refCapital || 100);
        let outcomeStatus: SignalOutcomeStatus | null = null;
        let exitPrice = 0;

        if (label === "Comprar") {
          if (tp2 > 0 && currentPrice >= tp2) {
            outcomeStatus = "win";
            exitPrice = tp2;
          } else if (tp > 0 && currentPrice >= tp) {
            outcomeStatus = "win";
            exitPrice = tp;
          } else if (sl > 0 && currentPrice <= sl) {
            outcomeStatus = "loss";
            exitPrice = sl;
          }
        } else if (label === "Vender") {
          if (tp2 > 0 && currentPrice <= tp2) {
            outcomeStatus = "win";
            exitPrice = tp2;
          } else if (tp > 0 && currentPrice <= tp) {
            outcomeStatus = "win";
            exitPrice = tp;
          } else if (sl > 0 && currentPrice >= sl) {
            outcomeStatus = "loss";
            exitPrice = sl;
          }
        }

        if (!outcomeStatus || exitPrice <= 0) return;

        const pnlPct = label === "Vender"
          ? ((entry - exitPrice) / entry) * 100
          : ((exitPrice - entry) / entry) * 100;
        const outcomePnl = Number(((refCapital * pnlPct) / 100).toFixed(4));
        const previousNote = item.note ? `${item.note} · ` : "";
        const autoNote = `${previousNote}Auto-cerrada el ${new Date().toLocaleString("es-DO")} a ${exitPrice.toFixed(6)}`;

        updates.push(signalService.update(item.id, {
          outcomeStatus,
          outcomePnl,
          note: autoNote,
        }));
      });

      if (updates.length) {
        await Promise.all(updates);
        await refreshSignals();
      }
    } finally {
      evaluationInFlightRef.current = false;
    }
  }, [buildClientPriceMap, currentUser, refreshSignals, signals]);

  useEffect(() => {
    if (!currentUser) {
      setSignals([]);
      publishSignalsToPlane([]);
      return;
    }

    void refreshSignals();
  }, [currentUser, currentView, publishSignalsToPlane, refreshSignals]);

  useEffect(() => {
    if (!currentUser) return undefined;

    if (!refreshPolicy.signalMemoryIntervalMs || refreshPolicy.signalMemoryIntervalMs <= 0) {
      return undefined;
    }

    const refreshInterval = refreshPolicy.signalMemoryIntervalMs;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshSignals();
    }, refreshInterval);

    return () => window.clearInterval(intervalId);
  }, [currentUser, refreshPolicy.signalMemoryIntervalMs, refreshSignals]);

  return {
    signals,
    refreshSignals,
    saveSignal,
    updateSignal,
    maybeAutoSaveSignal,
    evaluatePendingSignals,
  };
}
