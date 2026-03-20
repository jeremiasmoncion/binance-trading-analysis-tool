import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import type { BotDecisionRecord } from "../domain";

type ExecutionLogsTab = "all" | "trades" | "signals" | "errors" | "system";
type ExecutionLogOrderEntry = {
  id: string;
  orderId: number;
  botId: string | null;
  botName: string | null;
  symbol: string;
  timeframe: string;
  source: string;
  mode: string;
  status: string;
  pnlUsd: number;
  notionalUsd: number;
  quantity: number;
  entryPrice: number | null;
  createdAt: string;
  updatedAt: string;
};
type DecisionLogEntry = {
  id: string;
  botId: string;
  botName?: string;
  symbol: string;
  timeframe: string;
  action: string;
  status: string;
  source: string;
  pnlUsd?: number;
  entryPrice?: number | null;
  createdAt: string;
  updatedAt: string;
};

export function ExecutionLogsView() {
  const [activeTab, setActiveTab] = useState<ExecutionLogsTab>("all");
  const { decisions } = useBotDecisionsState();
  const botsReadModel = useSignalsBotsReadModel();

  const readModel = useMemo(() => {
    const orders = botsReadModel.allBotExecutionTimeline;
    const botNameById = new Map(botsReadModel.botCards.map((bot) => [bot.id, bot.name]));
    const logs = [
      ...botsReadModel.allBotDecisionTimeline.map((decision) => ({ kind: "decision" as const, decision })),
      ...orders.map((order) => ({ kind: "order" as const, order })),
    ].sort((left, right) => getLogTimestamp(right) - getLogTimestamp(left));
    return {
      logs,
      orders,
      botNameById,
      successRate: calculateSuccessRate(orders, decisions),
      failed: orders.filter((order) => isFailedOrder(order)).length + decisions.filter((decision) => isFailedDecision(decision)).length,
      totalVolume: orders.reduce((sum, order) => sum + Number(order.notionalUsd || 0), 0),
    };
  }, [botsReadModel.allBotDecisionTimeline, botsReadModel.allBotExecutionTimeline, botsReadModel.botCards, decisions]);

  const visibleLogs = readModel.logs.filter((entry) => matchesTab(entry, activeTab)).slice(0, 12);

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
          <StatCard label="Total Executions" value={String(readModel.logs.length)} sub="Recent execution log entries" accentClass="accent-blue" />
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
                {visibleLogs.map((entry) => entry.kind === "order" ? (
                  <tr key={`order-${entry.order.orderId}`}>
                    <td>{formatTimestamp(entry.order.updatedAt || entry.order.createdAt)}</td>
                    <td>#{entry.order.orderId}</td>
                    <td>{entry.order.botName || (entry.order.botId ? readModel.botNameById.get(entry.order.botId) : null) || inferBotLabel(entry.order)}</td>
                    <td>{inferLogType(entry.order)}</td>
                    <td>{entry.order.symbol}</td>
                    <td>{formatSide(entry.order.mode)}</td>
                    <td>{formatAmount(entry.order.quantity)}</td>
                    <td>{formatMaybeUsd(entry.order.entryPrice)}</td>
                    <td>{formatStatus(entry.order)}</td>
                    <td className={Number(entry.order.pnlUsd || 0) >= 0 ? "is-positive" : "is-negative"}>
                      {formatUsd(Number(entry.order.pnlUsd || 0))}
                    </td>
                    <td>
                      <div className="template-table-actions">
                        <button type="button" className="template-inline-link">{entry.order.source || "View"}</button>
                        <button type="button" className="template-inline-link">Copy</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={`decision-${entry.decision.id}`}>
                    <td>{formatTimestamp(entry.decision.updatedAt || entry.decision.createdAt)}</td>
                    <td>{entry.decision.id}</td>
                    <td>{entry.decision.botName || readModel.botNameById.get(entry.decision.botId) || entry.decision.botId}</td>
                    <td>{formatDecisionType(entry.decision)}</td>
                    <td>{entry.decision.symbol}</td>
                    <td>{entry.decision.action.toUpperCase()}</td>
                    <td>{entry.decision.timeframe || "-"}</td>
                    <td>{formatMaybeUsd(("entryPrice" in entry.decision ? entry.decision.entryPrice : null))}</td>
                    <td>{formatDecisionStatus(entry.decision.status)}</td>
                    <td className={Number(("pnlUsd" in entry.decision ? entry.decision.pnlUsd : 0) || 0) >= 0 ? "is-positive" : "is-negative"}>
                      {formatMaybeUsd(("pnlUsd" in entry.decision ? entry.decision.pnlUsd : null))}
                    </td>
                    <td>
                      <div className="template-table-actions">
                        <button type="button" className="template-inline-link">{("source" in entry.decision ? entry.decision.source : "View")}</button>
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

function matchesTab(entry: { kind: "order"; order: ExecutionLogOrderEntry } | { kind: "decision"; decision: DecisionLogEntry }, tab: ExecutionLogsTab) {
  if (entry.kind === "decision") {
    if (tab === "all") return true;
    if (tab === "trades") return entry.decision.action === "execute" || entry.decision.action === "close";
    if (tab === "signals") return entry.decision.action === "observe" || entry.decision.action === "block" || entry.decision.action === "accept";
    if (tab === "errors") return isFailedDecision(entry.decision);
    return entry.decision.source === "ai-supervisor" || entry.decision.source === "market-core";
  }

  const order = entry.order;
  if (tab === "all") return true;
  if (tab === "trades") return order.mode === "execute" || order.mode === "demo" || order.mode === "real";
  if (tab === "signals") return order.mode !== "execute" && !isFailedOrder(order);
  if (tab === "errors") return isFailedOrder(order);
  return order.source === "system" || order.source === "runtime";
}

function isFailedDecision(decision: { status: string }) {
  return decision.status === "blocked" || decision.status === "dismissed";
}

function isFailedOrder(order: ExecutionLogOrderEntry) {
  const status = String(order.status || "").toLowerCase();
  return status.includes("fail") || status.includes("error") || status.includes("reject");
}

function getLogTimestamp(entry: { kind: "order"; order: ExecutionLogOrderEntry } | { kind: "decision"; decision: { createdAt?: string; updatedAt?: string } }) {
  return entry.kind === "order"
    ? new Date(entry.order.updatedAt || entry.order.createdAt || 0).getTime()
    : new Date(entry.decision.updatedAt || entry.decision.createdAt || 0).getTime();
}

function inferBotLabel(order: ExecutionLogOrderEntry) {
  if (String(order.source || "").toLowerCase().includes("signal")) return "Signal Bot";
  if (String(order.source || "").toLowerCase().includes("dca")) return "DCA Bot";
  if (String(order.source || "").toLowerCase().includes("arbitrage")) return "Arbitrage Bot";
  return "System";
}

function inferLogType(order: ExecutionLogOrderEntry) {
  if (isFailedOrder(order)) return "Error";
  if (order.mode === "execute" || order.mode === "demo" || order.mode === "real") return "Trade";
  if (order.mode === "observe") return "Signal";
  return "System";
}

function formatSide(value?: string) {
  if (!value) return "-";
  return value.toUpperCase();
}

function formatStatus(order: ExecutionLogOrderEntry) {
  const status = String(order.status || "").toLowerCase();
  if (status.includes("fill") || status.includes("close") || status.includes("win")) return "Filled";
  if (status.includes("pending") || status.includes("open")) return "Pending";
  if (status.includes("fail") || status.includes("error") || status.includes("reject")) return "Failed";
  return "Success";
}

function calculateSuccessRate(orders: ExecutionLogOrderEntry[], decisions: BotDecisionRecord[]) {
  const total = orders.length + decisions.length;
  if (!total) return 0;
  const success = orders.filter((order) => !isFailedOrder(order)).length + decisions.filter((decision) => !isFailedDecision(decision)).length;
  return (success / total) * 100;
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

function formatDecisionType(decision: { action: string }) {
  if (decision.action === "execute") return "Trade";
  if (decision.action === "block") return "Filter";
  if (decision.action === "observe") return "Signal Review";
  if (decision.action === "assist") return "Assist";
  return "Bot";
}

function formatDecisionStatus(status: string) {
  if (status === "approved") return "Reviewed";
  if (status === "dismissed") return "Dismissed";
  if (status === "executed") return "Executed";
  if (status === "blocked") return "Blocked";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMaybeUsd(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? formatUsd(nextValue) : "-";
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
