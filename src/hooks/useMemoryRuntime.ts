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
    createStrategyExperiment,
    updateStrategyExperiment,
    promoteStrategyExperiment,
    generateStrategyRecommendations,
    activateStrategyRecommendation,
    refreshScannerStatus,
    runScannerNow,
  };
}
