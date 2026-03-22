import type { ExecutionCandidate, ExecutionOrderRecord } from "../../types";
import type { Bot, MemorySummary, PerformanceSummary } from "./contracts";

function toHoldMinutes(order: ExecutionOrderRecord): number | null {
  if (!order.closed_at) {
    return null;
  }

  const created = Date.parse(order.created_at);
  const closed = Date.parse(order.closed_at);

  if (Number.isNaN(created) || Number.isNaN(closed) || closed < created) {
    return null;
  }

  return Math.round((closed - created) / 60000);
}

export function summarizeBotPerformanceFromOrders(orders: ExecutionOrderRecord[]): PerformanceSummary {
  const closedOrders = orders.filter((order) => typeof order.realized_pnl === "number");
  const realizedPnlUsd = closedOrders.reduce((sum, order) => sum + Number(order.realized_pnl || 0), 0);
  const winningOrders = closedOrders.filter((order) => Number(order.realized_pnl || 0) > 0).length;
  const holdMinutes = closedOrders
    .map(toHoldMinutes)
    .filter((value): value is number => typeof value === "number");

  const symbolBreakdown = new Map<string, number>();
  for (const order of closedOrders) {
    symbolBreakdown.set(order.coin, (symbolBreakdown.get(order.coin) ?? 0) + Number(order.realized_pnl || 0));
  }

  const rankedSymbols = [...symbolBreakdown.entries()].sort((left, right) => right[1] - left[1]);

  return {
    updatedAt: closedOrders.at(-1)?.closed_at ?? closedOrders.at(-1)?.created_at ?? null,
    closedSignals: closedOrders.length,
    winRate: closedOrders.length ? (winningOrders / closedOrders.length) * 100 : 0,
    realizedPnlUsd,
    avgPnlUsd: closedOrders.length ? realizedPnlUsd / closedOrders.length : 0,
    avgHoldMinutes: holdMinutes.length ? holdMinutes.reduce((sum, value) => sum + value, 0) / holdMinutes.length : null,
    bestSymbol: rankedSymbols[0]?.[0] ?? null,
    worstSymbol: rankedSymbols.at(-1)?.[0] ?? null,
  };
}

export function summarizeBotMemory(bot: Bot, candidates: ExecutionCandidate[], orders: ExecutionOrderRecord[]): MemorySummary {
  return {
    layer: "local",
    lastUpdatedAt: orders.at(-1)?.created_at ?? null,
    signalCount: candidates.length,
    decisionCount: candidates.filter((candidate) => candidate.status === "eligible").length,
    outcomeCount: orders.filter((order) => order.signal_outcome_status && order.signal_outcome_status !== "pending").length,
    notes: [
      `Bot ${bot.slug} preparado para consumir ${candidates.length} candidatos del sistema actual.`,
    ],
  };
}
