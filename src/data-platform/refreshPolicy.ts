import type { ViewName } from "../types";

export interface ViewRefreshPolicy {
  marketSnapshotIntervalMs: number;
  marketStreamsEnabled: boolean;
  systemOverlayStreamEnabled: boolean;
  signalMemoryIntervalMs: number;
  portfolioIntervalMs: number;
  portfolioMode: "full" | "live";
  executionIntervalMs: number;
  dashboardSummaryIntervalMs: number;
}

function isDashboardLikeView(view: ViewName) {
  return view === "dashboard";
}

export function getViewRefreshPolicy(view: ViewName): ViewRefreshPolicy {
  if (view === "market") {
    return {
      marketSnapshotIntervalMs: 1,
      marketStreamsEnabled: true,
      systemOverlayStreamEnabled: false,
      signalMemoryIntervalMs: 45_000,
      portfolioIntervalMs: 120_000,
      portfolioMode: "full",
      executionIntervalMs: 90_000,
      dashboardSummaryIntervalMs: 0,
    };
  }

  if (view === "memory") {
    return {
      marketSnapshotIntervalMs: 0,
      marketStreamsEnabled: false,
      systemOverlayStreamEnabled: true,
      signalMemoryIntervalMs: 30_000,
      portfolioIntervalMs: 120_000,
      portfolioMode: "full",
      executionIntervalMs: 0,
      dashboardSummaryIntervalMs: 0,
    };
  }

  if (view === "balance") {
    return {
      marketSnapshotIntervalMs: 0,
      marketStreamsEnabled: false,
      systemOverlayStreamEnabled: false,
      signalMemoryIntervalMs: 45_000,
      portfolioIntervalMs: 20_000,
      portfolioMode: "live",
      executionIntervalMs: 90_000,
      dashboardSummaryIntervalMs: 0,
    };
  }

  if (isDashboardLikeView(view)) {
    return {
      marketSnapshotIntervalMs: 1,
      marketStreamsEnabled: true,
      systemOverlayStreamEnabled: true,
      signalMemoryIntervalMs: 0,
      portfolioIntervalMs: 60_000,
      portfolioMode: "full",
      executionIntervalMs: 0,
      dashboardSummaryIntervalMs: 0,
    };
  }

  return {
    marketSnapshotIntervalMs: 0,
    marketStreamsEnabled: false,
    systemOverlayStreamEnabled: false,
    signalMemoryIntervalMs: 45_000,
    portfolioIntervalMs: 120_000,
    portfolioMode: "full",
    executionIntervalMs: 90_000,
    dashboardSummaryIntervalMs: 0,
  };
}
