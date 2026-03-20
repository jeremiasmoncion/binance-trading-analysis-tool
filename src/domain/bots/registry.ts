import type { Bot, BotRegistryState } from "./contracts";

export interface BotRegistryStore {
  getState(): BotRegistryState;
  setState(nextState: BotRegistryState): void;
  subscribe(listener: (state: BotRegistryState) => void): () => void;
}

export interface BotRegistrySnapshot {
  state: BotRegistryState;
  selectedBot: Bot | null;
}

function cloneBot(bot: Bot): Bot {
  return {
    ...bot,
    identity: { ...bot.identity },
    capital: { ...bot.capital },
    workspaceSettings: { ...bot.workspaceSettings },
    generalSettings: {
      ...bot.generalSettings,
      activeDays: [...bot.generalSettings.activeDays],
    },
    notificationSettings: { ...bot.notificationSettings },
    universePolicy: {
      ...bot.universePolicy,
      watchlistIds: [...bot.universePolicy.watchlistIds],
      symbols: [...bot.universePolicy.symbols],
      filters: bot.universePolicy.filters
        ? {
            ...bot.universePolicy.filters,
            quoteAssets: bot.universePolicy.filters.quoteAssets ? [...bot.universePolicy.filters.quoteAssets] : undefined,
            baseAssets: bot.universePolicy.filters.baseAssets ? [...bot.universePolicy.filters.baseAssets] : undefined,
            preferredTimeframes: bot.universePolicy.filters.preferredTimeframes ? [...bot.universePolicy.filters.preferredTimeframes] : undefined,
            allowedMarketRegimes: bot.universePolicy.filters.allowedMarketRegimes ? [...bot.universePolicy.filters.allowedMarketRegimes] : undefined,
          }
        : undefined,
    },
    stylePolicy: {
      ...bot.stylePolicy,
      allowedStyles: [...bot.stylePolicy.allowedStyles],
    },
    timeframePolicy: {
      ...bot.timeframePolicy,
      preferredTimeframes: [...bot.timeframePolicy.preferredTimeframes],
      allowedTimeframes: [...bot.timeframePolicy.allowedTimeframes],
    },
    strategyPolicy: {
      ...bot.strategyPolicy,
      allowedStrategyIds: [...bot.strategyPolicy.allowedStrategyIds],
      preferredStrategyIds: [...bot.strategyPolicy.preferredStrategyIds],
    },
    riskPolicy: { ...bot.riskPolicy },
    executionPolicy: { ...bot.executionPolicy },
    aiPolicy: {
      ...bot.aiPolicy,
      requiresConfirmationFor: [...bot.aiPolicy.requiresConfirmationFor],
    },
    overlapPolicy: { ...bot.overlapPolicy },
    memoryPolicy: { ...bot.memoryPolicy },
    localMemory: {
      ...bot.localMemory,
      notes: [...bot.localMemory.notes],
    },
    familyMemory: {
      ...bot.familyMemory,
      notes: [...bot.familyMemory.notes],
    },
    globalMemory: {
      ...bot.globalMemory,
      notes: [...bot.globalMemory.notes],
    },
    performance: { ...bot.performance },
    audit: { ...bot.audit },
    activity: {
      ...bot.activity,
      recentDecisionIds: [...bot.activity.recentDecisionIds],
      recentSymbols: [...bot.activity.recentSymbols],
    },
    tags: [...bot.tags],
  };
}

export function cloneBotRegistryState(state: BotRegistryState): BotRegistryState {
  return {
    bots: state.bots.map(cloneBot),
    selectedBotId: state.selectedBotId,
    lastHydratedAt: state.lastHydratedAt,
  };
}

export function createBotRegistryStore(initialState: BotRegistryState): BotRegistryStore {
  let currentState = cloneBotRegistryState(initialState);
  const listeners = new Set<(state: BotRegistryState) => void>();

  return {
    getState() {
      return cloneBotRegistryState(currentState);
    },
    setState(nextState) {
      currentState = cloneBotRegistryState(nextState);
      for (const listener of listeners) {
        listener(cloneBotRegistryState(currentState));
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createBotRegistrySnapshot(state: BotRegistryState): BotRegistrySnapshot {
  return {
    state,
    selectedBot: state.bots.find((bot) => bot.id === state.selectedBotId) ?? null,
  };
}
