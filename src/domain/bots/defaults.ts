import type {
  Bot,
  BotActivitySummary,
  BotAiPolicy,
  BotExecutionPolicy,
  BotGeneralSettings,
  BotIdentity,
  BotMemoryPolicy,
  BotNotificationSettings,
  BotOverlapPolicy,
  BotRegistryState,
  BotRiskPolicy,
  BotStrategyPolicy,
  BotStylePolicy,
  BotTimeframePolicy,
  BotUniversePolicy,
  BotWorkspaceSettings,
  MemorySummary,
  PerformanceSummary,
} from "./contracts";

export const DEFAULT_BOT_UNIVERSE_POLICY: BotUniversePolicy = {
  kind: "watchlist",
  watchlistIds: [],
  symbols: [],
  filters: {
    preferredTimeframes: ["15m", "1h", "4h"],
  },
};

export const DEFAULT_BOT_STYLE_POLICY: BotStylePolicy = {
  dominantStyle: "swing",
  allowedStyles: ["swing"],
  multiStyleEnabled: false,
};

export const DEFAULT_BOT_TIMEFRAME_POLICY: BotTimeframePolicy = {
  preferredTimeframes: ["1h", "4h"],
  allowedTimeframes: ["15m", "1h", "4h"],
};

export const DEFAULT_BOT_STRATEGY_POLICY: BotStrategyPolicy = {
  allowedStrategyIds: [],
  preferredStrategyIds: [],
  adaptiveAdjustmentsEnabled: true,
};

export const DEFAULT_BOT_RISK_POLICY: BotRiskPolicy = {
  maxPositionUsd: 250,
  maxOpenPositions: 3,
  maxDailyLossPct: 2,
  maxDrawdownPct: 8,
  cooldownAfterLosses: 2,
  maxSymbolExposurePct: 35,
  realExecutionRequiresApproval: true,
};

export const DEFAULT_BOT_EXECUTION_POLICY: BotExecutionPolicy = {
  canOpenPositions: true,
  suggestionsOnly: false,
  requiresHumanApproval: true,
  autoExecutionEnabled: false,
  realExecutionEnabled: false,
};

export const DEFAULT_BOT_AI_POLICY: BotAiPolicy = {
  analystEnabled: true,
  adjusterEnabled: false,
  supervisorEnabled: true,
  unrestrictedModeEnabled: false,
  requiresConfirmationFor: ["strategy-change", "risk-change", "real-order", "capital-change"],
  isolationScope: "standard",
};

export const DEFAULT_BOT_OVERLAP_POLICY: BotOverlapPolicy = {
  observationOverlap: "allow",
  signalOverlap: "dedupe-by-origin",
  executionOverlap: "allow-with-approval",
  arbitrationMode: "priority",
  priority: 50,
  exclusiveUniverse: false,
};

export const DEFAULT_BOT_MEMORY_POLICY: BotMemoryPolicy = {
  familySharingEnabled: false,
  globalLearningEnabled: false,
  allowPromotionToShared: false,
  requiresApprovalForSharedLearning: true,
  familyScope: "bot-family",
};

export const DEFAULT_BOT_WORKSPACE_SETTINGS: BotWorkspaceSettings = {
  primaryPair: "BTC/USDT",
  rangeLower: null,
  rangeUpper: null,
  gridCount: null,
  stopLossPct: null,
  takeProfitPct: null,
  autoCompoundProfits: false,
};

export const DEFAULT_BOT_GENERAL_SETTINGS: BotGeneralSettings = {
  defaultTradingPair: "BTC/USDT",
  defaultExchange: "Binance",
  baseCurrency: "USDT",
  orderSizeType: "fixed",
  autoRestartOnError: true,
  autoCompoundProfits: false,
  paperTradingMode: false,
  smartOrderRouting: true,
  antiSlippageProtection: true,
  executionSpeed: 50,
  apiRateLimit: 1200,
  maxConcurrentBots: 15,
  tradingScheduleEnabled: false,
  startTime: "09:00 AM",
  endTime: "05:00 PM",
  activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  timezone: "UTC",
};

export const DEFAULT_BOT_NOTIFICATION_SETTINGS: BotNotificationSettings = {
  emailEnabled: true,
  emailAddress: "john@example.com",
  telegramEnabled: true,
  telegramHandle: "@johndoe",
  discordConnected: false,
  discordLabel: "Not connected",
  pushEnabled: true,
  pushLabel: "Mobile app",
  tradeExecuted: true,
  takeProfitHit: true,
  stopLossTriggered: true,
  botStatusChange: true,
  dailySummary: false,
  errorAlerts: true,
};

export const DEFAULT_BOT_IDENTITY: BotIdentity = {
  family: "signal-core",
  operatingProfile: "manual-assisted",
  ownerScope: "system",
  isTemplate: true,
  isIsolated: false,
};

export const EMPTY_MEMORY_SUMMARY: MemorySummary = {
  layer: "local",
  lastUpdatedAt: null,
  signalCount: 0,
  decisionCount: 0,
  outcomeCount: 0,
  notes: [],
};

export const EMPTY_PERFORMANCE_SUMMARY: PerformanceSummary = {
  updatedAt: null,
  closedSignals: 0,
  winRate: 0,
  realizedPnlUsd: 0,
  avgPnlUsd: 0,
  avgHoldMinutes: null,
  bestSymbol: null,
  worstSymbol: null,
};

export const EMPTY_ACTIVITY_SUMMARY: BotActivitySummary = {
  lastSignalConsumedAt: null,
  lastSignalLayer: null,
  lastDecisionAction: null,
  lastDecisionStatus: null,
  lastDecisionSymbol: null,
  lastDecisionSource: null,
  pendingCount: 0,
  approvedCount: 0,
  blockedCount: 0,
  executedCount: 0,
  recentDecisionIds: [],
  recentSymbols: [],
};

function createMemorySummary(layer: MemorySummary["layer"]): MemorySummary {
  return {
    ...EMPTY_MEMORY_SUMMARY,
    layer,
  };
}

function cloneUniversePolicy(policy: BotUniversePolicy): BotUniversePolicy {
  return {
    ...policy,
    watchlistIds: [...policy.watchlistIds],
    symbols: [...policy.symbols],
    filters: policy.filters
      ? {
          ...policy.filters,
          quoteAssets: policy.filters.quoteAssets ? [...policy.filters.quoteAssets] : undefined,
          baseAssets: policy.filters.baseAssets ? [...policy.filters.baseAssets] : undefined,
          preferredTimeframes: policy.filters.preferredTimeframes ? [...policy.filters.preferredTimeframes] : undefined,
          allowedMarketRegimes: policy.filters.allowedMarketRegimes ? [...policy.filters.allowedMarketRegimes] : undefined,
        }
      : undefined,
  };
}

export function createBotDraft(overrides: Partial<Bot> & Pick<Bot, "id" | "slug" | "name">): Bot {
  const now = overrides.createdAt ?? new Date().toISOString();

  return {
    id: overrides.id,
    slug: overrides.slug,
    name: overrides.name,
    description: overrides.description ?? "",
    identity: overrides.identity ?? DEFAULT_BOT_IDENTITY,
    status: overrides.status ?? "draft",
    executionEnvironment: overrides.executionEnvironment ?? "paper",
    automationMode: overrides.automationMode ?? "observe",
    capital: overrides.capital ?? {
      allocatedUsd: 0,
      availableUsd: 0,
      accountingScope: overrides.slug,
    },
    workspaceSettings: overrides.workspaceSettings ?? DEFAULT_BOT_WORKSPACE_SETTINGS,
    generalSettings: overrides.generalSettings ?? DEFAULT_BOT_GENERAL_SETTINGS,
    notificationSettings: overrides.notificationSettings ?? DEFAULT_BOT_NOTIFICATION_SETTINGS,
    universePolicy: cloneUniversePolicy(overrides.universePolicy ?? DEFAULT_BOT_UNIVERSE_POLICY),
    stylePolicy: overrides.stylePolicy ?? DEFAULT_BOT_STYLE_POLICY,
    timeframePolicy: overrides.timeframePolicy ?? DEFAULT_BOT_TIMEFRAME_POLICY,
    strategyPolicy: overrides.strategyPolicy ?? DEFAULT_BOT_STRATEGY_POLICY,
    riskPolicy: overrides.riskPolicy ?? DEFAULT_BOT_RISK_POLICY,
    executionPolicy: overrides.executionPolicy ?? DEFAULT_BOT_EXECUTION_POLICY,
    aiPolicy: overrides.aiPolicy ?? DEFAULT_BOT_AI_POLICY,
    overlapPolicy: overrides.overlapPolicy ?? DEFAULT_BOT_OVERLAP_POLICY,
    memoryPolicy: overrides.memoryPolicy ?? DEFAULT_BOT_MEMORY_POLICY,
    localMemory: overrides.localMemory ?? createMemorySummary("local"),
    familyMemory: overrides.familyMemory ?? createMemorySummary("family"),
    globalMemory: overrides.globalMemory ?? createMemorySummary("global"),
    performance: overrides.performance ?? EMPTY_PERFORMANCE_SUMMARY,
    audit: overrides.audit ?? {
      lastDecisionAt: null,
      lastExecutionAt: null,
      lastPolicyChangeAt: null,
    },
    activity: overrides.activity ?? EMPTY_ACTIVITY_SUMMARY,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 50,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export const INITIAL_BOT_REGISTRY_STATE: BotRegistryState = {
  bots: [
    createBotDraft({
      id: "signal-bot-core",
      slug: "signal-bot-core",
      name: "Signal Bot Core",
      description: "Bot principal para consumir señales del sistema con políticas estándar y ejecución controlada.",
      identity: {
        ...DEFAULT_BOT_IDENTITY,
        family: "signal-core",
        operatingProfile: "manual-assisted",
      },
      status: "active",
      automationMode: "assist",
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "signal-bot-core",
      },
      workspaceSettings: {
        ...DEFAULT_BOT_WORKSPACE_SETTINGS,
        primaryPair: "BTC/USDT",
        stopLossPct: 5,
        takeProfitPct: 10,
      },
      tags: ["system", "signals", "phase-2"],
    }),
    createBotDraft({
      id: "dca-bot-core",
      slug: "dca-bot-core",
      name: "DCA Bot Core",
      description: "Bot orientado a acumulación progresiva con reglas de entrada más conservadoras y horizonte extendido.",
      identity: {
        ...DEFAULT_BOT_IDENTITY,
        family: "dca-core",
        operatingProfile: "manual-assisted",
      },
      status: "active",
      automationMode: "assist",
      stylePolicy: {
        ...DEFAULT_BOT_STYLE_POLICY,
        dominantStyle: "long",
        allowedStyles: ["long", "swing"],
      },
      timeframePolicy: {
        ...DEFAULT_BOT_TIMEFRAME_POLICY,
        preferredTimeframes: ["4h", "1d"],
        allowedTimeframes: ["1h", "4h", "1d"],
      },
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "dca-bot-core",
      },
      workspaceSettings: {
        ...DEFAULT_BOT_WORKSPACE_SETTINGS,
        primaryPair: "ETH/USDT",
        autoCompoundProfits: true,
      },
      tags: ["system", "dca", "accumulation"],
      priority: 60,
    }),
    createBotDraft({
      id: "arbitrage-bot-core",
      slug: "arbitrage-bot-core",
      name: "Arbitrage Bot Core",
      description: "Bot reservado para escenarios de arbitraje y captura de desbalances, todavía en modo seguro de observación.",
      identity: {
        ...DEFAULT_BOT_IDENTITY,
        family: "arbitrage-core",
        operatingProfile: "experimental",
      },
      status: "paused",
      automationMode: "observe",
      executionEnvironment: "paper",
      strategyPolicy: {
        ...DEFAULT_BOT_STRATEGY_POLICY,
        preferredStrategyIds: ["arbitrage"],
      },
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "arbitrage-bot-core",
      },
      workspaceSettings: {
        ...DEFAULT_BOT_WORKSPACE_SETTINGS,
        primaryPair: "BTC/USDT",
      },
      tags: ["system", "arbitrage", "safe-mode"],
      priority: 55,
    }),
    createBotDraft({
      id: "pump-screener-core",
      slug: "pump-screener-core",
      name: "Pump Screener",
      description: "Bot detector de momentum y expansión rápida, pensado primero como screener antes que como ejecutor agresivo.",
      identity: {
        ...DEFAULT_BOT_IDENTITY,
        family: "pump-screener-core",
        operatingProfile: "experimental",
      },
      status: "draft",
      automationMode: "observe",
      executionEnvironment: "paper",
      stylePolicy: {
        ...DEFAULT_BOT_STYLE_POLICY,
        dominantStyle: "scalping",
        allowedStyles: ["scalping"],
      },
      timeframePolicy: {
        ...DEFAULT_BOT_TIMEFRAME_POLICY,
        preferredTimeframes: ["5m", "15m"],
        allowedTimeframes: ["5m", "15m", "1h"],
      },
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "pump-screener-core",
      },
      workspaceSettings: {
        ...DEFAULT_BOT_WORKSPACE_SETTINGS,
        primaryPair: "SOL/USDT",
      },
      tags: ["system", "momentum", "scanner"],
      priority: 58,
    }),
    createBotDraft({
      id: "ai-unrestricted-lab",
      slug: "ai-unrestricted-lab",
      name: "AI Unrestricted Lab",
      description: "Perfil de ejemplo para un bot especial sin restricciones estratégicas, pero aislado técnica y contablemente del resto.",
      identity: {
        ...DEFAULT_BOT_IDENTITY,
        family: "ai-unrestricted-lab",
        operatingProfile: "unrestricted-ai",
        ownerScope: "lab",
        isIsolated: true,
      },
      status: "draft",
      automationMode: "observe",
      aiPolicy: {
        ...DEFAULT_BOT_AI_POLICY,
        adjusterEnabled: true,
        unrestrictedModeEnabled: true,
        isolationScope: "isolated",
      },
      overlapPolicy: {
        ...DEFAULT_BOT_OVERLAP_POLICY,
        executionOverlap: "block",
        exclusiveUniverse: true,
        priority: 100,
      },
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "ai-unrestricted-lab",
      },
      workspaceSettings: {
        ...DEFAULT_BOT_WORKSPACE_SETTINGS,
        primaryPair: "BTC/USDT",
      },
      tags: ["lab", "isolated", "ai"],
      priority: 100,
    }),
  ],
  selectedBotId: "signal-bot-core",
  lastHydratedAt: null,
};
