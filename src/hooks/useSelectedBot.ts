import { useCallback, useSyncExternalStore } from "react";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotRegistryStore,
  selectBotById,
  selectSelectedBot,
  type BotRegistryState,
} from "../domain";

const selectedBotStore = createBotRegistryStore(INITIAL_BOT_REGISTRY_STATE);

function subscribe(listener: () => void) {
  return selectedBotStore.subscribe(() => listener());
}

function getSnapshot() {
  return selectedBotStore.getState();
}

export function setSelectedBotId(botId: string | null) {
  const current = selectedBotStore.getState();
  if (current.selectedBotId === botId) return;

  selectedBotStore.setState({
    ...current,
    selectedBotId: botId,
  });
}

export function useSelectedBotState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const selectedBot = selectSelectedBot(state);

  const selectBot = useCallback((botId: string | null) => {
    setSelectedBotId(botId);
  }, []);

  return {
    state,
    selectedBot,
    selectedBotId: state.selectedBotId,
    selectBot,
  };
}

export function useBotById(botId: string | null | undefined) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selectBotById(state, botId);
}

export function getSelectedBotStateSnapshot(): BotRegistryState {
  return selectedBotStore.getState();
}
