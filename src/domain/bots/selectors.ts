import type { Bot, BotRegistryState, BotStatus, BotTradingStyle } from "./contracts";

export function selectBots(state: BotRegistryState): Bot[] {
  return state.bots;
}

export function selectBotById(state: BotRegistryState, botId: string | null | undefined): Bot | null {
  if (!botId) {
    return null;
  }

  return state.bots.find((bot) => bot.id === botId) ?? null;
}

export function selectSelectedBot(state: BotRegistryState): Bot | null {
  return selectBotById(state, state.selectedBotId);
}

export function selectBotsByStatus(state: BotRegistryState, status: BotStatus): Bot[] {
  return state.bots.filter((bot) => bot.status === status);
}

export function selectBotsByStyle(state: BotRegistryState, style: BotTradingStyle): Bot[] {
  return state.bots.filter((bot) => bot.stylePolicy.allowedStyles.includes(style));
}

export function selectExecutionReadyBots(state: BotRegistryState): Bot[] {
  return state.bots.filter((bot) => bot.status === "active" && bot.executionPolicy.canOpenPositions);
}

export function selectIsolatedBots(state: BotRegistryState): Bot[] {
  return state.bots.filter((bot) => bot.aiPolicy.isolationScope === "isolated");
}
