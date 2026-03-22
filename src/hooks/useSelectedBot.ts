import { useCallback, useEffect, useState } from "react";
import {
  createBotRegistryStore,
  selectBotById,
  selectSelectedBot,
  type Bot,
  type BotRegistryState,
} from "../domain";
import { authService, botService } from "../services/api";

interface BotRegistryRuntimeState {
  registry: BotRegistryState;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  sessionUsername: string | null;
}

const BOT_REGISTRY_STORAGE_KEY_PREFIX = "crype-bot-registry";
const EMPTY_BOT_REGISTRY_STATE: BotRegistryState = {
  bots: [],
  selectedBotId: null,
  lastHydratedAt: null,
};
const TEMPLATE_BOT_IDS = new Set([
  "signal-bot-core",
  "dca-bot-core",
  "arbitrage-bot-core",
  "pump-screener-core",
  "ai-unrestricted-lab",
]);
const botRegistryStore = createBotRegistryStore(EMPTY_BOT_REGISTRY_STATE);
let runtimeState: BotRegistryRuntimeState = {
  registry: EMPTY_BOT_REGISTRY_STATE,
  hydrated: false,
  loading: false,
  error: null,
  sessionUsername: null,
};
let hydrationPromise: Promise<BotRegistryState> | null = null;
const runtimeListeners = new Set<() => void>();

function isTemplateRegistry(state: BotRegistryState | null | undefined) {
  if (!state || !Array.isArray(state.bots) || !state.bots.length) return false;
  return state.bots.every((bot) => TEMPLATE_BOT_IDS.has(bot.id));
}

function isCacheBotShapeValid(bot: unknown) {
  if (!bot || typeof bot !== "object") return false;
  const candidate = bot as Record<string, unknown>;
  return Boolean(
    candidate.identity
    && candidate.generalSettings
    && candidate.notificationSettings
    && candidate.activity
    && Array.isArray((candidate.activity as { recentDecisionIds?: unknown }).recentDecisionIds)
    && Array.isArray((candidate.activity as { recentSymbols?: unknown }).recentSymbols)
    && candidate.localMemory
    && candidate.familyMemory
    && candidate.globalMemory,
  );
}

function buildRegistryStorageKey(username: string | null | undefined) {
  const normalized = String(username || "").trim().toLowerCase();
  return normalized ? `${BOT_REGISTRY_STORAGE_KEY_PREFIX}:${normalized}` : BOT_REGISTRY_STORAGE_KEY_PREFIX;
}

function readCachedRegistry(username: string | null | undefined) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(buildRegistryStorageKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.bots)) return null;
    const nextRegistry = parsed as BotRegistryState;
    if (isTemplateRegistry(nextRegistry) || !nextRegistry.bots.every(isCacheBotShapeValid)) {
      window.localStorage.removeItem(buildRegistryStorageKey(username));
      return null;
    }
    return nextRegistry;
  } catch {
    return null;
  }
}

function writeCachedRegistry(username: string | null | undefined, nextRegistry: BotRegistryState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildRegistryStorageKey(username), JSON.stringify(nextRegistry));
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
  writeCachedRegistry(runtimeState.sessionUsername, nextRegistry);
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

async function ensureRegistrySessionContext() {
  const session = await authService.getSession().catch(() => null);
  const nextUsername = String(session?.username || "").trim().toLowerCase() || null;

  if (runtimeState.sessionUsername === nextUsername) {
    return nextUsername;
  }

  hydrationPromise = null;
  runtimeState = {
    registry: EMPTY_BOT_REGISTRY_STATE,
    hydrated: false,
    loading: false,
    error: null,
    sessionUsername: nextUsername,
  };
  botRegistryStore.setState(EMPTY_BOT_REGISTRY_STATE);
  emitRuntimeState();
  return nextUsername;
}

function subscribe(listener: () => void) {
  runtimeListeners.add(listener);
  return () => {
    runtimeListeners.delete(listener);
  };
}

async function hydrateBotRegistry(forceFresh = false) {
  const sessionUsername = await ensureRegistrySessionContext();
  if (!sessionUsername) {
    setRegistry(EMPTY_BOT_REGISTRY_STATE);
    setRuntimePatch({
      hydrated: true,
      loading: false,
      error: null,
    });
    return EMPTY_BOT_REGISTRY_STATE;
  }

  if (!forceFresh && runtimeState.hydrated) {
    return runtimeState.registry;
  }

  if (!forceFresh && hydrationPromise) {
    return hydrationPromise;
  }

  if (!forceFresh) {
    const cachedRegistry = readCachedRegistry(sessionUsername);
    if (cachedRegistry) {
      try {
        setRegistry(cachedRegistry);
      } catch {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(buildRegistryStorageKey(sessionUsername));
        }
      }
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
      const cachedRegistry = readCachedRegistry(sessionUsername);
      const fallbackRegistry = cachedRegistry || (isTemplateRegistry(runtimeState.registry) ? EMPTY_BOT_REGISTRY_STATE : runtimeState.registry);
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
  await ensureRegistrySessionContext();
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
  await ensureRegistrySessionContext();
  const previousRegistry = runtimeState.registry;
  patchBotInRegistry(botId, (bot) => ({
    ...bot,
    ...payload,
    executionAccount: payload.executionAccount ?? bot.executionAccount,
    identity: payload.identity ? { ...bot.identity, ...payload.identity } : bot.identity,
    capital: payload.capital ? { ...bot.capital, ...payload.capital } : bot.capital,
    workspaceSettings: payload.workspaceSettings
      ? { ...bot.workspaceSettings, ...payload.workspaceSettings }
      : bot.workspaceSettings,
    generalSettings: payload.generalSettings
      ? { ...bot.generalSettings, ...payload.generalSettings }
      : bot.generalSettings,
    notificationSettings: payload.notificationSettings
      ? { ...bot.notificationSettings, ...payload.notificationSettings }
      : bot.notificationSettings,
    universePolicy: payload.universePolicy
      ? {
          ...bot.universePolicy,
          ...payload.universePolicy,
          watchlistIds: payload.universePolicy.watchlistIds ?? bot.universePolicy.watchlistIds,
          symbols: payload.universePolicy.symbols ?? bot.universePolicy.symbols,
          filters: payload.universePolicy.filters
            ? { ...bot.universePolicy.filters, ...payload.universePolicy.filters }
            : bot.universePolicy.filters,
        }
      : bot.universePolicy,
    stylePolicy: payload.stylePolicy ? { ...bot.stylePolicy, ...payload.stylePolicy } : bot.stylePolicy,
    timeframePolicy: payload.timeframePolicy
      ? { ...bot.timeframePolicy, ...payload.timeframePolicy }
      : bot.timeframePolicy,
    strategyPolicy: payload.strategyPolicy
      ? { ...bot.strategyPolicy, ...payload.strategyPolicy }
      : bot.strategyPolicy,
    riskPolicy: payload.riskPolicy ? { ...bot.riskPolicy, ...payload.riskPolicy } : bot.riskPolicy,
    executionPolicy: payload.executionPolicy
      ? { ...bot.executionPolicy, ...payload.executionPolicy }
      : bot.executionPolicy,
    aiPolicy: payload.aiPolicy ? { ...bot.aiPolicy, ...payload.aiPolicy } : bot.aiPolicy,
    overlapPolicy: payload.overlapPolicy ? { ...bot.overlapPolicy, ...payload.overlapPolicy } : bot.overlapPolicy,
    memoryPolicy: payload.memoryPolicy ? { ...bot.memoryPolicy, ...payload.memoryPolicy } : bot.memoryPolicy,
    performance: payload.performance ? { ...bot.performance, ...payload.performance } : bot.performance,
    localMemory: payload.localMemory ? { ...bot.localMemory, ...payload.localMemory } : bot.localMemory,
    familyMemory: payload.familyMemory ? { ...bot.familyMemory, ...payload.familyMemory } : bot.familyMemory,
    globalMemory: payload.globalMemory ? { ...bot.globalMemory, ...payload.globalMemory } : bot.globalMemory,
    audit: payload.audit ? { ...bot.audit, ...payload.audit } : bot.audit,
    activity: payload.activity
      ? {
          ...bot.activity,
          ...payload.activity,
          recentDecisionIds: payload.activity.recentDecisionIds ?? bot.activity.recentDecisionIds,
          recentSymbols: payload.activity.recentSymbols ?? bot.activity.recentSymbols,
        }
      : bot.activity,
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
