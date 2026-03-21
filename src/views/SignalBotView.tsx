import { useMemo, useState, type ReactNode } from "react";
import { DownloadIcon, SlidersHorizontalIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type { BotDecisionRecord, RankedPublishedSignal } from "../domain";
import type { SignalSnapshot, ViewName } from "../types";

type SignalBotTab = "active-signals" | "signal-history" | "performance" | "settings";
type SignalFilter = "all" | "buy" | "sell" | "btc" | "eth" | "alt" | "high";
type SignalCardDirection = "BUY" | "SELL" | "NEUTRAL";

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

const FILTER_CHIPS: Array<{ key: SignalFilter; label: string }> = [
  { key: "all", label: "All Signals" },
  { key: "buy", label: "Buy Only" },
  { key: "sell", label: "Sell Only" },
  { key: "btc", label: "BTC Pairs" },
  { key: "eth", label: "ETH Pairs" },
  { key: "alt", label: "Altcoins" },
  { key: "high", label: "High Confidence" },
];

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const [activeFilter, setActiveFilter] = useState<SignalFilter>("all");
  const feedReadModel = useSignalsBotsReadModel();
  const { createDecision } = useBotDecisionsState();
  const signals = feedReadModel.signalMemory;
  const selectedBotCard = feedReadModel.selectedBotCard || feedReadModel.botCards[0] || null;
  const selectedBotSignals = feedReadModel.selectedBotApprovedRankedSignals;
  const selectedBotBlockedCount = feedReadModel.selectedBotBlockedSignals.length;

  const readModel = useMemo(() => {
    const scopedSignalFeed = selectedBotSignals.length ? selectedBotSignals : feedReadModel.prioritySignals;
    const openSignals = signals.filter((signal: SignalSnapshot) => signal.outcome_status === "pending");
    const closedSignals = signals.filter((signal: SignalSnapshot) => signal.outcome_status !== "pending");
    const cards = scopedSignalFeed.slice(0, 12).map((signal: RankedPublishedSignal) => {
      const snapshot = findSnapshotForSignal(signal.context.symbol, signal.context.timeframe, signals);
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
      botDecisions: feedReadModel.selectedBotDecisions,
      openSignals,
      closedSignals,
      cards,
      filteredCards: cards.filter((card) => matchesFilter(card.signal, card.direction, activeFilter)),
      closedHistory: feedReadModel.selectedBotActivityTimeline.length
        ? feedReadModel.selectedBotActivityTimeline
        : closedSignals
          .slice()
          .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())
          .slice(0, 12),
      performanceBreakdowns: feedReadModel.selectedBotPerformanceBreakdowns.slice(0, 6),
    };
  }, [activeFilter, feedReadModel, selectedBotBlockedCount, selectedBotSignals, signals]);

  const selectedBotName = selectedBotCard?.name || "Signal Bot";
  const selectedBotPair = selectedBotCard?.workspaceSettings.primaryPair || selectedBotCard?.leadingSignal?.context.symbol || inferBotWorkspacePair(selectedBotCard);
  const selectedBotStrategy = formatBotWorkspaceStrategy(selectedBotCard);
  const selectedBotStatus = selectedBotCard ? getBotStatusLabel(selectedBotCard.status) : "Running";
  const selectedBotWinRate = selectedBotCard?.performance.winRate ?? calculateWinRate(readModel.closedSignals);
  const selectedBotProfit = selectedBotCard?.performance.realizedPnlUsd ?? sumPnl(readModel.closedSignals);
  const selectedBotTradeCount = selectedBotCard?.localMemory.outcomeCount ?? readModel.closedSignals.length;
  const selectedBotPairCount = new Set(readModel.priority.map((signal) => signal.context.symbol)).size;

  const handleDecisionAction = async (
    signal: RankedPublishedSignal,
    snapshot: SignalSnapshot | undefined,
    action: "observe" | "execute" | "block",
  ) => {
    if (!selectedBotCard) return;

    const loaderId = startLoading({
      label: action === "execute" ? "Registrando ejecución" : action === "block" ? "Registrando descarte" : "Registrando revisión",
      detail: `${selectedBotCard.name} • ${signal.context.symbol}`,
    });

    try {
      await createDecision({
        id: `${selectedBotCard.id}-${signal.id}-${action}-${Date.now()}`,
        botId: selectedBotCard.id,
        signalSnapshotId: snapshot?.id ?? null,
        symbol: signal.context.symbol,
        timeframe: signal.context.timeframe,
        signalLayer: mapSignalLayer(signal),
        action,
        status: action === "execute" ? "executed" : action === "block" ? "dismissed" : "approved",
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
          realizedPnlUsd: action === "execute" ? Number(snapshot?.outcome_pnl || 0) || 0 : 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      showToast({
        tone: "success",
        title: action === "execute" ? "Decisión ejecutada" : action === "block" ? "Señal descartada" : "Señal revisada",
        message: `${selectedBotCard.name} registró ${signal.context.symbol} en su historial real.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo registrar la decisión",
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
            <h1 className="signalbot-title">{selectedBotName}</h1>
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
            value={String(readModel.priority.length)}
            note={`${readModel.botBlockedCount} blocked by bot rules`}
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
            note={formatPct(calculateAveragePnl(readModel.closedSignals))}
            tone="primary"
            icon={<SignalProfitIcon />}
          />
          <SignalStatCard
            label="Pending Signals"
            value={String(readModel.botApproved.length)}
            note="approved for this bot"
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
                {readModel.filteredCards.slice(0, 6).map(({ signal, snapshot, direction, entry, target, stopLoss }) => (
                  <article key={signal.id} className={`signalbot-card ${direction === "BUY" ? "is-buy" : direction === "SELL" ? "is-sell" : "is-neutral"}`}>
                    <div className="signalbot-card-head">
                      <div className="signalbot-card-identity">
                        <SignalAssetBadge symbol={signal.context.symbol} />
                        <div className="signalbot-card-copy">
                          <h3 className="signalbot-card-title">{signal.context.symbol}</h3>
                          <p className="signalbot-card-subtitle">{getCardVenueLabel(signal, snapshot, direction)}</p>
                        </div>
                      </div>
                      <span className={`signalbot-status-pill ${direction === "BUY" ? "is-buy" : direction === "SELL" ? "is-sell" : "is-neutral"}`}>
                        {direction}
                      </span>
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
                          <span>AI Confidence</span>
                        </div>
                        <strong className={`signalbot-confidence-value ${getConfidenceTextClass(signal)}`}>
                          {Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%
                        </strong>
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
                          onClick={() => void handleDecisionAction(signal, snapshot, "observe")}
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

              {!readModel.filteredCards.length ? (
                <div className="signalbot-empty">
                  <strong>No signals match this filter right now.</strong>
                  <span>The shared ranked feed is live, but this subset is currently empty.</span>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === "signal-history" ? (
            <div className="ui-table-shell signalbot-table-shell">
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
                  {readModel.closedHistory.map((entry: BotDecisionRecord | SignalSnapshot | (typeof readModel.closedHistory)[number]) => isActivityOrderEntry(entry) ? (
                    <tr key={entry.order.id}>
                      <td>{entry.order.symbol}</td>
                      <td>{formatExecutionType(entry.order.mode)}</td>
                      <td>{formatMaybeUsd(entry.order.entryPrice)}</td>
                      <td>-</td>
                      <td className={Number(entry.order.pnlUsd || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(entry.order.pnlUsd)}
                      </td>
                      <td>{formatDuration(entry.order.createdAt, entry.order.updatedAt || entry.order.createdAt)}</td>
                      <td>{formatExecutionStatus(entry.order.status)}</td>
                      <td>{formatDate(entry.order.updatedAt || entry.order.createdAt)}</td>
                    </tr>
                  ) : isActivityDecisionEntry(entry) ? (
                    <tr key={entry.decision.id}>
                      <td>{entry.decision.symbol}</td>
                      <td>{formatDecisionAction(entry.decision.action)}</td>
                      <td>{formatMaybeUsd(entry.linkedOrder?.entryPrice ?? entry.decision.entryPrice)}</td>
                      <td>{formatMaybeUsd(entry.decision.targetPrice)}</td>
                      <td className={Number(entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd ?? 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd)}
                      </td>
                      <td>{formatDuration(entry.decision.createdAt, entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt)}</td>
                      <td>{formatDecisionStatus(entry.linkedOrder?.status || entry.decision.status)}</td>
                      <td>{formatDate(entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt)}</td>
                    </tr>
                  ) : isExecutionTimelineEntry(entry) ? (
                    <tr key={entry.id}>
                      <td>{entry.symbol}</td>
                      <td>{formatExecutionType(entry.mode)}</td>
                      <td>{formatMaybeUsd(entry.entryPrice)}</td>
                      <td>-</td>
                      <td className={Number(entry.pnlUsd || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(entry.pnlUsd)}
                      </td>
                      <td>{formatDuration(entry.createdAt, entry.updatedAt || entry.createdAt)}</td>
                      <td>{formatExecutionStatus(entry.status)}</td>
                      <td>{formatDate(entry.updatedAt || entry.createdAt)}</td>
                    </tr>
                  ) : isDecisionRecord(entry) ? (
                    <tr key={entry.id}>
                      <td>{entry.symbol}</td>
                      <td>{formatDecisionAction(entry.action)}</td>
                      <td>{formatMaybeUsd(entry.metadata.entryPrice)}</td>
                      <td>{formatMaybeUsd(entry.metadata.targetPrice)}</td>
                      <td className={Number(entry.metadata.realizedPnlUsd || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(entry.metadata.realizedPnlUsd)}
                      </td>
                      <td>{formatDuration(entry.createdAt, entry.updatedAt || entry.createdAt)}</td>
                      <td>{formatDecisionStatus(entry.status)}</td>
                      <td>{formatDate(entry.updatedAt || entry.createdAt)}</td>
                    </tr>
                  ) : isTimelineEntry(entry) ? (
                    <tr key={entry.id}>
                      <td>{entry.symbol}</td>
                      <td>{formatDecisionAction(entry.action)}</td>
                      <td>{formatMaybeUsd(entry.entryPrice)}</td>
                      <td>{formatMaybeUsd(entry.targetPrice)}</td>
                      <td className={Number(entry.pnlUsd || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>
                        {formatMaybeUsd(entry.pnlUsd)}
                      </td>
                      <td>{formatDuration(entry.createdAt, entry.updatedAt || entry.createdAt)}</td>
                      <td>{formatDecisionStatus(entry.status)}</td>
                      <td>{formatDate(entry.updatedAt || entry.createdAt)}</td>
                    </tr>
                  ) : (
                    <tr key={entry.id}>
                      <td>{entry.coin}</td>
                      <td>{formatDirection(entry)}</td>
                      <td>{formatUsd(Number(entry.entry_price || entry.support || 0))}</td>
                      <td>{formatUsd(Number(entry.tp_price || entry.resistance || 0))}</td>
                      <td className={Number(entry.outcome_pnl || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>{formatUsd(Number(entry.outcome_pnl || 0))}</td>
                      <td>{formatDuration(entry.created_at, entry.updated_at || entry.created_at)}</td>
                      <td>{formatSignalStatus(entry.outcome_status)}</td>
                      <td>{formatDate(entry.updated_at || entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "performance" ? (
            <div className="signalbot-performance-grid">
              <SectionCard title="Performance Summary" subtitle="The shortest explanation of how the bot is doing." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile label="Total Trades" value={String(selectedBotTradeCount)} note="Tracked outcomes attached to this bot profile." />
                  <MetricTile label="Approved Signals" value={String(readModel.botApproved.length)} note="Signals that currently fit this bot policy." />
                  <MetricTile label="Blocked Signals" value={String(readModel.botBlockedCount)} note="Signals filtered out by this bot policy." />
                  <MetricTile
                    label="Avg. Profit / Trade"
                    value={selectedBotCard?.performance.avgPnlUsd != null ? formatUsd(selectedBotCard.performance.avgPnlUsd) : formatPct(calculateAveragePnl(readModel.closedSignals))}
                    note={selectedBotCard?.performance.avgHoldMinutes != null ? `${Math.round(selectedBotCard.performance.avgHoldMinutes)} min average hold.` : "Shared realized result benchmark while bot-level history is still converging."}
                  />
                </div>
              </SectionCard>

              <SectionCard title="What Is Working" subtitle="Simple takeaways the user can read quickly." className="signalbot-subcard">
                <div className="signalbot-insight-stack">
                  <article className="signalbot-insight-card">
                    <strong>Watchlist signals are leading</strong>
                    <p>{String(readModel.watchlistFirst.length)} current ranked ideas come from the active watchlist, which keeps the page focused on familiar markets first.</p>
                  </article>
                  <article className="signalbot-insight-card">
                    <strong>High-confidence set stays compact</strong>
                    <p>{String(readModel.highConfidence.length)} signals currently qualify for the strongest subset, which keeps noise low and clarity high.</p>
                  </article>
                  <article className="signalbot-insight-card">
                    <strong>Bot-ready signals remain curated</strong>
                    <p>{String(readModel.botApproved.length)} signals currently fit {selectedBotName}, while {String(readModel.botBlockedCount)} are still being filtered out by its rules.</p>
                  </article>
                </div>
              </SectionCard>

              <SectionCard title="Bot Activity Breakdown" subtitle="What this bot is actually touching most often." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  {readModel.performanceBreakdowns.length ? readModel.performanceBreakdowns.map((item) => (
                    <MetricTile
                      key={[item.origin, item.symbol, item.timeframe, item.strategyId, item.marketContext].filter(Boolean).join(":")}
                      label={formatBreakdownLabel(item)}
                      value={formatUsd(item.realizedPnlUsd)}
                      note={formatBreakdownNote(item)}
                    />
                  )) : (
                    <MetricTile label="No activity yet" value="-" note="The bot still needs more owned decisions to build a richer breakdown." />
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Execution Ownership" subtitle="Closed execution outcomes linked back to this bot." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile
                    label="Owned Executions"
                    value={String(selectedBotCard?.executionTimeline?.length || 0)}
                    note="Orders resolved from the shared execution plane."
                  />
                  <MetricTile
                    label="Last Execution"
                    value={selectedBotCard?.audit.lastExecutionAt ? formatRelative(selectedBotCard.audit.lastExecutionAt) : "-"}
                    note={selectedBotCard?.executionTimeline?.[0]?.symbol ? `${selectedBotCard.executionTimeline[0].symbol} • ${formatExecutionStatus(selectedBotCard.executionTimeline[0].status)}` : "No linked execution outcome yet."}
                  />
                  <MetricTile
                    label="Execution P/L"
                    value={formatUsd(selectedBotCard?.performance.realizedPnlUsd || 0)}
                    note="Performance now prefers linked execution outcomes when they exist."
                  />
                </div>
              </SectionCard>

              <SectionCard title="Execution Intent" subtitle="What this bot is currently allowed to escalate toward execution." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile
                    label="Ready Intents"
                    value={String(feedReadModel.selectedBotExecutionIntentSummary?.readyCount || 0)}
                    note={feedReadModel.selectedBotExecutionIntentSummary?.topReadySymbols?.length
                      ? feedReadModel.selectedBotExecutionIntentSummary.topReadySymbols.map((item) => `${item.symbol} (${item.count})`).join(", ")
                      : "No intent is fully ready for execution yet."}
                  />
                  <MetricTile
                    label="Approval Needed"
                    value={String(feedReadModel.selectedBotExecutionIntentSummary?.approvalNeededCount || 0)}
                    note={`${feedReadModel.selectedBotExecutionIntentSummary?.assistOnlyCount || 0} assist-only intents are still staying conservative.`}
                  />
                  <MetricTile
                    label="Queued Lane"
                    value={String(feedReadModel.selectedBotExecutionIntentSummary?.queuedCount || 0)}
                    note={`${feedReadModel.selectedBotExecutionIntentSummary?.dispatchRequestedCount || 0} dispatch requested • ${feedReadModel.selectedBotExecutionIntentSummary?.dispatchedCount || 0} dispatched.`}
                  />
                  <MetricTile
                    label="Paper / Demo"
                    value={`${String(feedReadModel.selectedBotExecutionIntentSummary?.previewRecordedCount || 0)} / ${String(feedReadModel.selectedBotExecutionIntentSummary?.executionSubmittedCount || 0)}`}
                    note={`${feedReadModel.selectedBotExecutionIntentSummary?.previewFreshCount || 0} fresh previews • ${feedReadModel.selectedBotExecutionIntentSummary?.previewExpiredCount || 0} expired • ${buildLatestDispatchNote(selectedBotCard)}`}
                  />
                  <MetricTile
                    label="Preview Churn"
                    value={`${String(feedReadModel.selectedBotExecutionIntentSummary?.previewExpiredCount || 0)} expired / ${String(feedReadModel.selectedBotExecutionIntentSummary?.previewRefreshCount || 0)} refreshes / ${String(feedReadModel.selectedBotExecutionIntentSummary?.previewPardonCount || 0)} pardons / ${String(feedReadModel.selectedBotExecutionIntentSummary?.previewManualClearCount || 0)} clears / ${String(feedReadModel.selectedBotExecutionIntentSummary?.previewHardResetCount || 0)} resets`}
                    note={buildPreviewChurnNote(selectedBotCard)}
                  />
                  <MetricTile
                    label="Guardrail Blocks"
                    value={String(feedReadModel.selectedBotExecutionIntentSummary?.guardrailBlockedCount || 0)}
                    note={feedReadModel.selectedBotExecutionIntentSummary?.latestGuardrailReason || "No recent guardrail block is standing out."}
                  />
                  <MetricTile
                    label="Latest Intent"
                    value={formatExecutionIntentStatus(feedReadModel.selectedBotExecutionIntentSummary?.latestIntentStatus)}
                    note={feedReadModel.selectedBotExecutionIntentSummary?.latestIntentSymbol
                      ? `${feedReadModel.selectedBotExecutionIntentSummary.latestIntentSymbol} • ${formatExecutionIntentLaneStatus(feedReadModel.selectedBotExecutionIntentSummary.latestLaneStatus)} • ${formatRelative(feedReadModel.selectedBotExecutionIntentSummary.latestIntentAt || "")}`
                      : "The operational loop has not produced an intent summary yet."}
                  />
                  <MetricTile
                    label="Paper Readiness"
                    value={formatOperationalReadinessState(selectedBotCard?.operationalReadiness?.state)}
                    note={buildOperationalReadinessNote(selectedBotCard)}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Ownership Health" subtitle="How much of this bot's activity is already reconciled." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile
                    label="Reconciled Activity"
                    value={`${Math.round(selectedBotCard?.ownership?.reconciliationPct || 0)}%`}
                    note="Share of tracked bot decisions that already resolve into owned execution history."
                  />
                  <MetricTile
                    label="Needs Link"
                    value={String(selectedBotCard?.ownership?.unresolvedOwnershipCount || 0)}
                    note={`${selectedBotCard?.ownership?.unresolvedDecisionCount || 0} unresolved decisions / ${selectedBotCard?.ownership?.unlinkedExecutionCount || 0} unlinked executions.`}
                  />
                  <MetricTile
                    label="Owned Outcomes"
                    value={String(selectedBotCard?.ownership?.ownedOutcomeCount || 0)}
                    note={`${selectedBotCard?.ownership?.linkedDecisionCount || 0} decisions already carry linked execution ownership.`}
                  />
                  <MetricTile
                    label="Owned Outcome Rate"
                    value={`${Math.round(selectedBotCard?.ownership?.ownedOutcomeRate || 0)}%`}
                    note="How much of tracked bot decision flow has already produced owned outcomes."
                  />
                  <MetricTile
                    label="Unresolved Rate"
                    value={`${Math.round(selectedBotCard?.ownership?.unresolvedRate || 0)}%`}
                    note="Share of owned activity still waiting for stronger linkage or reconciliation."
                  />
                  <MetricTile
                    label="Operational Health"
                    value={formatOwnershipHealthLabel(selectedBotCard?.ownership?.healthLabel)}
                    note={buildOwnershipHealthNote(selectedBotCard?.ownership?.healthLabel || "needs-attention")}
                  />
                </div>
              </SectionCard>

              {selectedBotCard?.ownership?.healthLabel === "watch" || selectedBotCard?.ownership?.healthLabel === "needs-attention" ? (
                <SectionCard title="Linkage Attention" subtitle="Why this bot still needs ownership cleanup." className="signalbot-subcard">
                  <div className="signalbot-insight-stack">
                    <article className="signalbot-insight-card">
                      <strong>{selectedBotCard.ownership.primaryIssue === "decision-linkage" ? "Decision backlog is leading" : "Execution backlog is leading"}</strong>
                      <p>
                        {selectedBotCard.ownership.primaryIssue === "decision-linkage"
                          ? `${selectedBotCard.ownership.unresolvedDecisionCount} decisions still need an owned execution bridge.`
                          : `${selectedBotCard.ownership.unlinkedExecutionCount} executions are still waiting to be tied back into bot-owned history.`}
                      </p>
                    </article>
                    <article className="signalbot-insight-card">
                      <strong>Top unresolved symbols</strong>
                      <p>
                        {selectedBotCard.ownership.unresolvedDecisionSymbols?.length
                          ? selectedBotCard.ownership.unresolvedDecisionSymbols.join(", ")
                          : "No unresolved decision symbols are standing out yet."}
                      </p>
                    </article>
                    <article className="signalbot-insight-card">
                      <strong>Top unlinked execution symbols</strong>
                      <p>
                        {selectedBotCard.ownership.unlinkedExecutionSymbols?.length
                          ? selectedBotCard.ownership.unlinkedExecutionSymbols.join(", ")
                          : "No unlinked execution symbols are standing out yet."}
                      </p>
                    </article>
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard title="Adaptation Readiness" subtitle="What owned outcomes are currently teaching this bot." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile
                    label="Training Confidence"
                    value={capitalize(feedReadModel.selectedBotAdaptationSummary?.trainingConfidence || "low")}
                    note={`${feedReadModel.selectedBotAdaptationSummary?.trustedOutcomeCount || 0} owned outcomes currently support adaptation.`}
                  />
                  <MetricTile
                    label="Best Learned Edge"
                    value={feedReadModel.selectedBotAdaptationSummary?.bestSymbol || "Waiting"}
                    note={feedReadModel.selectedBotAdaptationSummary?.bestEdge || "The bot still needs clearer owned outcomes."}
                  />
                  <MetricTile
                    label="Weakest Pocket"
                    value={feedReadModel.selectedBotAdaptationSummary?.weakestSymbol || "None yet"}
                    note={feedReadModel.selectedBotAdaptationSummary?.weakness || "No weak flow is obvious yet."}
                  />
                  <MetricTile
                    label="Adaptive Bias"
                    value={feedReadModel.selectedBotAdaptationSummary?.trainingConfidence === "high" ? "Lean In" : feedReadModel.selectedBotAdaptationSummary?.trainingConfidence === "medium" ? "Balanced" : "Cautious"}
                    note={feedReadModel.selectedBotAdaptationSummary?.adaptationBias || "Adaptation will stay conservative until owned outcomes improve."}
                  />
                </div>
              </SectionCard>

              <SectionCard title="Memory Layers" subtitle="Local, family and platform learning stay separate." className="signalbot-subcard">
                <div className="signalbot-mini-grid">
                  <MetricTile
                    label="Local Memory"
                    value={String(selectedBotCard?.localMemory.outcomeCount || 0)}
                    note={selectedBotCard?.localMemory.notes?.[0] || "This bot's owned outcomes."}
                  />
                  <MetricTile
                    label="Family Memory"
                    value={String(selectedBotCard?.familyMemory.outcomeCount || 0)}
                    note={selectedBotCard?.familyMemory.notes?.[0] || "No family learning yet."}
                  />
                  <MetricTile
                    label="Global Memory"
                    value={String(selectedBotCard?.globalMemory.outcomeCount || 0)}
                    note={selectedBotCard?.globalMemory.notes?.[0] || "No platform memory yet."}
                  />
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="signalbot-settings-grid">
              <SettingsCard title="Bot Status" value={selectedBotStatus} note={`${selectedBotName} is the full workspace currently selected from Bot Settings.`} />
              <SettingsCard title="Minimum Confidence" value={`${Math.min(calculateMinimumConfidence(readModel.highConfidence), 100).toFixed(0)}%`} note="Only clearer opportunities are promoted into the strongest subset." />
              <SettingsCard title="Notifications" value={selectedBotCard?.notificationSettings?.errorAlerts ? "Enabled" : "Limited"} note="Alert routing now comes from the persisted bot profile." />
              <SettingsCard title="Trading Pairs" value={String(selectedBotPairCount)} note="The current mix of pairs stays curated from watchlist and discovery." />
              <SettingsCard title="Identity" value={formatOperatingProfile(selectedBotCard)} note={`${selectedBotCard?.identity.family || "signal-core"} • ${selectedBotCard?.executionEnvironment || "paper"} • ${selectedBotCard?.automationMode || "observe"}`} />
              <SettingsCard title="Policy Envelope" value={formatPolicyEnvelope(selectedBotCard)} note={`Overlap ${selectedBotCard?.overlapPolicy.executionOverlap || "block"} • priority ${selectedBotCard?.overlapPolicy.priority ?? 0}`} />
              <SettingsCard title="Execution Intent" value={`${formatExecutionIntentStatus(feedReadModel.selectedBotExecutionIntentSummary?.latestIntentStatus)} • ${String(feedReadModel.selectedBotExecutionIntentSummary?.queuedCount || 0)} queued`} note={feedReadModel.selectedBotExecutionIntentSummary?.latestGuardrailCode ? `Last block: ${feedReadModel.selectedBotExecutionIntentSummary.latestGuardrailCode}` : `${feedReadModel.selectedBotExecutionIntentSummary?.dispatchRequestedCount || 0} dispatch requested • ${feedReadModel.selectedBotExecutionIntentSummary?.previewFreshCount || 0} fresh previewed • ${feedReadModel.selectedBotExecutionIntentSummary?.previewExpiredCount || 0} expired previewed • ${feedReadModel.selectedBotExecutionIntentSummary?.executionSubmittedCount || 0} demo submitted • ${buildLatestDispatchNote(selectedBotCard)}`} />
              <SettingsCard title="Intent Attention" value={formatAttentionPriority(selectedBotCard?.attention?.priority)} note={selectedBotCard?.attention?.note || "No preview churn or intent backlog is standing out right now."} />
              <SettingsCard title="Ownership Health" value={`${formatOwnershipHealthLabel(selectedBotCard?.ownership?.healthLabel)} • ${Math.round(selectedBotCard?.ownership?.reconciliationPct || 0)}% reconciled`} note={`${selectedBotCard?.ownership?.ownedOutcomeCount || 0} owned outcomes • ${selectedBotCard?.ownership?.unresolvedOwnershipCount || 0} still need linkage`} />
              <SettingsCard title="Latest Activity" value={selectedBotCard?.activity.lastDecisionAction ? formatDecisionAction(selectedBotCard.activity.lastDecisionAction) : "No decisions yet"} note={selectedBotCard?.activity.lastDecisionSymbol ? `${selectedBotCard.activity.lastDecisionSymbol} • ${formatDecisionStatus(selectedBotCard.activity.lastDecisionStatus || "pending")}` : "The bot has not consumed a tracked signal yet."} />
              <div className="signalbot-settings-cta">
                <button type="button" className="ui-button ui-button-primary" onClick={() => onNavigateView("control-bot-settings")}>
                  Open Full Bot Settings
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
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

function MetricTile(props: { label: string; value: string; note: string }) {
  return (
    <div className="signalbot-metric-tile">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
    </div>
  );
}

function SettingsCard(props: { title: string; value: string; note: string }) {
  return (
    <div className="signalbot-setting-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
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

function findSnapshotForSignal(symbol: string, timeframe: string, signals: SignalSnapshot[]) {
  return signals.find((item) => item.coin.toUpperCase() === symbol.toUpperCase() && item.timeframe === timeframe);
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

function formatOperatingProfile(bot: { identity?: { operatingProfile?: string } } | null) {
  const value = bot?.identity?.operatingProfile || "manual-assisted";
  if (value === "automatic") return "Automatic";
  if (value === "experimental") return "Experimental";
  if (value === "unrestricted-ai") return "Unrestricted AI";
  return "Manual Assisted";
}

function formatPolicyEnvelope(bot: {
  universePolicy?: { kind?: string };
  stylePolicy?: { dominantStyle?: string };
  executionPolicy?: { requiresHumanApproval?: boolean };
} | null) {
  const universe = bot?.universePolicy?.kind || "watchlist";
  const style = bot?.stylePolicy?.dominantStyle || "swing";
  const approval = bot?.executionPolicy?.requiresHumanApproval ? "approval" : "self-exec";
  return `${universe} • ${style} • ${approval}`;
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

function isDecisionRecord(value: unknown): value is {
  id: string;
  symbol: string;
  action: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
} {
  return Boolean(value) && typeof value === "object" && "symbol" in (value as Record<string, unknown>) && "action" in (value as Record<string, unknown>);
}

function isTimelineEntry(value: unknown): value is {
  id: string;
  symbol: string;
  action: string;
  status: string;
  entryPrice: number | null;
  targetPrice: number | null;
  pnlUsd: number;
  createdAt: string;
  updatedAt: string;
} {
  return Boolean(
    value
    && typeof value === "object"
    && "symbol" in value
    && "action" in value
    && "status" in value
    && "pnlUsd" in value
    && "createdAt" in value,
  );
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

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatOwnershipHealthLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Needs Attention";
  return normalized.split("-").map(capitalize).join(" ");
}

function formatExecutionIntentStatus(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Waiting";
  return normalized.split("-").map(capitalize).join(" ");
}

function formatExecutionIntentLaneStatus(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Pending";
  return normalized.split("-").map(capitalize).join(" ");
}

function buildLatestDispatchNote(bot: {
  decisionTimeline?: Array<{
    executionIntentDispatchMode?: string | null;
    executionIntentDispatchStatus?: string | null;
    executionIntentDispatchedAt?: string | null;
    executionIntentDispatchAttemptedAt?: string | null;
  }>;
} | null) {
  const latestDispatch = bot?.decisionTimeline?.find((entry) => (
    Boolean(entry.executionIntentDispatchMode || entry.executionIntentDispatchStatus)
  )) || null;

  if (!latestDispatch) return "No dispatch has run yet.";

  const mode = String(latestDispatch.executionIntentDispatchMode || "").trim().toLowerCase();
  const status = String(latestDispatch.executionIntentDispatchStatus || "").trim();
  const timestamp = latestDispatch.executionIntentDispatchedAt || latestDispatch.executionIntentDispatchAttemptedAt || "";
  const modeLabel = mode === "preview" ? "Paper Preview" : mode === "execute" ? "Demo Execute" : "Dispatch";
  const statusLabel = status ? status.split("-").map(capitalize).join(" ") : "Pending";

  return timestamp
    ? `${modeLabel} • ${statusLabel} • ${formatRelative(timestamp)}`
    : `${modeLabel} • ${statusLabel}`;
}

function formatAttentionPriority(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Clear";
  return normalized.split("-").map(capitalize).join(" ");
}

function buildPreviewChurnNote(bot: {
  executionIntentSummary?: {
    previewExpiredCount?: number;
    previewRefreshCount?: number;
    refreshedPreviewCount?: number;
    previewPardonCount?: number;
    pardonedPreviewCount?: number;
    previewManualClearCount?: number;
    manuallyClearedPreviewCount?: number;
    previewHardResetCount?: number;
    hardResetPreviewCount?: number;
  } | null;
  attention?: {
    priority?: string | null;
    note?: string | null;
  } | null;
} | null) {
  const summary = bot?.executionIntentSummary;
  const expiredCount = summary?.previewExpiredCount || 0;
  const refreshCount = summary?.previewRefreshCount || 0;
  const refreshedIntentCount = summary?.refreshedPreviewCount || 0;
  const pardonCount = summary?.previewPardonCount || 0;
  const pardonedIntentCount = summary?.pardonedPreviewCount || 0;
  const manualClearCount = summary?.previewManualClearCount || 0;
  const manuallyClearedIntentCount = summary?.manuallyClearedPreviewCount || 0;
  const hardResetCount = summary?.previewHardResetCount || 0;
  const hardResetIntentCount = summary?.hardResetPreviewCount || 0;
  const priority = String(bot?.attention?.priority || "").trim();

  if (!expiredCount && !refreshCount) {
    return "Paper preview churn is currently quiet for this bot.";
  }

  const parts = [
    `${expiredCount} expired previews`,
    `${refreshCount} refreshes`,
  ];
  if (refreshedIntentCount > 0) {
    parts.push(`${refreshedIntentCount} intents already recycled`);
  }
  if (pardonCount > 0) {
    parts.push(`${pardonCount} pardons across ${pardonedIntentCount} intents`);
    if (pardonCount >= 2) {
      parts.push("Pardon limit reached, so stronger manual review is now required.");
    }
  }
  if (manualClearCount > 0) {
    parts.push(`${manualClearCount} manual clears across ${manuallyClearedIntentCount} intents`);
  }
  if (hardResetCount > 0) {
    parts.push(`${hardResetCount} hard resets across ${hardResetIntentCount} intents`);
    parts.push("Hard reset is the final paper-lane override before the bot remains in manual review.");
  }
  if (priority === "urgent") {
    parts.push("This churn is now severe enough to keep the bot in urgent attention.");
  } else if (priority === "watch") {
    parts.push("This churn should be watched before trusting repeated paper dispatches.");
  }
  return parts.join(" • ");
}

function formatOperationalReadinessState(value?: string | null) {
  const normalized = String(value || "").trim();
  if (normalized === "ready") return "Ready";
  if (normalized === "recovery") return "Recovery";
  if (normalized === "final-review") return "Final Review";
  return "Monitor";
}

function buildOperationalReadinessNote(bot: {
  operationalReadiness?: {
    state?: string;
  } | null;
  executionEnvironment?: string | null;
  attention?: {
    note?: string | null;
  } | null;
  executionIntentSummary?: {
    readyCount?: number;
    queuedCount?: number;
    dispatchRequestedCount?: number;
  } | null;
} | null) {
  const state = String(bot?.operationalReadiness?.state || "").trim();
  if (state === "ready") {
    return `${bot?.executionIntentSummary?.readyCount || 0} ready • ${bot?.executionIntentSummary?.queuedCount || 0} queued • ${bot?.executionIntentSummary?.dispatchRequestedCount || 0} dispatch requested inside the governed ${bot?.executionEnvironment || "paper"} lane.`;
  }
  if (state === "recovery") {
    return bot?.attention?.note || "This bot is still moving through paper-lane recovery governance.";
  }
  if (state === "final-review") {
    return "The paper lane exhausted its governed recovery overrides and now stays in final manual review.";
  }
  return "The bot is not yet in a clean dispatch-ready state under the current governance model.";
}

function buildOwnershipHealthNote(value: string) {
  if (value === "healthy") return "The bot is reconciling activity and owned outcomes cleanly.";
  if (value === "stable") return "Most of the bot's activity is already reconciled, with only a small backlog.";
  if (value === "watch") return "The bot is usable, but ownership backlog is still large enough to monitor closely.";
  return "Too much owned activity is still unresolved, so adaptation should be interpreted carefully.";
}

function formatBreakdownLabel(item: {
  symbol?: string | null;
  timeframe?: string | null;
  strategyId?: string | null;
  origin?: string | null;
  style?: string | null;
}) {
  const parts = [
    item.symbol,
    item.timeframe,
    item.strategyId ? capitalize(item.strategyId) : null,
    item.origin ? capitalize(item.origin) : null,
  ].filter(Boolean);
  return parts.join(" • ") || "Performance Slice";
}

function formatBreakdownNote(item: {
  closedSignals: number;
  totalSignals: number;
  winRate: number;
  rrAverage?: number | null;
  positivePct?: number | null;
}) {
  const rrNote = item.rrAverage != null ? ` • RR ${item.rrAverage.toFixed(2)}` : "";
  return `${item.closedSignals}/${item.totalSignals} closed • ${item.winRate.toFixed(0)}% win rate${rrNote}`;
}

function formatDecisionAction(action: string) {
  if (action === "execute") return "EXECUTE";
  if (action === "block") return "BLOCK";
  if (action === "observe") return "OBSERVE";
  return action.toUpperCase();
}

function formatDecisionStatus(status: string) {
  if (status === "approved") return "Reviewed";
  if (status === "dismissed") return "Dismissed";
  if (status === "executed") return "Executed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatExecutionType(mode: string) {
  if (mode === "execute") return "EXECUTE";
  if (mode === "observe") return "OBSERVE";
  if (mode === "preview") return "PREVIEW";
  return mode ? mode.toUpperCase() : "ORDER";
}

function formatExecutionStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("closed")) return "Closed";
  if (normalized.includes("win")) return "Win";
  if (normalized.includes("loss")) return "Loss";
  if (normalized.includes("protected")) return "Protected";
  if (normalized.includes("pending") || normalized.includes("open")) return "Pending";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Order";
}

function formatMaybeUsd(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? formatUsd(nextValue) : "-";
}

function getDisplaySignalDirection(signal: RankedPublishedSignal, snapshot?: SignalSnapshot): SignalCardDirection {
  const direct = String(signal.context.direction || "").toUpperCase();
  if (direct === "BUY" || direct === "SELL") return direct;

  const snapshotDirection = formatDirection(snapshot);
  if (snapshotDirection === "BUY" || snapshotDirection === "SELL") return snapshotDirection;

  return "NEUTRAL";
}

function matchesFilter(signal: RankedPublishedSignal, direction: SignalCardDirection, filter: SignalFilter) {
  if (filter === "all") return true;
  if (filter === "buy") return direction === "BUY";
  if (filter === "sell") return direction === "SELL";
  if (filter === "btc") return signal.context.symbol.startsWith("BTC");
  if (filter === "eth") return signal.context.symbol.startsWith("ETH");
  if (filter === "alt") return !signal.context.symbol.startsWith("BTC") && !signal.context.symbol.startsWith("ETH");
  return signal.ranking.tier === "high-confidence";
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

function calculateMinimumConfidence(highConfidence: RankedPublishedSignal[]) {
  if (!highConfidence.length) return 70;
  return Math.min(...highConfidence.map((signal) => signal.ranking.compositeScore));
}

function sumPnl(signals: Array<{ outcome_pnl: number }>) {
  return signals.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
}

function calculateWinRate(signals: Array<{ outcome_status: string }>) {
  const wins = signals.filter((signal) => signal.outcome_status === "win").length;
  return signals.length ? (wins / signals.length) * 100 : 0;
}

function calculateAveragePnl(signals: Array<{ outcome_pnl: number }>) {
  return signals.length ? signals.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0) / signals.length : 0;
}

function getBotStatusLabel(status: string) {
  if (status === "active") return "Running";
  if (status === "paused") return "Paused";
  if (status === "draft") return "Draft";
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
  if (!Number.isFinite(value) || value <= 0) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignalStatus(status: string) {
  if (status === "win") return "Completed";
  if (status === "loss") return "Completed";
  if (status === "invalidated") return "Invalidated";
  return "Closed";
}

function formatDirection(signal?: SignalSnapshot) {
  const direction = String(signal?.signal_payload?.context?.direction || signal?.trend || "").toLowerCase();
  if (direction.includes("sell") || direction.includes("bear")) return "SELL";
  if (direction.includes("buy") || direction.includes("bull")) return "BUY";
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
