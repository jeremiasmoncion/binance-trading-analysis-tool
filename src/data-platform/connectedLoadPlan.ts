import type { ViewName } from "../types";
import { isBotOperationalView } from "./refreshPolicy.ts";

export interface ConnectedViewLoadPlan {
  portfolioMode: "full" | "live" | null;
  refreshExecution: boolean;
  refreshDashboard: boolean;
}

function viewNeedsPortfolioHydration(view: ViewName) {
  return view === "balance" || view === "dashboard" || view === "stats";
}

function viewNeedsExecutionHydration(view: ViewName) {
  return view === "memory" || view === "stats" || isBotOperationalView(view);
}

function viewNeedsDashboardHydration(view: ViewName) {
  return view === "dashboard";
}

export function buildConnectedViewLoadPlan(
  view: ViewName,
  previousView: ViewName,
  streamEnabled: boolean,
  portfolioMode: "full" | "live",
): ConnectedViewLoadPlan {
  if (view === "balance") {
    return {
      portfolioMode: previousView === "balance" ? "live" : "full",
      refreshExecution: false,
      refreshDashboard: false,
    };
  }

  if (view === "memory") {
    return {
      portfolioMode: null,
      refreshExecution: !streamEnabled,
      refreshDashboard: false,
    };
  }

  if (view === "dashboard") {
    return {
      portfolioMode: streamEnabled ? null : portfolioMode,
      refreshExecution: !streamEnabled,
      refreshDashboard: true,
    };
  }

  if (view === "stats") {
    return {
      portfolioMode,
      refreshExecution: true,
      refreshDashboard: false,
    };
  }

  if (isBotOperationalView(view)) {
    return {
      portfolioMode: null,
      refreshExecution: true,
      refreshDashboard: false,
    };
  }

  return {
    portfolioMode: null,
    refreshExecution: false,
    refreshDashboard: false,
  };
}

export function buildInitialConnectedLoadPlan(
  view: ViewName,
  streamEnabled: boolean,
  portfolioMode: "full" | "live",
): ConnectedViewLoadPlan {
  const needsPortfolio = viewNeedsPortfolioHydration(view);
  const needsExecution = viewNeedsExecutionHydration(view);
  const needsDashboard = viewNeedsDashboardHydration(view);

  return {
    portfolioMode: needsPortfolio ? (view === "balance" ? "full" : portfolioMode) : null,
    refreshExecution: needsExecution || (needsDashboard && !streamEnabled),
    refreshDashboard: needsDashboard,
  };
}
