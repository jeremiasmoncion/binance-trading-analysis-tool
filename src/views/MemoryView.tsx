import { useEffect, useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatPrice, formatSignedPrice } from "../lib/format";
import { strategyEngineService } from "../services/api";
import type {
  SignalOutcomeStatus,
  SignalSnapshot,
  StrategyExperimentRecord,
  StrategyRegistryEntry,
  StrategyRecommendationRecord,
  StrategyVersionRecord,
} from "../types";

interface MemoryViewProps {
  signals: SignalSnapshot[];
  watchlist: string[];
  onUpdateSignal: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
}

type SignalsTab = "overview" | "performance" | "strategies" | "adaptive" | "experiments" | "history";

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

  const availableCandidateVersions = useMemo(
    () => versions.filter((item) => item.strategy_id === experimentCandidate),
    [experimentCandidate, versions],
  );

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
        timeframeScope: "1h,4h",
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

  return (
    <div id="memoryView" className="view-panel active">
      <section id="signals-overview">
        <SectionCard
          title="Centro de señales"
          subtitle="Este es el corazón del sistema. Aquí ves el historial, el rendimiento y las pruebas de las señales para que entiendas qué está funcionando mejor."
        />
      </section>

      <ModuleTabs
        items={[
          { key: "overview", label: "Resumen" },
          { key: "performance", label: "Rendimiento" },
          { key: "strategies", label: "Estrategias" },
          { key: "adaptive", label: "Ajustes IA" },
          { key: "experiments", label: "Pruebas" },
          { key: "history", label: "Historial" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as SignalsTab)}
      />

      {activeTab === "overview" ? (
        <>
          <SectionCard
            title="Cómo leer esta página"
            subtitle="Lo dejamos simple para que cualquier persona entienda qué está viendo y qué significa cada bloque."
          >
            <div className="signal-analytics-grid">
              <InfoCard
                title="Señal guardada"
                text="Es una foto completa de una oportunidad detectada por el sistema, con plan, estrategia usada y resultado final."
              />
              <InfoCard
                title="Pendiente"
                text="La señal sigue abierta. Todavía no llegó al objetivo ni al stop, o no se ha cerrado manualmente."
              />
              <InfoCard
                title="Tipo de entrada"
                text="Es la clase de oportunidad detectada. Por ejemplo, tendencia alineada o ruptura."
              />
              <InfoCard
                title="Prueba segura"
                text="Es una variante que el sistema está observando con cuidado antes de recomendar usarla más fuerte."
              />
            </div>
          </SectionCard>

          <div className="stats-grid">
            <StatCard label="Señales guardadas" value={String(props.signals.length)} sub="Historial técnico registrado" accentClass="accent-blue" />
            <StatCard label="Porcentaje de acierto" value={`${winRate.toFixed(0)}%`} sub={`${wins} ganadas de ${completedSignals.length} cerradas`} accentClass="accent-green" />
            <StatCard label="Resultado neto" value={formatPrice(totalPnl)} sub={`${losses} pérdidas · ${invalidated} invalidadas`} toneClass={totalPnl > 0 ? "portfolio-positive" : totalPnl < 0 ? "portfolio-negative" : ""} accentClass="accent-emerald" />
            <StatCard label="Pendientes" value={String(props.signals.filter((item) => item.outcome_status === "pending").length)} sub="Señales todavía abiertas" accentClass="accent-amber" />
          </div>

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
            <StatCard label="Pendientes en período" value={String(periodPending)} sub={`Todavía abiertas en ${periodLabel}`} accentClass="accent-emerald" />
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
            title="Rendimiento del sistema"
            subtitle={`Aquí ves qué está funcionando mejor y peor en ${periodLabel}.`}
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
            title="Comparador de estrategias"
            subtitle="Aquí ves qué estrategia está mandando, cuál le está compitiendo más cerca y qué conviene hacer con las variantes."
          >
            <div className="signal-analytics-grid">
              <InfoCard
                title="Qué está mandando ahora"
                text={strategyPrimaryCounts[0]
                  ? `${strategyPrimaryCounts[0].label} es la estrategia que más veces terminó siendo la lectura principal en ${periodLabel}.`
                  : "Todavía no hay suficiente historial para definir una estrategia dominante."}
              />
              <InfoCard
                title="Qué le está compitiendo"
                text={strongestAlternative
                  ? `${strongestAlternative.label} es la alternativa que más veces apareció cerca del resultado final del motor.`
                  : "Cuando varias estrategias compitan de verdad, aquí verás cuál está más cerca de destronar a la principal."}
              />
              <InfoCard
                title="Qué conviene hacer"
                text={`${trendPromotionRecommendation.title}. ${trendPromotionRecommendation.reason}`}
              />
            </div>

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
          <SectionCard
            title="Recomendación del sistema"
            subtitle="Aquí el sistema te indica si una variante debe seguir observándose, pasar a prueba segura o mantenerse como referencia."
          >
            <div className="signal-analytics-list">
              <div className="signal-analytics-item is-experiment">
                <div className="signal-analytics-copy">
                  <strong>{trendPromotionRecommendation.title}</strong>
                  <span>{trendPromotionRecommendation.reason}</span>
                </div>
                <div className={`signal-analytics-pill status-${trendPromotionRecommendation.statusClass}`}>
                  {trendPromotionRecommendation.statusLabel}
                </div>
              </div>
            </div>
            <div className="inline-actions with-top-gap">
              {!recommendedExperiment ? (
                <button className="btn-secondary-soft signal-inline-button" type="button" onClick={() => void handleCreateRecommendedExperiment()}>
                  Crear prueba sugerida
                </button>
              ) : (
                <>
                  <span className="section-note">
                    Prueba actual: <span className="text-strong">{getExperimentStatusLabel(recommendedExperiment.status)}</span> · {recommendedExperiment.market_scope || "all"} · {recommendedExperiment.timeframe_scope || "all"}
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
            title="Laboratorio de pruebas"
            subtitle="Crea comparativas entre estrategias o versiones para ver cuál funciona mejor antes de fortalecerla."
          >
            <div className="memory-filter-bar">
              <select className="timeframe-select signal-select" value={experimentBase} onChange={(event) => setExperimentBase(event.target.value)}>
                {registry.map((item) => (
                  <option key={`base-${item.strategy_id}`} value={item.strategy_id}>{getFriendlyStrategyName(item.strategy_id, item.label)}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={experimentCandidate} onChange={(event) => setExperimentCandidate(event.target.value)}>
                {registry.map((item) => (
                  <option key={`candidate-${item.strategy_id}`} value={item.strategy_id}>{getFriendlyStrategyName(item.strategy_id, item.label)}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={experimentVersion} onChange={(event) => setExperimentVersion(event.target.value)}>
                {availableCandidateVersions.map((item) => (
                  <option key={`${item.strategy_id}-${item.version}`} value={item.version}>{getFriendlyStrategyVersionLabel(item.strategy_id, item.version, item.label)}</option>
                ))}
              </select>
              <select className="timeframe-select signal-select" value={experimentMarketScope} onChange={(event) => setExperimentMarketScope(event.target.value)}>
                <option value="all">Todo el mercado</option>
                <option value="watchlist">Solo watchlist</option>
                <option value="trend">Mercado en tendencia</option>
                <option value="range">Mercado en rango</option>
              </select>
              <select className="timeframe-select signal-select" value={experimentTimeframeScope} onChange={(event) => setExperimentTimeframeScope(event.target.value)}>
                <option value="all">Todos los marcos</option>
                {timeframes.map((item) => (
                  <option key={`scope-${item}`} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="signal-note-block with-bottom-gap">
              <input
                className="signal-memory-input"
                value={experimentSummary}
                onChange={(event) => setExperimentSummary(event.target.value)}
                placeholder="Qué quieres comparar o validar con esta prueba"
              />
              <span className="signal-status-note">
                La IA futura debería observar estas pruebas primero, no cambiar el sistema sola desde el inicio.
              </span>
            </div>
            <button className="btn-secondary-soft" type="button" onClick={() => void handleCreateExperiment()}>
              Crear prueba borrador
            </button>

            <div className="signal-analytics-list with-top-gap">
              {!experiments.length ? (
                <p className="section-note">Todavía no hay pruebas guardadas. Crea la primera para empezar a comparar variantes.</p>
              ) : (
                experiments.map((item) => (
                  <div key={`experiment-${item.id}`} className="signal-analytics-item is-experiment">
                    <div className="signal-analytics-copy">
                      <strong>{getExperimentTitle(item)}</strong>
                      <span>
                        {item.market_scope || "all"} · {item.timeframe_scope || "all"} · {item.summary || "Sin resumen todavía"}
                        {item.metadata?.recommendationStatus ? ` · ${String(item.metadata.recommendationStatus)}` : ""}
                      </span>
                    </div>
                    <div className={`signal-analytics-pill status-${item.status}`}>{getExperimentStatusLabel(item.status)}</div>
                  </div>
                ))
              )}
            </div>

            <p className="section-note with-top-gap">
              Recomendación base del sistema: comparar `Tendencia alineada v1` vs `Tendencia alineada v2` en el watchlist y en marcos `1h` / `4h` antes de fortalecer cambios.
            </p>
          </SectionCard>

          <SectionCard
            title="Seguimiento de prueba segura"
            subtitle="Aquí ves cómo le va a cada variante que ya está en observación controlada."
          >
            {!sandboxStats.length ? (
              <p className="section-note">Todavía no hay pruebas seguras activas. Cuando una pase de borrador a prueba segura, aparecerá aquí con su lectura comparativa.</p>
            ) : (
              <div className="signal-analytics-grid">
                {sandboxStats.map((item) => (
                  <PaperTestingCard key={`sandbox-${item.experiment.id}`} item={item} />
                ))}
              </div>
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "adaptive" ? (
        <section id="signals-adaptive">
          <SectionCard
            title="Ajustes sugeridos por IA"
            subtitle="Aquí el sistema observa el historial y propone cambios de parámetros. Todavía no toca producción: solo recomienda y deja evidencia."
            actions={
              <button className="btn-secondary-soft" type="button" onClick={() => void handleGenerateRecommendations()}>
                Generar sugerencias
              </button>
            }
          >
            <div className="signal-analytics-grid">
              <InfoCard
                title="Cómo leer esto"
                text="Cada sugerencia nace del rendimiento histórico real. La IA mira qué contextos funcionan mal o bien y propone un ajuste concreto para probarlo antes en sandbox."
              />
              <InfoCard
                title="Qué NO hace todavía"
                text="No cambia parámetros sola, no promueve versiones a producción y no opera por su cuenta. Solo recomienda el siguiente ajuste razonable."
              />
            </div>

            <div className="stats-grid">
              <StatCard label="Sugerencias activas" value={String(recommendations.length)} sub="Ajustes abiertos en observación" accentClass="accent-blue" />
              <StatCard label="Confianza alta" value={String(recommendations.filter((item) => Number(item.confidence || 0) >= 0.75).length)} sub="Sugerencias con evidencia más fuerte" accentClass="accent-emerald" />
              <StatCard label="Estrategias tocadas" value={String(new Set(recommendations.map((item) => item.strategy_id)).size)} sub="Cuántas familias reciben ajustes" accentClass="accent-amber" />
              <StatCard label="Promedio de confianza" value={recommendations.length ? `${Math.round((recommendations.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / recommendations.length) * 100)}%` : "--"} sub="Lectura agregada de seguridad" accentClass="accent-blue" />
            </div>

            {!recommendations.length ? (
              <EmptyState message="Todavía no hay sugerencias adaptativas. Usa el botón Generar sugerencias cuando ya tengas suficiente historial cerrado." />
            ) : (
              <div className="signal-analytics-grid">
                {recommendations.map((item) => (
                  <AdaptiveRecommendationCard key={`${item.recommendation_key}-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </SectionCard>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section id="signals-history">
          <SectionCard
            title="Historial de señales"
            subtitle="Aquí revisas cada señal guardada, su plan, su estado y el resultado final. Solo trabaja con monedas de tu watchlist."
          >
            <p className="section-note with-bottom-gap">
              Monedas en watchlist: {props.watchlist.length ? props.watchlist.join(", ") : "todavía no has marcado ninguna con estrella"}.
            </p>
            <p className="section-note with-bottom-gap">
              `Pendiente` significa que la señal sigue abierta: todavía no ha tocado el objetivo ni la invalidación, o aún no la has cerrado manualmente.
            </p>
            <p className="section-note with-bottom-gap">
              `Activa` es la estrategia que ganó en esa lectura. `Alternativa` te enseña qué otra estrategia estuvo cerca para que entiendas por qué el motor eligió una y no otra.
            </p>
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
                <option value="pending">Pendiente</option>
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
                    filteredSignals.map((signal) => (
                      <SignalRow key={signal.id} signal={signal} onSave={props.onUpdateSignal} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="signal-analytics-card">
      <div className="signal-analytics-head">
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
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

function PaperTestingCard({ item }: { item: ExperimentPaperStats }) {
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
        <StatCard label="Lectura actual" value={item.recommendation} sub="La prueba segura compara antes de promover" accentClass="accent-amber" />
      </div>
    </div>
  );
}

function AdaptiveRecommendationCard({ item }: { item: StrategyRecommendationRecord }) {
  const confidencePct = Math.round(Number(item.confidence || 0) * 100);
  const confidenceClass = confidencePct >= 75 ? "status-sandbox" : confidencePct >= 55 ? "status-draft" : "status-paused";
  const delta = Number(item.suggested_value || 0) - Number(item.current_value || 0);
  const evidence = item.evidence || {};

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
            <span>Parámetro: {item.parameter_key}</span>
          </div>
          <div className={`signal-analytics-pill ${confidenceClass}`}>
            {confidencePct}% confianza
          </div>
        </div>
      </div>

      <div className="stats-grid compact-stats-grid no-bottom-gap">
        <StatCard label="Valor actual" value={String(item.current_value ?? "--")} sub="Parámetro vigente" accentClass="accent-blue" />
        <StatCard label="Valor sugerido" value={String(item.suggested_value ?? "--")} sub={delta === 0 ? "Sin cambio" : delta > 0 ? `Sube ${delta}` : `Baja ${Math.abs(delta)}`} accentClass="accent-emerald" />
      </div>

      <p className="section-note with-top-gap">
        Evidencia: {evidence.sampleSize ? `${String(evidence.sampleSize)} señales` : "sin muestra"} · {typeof evidence.winRate === "number" ? `${Number(evidence.winRate).toFixed(0)}% acierto` : "sin win rate"} · {typeof evidence.pnl === "number" ? formatSignedPrice(Number(evidence.pnl)) : "sin PnL"}.
      </p>
    </div>
  );
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
            <option value="pending">Pendiente</option>
            <option value="win">Ganada</option>
            <option value="loss">Perdida</option>
            <option value="invalidated">Invalidada</option>
          </select>
          <span className="signal-status-note">{describeSignalStatus(signal, outcomeStatus)}</span>
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

  if (candidate.pnl > baseline.pnl && candidate.winRate >= baseline.winRate && pnlDelta > 0) {
    return {
      title: "Lista para prueba segura",
      reason: `La variante candidata supera a la base por ${formatSignedPrice(pnlDelta)} y ${winRateDelta.toFixed(0)} puntos de acierto.`,
      statusLabel: "Prueba segura",
      statusClass: "sandbox",
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
