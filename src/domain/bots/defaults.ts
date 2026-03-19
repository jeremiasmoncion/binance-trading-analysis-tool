import type {
  Bot,
  BotAiPolicy,
  BotExecutionPolicy,
  BotOverlapPolicy,
  BotRegistryState,
  BotRiskPolicy,
  BotStrategyPolicy,
  BotStylePolicy,
  BotTimeframePolicy,
  BotUniversePolicy,
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
    status: overrides.status ?? "draft",
    executionEnvironment: overrides.executionEnvironment ?? "paper",
    automationMode: overrides.automationMode ?? "observe",
    capital: overrides.capital ?? {
      allocatedUsd: 0,
      availableUsd: 0,
      accountingScope: overrides.slug,
    },
    universePolicy: cloneUniversePolicy(overrides.universePolicy ?? DEFAULT_BOT_UNIVERSE_POLICY),
    stylePolicy: overrides.stylePolicy ?? DEFAULT_BOT_STYLE_POLICY,
    timeframePolicy: overrides.timeframePolicy ?? DEFAULT_BOT_TIMEFRAME_POLICY,
    strategyPolicy: overrides.strategyPolicy ?? DEFAULT_BOT_STRATEGY_POLICY,
    riskPolicy: overrides.riskPolicy ?? DEFAULT_BOT_RISK_POLICY,
    executionPolicy: overrides.executionPolicy ?? DEFAULT_BOT_EXECUTION_POLICY,
    aiPolicy: overrides.aiPolicy ?? DEFAULT_BOT_AI_POLICY,
    overlapPolicy: overrides.overlapPolicy ?? DEFAULT_BOT_OVERLAP_POLICY,
    localMemory: overrides.localMemory ?? createMemorySummary("local"),
    familyMemory: overrides.familyMemory ?? createMemorySummary("family"),
    globalMemory: overrides.globalMemory ?? createMemorySummary("global"),
    performance: overrides.performance ?? EMPTY_PERFORMANCE_SUMMARY,
    audit: overrides.audit ?? {
      lastDecisionAt: null,
      lastExecutionAt: null,
      lastPolicyChangeAt: null,
    },
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
      status: "active",
      automationMode: "assist",
      capital: {
        allocatedUsd: 0,
        availableUsd: 0,
        accountingScope: "signal-bot-core",
      },
      tags: ["system", "signals", "phase-2"],
    }),
    createBotDraft({
      id: "ai-unrestricted-lab",
      slug: "ai-unrestricted-lab",
      name: "AI Unrestricted Lab",
      description: "Perfil de ejemplo para un bot especial sin restricciones estratégicas, pero aislado técnica y contablemente del resto.",
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
      tags: ["lab", "isolated", "ai"],
      priority: 100,
    }),
  ],
  selectedBotId: "signal-bot-core",
  lastHydratedAt: null,
};
