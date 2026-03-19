import { useMemo } from "react";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useDashboardSystemSelector, useMemorySystemSelector } from "../data-platform/selectors";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectHighConfidenceRankedSignals,
  selectPriorityRankedSignals,
  selectBots,
} from "../domain";
import type { ViewName } from "../types";

interface ControlOverviewViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function ControlOverviewView({ onNavigateView }: ControlOverviewViewProps) {
  const dashboardSystem = useDashboardSystemSelector();
  const memorySystem = useMemorySystemSelector();
  const watchlist = memorySystem.watchlists.find((item) => item.name === memorySystem.activeWatchlistName)?.coins || [];

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const bots = selectBots(registry.state);
    const rankedFeed = rankPublishedFeed(createPublishedSignalFeedBundleFromMemory(memorySystem.signalMemory, { watchlistSymbols: watchlist }).all);
    const priority = selectPriorityRankedSignals(rankedFeed);
    const highConfidence = selectHighConfidenceRankedSignals(rankedFeed);
    const recentOrders = dashboardSystem.execution?.recentOrders || dashboardSystem.dashboardSummary?.execution.recentOrders || [];
    const openOrders = recentOrders.filter((order) => order.status === "open" || order.status === "pending");

    return {
      bots,
      priority,
      highConfidence,
      recentOrders,
      openOrders,
    };
  }, [dashboardSystem.dashboardSummary?.execution.recentOrders, dashboardSystem.execution?.recentOrders, memorySystem.signalMemory, watchlist]);

  return (
    <div id="controlOverviewView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">Control Panel</span>
            <h1 className="template-page-title">Overview</h1>
            <p className="template-page-subtitle">
              Resumen ejecutivo del sistema de trading y bots, con foco en lo mínimo útil para operar sin exponer
              el detalle técnico crudo.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export Report</button>
            <button type="button" className="premium-action-button is-primary" onClick={() => onNavigateView("control-bot-settings")}>
              New Bot
            </button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Total Profit" value={formatUsd(sumClosedPnl(readModel.recentOrders))} sub="Resultado reciente visible del sistema" accentClass="accent-green" />
          <StatCard label="Active Bots" value={`${readModel.bots.filter((bot) => bot.status === "active").length} / ${readModel.bots.length}`} sub="Bots visibles en el control panel" accentClass="accent-blue" />
          <StatCard label="Win Rate" value={`${calculateOrderWinRate(readModel.recentOrders).toFixed(1)}%`} sub="Ordenes cerradas con resultado observable" accentClass="accent-amber" />
          <StatCard label="Trade Volume" value={formatUsd(sumNotional(readModel.recentOrders))} sub="Volumen reciente detectado" accentClass="accent-emerald" />
        </div>

        <div className="template-main-grid">
          <SectionCard title="Performance" subtitle="Vista resumida del frente operativo" className="template-panel">
            <div className="template-mini-grid">
              <MetricTile label="Priority feed" value={String(readModel.priority.length)} note="Señales que hoy sí vale la pena mirar." />
              <MetricTile label="High confidence" value={String(readModel.highConfidence.length)} note="Subset pequeño y defendible." />
              <MetricTile label="Open orders" value={String(readModel.openOrders.length)} note="Posiciones y órdenes todavía en seguimiento." />
            </div>
          </SectionCard>

          <SectionCard title="Active Bots" subtitle="Lista operativa corta alineada al template" className="template-panel">
            <div className="template-status-grid">
              {readModel.bots.map((bot) => (
                <article key={bot.id} className="template-status-card">
                  <div className="template-status-card-head">
                    <div>
                      <h3>{bot.name}</h3>
                      <p>{bot.executionEnvironment.toUpperCase()} · {bot.automationMode.toUpperCase()}</p>
                    </div>
                    <span className={`template-status-pill ${bot.status === "active" ? "is-live" : ""}`}>
                      {bot.status === "active" ? "Running" : bot.status}
                    </span>
                  </div>
                  <div className="template-status-card-metrics">
                    <div>
                      <span>P&L</span>
                      <strong>{formatUsd(bot.performance.realizedPnlUsd)}</strong>
                    </div>
                    <div>
                      <span>Signals</span>
                      <strong>{bot.localMemory.signalCount}</strong>
                    </div>
                    <div>
                      <span>Win Rate</span>
                      <strong>{bot.performance.winRate.toFixed(0)}%</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
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

function sumClosedPnl(orders: Array<{ realized_pnl?: number }>) {
  return orders.reduce((sum, order) => sum + Number(order.realized_pnl || 0), 0);
}

function sumNotional(orders: Array<{ notional_usd?: number }>) {
  return orders.reduce((sum, order) => sum + Number(order.notional_usd || 0), 0);
}

function calculateOrderWinRate(orders: Array<{ realized_pnl?: number }>) {
  const closed = orders.filter((order) => typeof order.realized_pnl === "number");
  const wins = closed.filter((order) => Number(order.realized_pnl || 0) > 0).length;
  return closed.length ? (wins / closed.length) * 100 : 0;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
