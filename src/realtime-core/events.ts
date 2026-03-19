import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import type {
  RealtimeCoreEventEnvelope,
  RealtimeCoreHeartbeatPayload,
  RealtimeCoreSystemOverlayPayload,
} from "./contracts";
import type { DashboardSummaryPayload, PortfolioAsset } from "../types";

function isSystemOverlayPayload(payload: unknown): payload is RealtimeCoreSystemOverlayPayload {
  return Boolean(payload) && typeof payload === "object" && (
    "connection" in (payload as Record<string, unknown>)
    || "portfolio" in (payload as Record<string, unknown>)
    || "execution" in (payload as Record<string, unknown>)
    || "dashboardSummary" in (payload as Record<string, unknown>)
  );
}

function isHeartbeatPayload(payload: unknown): payload is RealtimeCoreHeartbeatPayload {
  return Boolean(payload) && typeof payload === "object" && "generatedAt" in (payload as Record<string, unknown>);
}

function hasUsefulDashboardSummary(summary: unknown) {
  if (!summary || typeof summary !== "object") return false;
  const typed = summary as Record<string, unknown>;
  const portfolio = (typed.portfolio || {}) as Record<string, unknown>;
  const execution = (typed.execution || {}) as Record<string, unknown>;
  const portfolioValue = Number(portfolio.totalValue || 0);
  const topAssetsCount = Array.isArray(typed.topAssets) ? typed.topAssets.length : 0;
  const recentOrdersCount = Array.isArray(execution.recentOrders) ? execution.recentOrders.length : 0;
  return portfolioValue > 0 || topAssetsCount > 0 || recentOrdersCount > 0;
}

function hasUsefulExecutionCenter(execution: unknown) {
  if (!execution || typeof execution !== "object") return false;
  const typed = execution as Record<string, unknown>;
  const account = (typed.account || {}) as Record<string, unknown>;
  const candidatesCount = Array.isArray(typed.candidates) ? typed.candidates.length : 0;
  const recentOrdersCount = Array.isArray(typed.recentOrders) ? typed.recentOrders.length : 0;
  const totalValue = Number(account.totalValue || 0);
  const cashValue = Number(account.cashValue || 0);
  const openOrdersCount = Number(account.openOrdersCount || 0);
  return totalValue > 0 || cashValue > 0 || openOrdersCount > 0 || candidatesCount > 0 || recentOrdersCount > 0;
}

function hasRealtimeOverlayChanged(
  current: ReturnType<typeof systemDataPlaneStore.getState>,
  nextConnection: ReturnType<typeof systemDataPlaneStore.getState>["snapshot"]["connection"],
  nextExecution: ReturnType<typeof systemDataPlaneStore.getState>["overlay"]["execution"],
  nextDashboardSummary: ReturnType<typeof systemDataPlaneStore.getState>["overlay"]["dashboardSummary"],
) {
  return !(
    current.snapshot.connection === nextConnection
    && current.overlay.execution === nextExecution
    && current.overlay.dashboardSummary === nextDashboardSummary
  );
}

function mergeDashboardSummaryPreservingCollections(
  currentSummary: DashboardSummaryPayload | null,
  nextSummary: DashboardSummaryPayload | null | undefined,
): DashboardSummaryPayload | null {
  if (!nextSummary || typeof nextSummary !== "object") {
    return currentSummary ?? null;
  }

  if (!currentSummary || typeof currentSummary !== "object") {
    return nextSummary;
  }

  const currentTopAssets = Array.isArray((currentSummary as { topAssets?: PortfolioAsset[] }).topAssets)
    ? (currentSummary as { topAssets: PortfolioAsset[] }).topAssets
    : [];
  const nextTopAssets = Array.isArray((nextSummary as { topAssets?: PortfolioAsset[] }).topAssets)
    ? (nextSummary as { topAssets: PortfolioAsset[] }).topAssets
    : [];
  const currentPortfolio = currentSummary.portfolio || null;
  const nextPortfolio = nextSummary.portfolio || null;
  const currentPositionsValue = Number(currentPortfolio?.positionsValue || 0);
  const nextPositionsValue = Number(nextPortfolio?.positionsValue || 0);
  const currentTotalValue = Number(currentPortfolio?.totalValue || 0);
  const nextTotalValue = Number(nextPortfolio?.totalValue || 0);
  const nextCashValue = Number(nextPortfolio?.cashValue || 0);
  const collapsedToMostlyCash = nextTotalValue > 0 && nextCashValue / nextTotalValue >= 0.9;
  const collapsedPositions = currentPositionsValue > 0 && nextPositionsValue <= currentPositionsValue * 0.25;
  const collapsedTotalValue = currentTotalValue > 0 && nextTotalValue <= currentTotalValue * 0.75;

  if (collapsedTotalValue && collapsedPositions && collapsedToMostlyCash) {
    return {
      ...nextSummary,
      portfolio: currentPortfolio,
      topAssets: currentTopAssets,
    };
  }

  if (!nextTopAssets.length && currentTopAssets.length) {
    return {
      ...nextSummary,
      topAssets: currentTopAssets,
    };
  }

  return nextSummary;
}

export function applyRealtimeCoreEvent(event: RealtimeCoreEventEnvelope) {
  if (event.type === "system.overlay.updated" && isSystemOverlayPayload(event.payload)) {
    const payload = event.payload;
    systemDataPlaneStore.setState((current) => {
      const nextConnection = payload.connection ?? current.snapshot.connection;
      const nextExecution = hasUsefulExecutionCenter(payload.execution)
        ? payload.execution
        : current.overlay.execution;
      const nextDashboardSummary = hasUsefulDashboardSummary(payload.dashboardSummary)
        ? mergeDashboardSummaryPreservingCollections(current.overlay.dashboardSummary, payload.dashboardSummary)
        : current.overlay.dashboardSummary;

      // Realtime overlays are the hottest shared path in the app. Ignore
      // semantically identical frames so future bot/live expansions do not
      // keep waking the whole system plane on heartbeat-like overlay noise.
      if (!hasRealtimeOverlayChanged(current, nextConnection, nextExecution, nextDashboardSummary)) {
        return current;
      }

      return {
        ...current,
        meta: {
          ...current.meta,
          status: "ready",
          source: "overlay",
          lastOverlayAt: Date.now(),
          lastStreamAt: Date.now(),
          lastError: null,
        },
        snapshot: {
          ...current.snapshot,
          connection: nextConnection,
        },
        overlay: {
          execution: nextExecution,
          dashboardSummary: nextDashboardSummary,
        },
      };
    });
    return;
  }

  if (event.type === "system.heartbeat" && isHeartbeatPayload(event.payload)) {
    systemDataPlaneStore.setState((current) => {
      if (current.meta.status === "ready" && current.meta.source === "stream" && current.meta.lastError === null) {
        return {
          ...current,
          meta: {
            ...current.meta,
            lastStreamAt: Date.now(),
          },
        };
      }

      return {
        ...current,
        meta: {
          ...current.meta,
          status: "ready",
          source: "stream",
          lastStreamAt: Date.now(),
          lastError: null,
        },
      };
    });
  }
}
