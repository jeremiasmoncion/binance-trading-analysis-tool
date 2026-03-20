import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";

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
  executionOrderId?: number | null;
  executionOutcomeStatus?: string | null;
  createdAt: string;
  updatedAt: string;
};
type ActivityLogEntry =
  | { kind: "order"; order: ExecutionLogOrderEntry }
  | { kind: "decision"; decision: DecisionLogEntry; linkedOrder?: ExecutionLogOrderEntry | null };
type ActivityOwnershipFilter = "all" | "linked" | "decision-only" | "unlinked";
type ActivityBotScope = "all" | "attention";

export function ExecutionLogsView() {
  const [activeTab, setActiveTab] = useState<ExecutionLogsTab>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<ActivityOwnershipFilter>("all");
  const [botScope, setBotScope] = useState<ActivityBotScope>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { decisions } = useBotDecisionsState();
  const botsReadModel = useSignalsBotsReadModel();

  const readModel = useMemo(() => {
    const orders = botsReadModel.allBotExecutionTimeline;
    const botNameById = new Map(botsReadModel.botCards.map((bot) => [bot.id, bot.name]));
    const logs = (botsReadModel.allBotActivityTimeline || []) as ActivityLogEntry[];
    const failedDecisions = logs.filter((entry) => entry.kind === "decision" && isFailedDecision(entry.decision)).length;
    const failedOrders = logs.filter((entry) => entry.kind === "order" && isFailedOrder(entry.order)).length;
    const attentionBotIds = new Set(botsReadModel.attentionBotIds || []);
    return {
      logs,
      orders,
      botNameById,
      attentionBotIds,
      attentionBots: botsReadModel.attentionBots || [],
      botCards: botsReadModel.botCards || [],
      successRate: calculateSuccessRate(logs, decisions.length),
      failed: failedOrders + failedDecisions,
      totalVolume: orders.reduce((sum, order) => sum + Number(order.notionalUsd || 0), 0),
    };
  }, [botsReadModel.allBotActivityTimeline, botsReadModel.allBotExecutionTimeline, botsReadModel.attentionBotIds, botsReadModel.attentionBots, botsReadModel.botCards, decisions.length]);

  const filteredLogs = readModel.logs
    .filter((entry) => matchesTab(entry, activeTab))
    .filter((entry) => matchesOwnership(entry, ownershipFilter))
    .filter((entry) => matchesBotScope(entry, botScope, readModel.attentionBotIds))
    .filter((entry) => matchesSearch(entry, searchQuery, readModel.botNameById));
  const visibleLogs = filteredLogs.slice(0, 12);
  const botSummaries = useMemo(() => {
    const logsByBotId = new Map<string, ActivityLogEntry[]>();
    filteredLogs.forEach((entry) => {
      const botId = entry.kind === "decision" ? entry.decision.botId : entry.order.botId;
      if (!botId) return;
      const currentEntries = logsByBotId.get(botId) || [];
      currentEntries.push(entry);
      logsByBotId.set(botId, currentEntries);
    });

    const scopedBots = botScope === "attention"
      ? readModel.attentionBots
      : readModel.botCards
          .filter((bot) => logsByBotId.has(bot.id))
          .sort((left, right) => (logsByBotId.get(right.id)?.length || 0) - (logsByBotId.get(left.id)?.length || 0))
          .slice(0, 3);

    return scopedBots.map((bot) => {
      const botLogs = logsByBotId.get(bot.id) || [];
      const linkedCount = botLogs.filter((entry) => entry.kind === "decision" && Boolean(entry.linkedOrder)).length;
      const decisionOnlyCount = botLogs.filter((entry) => entry.kind === "decision" && !entry.linkedOrder).length;
      const unlinkedOrderCount = botLogs.filter((entry) => entry.kind === "order").length;
      const latestEntry = botLogs[0] || null;
      return {
        id: bot.id,
        name: bot.name,
        pair: bot.workspaceSettings.primaryPair || latestSymbolFromBot(bot) || "-",
        activityCount: botLogs.length,
        linkedCount,
        decisionOnlyCount,
        unlinkedOrderCount,
        ownedOutcomeCount: bot.ownership.ownedOutcomeCount,
        unresolvedOwnershipCount: bot.ownership.unresolvedOwnershipCount,
        reconciliationPct: bot.ownership.reconciliationPct,
        healthLabel: bot.ownership.healthLabel,
        adaptationConfidence: bot.adaptationSummary?.trainingConfidence || "low",
        attentionNote: bot.attention?.note || bot.adaptationSummary?.adaptationBias || "Waiting for stronger owned outcomes.",
        latestTimestamp: latestEntry
          ? formatTimestamp(latestEntry.kind === "decision"
            ? (latestEntry.linkedOrder?.updatedAt || latestEntry.decision.updatedAt || latestEntry.decision.createdAt)
            : (latestEntry.order.updatedAt || latestEntry.order.createdAt))
          : null,
      };
    });
  }, [botScope, filteredLogs, readModel.attentionBots, readModel.botCards]);

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
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search logs"
                className="template-search-input"
                placeholder="Search by ID, pair, bot name, or source..."
              />
            </div>
            <div className="template-filter-row">
              <button type="button" className={`template-chip ${botScope === "all" ? "is-active" : ""}`.trim()} onClick={() => setBotScope("all")}>All Bots</button>
              <button type="button" className={`template-chip ${botScope === "attention" ? "is-active" : ""}`.trim()} onClick={() => setBotScope("attention")}>Attention Bots</button>
              <button type="button" className={`template-chip ${ownershipFilter === "all" ? "is-active" : ""}`.trim()} onClick={() => setOwnershipFilter("all")}>All Activity</button>
              <button type="button" className={`template-chip ${ownershipFilter === "linked" ? "is-active" : ""}`.trim()} onClick={() => setOwnershipFilter("linked")}>Linked Outcomes</button>
              <button type="button" className={`template-chip ${ownershipFilter === "decision-only" ? "is-active" : ""}`.trim()} onClick={() => setOwnershipFilter("decision-only")}>Decision Only</button>
              <button type="button" className={`template-chip ${ownershipFilter === "unlinked" ? "is-active" : ""}`.trim()} onClick={() => setOwnershipFilter("unlinked")}>Unlinked Orders</button>
              <button type="button" className="template-chip" onClick={() => { setBotScope("all"); setOwnershipFilter("all"); setSearchQuery(""); setActiveTab("all"); }}>Clear</button>
            </div>
          </div>

          {botSummaries.length ? (
            <div className="signalbot-insight-stack" style={{ marginBottom: "1rem" }}>
              {botSummaries.map((bot) => (
                <article key={bot.id} className="signalbot-insight-card">
                  <strong>{bot.name} · {bot.pair}</strong>
                  <p>
                    {bot.activityCount} entries in view · {bot.ownedOutcomeCount} owned outcomes · {bot.unresolvedOwnershipCount} unresolved · {formatOwnershipHealth(bot.healthLabel)} · {bot.adaptationConfidence} confidence
                  </p>
                  <p>
                    {bot.linkedCount} linked / {bot.decisionOnlyCount} decision-only / {bot.unlinkedOrderCount} unlinked orders
                    {bot.latestTimestamp ? ` · latest ${bot.latestTimestamp}` : ""}
                  </p>
                  <p>{bot.attentionNote}</p>
                </article>
              ))}
            </div>
          ) : null}

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
                    <td>{getEntryBotName(entry, readModel.botNameById)}</td>
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
                    <td>{formatTimestamp(entry.linkedOrder?.updatedAt || entry.decision.updatedAt || entry.decision.createdAt)}</td>
                    <td>{entry.decision.id}</td>
                    <td>{getEntryBotName(entry, readModel.botNameById)}</td>
                    <td>{formatDecisionType(entry.decision)}</td>
                    <td>{entry.decision.symbol}</td>
                    <td>{entry.decision.action.toUpperCase()}</td>
                    <td>{entry.decision.timeframe || "-"}</td>
                    <td>{formatMaybeUsd(entry.linkedOrder?.entryPrice ?? entry.decision.entryPrice ?? null)}</td>
                    <td>{formatDecisionStatus(entry.decision.status, entry.linkedOrder?.status)}</td>
                    <td className={Number((entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd ?? 0) || 0) >= 0 ? "is-positive" : "is-negative"}>
                      {formatMaybeUsd(entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd ?? null)}
                    </td>
                    <td>
                      <div className="template-table-actions">
                        <button type="button" className="template-inline-link">{formatDecisionActionLink(entry.decision, entry.linkedOrder)}</button>
                        <button type="button" className="template-inline-link">Copy</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleLogs.length ? (
                  <tr>
                    <td colSpan={11}>
                      <div className="template-empty-state">
                        <strong>No activity matches this view.</strong>
                        <span>Try another tab, search term, or ownership filter.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function matchesTab(entry: ActivityLogEntry, tab: ExecutionLogsTab) {
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

function matchesOwnership(entry: ActivityLogEntry, filter: ActivityOwnershipFilter) {
  if (filter === "all") return true;
  if (filter === "linked") return entry.kind === "decision" && Boolean(entry.linkedOrder);
  if (filter === "decision-only") return entry.kind === "decision" && !entry.linkedOrder;
  return entry.kind === "order";
}

function matchesBotScope(entry: ActivityLogEntry, scope: ActivityBotScope, attentionBotIds: Set<string>) {
  if (scope === "all") return true;
  const botId = entry.kind === "decision" ? entry.decision.botId : entry.order.botId;
  return Boolean(botId && attentionBotIds.has(botId));
}

function matchesSearch(entry: ActivityLogEntry, query: string, botNameById: Map<string, string>) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return true;

  const botName = getEntryBotName(entry, botNameById);
  const haystack = entry.kind === "order"
    ? [
        entry.order.orderId,
        entry.order.symbol,
        entry.order.source,
        entry.order.mode,
        entry.order.status,
        botName,
      ]
    : [
        entry.decision.id,
        entry.decision.symbol,
        entry.decision.source,
        entry.decision.action,
        entry.decision.status,
        entry.decision.timeframe,
        entry.decision.executionOrderId,
        botName,
      ];

  return haystack.some((value) => normalizeQuery(value).includes(normalizedQuery));
}

function latestSymbolFromBot(bot: {
  activity: {
    recentSymbols: string[];
  };
}) {
  return bot.activity.recentSymbols[0] || null;
}

function formatOwnershipHealth(value: string) {
  if (value === "needs-attention") return "Needs attention";
  if (value === "watch") return "Watch";
  if (value === "stable") return "Stable";
  if (value === "healthy") return "Healthy";
  return value;
}

function isFailedDecision(decision: { status: string }) {
  return decision.status === "blocked" || decision.status === "dismissed";
}

function isFailedOrder(order: ExecutionLogOrderEntry) {
  const status = String(order.status || "").toLowerCase();
  return status.includes("fail") || status.includes("error") || status.includes("reject");
}

function inferBotLabel(order: ExecutionLogOrderEntry) {
  if (String(order.source || "").toLowerCase().includes("signal")) return "Signal Bot";
  if (String(order.source || "").toLowerCase().includes("dca")) return "DCA Bot";
  if (String(order.source || "").toLowerCase().includes("arbitrage")) return "Arbitrage Bot";
  return "System";
}

function getEntryBotName(entry: ActivityLogEntry, botNameById: Map<string, string>) {
  if (entry.kind === "order") {
    return entry.order.botName || (entry.order.botId ? botNameById.get(entry.order.botId) : null) || inferBotLabel(entry.order);
  }

  return entry.decision.botName || botNameById.get(entry.decision.botId) || entry.decision.botId;
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

function formatDecisionStatus(status: string, linkedOrderStatus?: string | null) {
  if (linkedOrderStatus) return formatStatus({ status: linkedOrderStatus } as ExecutionLogOrderEntry);
  if (status === "closed") return "Closed";
  if (status === "approved") return "Reviewed";
  if (status === "dismissed") return "Dismissed";
  if (status === "executed") return "Executed";
  if (status === "blocked") return "Blocked";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDecisionActionLink(decision: DecisionLogEntry, linkedOrder?: ExecutionLogOrderEntry | null) {
  if (linkedOrder?.orderId || decision.executionOrderId) {
    const orderId = linkedOrder?.orderId || decision.executionOrderId;
    const outcome = decision.executionOutcomeStatus || linkedOrder?.status;
    return outcome ? `Order ${String(outcome).toLowerCase()}` : `Order #${orderId}`;
  }
  return decision.source || "View";
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

function calculateSuccessRate(logs: ActivityLogEntry[], decisionCount: number) {
  const total = logs.length || decisionCount;
  if (!total) return 0;
  const success = logs.filter((entry) => (
    entry.kind === "order"
      ? !isFailedOrder(entry.order)
      : !isFailedDecision(entry.decision) && !entry.linkedOrder
        ? true
        : entry.linkedOrder
          ? !isFailedOrder(entry.linkedOrder)
          : !isFailedDecision(entry.decision)
  )).length;
  return (success / total) * 100;
}

function normalizeQuery(value: unknown) {
  return String(value || "").trim().toLowerCase();
}
