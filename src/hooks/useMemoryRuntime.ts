import { useCallback, useEffect, useRef, useState } from "react";
import { strategyEngineService, watchlistService } from "../services/api";
import type {
  StrategyDecisionState,
  StrategyExperimentRecord,
  StrategyRecommendationRecord,
  StrategyRegistryEntry,
  StrategyVersionRecord,
  UserSession,
  WatchlistScannerStatus,
} from "../types";

interface UseMemoryRuntimeOptions {
  currentUser: UserSession | null;
}

export function useMemoryRuntime({ currentUser }: UseMemoryRuntimeOptions) {
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
      setStrategyRegistry(payload.registry || []);
      setStrategyVersions(payload.versions || []);
      setStrategyExperiments(payload.experiments || []);
      setStrategyRecommendations(payload.recommendations || []);
      setStrategyDecision(payload.decision || null);
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
      setScannerStatus(payload);
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
    // snapshot instead of owning its own fetch lifecycle.
    void refreshStrategyEngine({ clearOnError: true });
    void refreshScannerStatus({ clearOnError: true });
  }, [currentUser, refreshScannerStatus, refreshStrategyEngine]);

  return {
    strategyRegistry,
    strategyVersions,
    strategyExperiments,
    strategyRecommendations,
    strategyDecision,
    scannerStatus,
    refreshStrategyEngine,
    refreshScannerStatus,
    runScannerNow,
  };
}
