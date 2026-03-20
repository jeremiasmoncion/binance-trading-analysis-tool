import { useMemo, useState, type ReactNode } from "react";
import { BoltIcon, CheckCircleIcon, DownloadIcon, SlidersHorizontalIcon, TrendUpIcon, WarningTriangleIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
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
  const signals = feedReadModel.signalMemory;

  const readModel = useMemo(() => {
    const openSignals = signals.filter((signal) => signal.outcome_status === "pending");
    const closedSignals = signals.filter((signal) => signal.outcome_status !== "pending");
    const cards = feedReadModel.prioritySignals.slice(0, 12).map((signal) => {
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
      priority: feedReadModel.prioritySignals,
      highConfidence: feedReadModel.highConfidenceSignals,
      watchlistFirst: feedReadModel.watchlistFirstSignals,
      botApproved: feedReadModel.signalBotApprovedSignals,
      openSignals,
      closedSignals,
      cards,
      filteredCards: cards.filter((card) => matchesFilter(card.signal, card.direction, activeFilter)),
      closedHistory: closedSignals
        .slice()
        .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())
        .slice(0, 12),
    };
  }, [activeFilter, feedReadModel, signals]);

  return (
    <div id="signalBotView" className="view-panel active signalbot-view">
      <section className="signalbot-shell">
        <div className="signalbot-summary-grid ui-summary-grid">
          <SignalStatCard
            label="Active Signals"
            value={String(readModel.priority.length)}
            note={`+${Math.max(readModel.openSignals.length - readModel.priority.length, 0)} today`}
            status="Live"
            tone="success"
            icon={<BoltIcon />}
          />
          <SignalStatCard
            label="Win Rate"
            value={`${calculateWinRate(readModel.closedSignals).toFixed(1)}%`}
            note={`${calculateWinRateDelta(readModel.closedSignals).toFixed(1)}%`}
            tone="info"
            icon={<TrendUpIcon />}
          />
          <SignalStatCard
            label="Total Profit (30d)"
            value={formatUsd(sumPnl(readModel.closedSignals))}
            note={formatPct(calculateAveragePnl(readModel.closedSignals))}
            tone="primary"
            icon={<CheckCircleIcon />}
          />
          <SignalStatCard
            label="Pending Signals"
            value={String(readModel.openSignals.length)}
            note="awaiting execution"
            status="Pending"
            tone="warning"
            icon={<WarningTriangleIcon />}
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
                        <button type="button" className="signalbot-icon-button" aria-label={`View ${signal.context.symbol}`}>
                          <SignalViewIcon />
                        </button>
                        <button type="button" className="signalbot-icon-button" aria-label={`Execute ${signal.context.symbol}`}>
                          <SignalPlayIcon />
                        </button>
                        <button type="button" className="signalbot-icon-button" aria-label={`Dismiss ${signal.context.symbol}`}>
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
                  {readModel.closedHistory.map((signal) => (
                    <tr key={signal.id}>
                      <td>{signal.coin}</td>
                      <td>{formatDirection(signal)}</td>
                      <td>{formatUsd(Number(signal.entry_price || signal.support || 0))}</td>
                      <td>{formatUsd(Number(signal.tp_price || signal.resistance || 0))}</td>
                      <td className={Number(signal.outcome_pnl || 0) >= 0 ? "wallet-positive" : "wallet-negative"}>{formatUsd(Number(signal.outcome_pnl || 0))}</td>
                      <td>{formatDuration(signal.created_at, signal.updated_at || signal.created_at)}</td>
                      <td>{formatSignalStatus(signal.outcome_status)}</td>
                      <td>{formatDate(signal.updated_at || signal.created_at)}</td>
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
                  <MetricTile label="Total Trades" value={String(readModel.closedSignals.length)} note="Completed signal outcomes tracked in memory." />
                  <MetricTile label="Winning Trades" value={String(readModel.closedSignals.filter((signal) => signal.outcome_status === "win").length)} note="Closed signals that finished positive." />
                  <MetricTile label="Losing Trades" value={String(readModel.closedSignals.filter((signal) => signal.outcome_status === "loss").length)} note="Closed signals that finished negative." />
                  <MetricTile label="Avg. Profit / Trade" value={formatPct(calculateAveragePnl(readModel.closedSignals))} note="Average realized result per closed signal." />
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
                    <p>{String(readModel.botApproved.length)} signals already fit the current bot policy, so the page only surfaces what is closer to action.</p>
                  </article>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="signalbot-settings-grid">
              <SettingsCard title="Bot Status" value="Active" note="Signal Bot is actively scanning and ranking opportunities for the user." />
              <SettingsCard title="Minimum Confidence" value={`${Math.min(calculateMinimumConfidence(readModel.highConfidence), 100).toFixed(0)}%`} note="Only clearer opportunities are promoted into the strongest subset." />
              <SettingsCard title="Notifications" value="Enabled" note="New high-confidence ideas can stay visible without overwhelming the page." />
              <SettingsCard title="Trading Pairs" value={String(new Set(readModel.priority.map((signal) => signal.context.symbol)).size)} note="The current mix of pairs stays curated from watchlist and discovery." />
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
        <div className="signalbot-summary-label ui-summary-card-label">{props.label}</div>
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
      <div className={`signalbot-summary-icon ${props.tone} ui-summary-card-icon`}>{props.icon}</div>
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

function calculateWinRateDelta(signals: Array<{ outcome_status: string }>) {
  const recent = signals.slice(-10);
  return calculateWinRate(recent) - calculateWinRate(signals);
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
