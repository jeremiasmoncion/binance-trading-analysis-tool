import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useControlPanelExecutionSelector } from "../data-platform/selectors";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import type { ViewName } from "../types";

type OverviewTab = "performance" | "recent-trades" | "analytics";

interface ControlOverviewViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function ControlOverviewView({ onNavigateView }: ControlOverviewViewProps) {
  const [activeTab, setActiveTab] = useState<OverviewTab>("performance");
  const executionData = useControlPanelExecutionSelector();
  const feedReadModel = useSignalsBotsReadModel();

  const readModel = useMemo(() => {
    const recentOrders = executionData.executionRecentOrders.length
      ? executionData.executionRecentOrders
      : executionData.dashboardRecentOrders;
    const closedOrders = recentOrders.filter((order) => typeof order.realized_pnl === "number");

    return {
      bots: feedReadModel.bots,
      priority: feedReadModel.prioritySignals,
      highConfidence: feedReadModel.highConfidenceSignals,
      recentOrders,
      closedOrders,
    };
  }, [executionData.dashboardRecentOrders, executionData.executionRecentOrders, feedReadModel.bots, feedReadModel.highConfidenceSignals, feedReadModel.prioritySignals]);

  return (
    <div id="controlOverviewView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">Control Panel</span>
            <h1 className="template-page-title">Overview</h1>
            <p className="template-page-subtitle">
              Dashboard central para revisar profit, bots activos, win rate y volumen, con la misma jerarquía visual
              que define el template para esta página.
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
          <StatCard label="Total Profit" value={formatUsd(sumClosedPnl(readModel.closedOrders))} sub="Closed performance from recent executions" accentClass="accent-green" />
          <StatCard label="Active Bots" value={`${readModel.bots.filter((bot) => bot.status === "active").length} / ${readModel.bots.length}`} sub="Running bots vs total listed bots" accentClass="accent-blue" />
          <StatCard label="Win Rate" value={`${calculateWinRate(readModel.closedOrders).toFixed(1)}%`} sub="Closed trades with positive outcome" accentClass="accent-amber" />
          <StatCard label="Trade Volume" value={formatUsd(sumNotional(readModel.recentOrders))} sub="Recent notional volume across logs" accentClass="accent-emerald" />
        </div>

        <div className="template-main-grid">
          <SectionCard className="template-panel">
            <div className="template-toolbar template-toolbar-between">
              <ModuleTabs
                items={[
                  { key: "performance", label: "Performance" },
                  { key: "recent-trades", label: "Recent Trades" },
                  { key: "analytics", label: "Analytics" },
                ]}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as OverviewTab)}
              />
              <div className="template-filter-row">
                <button type="button" className="template-chip is-active">Last 7 Days</button>
                <button type="button" className="template-chip">Last 30 Days</button>
              </div>
            </div>

            {activeTab === "performance" ? (
              <div className="template-analytics-grid">
                <div className="template-analytics-card">
                  <h3>Performance</h3>
                  <p>Priority feed, high-confidence subset and closed trade results translated into one readable block.</p>
                  <div className="template-mini-grid">
                    <MetricTile label="Priority Signals" value={String(readModel.priority.length)} note="Signals promoted into the main feed." />
                    <MetricTile label="High Confidence" value={String(readModel.highConfidence.length)} note="Smaller subset with stronger evidence." />
                    <MetricTile label="Closed Trades" value={String(readModel.closedOrders.length)} note="Closed outcomes available for review." />
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "recent-trades" ? (
              <div className="template-table-shell">
                <table className="template-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Bot</th>
                      <th>Pair</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readModel.recentOrders.slice(0, 8).map((order) => (
                      <tr key={order.id}>
                        <td>{formatTime(order.created_at)}</td>
                        <td>{order.strategy_name || "Signal Bot"}</td>
                        <td>{order.coin}</td>
                        <td>{order.side || order.mode}</td>
                        <td>{formatUsd(Number(order.current_price || 0))}</td>
                        <td className={Number(order.realized_pnl || 0) >= 0 ? "is-positive" : "is-negative"}>
                          {formatUsd(Number(order.realized_pnl || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {activeTab === "analytics" ? (
              <div className="template-analytics-grid">
                <div className="template-analytics-card">
                  <h3>Feed Analytics</h3>
                  <p>How many ranked opportunities survived the current pruning and made it into the product-facing surface.</p>
                  <div className="template-list-card">
                    <div className="template-list-row">
                      <div>
                        <strong>Published Feed</strong>
                        <span>Signals available after signal memory hydration</span>
                      </div>
                      <div>
                        <strong>{readModel.priority.length + readModel.highConfidence.length}</strong>
                        <span>visible items</span>
                      </div>
                    </div>
                    <div className="template-list-row">
                      <div>
                        <strong>High Confidence</strong>
                        <span>Signals with enough clarity for the spotlight subset</span>
                      </div>
                      <div>
                        <strong>{readModel.highConfidence.length}</strong>
                        <span>curated items</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Active Bots" subtitle="Running bot cards in the same secondary block used by the template" className="template-panel">
            <div className="template-status-grid template-status-grid-compact">
              {readModel.bots.map((bot) => (
                <article key={bot.id} className="template-status-card">
                  <div className="template-status-card-head">
                    <div>
                      <h3>{bot.name}</h3>
                      <p>{bot.executionEnvironment.toUpperCase()} • {bot.automationMode.toUpperCase()}</p>
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
                      <span>Trades</span>
                      <strong>{bot.localMemory.outcomeCount}</strong>
                    </div>
                    <div>
                      <span>Win Rate</span>
                      <strong>{bot.performance.winRate.toFixed(0)}%</strong>
                    </div>
                  </div>
                  <button type="button" className="template-inline-link" onClick={() => onNavigateView("control-bot-settings")}>
                    Details
                  </button>
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

function calculateWinRate(orders: Array<{ realized_pnl?: number }>) {
  const wins = orders.filter((order) => Number(order.realized_pnl || 0) > 0).length;
  return orders.length ? (wins / orders.length) * 100 : 0;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
