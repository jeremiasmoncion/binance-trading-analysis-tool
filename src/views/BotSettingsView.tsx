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
              Configuración y administración de bots siguiendo la jerarquía y composición del template, pero con la
              implementación visual ordenada de CRYPE.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary">Create New Bot</button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Active Bots" value={String(readModel.filter((bot) => bot.status === "active").length)} sub="Bots vivos dentro del registry local" accentClass="accent-green" />
          <StatCard label="Total Trades (24h)" value={String(readModel.reduce((sum, bot) => sum + bot.localMemory.outcomeCount, 0))} sub="Actividad traducida a una lectura simple" accentClass="accent-blue" />
          <StatCard label="Total Profit (24h)" value={formatUsd(readModel.reduce((sum, bot) => sum + bot.performance.realizedPnlUsd, 0))} sub="Rendimiento agregado del conjunto" accentClass="accent-emerald" />
          <StatCard label="Win Rate" value={`${averageWinRate(readModel).toFixed(1)}%`} sub="Promedio visual de bots listados" accentClass="accent-amber" />
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
              </div>
              <div className="template-card-grid">
                {readModel.map((bot) => (
                  <article key={bot.id} className="template-bot-card">
                    <div className="template-bot-card-head">
                      <div>
                        <h3>{bot.name}</h3>
                        <p>{bot.slug} · {bot.executionEnvironment.toUpperCase()}</p>
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
                        <span>Signals</span>
                        <strong>{bot.accepted}</strong>
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
                      <strong>{formatUsd(bot.capital.allocatedUsd)} allocated</strong>
                    </div>
                    <div className="template-button-row">
                      <button type="button" className="premium-action-button is-ghost">Pause</button>
                      <button type="button" className="premium-action-button">Configure</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {activeTab !== "all-bots" ? (
            <div className="template-mini-grid">
              <MetricTile label={tabTitle(activeTab)} value="Prepared" note="La arquitectura visible ya sigue el template; la siguiente ronda llenará este panel con contenido funcional." />
              <MetricTile label="Registry seam" value="Local" note="Sin persistencia global todavía." />
              <MetricTile label="UX state" value="Template-first" note="La configuración ya vive en el flujo correcto, no en la UX heredada." />
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

function tabTitle(tab: BotSettingsTab) {
  if (tab === "general-settings") return "General Settings";
  if (tab === "risk-management") return "Risk Management";
  if (tab === "notifications") return "Notifications";
  return "API Connections";
}
