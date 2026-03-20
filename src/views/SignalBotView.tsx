import { useMemo, useState, type ReactNode } from "react";
import { DownloadIcon, SlidersHorizontalIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type { RankedPublishedSignal } from "../domain";
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
    const openSignals = signals.filter((signal) => signal.outcome_status === "pending");
    const closedSignals = signals.filter((signal) => signal.outcome_status !== "pending");
    const cards = scopedSignalFeed.slice(0, 12).map((signal) => {
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
      closedHistory: feedReadModel.selectedBotDecisions.length
        ? feedReadModel.selectedBotDecisions
          .slice()
          .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
          .slice(0, 12)
        : closedSignals
          .slice()
          .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())
          .slice(0, 12),
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
                  {readModel.closedHistory.map((entry) => isDecisionRecord(entry) ? (
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
                  <MetricTile label="Avg. Profit / Trade" value={formatPct(calculateAveragePnl(readModel.closedSignals))} note="Shared realized result benchmark while bot-level history is still converging." />
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
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="signalbot-settings-grid">
              <SettingsCard title="Bot Status" value={selectedBotStatus} note={`${selectedBotName} is the full workspace currently selected from Bot Settings.`} />
              <SettingsCard title="Minimum Confidence" value={`${Math.min(calculateMinimumConfidence(readModel.highConfidence), 100).toFixed(0)}%`} note="Only clearer opportunities are promoted into the strongest subset." />
              <SettingsCard title="Notifications" value="Enabled" note="New high-confidence ideas can stay visible without overwhelming the page." />
              <SettingsCard title="Trading Pairs" value={String(selectedBotPairCount)} note="The current mix of pairs stays curated from watchlist and discovery." />
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
  if (signal.ranking.tier === "priority") return "ai-prioritized" as const;
  if (signal.ranking.compositeScore >= 70) return "operable" as const;
  return "observational" as const;
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

function formatMaybeUsd(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? formatUsd(nextValue) : "-";
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
