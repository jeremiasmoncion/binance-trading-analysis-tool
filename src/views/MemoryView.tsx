import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { EmptyState } from "../components/ui/EmptyState";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatAmount, formatPrice, formatSignedPrice } from "../lib/format";
import { openHelp, showToast, startLoading, stopLoading } from "../lib/ui-events";
import { binanceService, strategyEngineService, watchlistService } from "../services/api";
import type {
  ExecutionCenterPayload,
  ExecutionCandidate,
  ExecutionOrderRecord,
  ExecutionScopeOverride,
  RecommendationActivationResult,
  SignalOutcomeStatus,
  SignalSnapshot,
  StrategyExperimentRecord,
  StrategyRegistryEntry,
  StrategyRecommendationRecord,
  StrategyVersionRecord,
  WatchlistScanExecution,
  WatchlistScannerStatus,
} from "../types";

interface MemoryViewProps {
  signals: SignalSnapshot[];
  watchlist: string[];
  executionCenter: ExecutionCenterPayload | null;
  onRefreshExecutionCenter: () => Promise<unknown>;
  onUpdateSignal: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}

type SignalsTab = "overview" | "performance" | "strategies" | "adaptive" | "experiments" | "execution" | "history";

interface AggregateRow {
  label: string;
  total: number;
  wins: number;
  losses: number;
  invalidated: number;
  pnl: number;
  avgPnl: number;
  winRate: number;
}

interface ExperimentPaperStats {
  experiment: StrategyExperimentRecord;
  baseLabel: string;
  candidateLabel: string;
  sampleSize: number;
  basePrimaryCount: number;
  candidatePrimaryCount: number;
  basePrimaryPnl: number;
  candidatePrimaryPnl: number;
  baseWinRate: number;
  candidateWinRate: number;
  candidateAppearances: number;
  recommendation: string;
  recommendationReason: string;
  recommendationStatus: string;
  recommendationClass: string;
  canPromote: boolean;
  candidateRunnable: boolean;
}

interface SignalCohortStats {
  total: number;
  wins: number;
  pnl: number;
  winRate: number;
  avgPnl: number;
  avgScore: number;
  avgRr: number;
}

interface AdaptiveLearningInsight {
  key: string;
  title: string;
  summary: string;
  value: string;
  sub: string;
  accentClass: string;
}

const RUNNABLE_STRATEGY_VERSION_KEYS = new Set([
  "trend-alignment:v1",
  "trend-alignment:v2",
  "breakout:v1",
]);

const EXECUTION_BASE_TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

const EXECUTION_PROFILE_PRESETS = [
  {
    id: "calibration",
    label: "Calibración",
    description: "Abre el filtro para recoger muestra real sin perder controles duros.",
    values: {
      enabled: true,
      autoExecuteEnabled: false,
      minSignalScore: 30,
      minRrRatio: 0.25,
      maxDailyAutoExecutions: 2,
      cooldownAfterLosses: 4,
      allowedTimeframes: ["5m", "15m", "1h", "4h"],
      allowedStrategies: ["trend-alignment", "breakout"],
      note: "Perfil de calibración para recoger muestra y revisar qué filtros sí tienen edge real.",
    },
  },
  {
    id: "balanced",
    label: "Balanceado",
    description: "Busca flujo estable sin bajar demasiado la calidad de entrada.",
    values: {
      enabled: true,
      autoExecuteEnabled: true,
      minSignalScore: 45,
      minRrRatio: 0.5,
      maxDailyAutoExecutions: 3,
      cooldownAfterLosses: 3,
      allowedTimeframes: ["15m", "1h", "4h"],
      allowedStrategies: ["trend-alignment", "breakout"],
      note: "Perfil balanceado para operar demo con filtros medios y autoejecución contenida.",
    },
  },
  {
    id: "strict",
    label: "Estricto",
    description: "Solo deja pasar setups más limpios y contextos más lentos.",
    values: {
      enabled: true,
      autoExecuteEnabled: true,
      minSignalScore: 60,
      minRrRatio: 1.5,
      maxDailyAutoExecutions: 2,
      cooldownAfterLosses: 2,
      allowedTimeframes: ["1h", "4h"],
      allowedStrategies: ["trend-alignment"],
      note: "Perfil estricto orientado a setups más selectivos y menor ruido intradía.",
    },
  },
] as const;

function buildScannerStatusFromExecution(
  execution: WatchlistScanExecution,
  previousStatus: WatchlistScannerStatus | null,
): WatchlistScannerStatus {
  const now = new Date().toISOString();
  const firstTarget = execution.targets[0];
  return {
    username: previousStatus?.username || null,
    targets: execution.targets.map((item) => ({
      username: item.username,
      activeListName: item.activeListName,
      coinsCount: item.coinsCount,
      coins: previousStatus?.targets.find((target) => target.username === item.username)?.coins || [],
    })),
    latestRun: firstTarget
      ? {
          id: previousStatus?.latestRun?.id || -1,
          username: firstTarget.username,
          active_list_name: firstTarget.activeListName,
          scan_source: execution.mode,
          coins_count: firstTarget.coinsCount,
          frames_scanned: firstTarget.scannedFrames,
          signals_created: firstTarget.signalsCreated,
          signals_closed: firstTarget.signalsClosed,
          status: firstTarget.errors.length ? "partial" : "ok",
          errors: firstTarget.errors,
          created_at: now,
        }
      : previousStatus?.latestRun || null,
    runs: previousStatus?.runs || [],
    summary: {
      watchedUsers: execution.summary.users,
      watchedCoins: execution.targets.reduce((sum, item) => sum + item.coinsCount, 0),
    },
  };
}

export function MemoryView(props: MemoryViewProps) {
  const [activeTab, setActiveTab] = useState<SignalsTab>("overview");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "1d" | "7d" | "30d">("all");
  const [coinFilter, setCoinFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<SignalOutcomeStatus | "all">("all");
  const [timeframeFilter, setTimeframeFilter] = useState("all");
  const [setupFilter, setSetupFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [registry, setRegistry] = useState<StrategyRegistryEntry[]>([]);
  const [versions, setVersions] = useState<StrategyVersionRecord[]>([]);
  const [experiments, setExperiments] = useState<StrategyExperimentRecord[]>([]);
  const [recommendations, setRecommendations] = useState<StrategyRecommendationRecord[]>([]);
  const [experimentBase, setExperimentBase] = useState("trend-alignment");
  const [experimentCandidate, setExperimentCandidate] = useState("breakout");
  const [experimentVersion, setExperimentVersion] = useState("v1");
  const [experimentMarketScope, setExperimentMarketScope] = useState("all");
  const [experimentTimeframeScope, setExperimentTimeframeScope] = useState("all");
  const [experimentSummary, setExperimentSummary] = useState("");
  const [activatingRecommendationKey, setActivatingRecommendationKey] = useState("");
  const [promotingExperimentId, setPromotingExperimentId] = useState(0);
  const [scannerStatus, setScannerStatus] = useState<WatchlistScannerStatus | null>(null);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerNotice, setScannerNotice] = useState("");
  const [executionProfileForm, setExecutionProfileForm] = useState<ExecutionCenterPayload["profile"] | null>(null);
  const [scopeOverrideStrategy, setScopeOverrideStrategy] = useState("trend-alignment");
  const [scopeOverrideTimeframe, setScopeOverrideTimeframe] = useState("15m");
  const [scopeOverrideScore, setScopeOverrideScore] = useState("45");
  const [scopeOverrideRr, setScopeOverrideRr] = useState("0.5");
  const [scopeOverrideNote, setScopeOverrideNote] = useState("");
  const [executionBusy, setExecutionBusy] = useState(false);
  const [executionSaving, setExecutionSaving] = useState(false);
  const [experimentsPage, setExperimentsPage] = useState(1);
  const [sandboxPage, setSandboxPage] = useState(1);
  const [recommendationsPage, setRecommendationsPage] = useState(1);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [recentOrdersPage, setRecentOrdersPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const lastAutoScanAtRef = useRef(0);

  useEffect(() => {
    let ignore = false;

    void strategyEngineService.list()
      .then((payload) => {
        if (ignore) return;
        setRegistry(payload.registry || []);
        setVersions(payload.versions || []);
        setExperiments(payload.experiments || []);
        setRecommendations(payload.recommendations || []);
      })
      .catch(() => {
        if (ignore) return;
        setRegistry([]);
        setVersions([]);
        setExperiments([]);
        setRecommendations([]);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    void watchlistService.scanStatus()
      .then((payload) => {
        if (!ignore) setScannerStatus(payload);
      })
      .catch(() => {
        if (!ignore) setScannerStatus(null);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setExecutionProfileForm(props.executionCenter?.profile || null);
  }, [props.executionCenter]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void strategyEngineService.list()
        .then((payload) => {
          setRegistry(payload.registry || []);
          setVersions(payload.versions || []);
          setExperiments(payload.experiments || []);
          setRecommendations(payload.recommendations || []);
        })
        .catch(() => {
          // keep last known state to avoid flicker
        });
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void watchlistService.scanStatus()
        .then((payload) => {
          setScannerStatus(payload);
        })
        .catch(() => {
          // keep last known state to avoid flicker
        });
    }, 8_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const timeframes = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.timeframe))).sort(),
    [props.signals],
  );
  const setups = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.setup_type).filter((item): item is string => Boolean(item)))).sort(),
    [props.signals],
  );
  const coins = useMemo(
    () => Array.from(new Set(props.signals.map((item) => item.coin).filter(Boolean))).sort(),
    [props.signals],
  );
  const strategies = useMemo(
    () => Array.from(new Set(props.signals.map((item) => getStrategyDisplay(item)).filter(Boolean))).sort(),
    [props.signals],
  );

  const periodSignals = useMemo(() => {
    if (periodFilter === "all") return props.signals;
    const days = periodFilter === "30d" ? 30 : periodFilter === "7d" ? 7 : 1;
    const minDate = Date.now() - days * 24 * 60 * 60 * 1000;
    return props.signals.filter((item) => {
      const baseDate = item.outcome_status === "pending" ? item.created_at : (item.updated_at || item.created_at);
      return new Date(baseDate).getTime() >= minDate;
    });
  }, [periodFilter, props.signals]);

  const filteredSignals = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return periodSignals.filter((item) => {
      const matchesSearch = !normalizedSearch
        || item.coin.toLowerCase().includes(normalizedSearch)
        || (item.signal_label || "").toLowerCase().includes(normalizedSearch)
        || getSetupLabel(item.setup_type || "").toLowerCase().includes(normalizedSearch)
        || getStrategyDisplay(item).toLowerCase().includes(normalizedSearch)
        || (item.note || "").toLowerCase().includes(normalizedSearch);
      const matchesCoin = coinFilter === "all" || item.coin === coinFilter;
      const matchesStatus = statusFilter === "all" || item.outcome_status === statusFilter;
      const matchesTimeframe = timeframeFilter === "all" || item.timeframe === timeframeFilter;
      const matchesSetup = setupFilter === "all" || (item.setup_type || "") === setupFilter;
      const matchesStrategy = strategyFilter === "all" || getStrategyDisplay(item) === strategyFilter;
      return matchesSearch && matchesCoin && matchesStatus && matchesTimeframe && matchesSetup && matchesStrategy;
    });
  }, [coinFilter, periodSignals, search, setupFilter, statusFilter, strategyFilter, timeframeFilter]);

  const completedSignals = props.signals.filter((item) => item.outcome_status !== "pending");
  const wins = props.signals.filter((item) => item.outcome_status === "win").length;
  const losses = props.signals.filter((item) => item.outcome_status === "loss").length;
  const invalidated = props.signals.filter((item) => item.outcome_status === "invalidated").length;
  const totalPnl = props.signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const winRate = completedSignals.length ? (wins / completedSignals.length) * 100 : 0;

  const periodCompletedSignals = periodSignals.filter((item) => item.outcome_status !== "pending");
  const periodWins = periodSignals.filter((item) => item.outcome_status === "win").length;
  const periodLosses = periodSignals.filter((item) => item.outcome_status === "loss").length;
  const periodInvalidated = periodSignals.filter((item) => item.outcome_status === "invalidated").length;
  const periodPending = periodSignals.filter((item) => item.outcome_status === "pending").length;
  const periodGrossWins = periodSignals
    .filter((item) => Number(item.outcome_pnl || 0) > 0)
    .reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const periodGrossLosses = periodSignals
    .filter((item) => Number(item.outcome_pnl || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.outcome_pnl || 0)), 0);
  const periodAvgWin = periodSignals.filter((item) => Number(item.outcome_pnl || 0) > 0).length
    ? periodGrossWins / periodSignals.filter((item) => Number(item.outcome_pnl || 0) > 0).length
    : 0;
  const periodAvgLoss = periodSignals.filter((item) => Number(item.outcome_pnl || 0) < 0).length
    ? periodGrossLosses / periodSignals.filter((item) => Number(item.outcome_pnl || 0) < 0).length
    : 0;

  const periodLabel = periodFilter === "30d"
    ? "últimos 30 días"
    : periodFilter === "7d"
      ? "últimos 7 días"
      : periodFilter === "1d"
        ? "últimas 24h"
        : "todo el historial";

  const bestSetup = useMemo(() => {
    const bySetup = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      if (!item.setup_type || item.outcome_status === "pending") return;
      const bucket = bySetup.get(item.setup_type) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      bySetup.set(item.setup_type, bucket);
    });
    return Array.from(bySetup.entries())
      .map(([setup, stats]) => ({ setup, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);

  const bestContext = useMemo(() => {
    const byContext = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      const signature = item.signal_payload?.context?.contextSignature;
      if (!signature || item.outcome_status === "pending") return;
      const bucket = byContext.get(signature) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      byContext.set(signature, bucket);
    });
    return Array.from(byContext.entries())
      .map(([signature, stats]) => ({ signature, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);

  const strongestTimeframe = useMemo(() => {
    const byTimeframe = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      if (item.outcome_status === "pending") return;
      const bucket = byTimeframe.get(item.timeframe) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      byTimeframe.set(item.timeframe, bucket);
    });
    return Array.from(byTimeframe.entries())
      .map(([timeframe, stats]) => ({ timeframe, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);

  const strongestStrategy = useMemo(() => {
    const byStrategy = new Map<string, { wins: number; total: number }>();
    props.signals.forEach((item) => {
      if (item.outcome_status === "pending") return;
      const key = getStrategyDisplay(item);
      const bucket = byStrategy.get(key) || { wins: 0, total: 0 };
      bucket.total += 1;
      if (item.outcome_status === "win") bucket.wins += 1;
      byStrategy.set(key, bucket);
    });
    return Array.from(byStrategy.entries())
      .map(([strategy, stats]) => ({ strategy, rate: stats.total ? (stats.wins / stats.total) * 100 : 0, total: stats.total }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total)[0];
  }, [props.signals]);

  const periodAnalytics = useMemo(() => {
    const closed = periodSignals.filter((item) => item.outcome_status !== "pending");
    const byCoin = summarizeByKey(closed, (item) => item.coin);
    const bySetup = summarizeByKey(closed, (item) => getSetupLabel(item.setup_type || "Sin setup"));
    const byTimeframe = summarizeByKey(closed, (item) => item.timeframe);
    const byStrategy = summarizeByKey(closed, (item) => getStrategyDisplay(item));
    const byContext = summarizeByKey(closed, (item) => item.signal_payload?.context?.contextSignature || "Contexto no clasificado");

    return {
      bestCoin: byCoin[0],
      worstCoin: [...byCoin].sort((a, b) => a.pnl - b.pnl || a.winRate - b.winRate)[0],
      bestSetupPnl: bySetup[0],
      bestTimeframePnl: byTimeframe[0],
      bestStrategyPnl: byStrategy[0],
      topCoins: byCoin.slice(0, 3),
      topSetups: bySetup.slice(0, 3),
      topTimeframes: byTimeframe.slice(0, 3),
      topStrategies: byStrategy.slice(0, 3),
      topContexts: byContext.slice(0, 3),
    };
  }, [periodSignals]);

  const strategyPrimaryCounts = useMemo(() => {
    const counters = new Map<string, number>();
    periodSignals.forEach((item) => {
      const key = getStrategyDisplay(item);
      counters.set(key, (counters.get(key) || 0) + 1);
    });
    return Array.from(counters.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
  }, [periodSignals]);

  const strategyCandidateCounts = useMemo(() => {
    const counters = new Map<string, number>();
    periodSignals.forEach((item) => {
      (item.signal_payload?.candidates || []).forEach((candidate) => {
        const label = getStrategyCandidateLabel(candidate.strategy?.id, candidate.strategy?.version, candidate.strategy?.label);
        counters.set(label, (counters.get(label) || 0) + 1);
      });
    });
    return Array.from(counters.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
  }, [periodSignals]);

  const strongestAlternative = useMemo(() => {
    if (!strategyCandidateCounts.length) return undefined;
    return strategyCandidateCounts.find((item) => item.label !== strategyPrimaryCounts[0]?.label) || strategyCandidateCounts[0];
  }, [strategyCandidateCounts, strategyPrimaryCounts]);

  const trendVersionComparison = useMemo(() => {
    const closed = periodSignals.filter((item) => item.outcome_status !== "pending"
      && (item.strategy_name === "trend-alignment" || item.signal_payload?.strategy?.id === "trend-alignment"));
    const byVersion = summarizeByKey(closed, (item) => getStrategyCandidateLabel("trend-alignment", item.strategy_version || item.signal_payload?.strategy?.version, "Trend Alignment"));
    return {
      v1: byVersion.find((item) => item.label === "Tendencia alineada v1"),
      v2: byVersion.find((item) => item.label === "Tendencia alineada v2"),
    };
  }, [periodSignals]);

  const trendPromotionRecommendation = useMemo(
    () => evaluatePromotion(trendVersionComparison.v1, trendVersionComparison.v2),
    [trendVersionComparison.v1, trendVersionComparison.v2],
  );

  const recommendedExperiment = useMemo(
    () => experiments.find((item) => item.base_strategy_id === "trend-alignment"
      && item.candidate_strategy_id === "trend-alignment"
      && item.candidate_version === "v2"),
    [experiments],
  );

  const sandboxExperiments = useMemo(
    () => experiments.filter((item) => item.status === "sandbox"),
    [experiments],
  );

  const sandboxStats = useMemo(
    () => sandboxExperiments.map((item) => buildExperimentPaperStats(item, periodSignals, props.watchlist)),
    [periodSignals, props.watchlist, sandboxExperiments],
  );

  const pagedExperiments = useMemo(() => paginateRows(experiments, experimentsPage), [experiments, experimentsPage]);
  const pagedSandboxStats = useMemo(() => paginateRows(sandboxStats, sandboxPage), [sandboxStats, sandboxPage]);
  const pagedRecommendations = useMemo(() => paginateRows(recommendations, recommendationsPage), [recommendations, recommendationsPage]);
  const pagedCandidates = useMemo(() => paginateRows(props.executionCenter?.candidates || [], candidatesPage), [candidatesPage, props.executionCenter?.candidates]);
  const pagedRecentOrders = useMemo(() => paginateRows(props.executionCenter?.recentOrders || [], recentOrdersPage), [props.executionCenter?.recentOrders, recentOrdersPage]);
  const pagedSignals = useMemo(() => paginateRows(filteredSignals, historyPage), [filteredSignals, historyPage]);
  const openSignals = useMemo(
    () => props.signals.filter((item) => item.outcome_status === "pending"),
    [props.signals],
  );
  const operationalOpenSignals = useMemo(
    () => openSignals.filter((item) => item.signal_payload?.decision?.executionEligible === true),
    [openSignals],
  );
  const observationOpenSignals = useMemo(
    () => openSignals.filter((item) => item.signal_payload?.decision?.executionEligible === false),
    [openSignals],
  );
  const eligibleExecutionCandidates = useMemo(
    () => (props.executionCenter?.candidates || []).filter((item) => item.status === "eligible"),
    [props.executionCenter?.candidates],
  );
  const blockedExecutionCandidates = useMemo(
    () => (props.executionCenter?.candidates || []).filter((item) => item.status === "blocked"),
    [props.executionCenter?.candidates],
  );
  const executionPlacedOrders = useMemo(
    () => (props.executionCenter?.recentOrders || []).filter((item) => item.mode === "execute" && item.status === "placed"),
    [props.executionCenter?.recentOrders],
  );
  const topBlockedReason = useMemo(() => {
    const counts = new Map<string, number>();
    blockedExecutionCandidates.forEach((item) => {
      const reason = item.reasons?.[0] || "Bloqueada por reglas del perfil";
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [blockedExecutionCandidates]);
  const executionFunnelSteps = useMemo(() => ([
    {
      label: "Detectadas abiertas",
      value: openSignals.length,
      sub: "Señales pendientes en memoria",
      accentClass: "accent-blue",
    },
    {
      label: "Motor operativo",
      value: operationalOpenSignals.length,
      sub: `${observationOpenSignals.length} quedan solo en observación`,
      accentClass: "accent-emerald",
    },
    {
      label: "Listas para demo",
      value: eligibleExecutionCandidates.length,
      sub: "Cumplen perfil de riesgo y ejecución",
      accentClass: "accent-green",
    },
    {
      label: "Bloqueadas por filtro",
      value: blockedExecutionCandidates.length,
      sub: topBlockedReason || "Sin bloqueos en este momento",
      accentClass: "accent-amber",
    },
    {
      label: "Ya enviadas",
      value: executionPlacedOrders.length,
      sub: "Órdenes demo lanzadas recientemente",
      accentClass: "accent-blue",
    },
  ]), [
    blockedExecutionCandidates.length,
    eligibleExecutionCandidates.length,
    executionPlacedOrders.length,
    observationOpenSignals.length,
    openSignals.length,
    operationalOpenSignals.length,
    topBlockedReason,
  ]);
  const closedSignals = useMemo(
    () => props.signals.filter((item) => item.outcome_status !== "pending"),
    [props.signals],
  );
  const executedClosedSignals = useMemo(
    () => closedSignals.filter((item) => item.execution_mode === "execute" || Boolean(item.execution_order_id)),
    [closedSignals],
  );
  const operationalClosedSignals = useMemo(
    () => closedSignals.filter((item) => item.signal_payload?.decision?.executionEligible === true),
    [closedSignals],
  );
  const skippedOperationalClosedSignals = useMemo(
    () => operationalClosedSignals.filter((item) => item.execution_mode !== "execute" && !item.execution_order_id),
    [operationalClosedSignals],
  );
  const blockedOrObservationClosedSignals = useMemo(
    () => closedSignals.filter((item) => item.signal_payload?.decision?.executionEligible === false),
    [closedSignals],
  );
  const executedClosedStats = useMemo(() => summarizeSignalCohort(executedClosedSignals), [executedClosedSignals]);
  const skippedOperationalStats = useMemo(() => summarizeSignalCohort(skippedOperationalClosedSignals), [skippedOperationalClosedSignals]);
  const blockedObservationStats = useMemo(() => summarizeSignalCohort(blockedOrObservationClosedSignals), [blockedOrObservationClosedSignals]);
  const eligibleOpenStats = useMemo(() => summarizeCandidateCohort(eligibleExecutionCandidates), [eligibleExecutionCandidates]);
  const blockedOpenStats = useMemo(() => summarizeCandidateCohort(blockedExecutionCandidates), [blockedExecutionCandidates]);
  const executionAuditInsight = useMemo(() => {
    if (skippedOperationalStats.total >= 5 && skippedOperationalStats.avgPnl > executedClosedStats.avgPnl) {
      return `Las operativas no ejecutadas están dejando ${formatSignedPrice(skippedOperationalStats.avgPnl)} por señal frente a ${formatSignedPrice(executedClosedStats.avgPnl)} en las ejecutadas. El filtro actual podría estar dejando ventaja fuera.`;
    }
    if (executedClosedStats.total >= 5 && executedClosedStats.avgPnl > skippedOperationalStats.avgPnl) {
      return `Las señales que sí llegan a demo están dejando mejor promedio (${formatSignedPrice(executedClosedStats.avgPnl)}) que las operativas no ejecutadas (${formatSignedPrice(skippedOperationalStats.avgPnl)}).`;
    }
    if (blockedObservationStats.total >= 5 && blockedObservationStats.winRate > executedClosedStats.winRate) {
      return `Las señales fuera de demo están ganando ${blockedObservationStats.winRate.toFixed(0)}% frente a ${executedClosedStats.winRate.toFixed(0)}% en demo. Conviene revisar si el filtro está demasiado rígido.`;
    }
    return "Todavía hace falta más muestra comparativa para decidir si demo está filtrando mejor o si está dejando fuera parte del edge.";
  }, [blockedObservationStats, executedClosedStats, skippedOperationalStats]);

  const adaptiveInsights = useMemo<AdaptiveLearningInsight[]>(() => {
    const insights: AdaptiveLearningInsight[] = [];

    if (strongestStrategy && strongestStrategy.total >= 4) {
      insights.push({
        key: "best-strategy",
        title: "Estrategia que más sostiene el resultado",
        summary: `${strongestStrategy.strategy} está dejando la lectura más consistente del periodo actual.`,
        value: strongestStrategy.strategy,
        sub: `${strongestStrategy.rate.toFixed(0)}% de acierto en ${strongestStrategy.total} cierres`,
        accentClass: "accent-emerald",
      });
    }

    if (strongestTimeframe && strongestTimeframe.total >= 4) {
      insights.push({
        key: "best-timeframe",
        title: "Marco con mejor respuesta real",
        summary: `El sistema está viendo mejor comportamiento en ${strongestTimeframe.timeframe}.`,
        value: strongestTimeframe.timeframe,
        sub: `${strongestTimeframe.rate.toFixed(0)}% de acierto en ${strongestTimeframe.total} cierres`,
        accentClass: "accent-blue",
      });
    }

    if (bestSetup && bestSetup.total >= 4) {
      insights.push({
        key: "best-setup",
        title: "Tipo de entrada más limpio",
        summary: `${getSetupLabel(bestSetup.setup)} es el setup que mejor está resistiendo en cierres reales.`,
        value: getSetupLabel(bestSetup.setup),
        sub: `${bestSetup.rate.toFixed(0)}% de efectividad en ${bestSetup.total} señales`,
        accentClass: "accent-amber",
      });
    }

    if (executedClosedStats.total >= 5 && skippedOperationalStats.total >= 5) {
      const demoBeatsSkipped = executedClosedStats.avgPnl > skippedOperationalStats.avgPnl;
      insights.push({
        key: "demo-vs-omitted",
        title: demoBeatsSkipped ? "Demo sí está filtrando mejor" : "Demo está dejando edge fuera",
        summary: demoBeatsSkipped
          ? "Las señales ejecutadas en demo están dejando mejor promedio que las operativas que se quedaron fuera."
          : "Las operativas omitidas están dejando mejor promedio que las que sí llegaron a demo.",
        value: demoBeatsSkipped ? formatSignedPrice(executedClosedStats.avgPnl) : formatSignedPrice(skippedOperationalStats.avgPnl),
        sub: demoBeatsSkipped
          ? `Demo ${formatSignedPrice(executedClosedStats.avgPnl)} vs omitidas ${formatSignedPrice(skippedOperationalStats.avgPnl)}`
          : `Omitidas ${formatSignedPrice(skippedOperationalStats.avgPnl)} vs demo ${formatSignedPrice(executedClosedStats.avgPnl)}`,
        accentClass: demoBeatsSkipped ? "accent-emerald" : "accent-amber",
      });
    }

    if (blockedObservationStats.total >= 5 && executedClosedStats.total >= 5) {
      const outsideBeatsDemo = blockedObservationStats.winRate > executedClosedStats.winRate;
      insights.push({
        key: "outside-demo-cohort",
        title: outsideBeatsDemo ? "Fuera de demo hay cohortes fuertes" : "Fuera de demo sigue viéndose más débil",
        summary: outsideBeatsDemo
          ? "Las señales fuera del flujo demo están ganando más que la cohorte ejecutada. Conviene revisar el perfil."
          : "Las señales que no llegan a demo todavía no muestran una ventaja mejor que la cohorte ejecutada.",
        value: `${outsideBeatsDemo ? blockedObservationStats.winRate : executedClosedStats.winRate.toFixed(0)}%`,
        sub: outsideBeatsDemo
          ? `Fuera de demo ${blockedObservationStats.winRate.toFixed(0)}% vs demo ${executedClosedStats.winRate.toFixed(0)}%`
          : `Demo ${executedClosedStats.winRate.toFixed(0)}% vs fuera ${blockedObservationStats.winRate.toFixed(0)}%`,
        accentClass: outsideBeatsDemo ? "accent-amber" : "accent-blue",
      });
    }

    if (!insights.length && closedSignals.length) {
      insights.push({
        key: "gathering-sample",
        title: "Todavía juntando evidencia útil",
        summary: "El sistema ya está leyendo cierres reales, pero aún no detecta un patrón lo bastante fuerte para convertirlo en ajuste concreto.",
        value: String(closedSignals.length),
        sub: "cierres reales observados",
        accentClass: "accent-blue",
      });
    }

    return insights.slice(0, 4);
  }, [
    bestSetup,
    blockedObservationStats,
    closedSignals.length,
    executedClosedStats,
    skippedOperationalStats,
    strongestStrategy,
    strongestTimeframe,
  ]);

  const executionOverrideImpact = useMemo(() => {
    return (executionProfileForm?.scopeOverrides || []).map((override) => {
      const closedScopedSignals = closedSignals.filter((item) =>
        item.strategy_name === override.strategyId && item.timeframe === override.timeframe,
      );
      const candidateScopedSignals = (props.executionCenter?.candidates || []).filter((item) =>
        item.strategyName === override.strategyId && item.timeframe === override.timeframe,
      );
      const eligibleScoped = candidateScopedSignals.filter((item) => item.status === "eligible");
      const blockedScoped = candidateScopedSignals.filter((item) => item.status === "blocked");
      const stats = summarizeSignalCohort(closedScopedSignals);
      const currentScore = override.minSignalScore ?? executionProfileForm?.minSignalScore ?? 0;
      const currentRr = override.minRrRatio ?? executionProfileForm?.minRrRatio ?? 0;
      let reading = "Todavía hace falta más muestra para saber si este scope está ayudando.";
      let accentClass = "accent-blue";

      if (stats.total >= 5) {
        if (stats.avgPnl > 0 && stats.winRate >= 55) {
          reading = "Este scope viene sosteniendo resultado positivo y parece aguantar un filtro más abierto o estable.";
          accentClass = "accent-emerald";
        } else if (stats.avgPnl < 0 || stats.winRate < 45) {
          reading = "Este scope sigue flojo aun con override. Conviene endurecerlo más o incluso sacarlo del flujo demo.";
          accentClass = "accent-amber";
        } else {
          reading = "El scope está mixto: no está roto, pero todavía no demuestra una ventaja clara.";
          accentClass = "accent-blue";
        }
      }

      return {
        key: `${override.strategyId}-${override.timeframe}`,
        strategyId: override.strategyId,
        timeframe: override.timeframe,
        score: currentScore,
        rr: currentRr,
        note: override.note || "",
        closedTotal: stats.total,
        winRate: stats.winRate,
        pnl: stats.pnl,
        avgPnl: stats.avgPnl,
        eligibleCount: eligibleScoped.length,
        blockedCount: blockedScoped.length,
        reading,
        accentClass,
      };
    });
  }, [
    closedSignals,
    executionProfileForm?.minRrRatio,
    executionProfileForm?.minSignalScore,
    executionProfileForm?.scopeOverrides,
    props.executionCenter?.candidates,
  ]);

  useEffect(() => setExperimentsPage(1), [experiments.length]);
  useEffect(() => setSandboxPage(1), [sandboxStats.length]);
  useEffect(() => setRecommendationsPage(1), [recommendations.length]);
  useEffect(() => setCandidatesPage(1), [props.executionCenter?.candidates?.length]);
  useEffect(() => setRecentOrdersPage(1), [props.executionCenter?.recentOrders?.length]);
  useEffect(() => setHistoryPage(1), [filteredSignals.length, periodFilter, coinFilter, statusFilter, timeframeFilter, setupFilter, strategyFilter, search]);

  const availableCandidateVersions = useMemo(
    () => versions.filter((item) => item.strategy_id === experimentCandidate),
    [experimentCandidate, versions],
  );

  const executionStrategyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    registry.forEach((item) => {
      if (!byId.has(item.strategy_id)) byId.set(item.strategy_id, item.label || item.strategy_id);
    });
    props.signals.forEach((item) => {
      if (!item.strategy_name) return;
      if (!byId.has(item.strategy_name)) byId.set(item.strategy_name, item.strategy_label || item.strategy_name);
    });
    return Array.from(byId.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [props.signals, registry]);

  const executionTimeframeOptions = useMemo(
    () => Array.from(new Set([...EXECUTION_BASE_TIMEFRAMES, ...timeframes, ...(executionProfileForm?.allowedTimeframes || [])])),
    [executionProfileForm?.allowedTimeframes, timeframes],
  );

  const executionScopeOverrides = executionProfileForm?.scopeOverrides || [];

  const activeExecutionPreset = useMemo(() => {
    if (!executionProfileForm) return "";
    return EXECUTION_PROFILE_PRESETS.find((preset) => (
      preset.values.autoExecuteEnabled === executionProfileForm.autoExecuteEnabled
      && preset.values.minSignalScore === executionProfileForm.minSignalScore
      && Math.abs(preset.values.minRrRatio - executionProfileForm.minRrRatio) < 0.001
      && preset.values.maxDailyAutoExecutions === executionProfileForm.maxDailyAutoExecutions
      && preset.values.cooldownAfterLosses === executionProfileForm.cooldownAfterLosses
      && sameSet(preset.values.allowedTimeframes, executionProfileForm.allowedTimeframes)
      && sameSet(preset.values.allowedStrategies, executionProfileForm.allowedStrategies)
    ))?.id || "";
  }, [executionProfileForm]);

  useEffect(() => {
    if (!availableCandidateVersions.length) return;
    if (!availableCandidateVersions.some((item) => item.version === experimentVersion)) {
      setExperimentVersion(availableCandidateVersions[0].version);
    }
  }, [availableCandidateVersions, experimentVersion]);

  async function handleCreateExperiment() {
    try {
      const payload = await strategyEngineService.createExperiment({
        baseStrategyId: experimentBase,
        candidateStrategyId: experimentCandidate,
        candidateVersion: experimentVersion,
        marketScope: experimentMarketScope,
        timeframeScope: experimentTimeframeScope,
        summary: experimentSummary,
      });
      setExperiments((current) => [payload.experiment, ...current]);
      setExperimentSummary("");
    } catch {
      // keep UI steady if API fails
    }
  }

  async function handleCreateRecommendedExperiment() {
    try {
      const payload = await strategyEngineService.createExperiment({
        baseStrategyId: "trend-alignment",
        candidateStrategyId: "trend-alignment",
        candidateVersion: "v2",
        marketScope: "watchlist",
        timeframeScope: getPreferredTimeframeScopeForVersion(
          versions.find((item) => item.strategy_id === "trend-alignment" && item.version === "v2"),
        ),
        summary: `Comparar Tendencia alineada v1 vs v2 en watchlist con recomendación actual: ${trendPromotionRecommendation.title}.`,
        status: "draft",
        metadata: {
          recommendationStatus: trendPromotionRecommendation.statusLabel,
          recommendationClass: trendPromotionRecommendation.statusClass,
          recommendationReason: trendPromotionRecommendation.reason,
        },
      });
      setExperiments((current) => [payload.experiment, ...current.filter((item) => item.id !== payload.experiment.id)]);
    } catch {
      // keep UI steady if API fails
    }
  }

  async function handleSendRecommendedToSandbox() {
    if (!recommendedExperiment) return;
    try {
      const payload = await strategyEngineService.updateExperiment(recommendedExperiment.id, {
        status: "sandbox",
        metadata: {
          ...(recommendedExperiment.metadata || {}),
          recommendationStatus: trendPromotionRecommendation.statusLabel,
          recommendationClass: trendPromotionRecommendation.statusClass,
          recommendationReason: trendPromotionRecommendation.reason,
          promotedAt: new Date().toISOString(),
        },
      });
      setExperiments((current) => current.map((item) => (item.id === payload.experiment.id ? payload.experiment : item)));
    } catch {
      // keep UI steady if API fails
    }
  }

  async function handleGenerateRecommendations() {
    try {
      const payload = await strategyEngineService.generateRecommendations();
      setRecommendations(payload.recommendations || []);
    } catch {
      // keep UI steady if API fails
    }
  }

  async function handleActivateRecommendation(item: StrategyRecommendationRecord) {
    setActivatingRecommendationKey(item.recommendation_key);
    try {
      const payload: RecommendationActivationResult = await strategyEngineService.activateRecommendation(item.id);
      setRecommendations((current) =>
        current.map((entry) => (entry.id === payload.recommendation.id ? payload.recommendation : entry)),
      );
      if (payload.version) {
        setVersions((current) => {
          const exists = current.some(
            (entry) => entry.strategy_id === payload.version?.strategy_id && entry.version === payload.version?.version,
          );
          return exists ? current : [...current, payload.version as typeof current[number]];
        });
      }
      if (payload.experiment) {
        setExperiments((current) => {
          const exists = current.some((entry) => entry.id === payload.experiment?.id);
          return exists
            ? current.map((entry) => (entry.id === payload.experiment?.id ? payload.experiment as typeof entry : entry))
            : [payload.experiment as typeof current[number], ...current];
        });
      }
      if (payload.profile) {
        setExecutionProfileForm(payload.profile);
        await props.onRefreshExecutionCenter();
      }
    } catch {
      // keep UI steady if API fails
    } finally {
      setActivatingRecommendationKey("");
    }
  }

  async function handlePromoteExperiment(item: ExperimentPaperStats) {
    if (!item.canPromote || promotingExperimentId) return;
    setPromotingExperimentId(item.experiment.id);
    const loaderId = startLoading({
      label: "Promoviendo estrategia",
      detail: "Actualizando el motor activo para que watcher y demo usen la variante ganadora.",
    });
    try {
      const payload = await strategyEngineService.promoteExperiment(item.experiment.id);
      setExperiments((current) => current.map((entry) => (entry.id === payload.experiment.id ? payload.experiment : entry)));
      const refreshed = await strategyEngineService.list();
      setRegistry(refreshed.registry || []);
      setVersions(refreshed.versions || []);
      setExperiments(refreshed.experiments || []);
      setRecommendations(refreshed.recommendations || []);
      showToast({
        tone: "success",
        title: "Motor promovido",
        message: `${item.candidateLabel} ya quedó como estrategia operativa para el flujo aplicable.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo promover",
        message: error instanceof Error ? error.message : "No se pudo promover la estrategia candidata.",
      });
    } finally {
      setPromotingExperimentId(0);
      stopLoading(loaderId);
    }
  }

  const handleRunScanner = useCallback(async (options?: { silent?: boolean; source?: "manual" | "auto" }) => {
    const silent = options?.silent ?? false;
    const source = options?.source || "manual";
    setScannerBusy(true);
    const loaderId = startLoading({
      label: source === "auto" ? "Vigilante en vivo" : "Revisando watchlist",
      detail: source === "auto"
        ? "Sincronizando la watchlist en segundo plano."
        : "Escaneando monedas, marcos y reglas de automatización.",
    });
    try {
      const execution = await watchlistService.runScan();
      const refreshed = await watchlistService.scanStatus().catch(() => null);
      setScannerStatus(refreshed || buildScannerStatusFromExecution(execution, scannerStatus));
      const errorMessage = execution.summary.runPersistErrors?.[0]
        || execution.targets.find((item) => item.runPersistError)?.runPersistError
        || "";
      const successSummary = [
        `${execution.summary.signalsCreated} señales creadas`,
        `${execution.summary.autoOrdersPlaced || 0} órdenes demo automáticas`,
        `${execution.summary.autoOrdersBlocked || 0} bloqueadas`,
      ].join(" · ");
      setScannerNotice(errorMessage || `Vigilante ejecutado correctamente. ${successSummary}.`);
      if (errorMessage) {
        if (!silent) {
          showToast({
            tone: "error",
            title: "Escaneo parcial",
            message: `El vigilante sí escaneó, pero no pudo guardar todo el resumen: ${errorMessage}`,
          });
        }
      } else {
        if (!silent) {
          showToast({
            tone: "success",
            title: "Vigilante actualizado",
            message: `Se crearon ${execution.summary.signalsCreated} señales y ${execution.summary.autoOrdersPlaced || 0} órdenes demo automáticas.`,
          });
        }
      }
    } catch (error) {
      if (!silent) {
        setScannerNotice("No se pudo ejecutar el vigilante ahora mismo.");
        showToast({
          tone: "error",
          title: "No se pudo revisar ahora",
          message: error instanceof Error ? error.message : "No se pudo ejecutar el vigilante ahora mismo.",
        });
      }
    } finally {
      setScannerBusy(false);
      stopLoading(loaderId);
    }
  }, [scannerStatus]);

  useEffect(() => {
    if (scannerBusy || document.visibilityState === "hidden") return;
    if (!scannerStatus?.targets?.length) return;

    const maybeRunAutoScan = () => {
      if (document.visibilityState === "hidden") return;
      if (scannerBusy) return;
      if (!scannerStatus?.targets?.length) return;

      const latestRunAt = scannerStatus.latestRun?.created_at
        ? new Date(scannerStatus.latestRun.created_at).getTime()
        : 0;
      const ageMs = latestRunAt ? Date.now() - latestRunAt : Number.POSITIVE_INFINITY;
      const autoCadenceMs = 60_000;
      if (ageMs < autoCadenceMs) return;
      if (Date.now() - lastAutoScanAtRef.current < autoCadenceMs) return;

      lastAutoScanAtRef.current = Date.now();
      void handleRunScanner({ silent: true, source: "auto" });
    };

    maybeRunAutoScan();
    const intervalId = window.setInterval(maybeRunAutoScan, 15_000);
    return () => window.clearInterval(intervalId);
  }, [handleRunScanner, scannerBusy, scannerStatus]);

  async function handleSaveExecutionProfile() {
    if (!executionProfileForm) return;
    setExecutionSaving(true);
    const loaderId = startLoading({
      label: "Guardando perfil de ejecución",
      detail: "Actualizando límites y reglas del motor demo.",
    });
    try {
      const payload = await binanceService.updateExecutionProfile(executionProfileForm);
      setExecutionProfileForm(payload.profile);
      await props.onRefreshExecutionCenter();
      showToast({
        tone: "success",
        title: "Perfil actualizado",
        message: "Las reglas de ejecución demo ya quedaron guardadas.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar el perfil",
        message: error instanceof Error ? error.message : "No se pudo guardar el perfil de ejecución.",
      });
    } finally {
      setExecutionSaving(false);
      stopLoading(loaderId);
    }
  }

  async function handleRunExecution(signalId: number, mode: "preview" | "execute") {
    setExecutionBusy(true);
    const loaderId = startLoading({
      label: mode === "execute" ? "Enviando orden demo" : "Preparando trade",
      detail: mode === "execute" ? "Aplicando reglas, protección y envío a Binance Demo." : "Validando la señal antes de enviarla.",
    });
    try {
      const payload = await binanceService.executeSignal(signalId, mode) as {
        candidate?: { status?: string; reasons?: string[] };
        protection?: {
          protectionAttached?: boolean;
          protectionNote?: string;
        };
      };
      await props.onRefreshExecutionCenter();
      showToast({
        tone: "success",
        title: mode === "execute" ? "Trade demo enviado" : "Trade preparado",
        message: mode === "execute"
          ? payload?.protection?.protectionAttached
            ? "Orden Demo enviada con protección TP/SL."
            : payload?.protection?.protectionNote || "Orden Demo enviada, pero revisa si quedó protegida."
          : "Trade candidato preparado correctamente para revisión.",
      });
      if (payload?.candidate?.status === "blocked") {
        showToast({
          tone: "error",
          title: "Trade bloqueado",
          message: payload.candidate.reasons?.[0] || "La señal quedó bloqueada por reglas de riesgo.",
        });
      }
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo ejecutar",
        message: error instanceof Error ? error.message : "No se pudo procesar la ejecución demo.",
      });
    } finally {
      setExecutionBusy(false);
      stopLoading(loaderId);
    }
  }

  function handleApplyExecutionPreset(presetId: string) {
    const preset = EXECUTION_PROFILE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setExecutionProfileForm((current) => current ? {
      ...current,
      ...preset.values,
      allowedStrategies: [...preset.values.allowedStrategies],
      allowedTimeframes: [...preset.values.allowedTimeframes],
    } : current);
  }

  function handleToggleExecutionSelection(
    field: "allowedStrategies" | "allowedTimeframes",
    value: string,
  ) {
    setExecutionProfileForm((current) => {
      if (!current) return current;
      const nextValues = current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value];
      return {
        ...current,
        [field]: nextValues,
      };
    });
  }

  function handleAddScopeOverride() {
    if (!executionProfileForm) return;
    const nextOverride: ExecutionScopeOverride = {
      id: `${scopeOverrideStrategy}-${scopeOverrideTimeframe}`,
      strategyId: scopeOverrideStrategy,
      timeframe: scopeOverrideTimeframe,
      enabled: true,
      minSignalScore: Number(scopeOverrideScore || executionProfileForm.minSignalScore),
      minRrRatio: Number(scopeOverrideRr || executionProfileForm.minRrRatio),
      note: scopeOverrideNote.trim(),
    };

    setExecutionProfileForm((current) => {
      if (!current) return current;
      const withoutCurrent = (current.scopeOverrides || []).filter((item) => !(item.strategyId === nextOverride.strategyId && item.timeframe === nextOverride.timeframe));
      return {
        ...current,
        scopeOverrides: [...withoutCurrent, nextOverride],
      };
    });
    setScopeOverrideNote("");
  }

  function handleRemoveScopeOverride(override: ExecutionScopeOverride) {
    setExecutionProfileForm((current) => current ? {
      ...current,
      scopeOverrides: (current.scopeOverrides || []).filter((item) => item.id !== override.id),
    } : current);
  }

  return (
    <div id="memoryView" className="view-panel active">
      <section id="signals-overview">
        <SectionCard
          title="Centro de señales"
          subtitle="Este es el corazón del sistema. Aquí ves qué detectó el sistema, qué sigue abierto, qué está aprendiendo la IA y qué puedes controlar tú manualmente."
          helpTitle="Como leer el centro de señales"
          helpBody="Aqui conviven todas las capas operativas del sistema: seguimiento de señales, aprendizaje, automatizacion y ejecucion demo."
          helpBullets={[
            "Resumen te da la foto rapida del sistema y del vigilante.",
            "Resultados y Motor te ayudan a entender que esta funcionando.",
            "IA, Automatizacion y Ejecucion demo muestran las capas avanzadas antes de produccion.",
          ]}
        />
      </section>

      <ModuleTabs
        items={[
          { key: "overview", label: "Resumen" },
          { key: "performance", label: "Resultados" },
          { key: "strategies", label: "Motor" },
          { key: "adaptive", label: "IA que aprende" },
          { key: "experiments", label: "Automatización" },
          { key: "execution", label: "Ejecución demo" },
          { key: "history", label: "Historial" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as SignalsTab)}
      />

      {activeTab === "overview" ? (
        <>
          <div className="stats-grid">
            <StatCard label="Señales guardadas" value={String(props.signals.length)} sub="Historial técnico registrado" accentClass="accent-blue" />
            <StatCard label="Porcentaje de acierto" value={`${winRate.toFixed(0)}%`} sub={`${wins} ganadas de ${completedSignals.length} cerradas`} accentClass="accent-green" />
            <StatCard label="Resultado neto" value={formatPrice(totalPnl)} sub={`${losses} pérdidas · ${invalidated} invalidadas`} toneClass={totalPnl > 0 ? "portfolio-positive" : totalPnl < 0 ? "portfolio-negative" : ""} accentClass="accent-emerald" />
            <StatCard label="Abiertas" value={String(props.signals.filter((item) => item.outcome_status === "pending").length)} sub="Señales todavía activas" accentClass="accent-amber" />
          </div>

          <SectionCard
            title="Vigilante del mercado"
            subtitle="Este módulo vigila tu watchlist en backend para detectar oportunidades y cerrar señales aunque no tengas la app abierta."
            helpTitle="Vigilante del mercado"
            helpBody="El vigilante corre en backend, revisa tu watchlist activa y puede crear o cerrar señales aunque no tengas esta pantalla abierta."
            helpBullets={[
              "Lee la lista activa configurada para señales.",
              "Escanea marcos utiles segun cada estrategia.",
              "Marca ganancias o perdidas cuando el precio toca TP o SL.",
            ]}
            actions={(
              <button className="btn-secondary-soft" type="button" onClick={() => void handleRunScanner()} disabled={scannerBusy}>
                {scannerBusy ? "Revisando..." : "Revisar ahora"}
              </button>
            )}
          >
            {scannerNotice ? (
              <div className="content-note" style={{ marginBottom: "1rem" }}>
                {scannerNotice}
              </div>
            ) : null}
            <div className="stats-grid">
              <StatCard
                label="Última ejecución"
                value={scannerStatus?.latestRun ? new Date(scannerStatus.latestRun.created_at).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : "--"}
                sub={scannerStatus?.latestRun ? `Estado ${formatScannerStatus(scannerStatus.latestRun.status)}` : "Todavía no hay ejecuciones registradas"}
                accentClass="accent-blue"
              />
              <StatCard
                label="Monedas vigiladas"
                value={String(scannerStatus?.summary.watchedCoins || 0)}
                sub={scannerStatus?.targets?.[0] ? `Lista activa: ${scannerStatus.targets[0].activeListName}` : "Sin watchlist activa"}
                accentClass="accent-emerald"
              />
              <StatCard
                label="Monedas revisadas"
                value={String(scannerStatus?.latestRun?.coins_count || 0)}
                sub={scannerStatus?.latestRun ? `${scannerStatus.latestRun.frames_scanned} marcos revisados` : "Esperando la primera revisión"}
                accentClass="accent-amber"
              />
              <StatCard
                label="Señales creadas / cerradas"
                value={scannerStatus?.latestRun ? `${scannerStatus.latestRun.signals_created} / ${scannerStatus.latestRun.signals_closed}` : "--"}
                sub="Nuevas creadas / cerradas por objetivo o stop"
                accentClass="accent-green"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Embudo real hacia demo"
            subtitle="Aquí ves por qué el resumen de señales no es igual al flujo que termina en Binance Demo."
            helpTitle="Embudo hacia demo"
            helpBody="No toda señal abierta termina en demo. Primero el motor decide si es operativa y luego el perfil de riesgo decide si puede ejecutarse."
            helpBullets={[
              "Detectadas abiertas: todas las señales pendientes todavía vivas.",
              "Motor operativo: solo las que el sistema considera parte del flujo actual.",
              "Listas para demo: las que además pasan riesgo, RR y límites de ejecución.",
            ]}
          >
            <div className="stats-grid">
              {executionFunnelSteps.map((step) => (
                <StatCard
                  key={`funnel-${step.label}`}
                  label={step.label}
                  value={String(step.value)}
                  sub={step.sub}
                  accentClass={step.accentClass}
                />
              ))}
            </div>
            <p className="section-note with-top-gap">
              Resumen rápido: hay {openSignals.length} señales abiertas, pero solo {eligibleExecutionCandidates.length} cumplen hoy todo lo necesario para pasar a demo.
            </p>
          </SectionCard>

          <div className="stats-grid">
            <StatCard label="Mejor tipo de entrada" value={bestSetup ? getSetupLabel(bestSetup.setup) : "--"} sub={bestSetup ? `${bestSetup.rate.toFixed(0)}% de efectividad` : "Todavía falta historial"} accentClass="accent-blue" />
            <StatCard label="Marco más fuerte" value={strongestTimeframe?.timeframe || "--"} sub={strongestTimeframe ? `${strongestTimeframe.rate.toFixed(0)}% de acierto` : "Esperando más señales"} accentClass="accent-amber" />
            <StatCard label="Estrategia más fuerte" value={strongestStrategy?.strategy || "--"} sub={strongestStrategy ? `${strongestStrategy.rate.toFixed(0)}% de acierto` : "Esperando más cierres"} accentClass="accent-blue" />
            <StatCard label="Mejor contexto" value={bestContext?.signature?.split(" | ")[0] || "--"} sub={bestContext ? `${bestContext.rate.toFixed(0)}% en ${bestContext.total} señales` : "Esperando suficiente historial"} accentClass="accent-emerald" />
          </div>

          <div className="stats-grid">
            <StatCard label="Ganadas en período" value={String(periodWins)} sub={`En ${periodLabel}`} accentClass="accent-green" />
            <StatCard label="Perdidas en período" value={String(periodLosses)} sub={`En ${periodLabel}`} accentClass="accent-amber" />
            <StatCard label="Invalidadas" value={String(periodInvalidated)} sub={`En ${periodLabel}`} accentClass="accent-blue" />
            <StatCard label="Abiertas en período" value={String(periodPending)} sub={`Todavía activas en ${periodLabel}`} accentClass="accent-emerald" />
          </div>

          <div className="stats-grid">
            <StatCard label="Total ganado" value={periodGrossWins ? formatSignedPrice(periodGrossWins) : "--"} sub={`Ganancias cerradas en ${periodLabel}`} toneClass="portfolio-positive" accentClass="accent-green" />
            <StatCard label="Total perdido" value={periodGrossLosses ? `-${formatPrice(periodGrossLosses)}` : "--"} sub={`Pérdidas cerradas en ${periodLabel}`} toneClass="portfolio-negative" accentClass="accent-amber" />
            <StatCard label="Ganancia promedio" value={periodGrossWins ? formatSignedPrice(periodAvgWin) : "--"} sub="Promedio por operación ganada" toneClass="portfolio-positive" accentClass="accent-green" />
            <StatCard label="Pérdida promedio" value={periodGrossLosses ? `-${formatPrice(periodAvgLoss)}` : "--"} sub="Promedio por operación perdida" toneClass="portfolio-negative" accentClass="accent-amber" />
            <StatCard label="Expectativa por señal" value={periodCompletedSignals.length ? formatSignedPrice((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) : "--"} sub="Lo que deja cada señal cerrada" toneClass={periodCompletedSignals.length && ((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) > 0 ? "portfolio-positive" : periodCompletedSignals.length && ((periodGrossWins - periodGrossLosses) / periodCompletedSignals.length) < 0 ? "portfolio-negative" : ""} accentClass="accent-blue" />
            <StatCard label="Profit factor" value={periodCompletedSignals.length ? (periodGrossLosses > 0 ? (periodGrossWins / periodGrossLosses).toFixed(2) : periodGrossWins > 0 ? periodGrossWins.toFixed(2) : "--") : "--"} sub="Qué tanto cubren las ganancias a las pérdidas" toneClass={periodCompletedSignals.length && (periodGrossLosses > 0 ? (periodGrossWins / periodGrossLosses) : periodGrossWins) > 1 ? "portfolio-positive" : periodCompletedSignals.length ? "portfolio-negative" : ""} accentClass="accent-emerald" />
          </div>
        </>
      ) : null}

      {activeTab === "performance" ? (
        <section id="signals-performance">
          <SectionCard
            title="Resultados del sistema"
            subtitle={`Aquí ves qué está dejando mejores y peores resultados en ${periodLabel}.`}
            helpTitle="Resultados del sistema"
            helpBody="Esta pestaña resume que monedas, setups, marcos y contextos estan dejando mejor o peor resultado real en el periodo elegido."
          >
            <div className="stats-grid">
              <StatCard label="Par más rentable" value={periodAnalytics.bestCoin?.label || "--"} sub={periodAnalytics.bestCoin ? `${formatSignedPrice(periodAnalytics.bestCoin.pnl)} · ${periodAnalytics.bestCoin.winRate.toFixed(0)}% de acierto` : "Esperando cierres suficientes"} toneClass={periodAnalytics.bestCoin && periodAnalytics.bestCoin.pnl > 0 ? "portfolio-positive" : ""} accentClass="accent-green" />
              <StatCard label="Par más débil" value={periodAnalytics.worstCoin?.label || "--"} sub={periodAnalytics.worstCoin ? `${formatSignedPrice(periodAnalytics.worstCoin.pnl)} · ${periodAnalytics.worstCoin.winRate.toFixed(0)}% de acierto` : "Todavía no hay pérdidas cerradas"} toneClass={periodAnalytics.worstCoin && periodAnalytics.worstCoin.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-amber" />
              <StatCard label="Tipo de entrada más rentable" value={periodAnalytics.bestSetupPnl?.label || "--"} sub={periodAnalytics.bestSetupPnl ? `${formatSignedPrice(periodAnalytics.bestSetupPnl.pnl)} en ${periodAnalytics.bestSetupPnl.total} señales` : "Sin historial suficiente"} toneClass={periodAnalytics.bestSetupPnl && periodAnalytics.bestSetupPnl.pnl > 0 ? "portfolio-positive" : ""} accentClass="accent-blue" />
              <StatCard label="Marco con mejor resultado" value={periodAnalytics.bestTimeframePnl?.label || "--"} sub={periodAnalytics.bestTimeframePnl ? `${formatSignedPrice(periodAnalytics.bestTimeframePnl.pnl)} · ${periodAnalytics.bestTimeframePnl.winRate.toFixed(0)}% de acierto` : "Sin datos cerrados"} toneClass={periodAnalytics.bestTimeframePnl && periodAnalytics.bestTimeframePnl.pnl > 0 ? "portfolio-positive" : ""} accentClass="accent-emerald" />
            </div>

            <div className="signal-analytics-grid">
              <AnalyticsListCard title="Top monedas" subtitle="Qué monedas están dejando mejor resultado neto." items={periodAnalytics.topCoins} />
              <AnalyticsListCard title="Top tipos de entrada" subtitle="Qué clase de señal está funcionando mejor." items={periodAnalytics.topSetups} />
              <AnalyticsListCard title="Top marcos" subtitle="Qué marco de tiempo está siendo más eficiente." items={periodAnalytics.topTimeframes} />
              <AnalyticsListCard title="Top contextos" subtitle="Qué combinación de mercado está funcionando mejor." items={periodAnalytics.topContexts} truncateLabel />
            </div>
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "strategies" ? (
        <section id="signals-strategies">
          <SectionCard
            title="Motor de estrategias"
            subtitle="Aquí ves qué estrategia está liderando, cuál le compite más de cerca y cuál parece más prometedora."
            helpTitle="Motor de estrategias"
            helpBody="Aqui comparas que estrategia esta ganando mas veces, cual queda cerca como alternativa y si una version nueva empieza a sacar ventaja."
            helpBullets={[
              strategyPrimaryCounts[0]
                ? `${strategyPrimaryCounts[0].label} es la estrategia que más veces quedó principal en ${periodLabel}.`
                : "Todavía no hay suficiente historial para definir una estrategia dominante.",
              strongestAlternative
                ? `${strongestAlternative.label} es la alternativa que más compite cerca del resultado final.`
                : "Cuando varias estrategias compitan de verdad, aquí verás cuál se acerca más a la principal.",
              `${trendPromotionRecommendation.title}. ${trendPromotionRecommendation.reason}`,
            ]}
          >
            <div className="stats-grid">
              <StatCard label="Estrategias activas" value={String(registry.filter((item) => item.is_active).length)} sub={`${registry.length} registradas en el motor`} accentClass="accent-blue" />
              <StatCard label="Versiones registradas" value={String(versions.length)} sub="Variantes disponibles para comparar" accentClass="accent-emerald" />
              <StatCard label="Pruebas activas" value={String(experiments.filter((item) => item.status !== "archived").length)} sub="Borradores y pruebas seguras" accentClass="accent-amber" />
              <StatCard label="Estrategia dominante" value={strategyPrimaryCounts[0]?.label || "--"} sub={strategyPrimaryCounts[0] ? `${strategyPrimaryCounts[0].total} veces como estrategia principal` : "Esperando más señales"} accentClass="accent-blue" />
            </div>

            <div className="signal-analytics-grid">
              <StrategyLabCard title="Estrategia principal" subtitle="Cuántas veces cada estrategia quedó como lectura principal." items={strategyPrimaryCounts} />
              <StrategyLabCard title="Estrategia alternativa" subtitle="Cuántas veces apareció como alternativa dentro del motor." items={strategyCandidateCounts} />
            </div>

            <div className="stats-grid">
              <StatCard label="Tendencia alineada v1" value={trendVersionComparison.v1 ? formatSignedPrice(trendVersionComparison.v1.pnl) : "--"} sub={trendVersionComparison.v1 ? `${trendVersionComparison.v1.winRate.toFixed(0)}% de acierto · ${trendVersionComparison.v1.total} señales` : "Sin suficientes cierres"} toneClass={trendVersionComparison.v1 && trendVersionComparison.v1.pnl > 0 ? "portfolio-positive" : trendVersionComparison.v1 && trendVersionComparison.v1.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-blue" />
              <StatCard label="Tendencia alineada v2" value={trendVersionComparison.v2 ? formatSignedPrice(trendVersionComparison.v2.pnl) : "--"} sub={trendVersionComparison.v2 ? `${trendVersionComparison.v2.winRate.toFixed(0)}% de acierto · ${trendVersionComparison.v2.total} señales` : "Sin suficientes cierres"} toneClass={trendVersionComparison.v2 && trendVersionComparison.v2.pnl > 0 ? "portfolio-positive" : trendVersionComparison.v2 && trendVersionComparison.v2.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-emerald" />
              <StatCard label="Ventaja actual" value={trendVersionComparison.v1 && trendVersionComparison.v2 ? (trendVersionComparison.v2.pnl === trendVersionComparison.v1.pnl ? "Empate" : trendVersionComparison.v2.pnl > trendVersionComparison.v1.pnl ? "v2 arriba" : "v1 arriba") : "--"} sub={trendVersionComparison.v1 && trendVersionComparison.v2 ? `${formatSignedPrice((trendVersionComparison.v2.pnl || 0) - (trendVersionComparison.v1.pnl || 0))} de diferencia` : "Esperando suficiente histórico"} accentClass="accent-amber" />
            </div>
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "experiments" ? (
        <section id="signals-experiments">
          <div className="automation-shell">
          <SectionCard
            title="Mapa rápido de automatización"
            subtitle="Primero entiende el tablero: qué hace el sistema solo, qué puedes construir tú y qué pruebas ya están corriendo."
            helpTitle="Mapa de automatizacion"
            helpBody="Esta pestaña explica el flujo completo desde la deteccion de una idea hasta la prueba segura y el aprendizaje posterior."
            helpBullets={[
              "El sistema detecta una mejora potencial antes de tocar nada importante.",
              "Luego crea una prueba y compara base contra candidata en contexto controlado.",
              "Con esos resultados decide si insistir, observar o descartar la variante.",
            ]}
          >
            <div className="automation-status-banner">
              <div className="automation-status-copy">
                <span className="automation-kicker">Decisión actual del sistema</span>
                <strong>{trendPromotionRecommendation.title}</strong>
                <p>{trendPromotionRecommendation.reason}</p>
              </div>
              <div className={`signal-analytics-pill status-${trendPromotionRecommendation.statusClass}`}>
                {trendPromotionRecommendation.statusLabel}
              </div>
            </div>
            <div className="inline-actions with-top-gap">
              {!recommendedExperiment ? (
                <button className="btn-secondary-soft signal-inline-button" type="button" onClick={() => void handleCreateRecommendedExperiment()}>
                  Crear prueba automática sugerida
                </button>
              ) : (
                <>
                  <span className="section-note">
                    Prueba actual: <span className="text-strong">{getExperimentStatusLabel(recommendedExperiment.status)}</span> · {formatMarketScope(recommendedExperiment.market_scope)} · {formatTimeframeScope(recommendedExperiment.timeframe_scope)}
                  </span>
                  {recommendedExperiment.status !== "sandbox" ? (
                    <button className="btn-secondary-soft signal-inline-button" type="button" onClick={() => void handleSendRecommendedToSandbox()}>
                      Enviar a prueba segura
                    </button>
                  ) : (
                    <span className="signal-analytics-pill status-sandbox">Prueba segura activa</span>
                  )}
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Zona manual"
            subtitle="Si quieres intervenir tú mismo, aquí comparas estrategias o versiones antes de dejarlas crecer dentro del sistema."
            helpTitle="Zona manual"
            helpBody="Aqui armas pruebas propias entre estrategia base y candidata para comparar versiones sin tocar produccion."
            helpBullets={[
              "Base: estrategia actual que usas como referencia.",
              "Candidata: idea nueva que quieres someter a prueba.",
              "Mercado, marcos y objetivo: contexto exacto donde se hara la comparacion.",
            ]}
          >
            <div className="automation-manual-layout">
              <div className="automation-manual-main">
                <div className="experiment-builder-grid">
                  <FieldGuideCard
                    title="Paso 1 · Estrategia base"
                    text="Es la referencia actual contra la que vas a medir la candidata."
                  >
                    <select className="timeframe-select signal-select" value={experimentBase} onChange={(event) => setExperimentBase(event.target.value)}>
                      {registry.map((item) => (
                        <option key={`base-${item.strategy_id}`} value={item.strategy_id}>{getFriendlyStrategyName(item.strategy_id, item.label)}</option>
                      ))}
                    </select>
                  </FieldGuideCard>
                  <FieldGuideCard
                    title="Paso 2 · Estrategia candidata"
                    text="Es la idea nueva que quieres someter a prueba."
                  >
                    <select className="timeframe-select signal-select" value={experimentCandidate} onChange={(event) => setExperimentCandidate(event.target.value)}>
                      {registry.map((item) => (
                        <option key={`candidate-${item.strategy_id}`} value={item.strategy_id}>{getFriendlyStrategyName(item.strategy_id, item.label)}</option>
                      ))}
                    </select>
                  </FieldGuideCard>
                  <FieldGuideCard
                    title="Paso 3 · Versión de la candidata"
                    text="Aquí eliges la versión exacta que va a competir."
                  >
                    <select className="timeframe-select signal-select" value={experimentVersion} onChange={(event) => setExperimentVersion(event.target.value)}>
                      {availableCandidateVersions.map((item) => (
                        <option key={`${item.strategy_id}-${item.version}`} value={item.version}>{getFriendlyStrategyVersionLabel(item.strategy_id, item.version, item.label)}</option>
                      ))}
                    </select>
                  </FieldGuideCard>
                  <FieldGuideCard
                    title="Paso 4 · Tipo de mercado"
                    text="Define si quieres probarlo en todo el mercado o solo en un contexto concreto."
                  >
                    <select className="timeframe-select signal-select" value={experimentMarketScope} onChange={(event) => setExperimentMarketScope(event.target.value)}>
                      <option value="all">Todo el mercado</option>
                      <option value="watchlist">Solo watchlist</option>
                      <option value="trend">Mercado en tendencia</option>
                      <option value="range">Mercado en rango</option>
                    </select>
                  </FieldGuideCard>
                  <FieldGuideCard
                    title="Paso 5 · Marcos de tiempo"
                    text="Aquí decides en qué temporalidades se hará la comparación."
                  >
                    <select className="timeframe-select signal-select" value={experimentTimeframeScope} onChange={(event) => setExperimentTimeframeScope(event.target.value)}>
                      <option value="all">Todos los marcos</option>
                      {timeframes.map((item) => (
                        <option key={`scope-${item}`} value={item}>{item}</option>
                      ))}
                    </select>
                  </FieldGuideCard>
                </div>
                <div className="signal-note-block with-bottom-gap">
                  <input
                    className="signal-memory-input"
                    value={experimentSummary}
                    onChange={(event) => setExperimentSummary(event.target.value)}
                    placeholder="Qué quieres validar con esta prueba manual"
                  />
                  <span className="signal-status-note">
                    Escribe una frase simple. Ejemplo: “quiero ver si la candidata funciona mejor en 1h dentro del watchlist”.
                  </span>
                </div>
                <button className="btn-secondary-soft" type="button" onClick={() => void handleCreateExperiment()}>
                  Crear prueba manual
                </button>
              </div>
            </div>

            <div className="automation-subsection">
              <div className="automation-subsection-head">
                <h4>Pruebas creadas</h4>
                <p>Aquí se listan todas las comparaciones que ya creaste, aunque todavía no estén activas.</p>
              </div>
              <details className="guide-accordion automation-collapse" open>
                <summary className="guide-accordion-summary">
                  <div>
                    <strong>Ver comparaciones guardadas</strong>
                    <span>Expande o minimiza esta lista cuando ya no la necesites.</span>
                  </div>
                  <span className="guide-accordion-toggle">Expandir / minimizar</span>
                </summary>
                <div className="guide-accordion-body">
                  <div className="experiment-record-grid with-top-gap">
                    {!experiments.length ? (
                      <p className="section-note">Todavía no hay pruebas guardadas. Crea la primera para empezar a comparar variantes.</p>
                    ) : (
                      pagedExperiments.rows.map((item) => (
                        <div key={`experiment-${item.id}`} className="experiment-record-card">
                          <div className="experiment-record-main">
                            <div className="experiment-record-topline">
                              <strong>{getExperimentTitle(item)}</strong>
                              <div className={`signal-analytics-pill status-${item.status}`}>{getExperimentStatusLabel(item.status)}</div>
                            </div>
                            <span className="experiment-record-meta">
                              {formatMarketScope(item.market_scope)} · {formatTimeframeScope(item.timeframe_scope)}
                            </span>
                            <p className="experiment-record-summary">
                              {item.summary || "Todavía no tiene un objetivo escrito. Puedes usar el resumen para dejar claro qué querías validar."}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <PaginationControls
                    currentPage={pagedExperiments.safePage}
                    totalPages={pagedExperiments.totalPages}
                    totalItems={experiments.length}
                    label="pruebas"
                    onPageChange={setExperimentsPage}
                  />
                </div>
              </details>
            </div>
          </SectionCard>

          <SectionCard
            title="Pruebas ya en observación"
            subtitle="Aquí ves cómo le va a cada variante que ya entró en observación controlada."
            helpTitle="Pruebas en observacion"
            helpBody="Estas tarjetas muestran comparaciones reales entre base y candidata dentro de un entorno controlado antes de cualquier promocion."
          >
            <div className="automation-live-head">
              <div className="automation-live-intro">
                <span className="automation-module-kicker">Seguimiento en vivo</span>
                <h4>Lo que ya está compitiendo de verdad</h4>
                <p>Estas tarjetas ya no son ideas. Aquí comparas la base contra la candidata con resultados reales.</p>
              </div>
              <div className="automation-live-summary">
                <div className="automation-live-chip">
                  <strong>{sandboxStats.length}</strong>
                  <span>pruebas activas</span>
                </div>
                <div className="automation-live-chip">
                  <strong>{sandboxStats.reduce((sum, item) => sum + item.sampleSize, 0)}</strong>
                  <span>casos observados</span>
                </div>
              </div>
            </div>
            {!sandboxStats.length ? (
              <p className="section-note">Todavía no hay pruebas seguras activas. Cuando una pase de borrador a prueba segura, aparecerá aquí con su lectura comparativa.</p>
            ) : (
              <div className="signal-analytics-grid automation-live-grid">
                {pagedSandboxStats.rows.map((item) => (
                  <PaperTestingCard
                    key={`sandbox-${item.experiment.id}`}
                    item={item}
                    onPromote={() => void handlePromoteExperiment(item)}
                    isPromoting={promotingExperimentId === item.experiment.id}
                  />
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={pagedSandboxStats.safePage}
              totalPages={pagedSandboxStats.totalPages}
              totalItems={sandboxStats.length}
              label="pruebas seguras"
              onPageChange={setSandboxPage}
            />
          </SectionCard>
          </div>
        </section>
      ) : null}

      {activeTab === "adaptive" ? (
        <section id="signals-adaptive">
          <SectionCard
            title="IA que aprende del historial"
            subtitle="Aquí el sistema observa resultados reales y propone cambios concretos. Todavía no toca producción: solo recomienda y deja evidencia."
            helpTitle="IA que aprende"
            helpBody="La capa adaptativa analiza historial cerrado y propone ajustes concretos, pero todavia no cambia produccion por su cuenta."
            helpBullets={[
              "Detecta patrones en el historial real.",
              "Propone un ajuste concreto para probarlo primero.",
              "No promueve versiones ni cambia parametros sola en produccion.",
            ]}
            actions={
              <button className="btn-secondary-soft" type="button" onClick={() => void handleGenerateRecommendations()}>
                Generar sugerencias
              </button>
            }
          >
            <div className="stats-grid">
              <StatCard label="Sugerencias activas" value={String(recommendations.length)} sub="Ajustes abiertos en observación" accentClass="accent-blue" />
              <StatCard label="Confianza alta" value={String(recommendations.filter((item) => Number(item.confidence || 0) >= 0.75).length)} sub="Sugerencias con evidencia más fuerte" accentClass="accent-emerald" />
              <StatCard label="Estrategias tocadas" value={String(new Set(recommendations.map((item) => item.strategy_id)).size)} sub="Cuántas familias reciben ajustes" accentClass="accent-amber" />
              <StatCard label="Promedio de confianza" value={recommendations.length ? `${Math.round((recommendations.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / recommendations.length) * 100)}%` : "--"} sub="Lectura agregada de seguridad" accentClass="accent-blue" />
            </div>

            <div className="stats-grid compact-stats-grid">
              {adaptiveInsights.map((item) => (
                <StatCard
                  key={item.key}
                  label={item.title}
                  value={item.value}
                  sub={item.sub}
                  accentClass={item.accentClass}
                />
              ))}
            </div>

            <div className="signal-analytics-grid">
              {adaptiveInsights.map((item) => (
                <div key={`adaptive-insight-${item.key}`} className="signal-analytics-card">
                  <div className="signal-analytics-head">
                    <h4>{item.title}</h4>
                    <p>{item.summary}</p>
                  </div>
                </div>
              ))}
            </div>

            {!recommendations.length ? (
              <EmptyState message="Todavía no hay sugerencias adaptativas listas para promover. Abajo ya puedes ver los aprendizajes que el sistema sí está detectando con el historial real." />
            ) : (
              <div className="signal-analytics-grid">
                {pagedRecommendations.rows.map((item) => (
                  <AdaptiveRecommendationCard
                    key={`${item.recommendation_key}-${item.id}`}
                    item={item}
                    isActivating={activatingRecommendationKey === item.recommendation_key}
                    onActivate={() => void handleActivateRecommendation(item)}
                  />
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={pagedRecommendations.safePage}
              totalPages={pagedRecommendations.totalPages}
              totalItems={recommendations.length}
              label="sugerencias"
              onPageChange={setRecommendationsPage}
            />
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "execution" ? (
        <section id="signals-execution">
          <SectionCard
            title="Puente a Binance Demo"
            subtitle="Aquí conviertes una señal abierta en un trade candidato. Primero pasa por reglas de riesgo y luego decides si la envías como orden demo."
            helpTitle="Puente a Binance Demo"
            helpBody="Esta capa toma señales abiertas, las traduce a candidatos de ejecucion y revisa si respetan tu perfil de riesgo antes de permitir una orden demo."
            helpBullets={[
              "Toma señales abiertas y las convierte en candidatos de ejecucion.",
              "Revisa si respetan tu perfil de riesgo.",
              "Todavia deja el envio real como paso manual.",
            ]}
          >
            <div className="stats-grid">
              <StatCard
                label="Cuenta demo"
                value={props.executionCenter?.account.connected ? "Conectada" : "Sin conexión"}
                sub={props.executionCenter?.account.alias || "Conecta Binance Demo Spot en Perfil"}
                accentClass="accent-blue"
              />
              <StatCard
                label="Liquidez"
                value={formatPrice(props.executionCenter?.account.cashValue || 0)}
                sub={`Capital total ${formatPrice(props.executionCenter?.account.totalValue || 0)}`}
                accentClass="accent-emerald"
              />
              <StatCard
                label="Órdenes abiertas"
                value={String(props.executionCenter?.account.openOrdersCount || 0)}
                sub="Órdenes demo ya activas en Binance"
                accentClass="accent-amber"
              />
              <StatCard
                label="Pérdida diaria"
                value={`${Number(props.executionCenter?.account.dailyLossPct || 0).toFixed(2)}%`}
                sub="Se usa para bloquear nuevas ejecuciones si hace falta"
                accentClass="accent-blue"
              />
              <StatCard
                label="Autos de hoy"
                value={String(props.executionCenter?.account.dailyAutoExecutions || 0)}
                sub={`Restantes ${String(props.executionCenter?.account.autoExecutionRemaining || 0)}`}
                accentClass="accent-emerald"
              />
              <StatCard
                label="Racha negativa"
                value={String(props.executionCenter?.account.recentLossStreak || 0)}
                sub="Si sube demasiado, entra en enfriamiento"
                accentClass="accent-amber"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Perfil de ejecución demo"
            subtitle="Estas son las reglas mínimas que el sistema revisa antes de dejar pasar una orden."
            helpTitle="Perfil de ejecucion demo"
            helpBody="Estas reglas definen el filtro de seguridad antes de que una señal pueda avanzar hacia preview o envio de orden demo."
            actions={(
              <button className="btn-secondary-soft signal-inline-button" type="button" onClick={() => void handleSaveExecutionProfile()} disabled={executionSaving || !executionProfileForm}>
                {executionSaving ? "Guardando..." : "Guardar perfil"}
              </button>
            )}
          >
            {!executionProfileForm ? (
              <EmptyState message="No se pudo cargar el perfil de ejecución todavía." />
            ) : (
              <>
                <div className="execution-profile-layout">
                  <div className="execution-profile-main">
                    <div className="execution-preset-row">
                      {EXECUTION_PROFILE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`execution-preset-card${activeExecutionPreset === preset.id ? " is-active" : ""}`}
                          onClick={() => handleApplyExecutionPreset(preset.id)}
                        >
                          <strong>{preset.label}</strong>
                          <span>{preset.description}</span>
                        </button>
                      ))}
                    </div>

                    <div className="execution-profile-group-grid">
                      <FieldGuideCard title="Estado del motor" text="Aquí defines si el sistema puede ejecutar y si la parte automática queda viva o solo en modo revisión.">
                        <div className="execution-toggle-row">
                          <button
                            type="button"
                            className={`execution-toggle-button${executionProfileForm.enabled ? " is-active" : ""}`}
                            onClick={() => setExecutionProfileForm((current) => current ? { ...current, enabled: true } : current)}
                          >
                            Motor encendido
                          </button>
                          <button
                            type="button"
                            className={`execution-toggle-button${!executionProfileForm.enabled ? " is-active" : ""}`}
                            onClick={() => setExecutionProfileForm((current) => current ? { ...current, enabled: false } : current)}
                          >
                            Motor apagado
                          </button>
                        </div>
                        <div className="execution-toggle-row">
                          <button
                            type="button"
                            className={`execution-toggle-button${executionProfileForm.autoExecuteEnabled ? " is-active" : ""}`}
                            onClick={() => setExecutionProfileForm((current) => current ? { ...current, autoExecuteEnabled: true } : current)}
                          >
                            Autoejecución on
                          </button>
                          <button
                            type="button"
                            className={`execution-toggle-button${!executionProfileForm.autoExecuteEnabled ? " is-active" : ""}`}
                            onClick={() => setExecutionProfileForm((current) => current ? { ...current, autoExecuteEnabled: false } : current)}
                          >
                            Solo revisión manual
                          </button>
                        </div>
                      </FieldGuideCard>

                      <FieldGuideCard title="Calidad mínima" text="Estos son los filtros que más afectan cuántas señales realmente pasan a demo.">
                        <div className="execution-dual-input-grid">
                          <label className="execution-range-card">
                            <span>Convicción mínima</span>
                            <input className="signal-memory-input" type="number" min="1" max="100" step="1" value={executionProfileForm.minSignalScore} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, minSignalScore: Number(event.target.value || 0) } : current)} />
                          </label>
                          <label className="execution-range-card">
                            <span>RR mínimo</span>
                            <input className="signal-memory-input" type="number" min="0.1" step="0.05" value={executionProfileForm.minRrRatio} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, minRrRatio: Number(event.target.value || 0) } : current)} />
                          </label>
                        </div>
                      </FieldGuideCard>

                      <FieldGuideCard title="Riesgo y tamaño" text="Estos límites sí son de seguridad dura y conviene cambiarlos con más cuidado.">
                        <div className="execution-dual-input-grid">
                          <label className="execution-range-card">
                            <span>Riesgo por trade (%)</span>
                            <input className="signal-memory-input" type="number" min="0.5" step="0.5" value={executionProfileForm.riskPerTradePct} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, riskPerTradePct: Number(event.target.value || 0) } : current)} />
                          </label>
                          <label className="execution-range-card">
                            <span>Máximo por posición (USD)</span>
                            <input className="signal-memory-input" type="number" min="5" step="5" value={executionProfileForm.maxPositionUsd} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, maxPositionUsd: Number(event.target.value || 0) } : current)} />
                          </label>
                          <label className="execution-range-card">
                            <span>Máx. órdenes abiertas</span>
                            <input className="signal-memory-input" type="number" min="1" step="1" value={executionProfileForm.maxOpenPositions} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, maxOpenPositions: Number(event.target.value || 0) } : current)} />
                          </label>
                          <label className="execution-range-card">
                            <span>Pérdida diaria máxima (%)</span>
                            <input className="signal-memory-input" type="number" min="0.5" step="0.5" value={executionProfileForm.maxDailyLossPct} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, maxDailyLossPct: Number(event.target.value || 0) } : current)} />
                          </label>
                        </div>
                      </FieldGuideCard>

                      <FieldGuideCard title="Cadencia automática" text="Sirve para frenar el watcher si encadena malas decisiones o si ya operó demasiado hoy.">
                        <div className="execution-dual-input-grid">
                          <label className="execution-range-card">
                            <span>Máx. autos por día</span>
                            <input className="signal-memory-input" type="number" min="1" step="1" value={executionProfileForm.maxDailyAutoExecutions} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, maxDailyAutoExecutions: Number(event.target.value || 0) } : current)} />
                          </label>
                          <label className="execution-range-card">
                            <span>Enfriamiento tras pérdidas</span>
                            <input className="signal-memory-input" type="number" min="1" step="1" value={executionProfileForm.cooldownAfterLosses} onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, cooldownAfterLosses: Number(event.target.value || 0) } : current)} />
                          </label>
                        </div>
                      </FieldGuideCard>
                    </div>

                    <div className="execution-profile-selector-grid">
                      <FieldGuideCard title="Estrategias permitidas" text="Aquí decides qué familias pueden siquiera competir por pasar a demo.">
                        <div className="execution-filter-chip-row">
                          {executionStrategyOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`execution-filter-chip${executionProfileForm.allowedStrategies.includes(option.id) ? " is-active" : ""}`}
                              onClick={() => handleToggleExecutionSelection("allowedStrategies", option.id)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </FieldGuideCard>

                      <FieldGuideCard title="Temporalidades permitidas" text="Este era uno de los campos que faltaba exponer. Desde aquí eliges qué marcos sí pueden pasar a demo.">
                        <div className="execution-filter-chip-row">
                          {executionTimeframeOptions.map((timeframe) => (
                            <button
                              key={timeframe}
                              type="button"
                              className={`execution-filter-chip${executionProfileForm.allowedTimeframes.includes(timeframe) ? " is-active" : ""}`}
                              onClick={() => handleToggleExecutionSelection("allowedTimeframes", timeframe)}
                            >
                              {timeframe}
                            </button>
                          ))}
                        </div>
                      </FieldGuideCard>
                    </div>

                    <FieldGuideCard title="Overrides por estrategia y temporalidad" text="Aquí empieza la ejecución por scope: puedes relajar o endurecer score y RR solo para una combinación concreta sin tocar el filtro global.">
                      <div className="execution-scope-builder">
                        <div className="execution-scope-builder-grid">
                          <select className="timeframe-select signal-select" value={scopeOverrideStrategy} onChange={(event) => setScopeOverrideStrategy(event.target.value)}>
                            {executionStrategyOptions.map((option) => (
                              <option key={`scope-strategy-${option.id}`} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          <select className="timeframe-select signal-select" value={scopeOverrideTimeframe} onChange={(event) => setScopeOverrideTimeframe(event.target.value)}>
                            {executionTimeframeOptions.map((option) => (
                              <option key={`scope-timeframe-${option}`} value={option}>{option}</option>
                            ))}
                          </select>
                          <input className="signal-memory-input" type="number" min="1" max="100" step="1" value={scopeOverrideScore} onChange={(event) => setScopeOverrideScore(event.target.value)} placeholder="Score mínimo" />
                          <input className="signal-memory-input" type="number" min="0.1" step="0.05" value={scopeOverrideRr} onChange={(event) => setScopeOverrideRr(event.target.value)} placeholder="RR mínimo" />
                        </div>
                        <div className="execution-scope-builder-actions">
                          <input className="signal-memory-input" value={scopeOverrideNote} onChange={(event) => setScopeOverrideNote(event.target.value)} placeholder="Nota opcional. Ejemplo: breakout en 5m acepta un RR menor mientras está en calibración." />
                          <button className="btn-secondary-soft signal-inline-button" type="button" onClick={handleAddScopeOverride}>
                            Guardar override
                          </button>
                        </div>
                        {!executionScopeOverrides.length ? (
                          <p className="section-note">Todavía no hay overrides. Ahora mismo demo sigue usando solo el filtro global.</p>
                        ) : (
                          <div className="execution-override-list">
                            {executionScopeOverrides.map((item) => (
                              <div key={item.id} className="execution-override-card">
                                <div className="execution-override-copy">
                                  <strong>{item.strategyId} · {item.timeframe}</strong>
                                  <span>Score {item.minSignalScore ?? executionProfileForm.minSignalScore} · RR {item.minRrRatio ?? executionProfileForm.minRrRatio}</span>
                                  {item.note ? <span>{item.note}</span> : null}
                                </div>
                                <button className="btn-secondary-soft signal-inline-button" type="button" onClick={() => handleRemoveScopeOverride(item)}>
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FieldGuideCard>

                    <FieldGuideCard title="Nota operativa del perfil" text="Sirve para dejar documentado para qué estás usando este filtro ahora mismo: calibración, revisión o ejecución más estricta.">
                      <textarea
                        className="signal-memory-input execution-profile-note"
                        value={executionProfileForm.note || ""}
                        onChange={(event) => setExecutionProfileForm((current) => current ? { ...current, note: event.target.value } : current)}
                        placeholder="Ejemplo: perfil de calibración para recoger muestra en 5m y 15m sin autoejecución agresiva."
                        rows={3}
                      />
                    </FieldGuideCard>
                  </div>

                  <div className="execution-profile-side">
                    <div className="automation-side-card execution-profile-side-card">
                      <span className="automation-live-kicker">Lectura rápida del filtro</span>
                      <h4>{activeExecutionPreset ? EXECUTION_PROFILE_PRESETS.find((item) => item.id === activeExecutionPreset)?.label : "Perfil personalizado"}</h4>
                      <p>
                        {executionProfileForm.enabled
                          ? executionProfileForm.autoExecuteEnabled
                            ? "El motor puede enviar órdenes demo sin clic manual cuando una señal sí pase todas las reglas."
                            : "El motor filtra señales, pero la orden solo avanza si tú la disparas manualmente."
                          : "El motor demo está apagado, así que ninguna señal avanzará a preview ni a orden."}
                      </p>
                      <div className="guide-pill-grid">
                        <span className="guide-pill">Score {executionProfileForm.minSignalScore}+</span>
                        <span className="guide-pill">RR {executionProfileForm.minRrRatio.toFixed(2)}+</span>
                        <span className="guide-pill">{executionProfileForm.allowedTimeframes.length} marcos</span>
                        <span className="guide-pill">{executionProfileForm.allowedStrategies.length} estrategias</span>
                      </div>
                      <div className="profile-data-list">
                        <div className="profile-data-row">
                          <span>Temporalidades</span>
                          <strong>{executionProfileForm.allowedTimeframes.join(", ") || "Sin filtro"}</strong>
                        </div>
                        <div className="profile-data-row">
                          <span>Estrategias</span>
                          <strong>{executionProfileForm.allowedStrategies.join(", ") || "Sin filtro"}</strong>
                        </div>
                        <div className="profile-data-row">
                          <span>Autos por día</span>
                          <strong>{executionProfileForm.maxDailyAutoExecutions}</strong>
                        </div>
                        <div className="profile-data-row">
                          <span>Enfriamiento</span>
                          <strong>{executionProfileForm.cooldownAfterLosses} pérdidas</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Señales listas para orden demo"
            subtitle="Aquí ves cuáles señales abiertas pueden pasar a ejecución y cuáles quedan bloqueadas por reglas de riesgo."
            helpTitle="Senales listas para orden demo"
            helpBody="Aqui el sistema te dice que señales abiertas estan listas para avanzar y cuales quedan bloqueadas por reglas de riesgo o contexto."
          >
            <div className="stats-grid compact-stats-grid">
              <StatCard label="Abiertas vivas" value={String(openSignals.length)} sub="Universo pendiente en señales" accentClass="accent-blue" />
              <StatCard label="Operativas" value={String(operationalOpenSignals.length)} sub="Aceptadas por el motor actual" accentClass="accent-emerald" />
              <StatCard label="Elegibles" value={String(eligibleExecutionCandidates.length)} sub="Ya pueden pasar a demo" accentClass="accent-green" />
              <StatCard label="Bloqueadas" value={String(blockedExecutionCandidates.length)} sub={topBlockedReason || "Sin bloqueos"} accentClass="accent-amber" />
            </div>
            <p className="section-note with-bottom-gap">
              Demo no toma todas las abiertas. Solo mira las operativas y luego aplica el perfil de ejecución para decidir cuáles sí pueden enviarse.
            </p>
            {!props.executionCenter?.candidates?.length ? (
              <EmptyState message="Todavía no hay señales abiertas listas para evaluar en ejecución demo." />
            ) : (
              <div className="execution-candidate-grid">
                {pagedCandidates.rows.map((item) => (
                  <ExecutionCandidateCard
                    key={`execution-${item.signalId}`}
                    item={item}
                    busy={executionBusy}
                    onPreview={() => void handleRunExecution(item.signalId, "preview")}
                    onExecute={() => void handleRunExecution(item.signalId, "execute")}
                  />
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={pagedCandidates.safePage}
              totalPages={pagedCandidates.totalPages}
              totalItems={props.executionCenter?.candidates?.length || 0}
              label="candidatos"
              onPageChange={setCandidatesPage}
            />
          </SectionCard>

          <SectionCard
            title="Auditoría del filtro demo"
            subtitle="Aquí comparas si el filtro demo está seleccionando mejor o si está dejando fuera señales con ventaja."
            helpTitle="Auditoria del filtro demo"
            helpBody="Esta vista compara cohortes reales: señales ejecutadas, operativas no ejecutadas y señales fuera del flujo demo para ver si el filtro está alineado con el edge del sistema."
          >
            <div className="stats-grid">
              <StatCard label="Ejecutadas cerradas" value={String(executedClosedStats.total)} sub={`${executedClosedStats.winRate.toFixed(0)}% acierto · ${formatSignedPrice(executedClosedStats.pnl)}`} toneClass={executedClosedStats.pnl > 0 ? "portfolio-positive" : executedClosedStats.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-green" />
              <StatCard label="Operativas no ejecutadas" value={String(skippedOperationalStats.total)} sub={`${skippedOperationalStats.winRate.toFixed(0)}% acierto · ${formatSignedPrice(skippedOperationalStats.pnl)}`} toneClass={skippedOperationalStats.pnl > 0 ? "portfolio-positive" : skippedOperationalStats.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-blue" />
              <StatCard label="Fuera de demo" value={String(blockedObservationStats.total)} sub={`${blockedObservationStats.winRate.toFixed(0)}% acierto · ${formatSignedPrice(blockedObservationStats.pnl)}`} toneClass={blockedObservationStats.pnl > 0 ? "portfolio-positive" : blockedObservationStats.pnl < 0 ? "portfolio-negative" : ""} accentClass="accent-amber" />
              <StatCard label="Bloqueo principal" value={blockedExecutionCandidates.length ? String(blockedExecutionCandidates.length) : "--"} sub={topBlockedReason || "Sin bloqueos actuales"} accentClass="accent-amber" />
            </div>
            <div className="stats-grid compact-stats-grid">
              <StatCard label="Score medio elegibles" value={eligibleOpenStats.total ? eligibleOpenStats.avgScore.toFixed(1) : "--"} sub={eligibleOpenStats.total ? `RR medio ${eligibleOpenStats.avgRr.toFixed(2)}` : "Sin elegibles ahora"} accentClass="accent-emerald" />
              <StatCard label="Score medio bloqueadas" value={blockedOpenStats.total ? blockedOpenStats.avgScore.toFixed(1) : "--"} sub={blockedOpenStats.total ? `RR medio ${blockedOpenStats.avgRr.toFixed(2)}` : "Sin bloqueadas ahora"} accentClass="accent-blue" />
              <StatCard label="PnL medio ejecutadas" value={executedClosedStats.total ? formatSignedPrice(executedClosedStats.avgPnl) : "--"} sub="Promedio por señal cerrada en demo" toneClass={executedClosedStats.avgPnl > 0 ? "portfolio-positive" : executedClosedStats.avgPnl < 0 ? "portfolio-negative" : ""} accentClass="accent-green" />
              <StatCard label="PnL medio omitidas" value={skippedOperationalStats.total ? formatSignedPrice(skippedOperationalStats.avgPnl) : "--"} sub="Operativas que no llegaron a demo" toneClass={skippedOperationalStats.avgPnl > 0 ? "portfolio-positive" : skippedOperationalStats.avgPnl < 0 ? "portfolio-negative" : ""} accentClass="accent-amber" />
            </div>
            <p className="section-note with-top-gap">
              {executionAuditInsight}
            </p>
          </SectionCard>

          <SectionCard
            title="Impacto de overrides activos"
            subtitle="Aquí mides si cada ajuste por estrategia y temporalidad está ayudando de verdad o si conviene endurecerlo más."
            helpTitle="Impacto de overrides"
            helpBody="Cada tarjeta resume el comportamiento real del scope al que le aplicaste un override, para que puedas decidir si mantenerlo, endurecerlo o quitarlo."
          >
            {!executionOverrideImpact.length ? (
              <EmptyState message="Todavía no hay overrides activos para auditar. Cuando apliques uno, aquí verás su efecto real." />
            ) : (
              <div className="signal-analytics-grid">
                {executionOverrideImpact.map((item) => (
                  <div key={`override-impact-${item.key}`} className="signal-analytics-card">
                    <div className="signal-analytics-head">
                      <h4>{item.strategyId} · {item.timeframe}</h4>
                      <p>{item.reading}</p>
                    </div>

                    <div className="stats-grid compact-stats-grid no-bottom-gap">
                      <StatCard label="Filtro activo" value={`S${item.score} · RR ${item.rr.toFixed(2)}`} sub="Thresholds de este scope" accentClass="accent-blue" />
                      <StatCard label="Cierres reales" value={String(item.closedTotal)} sub={`${item.winRate.toFixed(0)}% acierto`} accentClass={item.accentClass} />
                      <StatCard label="PnL acumulado" value={formatSignedPrice(item.pnl)} sub={`Promedio ${formatSignedPrice(item.avgPnl)}`} toneClass={item.pnl > 0 ? "portfolio-positive" : item.pnl < 0 ? "portfolio-negative" : ""} accentClass={item.accentClass} />
                      <StatCard label="Embudo actual" value={`${item.eligibleCount}/${item.blockedCount}`} sub="Elegibles / bloqueadas ahora" accentClass="accent-amber" />
                    </div>

                    {item.note ? (
                      <p className="section-note with-top-gap">
                        Nota del override: {item.note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Intentos y órdenes demo recientes"
            subtitle="Aquí queda el rastro de previews, bloqueos y órdenes que ya salieron hacia Binance Demo."
            helpTitle="Intentos y ordenes demo"
            helpBody="Este historial deja evidencia de cada preview, bloqueo o intento real de orden para que puedas auditar la capa de ejecucion."
          >
            {!props.executionCenter?.recentOrders?.length ? (
              <EmptyState message="Aún no hay intentos de ejecución demo guardados." />
            ) : (
              <div className="experiment-record-grid">
                {pagedRecentOrders.rows.map((item) => (
                  <ExecutionOrderCard key={`execution-order-${item.id}`} item={item} />
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={pagedRecentOrders.safePage}
              totalPages={pagedRecentOrders.totalPages}
              totalItems={props.executionCenter?.recentOrders?.length || 0}
              label="ordenes"
              onPageChange={setRecentOrdersPage}
            />
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section id="signals-history">
          <SectionCard
            title="Historial de señales"
            subtitle="Aquí revisas cada señal guardada, su plan, su estado y el resultado final. Solo trabaja con monedas de tu watchlist activa para señales."
            helpTitle="Historial de senales"
            helpBody="Usa esta tabla para revisar el detalle de cada señal guardada, su plan original, la estrategia que gano y el resultado final."
            helpBullets={[
              "Abierta significa que la señal sigue viva.",
              "Ganada, perdida o invalidada muestran el cierre final.",
              "Los filtros te ayudan a bajar rapido a moneda, estado, marco o setup.",
            ]}
          >
            <div className="memory-filter-bar">
              <select className="timeframe-select signal-select" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as "all" | "1d" | "7d" | "30d")}>
                <option value="all">Todo el historial</option>
                <option value="1d">Últimas 24h</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
              </select>
              <input
                className="signal-memory-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por moneda, señal, tipo de entrada, estrategia o nota"
              />
              <select className="timeframe-select signal-select" value={coinFilter} onChange={(event) => setCoinFilter(event.target.value)}>
                <option value="all">Todas las monedas</option>
                {coins.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SignalOutcomeStatus | "all")}>
                <option value="all">Todos los estados</option>
                <option value="pending">Abierta</option>
                <option value="win">Ganada</option>
                <option value="loss">Perdida</option>
                <option value="invalidated">Invalidada</option>
              </select>
              <select className="timeframe-select signal-select" value={timeframeFilter} onChange={(event) => setTimeframeFilter(event.target.value)}>
                <option value="all">Todos los marcos</option>
                {timeframes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={setupFilter} onChange={(event) => setSetupFilter(event.target.value)}>
                <option value="all">Todos los tipos de entrada</option>
                {setups.map((item) => (
                  <option key={item} value={item}>{getSetupLabel(item)}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)}>
                <option value="all">Todas las estrategias</option>
                {strategies.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <p className="section-note with-bottom-gap">
              Mostrando {filteredSignals.length} de {periodSignals.length} señales en {periodLabel}.
            </p>
            <div className="table-scroll">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Señal</th>
                    <th>Tipo de entrada</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>PnL</th>
                    <th>Nota</th>
                    <th>Guardar</th>
                  </tr>
                </thead>
                <tbody>
                  {!props.signals.length ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message="Todavía no hay señales guardadas. Puedes empezar desde Inicio con el botón Guardar señal." />
                      </td>
                    </tr>
                  ) : !filteredSignals.length ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState message="No hay señales que coincidan con los filtros actuales." />
                      </td>
                    </tr>
                  ) : (
                    pagedSignals.rows.map((signal) => (
                      <SignalRow key={signal.id} signal={signal} onSave={props.onUpdateSignal} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={pagedSignals.safePage}
              totalPages={pagedSignals.totalPages}
              totalItems={filteredSignals.length}
              label="senales"
              onPageChange={setHistoryPage}
            />
          </SectionCard>
        </section>
      ) : null}
    </div>
  );
}

function summarizeByKey(signals: SignalSnapshot[], getKey: (signal: SignalSnapshot) => string): AggregateRow[] {
  const buckets = new Map<string, { total: number; wins: number; losses: number; invalidated: number; pnl: number }>();

  signals.forEach((signal) => {
    const key = getKey(signal);
    if (!key) return;
    const bucket = buckets.get(key) || { total: 0, wins: 0, losses: 0, invalidated: 0, pnl: 0 };
    bucket.total += 1;
    bucket.pnl += Number(signal.outcome_pnl || 0);
    if (signal.outcome_status === "win") bucket.wins += 1;
    if (signal.outcome_status === "loss") bucket.losses += 1;
    if (signal.outcome_status === "invalidated") bucket.invalidated += 1;
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries())
    .map(([label, stats]) => ({
      label,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      invalidated: stats.invalidated,
      pnl: stats.pnl,
      avgPnl: stats.total ? stats.pnl / stats.total : 0,
      winRate: stats.total ? (stats.wins / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl || b.winRate - a.winRate || b.total - a.total);
}

function summarizeSignalCohort(signals: SignalSnapshot[]): SignalCohortStats {
  const total = signals.length;
  const wins = signals.filter((item) => item.outcome_status === "win").length;
  const pnl = signals.reduce((sum, item) => sum + Number(item.outcome_pnl || 0), 0);
  const avgScore = total
    ? signals.reduce((sum, item) => sum + Number(item.signal_score || 0), 0) / total
    : 0;
  const rrSignals = signals.filter((item) => Number(item.rr_ratio || 0) > 0);
  const avgRr = rrSignals.length
    ? rrSignals.reduce((sum, item) => sum + Number(item.rr_ratio || 0), 0) / rrSignals.length
    : 0;

  return {
    total,
    wins,
    pnl,
    winRate: total ? (wins / total) * 100 : 0,
    avgPnl: total ? pnl / total : 0,
    avgScore,
    avgRr,
  };
}

function sameSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function summarizeCandidateCohort(candidates: ExecutionCandidate[]) {
  const total = candidates.length;
  const avgScore = total
    ? candidates.reduce((sum, item) => sum + Number(item.score || 0), 0) / total
    : 0;
  const rrCandidates = candidates.filter((item) => Number(item.rrRatio || 0) > 0);
  const avgRr = rrCandidates.length
    ? rrCandidates.reduce((sum, item) => sum + Number(item.rrRatio || 0), 0) / rrCandidates.length
    : 0;

  return {
    total,
    avgScore,
    avgRr,
  };
}

function FieldGuideCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="field-guide-card">
      <div className="signal-field-head">
        <label className="field-guide-title">{title}</label>
        <button
          type="button"
          className="card-help-button signal-inline-help"
          aria-label={`Ayuda sobre ${title}`}
          onClick={() => openHelp({ title, body: text })}
        >
          ?
        </button>
      </div>
      {children}
    </div>
  );
}

function AnalyticsListCard({
  title,
  subtitle,
  items,
  truncateLabel = false,
}: {
  title: string;
  subtitle: string;
  items: AggregateRow[];
  truncateLabel?: boolean;
}) {
  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
      {!items.length ? (
        <p className="section-note">Todavía no hay suficientes señales cerradas para esta lectura.</p>
      ) : (
        <div className="signal-analytics-list">
          {items.map((item, index) => (
            <div key={`${title}-${item.label}`} className="signal-analytics-item">
              <div className="signal-analytics-rank">{index + 1}</div>
              <div className="signal-analytics-copy">
                <strong className={truncateLabel ? "truncate-text" : ""}>{item.label}</strong>
                <span>{item.total} señales · {item.winRate.toFixed(0)}% acierto · {formatSignedPrice(item.avgPnl)} promedio</span>
              </div>
              <div className={`signal-analytics-pnl ${item.pnl > 0 ? "is-positive" : item.pnl < 0 ? "is-negative" : ""}`}>
                {formatSignedPrice(item.pnl)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyLabCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; total: number }>;
}) {
  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
      {!items.length ? (
        <p className="section-note">Todavía no hay suficiente histórico para comparar estrategias.</p>
      ) : (
        <div className="signal-analytics-list">
          {items.slice(0, 5).map((item, index) => (
            <div key={`${title}-${item.label}`} className="signal-analytics-item">
              <div className="signal-analytics-rank">{index + 1}</div>
              <div className="signal-analytics-copy">
                <strong>{item.label}</strong>
                <span>{item.total} apariciones en el período</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperTestingCard({
  item,
  onPromote,
  isPromoting,
}: {
  item: ExperimentPaperStats;
  onPromote: () => void;
  isPromoting: boolean;
}) {
  const delta = item.candidatePrimaryPnl - item.basePrimaryPnl;
  const deltaClass = delta > 0 ? "portfolio-positive" : delta < 0 ? "portfolio-negative" : "";

  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{item.baseLabel} vs {item.candidateLabel}</h4>
        <p>{formatMarketScope(item.experiment.market_scope)} · {formatTimeframeScope(item.experiment.timeframe_scope)} · muestra {item.sampleSize}</p>
      </div>

      <div className="signal-analytics-list">
        <div className="signal-analytics-item is-experiment">
          <div className="signal-analytics-copy">
            <strong>Base</strong>
            <span>{item.basePrimaryCount} primarias · {item.baseWinRate.toFixed(0)}% acierto</span>
          </div>
          <div className={`signal-analytics-pnl ${item.basePrimaryPnl > 0 ? "is-positive" : item.basePrimaryPnl < 0 ? "is-negative" : ""}`}>
            {formatSignedPrice(item.basePrimaryPnl)}
          </div>
        </div>
        <div className="signal-analytics-item is-experiment">
          <div className="signal-analytics-copy">
            <strong>Candidata</strong>
            <span>{item.candidatePrimaryCount} primarias · {item.candidateWinRate.toFixed(0)}% acierto · {item.candidateAppearances} apariciones</span>
          </div>
          <div className={`signal-analytics-pnl ${item.candidatePrimaryPnl > 0 ? "is-positive" : item.candidatePrimaryPnl < 0 ? "is-negative" : ""}`}>
            {formatSignedPrice(item.candidatePrimaryPnl)}
          </div>
        </div>
      </div>

      <div className="stats-grid compact-stats-grid no-bottom-gap">
        <StatCard label="Ventaja candidata" value={formatSignedPrice(delta)} sub="Resultado candidata menos base" toneClass={deltaClass} accentClass="accent-blue" />
        <StatCard label="Lectura actual" value={item.recommendation} sub={item.recommendationReason} accentClass="accent-amber" />
      </div>
      <div className="inline-actions with-top-gap">
        <div className={`signal-analytics-pill status-${item.recommendationClass}`}>{item.recommendationStatus}</div>
        {item.experiment.status === "active" ? (
          <span className="signal-analytics-pill status-active">Ya gobierna el motor</span>
        ) : item.canPromote ? (
          <button className="btn-secondary-soft signal-inline-button" type="button" onClick={onPromote} disabled={isPromoting}>
            {isPromoting ? "Promoviendo..." : "Promover al motor activo"}
          </button>
        ) : !item.candidateRunnable ? (
          <span className="section-note">La candidata aún no es ejecutable por el watcher.</span>
        ) : null}
      </div>
    </div>
  );
}

function AdaptiveRecommendationCard({
  item,
  isActivating,
  onActivate,
}: {
  item: StrategyRecommendationRecord;
  isActivating: boolean;
  onActivate: () => void;
}) {
  const confidencePct = Math.round(Number(item.confidence || 0) * 100);
  const confidenceClass = confidencePct >= 75 ? "status-sandbox" : confidencePct >= 55 ? "status-draft" : "status-paused";
  const delta = Number(item.suggested_value || 0) - Number(item.current_value || 0);
  const evidence = item.evidence || {};
  const sampleSize = Number(evidence.sampleSize || 0);
  const sampleStrength = getSampleStrength(sampleSize);
  const candidateVersion = typeof evidence.candidateVersion === "string" ? evidence.candidateVersion : "";
  const experimentId = typeof evidence.experimentId === "number" ? evidence.experimentId : 0;
  const hasSandbox = item.status === "sandbox" && candidateVersion;
  const isScopeRecommendation = evidence.recommendationType === "execution-scope-override";
  const timeframe = String(evidence.timeframe || "");
  const currentMinRrRatio = Number(evidence.currentMinRrRatio || 0);
  const suggestedMinRrRatio = Number(evidence.suggestedMinRrRatio || 0);
  const appliedScope = evidence.appliedOverride && typeof evidence.appliedOverride === "object"
    ? evidence.appliedOverride as { strategyId?: string; timeframe?: string }
    : null;
  const scopeStrength = String(evidence.scopeStrength || "");
  const isScopeSandbox = isScopeRecommendation && item.status === "sandbox" && !appliedScope;
  const activationLabel = isScopeRecommendation
    ? isActivating
      ? "Aplicando override..."
      : item.status === "active"
        ? "Override aplicado al perfil demo"
        : item.status === "sandbox"
          ? "Promover al perfil demo"
          : "Mandar a prueba segura"
    : isActivating
      ? "Creando candidata..."
      : "Crear candidata y mandar a prueba segura";

  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{item.title}</h4>
        <p>{item.summary || "Sin resumen todavía."}</p>
      </div>

      <div className="signal-analytics-list">
        <div className="signal-analytics-item is-experiment">
          <div className="signal-analytics-copy">
            <strong>{getFriendlyStrategyVersionLabel(item.strategy_id, item.strategy_version)}</strong>
            <span>{isScopeRecommendation ? `Scope demo: ${item.strategy_id} · ${timeframe}` : `Parámetro: ${item.parameter_key}`}</span>
          </div>
          <div className={`signal-analytics-pill ${confidenceClass}`}>
            {confidencePct}% confianza
          </div>
        </div>
        <div className="signal-analytics-item is-experiment">
          <div className="signal-analytics-copy">
            <strong>Muestra {sampleStrength.label.toLowerCase()}</strong>
            <span>{sampleSize ? `${sampleSize} señales usadas como evidencia` : "Aún falta historial para confiar fuerte en este ajuste"}</span>
          </div>
          <div className={`signal-analytics-pill status-${sampleStrength.className}`}>
            {sampleStrength.label}
          </div>
        </div>
      </div>

      <div className="stats-grid compact-stats-grid no-bottom-gap">
        <StatCard
          label={isScopeRecommendation ? "Score demo actual" : "Valor actual"}
          value={String(item.current_value ?? "--")}
          sub={isScopeRecommendation ? `RR actual ${currentMinRrRatio.toFixed(2)}` : "Parámetro vigente"}
          accentClass="accent-blue"
        />
        <StatCard
          label={isScopeRecommendation ? "Score demo sugerido" : "Valor sugerido"}
          value={String(item.suggested_value ?? "--")}
          sub={isScopeRecommendation
            ? `RR sugerido ${suggestedMinRrRatio.toFixed(2)}`
            : delta === 0 ? "Sin cambio" : delta > 0 ? `Sube ${delta}` : `Baja ${Math.abs(delta)}`}
          accentClass="accent-emerald"
        />
      </div>

      <p className="section-note with-top-gap">
        Evidencia: {evidence.sampleSize ? `${String(evidence.sampleSize)} señales` : "sin muestra"} · {typeof evidence.winRate === "number" ? `${Number(evidence.winRate).toFixed(0)}% acierto` : "sin win rate"} · {typeof evidence.pnl === "number" ? formatSignedPrice(Number(evidence.pnl)) : "sin PnL"}{isScopeRecommendation && typeof evidence.avgScore === "number" ? ` · score medio ${Number(evidence.avgScore).toFixed(1)}` : ""}{isScopeRecommendation && typeof evidence.avgRr === "number" ? ` · RR medio ${Number(evidence.avgRr).toFixed(2)}` : ""}.
      </p>

      {isScopeRecommendation ? (
        <p className="section-note">
          {item.status === "draft"
            ? "Todavía está en borrador: primero la mandas a prueba segura antes de tocar el perfil demo."
            : item.status === "sandbox"
              ? scopeStrength === "weak"
                ? "Ya pasó a prueba segura. Si confirmas, este override endurece el filtro demo para cortar setups flojos en este scope."
                : "Ya pasó a prueba segura. Si confirmas, este override abre un poco el filtro demo en un scope que viene rindiendo mejor."
              : "Este ajuste ya quedó aplicado al perfil demo y participa en el filtro operativo actual."}
        </p>
      ) : null}

      <div className="inline-actions with-top-gap">
        {hasSandbox ? (
          <>
            <span className="signal-status-note">
              Variante candidata: <span className="text-strong">{getFriendlyStrategyVersionLabel(item.strategy_id, candidateVersion)}</span>
            </span>
            <span className="signal-analytics-pill status-sandbox">
              Prueba segura #{experimentId || "--"}
            </span>
          </>
        ) : isScopeRecommendation && item.status === "active" && appliedScope ? (
          <>
            <span className="signal-status-note">
              Override activo: <span className="text-strong">{appliedScope.strategyId} · {appliedScope.timeframe}</span>
            </span>
            <span className="signal-analytics-pill status-running">
              Perfil demo actualizado
            </span>
          </>
        ) : isScopeSandbox ? (
          <>
            <span className="signal-status-note">
              Estado actual: <span className="text-strong">Prueba segura del filtro demo</span>
            </span>
            <button className="btn-secondary-soft signal-inline-button" type="button" onClick={onActivate} disabled={isActivating}>
              {activationLabel}
            </button>
          </>
        ) : (
          <button className="btn-secondary-soft signal-inline-button" type="button" onClick={onActivate} disabled={isActivating}>
            {activationLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ExecutionCandidateCard({
  item,
  busy,
  onPreview,
  onExecute,
}: {
  item: ExecutionCandidate;
  busy: boolean;
  onPreview: () => void;
  onExecute: () => void;
}) {
  return (
    <div className={`execution-candidate-card ${item.status === "eligible" ? "is-eligible" : "is-blocked"}`}>
      <div className="execution-candidate-head">
        <div>
          <span className="automation-module-kicker">{item.coin} · {item.timeframe}</span>
          <h4>{item.signalLabel} con {getFriendlyStrategyVersionLabel(item.strategyName, item.strategyVersion)}</h4>
        </div>
        <div className={`signal-analytics-pill status-${item.status === "eligible" ? "sandbox" : "draft"}`}>
          {item.status === "eligible" ? "Operable" : "Bloqueada"}
        </div>
      </div>
      <div className="stats-grid compact-stats-grid no-bottom-gap">
        <StatCard label="Precio actual" value={formatPrice(item.currentPrice)} sub={`Score ${item.score}%`} accentClass="accent-blue" />
        <StatCard label="Tamaño" value={item.qty > 0 ? formatAmount(item.qty) : "--"} sub={item.notionalUsd > 0 ? formatPrice(item.notionalUsd) : "Sin tamaño válido"} accentClass="accent-emerald" />
        <StatCard label="RR" value={item.rrRatio ? item.rrRatio.toFixed(2) : "--"} sub={`SL ${formatPrice(item.plan.sl || 0)} · TP ${formatPrice(item.plan.tp || 0)}`} accentClass="accent-amber" />
      </div>
      <div className="inline-actions with-top-gap">
        <span className="signal-status-note">
          Flujo del motor: {formatDecisionSource(item.decisionSource)}
        </span>
        {item.profileOverride ? (
          <span className="signal-status-note">
            Override activo: {item.profileOverride.strategyId} · {item.profileOverride.timeframe} · Score {item.profileOverride.minSignalScore}+ · RR {item.profileOverride.minRrRatio.toFixed(2)}+
          </span>
        ) : null}
      </div>
      <div className="execution-reason-box">
        <strong>{item.status === "eligible" ? "Por qué sí puede pasar" : "Por qué quedó bloqueada"}</strong>
        <ul>
          {(item.reasons.length ? item.reasons : ["Cumple las reglas mínimas del perfil de riesgo para pasar a Binance Demo."]).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <div className="inline-actions with-top-gap">
        <button className="btn-secondary-soft signal-inline-button" type="button" onClick={onPreview} disabled={busy}>
          {busy ? "Procesando..." : "Preparar trade"}
        </button>
        <button className="btn-primary signal-inline-button" type="button" onClick={onExecute} disabled={busy || item.status !== "eligible"}>
          Enviar orden demo
        </button>
      </div>
    </div>
  );
}

function ExecutionOrderCard({ item }: { item: ExecutionOrderRecord }) {
  const protection = getExecutionProtectionSummary(item);

  return (
    <div className="experiment-record-card execution-order-card">
      <div className="experiment-record-main">
        <div className="experiment-record-topline">
          <strong>{item.coin} · {item.side || "--"} · {getFriendlyExecutionMode(item.mode)}</strong>
          <div className={`signal-analytics-pill status-${item.status === "placed" ? "sandbox" : item.status === "preview" ? "paused" : "draft"}`}>
            {getFriendlyExecutionStatus(item.status)}
          </div>
        </div>
        <div className="inline-actions">
          <span className={`signal-analytics-pill status-${getExecutionLifecycleTone(item.lifecycle_status || "")}`}>
            {getFriendlyExecutionLifecycle(item.lifecycle_status || item.status)}
          </span>
          {item.signal_outcome_status ? (
            <span className={`signal-analytics-pill status-${item.signal_outcome_status === "win" ? "sandbox" : item.signal_outcome_status === "loss" ? "draft" : "paused"}`}>
              Señal {item.signal_outcome_status === "win" ? "ganada" : item.signal_outcome_status === "loss" ? "perdida" : "invalidada"}
            </span>
          ) : null}
          <span className="signal-status-note">
            {item.origin === "watcher" ? "Auto por vigilante" : "Manual desde Señales"}
          </span>
        </div>
        <span className="experiment-record-meta">
          {item.strategy_name ? getFriendlyStrategyVersionLabel(item.strategy_name, item.strategy_version || "") : "Sin estrategia"} · {item.timeframe || "--"} · {new Date(item.created_at).toLocaleString("es-DO")}
        </span>
        <p className="experiment-record-summary">
          {item.notes || "Sin nota adicional."}
        </p>
        {typeof item.realized_pnl === "number" && item.realized_pnl !== 0 ? (
          <p className={`signal-status-note ${item.realized_pnl > 0 ? "is-positive" : "is-negative"}`}>
            Resultado real: {formatSignedPrice(item.realized_pnl)}
          </p>
        ) : null}
        {protection ? (
          <div className={`execution-protection-pill is-${protection.tone}`}>
            <strong>{protection.title}</strong>
            <span>{protection.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getExecutionProtectionSummary(item: ExecutionOrderRecord) {
  const payload = item.response_payload || {};
  const protection = (
    typeof payload === "object" && payload && "protection" in payload
      ? (payload as { protection?: { protectionAttached?: boolean; protectionMode?: string; protectionNote?: string } }).protection
      : null
  ) || null;

  if (!protection) return null;
  if (protection.protectionAttached) {
    return {
      tone: "success",
      title: "Protección activa",
      text: protection.protectionNote || "La orden quedó con salida protegida.",
    };
  }
  if (protection.protectionMode === "not-applicable") {
    return {
      tone: "neutral",
      title: "Sin protección adicional",
      text: protection.protectionNote || "Esta operación no necesitaba una salida protegida extra.",
    };
  }
  return {
    tone: "warning",
    title: "Protección pendiente",
    text: protection.protectionNote || "La orden salió, pero la protección no quedó montada.",
  };
}

function getFriendlyExecutionMode(mode: string) {
  if (mode === "execute") return "orden enviada";
  if (mode === "preview") return "solo preparación";
  return "modo no definido";
}

function getFriendlyExecutionStatus(status: string) {
  if (status === "placed") return "orden demo enviada";
  if (status === "preview") return "preparada para revisar";
  if (status === "blocked") return "bloqueada por reglas";
  if (status === "rejected") return "rechazada";
  return "sin estado";
}

function getFriendlyExecutionLifecycle(status: string) {
  if (status === "preview") return "Solo preparación";
  if (status === "blocked") return "Bloqueada";
  if (status === "protected") return "Protegida con salida";
  if (status === "filled_unprotected") return "Ejecutada sin protección";
  if (status === "filled") return "Ejecutada";
  if (status === "closed_win") return "Cerrada en ganancia";
  if (status === "closed_loss") return "Cerrada en pérdida";
  if (status === "closed_invalidated") return "Cerrada por invalidación";
  return "En seguimiento";
}

function getExecutionLifecycleTone(status: string) {
  if (status === "protected" || status === "closed_win") return "sandbox";
  if (status === "filled" || status === "filled_unprotected") return "paused";
  if (status === "closed_loss" || status === "blocked") return "draft";
  return "paused";
}

function SignalRow({
  signal,
  onSave,
}: {
  signal: SignalSnapshot;
  onSave: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}) {
  const [outcomeStatus, setOutcomeStatus] = useState<SignalOutcomeStatus>(signal.outcome_status);
  const [outcomePnl, setOutcomePnl] = useState(String(signal.outcome_pnl || 0));
  const [note, setNote] = useState(signal.note || "");
  const candidateSummary = getCandidateSummary(signal);
  const decisionSummary = getStrategyDecisionSummary(signal);

  return (
    <tr>
      <td>
        <div className="portfolio-asset">
          <strong>{signal.coin}</strong>
          <span>{signal.timeframe} · {signal.signal_label} · {new Date(signal.created_at).toLocaleString("es-DO")}</span>
          <span>{getStrategyDisplay(signal)}</span>
          {candidateSummary.length ? (
            <div className="strategy-candidate-list">
              {candidateSummary.map((candidate) => (
                <span key={`${signal.id}-${candidate.label}`} className={`strategy-candidate-pill ${candidate.isPrimary ? "is-primary" : ""}`}>
                  {candidate.isPrimary ? "Activa" : "Alternativa"}: {candidate.label} · {candidate.signalLabel} · {candidate.score}
                </span>
              ))}
            </div>
          ) : null}
          {decisionSummary ? <span className="signal-status-note">{decisionSummary}</span> : null}
        </div>
      </td>
      <td>
        <div className="portfolio-metric">
          <strong>{getSetupLabel(signal.setup_type || "Sin setup")}</strong>
          <span>{signal.setup_quality || "Media"} · Riesgo {signal.risk_label || "controlado"}</span>
        </div>
      </td>
      <td>
        <div className="portfolio-metric">
          <strong>{signal.entry_price ? formatPrice(signal.entry_price) : "--"}</strong>
          <span>TP1 {signal.tp_price ? formatPrice(signal.tp_price) : "--"} · SL {signal.sl_price ? formatPrice(signal.sl_price) : "--"}</span>
        </div>
      </td>
      <td>
        <div className="signal-status-block">
          <select className="timeframe-select signal-select" value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value as SignalOutcomeStatus)}>
            <option value="pending">Abierta</option>
            <option value="win">Ganada</option>
            <option value="loss">Perdida</option>
            <option value="invalidated">Invalidada</option>
          </select>
          <span className="signal-status-note">{describeSignalStatus(signal, outcomeStatus)}</span>
          {signal.execution_status ? (
            <span className="signal-status-note">
              Orden demo: {getFriendlyExecutionLifecycle(signal.execution_status)}
            </span>
          ) : null}
        </div>
      </td>
      <td>
        <div className="signal-pnl-block">
          <input className="signal-memory-input" value={outcomePnl} onChange={(e) => setOutcomePnl(e.target.value)} placeholder="0.00" />
          <span className={`signal-status-note ${Number(outcomePnl || 0) > 0 ? "is-positive" : Number(outcomePnl || 0) < 0 ? "is-negative" : ""}`}>
            {Number(outcomePnl || 0) !== 0 ? formatSignedPrice(Number(outcomePnl || 0)) : "Sin PnL registrado"}
          </span>
        </div>
      </td>
      <td>
        <div className="signal-note-block">
          <input className="signal-memory-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué pasó con esta señal" />
          <span className="signal-status-note">
            {note.includes("Auto-cerrada")
              ? "Cierre automático detectado"
              : outcomeStatus === "pending"
                ? "Todavía sin cierre"
                : "Cierre marcado manualmente"}
          </span>
        </div>
      </td>
      <td>
        <button className="btn-secondary-soft" type="button" onClick={() => onSave(signal.id, outcomeStatus, Number(outcomePnl || 0), note)}>
          Guardar
        </button>
      </td>
    </tr>
  );
}

function getStrategyDisplay(signal: SignalSnapshot) {
  const payloadStrategy = signal.signal_payload?.strategy;
  return getStrategyCandidateLabel(
    payloadStrategy?.id || signal.strategy_name,
    payloadStrategy?.version || signal.strategy_version,
    payloadStrategy?.label || signal.strategy_label,
  );
}

function getStrategyCandidateLabel(strategyId?: string, version?: string, label?: string) {
  const friendlyBase = getFriendlyStrategyName(strategyId, label);
  if (friendlyBase && version) return `${friendlyBase} ${version}`;
  if (friendlyBase) return friendlyBase;
  return "Sin estrategia";
}

function getFriendlyStrategyName(strategyId?: string, label?: string) {
  if (strategyId === "trend-alignment") return "Tendencia alineada";
  if (strategyId === "breakout") return "Ruptura";
  if (label === "Trend Alignment") return "Tendencia alineada";
  if (label === "Breakout") return "Ruptura";
  return label || strategyId || "Sin estrategia";
}

function getFriendlyStrategyVersionLabel(strategyId: string, version: string, label?: string) {
  return `${getFriendlyStrategyName(strategyId, label)} ${version}`;
}

function isRunnableStrategyVersion(strategyId?: string, version?: string) {
  return RUNNABLE_STRATEGY_VERSION_KEYS.has(`${String(strategyId || "")}:${String(version || "")}`);
}

function getSampleStrength(sampleSize: number) {
  if (sampleSize >= 12) {
    return { label: "Fuerte", className: "sandbox" };
  }
  if (sampleSize >= 6) {
    return { label: "Aceptable", className: "draft" };
  }
  return { label: "Insuficiente", className: "paused" };
}

function getPreferredTimeframeScopeForVersion(version?: StrategyVersionRecord) {
  return version?.preferred_timeframes?.length ? version.preferred_timeframes.join(",") : "all";
}

function getCandidateSummary(signal: SignalSnapshot) {
  const candidates = signal.signal_payload?.candidates || [];
  return candidates.slice(0, 3).map((candidate) => ({
    label: getStrategyCandidateLabel(candidate.strategy?.id, candidate.strategy?.version, candidate.strategy?.label),
    signalLabel: candidate.signalLabel || "--",
    score: Number(candidate.score || 0),
    isPrimary: Boolean(candidate.isPrimary),
  }));
}

function getStrategyDecisionSummary(signal: SignalSnapshot) {
  const candidates = getCandidateSummary(signal);
  const primary = candidates.find((candidate) => candidate.isPrimary) || candidates[0];
  const alternative = candidates.find((candidate) => !candidate.isPrimary);
  if (!primary) return "";
  if (!alternative) return `El motor dejó activa a ${primary.label} porque no encontró una candidata igual de fuerte en esa lectura.`;
  const gap = primary.score - alternative.score;
  if (gap <= 0) return `El motor vio una competencia muy pareja entre ${primary.label} y ${alternative.label}.`;
  return `El motor eligió ${primary.label} porque superó a ${alternative.label} por ${gap} puntos de score.`;
}

function evaluatePromotion(baseline?: AggregateRow, candidate?: AggregateRow) {
  if (!baseline || !candidate) {
    return {
      title: "Todavía no hay base suficiente",
      reason: "Hace falta más historial cerrado para comparar versiones con confianza.",
      statusLabel: "Observando",
      statusClass: "paused",
    };
  }

  const sampleReady = baseline.total >= 5 && candidate.total >= 5;
  const pnlDelta = candidate.pnl - baseline.pnl;
  const winRateDelta = candidate.winRate - baseline.winRate;

  if (!sampleReady) {
    return {
      title: "Seguir observando",
      reason: "Todavía no hay suficiente muestra cerrada en ambas versiones para tomar una decisión seria.",
      statusLabel: "Observando",
      statusClass: "paused",
    };
  }

  if (candidate.pnl > baseline.pnl && candidate.total >= 10 && baseline.total >= 10) {
    return {
      title: "Promoción controlada posible",
      reason: `La candidata ya muestra una ventaja de ${formatSignedPrice(pnlDelta)} con muestra suficiente, pero todavía conviene validarla por contexto.`,
      statusLabel: "Activa",
      statusClass: "active",
    };
  }

  if (candidate.pnl > baseline.pnl && candidate.winRate >= baseline.winRate && pnlDelta > 0) {
    return {
      title: "Lista para prueba segura",
      reason: `La variante candidata supera a la base por ${formatSignedPrice(pnlDelta)} y ${winRateDelta.toFixed(0)} puntos de acierto.`,
      statusLabel: "Prueba segura",
      statusClass: "sandbox",
    };
  }

  return {
    title: "Mantener versión base",
    reason: `La candidata todavía no mejora de forma consistente a la base. Diferencia actual: ${formatSignedPrice(pnlDelta)} y ${winRateDelta.toFixed(0)} puntos de acierto.`,
    statusLabel: "Base",
    statusClass: "draft",
  };
}

function describeSignalStatus(signal: SignalSnapshot, selectedStatus: SignalOutcomeStatus) {
  if (selectedStatus === "pending") {
    return `Abierta desde ${new Date(signal.created_at).toLocaleString("es-DO")}`;
  }

  const closedAt = signal.updated_at || signal.created_at;
  const closeLabel = selectedStatus === "win" ? "Cerrada en ganancia" : selectedStatus === "loss" ? "Cerrada en pérdida" : "Invalidada";
  return `${closeLabel} el ${new Date(closedAt).toLocaleString("es-DO")}`;
}

function buildExperimentPaperStats(
  experiment: StrategyExperimentRecord,
  signals: SignalSnapshot[],
  watchlist: string[],
): ExperimentPaperStats {
  const metadata = experiment.metadata || {};
  const baseVersion = typeof metadata.baseVersion === "string"
    ? metadata.baseVersion
    : experiment.base_strategy_id === experiment.candidate_strategy_id && experiment.candidate_version !== "v1"
      ? "v1"
      : undefined;

  const relevantSignals = signals.filter((signal) => {
    const inMarketScope = experiment.market_scope !== "watchlist" || !watchlist.length || watchlist.includes(signal.coin);
    const inTimeframeScope = !experiment.timeframe_scope
      || experiment.timeframe_scope === "all"
      || experiment.timeframe_scope.split(",").map((item) => item.trim()).includes(signal.timeframe);
    return inMarketScope && inTimeframeScope;
  });

  const basePrimarySignals = relevantSignals.filter((signal) => matchesStrategy(signal, experiment.base_strategy_id, baseVersion, true));
  const candidatePrimarySignals = relevantSignals.filter((signal) => matchesStrategy(signal, experiment.candidate_strategy_id, experiment.candidate_version, true));
  const candidateAppearances = relevantSignals.filter((signal) => matchesStrategy(signal, experiment.candidate_strategy_id, experiment.candidate_version, false)).length;

  const baseClosed = basePrimarySignals.filter((signal) => signal.outcome_status !== "pending");
  const candidateClosed = candidatePrimarySignals.filter((signal) => signal.outcome_status !== "pending");
  const basePrimaryPnl = baseClosed.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
  const candidatePrimaryPnl = candidateClosed.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
  const baseWinRate = baseClosed.length ? (baseClosed.filter((signal) => signal.outcome_status === "win").length / baseClosed.length) * 100 : 0;
  const candidateWinRate = candidateClosed.length ? (candidateClosed.filter((signal) => signal.outcome_status === "win").length / candidateClosed.length) * 100 : 0;

  const recommendation = candidateClosed.length < 3
    ? "Muestra corta"
    : candidatePrimaryPnl > basePrimaryPnl && candidateWinRate >= baseWinRate
      ? "Candidata arriba"
      : candidatePrimaryPnl < basePrimaryPnl
        ? "Base resiste mejor"
        : "Empate técnico";
  const promotionReading = evaluatePromotion(
    baseClosed.length
      ? { label: "base", total: baseClosed.length, wins: 0, losses: 0, invalidated: 0, pnl: basePrimaryPnl, avgPnl: 0, winRate: baseWinRate }
      : undefined,
    candidateClosed.length
      ? { label: "candidate", total: candidateClosed.length, wins: 0, losses: 0, invalidated: 0, pnl: candidatePrimaryPnl, avgPnl: 0, winRate: candidateWinRate }
      : undefined,
  );
  const candidateRunnable = isRunnableStrategyVersion(experiment.candidate_strategy_id, experiment.candidate_version);

  return {
    experiment,
    baseLabel: baseVersion ? getStrategyCandidateLabel(experiment.base_strategy_id, baseVersion) : getFriendlyStrategyName(experiment.base_strategy_id),
    candidateLabel: getStrategyCandidateLabel(experiment.candidate_strategy_id, experiment.candidate_version),
    sampleSize: relevantSignals.length,
    basePrimaryCount: basePrimarySignals.length,
    candidatePrimaryCount: candidatePrimarySignals.length,
    basePrimaryPnl,
    candidatePrimaryPnl,
    baseWinRate,
    candidateWinRate,
    candidateAppearances,
    recommendation,
    recommendationReason: promotionReading.reason,
    recommendationStatus: promotionReading.statusLabel,
    recommendationClass: promotionReading.statusClass,
    canPromote: promotionReading.statusClass === "active" && candidateRunnable && experiment.status !== "active",
    candidateRunnable,
  };
}

function matchesStrategy(signal: SignalSnapshot, strategyId: string, version?: string, primaryOnly = false) {
  const primaryId = signal.signal_payload?.strategy?.id || signal.strategy_name;
  const primaryVersion = signal.signal_payload?.strategy?.version || signal.strategy_version;

  if (primaryId === strategyId && (!version || primaryVersion === version)) return true;
  if (primaryOnly) return false;

  return (signal.signal_payload?.candidates || []).some((candidate) =>
    candidate.strategy?.id === strategyId && (!version || candidate.strategy?.version === version));
}

function getExperimentStatusLabel(status: string) {
  if (status === "draft") return "Borrador";
  if (status === "sandbox") return "Prueba segura";
  if (status === "active" || status === "running") return "Activa";
  if (status === "paused") return "Observando";
  if (status === "archived") return "Archivada";
  return status;
}

function formatDecisionSource(source?: string) {
  if (source === "active") return "Estrategia activa";
  if (source === "promoted") return "Versión promovida";
  if (source === "experiment-active") return "Experimento ya habilitado";
  if (source === "sandbox") return "Solo observación";
  if (source === "inactive") return "Fuera del motor actual";
  return "Flujo heredado";
}

function formatScannerStatus(status?: string) {
  if (status === "ok") return "estable";
  if (status === "partial") return "parcial";
  if (status === "error") return "con errores";
  return status || "desconocido";
}

function getExperimentTitle(item: StrategyExperimentRecord) {
  const baseVersion = typeof item.metadata?.baseVersion === "string" ? String(item.metadata.baseVersion) : item.base_strategy_id === item.candidate_strategy_id ? "v1" : undefined;
  const baseLabel = baseVersion ? getStrategyCandidateLabel(item.base_strategy_id, baseVersion) : getFriendlyStrategyName(item.base_strategy_id);
  const candidateLabel = getStrategyCandidateLabel(item.candidate_strategy_id, item.candidate_version);
  return `${baseLabel} vs ${candidateLabel}`;
}

function getSetupLabel(setup: string) {
  if (!setup) return "Sin clasificar";
  const normalized = setup.toLowerCase();
  if (normalized.includes("breakout")) return "Ruptura";
  if (normalized.includes("pullback")) return "Retroceso";
  if (normalized.includes("contra")) return "Contra tendencia";
  if (normalized.includes("continu")) return "Continuación";
  if (normalized.includes("espera")) return "Espera";
  return setup;
}

function formatMarketScope(scope?: string) {
  if (!scope || scope === "all") return "Todo el mercado";
  if (scope === "watchlist") return "Solo watchlist";
  if (scope === "trend") return "Mercado en tendencia";
  if (scope === "range") return "Mercado en rango";
  return scope;
}

function formatTimeframeScope(scope?: string) {
  if (!scope || scope === "all") return "Todos los marcos";
  return scope;
}
