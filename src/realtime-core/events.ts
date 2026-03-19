import { systemDataPlaneStore } from "../data-platform/systemDataPlane";
import type {
  RealtimeCoreEventEnvelope,
  RealtimeCoreHeartbeatPayload,
  RealtimeCoreSystemOverlayPayload,
} from "./contracts";

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
        execution: payload.execution ?? current.overlay.execution,
        dashboardSummary: hasUsefulDashboardSummary(payload.dashboardSummary)
          ? payload.dashboardSummary
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
