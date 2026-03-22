import { useCallback, useEffect, useRef, useState } from "react";
import { strategyEngineService, watchlistService } from "../services/api";
import type {
  StrategyDecisionState,
  StrategyExperimentRecord,
  StrategyRecommendationRecord,
  StrategyRegistryEntry,
  StrategyVersionRecord,
  UserSession,
  ViewName,
  WatchlistScannerStatus,
} from "../types";

interface UseMemoryRuntimeOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

function getMemoryRuntimeStrategyIntervalMs(currentView: ViewName) {
  if (currentView === "memory" || currentView === "profile") {
    return 60_000;
  }

  return 0;
}

function getMemoryRuntimeScannerIntervalMs(currentView: ViewName) {
  if (currentView === "memory" || currentView === "profile") {
    return 60_000;
  }

  if (
    currentView === "ai-signal-bot"
    || currentView === "signals"
    || currentView === "bots"
    || currentView === "trading"
    || currentView === "control-overview"
    || currentView === "control-bot-settings"
  ) {
    return 180_000;
  }

  return 0;
}

function viewNeedsStrategyRuntimeBootstrap(currentView: ViewName) {
  return currentView === "memory" || currentView === "profile";
}

function viewNeedsScannerRuntimeBootstrap(currentView: ViewName) {
  return getMemoryRuntimeScannerIntervalMs(currentView) > 0;
}

function hasRecordArrayChanged<T extends { id: number; updated_at?: string | null }>(current: T[], next: T[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (currentItem.id !== nextItem.id || (currentItem.updated_at || "") !== (nextItem.updated_at || "")) {
      return true;
    }
  }

  return false;
}

function hasDecisionChanged(current: StrategyDecisionState | null, next: StrategyDecisionState | null) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return !(
    (current.username || "") === (next.username || "")
    && (current.scorerPolicy?.activeScorer || "") === (next.scorerPolicy?.activeScorer || "")
    && (current.scorerPolicy?.promotedAt || "") === (next.scorerPolicy?.promotedAt || "")
    && (current.scorerPolicy?.source || "") === (next.scorerPolicy?.source || "")
    && Number(current.scorerPolicy?.confidence || 0) === Number(next.scorerPolicy?.confidence || 0)
    && current.activeStrategyByScope.length === next.activeStrategyByScope.length
    && current.executionEligibleScopes.length === next.executionEligibleScopes.length
    && current.sandboxExperimentsByScope.length === next.sandboxExperimentsByScope.length
  );
}

function hasScannerTargetsChanged(
  current: WatchlistScannerStatus["targets"],
  next: WatchlistScannerStatus["targets"],
) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      (currentItem.username || "") !== (nextItem.username || "")
      || (currentItem.activeListName || "") !== (nextItem.activeListName || "")
      || Number(currentItem.coinsCount || 0) !== Number(nextItem.coinsCount || 0)
      || currentItem.coins.length !== nextItem.coins.length
    ) {
      return true;
    }

    for (let coinIndex = 0; coinIndex < currentItem.coins.length; coinIndex += 1) {
      if ((currentItem.coins[coinIndex] || "") !== (nextItem.coins[coinIndex] || "")) {
        return true;
      }
    }
  }

  return false;
}

function hasScannerRunsChanged(
  current: WatchlistScannerStatus["runs"],
  next: WatchlistScannerStatus["runs"],
) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.id !== nextItem.id
      || (currentItem.status || "") !== (nextItem.status || "")
      || Number(currentItem.coins_count || 0) !== Number(nextItem.coins_count || 0)
      || Number(currentItem.frames_scanned || 0) !== Number(nextItem.frames_scanned || 0)
      || Number(currentItem.signals_created || 0) !== Number(nextItem.signals_created || 0)
      || Number(currentItem.signals_closed || 0) !== Number(nextItem.signals_closed || 0)
      || Number(currentItem.auto_orders_placed || 0) !== Number(nextItem.auto_orders_placed || 0)
      || Number(currentItem.auto_orders_blocked || 0) !== Number(nextItem.auto_orders_blocked || 0)
      || (currentItem.auto_execution_cooldown_until || "") !== (nextItem.auto_execution_cooldown_until || "")
      || (currentItem.created_at || "") !== (nextItem.created_at || "")
    ) {
      return true;
    }
  }

  return false;
}

function hasScannerStatusChanged(current: WatchlistScannerStatus | null, next: WatchlistScannerStatus | null) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return !(
    Number(current.summary?.watchedUsers || 0) === Number(next.summary?.watchedUsers || 0)
    && Number(current.summary?.watchedCoins || 0) === Number(next.summary?.watchedCoins || 0)
    && Number(current.summary?.schedulerRuns || 0) === Number(next.summary?.schedulerRuns || 0)
    && Boolean(current.summary?.autoExecutionCooldownActive) === Boolean(next.summary?.autoExecutionCooldownActive)
    && (current.summary?.autoExecutionCooldownUntil || "") === (next.summary?.autoExecutionCooldownUntil || "")
    && !hasScannerTargetsChanged(current.targets, next.targets)
    && !hasScannerRunsChanged(current.runs, next.runs)
    && (current.latestRun?.id || 0) === (next.latestRun?.id || 0)
    && (current.latestRun?.created_at || "") === (next.latestRun?.created_at || "")
    && (current.latestSchedulerRun?.id || 0) === (next.latestSchedulerRun?.id || 0)
    && (current.latestSchedulerRun?.created_at || "") === (next.latestSchedulerRun?.created_at || "")
  );
}

export function useMemoryRuntime({ currentUser, currentView }: UseMemoryRuntimeOptions) {
  const [strategyRegistry, setStrategyRegistry] = useState<StrategyRegistryEntry[]>([]);
  const [strategyVersions, setStrategyVersions] = useState<StrategyVersionRecord[]>([]);
  const [strategyExperiments, setStrategyExperiments] = useState<StrategyExperimentRecord[]>([]);
  const [strategyRecommendations, setStrategyRecommendations] = useState<StrategyRecommendationRecord[]>([]);
  const [strategyDecision, setStrategyDecision] = useState<StrategyDecisionState | null>(null);
  const [scannerStatus, setScannerStatus] = useState<WatchlistScannerStatus | null>(null);
  const activeUsernameRef = useRef("");

  useEffect(() => {
    activeUsernameRef.current = currentUser?.username || "";
  }, [currentUser?.username]);

  const refreshStrategyEngine = useCallback(async (options?: { forceFresh?: boolean; clearOnError?: boolean }) => {
    const username = currentUser?.username || "";
    if (!username) {
      if (options?.clearOnError) {
        setStrategyRegistry([]);
        setStrategyVersions([]);
        setStrategyExperiments([]);
        setStrategyRecommendations([]);
        setStrategyDecision(null);
      }
      return null;
    }

    try {
      const payload = await strategyEngineService.list({ forceFresh: options?.forceFresh });
      if (activeUsernameRef.current !== username) {
        return null;
      }
      const nextRegistry = payload.registry || [];
      const nextVersions = payload.versions || [];
      const nextExperiments = payload.experiments || [];
      const nextRecommendations = payload.recommendations || [];
      const nextDecision = payload.decision || null;

      // Strategy runtime is shared across Memory, admin panels and automation
      // notifications. Ignore refreshes that only recreate equivalent arrays so
      // shared selectors do not rerender on every periodic poll.
      setStrategyRegistry((current) => (hasRecordArrayChanged(current, nextRegistry) ? nextRegistry : current));
      setStrategyVersions((current) => (hasRecordArrayChanged(current, nextVersions) ? nextVersions : current));
      setStrategyExperiments((current) => (hasRecordArrayChanged(current, nextExperiments) ? nextExperiments : current));
      setStrategyRecommendations((current) => (hasRecordArrayChanged(current, nextRecommendations) ? nextRecommendations : current));
      setStrategyDecision((current) => (hasDecisionChanged(current, nextDecision) ? nextDecision : current));
      return payload;
    } catch {
      if (options?.clearOnError) {
        setStrategyRegistry([]);
        setStrategyVersions([]);
        setStrategyExperiments([]);
        setStrategyRecommendations([]);
        setStrategyDecision(null);
      }
      return null;
    }
  }, [currentUser?.username]);

  const createStrategyExperiment = useCallback(async (payload: {
    baseStrategyId: string;
    candidateStrategyId: string;
    candidateVersion: string;
    marketScope?: string;
    timeframeScope?: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      await strategyEngineService.createExperiment(payload);
      return await refreshStrategyEngine({ forceFresh: true });
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshStrategyEngine]);

  const updateStrategyExperiment = useCallback(async (id: number, payload: { status?: string; summary?: string; metadata?: Record<string, unknown> }) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      await strategyEngineService.updateExperiment(id, payload);
      return await refreshStrategyEngine({ forceFresh: true });
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshStrategyEngine]);

  const promoteStrategyExperiment = useCallback(async (id: number) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      await strategyEngineService.promoteExperiment(id);
      return await refreshStrategyEngine({ forceFresh: true });
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshStrategyEngine]);

  const generateStrategyRecommendations = useCallback(async () => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      // Recommendation generation is a shared engine mutation, so the plane
      // immediately refreshes the canonical strategy snapshot after it runs.
      await strategyEngineService.generateRecommendations();
      return await refreshStrategyEngine({ forceFresh: true });
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshStrategyEngine]);

  const activateStrategyRecommendation = useCallback(async (recommendationId: number) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const result = await strategyEngineService.activateRecommendation(recommendationId);
      await refreshStrategyEngine({ forceFresh: true });
      return result;
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshStrategyEngine]);

  const refreshScannerStatus = useCallback(async (options?: { forceFresh?: boolean; clearOnError?: boolean }) => {
    const username = currentUser?.username || "";
    if (!username) {
      if (options?.clearOnError) {
        setScannerStatus(null);
      }
      return null;
    }

    try {
      const payload = await watchlistService.scanStatus({ forceFresh: options?.forceFresh });
      if (activeUsernameRef.current !== username) {
        return null;
      }
      setScannerStatus((current) => (hasScannerStatusChanged(current, payload) ? payload : current));
      return payload;
    } catch {
      if (options?.clearOnError) {
        setScannerStatus(null);
      }
      return null;
    }
  }, [currentUser?.username]);

  const runScannerNow = useCallback(async () => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const execution = await watchlistService.runScan();
      await refreshScannerStatus({ forceFresh: true });
      return execution;
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshScannerStatus]);

  useEffect(() => {
    if (!currentUser) {
      setStrategyRegistry([]);
      setStrategyVersions([]);
      setStrategyExperiments([]);
      setStrategyRecommendations([]);
      setStrategyDecision(null);
      setScannerStatus(null);
      return;
    }

    // Memory tooling now hydrates centrally so the view can consume a shared
    // snapshot instead of owning its own fetch lifecycle. Only bootstrap the
    // heavy domains when the active screen can actually consume them.
    if (viewNeedsStrategyRuntimeBootstrap(currentView)) {
      void refreshStrategyEngine({ clearOnError: true });
    }
    if (viewNeedsScannerRuntimeBootstrap(currentView)) {
      void refreshScannerStatus({ clearOnError: true });
    }
  }, [currentUser, currentView, refreshScannerStatus, refreshStrategyEngine]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const intervalMs = getMemoryRuntimeStrategyIntervalMs(currentView);
    if (!intervalMs || intervalMs <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      // Strategy recommendations now refresh through the shared memory runtime
      // instead of App-level one-off polling, so recommendations, Memory and
      // automation notifications all observe the same canonical engine snapshot.
      // Views that actively inspect memory keep a tighter cadence, while the
      // rest of the shell uses a slower heartbeat to keep shared automation
      // state fresh without paying the same global cost on every screen.
      void refreshStrategyEngine();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, currentView, refreshStrategyEngine]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const intervalMs = getMemoryRuntimeScannerIntervalMs(currentView);
    if (!intervalMs || intervalMs <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshScannerStatus();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, currentView, refreshScannerStatus]);

  return {
    strategyRegistry,
    strategyVersions,
    strategyExperiments,
    strategyRecommendations,
    strategyDecision,
    scannerStatus,
    refreshStrategyEngine,
    createStrategyExperiment,
    updateStrategyExperiment,
    promoteStrategyExperiment,
    generateStrategyRecommendations,
    activateStrategyRecommendation,
    refreshScannerStatus,
    runScannerNow,
  };
}
