import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useBotDecisionsState } from "../hooks/useBotDecisions";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";

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
  executionIntentStatus?: string | null;
  executionIntentLane?: string | null;
  executionIntentLaneStatus?: string | null;
  executionIntentReason?: string | null;
  executionIntentDispatchStatus?: string | null;
  executionIntentDispatchMode?: string | null;
  executionIntentDispatchAttemptedAt?: string | null;
  executionIntentDispatchedAt?: string | null;
  executionIntentPreviewRefreshCount?: number | null;
  executionOutcomeStatus?: string | null;
  createdAt: string;
  updatedAt: string;
};
type ActivityLogEntry =
  | { kind: "order"; order: ExecutionLogOrderEntry }
  | { kind: "decision"; decision: DecisionLogEntry; linkedOrder?: ExecutionLogOrderEntry | null };
type ActivityOwnershipFilter = "all" | "linked" | "decision-only" | "unlinked";
type ActivityBotScope = "all" | "attention";
type ActivityIntentFilter = "all" | "queued" | "dispatch-requested" | "dispatched" | "awaiting-approval" | "blocked" | "linked";

export function ExecutionLogsView() {
  const [activeTab, setActiveTab] = useState<ExecutionLogsTab>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<ActivityOwnershipFilter>("all");
  const [botScope, setBotScope] = useState<ActivityBotScope>("all");
  const [intentFilter, setIntentFilter] = useState<ActivityIntentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { decisions, updateDecision } = useBotDecisionsState();
  const botsReadModel = useSignalsBotsReadModel();

  const handleIntentReview = async (decision: DecisionLogEntry, outcome: "approve" | "reject") => {
    const loaderId = startLoading({
      label: outcome === "approve" ? "Approving intent" : "Rejecting intent",
      detail: `${decision.botName || decision.botId} • ${decision.symbol}`,
    });

    try {
      const now = new Date().toISOString();
      await updateDecision(decision.id, {
        status: outcome === "approve" ? "approved" : "blocked",
        metadata: {
          executionIntentStatus: outcome === "approve" ? "ready" : decision.executionIntentStatus || "approval-needed",
          executionIntentLaneStatus: outcome === "approve" ? "queued" : "blocked",
          executionIntentLastUpdatedAt: now,
          executionIntentApprovedAt: outcome === "approve" ? now : null,
          executionIntentRejectedAt: outcome === "reject" ? now : null,
          executionIntentReviewOutcome: outcome,
          executionIntentReason: outcome === "approve"
            ? "Approved during execution review."
            : "Rejected during execution review.",
        },
      });
      showToast({
        tone: "success",
        title: outcome === "approve" ? "Intent approved" : "Intent rejected",
        message: `${decision.symbol} was ${outcome === "approve" ? "queued for paper/demo review" : "blocked in execution review"}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Intent review failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleIntentDispatch = async (decision: DecisionLogEntry) => {
    const loaderId = startLoading({
      label: "Dispatching intent",
      detail: `${decision.botName || decision.botId} • ${decision.symbol}`,
    });

    try {
      const now = new Date().toISOString();
      await updateDecision(decision.id, {
        metadata: {
          executionIntentLaneStatus: "dispatch-requested",
          executionIntentDispatchRequestedAt: now,
          executionIntentLastUpdatedAt: now,
          executionIntentDispatchReason: "Requested from execution review for paper/demo dispatch.",
        },
      });
      showToast({
        tone: "success",
        title: "Dispatch requested",
        message: `${decision.symbol} moved into paper/demo dispatch request.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Dispatch failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleRefreshPreview = async (decision: DecisionLogEntry) => {
    const loaderId = startLoading({
      label: "Refreshing preview",
      detail: `${decision.botName || decision.botId} • ${decision.symbol}`,
    });

    try {
      const now = new Date().toISOString();
      await updateDecision(decision.id, {
        status: "approved",
        metadata: {
          executionIntentStatus: "ready",
          executionIntentLaneStatus: "dispatch-requested",
          executionIntentPreviewRefreshCount: Number(decision.executionIntentPreviewRefreshCount || 0) + 1,
          executionIntentLastUpdatedAt: now,
          executionIntentDispatchRequestedAt: now,
          executionIntentReason: "Expired paper preview refreshed from execution review.",
        },
      });
      showToast({
        tone: "success",
        title: "Preview refreshed",
        message: `${decision.symbol} moved back into paper preview dispatch.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Preview refresh failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handlePardonPreviewChurn = async (decision: DecisionLogEntry) => {
    const loaderId = startLoading({
      label: "Granting preview pardon",
      detail: `${decision.botName || decision.botId} • ${decision.symbol}`,
    });

    try {
      const now = new Date().toISOString();
      await updateDecision(decision.id, {
        status: "approved",
        metadata: {
          executionIntentStatus: "ready",
          executionIntentLaneStatus: "dispatch-requested",
          executionIntentLastUpdatedAt: now,
          executionIntentDispatchRequestedAt: now,
          executionIntentPreviewChurnPardonGrantedAt: now,
          executionIntentReason: "Paper preview churn pardon granted from execution review.",
        },
      });
      showToast({
        tone: "success",
        title: "Preview pardon granted",
        message: `${decision.symbol} can attempt one recovery preview dispatch.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Preview pardon failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

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
    .filter((entry) => matchesIntent(entry, intentFilter))
    .filter((entry) => matchesSearch(entry, searchQuery, readModel.botNameById));
  const visibleLogs = filteredLogs.slice(0, 12);
  const intentSummaries = useMemo(() => {
    const scopedBots = botScope === "attention" ? readModel.attentionBots : readModel.botCards;
    return scopedBots
      .filter((bot) => (
        (bot.executionIntentSummary?.queuedCount || 0)
        || (bot.executionIntentSummary?.dispatchRequestedCount || 0)
        || (bot.executionIntentSummary?.dispatchedCount || 0)
        || (bot.executionIntentSummary?.awaitingApprovalCount || 0)
        || (bot.executionIntentSummary?.blockedLaneCount || 0)
      ))
      .sort((left, right) => (
        ((right.executionIntentSummary?.queuedCount || 0) + (right.executionIntentSummary?.dispatchRequestedCount || 0) + (right.executionIntentSummary?.dispatchedCount || 0) + (right.executionIntentSummary?.awaitingApprovalCount || 0) + (right.executionIntentSummary?.blockedLaneCount || 0))
        - ((left.executionIntentSummary?.queuedCount || 0) + (left.executionIntentSummary?.dispatchRequestedCount || 0) + (left.executionIntentSummary?.dispatchedCount || 0) + (left.executionIntentSummary?.awaitingApprovalCount || 0) + (left.executionIntentSummary?.blockedLaneCount || 0))
      ))
      .slice(0, 4)
      .map((bot) => ({
        id: bot.id,
        name: bot.name,
        pair: bot.workspaceSettings.primaryPair || latestSymbolFromBot(bot) || "-",
        queuedCount: bot.executionIntentSummary?.queuedCount || 0,
        dispatchRequestedCount: bot.executionIntentSummary?.dispatchRequestedCount || 0,
        dispatchedCount: bot.executionIntentSummary?.dispatchedCount || 0,
        previewedCount: bot.executionIntentSummary?.previewedCount || 0,
        previewRecordedCount: bot.executionIntentSummary?.previewRecordedCount || 0,
        previewExpiredCount: bot.executionIntentSummary?.previewExpiredCount || 0,
        previewFreshCount: bot.executionIntentSummary?.previewFreshCount || 0,
        previewStaleCount: bot.executionIntentSummary?.previewStaleCount || 0,
        executionSubmittedCount: bot.executionIntentSummary?.executionSubmittedCount || 0,
        awaitingApprovalCount: bot.executionIntentSummary?.awaitingApprovalCount || 0,
        blockedLaneCount: bot.executionIntentSummary?.blockedLaneCount || 0,
        linkedCount: bot.executionIntentSummary?.linkedCount || 0,
        latestIntentStatus: bot.executionIntentSummary?.latestIntentStatus || null,
        latestLaneStatus: bot.executionIntentSummary?.latestLaneStatus || null,
        latestIntentSymbol: bot.executionIntentSummary?.latestIntentSymbol || null,
        latestGuardrailReason: bot.executionIntentSummary?.latestGuardrailReason || null,
        latestDispatchMode: findLatestDispatchValue(botLogsFromBot(bot.id, filteredLogs), "mode"),
        latestDispatchStatus: findLatestDispatchValue(botLogsFromBot(bot.id, filteredLogs), "status"),
        topReadySymbols: bot.executionIntentSummary?.topReadySymbols || [],
        topBlockedSymbols: bot.executionIntentSummary?.topBlockedSymbols || [],
      }));
  }, [botScope, readModel.attentionBots, readModel.botCards]);
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
      const latestDispatchEntry = botLogs.find((entry): entry is Extract<ActivityLogEntry, { kind: "decision" }> => (
        entry.kind === "decision" && Boolean(entry.decision.executionIntentDispatchMode || entry.decision.executionIntentDispatchStatus)
      )) || null;
      const unresolvedDecisionRanking = rankSymbols(
        botLogs
          .filter((entry): entry is Extract<ActivityLogEntry, { kind: "decision" }> => entry.kind === "decision" && !entry.linkedOrder)
          .map((entry) => entry.decision.symbol),
      );
      const unlinkedExecutionRanking = rankSymbols(
        botLogs
          .filter((entry): entry is Extract<ActivityLogEntry, { kind: "order" }> => entry.kind === "order")
          .map((entry) => entry.order.symbol),
      );
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
        unresolvedDecisionSymbols: bot.ownership.unresolvedDecisionSymbols || [],
        unlinkedExecutionSymbols: bot.ownership.unlinkedExecutionSymbols || [],
        unresolvedDecisionRanking,
        unlinkedExecutionRanking,
        bestSymbol: bot.adaptationSummary?.bestSymbol || bot.performance.bestSymbol || null,
        weakestSymbol: bot.adaptationSummary?.weakestSymbol || bot.performance.worstSymbol || null,
        dispatchMode: latestDispatchEntry?.decision.executionIntentDispatchMode || null,
        dispatchStatus: latestDispatchEntry?.decision.executionIntentDispatchStatus || null,
        dispatchReason: latestDispatchEntry?.decision.executionIntentReason || null,
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
              <button type="button" className={`template-chip ${intentFilter === "queued" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("queued")}>Queued Intents</button>
              <button type="button" className={`template-chip ${intentFilter === "dispatch-requested" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("dispatch-requested")}>Dispatch Requested</button>
              <button type="button" className={`template-chip ${intentFilter === "dispatched" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("dispatched")}>Dispatched</button>
              <button type="button" className={`template-chip ${intentFilter === "awaiting-approval" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("awaiting-approval")}>Awaiting Approval</button>
              <button type="button" className={`template-chip ${intentFilter === "blocked" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("blocked")}>Blocked Intents</button>
              <button type="button" className={`template-chip ${intentFilter === "linked" ? "is-active" : ""}`.trim()} onClick={() => setIntentFilter("linked")}>Linked Intents</button>
              <button type="button" className="template-chip" onClick={() => { setBotScope("all"); setOwnershipFilter("all"); setIntentFilter("all"); setSearchQuery(""); setActiveTab("all"); }}>Clear</button>
            </div>
          </div>

          {intentSummaries.length ? (
            <div className="signalbot-insight-stack" style={{ marginBottom: "1rem" }}>
              {intentSummaries.map((bot) => (
                <article key={`intent-${bot.id}`} className="signalbot-insight-card">
                  <strong>{bot.name} · {bot.pair}</strong>
                  <p>
                    {bot.queuedCount} queued · {bot.dispatchRequestedCount} dispatch requested · {bot.previewedCount} preview flow · {bot.previewRecordedCount} preview recorded · {bot.previewExpiredCount} preview expired ({bot.previewFreshCount} fresh / {bot.previewStaleCount} stale) · {bot.executionSubmittedCount} demo submitted · {bot.awaitingApprovalCount} awaiting approval · {bot.blockedLaneCount} blocked · {bot.linkedCount} linked
                  </p>
                  {bot.latestDispatchMode || bot.latestDispatchStatus ? (
                    <p>
                      Dispatch: {formatDispatchMode(bot.latestDispatchMode)} · {formatDispatchStatus(bot.latestDispatchStatus)}
                    </p>
                  ) : null}
                  <p>
                    {bot.latestIntentSymbol
                      ? `${formatIntentStatus(bot.latestIntentStatus)} • ${formatLaneStatus(bot.latestLaneStatus)} • ${bot.latestIntentSymbol}`
                      : "No operational intent has been staged yet."}
                  </p>
                  {bot.topReadySymbols.length || bot.topBlockedSymbols.length ? (
                    <p>
                      {bot.topReadySymbols.length ? `Ready: ${formatSymbolRanking(bot.topReadySymbols)}` : "Ready: clear"}
                      {" · "}
                      {bot.topBlockedSymbols.length ? `Blocked: ${formatSymbolRanking(bot.topBlockedSymbols)}` : "Blocked: clear"}
                    </p>
                  ) : null}
                  <p>{bot.latestGuardrailReason || "The shared intent lane is now available for paper/demo review."}</p>
                </article>
              ))}
            </div>
          ) : null}

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
                  {bot.unresolvedDecisionSymbols.length || bot.unlinkedExecutionSymbols.length ? (
                    <p>
                      {bot.unresolvedDecisionRanking.length
                        ? `Decision backlog: ${formatSymbolRanking(bot.unresolvedDecisionRanking)}`
                        : "Decision backlog: clear"}
                      {" · "}
                      {bot.unlinkedExecutionRanking.length
                        ? `Execution backlog: ${formatSymbolRanking(bot.unlinkedExecutionRanking)}`
                        : "Execution backlog: clear"}
                    </p>
                  ) : null}
                  {bot.bestSymbol || bot.weakestSymbol ? (
                    <p>
                      {bot.bestSymbol ? `Best pocket: ${bot.bestSymbol}` : "Best pocket: forming"}
                      {" · "}
                      {bot.weakestSymbol ? `Weak pocket: ${bot.weakestSymbol}` : "Weak pocket: not clear"}
                    </p>
                  ) : null}
                  {bot.dispatchMode || bot.dispatchStatus ? (
                    <p>
                      Dispatch lane: {formatDispatchMode(bot.dispatchMode)} · {formatDispatchStatus(bot.dispatchStatus)}
                      {bot.dispatchReason ? ` · ${bot.dispatchReason}` : ""}
                    </p>
                  ) : null}
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
                    <td>{formatDecisionStatus(entry.decision.status, entry.linkedOrder?.status, entry.decision.executionIntentLaneStatus)}</td>
                    <td className={Number((entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd ?? 0) || 0) >= 0 ? "is-positive" : "is-negative"}>
                      {formatMaybeUsd(entry.linkedOrder?.pnlUsd ?? entry.decision.pnlUsd ?? null)}
                    </td>
                    <td>
                      <div className="template-table-actions">
                        {entry.decision.executionIntentLaneStatus === "awaiting-approval" ? (
                          <>
                            <button type="button" className="template-inline-link" onClick={() => void handleIntentReview(entry.decision, "approve")}>Approve</button>
                            <button type="button" className="template-inline-link" onClick={() => void handleIntentReview(entry.decision, "reject")}>Reject</button>
                          </>
                        ) : entry.decision.executionIntentLaneStatus === "queued" ? (
                          <button type="button" className="template-inline-link" onClick={() => void handleIntentDispatch(entry.decision)}>Dispatch</button>
                        ) : isPreviewChurnBlockedDecision(entry.decision) ? (
                          <button type="button" className="template-inline-link" onClick={() => void handlePardonPreviewChurn(entry.decision)}>Pardon Churn</button>
                        ) : entry.decision.executionIntentLaneStatus === "preview-expired" ? (
                          <button type="button" className="template-inline-link" onClick={() => void handleRefreshPreview(entry.decision)}>Refresh Preview</button>
                        ) : (
                          <button type="button" className="template-inline-link">{formatDecisionActionLink(entry.decision, entry.linkedOrder)}</button>
                        )}
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

function matchesIntent(entry: ActivityLogEntry, filter: ActivityIntentFilter) {
  if (filter === "all") return true;
  if (entry.kind !== "decision") return false;
  const laneStatus = String(entry.decision.executionIntentLaneStatus || "").trim();
  if (!laneStatus) return false;
  if (filter === "queued") return laneStatus === "queued";
  if (filter === "dispatch-requested") return laneStatus === "dispatch-requested";
  if (filter === "dispatched") return laneStatus === "previewed" || laneStatus === "preview-recorded" || laneStatus === "preview-expired" || laneStatus === "execution-submitted";
  if (filter === "awaiting-approval") return laneStatus === "awaiting-approval";
  if (filter === "blocked") return laneStatus === "blocked";
  return laneStatus === "linked";
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
        entry.decision.executionIntentDispatchStatus,
        entry.decision.executionIntentDispatchMode,
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

function rankSymbols(symbols: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  symbols
    .filter((value): value is string => Boolean(value))
    .forEach((symbol) => {
      counts.set(symbol, (counts.get(symbol) || 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([symbol, count]) => ({ symbol, count }));
}

function formatSymbolRanking(items: Array<{ symbol: string; count: number }>) {
  return items.map((item) => `${item.symbol} (${item.count})`).join(", ");
}

function isFailedDecision(decision: { status: string }) {
  return decision.status === "blocked" || decision.status === "dismissed";
}

function isPreviewChurnBlockedDecision(decision: DecisionLogEntry) {
  return String(decision.executionIntentLaneStatus || "").trim() === "blocked"
    && String(decision.executionIntentReason || "").toLowerCase().includes("preview churn is severe");
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

function formatDecisionStatus(status: string, linkedOrderStatus?: string | null, intentLaneStatus?: string | null) {
  if (linkedOrderStatus) return formatStatus({ status: linkedOrderStatus } as ExecutionLogOrderEntry);
  if (intentLaneStatus === "queued") return "Queued";
  if (intentLaneStatus === "dispatch-requested") return "Dispatch Requested";
  if (intentLaneStatus === "previewed") return "Previewed";
  if (intentLaneStatus === "preview-recorded") return "Preview Recorded";
  if (intentLaneStatus === "preview-expired") return "Preview Expired";
  if (intentLaneStatus === "execution-submitted") return "Execution Submitted";
  if (intentLaneStatus === "awaiting-approval") return "Awaiting Approval";
  if (intentLaneStatus === "blocked") return "Intent Blocked";
  if (intentLaneStatus === "linked") return "Linked";
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
  if (decision.executionIntentLaneStatus === "blocked") {
    return decision.executionIntentReason || decision.source || "Blocked intent";
  }
  if (decision.executionIntentLaneStatus === "previewed" || decision.executionIntentLaneStatus === "preview-recorded" || decision.executionIntentLaneStatus === "preview-expired" || decision.executionIntentLaneStatus === "execution-submitted") {
    return `${formatDispatchMode(decision.executionIntentDispatchMode)} · ${formatDispatchStatus(decision.executionIntentDispatchStatus)}`;
  }
  if (decision.executionIntentLaneStatus) {
    return `${formatLaneStatus(decision.executionIntentLaneStatus)} intent`;
  }
  return decision.source || "View";
}

function botLogsFromBot(botId: string, logs: ActivityLogEntry[]) {
  return logs.filter((entry) => (entry.kind === "decision" ? entry.decision.botId : entry.order.botId) === botId);
}

function findLatestDispatchValue(logs: ActivityLogEntry[], field: "mode" | "status") {
  const match = logs.find((entry): entry is Extract<ActivityLogEntry, { kind: "decision" }> => (
    entry.kind === "decision"
    && Boolean(field === "mode" ? entry.decision.executionIntentDispatchMode : entry.decision.executionIntentDispatchStatus)
  ));
  if (!match) return null;
  return field === "mode" ? match.decision.executionIntentDispatchMode || null : match.decision.executionIntentDispatchStatus || null;
}

function formatDispatchMode(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "preview") return "Paper Preview";
  if (normalized === "execute") return "Demo Execute";
  return normalized ? formatLaneStatus(normalized) : "Pending Dispatch";
}

function formatDispatchStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Pending";
  if (normalized === "submitted") return "Submitted";
  if (normalized === "blocked") return "Blocked";
  if (normalized === "failed") return "Failed";
  return formatLaneStatus(normalized);
}

function formatIntentStatus(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Waiting";
  return normalized.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatLaneStatus(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Pending";
  return normalized.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
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
