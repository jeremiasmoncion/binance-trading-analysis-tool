import { useCallback, useEffect, useState } from "react";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotRegistryStore,
  selectBotById,
  selectSelectedBot,
  type Bot,
  type BotRegistryState,
} from "../domain";
import { botService } from "../services/api";

interface BotRegistryRuntimeState {
  registry: BotRegistryState;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
}

const BOT_REGISTRY_STORAGE_KEY = "crype-bot-registry";
const botRegistryStore = createBotRegistryStore(INITIAL_BOT_REGISTRY_STATE);
let runtimeState: BotRegistryRuntimeState = {
  registry: INITIAL_BOT_REGISTRY_STATE,
  hydrated: false,
  loading: false,
  error: null,
};
let hydrationPromise: Promise<BotRegistryState> | null = null;
const runtimeListeners = new Set<() => void>();

function readCachedRegistry() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(BOT_REGISTRY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.bots)) return null;
    return parsed as BotRegistryState;
  } catch {
    return null;
  }
}

function writeCachedRegistry(nextRegistry: BotRegistryState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOT_REGISTRY_STORAGE_KEY, JSON.stringify(nextRegistry));
}

function emitRuntimeState() {
  runtimeListeners.forEach((listener) => listener());
}

function setRegistry(nextRegistry: BotRegistryState) {
  runtimeState = {
    ...runtimeState,
    registry: nextRegistry,
  };
  botRegistryStore.setState(nextRegistry);
  writeCachedRegistry(nextRegistry);
  emitRuntimeState();
}

function setRuntimePatch(patch: Partial<BotRegistryRuntimeState>) {
  runtimeState = {
    ...runtimeState,
    ...patch,
  };
  emitRuntimeState();
}

function normalizeRegistry(nextBots: Bot[], currentSelectedBotId: string | null, lastHydratedAt: string | null = new Date().toISOString()) {
  const selectedBotId = nextBots.some((bot) => bot.id === currentSelectedBotId)
    ? currentSelectedBotId
    : nextBots[0]?.id || null;

  return {
    bots: nextBots,
    selectedBotId,
    lastHydratedAt,
  } satisfies BotRegistryState;
}

function subscribe(listener: () => void) {
  runtimeListeners.add(listener);
  return () => {
    runtimeListeners.delete(listener);
  };
}

async function hydrateBotRegistry(forceFresh = false) {
  if (!forceFresh && runtimeState.hydrated) {
    return runtimeState.registry;
  }

  if (!forceFresh && hydrationPromise) {
    return hydrationPromise;
  }

  if (!forceFresh) {
    const cachedRegistry = readCachedRegistry();
    if (cachedRegistry) {
      setRegistry(cachedRegistry);
      setRuntimePatch({
        hydrated: true,
        loading: true,
        error: null,
      });
    } else {
      setRuntimePatch({
        loading: true,
        error: null,
      });
    }
  } else {
    setRuntimePatch({
      loading: true,
      error: null,
    });
  }

  hydrationPromise = botService.list()
    .then((payload) => {
      const nextRegistry = normalizeRegistry(
        payload.bots || [],
        runtimeState.registry.selectedBotId,
        payload.lastHydratedAt || new Date().toISOString(),
      );
      setRegistry(nextRegistry);
      setRuntimePatch({
        hydrated: true,
        loading: false,
        error: null,
      });
      hydrationPromise = null;
      return nextRegistry;
    })
    .catch((error) => {
      const fallbackRegistry = readCachedRegistry() || runtimeState.registry;
      setRegistry(fallbackRegistry);
      setRuntimePatch({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo hidratar el registro de bots.",
      });
      hydrationPromise = null;
      return fallbackRegistry;
    });

  return hydrationPromise;
}

function patchBotInRegistry(botId: string, updater: (bot: Bot) => Bot) {
  const nextRegistry = {
    ...runtimeState.registry,
    bots: runtimeState.registry.bots.map((bot) => (bot.id === botId ? updater(bot) : bot)),
    lastHydratedAt: new Date().toISOString(),
  };
  setRegistry(nextRegistry);
}

export async function createBotProfile(payload: Partial<Bot> & { name?: string }) {
  const response = await botService.create(payload);
  const currentRegistry = runtimeState.registry;
  const nextRegistry = normalizeRegistry(
    [...currentRegistry.bots, response.bot],
    response.bot.id,
    new Date().toISOString(),
  );
  setRegistry(nextRegistry);
  setRuntimePatch({ hydrated: true, loading: false, error: null });
  return response.bot;
}

export async function updateBotProfile(botId: string, payload: Partial<Bot>) {
  const previousRegistry = runtimeState.registry;
  patchBotInRegistry(botId, (bot) => ({
    ...bot,
    ...payload,
    capital: payload.capital ? { ...bot.capital, ...payload.capital } : bot.capital,
    workspaceSettings: payload.workspaceSettings
      ? { ...bot.workspaceSettings, ...payload.workspaceSettings }
      : bot.workspaceSettings,
    riskPolicy: payload.riskPolicy ? { ...bot.riskPolicy, ...payload.riskPolicy } : bot.riskPolicy,
    performance: payload.performance ? { ...bot.performance, ...payload.performance } : bot.performance,
    localMemory: payload.localMemory ? { ...bot.localMemory, ...payload.localMemory } : bot.localMemory,
    updatedAt: new Date().toISOString(),
  }));

  try {
    const response = await botService.update(botId, payload);
    patchBotInRegistry(botId, () => response.bot);
    return response.bot;
  } catch (error) {
    setRegistry(previousRegistry);
    throw error;
  }
}

export function setSelectedBotId(botId: string | null) {
  const current = runtimeState.registry;
  if (current.selectedBotId === botId) return;
  setRegistry({
    ...current,
    selectedBotId: botId,
  });
}

export function useSelectedBotState() {
  const [state, setState] = useState(() => runtimeState);

  useEffect(() => subscribe(() => {
    setState({ ...runtimeState });
  }), []);

  useEffect(() => {
    void hydrateBotRegistry();
  }, []);

  const selectedBot = selectSelectedBot(state.registry);

  const selectBot = useCallback((botId: string | null) => {
    setSelectedBotId(botId);
  }, []);

  const createBot = useCallback((payload: Partial<Bot> & { name?: string }) => createBotProfile(payload), []);
  const updateBot = useCallback((botId: string, payload: Partial<Bot>) => updateBotProfile(botId, payload), []);
  const refreshBots = useCallback((forceFresh = true) => hydrateBotRegistry(forceFresh), []);

  return {
    state: state.registry,
    selectedBot,
    selectedBotId: state.registry.selectedBotId,
    hydrated: state.hydrated,
    loading: state.loading,
    error: state.error,
    selectBot,
    createBot,
    updateBot,
    refreshBots,
  };
}

export function useBotById(botId: string | null | undefined) {
  const [state, setState] = useState(() => runtimeState);

  useEffect(() => subscribe(() => {
    setState({ ...runtimeState });
  }), []);

  useEffect(() => {
    void hydrateBotRegistry();
  }, []);

  return selectBotById(state.registry, botId);
}

export function getSelectedBotStateSnapshot(): BotRegistryState {
  return runtimeState.registry;
}
