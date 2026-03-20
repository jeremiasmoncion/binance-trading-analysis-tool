import { useMemo, useState, type ReactNode } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { BoltIcon, CheckCircleIcon, InfoCircleIcon, TrendUpIcon, WarningTriangleIcon } from "../components/Icons";
import { SectionCard } from "../components/ui/SectionCard";
import { useSignalsBotsFeedSelector } from "../data-platform/selectors";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectHighConfidenceRankedSignals,
  selectPriorityRankedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
} from "../domain";
import type { SignalSnapshot, ViewName } from "../types";

type SignalBotTab = "active-signals" | "signal-history" | "performance" | "settings";
type SignalFilter = "all" | "buy" | "sell" | "btc" | "eth" | "alt" | "high";

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const [activeFilter, setActiveFilter] = useState<SignalFilter>("all");
  const feedData = useSignalsBotsFeedSelector();
  const signals = feedData.signalMemory;
  const watchlist = feedData.activeWatchlistCoins;

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];
    const publishedFeed = createPublishedSignalFeedBundleFromMemory(signals, { watchlistSymbols: watchlist }).all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const priority = selectPriorityRankedSignals(rankedFeed);
    const highConfidence = selectHighConfidenceRankedSignals(rankedFeed);
    const watchlistFirst = selectWatchlistFirstRankedSignals(rankedFeed);
    const botFeed = createBotConsumableFeed(signalBot, rankedSignals, rankedFeed.generatedAt);
    const botApproved = botFeed.items.filter((item) => item.acceptedByPolicy);
    const openSignals = signals.filter((signal) => signal.outcome_status === "pending");
    const closedSignals = signals.filter((signal) => signal.outcome_status !== "pending");
    const activeCards = priority.slice(0, 12).map((signal) => {
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
    const topPerformers = closedSignals
      .filter((signal) => Number(signal.outcome_pnl || 0) > 0)
      .sort((left, right) => Number(right.outcome_pnl || 0) - Number(left.outcome_pnl || 0))
      .slice(0, 5);

    const marketSentiment = buildMarketSentiment(priority, watchlistFirst);
    const aiInsights = buildAiInsights(priority, highConfidence, botApproved);

    return {
      signalBot,
      priority,
      highConfidence,
      watchlistFirst,
      botApproved,
      openSignals,
      closedSignals,
      filteredCards,
      closedHistory,
      topPerformers,
      marketSentiment,
      aiInsights,
    };
  }, [signals, watchlist, activeFilter]);

  return (
    <div id="signalBotView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">AI Bot</span>
            <h1 className="template-page-title">Signal Bot</h1>
            <p className="template-page-subtitle">
              Your signal workspace for active opportunities, signal history, performance and simple bot controls,
              arranged with the same flow and naming used by the template.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary" onClick={() => onNavigateView("control-bot-settings")}>
              Bot Settings
            </button>
          </div>
        </div>

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
          className="template-panel"
          actions={(
            <div className="template-toolbar">
              <button type="button" className="premium-action-button is-ghost">Export</button>
              <button type="button" className="premium-action-button is-ghost">Filters</button>
            </div>
          )}
        >
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

          {activeTab === "active-signals" ? (
            <div className="template-signal-page-grid">
              <div>
                <div className="template-chip-row">
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
                  {readModel.filteredCards.map(({ signal, snapshot, entry, target, stopLoss }) => (
                    <article
                      key={signal.id}
                      className={`template-signal-card template-signal-card-premium ${signal.context.direction === "BUY" ? "is-buy" : signal.context.direction === "SELL" ? "is-sell" : ""}`}
                    >
                      <div className="template-signal-card-head">
                        <div>
                          <h3>{signal.context.symbol}</h3>
                          <p>{getVenueLabel(snapshot)} • {signal.context.timeframe}</p>
                        </div>
                        <span className="template-signal-badge">{signal.context.direction}</span>
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
                          <div>
                            <span>AI Confidence</span>
                            <strong>{Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%</strong>
                          </div>
                          <div className="template-signal-confidence-meta">
                            <span>{signal.ranking.tier}</span>
                            <span>{signal.ranking.lane === "watchlist-first" ? "Watchlist" : "Discovery"}</span>
                          </div>
                        </div>
                        <div className="template-progress-track">
                          <div className="template-progress-fill" style={{ width: `${Math.min(signal.ranking.compositeScore, 100)}%` }} />
                        </div>
                      </div>

                      <p className="template-signal-summary">{buildUserFacingSummary(signal, snapshot)}</p>

                      <div className="template-signal-foot">
                        <span>{signal.ranking.primaryReason}</span>
                        <span>{formatRelative(signal.context.observedAt)}</span>
                      </div>

                      <div className="template-button-row">
                        <button type="button" className="premium-action-button is-ghost">View Details</button>
                        <button type="button" className="premium-action-button">Execute</button>
                        <button type="button" className="premium-action-button is-ghost">Dismiss</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="template-side-stack">
                <SectionCard title="Market Sentiment" subtitle="Live read of the strongest markets in the current signal feed." className="template-panel">
                  <div className="template-sentiment-list">
                    {readModel.marketSentiment.map((item) => (
                      <div key={item.label} className="template-sentiment-row">
                        <span>{item.label}</span>
                        <div className="template-sentiment-meter">
                          <div className="template-sentiment-track">
                            <div className={`template-sentiment-fill ${item.tone}`} style={{ width: `${item.score}%` }} />
                          </div>
                          <strong className={item.tone}>{item.score}%</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="AI Insights" subtitle="Short explanations translated for the user, not raw diagnostics." className="template-panel">
                  <div className="template-insights-list">
                    {readModel.aiInsights.map((insight) => (
                      <article key={insight.title} className={`template-insight-card ${insight.tone}`}>
                        <div className="template-insight-icon">
                          {insight.tone === "positive" ? <TrendUpIcon /> : insight.tone === "info" ? <InfoCircleIcon /> : <WarningTriangleIcon />}
                        </div>
                        <div>
                          <strong>{insight.title}</strong>
                          <p>{insight.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Top Signal Performers" subtitle="Best closed performers ranked by realized outcome." className="template-panel">
                  <div className="template-performer-list">
                    {readModel.topPerformers.map((signal, index) => (
                      <div key={signal.id} className="template-performer-row">
                        <div className="template-performer-rank">{index + 1}</div>
                        <div className="template-performer-copy">
                          <strong>{signal.coin}</strong>
                          <span>{signal.timeframe} • {signal.setup_type || signal.signal_label}</span>
                        </div>
                        <strong className="is-positive">{formatUsd(Number(signal.outcome_pnl || 0))}</strong>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
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

function matchesFilter(signal: ReturnType<typeof rankPublishedFeed>["items"][number], filter: SignalFilter) {
  if (filter === "all") return true;
  if (filter === "buy") return signal.context.direction === "BUY";
  if (filter === "sell") return signal.context.direction === "SELL";
  if (filter === "btc") return signal.context.symbol.startsWith("BTC");
  if (filter === "eth") return signal.context.symbol.startsWith("ETH");
  if (filter === "alt") return !signal.context.symbol.startsWith("BTC") && !signal.context.symbol.startsWith("ETH");
  return signal.ranking.tier === "high-confidence";
}

function buildMarketSentiment(
  priority: ReturnType<typeof rankPublishedFeed>["items"],
  watchlistFirst: ReturnType<typeof rankPublishedFeed>["items"],
) {
  const candidates = [...watchlistFirst, ...priority]
    .reduce<Array<{ label: string; score: number; tone: "positive" | "warning" | "negative" }>>((acc, signal) => {
      if (acc.some((item) => item.label === signal.context.symbol)) return acc;
      const score = Math.max(35, Math.min(95, Math.round(signal.ranking.compositeScore)));
      acc.push({
        label: signal.context.symbol,
        score,
        tone: score >= 70 ? "positive" : score >= 55 ? "warning" : "negative",
      });
      return acc;
    }, []);

  return candidates.slice(0, 5);
}

function buildAiInsights(
  priority: ReturnType<typeof rankPublishedFeed>["items"],
  highConfidence: ReturnType<typeof rankPublishedFeed>["items"],
  botApproved: Array<{ context: { symbol: string } }>,
) {
  return [
    {
      title: highConfidence[0]
        ? `${highConfidence[0].context.symbol} is leading the high-confidence set`
        : "High-confidence ideas are limited",
      body: highConfidence[0]
        ? "The strongest opportunity today has enough clarity to stay near the top of the feed."
        : "The bot is being selective right now to avoid showing noisy ideas as strong setups.",
      tone: "positive" as const,
    },
    {
      title: botApproved.length
        ? `${botApproved.length} signals are already bot-ready`
        : "Few signals fit the current bot rules",
      body: botApproved.length
        ? "That means the page is surfacing opportunities that are already closer to action, not just raw detections."
        : "The current market is producing fewer clean matches, which helps keep the page disciplined.",
      tone: "info" as const,
    },
    {
      title: priority.at(-1)
        ? `${priority.at(-1)?.context.symbol} needs more confirmation`
        : "Discovery is staying quiet",
      body: priority.at(-1)
        ? "Some ranked ideas are still visible, but remain below the strongest subset because their setup is less complete."
        : "The page is currently favoring only the clearest setups.",
      tone: "neutral" as const,
    },
  ];
}

function buildUserFacingSummary(
  signal: ReturnType<typeof rankPublishedFeed>["items"][number],
  snapshot?: SignalSnapshot,
) {
  const setup = snapshot?.setup_type || snapshot?.signal_label || signal.context.strategyId;
  return `${setup} on ${signal.context.symbol} stays visible because the setup is ${signal.ranking.primaryReason.toLowerCase()}.`;
}

function getVenueLabel(snapshot?: SignalSnapshot) {
  const mode = String(snapshot?.execution_mode || "").toLowerCase();
  if (mode.includes("real")) return "Binance Live";
  if (mode.includes("demo")) return "Binance Demo";
  return "Binance Spot";
}

function calculateMinimumConfidence(highConfidence: ReturnType<typeof rankPublishedFeed>["items"]) {
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
