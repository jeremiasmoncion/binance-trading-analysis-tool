import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useExecutionLogsSelector } from "../data-platform/selectors";
import type { ExecutionOrderRecord } from "../types";

type ExecutionLogsTab = "all" | "trades" | "signals" | "errors" | "system";

export function ExecutionLogsView() {
  const [activeTab, setActiveTab] = useState<ExecutionLogsTab>("all");
  const executionData = useExecutionLogsSelector();

  const readModel = useMemo(() => {
    const orders = executionData.recentOrders;
    return {
      orders,
      successRate: calculateSuccessRate(orders),
      failed: orders.filter((order) => isFailedOrder(order)).length,
      totalVolume: orders.reduce((sum, order) => sum + Number(order.notional_usd || 0), 0),
    };
  }, [executionData.recentOrders]);

  const visibleLogs = readModel.orders.filter((order) => matchesTab(order, activeTab)).slice(0, 12);

  return (
    <div id="executionLogsView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">Control Panel</span>
            <h1 className="template-page-title">Execution Logs</h1>
            <p className="template-page-subtitle">
              Real-time monitoring of bot trades and system operations, translated into the same labels, columns and
              state names used by the template.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Refresh</button>
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary">Log Settings</button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Total Executions" value={String(readModel.orders.length)} sub="Recent execution log entries" accentClass="accent-blue" />
          <StatCard label="Success Rate" value={`${readModel.successRate.toFixed(1)}%`} sub="Successful and completed entries" accentClass="accent-green" />
          <StatCard label="Failed Trades" value={String(readModel.failed)} sub="Entries that need attention" accentClass="accent-amber" />
          <StatCard label="Total Volume" value={formatUsd(readModel.totalVolume)} sub="Recent notional volume" accentClass="accent-emerald" />
        </div>

        <SectionCard className="template-panel">
          <ModuleTabs
            items={[
              { key: "all", label: "All Logs" },
              { key: "trades", label: "Trades" },
              { key: "signals", label: "Signals" },
              { key: "errors", label: "Errors" },
              { key: "system", label: "System" },
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as ExecutionLogsTab)}
          />

          <div className="template-toolbar template-toolbar-inline">
            <div className="template-search-shell">
              <input type="text" value="" readOnly aria-label="Search logs" className="template-search-input" placeholder="Search by ID, pair, bot name, or message..." />
            </div>
            <div className="template-filter-row">
              <button type="button" className="template-chip is-active">All Bots</button>
              <button type="button" className="template-chip">All Status</button>
              <button type="button" className="template-chip">Today</button>
              <button type="button" className="template-chip">Clear</button>
            </div>
          </div>

          <div className="template-table-shell">
            <table className="template-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Log ID</th>
                  <th>Bot</th>
                  <th>Type</th>
                  <th>Pair</th>
                  <th>Side</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>P/L</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((order) => (
                  <tr key={order.id}>
                    <td>{formatTimestamp(order.created_at)}</td>
                    <td>#{order.id}</td>
                    <td>{inferBotLabel(order)}</td>
                    <td>{inferLogType(order)}</td>
                    <td>{order.coin}</td>
                    <td>{formatSide(order.side)}</td>
                    <td>{formatAmount(order.quantity)}</td>
                    <td>{formatUsd(Number(order.current_price || 0))}</td>
                    <td>{formatStatus(order)}</td>
                    <td className={Number(order.realized_pnl || 0) >= 0 ? "is-positive" : "is-negative"}>
                      {formatUsd(Number(order.realized_pnl || 0))}
                    </td>
                    <td>
                      <div className="template-table-actions">
                        <button type="button" className="template-inline-link">View</button>
                        <button type="button" className="template-inline-link">Copy</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function matchesTab(order: ExecutionOrderRecord, tab: ExecutionLogsTab) {
  if (tab === "all") return true;
  if (tab === "trades") return order.mode === "execute";
  if (tab === "signals") return order.mode !== "execute" && !isFailedOrder(order);
  if (tab === "errors") return isFailedOrder(order);
  return order.origin === "system" || order.origin === "runtime";
}

function isFailedOrder(order: ExecutionOrderRecord) {
  const status = String(order.lifecycle_status || order.status || "").toLowerCase();
  return status.includes("fail") || status.includes("error") || status.includes("reject");
}

function inferBotLabel(order: ExecutionOrderRecord) {
  if (String(order.strategy_name || "").toLowerCase().includes("signal")) return "Signal Bot";
  if (String(order.strategy_name || "").toLowerCase().includes("dca")) return "DCA Bot";
  if (String(order.strategy_name || "").toLowerCase().includes("arbitrage")) return "Arbitrage Bot";
  return order.strategy_name || "System";
}

function inferLogType(order: ExecutionOrderRecord) {
  if (isFailedOrder(order)) return "Error";
  if (order.mode === "execute") return "Trade";
  if (order.mode === "observe") return "Signal";
  return "System";
}

function formatSide(value?: string) {
  if (!value) return "-";
  return value.toUpperCase();
}

function formatStatus(order: ExecutionOrderRecord) {
  const status = String(order.lifecycle_status || order.status || "").toLowerCase();
  if (status.includes("fill") || status.includes("close") || status.includes("win")) return "Filled";
  if (status.includes("pending") || status.includes("open")) return "Pending";
  if (status.includes("fail") || status.includes("error") || status.includes("reject")) return "Failed";
  return "Success";
}

function calculateSuccessRate(orders: ExecutionOrderRecord[]) {
  if (!orders.length) return 0;
  const success = orders.filter((order) => !isFailedOrder(order)).length;
  return (success / orders.length) * 100;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatAmount(value?: number) {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

function formatTimestamp(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
