import { useMemo, useState, type ReactNode } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { BoltIcon, CheckCircleIcon, DownloadIcon, SlidersHorizontalIcon, TrendUpIcon, WarningTriangleIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import type { SignalSnapshot, ViewName } from "../types";
import type { RankedPublishedSignal } from "../domain";

type SignalBotTab = "active-signals" | "signal-history" | "performance" | "settings";
type SignalFilter = "all" | "buy" | "sell" | "btc" | "eth" | "alt" | "high";

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const [activeFilter, setActiveFilter] = useState<SignalFilter>("all");
  const feedReadModel = useSignalsBotsReadModel();
  const signals = feedReadModel.signalMemory;

  const readModel = useMemo(() => {
    const openSignals = signals.filter((signal) => signal.outcome_status === "pending");
    const closedSignals = signals.filter((signal) => signal.outcome_status !== "pending");
    const activeCards = feedReadModel.prioritySignals.slice(0, 12).map((signal) => {
      const snapshot = findSnapshotForSignal(signal.context.symbol, signal.context.timeframe, signals);
      return {
        signal,
        snapshot,
        entry: Number(snapshot?.entry_price || snapshot?.support || 0),
        target: Number(snapshot?.tp_price || snapshot?.tp2_price || snapshot?.resistance || 0),
        stopLoss: Number(snapshot?.sl_price || 0),
      };
    });
    const filteredCards = activeCards.filter((card) => matchesFilter(card.signal, activeFilter));
    const closedHistory = closedSignals
      .slice()
      .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())
      .slice(0, 12);
    return {
      priority: feedReadModel.prioritySignals,
      highConfidence: feedReadModel.highConfidenceSignals,
      watchlistFirst: feedReadModel.watchlistFirstSignals,
      botApproved: feedReadModel.signalBotApprovedSignals,
      openSignals,
      closedSignals,
      filteredCards,
      closedHistory,
    };
  }, [activeFilter, feedReadModel, signals]);

  return (
    <div id="signalBotView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-stats-grid template-signal-stats-grid">
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

        <SectionCard
          className="template-panel template-signal-panel"
        >
          <div className="template-signal-panel-head">
            <ModuleTabs
              items={[
                { key: "active-signals", label: "Active Signals" },
                { key: "signal-history", label: "Signal History" },
                { key: "performance", label: "Performance" },
                { key: "settings", label: "Bot Settings" },
              ]}
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as SignalBotTab)}
            />

            <div className="template-toolbar">
              <button type="button" className="premium-action-button is-ghost template-toolbar-button">
                <DownloadIcon />
                <span>Export</span>
              </button>
              <button type="button" className="premium-action-button is-ghost template-toolbar-button">
                <SlidersHorizontalIcon />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {activeTab === "active-signals" ? (
            <div>
              <div className="template-chip-row template-signal-filter-row">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`template-chip ${activeFilter === chip.key ? "is-active" : ""}`}
                    onClick={() => setActiveFilter(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="template-card-grid template-signal-card-grid">
                {readModel.filteredCards.slice(0, 6).map(({ signal, snapshot, entry, target, stopLoss }) => (
                  <article
                    key={signal.id}
                    className={`template-signal-card template-signal-card-premium ${signal.context.direction === "BUY" ? "is-buy" : signal.context.direction === "SELL" ? "is-sell" : ""}`}
                  >
                    <div className="template-signal-card-head">
                      <div className="template-signal-identity">
                        <div className={`template-signal-asset-badge ${getAssetAccentClass(signal.context.symbol)}`}>
                          {getAssetGlyph(signal.context.symbol)}
                        </div>
                        <div>
                          <h3>{signal.context.symbol}</h3>
                          <p>{getCardVenueLabel(signal, snapshot)}</p>
                        </div>
                      </div>
                      <span className={`template-signal-badge ${signal.context.direction === "SELL" ? "is-sell" : "is-buy"}`}>
                        {signal.context.direction}
                      </span>
                    </div>

                    <div className="template-signal-levels">
                      <div>
                        <span>Entry</span>
                        <strong>{formatUsd(entry)}</strong>
                      </div>
                      <div>
                        <span>Target</span>
                        <strong className="is-positive">{formatUsd(target)}</strong>
                      </div>
                      <div>
                        <span>Stop Loss</span>
                        <strong className="is-negative">{formatUsd(stopLoss)}</strong>
                      </div>
                    </div>

                    <div className="template-signal-confidence">
                      <div className="template-signal-confidence-row">
                        <div className="template-signal-confidence-label">
                          <span className={`template-signal-dot ${getConfidenceToneClass(signal)}`} />
                          <span>AI Confidence</span>
                        </div>
                        <strong className={getConfidenceTextClass(signal)}>
                          {Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%
                        </strong>
                      </div>
                      <div className="template-progress-track template-signal-progress-track">
                        <div
                          className={`template-progress-fill ${getConfidenceFillClass(signal)}`}
                          style={{ width: `${Math.min(signal.ranking.compositeScore, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="template-signal-foot template-signal-card-foot">
                      <span>{formatRelative(signal.context.observedAt)}</span>
                      <div className="template-signal-card-actions">
                        <button type="button" className="template-signal-icon-button" aria-label={`View ${signal.context.symbol}`}>
                          <SignalViewIcon />
                        </button>
                        <button type="button" className="template-signal-icon-button" aria-label={`Execute ${signal.context.symbol}`}>
                          <SignalPlayIcon />
                        </button>
                        <button type="button" className="template-signal-icon-button" aria-label={`Dismiss ${signal.context.symbol}`}>
                          <SignalCloseIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {!readModel.filteredCards.length ? (
                <div className="template-signal-empty">
                  <strong>No signals match this filter right now.</strong>
                  <span>The shared ranked feed is live, but this subset is currently empty.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "signal-history" ? (
            <div className="template-table-shell">
              <table className="template-table">
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
                      <td className={Number(signal.outcome_pnl || 0) >= 0 ? "is-positive" : "is-negative"}>
                        {formatUsd(Number(signal.outcome_pnl || 0))}
                      </td>
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
            <div className="template-performance-grid">
              <SectionCard title="Performance Summary" subtitle="The shortest explanation of how the bot is doing." className="template-panel">
                <div className="template-mini-grid">
                  <MetricTile label="Total Trades" value={String(readModel.closedSignals.length)} note="Completed signal outcomes tracked in memory." />
                  <MetricTile label="Winning Trades" value={String(readModel.closedSignals.filter((signal) => signal.outcome_status === "win").length)} note="Closed signals that finished positive." />
                  <MetricTile label="Losing Trades" value={String(readModel.closedSignals.filter((signal) => signal.outcome_status === "loss").length)} note="Closed signals that finished negative." />
                  <MetricTile label="Avg. Profit / Trade" value={formatPct(calculateAveragePnl(readModel.closedSignals))} note="Average realized result per closed signal." />
                </div>
              </SectionCard>

              <SectionCard title="What Is Working" subtitle="Simple takeaways the user can read quickly." className="template-panel">
                <div className="template-insights-list">
                  <article className="template-insight-card positive">
                    <div>
                      <strong>Watchlist signals are leading</strong>
                      <p>{String(readModel.watchlistFirst.length)} current ranked ideas come from the active watchlist, which keeps the page focused on familiar markets first.</p>
                    </div>
                  </article>
                  <article className="template-insight-card neutral">
                    <div>
                      <strong>High-confidence set stays compact</strong>
                      <p>{String(readModel.highConfidence.length)} signals currently qualify for the strongest subset, which keeps noise low and clarity high.</p>
                    </div>
                  </article>
                  <article className="template-insight-card info">
                    <div>
                      <strong>Bot-ready signals remain curated</strong>
                      <p>{String(readModel.botApproved.length)} signals already fit the current bot policy, so the page only surfaces what is closer to action.</p>
                    </div>
                  </article>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="template-form-grid">
              <SettingsCard title="Bot Status" value="Active" note="Signal Bot is actively scanning and ranking opportunities for the user." />
              <SettingsCard title="Minimum Confidence" value={`${Math.min(calculateMinimumConfidence(readModel.highConfidence), 100).toFixed(0)}%`} note="Only clearer opportunities are promoted into the strongest subset." />
              <SettingsCard title="Notifications" value="Enabled" note="New high-confidence ideas can stay visible without overwhelming the page." />
              <SettingsCard title="Trading Pairs" value={String(new Set(readModel.priority.map((signal) => signal.context.symbol)).size)} note="The current mix of pairs stays curated from watchlist and discovery." />
              <div className="template-settings-cta">
                <button type="button" className="premium-action-button is-primary" onClick={() => onNavigateView("control-bot-settings")}>
                  Open Full Bot Settings
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </section>
    </div>
  );
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

function MetricTile(props: { label: string; value: string; note: string }) {
  return (
    <div className="template-metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
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
    <div className="template-signal-stat-card">
      <div className="template-signal-stat-head">
        <div className={`template-signal-stat-icon ${props.tone}`}>{props.icon}</div>
        {props.status ? <span className={`template-signal-stat-status ${props.tone}`}>{props.status}</span> : <span className={`template-signal-stat-note ${props.tone}`}>{props.note}</span>}
      </div>
      <p className="template-signal-stat-label">{props.label}</p>
      <div className="template-signal-stat-value-row">
        <h3>{props.value}</h3>
        {!props.status ? <span>{props.note}</span> : null}
      </div>
      {props.label === "Win Rate" ? <div className="template-progress-track"><div className="template-progress-fill" style={{ width: props.value }} /></div> : null}
    </div>
  );
}

function SettingsCard(props: { title: string; value: string; note: string }) {
  return (
    <div className="template-settings-card">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
    </div>
  );
}

function findSnapshotForSignal(symbol: string, timeframe: string, signals: SignalSnapshot[]) {
  return signals.find((item) => item.coin.toUpperCase() === symbol.toUpperCase() && item.timeframe === timeframe);
}

function matchesFilter(signal: RankedPublishedSignal, filter: SignalFilter) {
  if (filter === "all") return true;
  if (filter === "buy") return signal.context.direction === "BUY";
  if (filter === "sell") return signal.context.direction === "SELL";
  if (filter === "btc") return signal.context.symbol.startsWith("BTC");
  if (filter === "eth") return signal.context.symbol.startsWith("ETH");
  if (filter === "alt") return !signal.context.symbol.startsWith("BTC") && !signal.context.symbol.startsWith("ETH");
  return signal.ranking.tier === "high-confidence";
}

function getVenueLabel(snapshot?: SignalSnapshot) {
  const mode = String(snapshot?.execution_mode || "").toLowerCase();
  if (mode.includes("real")) return "Binance Live";
  if (mode.includes("demo")) return "Binance Demo";
  return "Binance Spot";
}

function getCardVenueLabel(signal: RankedPublishedSignal, snapshot?: SignalSnapshot) {
  const venue = getVenueLabel(snapshot);
  if (venue !== "Binance Spot") return venue;
  return signal.context.direction === "SELL" ? "Binance Futures" : "Binance Spot";
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

function getAssetGlyph(symbol: string) {
  if (symbol.startsWith("BTC")) return "B";
  if (symbol.startsWith("ETH")) return "E";
  if (symbol.startsWith("SOL")) return "S";
  if (symbol.startsWith("BNB")) return "B";
  if (symbol.startsWith("XRP")) return "X";
  if (symbol.startsWith("ADA")) return "A";
  return symbol.slice(0, 1);
}

function getConfidenceToneClass(signal: RankedPublishedSignal) {
  const score = Math.min(signal.ranking.compositeScore, 100);
  if (score >= 85) return "is-high";
  if (score >= 70) return "is-mid";
  return "is-low";
}

function getConfidenceTextClass(signal: RankedPublishedSignal) {
  const score = Math.min(signal.ranking.compositeScore, 100);
  if (score >= 85) return "template-confidence-high";
  if (score >= 70) return "template-confidence-mid";
  return "template-confidence-low";
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

function formatDirection(signal: SignalSnapshot) {
  const direction = String(signal.signal_payload?.context?.direction || signal.trend || "").toLowerCase();
  return direction.includes("sell") || direction.includes("bear") ? "SELL" : "BUY";
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
