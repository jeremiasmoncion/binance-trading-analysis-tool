import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useMemorySystemSelector } from "../data-platform/selectors";
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
import type { ViewName } from "../types";

type SignalBotTab = "active-signals" | "signal-history" | "performance" | "settings";

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const systemData = useMemorySystemSelector();
  const signals = systemData.signalMemory;
  const watchlist = systemData.watchlists.find((item) => item.name === systemData.activeWatchlistName)?.coins || [];

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];
    const publishedFeed = createPublishedSignalFeedBundleFromMemory(signals, { watchlistSymbols: watchlist }).all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const watchlistFirst = selectWatchlistFirstRankedSignals(rankedFeed);
    const priority = selectPriorityRankedSignals(rankedFeed);
    const highConfidence = selectHighConfidenceRankedSignals(rankedFeed);
    const botFeed = createBotConsumableFeed(signalBot, rankedSignals, rankedFeed.generatedAt);
    const botApproved = botFeed.items.filter((item) => item.acceptedByPolicy);

    return {
      signalBot,
      watchlistFirst,
      priority,
      highConfidence,
      botApproved,
      openSignals: signals.filter((signal) => signal.outcome_status === "pending"),
      closedSignals: signals.filter((signal) => signal.outcome_status !== "pending"),
    };
  }, [signals, watchlist]);

  return (
    <div id="signalBotView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">AI Bot</span>
            <h1 className="template-page-title">Signal Bot</h1>
            <p className="template-page-subtitle">
              Product-facing signal workflow with the exact template tab language, but translated into CRYPE's shared
              style system and data seams.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary" onClick={() => onNavigateView("control-bot-settings")}>
              Bot Settings
            </button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Active Signals" value={String(readModel.priority.length)} sub="Signals promoted into the main signal feed" accentClass="accent-green" />
          <StatCard label="Win Rate" value={`${calculateWinRate(readModel.closedSignals).toFixed(1)}%`} sub="Closed signal outcomes from signal memory" accentClass="accent-blue" />
          <StatCard label="Total Profit (30d)" value={formatUsd(sumPnl(readModel.closedSignals))} sub="Closed signal performance for the period" accentClass="accent-emerald" />
          <StatCard label="Pending Signals" value={String(readModel.openSignals.length)} sub="Signals still waiting for resolution" accentClass="accent-amber" />
        </div>

        <SectionCard className="template-panel" actions={(
          <div className="template-toolbar">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-ghost">Filters</button>
          </div>
        )}>
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
            <>
              <div className="template-chip-row">
                <button type="button" className="template-chip is-active">All Signals</button>
                <button type="button" className="template-chip">Buy Only</button>
                <button type="button" className="template-chip">Sell Only</button>
                <button type="button" className="template-chip">BTC Pairs</button>
                <button type="button" className="template-chip">High Confidence</button>
              </div>
              <div className="template-card-grid">
                {readModel.priority.slice(0, 9).map((signal) => (
                  <article key={signal.id} className={`template-signal-card ${signal.context.direction === "BUY" ? "is-buy" : signal.context.direction === "SELL" ? "is-sell" : ""}`}>
                    <div className="template-signal-card-head">
                      <div>
                        <h3>{signal.context.symbol}</h3>
                        <p>{signal.context.strategyId} • {signal.context.timeframe}</p>
                      </div>
                      <span className="template-signal-badge">{signal.context.direction}</span>
                    </div>
                    <div className="template-signal-metrics">
                      <div>
                        <span>AI Confidence</span>
                        <strong>{Math.min(signal.ranking.compositeScore, 100).toFixed(0)}%</strong>
                      </div>
                      <div>
                        <span>Feed Tier</span>
                        <strong>{signal.ranking.tier}</strong>
                      </div>
                      <div>
                        <span>Lane</span>
                        <strong>{signal.ranking.lane === "watchlist-first" ? "Watchlist" : "Discovery"}</strong>
                      </div>
                    </div>
                    <div className="template-progress-track">
                      <div className="template-progress-fill" style={{ width: `${Math.min(signal.ranking.compositeScore, 100)}%` }} />
                    </div>
                    <p className="template-signal-summary">{signal.ranking.summary}</p>
                    <div className="template-signal-foot">
                      <span>{signal.ranking.primaryReason}</span>
                      <span>{signal.context.observedAt ? formatRelative(signal.context.observedAt) : "Now"}</span>
                    </div>
                    <div className="template-button-row">
                      <button type="button" className="premium-action-button is-ghost">View Details</button>
                      <button type="button" className="premium-action-button">Execute</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "signal-history" ? (
            <div className="template-table-shell">
              <table className="template-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Timeframe</th>
                    <th>Setup</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {readModel.closedSignals.slice(0, 10).map((signal) => (
                    <tr key={signal.id}>
                      <td>{signal.coin}</td>
                      <td>{signal.timeframe}</td>
                      <td>{signal.setup_type || signal.signal_label}</td>
                      <td>{Number(signal.signal_score || 0).toFixed(0)}</td>
                      <td>{formatSignalStatus(signal.outcome_status)}</td>
                      <td className={Number(signal.outcome_pnl || 0) >= 0 ? "is-positive" : "is-negative"}>
                        {formatUsd(Number(signal.outcome_pnl || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "performance" ? (
            <div className="template-mini-grid">
              <MetricTile label="High Confidence" value={String(readModel.highConfidence.length)} note="Signals promoted into the tighter confidence subset." />
              <MetricTile label="Watchlist First" value={String(readModel.watchlistFirst.length)} note="Signals prioritized from the current watchlist." />
              <MetricTile label="Bot Approved" value={String(readModel.botApproved.length)} note="Signals already consumable by the active bot policy." />
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="template-form-grid">
              <SettingsCard title="Execution Environment" value={readModel.signalBot.executionEnvironment.toUpperCase()} note="Paper, demo or real depending on bot policy." />
              <SettingsCard title="Automation Mode" value={readModel.signalBot.automationMode.toUpperCase()} note="Observe, assist or auto depending on current control." />
              <SettingsCard title="Universe Policy" value={readModel.signalBot.universePolicy.kind} note="How the bot picks between watchlist-first and wider discovery." />
              <SettingsCard title="Policy Match" value={String(readModel.botApproved.length)} note="Signals already approved by current bot policy filters." />
            </div>
          ) : null}
        </SectionCard>
      </section>
    </div>
  );
}

function MetricTile(props: { label: string; value: string; note: string }) {
  return (
    <div className="template-metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
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

function sumPnl(signals: Array<{ outcome_pnl: number }>) {
  return signals.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
}

function calculateWinRate(signals: Array<{ outcome_status: string }>) {
  const wins = signals.filter((signal) => signal.outcome_status === "win").length;
  return signals.length ? (wins / signals.length) * 100 : 0;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignalStatus(status: string) {
  if (status === "win") return "Closed Win";
  if (status === "loss") return "Closed Loss";
  if (status === "invalidated") return "Invalidated";
  return "Closed";
}

function formatRelative(value: string) {
  const date = new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor((Date.now() - date) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours} h ago`;
}
