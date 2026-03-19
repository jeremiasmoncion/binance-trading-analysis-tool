import { useCallback, useEffect, useRef, useState } from "react";
import { strategyEngineService } from "../services/api";
import type { StrategyBacktestRun, StrategyValidationLabPayload, StrategyValidationReport, UserSession } from "../types";

interface UseValidationLabRuntimeOptions {
  currentUser: UserSession | null;
}

const EMPTY_QUEUE = { pending: 0, running: 0 };

export function useValidationLabRuntime({ currentUser }: UseValidationLabRuntimeOptions) {
  const [validationReport, setValidationReport] = useState<StrategyValidationReport | null>(null);
  const [backtestRuns, setBacktestRuns] = useState<StrategyBacktestRun[]>([]);
  const [backtestQueue, setBacktestQueue] = useState(EMPTY_QUEUE);
  const activeUsernameRef = useRef("");

  useEffect(() => {
    activeUsernameRef.current = currentUser?.username || "";
  }, [currentUser?.username]);

  const applyPayload = useCallback((payload: StrategyValidationLabPayload | null) => {
    if (!payload) return null;
    setValidationReport(payload.report || null);
    setBacktestRuns(Array.isArray(payload.runs) ? payload.runs : []);
    setBacktestQueue(payload.queue || EMPTY_QUEUE);
    return payload;
  }, []);

  const refreshValidationLab = useCallback(async (options?: { forceFresh?: boolean; clearOnError?: boolean }) => {
    const username = currentUser?.username || "";
    if (!username) {
      if (options?.clearOnError) {
        setValidationReport(null);
        setBacktestRuns([]);
        setBacktestQueue(EMPTY_QUEUE);
      }
      return null;
    }

    try {
      const payload = await strategyEngineService.getValidationLab({ forceFresh: options?.forceFresh });
      if (activeUsernameRef.current !== username) {
        return null;
      }
      return applyPayload(payload);
    } catch {
      if (options?.clearOnError) {
        setValidationReport(null);
        setBacktestRuns([]);
        setBacktestQueue(EMPTY_QUEUE);
      }
      return null;
    }
  }, [applyPayload, currentUser?.username]);

  const enqueueValidationBacktest = useCallback(async (payload?: { label?: string; triggerSource?: string }) => {
    const username = currentUser?.username || "";
    if (!username) return null;
    try {
      const nextPayload = await strategyEngineService.runValidationBacktest(payload);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      return applyPayload(nextPayload);
    } catch {
      return null;
    }
  }, [applyPayload, currentUser?.username]);

  const processValidationBacktestQueue = useCallback(async (payload?: { limit?: number; triggerSource?: string }) => {
    const username = currentUser?.username || "";
    if (!username) return null;
    try {
      const nextPayload = await strategyEngineService.processValidationBacktestQueue(payload);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      return applyPayload(nextPayload);
    } catch {
      return null;
    }
  }, [applyPayload, currentUser?.username]);

  const backfillValidationDataset = useCallback(async (payload?: { label?: string; triggerSource?: string; limit?: number }) => {
    const username = currentUser?.username || "";
    if (!username) return null;
    try {
      const nextPayload = await strategyEngineService.backfillValidationDataset(payload);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      return applyPayload(nextPayload);
    } catch {
      return null;
    }
  }, [applyPayload, currentUser?.username]);

  useEffect(() => {
    if (!currentUser) {
      setValidationReport(null);
      setBacktestRuns([]);
      setBacktestQueue(EMPTY_QUEUE);
      return;
    }

    // Share one validation-lab snapshot across admin surfaces so the backtesting
    // runtime follows the same plane-first architecture as scanner and memory.
    void refreshValidationLab({ clearOnError: true });
  }, [currentUser, refreshValidationLab]);

  return {
    validationReport,
    backtestRuns,
    backtestQueue,
    refreshValidationLab,
    enqueueValidationBacktest,
    processValidationBacktestQueue,
    backfillValidationDataset,
  };
}
