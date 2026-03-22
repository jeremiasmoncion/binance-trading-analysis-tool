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

export function isBotOperationalView(view: ViewName) {
  return view === "ai-signal-bot"
    || view === "signals"
    || view === "bots"
    || view === "trading"
    || view === "control-overview"
    || view === "control-bot-settings"
    || view === "control-execution-logs";
}

function isProfileLikeView(view: ViewName) {
  return view === "profile"
    || view === "preferences"
    || view === "notifications"
    || view === "security-api-keys"
    || view === "invite-friends"
    || view === "subscription"
    || view === "help-center";
}

function isStaticPlaceholderView(view: ViewName) {
  return view === "calculator"
    || view === "compare"
    || view === "learn"
    || view === "ai-dca-bot"
    || view === "ai-arbitrage-bot"
    || view === "ai-pump-screener"
    || view === "defi-center"
    || view === "yield-farming"
    || view === "staking-pools"
    || view === "liquidity-tracker"
    || view === "portfolio-tracker"
    || view === "wallets"
    || view === "defi-protocols"
    || view === "strategies-marketplace"
    || view === "bot-templates";
}

export function getViewRefreshPolicy(view: ViewName): ViewRefreshPolicy {
  if (view === "market") {
    return {
      marketSnapshotIntervalMs: 60_000,
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
      marketSnapshotIntervalMs: 300_000,
      marketStreamsEnabled: true,
      systemOverlayStreamEnabled: true,
      signalMemoryIntervalMs: 0,
      portfolioIntervalMs: 0,
      portfolioMode: "live",
      executionIntervalMs: 0,
      dashboardSummaryIntervalMs: 0,
    };
  }

  if (isBotOperationalView(view)) {
    return {
      marketSnapshotIntervalMs: 0,
      marketStreamsEnabled: false,
      systemOverlayStreamEnabled: false,
      signalMemoryIntervalMs: 30_000,
      portfolioIntervalMs: 0,
      portfolioMode: "full",
      executionIntervalMs: 60_000,
      dashboardSummaryIntervalMs: 0,
    };
  }

  if (isProfileLikeView(view) || isStaticPlaceholderView(view)) {
    return {
      marketSnapshotIntervalMs: 0,
      marketStreamsEnabled: false,
      systemOverlayStreamEnabled: false,
      signalMemoryIntervalMs: 0,
      portfolioIntervalMs: 0,
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
