import { useCallback, useEffect, useState } from "react";
import { signalService } from "../services/api";
import type { DashboardAnalysis, OperationPlan, Signal, SignalOutcomeStatus, SignalSnapshot, TimeframeSignal, UserSession, ViewName } from "../types";

interface UseSignalMemoryOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

export function useSignalMemory({ currentUser, currentView }: UseSignalMemoryOptions) {
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);

  const refreshSignals = useCallback(async () => {
    if (!currentUser) return;
    try {
      const payload = await signalService.list();
      setSignals(payload.signals || []);
    } catch {
      setSignals([]);
    }
  }, [currentUser]);

  const saveSignal = useCallback(async (payload: {
    coin: string;
    timeframe: string;
    signal: Signal | null;
    analysis: DashboardAnalysis | null;
    plan: OperationPlan | null;
    multiTimeframes: TimeframeSignal[];
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
      note: payload.note,
    });
    await refreshSignals();
  }, [currentUser, refreshSignals]);

  const updateSignal = useCallback(async (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => {
    await signalService.update(id, { outcomeStatus, outcomePnl, note });
    await refreshSignals();
  }, [refreshSignals]);

  useEffect(() => {
    if (!currentUser) {
      setSignals([]);
      return;
    }

    if (currentView === "memory" || currentView === "dashboard") {
      void refreshSignals();
    }
  }, [currentUser, currentView, refreshSignals]);

  return {
    signals,
    refreshSignals,
    saveSignal,
    updateSignal,
  };
}
