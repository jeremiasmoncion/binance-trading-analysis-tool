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
  selectBots,
} from "../domain";

type BotSettingsTab = "all-bots" | "general-settings" | "risk-management" | "notifications" | "api-connections";

export function BotSettingsView() {
  const [activeTab, setActiveTab] = useState<BotSettingsTab>("all-bots");
  const systemData = useMemorySystemSelector();
  const watchlist = systemData.watchlists.find((item) => item.name === systemData.activeWatchlistName)?.coins || [];

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const bots = selectBots(registry.state);
    const rankedFeed = rankPublishedFeed(createPublishedSignalFeedBundleFromMemory(systemData.signalMemory, { watchlistSymbols: watchlist }).all);

    return bots.map((bot) => {
      const feed = createBotConsumableFeed(bot, rankedFeed.items, rankedFeed.generatedAt);
      const accepted = feed.items.filter((signal) => signal.acceptedByPolicy).length;
      return {
        ...bot,
        accepted,
        blocked: feed.items.length - accepted,
      };
    });
  }, [systemData.signalMemory, watchlist]);

  return (
    <div id="botSettingsView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">Control Panel</span>
            <h1 className="template-page-title">Bot Settings</h1>
            <p className="template-page-subtitle">
              Configure and manage trading bots, strategies and automation rules with the literal tab taxonomy and block
              order defined by the template.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary">Create New Bot</button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Active Bots" value={String(readModel.filter((bot) => bot.status === "active").length)} sub="Live bots in current registry" accentClass="accent-green" />
          <StatCard label="Total Trades (24h)" value={String(readModel.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0))} sub="Closed outcomes attributed to listed bots" accentClass="accent-blue" />
          <StatCard label="Total Profit (24h)" value={formatUsd(readModel.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0))} sub="Aggregated bot performance" accentClass="accent-emerald" />
          <StatCard label="Win Rate" value={`${averageWinRate(readModel).toFixed(1)}%`} sub="Average across visible bot cards" accentClass="accent-amber" />
        </div>

        <SectionCard className="template-panel">
          <ModuleTabs
            items={[
              { key: "all-bots", label: "All Bots" },
              { key: "general-settings", label: "General Settings" },
              { key: "risk-management", label: "Risk Management" },
              { key: "notifications", label: "Notifications" },
              { key: "api-connections", label: "API Connections" },
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as BotSettingsTab)}
          />

          {activeTab === "all-bots" ? (
            <>
              <div className="template-toolbar template-toolbar-inline">
                <div className="template-search-shell">
                  <input type="text" value="" readOnly aria-label="Search bots" className="template-search-input" placeholder="Search bots by name, pair, or strategy..." />
                </div>
                <div className="template-chip-row">
                  <button type="button" className="template-chip is-active">All</button>
                  <button type="button" className="template-chip">Running</button>
                  <button type="button" className="template-chip">Paused</button>
                  <button type="button" className="template-chip">Stopped</button>
                </div>
                <div className="template-view-toggle">
                  <button type="button" className="template-view-button is-active">Grid</button>
                  <button type="button" className="template-view-button">Table</button>
                </div>
              </div>

              <div className="template-card-grid">
                {readModel.map((bot) => (
                  <article key={bot.id} className="template-bot-card">
                    <div className="template-bot-card-head">
                      <div>
                        <h3>{bot.name}</h3>
                        <p>{bot.slug} • {bot.executionEnvironment.toUpperCase()}</p>
                      </div>
                      <span className={`template-status-pill ${bot.status === "active" ? "is-live" : ""}`}>
                        {bot.status === "active" ? "Running" : bot.status}
                      </span>
                    </div>
                    <div className="template-bot-grid">
                      <div>
                        <span>Strategy</span>
                        <strong>{bot.strategyPolicy.preferredStrategyIds[0] || "Adaptive"}</strong>
                      </div>
                      <div>
                        <span>Trades</span>
                        <strong>{bot.localMemory.outcomeCount}</strong>
                      </div>
                      <div>
                        <span>Profit</span>
                        <strong>{formatUsd(bot.performance.realizedPnlUsd)}</strong>
                      </div>
                      <div>
                        <span>Win Rate</span>
                        <strong>{bot.performance.winRate.toFixed(0)}%</strong>
                      </div>
                    </div>
                    <div className="template-allocation-row">
                      <div className="template-allocation-bar">
                        <span style={{ width: `${Math.min((bot.capital.allocatedUsd / Math.max(bot.riskPolicy.maxPositionUsd * bot.riskPolicy.maxOpenPositions, 1)) * 100, 100)}%` }} />
                      </div>
                      <strong>{formatUsd(bot.capital.allocatedUsd)} / allocated</strong>
                    </div>
                    <div className="template-button-row">
                      <button type="button" className="premium-action-button is-ghost">{bot.status === "active" ? "Pause" : "Start"}</button>
                      <button type="button" className="premium-action-button">Settings</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "general-settings" ? (
            <div className="template-form-grid">
              <SettingsCard title="Default Trading Mode" value="Assist" note="Bots stay visible and user-approved before any real action." />
              <SettingsCard title="Base Universe" value="Watchlist + Discovery" note="Supports watchlist-first and market discovery lanes." />
              <SettingsCard title="Style Coverage" value="Scalping • Swing • Long" note="Matches the domain styles already supported by the model." />
              <SettingsCard title="AI Unrestricted Lab" value="Isolated" note="Supported as a separate experimental profile, never as a global default." />
            </div>
          ) : null}

          {activeTab === "risk-management" ? (
            <div className="template-form-grid">
              <SettingsCard title="Max Position Size" value="$250" note="Current default per bot position." />
              <SettingsCard title="Max Open Positions" value="3" note="Prevents uncontrolled overlap across symbols." />
              <SettingsCard title="Daily Loss Limit" value="2%" note="Risk cap before the bot slows down or stops." />
              <SettingsCard title="Symbol Exposure" value="35%" note="Keeps a single market from dominating bot capital." />
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="template-form-grid">
              <SettingsCard title="Execution Alerts" value="Enabled" note="Important fills and failures remain visible for the operator." />
              <SettingsCard title="Policy Warnings" value="Enabled" note="Bot-policy mismatches remain surfaced in the control layer." />
              <SettingsCard title="Daily Summary" value="Enabled" note="Compact recap rather than raw technical telemetry." />
              <SettingsCard title="Escalations" value="Manual Review" note="High-risk events still require a human-visible checkpoint." />
            </div>
          ) : null}

          {activeTab === "api-connections" ? (
            <div className="template-form-grid">
              <SettingsCard title="Primary Exchange" value="Binance" note="Current connected trading venue for live operations." />
              <SettingsCard title="Paper Environment" value="Available" note="Keeps bot testing separate from real balances." />
              <SettingsCard title="Demo Routing" value="Enabled" note="Intermediate execution mode between paper and real." />
              <SettingsCard title="Real Orders" value="Approval Required" note="No change to runtime governance in this round." />
            </div>
          ) : null}
        </SectionCard>
      </section>
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

function averageWinRate(bots: Array<{ performance: { winRate: number } }>) {
  return bots.length ? bots.reduce((sum, bot) => sum + bot.performance.winRate, 0) / bots.length : 0;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
