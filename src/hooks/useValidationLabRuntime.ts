import { useCallback, useEffect, useRef, useState } from "react";
import { strategyEngineService } from "../services/api";
import type { StrategyBacktestRun, StrategyValidationLabPayload, StrategyValidationReport, UserSession } from "../types";

interface UseValidationLabRuntimeOptions {
  currentUser: UserSession | null;
}

const EMPTY_QUEUE = { pending: 0, running: 0 };

function hasBacktestRunsChanged(current: StrategyBacktestRun[], next: StrategyBacktestRun[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.id !== nextItem.id
      || currentItem.status !== nextItem.status
      || (currentItem.createdAt || "") !== (nextItem.createdAt || "")
    ) {
      return true;
    }
  }

  return false;
}

function hasBacktestQueueChanged(
  current: { pending: number; running: number },
  next: { pending: number; running: number },
) {
  return current.pending !== next.pending || current.running !== next.running;
}

function hasValidationReportChanged(current: StrategyValidationReport | null, next: StrategyValidationReport | null) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return JSON.stringify(current) !== JSON.stringify(next);
}

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
    const nextReport = payload.report || null;
    const nextRuns = Array.isArray(payload.runs) ? payload.runs : [];
    const nextQueue = payload.queue || EMPTY_QUEUE;

    // Validation lab payloads can be large, but they are low-frequency and
    // shared across admin surfaces. Skip equivalent rewrites so Profile and the
    // system plane do not rerender just because an admin action returned the
    // same lab snapshot with fresh object references.
    setValidationReport((current) => (hasValidationReportChanged(current, nextReport) ? nextReport : current));
    setBacktestRuns((current) => (hasBacktestRunsChanged(current, nextRuns) ? nextRuns : current));
    setBacktestQueue((current) => (hasBacktestQueueChanged(current, nextQueue) ? nextQueue : current));
    return payload;
  }, []);

  const refreshValidationLab = useCallback(async (options?: { forceFresh?: boolean; clearOnError?: boolean }) => {
    const username = currentUser?.username || "";
    if (!username || currentUser?.role !== "admin") {
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
    if (!username || currentUser?.role !== "admin") return null;
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
    if (!username || currentUser?.role !== "admin") return null;
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
    if (!username || currentUser?.role !== "admin") return null;
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
    if (!currentUser || currentUser.role !== "admin") {
      setValidationReport(null);
      setBacktestRuns([]);
      setBacktestQueue(EMPTY_QUEUE);
      return;
    }
    // Validation lab is admin-only and intentionally on-demand now. Profile's
    // backtesting tab triggers explicit refreshes when the user actually opens
    // that tooling surface, so the authenticated shell no longer pays its cost
    // during generic startup or navigation.
  }, [currentUser]);

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
