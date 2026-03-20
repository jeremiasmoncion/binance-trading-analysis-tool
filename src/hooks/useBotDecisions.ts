import { useCallback, useEffect, useState } from "react";
import type { BotDecisionRecord } from "../domain";
import { botDecisionService } from "../services/api";

interface BotDecisionRuntimeState {
  decisions: BotDecisionRecord[];
  lastHydratedAt: string | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
}

const BOT_DECISIONS_STORAGE_KEY = "crype-bot-decisions";
let runtimeState: BotDecisionRuntimeState = {
  decisions: [],
  lastHydratedAt: null,
  hydrated: false,
  loading: false,
  error: null,
};
let hydrationPromise: Promise<BotDecisionRecord[]> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

function readCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BOT_DECISIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.decisions)) return null;
    return parsed as Pick<BotDecisionRuntimeState, "decisions" | "lastHydratedAt">;
  } catch {
    return null;
  }
}

function writeCache(decisions: BotDecisionRecord[], lastHydratedAt: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOT_DECISIONS_STORAGE_KEY, JSON.stringify({
    decisions,
    lastHydratedAt,
  }));
}

function setState(patch: Partial<BotDecisionRuntimeState>) {
  runtimeState = {
    ...runtimeState,
    ...patch,
  };
  if (patch.decisions) {
    writeCache(runtimeState.decisions, runtimeState.lastHydratedAt);
  }
  emit();
}

async function hydrate(forceFresh = false) {
  if (!forceFresh && runtimeState.hydrated) {
    return runtimeState.decisions;
  }
  if (!forceFresh && hydrationPromise) {
    return hydrationPromise;
  }

  if (!forceFresh) {
    const cached = readCache();
    if (cached) {
      setState({
        decisions: cached.decisions,
        lastHydratedAt: cached.lastHydratedAt,
        hydrated: true,
        loading: true,
        error: null,
      });
    } else {
      setState({ loading: true, error: null });
    }
  } else {
    setState({ loading: true, error: null });
  }

  hydrationPromise = botDecisionService.list()
    .then((payload) => {
      setState({
        decisions: payload.decisions || [],
        lastHydratedAt: payload.lastHydratedAt || new Date().toISOString(),
        hydrated: true,
        loading: false,
        error: null,
      });
      hydrationPromise = null;
      return runtimeState.decisions;
    })
    .catch((error) => {
      const cached = readCache();
      setState({
        decisions: cached?.decisions || runtimeState.decisions,
        lastHydratedAt: cached?.lastHydratedAt || runtimeState.lastHydratedAt,
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : "No se pudieron hidratar las decisiones de bots.",
      });
      hydrationPromise = null;
      return runtimeState.decisions;
    });

  return hydrationPromise;
}

function upsertDecision(nextDecision: BotDecisionRecord) {
  const existingIndex = runtimeState.decisions.findIndex((decision) => decision.id === nextDecision.id);
  const nextDecisions = existingIndex >= 0
    ? runtimeState.decisions.map((decision, index) => (index === existingIndex ? nextDecision : decision))
    : [nextDecision, ...runtimeState.decisions];
  setState({
    decisions: nextDecisions,
    lastHydratedAt: new Date().toISOString(),
    hydrated: true,
    loading: false,
  });
}

export function useBotDecisionsState() {
  const [state, setLocalState] = useState(() => runtimeState);

  useEffect(() => subscribe(() => {
    setLocalState({ ...runtimeState });
  }), []);

  useEffect(() => {
    void hydrate();
  }, []);

  const createDecision = useCallback(async (payload: BotDecisionRecord) => {
    const response = await botDecisionService.create(payload);
    upsertDecision(response.decision);
    return response.decision;
  }, []);

  const updateDecision = useCallback(async (id: string, payload: Partial<BotDecisionRecord>) => {
    const response = await botDecisionService.update(id, payload);
    upsertDecision(response.decision);
    return response.decision;
  }, []);

  const refreshDecisions = useCallback((forceFresh = true) => hydrate(forceFresh), []);

  return {
    decisions: state.decisions,
    lastHydratedAt: state.lastHydratedAt,
    hydrated: state.hydrated,
    loading: state.loading,
    error: state.error,
    createDecision,
    updateDecision,
    refreshDecisions,
  };
}
