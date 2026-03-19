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
    systemDataPlaneStore.setState((current) => ({
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
        connection: payload.connection ?? current.snapshot.connection,
      },
      overlay: {
        execution: hasUsefulExecutionCenter(payload.execution)
          ? payload.execution
          : current.overlay.execution,
        dashboardSummary: hasUsefulDashboardSummary(payload.dashboardSummary)
          ? mergeDashboardSummaryPreservingCollections(current.overlay.dashboardSummary, payload.dashboardSummary)
          : current.overlay.dashboardSummary,
      },
    }));
    return;
  }

  if (event.type === "system.heartbeat" && isHeartbeatPayload(event.payload)) {
    systemDataPlaneStore.setState((current) => ({
      ...current,
      meta: {
        ...current.meta,
        status: "ready",
        source: "stream",
        lastStreamAt: Date.now(),
        lastError: null,
      },
    }));
  }
}
