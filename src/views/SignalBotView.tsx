import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DownloadIcon, SearchIcon, SlidersHorizontalIcon } from "../components/Icons";
import { PaginationControls, paginateRows } from "../components/ui/PaginationControls";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { useSelectedBotState } from "../hooks/useSelectedBot";
import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import { binanceService, marketService } from "../services/api";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type { BotCanonicalTrade, BotDecisionRecord, RankedPublishedSignal } from "../domain";
import type { SignalSnapshot, ViewName } from "../types";

type SignalBotTab = "active-signals" | "signal-history" | "bot-activity" | "performance" | "settings";
type SignalFilter = "all" | "buy" | "sell";
type SignalCardDirection = "BUY" | "SELL" | "NEUTRAL";
type SignalHistoryDirectionFilter = "all" | "buy" | "sell";
type SignalHistoryTradeStatus = "completed" | "loss" | "stopped" | "protected";
type SignalBotActivityFilter = "all" | "blocked" | "review" | "queue" | "preview" | "handoff";
type SignalBotActivityStatusKey = "blocked" | "review" | "queue" | "preview" | "handoff";

interface SignalHistoryRow {
  id: string;
  pair: string;
  timeframe: string;
  side: SignalCardDirection;
  typeLabel: string;
  statusKey: SignalHistoryTradeStatus;
  statusLabel: string;
  statusTone: string;
  typeTone: string;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  startedAt: string;
  endedAt: string;
  dateAt: string;
  pairNote: string;
}

interface SignalBotActivityRow {
  id: string;
  pair: string;
  timeframe: string;
  actionLabel: string;
  actionTone: string;
  statusKey: SignalBotActivityStatusKey;
  statusLabel: string;
  statusTone: string;
  reason: string;
  dateAt: string;
  pairNote: string;
}

interface SignalOperationalInsight {
  label: string;
  value: string;
  note: string;
  tone: "positive" | "negative" | "neutral";
}

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

const FILTER_CHIPS: Array<{ key: SignalFilter; label: string }> = [
  { key: "all", label: "All Signals" },
  { key: "buy", label: "Buy Only" },
  { key: "sell", label: "Sell Only" },
];

const SIGNAL_BOT_PAIR_OPTIONS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "PAXG/USDT",
  "DOGE/USDT",
  "AVAX/USDT",
  "LINK/USDT",
] as const;

const SIGNAL_BOT_TIMEFRAME_OPTIONS = [
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
] as const;

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const [activeFilter, setActiveFilter] = useState<SignalFilter>("all");
  const [activeSignalsPage, setActiveSignalsPage] = useState(1);
  const [signalHistoryPage, setSignalHistoryPage] = useState(1);
  const [signalActivityPage, setSignalActivityPage] = useState(1);
  const [signalHistoryPairFilter, setSignalHistoryPairFilter] = useState("all");
  const [signalHistoryDirectionFilter, setSignalHistoryDirectionFilter] = useState<SignalHistoryDirectionFilter>("all");
  const [signalBotActivityFilter, setSignalBotActivityFilter] = useState<SignalBotActivityFilter>("all");
  const [observedSignalDetail, setObservedSignalDetail] = useState<{
    signal: RankedPublishedSignal;
    snapshot?: SignalSnapshot;
    direction: SignalCardDirection;
    entry: number;
    target: number;
    stopLoss: number;
  } | null>(null);
  const [maxPositionDraft, setMaxPositionDraft] = useState("0");
  const [capitalDraft, setCapitalDraft] = useState("0");
  const [accountCapitalPoolUsd, setAccountCapitalPoolUsd] = useState(0);
  const [isPairDrawerOpen, setIsPairDrawerOpen] = useState(false);
  const [pairDraft, setPairDraft] = useState("BTC/USDT");
  const [pairQuery, setPairQuery] = useState("BTC/USDT");
  const [pairSearchOpen, setPairSearchOpen] = useState(false);
  const [pairSearchLoading, setPairSearchLoading] = useState(false);
  const [exchangePairUniverse, setExchangePairUniverse] = useState<string[]>([]);
  const [pairExchangeDraft, setPairExchangeDraft] = useState("Binance Demo");
  const [pairAiAnalysisDraft, setPairAiAnalysisDraft] = useState(true);
  const [isTimeframeDrawerOpen, setIsTimeframeDrawerOpen] = useState(false);
  const [timeframeDraft, setTimeframeDraft] = useState("1h");
  const feedReadModel = useSignalsBotsReadModel();
  const { createDecision } = useBotDecisionsState();
  const { updateBot } = useSelectedBotState();
  const signals = feedReadModel.signalMemory;
  const selectedBotCard = feedReadModel.selectedBotCard || feedReadModel.botCards[0] || null;
  const selectedBotSignals = feedReadModel.selectedBotScopedRankedSignals;
  const selectedBotDecisions = feedReadModel.selectedBotDecisions;
  const selectedBotActivityTimeline = feedReadModel.selectedBotActivityTimeline;
  const selectedBotBlockedCount = feedReadModel.selectedBotBlockedSignals.length;
  const hasRealBotSignalFlow = Boolean(
    selectedBotDecisions.length
    || selectedBotActivityTimeline.length
    || selectedBotCard?.activity.pendingCount
    || selectedBotCard?.activity.approvedCount
    || selectedBotCard?.activity.executedCount
    || selectedBotCard?.activity.lastSignalConsumedAt,
  );

  const readModel = useMemo(() => {
    const scopedSignalFeed = prioritizeSignalsForDisplay(selectedBotSignals);
    const openSignals = selectedBotDecisions.filter((decision) => decision.status === "pending" || decision.status === "approved");
    const cards = scopedSignalFeed.map((signal: RankedPublishedSignal) => {
      const snapshot = findSnapshotForPublishedSignal(signal.id, signals)
        || findSnapshotForSignal(signal.context.symbol, signal.context.timeframe, signals);
      const direction = getDisplaySignalDirection(signal, snapshot);
      return {
        signal,
        snapshot,
        direction,
        entry: Number(snapshot?.entry_price || snapshot?.support || 0),
        target: Number(snapshot?.tp_price || snapshot?.tp2_price || snapshot?.resistance || 0),
        stopLoss: Number(snapshot?.sl_price || 0),
      };
    });

    return {
      priority: scopedSignalFeed,
      highConfidence: feedReadModel.highConfidenceSignals,
      watchlistFirst: feedReadModel.watchlistFirstSignals,
      botApproved: selectedBotSignals,
      botBlockedCount: selectedBotBlockedCount,
      botDecisions: selectedBotDecisions,
      openSignals,
      cards,
      filteredCards: cards.filter((card) => matchesFilter(card.signal, card.direction, activeFilter)),
      closedHistory: feedReadModel.selectedBotTradeTimeline,
      performanceBreakdowns: feedReadModel.selectedBotPerformanceBreakdowns.slice(0, 6),
    };
  }, [activeFilter, feedReadModel.selectedBotPerformanceBreakdowns, feedReadModel.selectedBotTradeTimeline, hasRealBotSignalFlow, selectedBotBlockedCount, selectedBotDecisions, selectedBotSignals, signals]);

  const pagedActiveSignals = useMemo(
    () => paginateRows(readModel.filteredCards, activeSignalsPage, 6),
    [activeSignalsPage, readModel.filteredCards],
  );
  const signalHistoryRows = useMemo(
    () => readModel.closedHistory
      .map((entry) => createSignalHistoryRow(entry, signals))
      .filter((row): row is SignalHistoryRow => Boolean(row)),
    [readModel.closedHistory, signals],
  );
  const filteredSignalHistory = useMemo(
    () => signalHistoryRows.filter((row) => {
      const pairMatches = signalHistoryPairFilter === "all" || row.pair === signalHistoryPairFilter;
      const directionMatches = signalHistoryDirectionFilter === "all"
        || (signalHistoryDirectionFilter === "buy" && row.side === "BUY")
        || (signalHistoryDirectionFilter === "sell" && row.side === "SELL");
      return pairMatches && directionMatches;
    }),
    [signalHistoryDirectionFilter, signalHistoryPairFilter, signalHistoryRows],
  );
  const pagedSignalHistory = useMemo(
    () => paginateRows(filteredSignalHistory, signalHistoryPage, 10),
    [filteredSignalHistory, signalHistoryPage],
  );
  const signalBotActivityRows = useMemo(
    () => createSignalBotActivityRows(selectedBotActivityTimeline, feedReadModel.selectedBotTradeTimeline),
    [feedReadModel.selectedBotTradeTimeline, selectedBotActivityTimeline],
  );
  const filteredSignalBotActivity = useMemo(
    () => signalBotActivityRows.filter((row) => signalBotActivityFilter === "all" || row.statusKey === signalBotActivityFilter),
    [signalBotActivityFilter, signalBotActivityRows],
  );
  const pagedSignalBotActivity = useMemo(
    () => paginateRows(filteredSignalBotActivity, signalActivityPage, 10),
    [filteredSignalBotActivity, signalActivityPage],
  );
  const signalHistoryPairOptions = useMemo(
    () => Array.from(new Set(
      signalHistoryRows
        .map((row) => row.pair)
        .filter(Boolean),
    )).slice(0, 4),
    [signalHistoryRows],
  );

  const selectedBotName = selectedBotCard?.name || "Signal Bot";
  const selectedBotPair = selectedBotCard?.workspaceSettings.primaryPair || selectedBotCard?.leadingSignal?.context.symbol || inferBotWorkspacePair(selectedBotCard);
  const selectedBotStrategy = formatBotWorkspaceStrategy(selectedBotCard);
  const selectedBotStatus = selectedBotCard ? getBotStatusLabel(selectedBotCard.status) : "Draft";
  const selectedBotWinRate = selectedBotCard?.liveTradeStats.winRate ?? 0;
  const selectedBotProfit = selectedBotCard?.liveTradeStats.realizedPnlUsd ?? 0;
  const selectedBotTradeCount = selectedBotCard?.liveTradeStats.tradeCount ?? 0;
  const selectedBotActiveSignalCount = selectedBotSignals.length;
  const selectedBotPendingSignalCount = selectedBotCard?.activity.pendingCount ?? 0;
  const statusPanelSummary = buildSignalBotStatusSummary(selectedBotCard, selectedBotWinRate);
  const autoExecuteEnabled = Boolean(selectedBotCard?.executionPolicy?.autoExecutionEnabled);
  const pushNotificationsEnabled = Boolean(selectedBotCard?.notificationSettings?.pushEnabled);
  const isWatchlistUniverse = String(selectedBotCard?.universePolicy?.kind || "").trim().toLowerCase() === "watchlist";
  const selectedBotExecutionIntentSummary = feedReadModel.selectedBotExecutionIntentSummary;
  const selectedBotOperationalVerdict = feedReadModel.selectedBotOperationalVerdict;
  const selectedBotAttention = selectedBotCard?.attention || null;
  const selectedBotOwnership = selectedBotCard?.ownership || null;
  const fleetGate = feedReadModel.governedDemoGate;
  const selectedBotPairs = useMemo(() => {
    const configuredPairs = selectedBotCard?.universePolicy?.symbols?.filter(Boolean) || [];
    const watchlistPairs = feedReadModel.activeWatchlistCoins?.filter(Boolean) || [];
    const fallbackPair = selectedBotPair ? [selectedBotPair] : [];
    const universeKind = String(selectedBotCard?.universePolicy?.kind || "").trim().toLowerCase();

    if (universeKind === "watchlist") {
      const scope = watchlistPairs.length ? watchlistPairs : configuredPairs;
      return Array.from(new Set((scope.length ? scope : fallbackPair).filter(Boolean)));
    }

    if (universeKind === "hybrid") {
      return Array.from(new Set([...watchlistPairs, ...configuredPairs, ...fallbackPair].filter(Boolean)));
    }

    return Array.from(new Set((configuredPairs.length ? configuredPairs : fallbackPair).filter(Boolean)));
  }, [feedReadModel.activeWatchlistCoins, selectedBotCard?.universePolicy?.kind, selectedBotCard?.universePolicy?.symbols, selectedBotPair]);
  const selectedBotTimeframes = useMemo(() => {
    const configuredTimeframes = selectedBotCard?.timeframePolicy?.allowedTimeframes?.filter(Boolean) || [];
    return sortTimeframes(Array.from(new Set((configuredTimeframes.length ? configuredTimeframes : ["1h"]).map(normalizeTimeframe))));
  }, [selectedBotCard?.timeframePolicy?.allowedTimeframes]);
  const availablePairOptions = useMemo(() => {
    const source = exchangePairUniverse.length ? exchangePairUniverse : [...SIGNAL_BOT_PAIR_OPTIONS];
    return source.filter((pair) => !selectedBotPairs.includes(pair));
  }, [exchangePairUniverse, selectedBotPairs]);
  const availableTimeframeOptions = useMemo(
    () => SIGNAL_BOT_TIMEFRAME_OPTIONS.filter((timeframe) => !selectedBotTimeframes.includes(normalizeTimeframe(timeframe))),
    [selectedBotTimeframes],
  );
  const filteredPairOptions = useMemo(() => {
    const query = pairQuery.trim().toUpperCase();
    if (!query) {
      return availablePairOptions.slice(0, 80);
    }
    return availablePairOptions
      .filter((pair) => pair.toUpperCase().includes(query))
      .slice(0, 80);
  }, [availablePairOptions, pairQuery]);
  const siblingReservedCapitalUsd = useMemo(
    () => feedReadModel.botCards
      .filter((bot) => bot.id !== selectedBotCard?.id)
      .filter((bot) => isSameExecutionAccount(bot, selectedBotCard))
      .reduce((sum, bot) => sum + Math.max(Number(bot.capital?.allocatedUsd || 0), 0), 0),
    [feedReadModel.botCards, selectedBotCard],
  );
  const currentBotCapitalUsd = Math.max(Number(selectedBotCard?.capital?.allocatedUsd || 0), 0);
  const allocatableCapitalLimitUsd = Math.max(accountCapitalPoolUsd - siblingReservedCapitalUsd, 0);
  const maxCapitalForThisBotUsd = Math.max(allocatableCapitalLimitUsd, currentBotCapitalUsd);
  const signalOperationalInsights = useMemo<SignalOperationalInsight[]>(() => {
    const queueValue = selectedBotExecutionIntentSummary?.dispatchRequestedCount
      ? `${selectedBotExecutionIntentSummary.dispatchRequestedCount} dispatching`
      : selectedBotExecutionIntentSummary?.queuedCount
        ? `${selectedBotExecutionIntentSummary.queuedCount} queued`
        : selectedBotExecutionIntentSummary?.readyCount
          ? `${selectedBotExecutionIntentSummary.readyCount} ready`
          : "Idle";
    const queueNote = selectedBotExecutionIntentSummary?.latestLaneStatus
      ? `Latest lane: ${formatIntentLaneStatusLabel(selectedBotExecutionIntentSummary.latestLaneStatus)}${selectedBotExecutionIntentSummary.latestIntentSymbol ? ` on ${selectedBotExecutionIntentSummary.latestIntentSymbol}` : ""}.`
      : "No active intents are moving through the bot lane right now.";
    const queueTone: SignalOperationalInsight["tone"] = selectedBotExecutionIntentSummary?.blockedLaneCount
      ? "negative"
      : selectedBotExecutionIntentSummary?.queuedCount || selectedBotExecutionIntentSummary?.dispatchRequestedCount || selectedBotExecutionIntentSummary?.readyCount
        ? "positive"
        : "neutral";

    const automationValue = autoExecuteEnabled ? "Auto On" : "Manual";
    const automationNote = autoExecuteEnabled
      ? fleetGate?.state === "open"
        ? selectedBotOperationalVerdict?.state === "close"
          ? "Auto is enabled and this bot is currently inside a clean enough governed lane."
          : "Auto is enabled, but this bot is still validating before it can move through the governed lane cleanly."
        : fleetGate?.note || "Auto is enabled, but the governed demo gate is still closed."
      : "This bot will only move when you manually approve or execute its signals.";
    const automationTone: SignalOperationalInsight["tone"] = autoExecuteEnabled
      ? fleetGate?.state === "open" && selectedBotOperationalVerdict?.state === "close"
        ? "positive"
        : "neutral"
      : "neutral";

    const ownershipValue = formatOwnershipHealthLabel(selectedBotOwnership?.healthLabel);
    const ownershipNote = selectedBotOwnership
      ? `${selectedBotOwnership.ownedOutcomeCount || 0} owned outcomes · ${Math.round(selectedBotOwnership.reconciliationPct || 0)}% reconciled · ${selectedBotOwnership.unresolvedOwnershipCount || 0} unresolved.`
      : "Ownership health is still forming for this bot.";
    const ownershipTone: SignalOperationalInsight["tone"] = selectedBotOwnership?.healthLabel === "healthy"
      ? "positive"
      : selectedBotOwnership?.healthLabel === "needs-attention"
        ? "negative"
        : "neutral";

    const attentionValue = selectedBotAttention?.priority
      ? titleCaseToken(selectedBotAttention.priority)
      : "Clear";
    const attentionNote = selectedBotAttention?.note || "No queue churn, ownership issue or guardrail escalation is standing out right now.";
    const attentionTone: SignalOperationalInsight["tone"] = selectedBotAttention?.priority === "urgent"
      ? "negative"
      : selectedBotAttention?.priority === "watch"
        ? "neutral"
        : "positive";

    return [
      { label: "Automation", value: automationValue, note: automationNote, tone: automationTone },
      { label: "Dispatch Queue", value: queueValue, note: queueNote, tone: queueTone },
      { label: "Ownership", value: ownershipValue, note: ownershipNote, tone: ownershipTone },
      { label: "Attention", value: attentionValue, note: attentionNote, tone: attentionTone },
    ];
  }, [
    autoExecuteEnabled,
    fleetGate?.note,
    fleetGate?.state,
    selectedBotAttention?.note,
    selectedBotAttention?.priority,
    selectedBotExecutionIntentSummary?.blockedLaneCount,
    selectedBotExecutionIntentSummary?.dispatchRequestedCount,
    selectedBotExecutionIntentSummary?.latestIntentSymbol,
    selectedBotExecutionIntentSummary?.latestLaneStatus,
    selectedBotExecutionIntentSummary?.queuedCount,
    selectedBotExecutionIntentSummary?.readyCount,
    selectedBotOperationalVerdict?.state,
    selectedBotOwnership?.healthLabel,
    selectedBotOwnership?.ownedOutcomeCount,
    selectedBotOwnership?.reconciliationPct,
    selectedBotOwnership?.unresolvedOwnershipCount,
  ]);

  useEffect(() => {
    setMaxPositionDraft(String(selectedBotCard?.riskPolicy?.maxPositionUsd ?? 0));
  }, [selectedBotCard?.id, selectedBotCard?.riskPolicy?.maxPositionUsd]);

  useEffect(() => {
    setCapitalDraft(String(selectedBotCard?.capital?.allocatedUsd ?? 0));
  }, [selectedBotCard?.id, selectedBotCard?.capital?.allocatedUsd]);

  useEffect(() => {
    setPairDraft(availablePairOptions[0] || SIGNAL_BOT_PAIR_OPTIONS[0]);
  }, [availablePairOptions, selectedBotCard?.id]);

  useEffect(() => {
    setTimeframeDraft(availableTimeframeOptions[0] || SIGNAL_BOT_TIMEFRAME_OPTIONS[0]);
  }, [availableTimeframeOptions, selectedBotCard?.id]);

  useEffect(() => {
    setActiveSignalsPage(1);
  }, [activeFilter, selectedBotCard?.id, selectedBotSignals.length]);

  useEffect(() => {
    setSignalHistoryPage(1);
  }, [selectedBotCard?.id, readModel.closedHistory.length]);

  useEffect(() => {
    setSignalHistoryPairFilter("all");
  }, [selectedBotCard?.id]);

  useEffect(() => {
    setSignalHistoryDirectionFilter("all");
  }, [selectedBotCard?.id]);

  useEffect(() => {
    if (!isPairDrawerOpen) return;
    setPairQuery((current) => current || pairDraft || "");
  }, [isPairDrawerOpen, pairDraft]);

  useEffect(() => {
    setPairExchangeDraft(formatSignalBotExecutionAccount(selectedBotCard));
  }, [selectedBotCard?.id, selectedBotCard?.executionAccount?.id, selectedBotCard?.executionEnvironment]);

  useEffect(() => {
    if (!isPairDrawerOpen) return;
    let cancelled = false;
    const shouldUseBinanceUniverse = pairExchangeDraft.toLowerCase().includes("binance");

    setPairSearchLoading(true);
    (async () => {
      try {
        const nextUniverse = shouldUseBinanceUniverse
          ? await marketService.fetchSymbols()
          : [...SIGNAL_BOT_PAIR_OPTIONS];
        if (cancelled) return;
        setExchangePairUniverse(nextUniverse.length ? nextUniverse : [...SIGNAL_BOT_PAIR_OPTIONS]);
      } catch {
        if (cancelled) return;
        setExchangePairUniverse([...SIGNAL_BOT_PAIR_OPTIONS]);
      } finally {
        if (!cancelled) {
          setPairSearchLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPairDrawerOpen, pairExchangeDraft]);

  useEffect(() => {
    if (!isPairDrawerOpen) return;
    if (!availablePairOptions.length) {
      setPairDraft("");
      setPairQuery("");
      return;
    }
    if (availablePairOptions.includes(pairDraft)) return;
    setPairDraft(availablePairOptions[0]);
    setPairQuery(availablePairOptions[0]);
  }, [availablePairOptions, isPairDrawerOpen, pairDraft]);

  useEffect(() => {
    let cancelled = false;
    binanceService.getExecutionCenter()
      .then((payload) => {
        if (cancelled) return;
        const accountPool = Math.max(Number(payload?.account?.cashValue || 0), Number(payload?.account?.totalValue || 0), 0);
        setAccountCapitalPoolUsd(accountPool);
      })
      .catch(() => {
        if (cancelled) return;
        setAccountCapitalPoolUsd(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSignalBotStatus = async () => {
    if (!selectedBotCard) return;
    if (selectedBotCard.status === "disabled") {
      showToast({
        tone: "warning",
        title: "Bot deshabilitado",
        message: `${selectedBotCard.name} no puede volver a operar mientras siga deshabilitado.`,
      });
      return;
    }

    const nextStatus = selectedBotCard.status === "active" ? "paused" : "active";
    if (nextStatus === "active" && Number(selectedBotCard.capital?.allocatedUsd || 0) <= 0) {
      showToast({
        tone: "error",
        title: "Capital requerido",
        message: `${selectedBotCard.name} no puede iniciar mientras su capital máximo siga en $0. Actualiza el capital del bot primero.`,
      });
      return;
    }

    const loaderId = startLoading({
      label: "Actualizando bot",
      detail: `${selectedBotCard.name} → ${getBotStatusLabel(nextStatus)}`,
    });

    try {
      await updateBot(selectedBotCard.id, { status: nextStatus });
      showToast({
        tone: "success",
        title: "Estado actualizado",
        message: `${selectedBotCard.name} ahora está ${getBotStatusLabel(nextStatus).toLowerCase()}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el bot",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleDecisionAction = async (
    signal: RankedPublishedSignal,
    snapshot: SignalSnapshot | undefined,
    action: "observe" | "execute" | "block",
  ) => {
    if (!selectedBotCard) return;

    const loaderId = startLoading({
      label: action === "execute" ? "Ejecutando señal" : action === "block" ? "Descartando señal" : "Registrando revisión",
      detail: `${selectedBotCard.name} • ${signal.context.symbol}`,
    });

    try {
      const signalId = normalizeSignalId(snapshot?.id)
        || getSnapshotIdFromPublishedSignalId(signal.id)
        || normalizeSignalId(signal.id);
      const executionEnvironment = String(selectedBotCard.executionEnvironment || "").trim();
      const dispatchMode = executionEnvironment === "paper"
        ? "preview"
        : executionEnvironment === "demo"
          ? "execute"
          : null;
      const now = new Date().toISOString();
      let dispatchedPayload:
        | {
            candidate?: { status?: string; reasons?: string[] };
            record?: { id?: number | null };
            protection?: { protectionAttached?: boolean; protectionNote?: string };
          }
        | null = null;

      if (action === "execute") {
        if (!dispatchMode) {
          showToast({
            tone: "warning",
            title: "Ejecución no disponible",
            message: `${selectedBotCard.name} no puede ejecutar manualmente desde ${selectedBotCard.executionEnvironment}.`,
          });
          return;
        }
        if (!signalId) {
          showToast({
            tone: "error",
            title: "Señal inválida",
            message: "La señal no tiene un id publicable para enviarla al carril de ejecución.",
          });
          return;
        }

        dispatchedPayload = await systemDataPlaneStore.getState().actions.executeDemoSignal(signalId, dispatchMode, {
          botId: selectedBotCard.id,
          botName: selectedBotCard.name,
          origin: "bot-manual",
        }) as {
          candidate?: { status?: string; reasons?: string[] };
          record?: { id?: number | null };
          protection?: { protectionAttached?: boolean; protectionNote?: string };
        } | null;

        const candidateStatus = String(dispatchedPayload?.candidate?.status || "").trim().toLowerCase();
        if (!dispatchedPayload || candidateStatus === "blocked") {
          showToast({
            tone: "error",
            title: "No se pudo ejecutar la señal",
            message: dispatchedPayload?.candidate?.reasons?.[0] || "La operación quedó bloqueada por el motor de ejecución.",
          });
          return;
        }
      }

      await createDecision({
        id: `${selectedBotCard.id}-${signal.id}-${action}-${Date.now()}`,
        botId: selectedBotCard.id,
        signalSnapshotId: snapshot?.id ?? null,
        symbol: signal.context.symbol,
        timeframe: signal.context.timeframe,
        signalLayer: mapSignalLayer(signal),
        action,
        status: action === "execute"
          ? (dispatchMode === "execute" ? "pending" : "approved")
          : action === "block"
            ? "dismissed"
            : "approved",
        source: "manual",
        rationale: buildDecisionRationale(action, signal),
        executionEnvironment: selectedBotCard.executionEnvironment,
        automationMode: selectedBotCard.automationMode,
        marketContextSignature: `${signal.context.symbol}:${signal.context.timeframe}:${signal.ranking.tier}`,
        contextTags: [signal.ranking.tier, signal.context.symbol, signal.context.timeframe],
        metadata: {
          signalId: signal.id,
          publishedSignalId: signal.id,
          strategyId: signal.context.strategyId || null,
          strategyVersion: signal.context.strategyVersion || null,
          signalFeedKinds: signal.feedKinds,
          signalObservedAt: signal.context.observedAt,
          executionEligible: Boolean(signal.intelligence?.executionEligible),
          scorerLabel: signal.intelligence?.scorerLabel || null,
          scorerConfidence: Number(signal.intelligence?.scorerConfidence || 0) || null,
          adaptiveScore: Number(signal.intelligence?.adaptiveScore || 0) || null,
          rrRatio: null,
          acceptedByBot: true,
          rankingTier: signal.ranking.tier,
          compositeScore: signal.ranking.compositeScore,
          entryPrice: Number(snapshot?.entry_price || snapshot?.support || 0) || null,
          targetPrice: Number(snapshot?.tp_price || snapshot?.tp2_price || snapshot?.resistance || 0) || null,
          stopLossPrice: Number(snapshot?.sl_price || 0) || null,
          realizedPnlUsd: 0,
          generatedByOperationalLoop: false,
          executionIntentStatus:
            action === "execute"
              ? "ready"
              : action === "block"
                ? "observe-only"
                : "observe-only",
          executionIntentLane:
            action === "execute" && dispatchMode
              ? executionEnvironment
              : null,
          executionIntentLaneStatus:
            action === "execute"
              ? dispatchMode === "execute"
                ? "execution-submitted"
                : "previewed"
              : action === "block"
                ? "blocked"
                : "observe-only",
          executionIntentDispatchStatus:
            action === "execute"
              ? String(dispatchedPayload?.candidate?.status || "submitted")
              : action === "block"
                ? "dismissed"
                : null,
          executionIntentDispatchMode: action === "execute" ? dispatchMode : null,
          executionIntentDispatchSignalId: action === "execute" ? signalId : null,
          executionOrderId: action === "execute" ? Number(dispatchedPayload?.record?.id || 0) || null : null,
          executionIntentDispatchAttemptedAt: action === "execute" ? now : null,
          executionIntentDispatchedAt: action === "execute" ? now : null,
          executionIntentLastUpdatedAt: now,
          executionIntentReason:
            action === "execute"
              ? dispatchMode === "execute"
                ? dispatchedPayload?.protection?.protectionAttached
                  ? "Operación demo enviada manualmente con protección TP/SL."
                  : dispatchedPayload?.protection?.protectionNote || "Operación demo enviada manualmente."
                : "Preview manual enviado al carril paper."
              : action === "block"
                ? `La señal ${signal.context.symbol} fue descartada manualmente desde el workspace del bot.`
                : null,
          executionIntentDispatchProtectionAttached:
            action === "execute" ? Boolean(dispatchedPayload?.protection?.protectionAttached) : null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      showToast({
        tone: "success",
        title: action === "execute"
          ? dispatchMode === "execute"
            ? "Operación enviada"
            : "Preview enviado"
          : action === "block"
            ? "Señal descartada"
            : "Señal revisada",
        message:
          action === "execute"
            ? dispatchMode === "execute"
              ? `${selectedBotCard.name} envió ${signal.context.symbol} al carril demo de ejecución.`
              : `${selectedBotCard.name} envió ${signal.context.symbol} al carril de preview.`
            : `${selectedBotCard.name} registró ${signal.context.symbol} en su historial real.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: action === "execute" ? "No se pudo ejecutar la señal" : "No se pudo registrar la decisión",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleToggleAutoExecute = async () => {
    if (!selectedBotCard) return;
    if (selectedBotCard.status === "disabled") {
      showToast({
        tone: "warning",
        title: "Bot deshabilitado",
        message: `${selectedBotCard.name} no puede cambiar Auto-Execute mientras siga deshabilitado.`,
      });
      return;
    }

    const nextEnabled = !autoExecuteEnabled;
    const loaderId = startLoading({
      label: nextEnabled ? "Activando Auto-Execute" : "Desactivando Auto-Execute",
      detail: selectedBotCard.name,
    });

    try {
      await updateBot(selectedBotCard.id, {
        automationMode: nextEnabled ? "auto" : "observe",
        executionPolicy: {
          ...selectedBotCard.executionPolicy,
          autoExecutionEnabled: nextEnabled,
          suggestionsOnly: nextEnabled ? false : true,
          requiresHumanApproval: nextEnabled ? false : true,
          canOpenPositions: nextEnabled ? true : false,
        },
      });
      showToast({
        tone: "success",
        title: nextEnabled ? "Auto-Execute activado" : "Auto-Execute desactivado",
        message: nextEnabled
          ? `${selectedBotCard.name} ahora puede trabajar en modo automático cuando su carril lo permita.`
          : `${selectedBotCard.name} volvió a modo observado sin ejecución automática.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar Auto-Execute",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleTogglePushNotifications = async () => {
    if (!selectedBotCard) return;
    const nextEnabled = !pushNotificationsEnabled;
    const loaderId = startLoading({
      label: nextEnabled ? "Activando notificaciones" : "Desactivando notificaciones",
      detail: selectedBotCard.name,
    });

    try {
      await updateBot(selectedBotCard.id, {
        notificationSettings: {
          ...selectedBotCard.notificationSettings,
          pushEnabled: nextEnabled,
        },
      });
      showToast({
        tone: "success",
        title: nextEnabled ? "Push activado" : "Push desactivado",
        message: nextEnabled
          ? `${selectedBotCard.name} enviará notificaciones push desde su perfil persistido.`
          : `${selectedBotCard.name} dejó de enviar notificaciones push.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar Push Notifications",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleSaveMaxPositionSize = async () => {
    if (!selectedBotCard) return;
    const normalizedValue = Number(maxPositionDraft);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      showToast({
        tone: "error",
        title: "Monto inválido",
        message: "Max Position Size debe ser un número válido igual o mayor que 0.",
      });
      setMaxPositionDraft(String(selectedBotCard.riskPolicy.maxPositionUsd ?? 0));
      return;
    }

    if (normalizedValue > currentBotCapitalUsd) {
      showToast({
        tone: "error",
        title: "Max Position Size inválido",
        message: `Max Position Size no puede ser mayor que el capital del bot (${formatUsd(currentBotCapitalUsd)}).`,
      });
      setMaxPositionDraft(String(selectedBotCard.riskPolicy.maxPositionUsd ?? 0));
      return;
    }

    if (normalizedValue === Number(selectedBotCard.riskPolicy.maxPositionUsd || 0)) return;

    const loaderId = startLoading({
      label: "Guardando Max Position Size",
      detail: selectedBotCard.name,
    });

    try {
      await updateBot(selectedBotCard.id, {
        riskPolicy: {
          ...selectedBotCard.riskPolicy,
          maxPositionUsd: normalizedValue,
        },
      });
      showToast({
        tone: "success",
        title: "Max Position Size actualizado",
        message: `${selectedBotCard.name} ahora tiene un máximo por operación de ${formatUsd(normalizedValue)}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar Max Position Size",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
      setMaxPositionDraft(String(selectedBotCard.riskPolicy.maxPositionUsd ?? 0));
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleSaveCapital = async () => {
    if (!selectedBotCard) return;
    const normalizedValue = Number(capitalDraft);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      showToast({
        tone: "error",
        title: "Capital inválido",
        message: "Capital debe ser un número válido igual o mayor que 0.",
      });
      setCapitalDraft(String(selectedBotCard.capital.allocatedUsd ?? 0));
      return;
    }

    if (normalizedValue > maxCapitalForThisBotUsd) {
      showToast({
        tone: "error",
        title: "Capital excede la cuenta",
        message: `Este bot solo puede tomar hasta ${formatUsd(maxCapitalForThisBotUsd)} de esta cuenta ahora mismo. Los otros bots ya reservan ${formatUsd(siblingReservedCapitalUsd)}.`,
      });
      setCapitalDraft(String(selectedBotCard.capital.allocatedUsd ?? 0));
      return;
    }

    if (normalizedValue < Number(selectedBotCard.riskPolicy.maxPositionUsd || 0)) {
      showToast({
        tone: "error",
        title: "Capital insuficiente",
        message: `Capital no puede ser menor que Max Position Size (${formatUsd(selectedBotCard.riskPolicy.maxPositionUsd || 0)}).`,
      });
      setCapitalDraft(String(selectedBotCard.capital.allocatedUsd ?? 0));
      return;
    }

    if (normalizedValue === Number(selectedBotCard.capital.allocatedUsd || 0)) return;

    const currentAllocated = Number(selectedBotCard.capital.allocatedUsd || 0);
    const currentAvailable = Number(selectedBotCard.capital.availableUsd || 0);
    const capitalInUse = Math.max(currentAllocated - currentAvailable, 0);
    const nextAvailable = Math.max(normalizedValue - capitalInUse, 0);

    const loaderId = startLoading({
      label: "Guardando capital",
      detail: selectedBotCard.name,
    });

    try {
      await updateBot(selectedBotCard.id, {
        capital: {
          ...selectedBotCard.capital,
          allocatedUsd: normalizedValue,
          availableUsd: nextAvailable,
        },
      });
      showToast({
        tone: "success",
        title: "Capital actualizado",
        message: `${selectedBotCard.name} ahora tiene un capital máximo de ${formatUsd(normalizedValue)}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar Capital",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
      setCapitalDraft(String(selectedBotCard.capital.allocatedUsd ?? 0));
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleRemoveTradingPair = async (pair: string) => {
    if (!selectedBotCard) return;
    if (selectedBotPairs.length <= 1) {
      showToast({
        tone: "warning",
        title: "Último par protegido",
        message: "Este bot debe conservar al menos un trading pair activo.",
      });
      return;
    }

    const nextPairs = selectedBotPairs.filter((item) => item !== pair);
    const nextPrimaryPair = selectedBotCard.workspaceSettings.primaryPair === pair
      ? nextPairs[0] || selectedBotCard.workspaceSettings.primaryPair
      : selectedBotCard.workspaceSettings.primaryPair;
    const loaderId = startLoading({
      label: "Quitando par",
      detail: `${selectedBotCard.name} • ${pair}`,
    });

    try {
      await updateBot(selectedBotCard.id, {
        universePolicy: {
          ...selectedBotCard.universePolicy,
          kind: "custom-list",
          symbols: nextPairs,
        },
        workspaceSettings: {
          ...selectedBotCard.workspaceSettings,
          primaryPair: nextPrimaryPair,
        },
      });
      showToast({
        tone: "success",
        title: "Par eliminado",
        message: `${pair} ya no forma parte del alcance operativo de ${selectedBotCard.name}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo quitar el par",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleAddTradingPair = async () => {
    if (!selectedBotCard) return;
    if (!pairDraft) {
      showToast({
        tone: "error",
        title: "Selecciona un par",
        message: "Debes elegir una moneda antes de agregarla al bot.",
      });
      return;
    }
    if (selectedBotPairs.includes(pairDraft)) {
      showToast({
        tone: "warning",
        title: "Par duplicado",
        message: `${pairDraft} ya está activo en este bot.`,
      });
      return;
    }

    const nextPairs = [...selectedBotPairs, pairDraft];
    const loaderId = startLoading({
      label: "Agregando par",
      detail: `${selectedBotCard.name} • ${pairDraft}`,
    });

    try {
      await updateBot(selectedBotCard.id, {
        universePolicy: {
          ...selectedBotCard.universePolicy,
          kind: "custom-list",
          symbols: nextPairs,
        },
        workspaceSettings: {
          ...selectedBotCard.workspaceSettings,
          primaryPair: selectedBotCard.workspaceSettings.primaryPair || pairDraft,
        },
        generalSettings: {
          ...selectedBotCard.generalSettings,
          defaultExchange: pairExchangeDraft,
        },
      });
      showToast({
        tone: "success",
        title: "Par agregado",
        message: `${pairDraft} ya está disponible en ${selectedBotCard.name}.`,
      });
      setIsPairDrawerOpen(false);
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo agregar el par",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleSelectPairDraft = (pair: string) => {
    setPairDraft(pair);
    setPairQuery(pair);
    setPairSearchOpen(false);
  };

  const handleRemoveTradingTimeframe = async (timeframe: string) => {
    if (!selectedBotCard) return;
    if (selectedBotTimeframes.length <= 1) {
      showToast({
        tone: "warning",
        title: "Debe quedar una temporalidad",
        message: `${selectedBotCard.name} necesita al menos una temporalidad activa.`,
      });
      return;
    }

    const normalizedTarget = normalizeTimeframe(timeframe);
    const nextTimeframes = sortTimeframes(
      selectedBotTimeframes.filter((item) => normalizeTimeframe(item) !== normalizedTarget),
    );
    const loaderId = startLoading({
      label: "Quitando temporalidad",
      detail: `${selectedBotCard.name} • ${timeframe}`,
    });

    try {
      await updateBot(selectedBotCard.id, {
        timeframePolicy: {
          ...selectedBotCard.timeframePolicy,
          allowedTimeframes: nextTimeframes,
          preferredTimeframes: nextTimeframes,
        },
      });
      showToast({
        tone: "success",
        title: "Temporalidad eliminada",
        message: `${timeframe} ya no forma parte del alcance operativo de ${selectedBotCard.name}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo quitar la temporalidad",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleAddTradingTimeframe = async () => {
    if (!selectedBotCard) return;
    const normalizedTimeframeDraft = normalizeTimeframe(timeframeDraft);
    if (!normalizedTimeframeDraft) {
      showToast({
        tone: "error",
        title: "Selecciona una temporalidad",
        message: "Debes elegir una temporalidad antes de agregarla al bot.",
      });
      return;
    }
    if (selectedBotTimeframes.some((item) => normalizeTimeframe(item) === normalizedTimeframeDraft)) {
      showToast({
        tone: "warning",
        title: "Temporalidad duplicada",
        message: `${normalizedTimeframeDraft} ya está activa en este bot.`,
      });
      return;
    }

    const nextTimeframes = sortTimeframes([...selectedBotTimeframes, normalizedTimeframeDraft]);
    const loaderId = startLoading({
      label: "Agregando temporalidad",
      detail: `${selectedBotCard.name} • ${normalizedTimeframeDraft}`,
    });

    try {
      await updateBot(selectedBotCard.id, {
        timeframePolicy: {
          ...selectedBotCard.timeframePolicy,
          allowedTimeframes: nextTimeframes,
          preferredTimeframes: nextTimeframes,
        },
      });
      showToast({
        tone: "success",
        title: "Temporalidad agregada",
        message: `${normalizedTimeframeDraft} ya está disponible en ${selectedBotCard.name}.`,
      });
      setIsTimeframeDrawerOpen(false);
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo agregar la temporalidad",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  return (
    <div id="signalBotView" className="view-panel active signalbot-view">
      <section className="signalbot-shell">
        <div className="signalbot-header">
          <div className="signalbot-header-copy">
            <span className="signalbot-kicker ui-pill">BOT WORKSPACE</span>
            <h1 className="signalbot-title" data-testid="signalbot-title">{selectedBotName}</h1>
            <p className="signalbot-subtitle">{selectedBotPair} • {selectedBotStrategy} • {selectedBotStatus}</p>
          </div>

          <div className="signalbot-header-actions">
            <button type="button" className="signalbot-secondary-button ui-button" onClick={() => onNavigateView("control-bot-settings")}>
              Open Full Bot Settings
            </button>
          </div>
        </div>

        <div className="signalbot-summary-grid ui-summary-grid">
          <SignalStatCard
            label="Active Signals"
            value={String(selectedBotActiveSignalCount)}
            note={selectedBotActiveSignalCount ? `${readModel.botBlockedCount} blocked by bot rules` : "No active signal flow recorded for this bot yet."}
            status="Live"
            tone="success"
            icon={<SignalBroadcastIcon />}
          />
          <SignalStatCard
            label="Win Rate"
            value={`${selectedBotWinRate.toFixed(1)}%`}
            note={`${Math.max(selectedBotTradeCount, 0)} tracked outcomes`}
            tone="info"
            icon={<SignalTargetIcon />}
          />
          <SignalStatCard
            label="Total Profit (30d)"
            value={formatUsd(selectedBotProfit)}
            note={selectedBotTradeCount ? `${selectedBotTradeCount} tracked outcomes` : "No realized outcomes yet."}
            tone="primary"
            icon={<SignalProfitIcon />}
          />
          <SignalStatCard
            label="Pending Signals"
            value={String(selectedBotPendingSignalCount)}
            note={selectedBotPendingSignalCount ? "Pending inside this bot flow" : "No pending signal is attached to this bot."}
            status="Pending"
            tone="warning"
            icon={<SignalClockIcon />}
          />
        </div>

        <div className="signalbot-panel card">
          <div className="signalbot-toolbar-row ui-toolbar">
            <div className="signalbot-tab-bar">
              <button type="button" className={`signalbot-tab-button ui-chip ${activeTab === "active-signals" ? "active" : ""}`} onClick={() => setActiveTab("active-signals")}>Active Signals</button>
              <button type="button" className={`signalbot-tab-button ui-chip ${activeTab === "signal-history" ? "active" : ""}`} onClick={() => setActiveTab("signal-history")}>Signal History</button>
              <button type="button" className={`signalbot-tab-button ui-chip ${activeTab === "bot-activity" ? "active" : ""}`} onClick={() => setActiveTab("bot-activity")}>Bot Activity</button>
              <button type="button" className={`signalbot-tab-button ui-chip ${activeTab === "performance" ? "active" : ""}`} onClick={() => setActiveTab("performance")}>Performance</button>
              <button type="button" className={`signalbot-tab-button ui-chip ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>Bot Settings</button>
            </div>

            <div className="signalbot-toolbar-actions ui-toolbar-actions">
              <button type="button" className="signalbot-secondary-button ui-button">
                <DownloadIcon />
                Export
              </button>
              <button type="button" className="signalbot-secondary-button ui-button">
                <SlidersHorizontalIcon />
                Filters
              </button>
            </div>
          </div>

          {activeTab === "active-signals" ? (
            <>
              <div className="signalbot-filter-row ui-chip-row">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`signalbot-filter-chip ui-chip ${activeFilter === chip.key ? "active" : ""}`}
                    onClick={() => setActiveFilter(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="signalbot-card-grid">
                {pagedActiveSignals.rows.map(({ signal, snapshot, direction, entry, target, stopLoss }) => (
                  <article key={signal.id} className={`signalbot-card ${direction === "BUY" ? "is-buy" : direction === "SELL" ? "is-sell" : "is-neutral"}`}>
                    <div className="signalbot-card-head">
                      <div className="signalbot-card-identity">
                        <SignalAssetBadge symbol={signal.context.symbol} />
                        <div className="signalbot-card-copy">
                          <h3 className="signalbot-card-title">{signal.context.symbol}</h3>
                          <p className="signalbot-card-subtitle">{getCardVenueLabel(signal, snapshot, direction)}</p>
                        </div>
                      </div>
                      <div className="signalbot-card-badges">
                        <span className="signalbot-status-pill is-timeframe">
                          {signal.context.timeframe}
                        </span>
                        <span className={`signalbot-status-pill ${direction === "BUY" ? "is-buy" : direction === "SELL" ? "is-sell" : "is-neutral"}`}>
                          {direction}
                        </span>
                      </div>
                    </div>

                    <div className="signalbot-level-grid">
                      <div className="signalbot-level-item">
                        <span>Entry</span>
                        <strong>{formatUsd(entry)}</strong>
                      </div>
                      <div className="signalbot-level-item">
                        <span>Target</span>
                        <strong className="is-positive">{formatUsd(target)}</strong>
                      </div>
                      <div className="signalbot-level-item">
                        <span>Stop Loss</span>
                        <strong className="is-negative">{formatUsd(stopLoss)}</strong>
                      </div>
                    </div>

                    <div className="signalbot-confidence-block">
                      <div className="signalbot-confidence-row">
                        <div className="signalbot-confidence-label">
                          <span className={`signalbot-confidence-dot ${getConfidenceToneClass(signal)}`} />
                          <span>Signal Score</span>
                        </div>
                        <strong className={`signalbot-confidence-value ${getConfidenceTextClass(signal)}`}>
                          {Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%
                        </strong>
                      </div>
                      <div className="signalbot-confidence-meta">
                        <span>{getExecutionReadinessLabel(signal)}</span>
                        {getScorerConfidenceValue(signal) != null ? (
                          <span>Scorer {getScorerConfidenceValue(signal)!.toFixed(0)}%</span>
                        ) : (
                          <span>Scorer pending</span>
                        )}
                      </div>

                      <div className="signalbot-progress-track">
                        <div className={`signalbot-progress-fill ${getConfidenceFillClass(signal)}`} style={{ width: `${Math.min(signal.ranking.compositeScore, 100)}%` }} />
                      </div>
                    </div>

                    <div className="signalbot-card-foot">
                      <span className="signalbot-card-time">{formatRelative(signal.context.observedAt)}</span>
                      <div className="signalbot-card-actions">
                        <button
                          type="button"
                          className="signalbot-icon-button"
                          aria-label={`View ${signal.context.symbol}`}
                          onClick={() => setObservedSignalDetail({
                            signal,
                            snapshot,
                            direction,
                            entry,
                            target,
                            stopLoss,
                          })}
                        >
                          <SignalViewIcon />
                        </button>
                        <button
                          type="button"
                          className="signalbot-icon-button"
                          aria-label={`Execute ${signal.context.symbol}`}
                          onClick={() => void handleDecisionAction(signal, snapshot, "execute")}
                        >
                          <SignalPlayIcon />
                        </button>
                        <button
                          type="button"
                          className="signalbot-icon-button"
                          aria-label={`Dismiss ${signal.context.symbol}`}
                          onClick={() => void handleDecisionAction(signal, snapshot, "block")}
                        >
                          <SignalCloseIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <PaginationControls
                currentPage={pagedActiveSignals.safePage}
                totalPages={pagedActiveSignals.totalPages}
                totalItems={readModel.filteredCards.length}
                label="senales"
                pageSize={pagedActiveSignals.pageSize}
                onPageChange={setActiveSignalsPage}
              />

              {!readModel.filteredCards.length ? (
                <div className="signalbot-empty">
                  <strong>No signals match this filter right now.</strong>
                  <span>
                    {readModel.cards.length
                      ? "This bot already has active signals, but none match the current filter. Try All Signals."
                      : "This bot does not have any active signals inside its current scope yet."}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === "signal-history" ? (
            <div className="ui-table-shell signalbot-table-shell">
              <div className="signalbot-filter-row ui-chip-row">
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalHistoryDirectionFilter === "all" ? "active" : ""}`}
                  onClick={() => setSignalHistoryDirectionFilter("all")}
                >
                  All Trades
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalHistoryDirectionFilter === "buy" ? "active" : ""}`}
                  onClick={() => setSignalHistoryDirectionFilter("buy")}
                >
                  Buy Only
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalHistoryDirectionFilter === "sell" ? "active" : ""}`}
                  onClick={() => setSignalHistoryDirectionFilter("sell")}
                >
                  Sell Only
                </button>
              </div>

              {signalHistoryPairOptions.length ? (
                <div className="signalbot-filter-row ui-chip-row">
                  <button
                    type="button"
                    className={`signalbot-filter-chip ui-chip ${signalHistoryPairFilter === "all" ? "active" : ""}`}
                    onClick={() => setSignalHistoryPairFilter("all")}
                  >
                    All Pairs
                  </button>
                  {signalHistoryPairOptions.map((pair) => (
                    <button
                      key={pair}
                      type="button"
                      className={`signalbot-filter-chip ui-chip ${signalHistoryPairFilter === pair ? "active" : ""}`}
                      onClick={() => setSignalHistoryPairFilter(pair)}
                    >
                      {pair}
                    </button>
                  ))}
                </div>
              ) : null}

              <table className="ui-table signalbot-history-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Type</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>P/L</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSignalHistory.rows.map((row) => (
                    <tr key={row.id} className={`signalbot-history-row ${row.statusTone}`}>
                      <td>
                        <div className="signalbot-history-pair-cell">
                          <SignalAssetBadge symbol={row.pair} />
                          <div className="signalbot-history-pair-copy">
                            <strong>{row.pair}</strong>
                            <span>{row.pairNote}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className={`signalbot-history-type-pill ${row.typeTone}`}>{row.typeLabel}</span></td>
                      <td>{formatMaybeUsd(row.entryPrice)}</td>
                      <td>{formatMaybeUsd(row.exitPrice)}</td>
                      <td className={Number(row.pnlUsd || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(row.pnlUsd)}
                      </td>
                      <td>{formatDuration(row.startedAt, row.endedAt)}</td>
                      <td><span className={`signalbot-history-status-pill ${row.statusTone}`}>{row.statusLabel}</span></td>
                      <td>{formatDate(row.dateAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PaginationControls
                currentPage={pagedSignalHistory.safePage}
                totalPages={pagedSignalHistory.totalPages}
                totalItems={filteredSignalHistory.length}
                label="operaciones"
                pageSize={pagedSignalHistory.pageSize}
                onPageChange={setSignalHistoryPage}
              />

              {!signalHistoryRows.length ? (
                <div className="signalbot-empty">
                  <strong>No closed trades exist for this bot yet.</strong>
                  <span>This tab will populate once this bot completes real buy or sell trades with an outcome.</span>
                </div>
              ) : null}

              {signalHistoryRows.length > 0 && !filteredSignalHistory.length ? (
                <div className="signalbot-empty">
                  <strong>No closed trades match this filter.</strong>
                  <span>Try All Trades or switch to another pair filter.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "bot-activity" ? (
            <div className="ui-table-shell signalbot-table-shell" data-testid="signalbot-activity-pane">
              <div className="signalbot-filter-row ui-chip-row">
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "all" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("all")}
                >
                  All Activity
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "blocked" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("blocked")}
                >
                  Blocked
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "review" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("review")}
                >
                  Needs Review
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "queue" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("queue")}
                >
                  Queue
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "preview" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("preview")}
                >
                  Preview Flow
                </button>
                <button
                  type="button"
                  className={`signalbot-filter-chip ui-chip ${signalBotActivityFilter === "handoff" ? "active" : ""}`}
                  onClick={() => setSignalBotActivityFilter("handoff")}
                >
                  Handed Off
                </button>
              </div>

              <table className="ui-table signalbot-history-table signalbot-activity-table" data-testid="signalbot-activity-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSignalBotActivity.rows.map((row) => (
                    <tr key={row.id} className={`signalbot-activity-row ${row.statusTone}`}>
                      <td>
                        <div className="signalbot-history-pair-cell">
                          <SignalAssetBadge symbol={row.pair} />
                          <div className="signalbot-history-pair-copy">
                            <strong>{row.pair}</strong>
                            <span>{row.pairNote}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className={`signalbot-history-type-pill ${row.actionTone}`}>{row.actionLabel}</span></td>
                      <td><span className={`signalbot-history-status-pill ${row.statusTone}`}>{row.statusLabel}</span></td>
                      <td className="signalbot-activity-reason">{row.reason}</td>
                      <td>{formatDate(row.dateAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PaginationControls
                currentPage={pagedSignalBotActivity.safePage}
                totalPages={pagedSignalBotActivity.totalPages}
                totalItems={filteredSignalBotActivity.length}
                label="eventos"
                pageSize={pagedSignalBotActivity.pageSize}
                onPageChange={setSignalActivityPage}
              />

              {!signalBotActivityRows.length ? (
                <div className="signalbot-empty">
                  <strong>No operational activity exists for this bot yet.</strong>
                  <span>Blocked, reviewed, queued or preview-only signals will appear here once this bot starts handling them.</span>
                </div>
              ) : null}

              {signalBotActivityRows.length > 0 && !filteredSignalBotActivity.length ? (
                <div className="signalbot-empty">
                  <strong>No operational activity matches this filter.</strong>
                  <span>Try All Activity or switch to another status filter.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "performance" ? null : null}

          {activeTab === "settings" ? (
            <div className="signalbot-settings-stack">
              <section className="signalbot-status-panel">
                <div className="signalbot-status-head">
                  <div className="signalbot-status-title-wrap">
                    <div className="signalbot-status-icon">
                      <SignalBotStatusIcon />
                    </div>
                    <div className="signalbot-status-copy">
                      <strong>Signal Bot Status</strong>
                      <p>{statusPanelSummary.note}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedBotCard?.status === "active"}
                    aria-label="Toggle signal bot status"
                    className={`botsettings-switch ${selectedBotCard?.status === "active" ? "is-active" : ""}`}
                    onClick={() => void handleToggleSignalBotStatus()}
                  >
                    <span />
                  </button>
                </div>

                <div className="signalbot-status-metrics">
                  <div className="signalbot-status-metric">
                    <strong>{statusPanelSummary.uptimeValue}</strong>
                    <span>Uptime</span>
                  </div>
                  <div className="signalbot-status-metric">
                    <strong>{statusPanelSummary.latencyValue}</strong>
                    <span>Avg. Latency</span>
                  </div>
                  <div className="signalbot-status-metric">
                    <strong className={statusPanelSummary.accuracyTone}>{statusPanelSummary.accuracyValue}</strong>
                    <span>Accuracy</span>
                  </div>
                </div>
              </section>

              <section className="signalbot-runtime-grid">
                {signalOperationalInsights.map((item) => (
                  <article key={item.label} className={`signalbot-runtime-card is-${item.tone}`}>
                    <span className="signalbot-runtime-label">{item.label}</span>
                    <strong className="signalbot-runtime-value">{item.value}</strong>
                    <p>{item.note}</p>
                  </article>
                ))}
              </section>

              <section className="signalbot-settings-panel">
                <div className="signalbot-settings-panel-head">
                  <strong>Signal Settings</strong>
                </div>

                <div className="signalbot-settings-panel-body">
                  <div className="signalbot-settings-row">
                    <div className="signalbot-settings-row-copy">
                      <strong>Auto-Execute Trades</strong>
                      <p>Decide si este bot puede trabajar en modo automático dentro de su carril gobernado.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoExecuteEnabled}
                      aria-label="Toggle auto execute trades"
                      data-testid="signalbot-auto-execute-toggle"
                      className={`botsettings-switch ${autoExecuteEnabled ? "is-active" : ""}`}
                      onClick={() => void handleToggleAutoExecute()}
                    >
                      <span />
                    </button>
                  </div>

                  <div className="signalbot-settings-row">
                    <div className="signalbot-settings-row-copy">
                      <strong>Push Notifications</strong>
                      <p>Controla si este bot enviará alertas push desde su configuración persistida.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pushNotificationsEnabled}
                      aria-label="Toggle push notifications"
                      className={`botsettings-switch ${pushNotificationsEnabled ? "is-active" : ""}`}
                      onClick={() => void handleTogglePushNotifications()}
                    >
                      <span />
                    </button>
                  </div>

                  <div className="signalbot-settings-row is-input">
                    <div className="signalbot-settings-row-copy">
                      <strong>Max Position Size</strong>
                      <p>Define el monto máximo por trade que este bot puede abrir. No puede superar el capital del bot.</p>
                    </div>
                    <label className="signalbot-inline-input-shell">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={maxPositionDraft}
                        onChange={(event) => setMaxPositionDraft(event.target.value)}
                        onBlur={() => void handleSaveMaxPositionSize()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleSaveMaxPositionSize();
                          }
                        }}
                        aria-label="Max Position Size"
                      />
                      <span>USDT</span>
                    </label>
                  </div>

                  <div className="signalbot-settings-row is-input">
                    <div className="signalbot-settings-row-copy">
                      <strong>Capital</strong>
                      <p>
                        Define el capital máximo que este bot tiene permitido usar.
                        {" "}
                        Disponible para este bot ahora:
                        {" "}
                        {formatUsd(maxCapitalForThisBotUsd)}
                        .
                      </p>
                    </div>
                    <label className="signalbot-inline-input-shell">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={capitalDraft}
                        onChange={(event) => setCapitalDraft(event.target.value)}
                        onBlur={() => void handleSaveCapital()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleSaveCapital();
                          }
                        }}
                        aria-label="Capital"
                      />
                      <span>USDT</span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="signalbot-settings-panel">
                <div className="signalbot-settings-panel-head">
                  <strong>Active Trading Pairs</strong>
                </div>

                <div className="signalbot-pairs-row">
                  <div className="signalbot-pair-chip-wrap">
                    {selectedBotPairs.map((pair) => isWatchlistUniverse ? (
                      <div key={pair} className="signalbot-pair-chip is-static">
                        <span>{pair}</span>
                      </div>
                    ) : (
                      <button
                        key={pair}
                        type="button"
                        className="signalbot-pair-chip"
                        onClick={() => void handleRemoveTradingPair(pair)}
                      >
                        <span>{pair}</span>
                        <SignalCloseIcon />
                      </button>
                    ))}
                    {!isWatchlistUniverse ? (
                      <button
                        type="button"
                        className="signalbot-pair-add"
                        onClick={() => setIsPairDrawerOpen(true)}
                      >
                        <span>+</span>
                        <strong>Add Pair</strong>
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="signalbot-settings-panel">
                <div className="signalbot-settings-panel-head">
                  <strong>Active Timeframes</strong>
                </div>

                <div className="signalbot-pairs-row">
                  <div className="signalbot-pair-chip-wrap">
                    {selectedBotTimeframes.map((timeframe) => (
                      <button
                        key={timeframe}
                        type="button"
                        className="signalbot-pair-chip"
                        onClick={() => void handleRemoveTradingTimeframe(timeframe)}
                      >
                        <span>{timeframe}</span>
                        <SignalCloseIcon />
                      </button>
                    ))}
                    <button
                      type="button"
                      className="signalbot-pair-add"
                      onClick={() => setIsTimeframeDrawerOpen(true)}
                    >
                      <span>+</span>
                      <strong>Add Timeframe</strong>
                    </button>
                  </div>
                </div>
              </section>

            </div>
          ) : null}
        </div>
      </section>

      {isPairDrawerOpen ? (
        <div className="botsettings-drawer-shell">
          <button type="button" className="botsettings-drawer-backdrop" aria-label="Close add pair drawer" onClick={() => setIsPairDrawerOpen(false)} />
          <aside className="botsettings-drawer signalbot-pair-drawer">
            <div className="botsettings-drawer-head">
              <div>
                <h2>Add Trading Pair</h2>
                <p>Add a new pair to this bot's active list.</p>
              </div>
              <button type="button" className="botsettings-drawer-close" aria-label="Close add pair drawer" onClick={() => setIsPairDrawerOpen(false)}>
                <SignalCloseIcon />
              </button>
            </div>

            <div className="botsettings-drawer-form">
              <div className="botsettings-field-block signalbot-pair-search-block">
                <label className="botsettings-field-label">Select Pair</label>
                <div className="signalbot-pair-search-shell">
                  <label className="botsettings-input-shell signalbot-pair-search-input">
                    <SearchIcon />
                    <input
                      type="text"
                      value={pairQuery}
                      placeholder={`Search all pairs on ${pairExchangeDraft}`}
                      onFocus={() => setPairSearchOpen(true)}
                      onChange={(event) => {
                        setPairQuery(event.target.value);
                        setPairSearchOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setPairSearchOpen(false), 120);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && filteredPairOptions[0]) {
                          event.preventDefault();
                          handleSelectPairDraft(filteredPairOptions[0]);
                        }
                      }}
                      aria-label="Select Pair"
                    />
                  </label>
                  {pairSearchOpen ? (
                    <div className="coin-combobox-menu signalbot-pair-search-menu">
                      <div className="coin-combobox-head">
                        {pairSearchLoading ? `Loading ${pairExchangeDraft} pairs...` : `Pairs on ${pairExchangeDraft}`}
                      </div>
                      {filteredPairOptions.length ? (
                        filteredPairOptions.map((pair) => (
                          <button
                            key={pair}
                            type="button"
                            className={`coin-combobox-option${pair === pairDraft ? " current" : ""}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectPairDraft(pair);
                            }}
                          >
                            {pair}
                          </button>
                        ))
                      ) : (
                        <div className="coin-combobox-empty">
                          {pairSearchLoading
                            ? "Cargando pares del exchange..."
                            : `No encontramos ese par en ${pairExchangeDraft}.`}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <FormSelect
                label="Exchange"
                value={pairExchangeDraft}
                options={[formatSignalBotExecutionAccount(selectedBotCard)]}
                onChange={setPairExchangeDraft}
              />
              <div className="botsettings-toggle-card">
                <div className="botsettings-toggle-copy">
                  <strong>AI Analysis</strong>
                  <span>Visual only for now. We will wire the analysis logic later.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pairAiAnalysisDraft}
                  className={`botsettings-switch ${pairAiAnalysisDraft ? "is-active" : ""}`}
                  onClick={() => setPairAiAnalysisDraft((value) => !value)}
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="botsettings-drawer-actions signalbot-pair-drawer-actions">
              <button type="button" className="ui-button" onClick={() => setIsPairDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ui-button ui-button-primary" onClick={() => void handleAddTradingPair()}>
                Add Pair
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {isTimeframeDrawerOpen ? (
        <div className="botsettings-drawer-shell">
          <button type="button" className="botsettings-drawer-backdrop" aria-label="Close add timeframe drawer" onClick={() => setIsTimeframeDrawerOpen(false)} />
          <aside className="botsettings-drawer signalbot-pair-drawer">
            <div className="botsettings-drawer-head">
              <div>
                <h2>Add Timeframe</h2>
                <p>Add a new timeframe to this bot's active list.</p>
              </div>
              <button type="button" className="botsettings-drawer-close" aria-label="Close add timeframe drawer" onClick={() => setIsTimeframeDrawerOpen(false)}>
                <SignalCloseIcon />
              </button>
            </div>

            <div className="botsettings-drawer-form">
              <FormSelect
                label="Select Timeframe"
                value={timeframeDraft}
                options={availableTimeframeOptions.length ? availableTimeframeOptions : [timeframeDraft]}
                onChange={setTimeframeDraft}
              />
            </div>

            <div className="botsettings-drawer-actions signalbot-pair-drawer-actions">
              <button type="button" className="ui-button" onClick={() => setIsTimeframeDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ui-button ui-button-primary" onClick={() => void handleAddTradingTimeframe()}>
                Add Timeframe
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {observedSignalDetail ? (
        <div className="botsettings-drawer-shell">
          <button
            type="button"
            className="botsettings-drawer-backdrop"
            aria-label="Close signal detail drawer"
            onClick={() => setObservedSignalDetail(null)}
          />
          <aside className="botsettings-drawer signalbot-detail-drawer">
            <div className="botsettings-drawer-head">
              <div className="signalbot-detail-head-copy">
                <div className="signalbot-detail-head-title">
                  <SignalAssetBadge symbol={observedSignalDetail.signal.context.symbol} />
                  <div className="signalbot-detail-head-text">
                    <strong>{observedSignalDetail.signal.context.symbol}</strong>
                    <span>
                      {getCardVenueLabel(observedSignalDetail.signal, observedSignalDetail.snapshot, observedSignalDetail.direction)}
                      {" • "}
                      {observedSignalDetail.signal.context.timeframe}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="botsettings-drawer-close"
                aria-label="Close signal detail drawer"
                onClick={() => setObservedSignalDetail(null)}
              >
                <SignalCloseIcon />
              </button>
            </div>

            <div className="botsettings-drawer-form signalbot-detail-body">
              <section className="signalbot-detail-panel">
                <div className="signalbot-detail-confidence-row">
                  <div className="signalbot-detail-confidence-copy">
                    <strong>Signal Score</strong>
                    <span>Ranking score used to prioritize this setup in the bot feed.</span>
                  </div>
                  <strong className={`signalbot-detail-confidence-value ${getConfidenceTextClass(observedSignalDetail.signal)}`}>
                    {Math.min(observedSignalDetail.signal.ranking.compositeScore, 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="signalbot-progress-track">
                  <div
                    className={`signalbot-progress-fill ${getConfidenceFillClass(observedSignalDetail.signal)}`}
                    style={{ width: `${Math.min(observedSignalDetail.signal.ranking.compositeScore, 100)}%` }}
                  />
                </div>
                <div className="signalbot-detail-scorer-row">
                  <div className="signalbot-detail-scorer-copy">
                    <strong>Execution Readiness</strong>
                    <span>{getExecutionReadinessNote(observedSignalDetail.signal)}</span>
                  </div>
                  <div className="signalbot-detail-scorer-metrics">
                    <span className={`signalbot-history-status-pill ${getExecutionReadinessTone(observedSignalDetail.signal)}`}>
                      {getExecutionReadinessLabel(observedSignalDetail.signal)}
                    </span>
                    <strong>
                      {getScorerConfidenceValue(observedSignalDetail.signal) != null
                        ? `${getScorerConfidenceValue(observedSignalDetail.signal)!.toFixed(0)}%`
                        : "--"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="signalbot-detail-grid">
                <SignalDetailTile
                  label="Entry Price"
                  value={formatUsd(observedSignalDetail.entry)}
                />
                <SignalDetailTile
                  label="Current Price"
                  value={formatUsd(getSignalCurrentPrice(observedSignalDetail.signal, observedSignalDetail.snapshot, feedReadModel.marketCore, feedReadModel.signalMemory))}
                  tone={getSignalCurrentPriceTone(observedSignalDetail)}
                />
                <SignalDetailTile
                  label="Take Profit"
                  value={formatUsd(observedSignalDetail.target)}
                  tone="is-positive"
                />
                <SignalDetailTile
                  label="Stop Loss"
                  value={formatUsd(observedSignalDetail.stopLoss)}
                  tone="is-negative"
                />
              </section>

              <section className="signalbot-detail-panel">
                <div className="signalbot-detail-panel-head">
                  <strong>AI Analysis</strong>
                </div>
                <div className="signalbot-detail-analysis-list">
                  {buildSignalAnalysisPoints(observedSignalDetail.signal, observedSignalDetail.snapshot).map((point) => (
                    <div key={point} className="signalbot-detail-analysis-item">
                      <span className="signalbot-detail-analysis-check">
                        <SignalCheckIcon />
                      </span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="signalbot-detail-grid is-summary">
                <SignalDetailTile
                  label="Risk/Reward"
                  value={`1:${formatRatio(getSignalRiskReward(observedSignalDetail))}`}
                />
                <SignalDetailTile
                  label="Potential Profit"
                  value={`${formatPct(getSignalPotentialProfitPct(observedSignalDetail))}%`}
                  tone="is-positive"
                />
              </section>
            </div>

            <div className="botsettings-drawer-actions signalbot-detail-actions">
              <button
                type="button"
                className="ui-button"
                onClick={async () => {
                  await handleDecisionAction(observedSignalDetail.signal, observedSignalDetail.snapshot, "block");
                  setObservedSignalDetail(null);
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={async () => {
                  await handleDecisionAction(observedSignalDetail.signal, observedSignalDetail.snapshot, "execute");
                  setObservedSignalDetail(null);
                }}
              >
                Execute Trade
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SignalStatCard(props: {
  label: string;
  value: string;
  note: string;
  tone: "success" | "info" | "primary" | "warning";
  icon: ReactNode;
  status?: string;
}) {
  return (
    <div className="signalbot-summary-card ui-summary-card">
      <div className="signalbot-summary-copy ui-summary-card-copy">
        <div className="signalbot-summary-head">
          <div className="signalbot-summary-label ui-summary-card-label">{props.label}</div>
          <div className={`signalbot-summary-icon ${props.tone} ui-summary-card-icon`}>{props.icon}</div>
        </div>
        <div className="signalbot-summary-value-row">
          <div className="signalbot-summary-value ui-summary-card-value">{props.value}</div>
          {!props.status ? <span className={`signalbot-summary-delta ${props.tone}`}>{props.note}</span> : null}
        </div>
        <div className="signalbot-summary-footer">
          {props.status ? <span className={`signalbot-summary-status ${props.tone}`}>{props.status}</span> : <span className="signalbot-summary-note">{props.note}</span>}
          {props.label === "Win Rate" ? (
            <div className="signalbot-summary-progress">
              <div className="signalbot-summary-progress-track">
                <div className="signalbot-summary-progress-fill" style={{ width: props.value }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FormSelect(props: {
  label: string;
  value: string;
  options: ReadonlyArray<string | { value: string; label: string }>;
  onChange: (value: string) => void;
  note?: string;
}) {
  return (
    <div className="botsettings-field-block">
      <label className="botsettings-field-label">{props.label}</label>
      <label className="botsettings-select-shell ui-input-shell is-select">
        <select value={props.value} onChange={(event) => props.onChange(event.target.value)} aria-label={props.label}>
          {props.options.map((option) => (
            <option key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
              {typeof option === "string" ? option : option.label}
            </option>
          ))}
        </select>
        <SelectChevronIcon />
      </label>
      {props.note ? <span className="botsettings-field-note">{props.note}</span> : null}
    </div>
  );
}

function SignalDetailTile(props: {
  label: string;
  value: string;
  tone?: "is-positive" | "is-negative";
}) {
  return (
    <div className="signalbot-detail-tile">
      <span>{props.label}</span>
      <strong className={props.tone || ""}>{props.value}</strong>
    </div>
  );
}

function SignalAssetBadge({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const asset = symbol.split("/")[0] || symbol;
  const iconUrl = getAssetIconUrl(asset);

  if (failed) {
    return <div className={`signalbot-asset-fallback ${getAssetAccentClass(asset)}`}>{asset.slice(0, 1)}</div>;
  }

  return (
    <img
      src={iconUrl}
      alt={`${asset} logo`}
      className="signalbot-asset-logo"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function getAssetIconUrl(asset: string) {
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${asset.toLowerCase()}.png`;
}

function buildSignalAnalysisPoints(signal: RankedPublishedSignal, snapshot?: SignalSnapshot) {
  const confirmations = snapshot?.signal_payload?.analysis?.confirmations || [];
  const warnings = snapshot?.signal_payload?.analysis?.warnings || [];
  const reasons = snapshot?.signal_payload?.signal?.reasons || [];
  const derived = [
    snapshot?.note,
    snapshot?.setup_type ? `Setup type: ${snapshot.setup_type}.` : "",
    snapshot?.setup_quality ? `Setup quality: ${snapshot.setup_quality}.` : "",
    snapshot?.risk_label ? `Risk label: ${snapshot.risk_label}.` : "",
    signal.context.marketRegime ? `Market regime: ${signal.context.marketRegime}.` : "",
  ];

  const points = [...confirmations, ...reasons, ...warnings.map((item) => `Warning: ${item}`), ...derived]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const unique = Array.from(new Set(points));
  if (unique.length) return unique.slice(0, 5);

  return [
    `Signal scoped to ${signal.context.symbol} on ${signal.context.timeframe}.`,
    `Composite score registered at ${Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%.`,
  ];
}

function getSignalCurrentPrice(
  signal: RankedPublishedSignal,
  snapshot: SignalSnapshot | undefined,
  marketCore: { currentCoin?: string; currentPrice?: number },
  signals: SignalSnapshot[],
) {
  const marketCoin = String(marketCore.currentCoin || "").trim().toUpperCase();
  if (marketCoin === signal.context.symbol.toUpperCase() && Number(marketCore.currentPrice || 0) > 0) {
    return Number(marketCore.currentPrice || 0);
  }

  const latestForCoin = signals
    .filter((item) => item.coin.toUpperCase() === signal.context.symbol.toUpperCase())
    .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())[0];

  return Number(
    latestForCoin?.signal_payload?.plan?.entry
    || latestForCoin?.entry_price
    || snapshot?.signal_payload?.plan?.entry
    || snapshot?.entry_price
    || 0,
  );
}

function getSignalCurrentPriceTone(detail: {
  direction: SignalCardDirection;
  entry: number;
  signal: RankedPublishedSignal;
  snapshot?: SignalSnapshot;
}) {
  const currentPrice = getSignalCurrentPrice(detail.signal, detail.snapshot, { currentCoin: "", currentPrice: 0 }, detail.snapshot ? [detail.snapshot] : []);
  if (detail.entry <= 0 || currentPrice <= 0) return undefined;
  if (detail.direction === "SELL") {
    return currentPrice <= detail.entry ? "is-positive" : "is-negative";
  }
  return currentPrice >= detail.entry ? "is-positive" : "is-negative";
}

function getSignalRiskReward(detail: {
  snapshot?: SignalSnapshot;
  entry: number;
  target: number;
  stopLoss: number;
}) {
  const rrRatio = Number(detail.snapshot?.rr_ratio || 0);
  if (rrRatio > 0) return rrRatio;
  const reward = Math.abs(detail.target - detail.entry);
  const risk = Math.abs(detail.entry - detail.stopLoss);
  if (reward <= 0 || risk <= 0) return 0;
  return reward / risk;
}

function getSignalPotentialProfitPct(detail: {
  direction: SignalCardDirection;
  entry: number;
  target: number;
}) {
  if (detail.entry <= 0 || detail.target <= 0) return 0;
  if (detail.direction === "SELL") {
    return ((detail.entry - detail.target) / detail.entry) * 100;
  }
  return ((detail.target - detail.entry) / detail.entry) * 100;
}

function formatRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.00";
  return value.toFixed(2);
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return Math.abs(value).toFixed(2);
}

function findSnapshotForSignal(symbol: string, timeframe: string, signals: SignalSnapshot[]) {
  return signals.find((item) => item.coin.toUpperCase() === symbol.toUpperCase() && item.timeframe === timeframe);
}

function getSnapshotIdFromPublishedSignalId(value: string) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^published:memory:(\d+)$/);
  if (!match) return 0;
  const nextValue = Number(match[1]);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function findSnapshotForPublishedSignal(signalId: string, signals: SignalSnapshot[]) {
  const snapshotId = getSnapshotIdFromPublishedSignalId(signalId);
  if (!snapshotId) return undefined;
  return signals.find((item) => Number(item.id) === snapshotId);
}

function normalizeSignalId(value: unknown) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
}

function normalizeTimeframe(value: string) {
  return String(value || "").trim();
}

function timeframeRank(value: string) {
  const normalized = normalizeTimeframe(value);
  const ordered = SIGNAL_BOT_TIMEFRAME_OPTIONS.indexOf(normalized as (typeof SIGNAL_BOT_TIMEFRAME_OPTIONS)[number]);
  return ordered === -1 ? Number.MAX_SAFE_INTEGER : ordered;
}

function sortTimeframes(values: string[]) {
  return [...values].sort((left, right) => timeframeRank(left) - timeframeRank(right));
}

function mapSignalLayer(signal: RankedPublishedSignal) {
  const adaptiveScore = Number(signal.intelligence?.adaptiveScore || 0);
  const baseScore = Number(signal.context.score || 0);
  const hasAdaptivePromotion = adaptiveScore > baseScore || Boolean(signal.intelligence?.scorerLabel);
  if (hasAdaptivePromotion) return "ai-prioritized" as const;
  if (signal.intelligence?.executionEligible) return "operable" as const;
  return signal.ranking.tier === "low-visibility" || signal.ranking.tier === "standard"
    ? "observational" as const
    : "operable" as const;
}

function buildDecisionRationale(action: "observe" | "execute" | "block", signal: RankedPublishedSignal) {
  if (action === "execute") {
    return `Operación confirmada manualmente para ${signal.context.symbol} con score ${Math.round(signal.ranking.compositeScore)}.`;
  }
  if (action === "block") {
    return `La señal de ${signal.context.symbol} fue descartada desde el workspace del bot.`;
  }
  return `La señal de ${signal.context.symbol} fue revisada manualmente desde el workspace del bot.`;
}

function isExecutionTimelineEntry(value: unknown): value is {
  id: string;
  symbol: string;
  mode: string;
  status: string;
  pnlUsd: number;
  entryPrice: number | null;
  createdAt: string;
  updatedAt: string;
} {
  return Boolean(
    value
    && typeof value === "object"
    && "symbol" in value
    && "mode" in value
    && "status" in value
    && "pnlUsd" in value
    && "createdAt" in value,
  );
}

function isActivityDecisionEntry(value: unknown): value is {
  kind: "decision";
  decision: {
    id: string;
    symbol: string;
    action: string;
    status: string;
    entryPrice: number | null;
    targetPrice: number | null;
    pnlUsd: number;
    createdAt: string;
    updatedAt: string;
  };
  linkedOrder?: {
    status: string;
    pnlUsd: number;
    entryPrice: number | null;
    hasOutcome?: boolean;
    updatedAt: string;
  } | null;
} {
  return Boolean(
    value
    && typeof value === "object"
    && "kind" in value
    && (value as { kind?: string }).kind === "decision"
    && "decision" in value,
  );
}

function isActivityOrderEntry(value: unknown): value is {
  kind: "order";
  order: {
    id: string;
    symbol: string;
    mode: string;
    status: string;
    pnlUsd: number;
    entryPrice: number | null;
    createdAt: string;
    updatedAt: string;
  };
} {
  return Boolean(
    value
    && typeof value === "object"
    && "kind" in value
    && (value as { kind?: string }).kind === "order"
    && "order" in value,
  );
}

function formatMaybeUsd(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? formatUsd(nextValue) : "-";
}

function createSignalHistoryRow(
  entry: BotCanonicalTrade | BotDecisionRecord | SignalSnapshot | unknown,
  signals: SignalSnapshot[],
): SignalHistoryRow | null {
  if (isCanonicalTradeEntry(entry)) {
    const side = entry.side;
    const statusKey = resolveTradeHistoryStatus(entry.outcomeStatus || entry.lifecycleStatus, entry.realizedPnlUsd, entry.hasOutcome);
    if (!statusKey) return null;
    return {
      id: entry.id,
      pair: entry.symbol,
      timeframe: entry.timeframe,
      side,
      typeLabel: side,
      statusKey,
      statusLabel: formatTradeHistoryStatus(statusKey),
      statusTone: getTradeHistoryToneClass(statusKey),
      typeTone: getTypeToneClass(side),
      entryPrice: entry.entryPrice,
      exitPrice: resolveTradeHistoryExitPrice({
        symbol: entry.symbol,
        timeframe: entry.timeframe,
        side,
        statusKey,
        signals,
        preferredTargetPrice: entry.targetPrice,
        preferredStopPrice: entry.stopPrice,
      }),
      pnlUsd: entry.realizedPnlUsd,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt || entry.startedAt,
      dateAt: entry.endedAt || entry.startedAt,
      pairNote: buildSignalHistoryPairNote(entry.timeframe, "Trade"),
    };
  }

  if (isActivityOrderEntry(entry)) {
    if (String(entry.order.status || "").trim().toLowerCase() === "preview") return null;
    const timeframe = String((entry.order as { timeframe?: string }).timeframe || "");
    const side = resolveHistorySide((entry.order as { side?: string }).side || "", entry.order.symbol, timeframe, signals);
    const statusKey = resolveTradeHistoryStatus(entry.order.status, entry.order.pnlUsd, Boolean((entry.order as { hasOutcome?: boolean }).hasOutcome));
    if (!statusKey || side === "NEUTRAL") return null;
    const typeLabel = side;
    return {
      id: `history:${entry.order.id}`,
      pair: entry.order.symbol,
      timeframe,
      side,
      typeLabel,
      statusKey,
      statusLabel: formatTradeHistoryStatus(statusKey),
      statusTone: getTradeHistoryToneClass(statusKey),
      typeTone: getTypeToneClass(typeLabel),
      entryPrice: entry.order.entryPrice,
      exitPrice: resolveTradeHistoryExitPrice({
        symbol: entry.order.symbol,
        timeframe,
        side,
        statusKey,
        signals,
      }),
      pnlUsd: entry.order.pnlUsd,
      startedAt: entry.order.createdAt,
      endedAt: entry.order.updatedAt || entry.order.createdAt,
      dateAt: entry.order.updatedAt || entry.order.createdAt,
      pairNote: buildSignalHistoryPairNote(timeframe, "Trade"),
    };
  }

  if (isActivityDecisionEntry(entry)) {
    if (!entry.linkedOrder) return null;
    const timeframe = String((entry.decision as { timeframe?: string }).timeframe || "");
    const linkedSide = String((entry.linkedOrder as { side?: string } | null | undefined)?.side || "");
    const fallbackSide = String((entry.decision as { metadata?: { side?: string; direction?: string } }).metadata?.side
      || (entry.decision as { metadata?: { side?: string; direction?: string } }).metadata?.direction
      || "");
    const side = resolveHistorySide(linkedSide || fallbackSide, entry.decision.symbol, timeframe, signals);
    const pnlUsd = entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd;
    const statusKey = resolveTradeHistoryStatus(entry.linkedOrder?.status || entry.decision.status, pnlUsd, Boolean(entry.linkedOrder?.hasOutcome));
    if (!statusKey || side === "NEUTRAL") return null;
    const typeLabel = side;
    return {
      id: `history:${entry.decision.id}`,
      pair: entry.decision.symbol,
      timeframe,
      side,
      typeLabel,
      statusKey,
      statusLabel: formatTradeHistoryStatus(statusKey),
      statusTone: getTradeHistoryToneClass(statusKey),
      typeTone: getTypeToneClass(typeLabel),
      entryPrice: entry.linkedOrder?.entryPrice ?? entry.decision.entryPrice,
      exitPrice: resolveTradeHistoryExitPrice({
        symbol: entry.decision.symbol,
        timeframe,
        side,
        statusKey,
        signals,
        preferredTargetPrice: entry.decision.targetPrice,
      }),
      pnlUsd,
      startedAt: entry.decision.createdAt,
      endedAt: entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt,
      dateAt: entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt,
      pairNote: buildSignalHistoryPairNote(timeframe, "Trade"),
    };
  }

  if (isExecutionTimelineEntry(entry)) {
    if (String(entry.status || "").trim().toLowerCase() === "preview") return null;
    const timeframe = String((entry as { timeframe?: string }).timeframe || "");
    const side = resolveHistorySide(String((entry as { side?: string }).side || ""), entry.symbol, timeframe, signals);
    const statusKey = resolveTradeHistoryStatus(entry.status, entry.pnlUsd, Boolean((entry as { hasOutcome?: boolean }).hasOutcome));
    if (!statusKey || side === "NEUTRAL") return null;
    const typeLabel = side;
    return {
      id: `history:${entry.id}`,
      pair: entry.symbol,
      timeframe,
      side,
      typeLabel,
      statusKey,
      statusLabel: formatTradeHistoryStatus(statusKey),
      statusTone: getTradeHistoryToneClass(statusKey),
      typeTone: getTypeToneClass(typeLabel),
      entryPrice: entry.entryPrice,
      exitPrice: resolveTradeHistoryExitPrice({
        symbol: entry.symbol,
        timeframe,
        side,
        statusKey,
        signals,
      }),
      pnlUsd: entry.pnlUsd,
      startedAt: entry.createdAt,
      endedAt: entry.updatedAt || entry.createdAt,
      dateAt: entry.updatedAt || entry.createdAt,
      pairNote: buildSignalHistoryPairNote(timeframe, "Trade"),
    };
  }

  return null;
}

function buildSignalHistoryPairNote(timeframe: string, contextLabel: string) {
  const parts = [String(timeframe || "").trim(), String(contextLabel || "").trim()].filter(Boolean);
  return parts.join(" • ") || "Bot history";
}

type SignalBotActivityDecisionEntry = {
  kind: "decision";
  decision: BotDecisionRecord & {
    executionIntentLaneStatus?: string | null;
    executionIntentReason?: string | null;
    executionIntentDispatchStatus?: string | null;
    executionIntentDispatchMode?: string | null;
  };
  linkedOrder?: {
    orderId?: number | null;
    updatedAt?: string | null;
  } | null;
};

function isSignalBotActivityDecisionEntry(value: unknown): value is SignalBotActivityDecisionEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SignalBotActivityDecisionEntry>;
  return candidate.kind === "decision"
    && Boolean(candidate.decision)
    && typeof candidate.decision?.id === "string";
}

function createSignalBotActivityRows(
  activityTimeline: unknown[],
  tradeTimeline: BotCanonicalTrade[],
): SignalBotActivityRow[] {
  const tradeOrderIds = new Set(
    tradeTimeline
      .map((entry) => Number(entry.orderId || 0))
      .filter((entry) => Number.isFinite(entry) && entry > 0),
  );

  return activityTimeline
    .filter(isSignalBotActivityDecisionEntry)
    .filter((entry) => {
      const linkedOrderId = Number(entry.linkedOrder?.orderId || 0);
      return !linkedOrderId || !tradeOrderIds.has(linkedOrderId);
    })
    .map((entry) => createSignalBotActivityRow(entry))
    .filter((row): row is SignalBotActivityRow => Boolean(row));
}

function createSignalBotActivityRow(entry: SignalBotActivityDecisionEntry): SignalBotActivityRow | null {
  const status = resolveSignalBotActivityStatus(entry.decision);
  if (!status) return null;

  const actionLabel = formatSignalBotActivityAction(entry.decision.action);
  const actionTone = getSignalBotActivityActionTone(entry.decision.action);
  const reason = resolveSignalBotActivityReason(entry.decision);
  const sourceLabel = formatSignalBotActivitySource(entry.decision.source);
  const timeframe = String(entry.decision.timeframe || "").trim();

  return {
    id: `activity:${entry.decision.id}`,
    pair: entry.decision.symbol,
    timeframe,
    actionLabel,
    actionTone,
    statusKey: status.key,
    statusLabel: status.label,
    statusTone: status.tone,
    reason,
    dateAt: String(entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt || ""),
    pairNote: buildSignalHistoryPairNote(timeframe, sourceLabel),
  };
}

function resolveSignalBotActivityStatus(decision: SignalBotActivityDecisionEntry["decision"]) {
  const laneStatus = String(decision.executionIntentLaneStatus || "").trim().toLowerCase();
  const decisionStatus = String(decision.status || "").trim().toLowerCase();

  if (laneStatus === "blocked" || decisionStatus === "blocked" || decisionStatus === "dismissed") {
    return {
      key: "blocked" as const,
      label: decisionStatus === "dismissed" ? "Dismissed" : "Blocked",
      tone: "is-negative",
    };
  }

  if (laneStatus === "awaiting-approval" || (decisionStatus === "approved" && decision.action !== "block")) {
    return {
      key: "review" as const,
      label: "Needs Review",
      tone: "is-neutral",
    };
  }

  if (laneStatus === "queued" || laneStatus === "dispatch-requested" || decisionStatus === "pending") {
    return {
      key: "queue" as const,
      label: laneStatus === "dispatch-requested" ? "Dispatch Requested" : "In Queue",
      tone: "is-neutral",
    };
  }

  if (laneStatus === "previewed" || laneStatus === "preview-recorded" || laneStatus === "preview-expired" || laneStatus === "execution-submitted") {
    return {
      key: "preview" as const,
      label: formatSignalBotActivityLaneStatus(laneStatus),
      tone: laneStatus === "preview-expired" ? "is-warning" : "is-warning",
    };
  }

  if (laneStatus === "linked" || decisionStatus === "executed" || decisionStatus === "closed") {
    return {
      key: "handoff" as const,
      label: "Handed Off",
      tone: "is-positive",
    };
  }

  return null;
}

function formatSignalBotActivityAction(action: string) {
  const normalized = String(action || "").trim().toLowerCase();
  if (normalized === "execute") return "EXECUTE";
  if (normalized === "assist") return "ASSIST";
  if (normalized === "observe") return "OBSERVE";
  if (normalized === "accept") return "ACCEPT";
  if (normalized === "block") return "BLOCK";
  if (normalized === "close") return "CLOSE";
  return normalized ? normalized.toUpperCase() : "BOT";
}

function getSignalBotActivityActionTone(action: string) {
  const normalized = String(action || "").trim().toLowerCase();
  if (normalized === "execute" || normalized === "accept" || normalized === "close") return "is-positive";
  if (normalized === "block") return "is-negative";
  return "is-neutral";
}

function formatSignalBotActivitySource(source: string) {
  const normalized = String(source || "").trim();
  if (!normalized) return "Bot activity";
  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveSignalBotActivityReason(decision: SignalBotActivityDecisionEntry["decision"]) {
  const explicitReason = String(decision.executionIntentReason || "").trim();
  if (explicitReason) return explicitReason;
  const rationale = String(decision.rationale || "").trim();
  if (rationale) return rationale;
  return "This signal stayed inside the bot activity flow without producing a real trade entry.";
}

function formatSignalBotActivityLaneStatus(value: string) {
  if (value === "previewed") return "Previewed";
  if (value === "preview-recorded") return "Preview Saved";
  if (value === "preview-expired") return "Preview Expired";
  if (value === "execution-submitted") return "Submitted";
  return "Preview Flow";
}

function resolveTradeHistoryStatus(status: string, pnlUsd: number | null | undefined, hasOutcome: boolean) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedPnl = Number(pnlUsd || 0);

  if (normalizedStatus.includes("invalidated") || normalizedStatus.includes("stop")) return "stopped" as const;
  if (normalizedStatus.includes("protected")) return "protected" as const;
  if (normalizedStatus.includes("loss")) return "loss" as const;
  if (hasOutcome && normalizedPnl < 0) return "loss" as const;
  if (
    hasOutcome
    && (
      normalizedStatus.includes("win")
      || normalizedStatus.includes("complete")
      || normalizedStatus.includes("closed")
      || normalizedStatus.includes("filled")
      || normalizedPnl >= 0
    )
  ) {
    return "completed" as const;
  }

  return null;
}

function formatTradeHistoryStatus(status: SignalHistoryTradeStatus) {
  if (status === "completed") return "Completed";
  if (status === "loss") return "Loss";
  if (status === "stopped") return "Stopped";
  return "Protected";
}

function getTradeHistoryToneClass(status: SignalHistoryTradeStatus) {
  return status === "completed" || status === "protected" ? "is-positive" : "is-negative";
}

function resolveTradeHistoryExitPrice(input: {
  symbol: string;
  timeframe: string;
  side: SignalCardDirection;
  statusKey: SignalHistoryTradeStatus;
  signals: SignalSnapshot[];
  preferredTargetPrice?: number | null;
  preferredStopPrice?: number | null;
}) {
  const snapshot = findSnapshotForSignal(input.symbol, input.timeframe, input.signals);
  const preferredTargetPrice = Number(input.preferredTargetPrice || 0) || null;
  const preferredStopPrice = Number(input.preferredStopPrice || 0) || null;
  const targetPrice = preferredTargetPrice
    || Number(snapshot?.tp_price || snapshot?.tp2_price || snapshot?.resistance || 0)
    || null;
  const stopPrice = preferredStopPrice || Number(snapshot?.sl_price || 0) || null;

  if (input.statusKey === "loss" || input.statusKey === "stopped") {
    return stopPrice;
  }

  return targetPrice;
}

function resolveHistorySide(value: string, symbol: string, timeframe: string, signals: SignalSnapshot[]) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BUY" || normalized === "SELL") return normalized;
  const snapshot = findSnapshotForSignal(symbol, timeframe, signals);
  return formatDirection(snapshot);
}

function isCanonicalTradeEntry(value: unknown): value is BotCanonicalTrade {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BotCanonicalTrade>;
  return typeof candidate.id === "string"
    && typeof candidate.orderId === "number"
    && typeof candidate.symbol === "string"
    && (candidate.side === "BUY" || candidate.side === "SELL");
}

function getScorerConfidenceValue(signal: RankedPublishedSignal) {
  const value = Number(signal.intelligence?.scorerConfidence || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getExecutionReadinessTone(signal: RankedPublishedSignal) {
  const scorerConfidence = getScorerConfidenceValue(signal);
  const executionEligible = Boolean(signal.intelligence?.executionEligible);
  if (executionEligible && (scorerConfidence == null || scorerConfidence >= 68)) return "is-positive";
  if (executionEligible || (scorerConfidence != null && scorerConfidence >= 54)) return "is-neutral";
  return "is-negative";
}

function getExecutionReadinessLabel(signal: RankedPublishedSignal) {
  const scorerConfidence = getScorerConfidenceValue(signal);
  const executionEligible = Boolean(signal.intelligence?.executionEligible);
  if (executionEligible && (scorerConfidence == null || scorerConfidence >= 68)) return "Execution Ready";
  if (executionEligible || (scorerConfidence != null && scorerConfidence >= 54)) return "Needs Review";
  return "Blocked by Edge";
}

function getExecutionReadinessNote(signal: RankedPublishedSignal) {
  const scorerConfidence = getScorerConfidenceValue(signal);
  const executionEligible = Boolean(signal.intelligence?.executionEligible);
  if (executionEligible && scorerConfidence != null) {
    return `The execution scorer currently reads ${scorerConfidence.toFixed(0)}% confidence for this setup.`;
  }
  if (executionEligible) {
    return "The signal remains executable for the bot, but the scorer did not publish a formal confidence value yet.";
  }
  return "The adaptive execution layer does not currently consider this setup ready for live dispatch.";
}

function getTypeToneClass(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "buy" || normalized === "execute") return "is-positive";
  if (normalized === "sell" || normalized === "block") return "is-negative";
  if (normalized === "assist" || normalized === "observe" || normalized === "preview") return "is-neutral";
  return "is-neutral";
}


function getDisplaySignalDirection(signal: RankedPublishedSignal, snapshot?: SignalSnapshot): SignalCardDirection {
  const direct = String(signal.context.direction || "").toUpperCase();
  if (direct === "BUY" || direct === "SELL") return direct;

  const snapshotDirection = formatDirection(snapshot);
  if (snapshotDirection === "BUY" || snapshotDirection === "SELL") return snapshotDirection;

  return "NEUTRAL";
}

function prioritizeSignalsForDisplay(signals: RankedPublishedSignal[]) {
  const seenSymbols = new Set<string>();
  const firstPass: RankedPublishedSignal[] = [];
  const secondPass: RankedPublishedSignal[] = [];

  for (const signal of signals) {
    const symbol = String(signal.context.symbol || "").trim().toUpperCase();
    if (!seenSymbols.has(symbol)) {
      seenSymbols.add(symbol);
      firstPass.push(signal);
      continue;
    }
    secondPass.push(signal);
  }

  return [...firstPass, ...secondPass];
}

function matchesFilter(_signal: RankedPublishedSignal, direction: SignalCardDirection, filter: SignalFilter) {
  if (filter === "all") return true;
  if (filter === "buy") return direction === "BUY";
  if (filter === "sell") return direction === "SELL";
  return true;
}

function getCardVenueLabel(signal: RankedPublishedSignal, snapshot: SignalSnapshot | undefined, direction: SignalCardDirection) {
  const venue = getVenueLabel(snapshot);
  if (venue !== "Binance Spot") return venue;
  return direction === "SELL" ? "Binance Futures" : signal.context.symbol.startsWith("BTC") ? "Binance Futures" : "Binance Spot";
}

function getVenueLabel(snapshot?: SignalSnapshot) {
  const mode = String(snapshot?.execution_mode || "").toLowerCase();
  if (mode.includes("real")) return "Binance Live";
  if (mode.includes("demo")) return "Binance Demo";
  return "Binance Spot";
}

function getAssetAccentClass(symbol: string) {
  if (symbol.startsWith("BTC")) return "is-btc";
  if (symbol.startsWith("ETH")) return "is-eth";
  if (symbol.startsWith("SOL")) return "is-sol";
  if (symbol.startsWith("BNB")) return "is-bnb";
  if (symbol.startsWith("XRP")) return "is-xrp";
  if (symbol.startsWith("ADA")) return "is-ada";
  return "is-generic";
}

function getConfidenceToneClass(signal: RankedPublishedSignal) {
  const score = Math.min(signal.ranking.compositeScore, 100);
  if (score >= 85) return "is-high";
  if (score >= 70) return "is-mid";
  return "is-low";
}

function getConfidenceTextClass(signal: RankedPublishedSignal) {
  const score = Math.min(signal.ranking.compositeScore, 100);
  if (score >= 85) return "is-high";
  if (score >= 70) return "is-mid";
  return "is-low";
}

function getConfidenceFillClass(signal: RankedPublishedSignal) {
  const score = Math.min(signal.ranking.compositeScore, 100);
  if (score >= 85) return "is-high";
  if (score >= 70) return "is-mid";
  return "is-low";
}

function formatIntentLaneStatusLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Idle";
  if (normalized === "dispatch-requested") return "Dispatch Requested";
  if (normalized === "execution-submitted") return "Execution Submitted";
  if (normalized === "awaiting-approval") return "Awaiting Approval";
  if (normalized === "preview-recorded") return "Preview Recorded";
  if (normalized === "preview-expired") return "Preview Expired";
  return normalized
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatOwnershipHealthLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Forming";
  if (normalized === "needs-attention") return "Needs Attention";
  return normalized
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function titleCaseToken(value?: string | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : "";
}

function getBotStatusLabel(status: string) {
  if (status === "active") return "Running";
  if (status === "paused") return "Paused";
  if (status === "draft") return "Draft";
  if (status === "disabled") return "Disabled";
  return "Stopped";
}

function inferBotWorkspacePair(bot: { slug?: string; name?: string } | null) {
  const slug = String(bot?.slug || "").toLowerCase();
  const name = String(bot?.name || "").toLowerCase();
  if (slug.includes("signal")) return "BTC/USDT";
  if (slug.includes("dca")) return "ETH/USDT";
  if (slug.includes("arbitrage")) return "BNB/USDT";
  if (slug.includes("pump")) return "SOL/USDT";
  if (name.includes("ai")) return "AI/USDT";
  return "BTC/USDT";
}

function formatBotWorkspaceStrategy(bot: { strategyPolicy?: { preferredStrategyIds: string[] }; stylePolicy?: { dominantStyle?: string } } | null) {
  const raw = bot?.strategyPolicy?.preferredStrategyIds?.[0] || bot?.stylePolicy?.dominantStyle || "signals";
  return raw
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatSignalBotExecutionAccount(bot: {
  executionAccount?: { label?: string; provider?: string; environment?: string } | null;
  executionEnvironment?: string | null;
} | null) {
  const account = bot?.executionAccount;
  if (account?.provider) {
    const provider = account.provider.charAt(0).toUpperCase() + account.provider.slice(1).toLowerCase();
    const environment = String(account.environment || "").trim().toLowerCase();
    if (environment === "demo") return `${provider} Demo`;
    if (environment === "paper") return `${provider} Paper`;
    if (environment === "real") return provider;
  }
  if (account?.label) return account.label;
  if (bot?.executionEnvironment === "demo") return "Binance Demo";
  if (bot?.executionEnvironment === "paper") return "Paper";
  if (bot?.executionEnvironment === "real") return "Live";
  return "Unassigned";
}

function buildSignalBotStatusSummary(
  bot: {
    status?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    audit?: { lastDecisionAt?: string | null; lastExecutionAt?: string | null } | null;
    activity?: { lastSignalConsumedAt?: string | null } | null;
    localMemory?: { outcomeCount?: number } | null;
  } | null,
  winRate: number,
) {
  const status = String(bot?.status || "draft");
  const isActive = status === "active";
  const referenceTimestamp = bot?.activity?.lastSignalConsumedAt || bot?.audit?.lastDecisionAt || bot?.updatedAt || bot?.createdAt || null;

  return {
    note: isActive
      ? "Bot is actively scanning inside its governed workspace."
      : status === "paused"
        ? "Bot is paused and will not scan until you turn it back on."
        : status === "disabled"
          ? "Bot is disabled for audit and cannot operate from this workspace."
          : "Bot is configured but still idle until you start it.",
    uptimeValue: isActive
      ? referenceTimestamp ? formatSignalBotRuntime(referenceTimestamp) : "Live"
      : status === "paused"
        ? "Paused"
        : status === "disabled"
          ? "Disabled"
          : "Idle",
    latencyValue: bot?.audit?.lastDecisionAt
      ? `${Math.max(80, Math.min(980, calculateSignalBotLatency(bot.audit.lastDecisionAt, bot.audit.lastExecutionAt || bot.activity?.lastSignalConsumedAt || null)))}ms`
      : "--",
    accuracyValue: bot?.localMemory?.outcomeCount ? `${winRate.toFixed(1)}%` : "--",
    accuracyTone: bot?.localMemory?.outcomeCount ? "is-positive" : "",
  };
}

function formatSignalBotRuntime(timestamp: string) {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d`;
}

function calculateSignalBotLatency(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : startMs + 156;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 156;
  const diff = Math.abs(endMs - startMs);
  return diff > 0 ? Math.min(diff, 980) : 156;
}

function isSameExecutionAccount(
  bot: {
    executionAccount?: { id?: string | null; provider?: string | null; environment?: string | null } | null;
    executionEnvironment?: string | null;
  } | null,
  selectedBot: {
    executionAccount?: { id?: string | null; provider?: string | null; environment?: string | null } | null;
    executionEnvironment?: string | null;
  } | null,
) {
  if (!bot || !selectedBot) return false;
  const botAccountId = String(bot.executionAccount?.id || "").trim();
  const selectedAccountId = String(selectedBot.executionAccount?.id || "").trim();
  if (botAccountId && selectedAccountId) return botAccountId === selectedAccountId;

  const botProvider = String(bot.executionAccount?.provider || "").trim().toLowerCase();
  const selectedProvider = String(selectedBot.executionAccount?.provider || "").trim().toLowerCase();
  const botEnvironment = String(bot.executionAccount?.environment || bot.executionEnvironment || "").trim().toLowerCase();
  const selectedEnvironment = String(selectedBot.executionAccount?.environment || selectedBot.executionEnvironment || "").trim().toLowerCase();

  return Boolean(botProvider && selectedProvider && botProvider === selectedProvider && botEnvironment === selectedEnvironment);
}

function formatDirection(signal?: SignalSnapshot) {
  const direction = String(signal?.signal_payload?.context?.direction || signal?.trend || "").toLowerCase();
  if (
    direction.includes("sell")
    || direction.includes("bear")
    || direction.includes("vender")
    || direction.includes("bajista")
  ) return "SELL";
  if (
    direction.includes("buy")
    || direction.includes("bull")
    || direction.includes("comprar")
    || direction.includes("alcista")
  ) return "BUY";
  return "NEUTRAL";
}

function formatDuration(start: string, end: string) {
  const diffMinutes = Math.max(1, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelative(value: string) {
  const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  return `${Math.floor(diffHours / 24)} d ago`;
}

function SignalViewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SignalBroadcastIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.7 7.7a6 6 0 0 0 0 8.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.3 7.7a6 6 0 0 1 0 8.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.1 4.9a10 10 0 0 1 0 14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignalTargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SignalProfitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 15 4.5-4.5 3.2 3.2L19 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 7.5H19V12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.8v4.7l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalBotStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="7" width="12" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5.5M15 7V5.5M9 17v1.5M15 17v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M3.8 11.5H6M18 11.5h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignalPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 6 9 6-9 6V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SignalCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignalCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.4 12.1 2.3 2.3 5-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SelectChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
