import type {
  BinanceConnection,
  DashboardSummaryPayload,
  ExecutionCenterPayload,
  ExecutionProfile,
  DashboardAnalysis,
  OperationPlan,
  PortfolioPayload,
  Signal,
  SignalOutcomeStatus,
  SignalSnapshot,
  RecommendationActivationResult,
  StrategyCandidate,
  StrategyDecisionState,
  StrategyDescriptor,
  StrategyExperimentRecord,
  StrategyRegistryEntry,
  StrategyValidationLabPayload,
  StrategyValidationReport,
  StrategyRecommendationRecord,
  StrategyVersionRecord,
  TimeframeSignal,
  UserSession,
  WatchlistGroup,
  WatchlistScanExecution,
  WatchlistScannerStatus,
} from "../types";
import type { Bot, BotDecisionRecord } from "../domain";
import type { RealtimeCoreBootstrapPayload, RealtimeCoreEventEnvelope, RealtimeCoreHealthPayload } from "../realtime-core/contracts";

export type RealtimeCoreRuntimeMode = "external" | "serverless";
export interface RealtimeCoreRuntimeState {
  configured: boolean;
  preferredMode: RealtimeCoreRuntimeMode;
  activeMode: RealtimeCoreRuntimeMode;
  healthy: boolean;
  targetLabel: string;
  serviceMode: string | null;
  activeChannels: number | null;
  activeSubscribers: number | null;
  pollIntervalMs: number | null;
}

interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

interface CachedApiRequestOptions extends ApiRequestOptions {
  cacheKey: string;
  ttlMs: number;
  forceFresh?: boolean;
}

const hotApiCache = new Map<string, { expiresAt: number; value: unknown }>();
const hotApiInFlight = new Map<string, Promise<unknown>>();
let hotApiSessionUsername: string | null = null;
let hotApiSessionPromise: Promise<string | null> | null = null;
const realtimeCoreBaseUrl = String(import.meta.env.VITE_REALTIME_CORE_URL || "").trim().replace(/\/$/, "");
let realtimeCoreBridgeTokenCache: { token: string; expiresAt: number } | null = null;
let realtimeCoreBridgeTokenInFlight: Promise<string> | null = null;
let realtimeCoreModeCache: { mode: RealtimeCoreRuntimeMode; expiresAt: number } | null = null;
let realtimeCoreModeInFlight: Promise<RealtimeCoreRuntimeMode> | null = null;

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers || {});
  if (requestOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = timeoutMs && controller
    ? window.setTimeout(() => controller.abort(new DOMException("La solicitud tardó demasiado.", "AbortError")), timeoutMs)
    : null;

  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...requestOptions,
      headers,
      signal: controller?.signal || requestOptions.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "No se pudo completar la solicitud");
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La operación tardó demasiado. Inténtalo otra vez en unos segundos.");
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function cachedApiRequest<T>(path: string, options: CachedApiRequestOptions): Promise<T> {
  const { cacheKey, ttlMs, forceFresh = false, ...requestOptions } = options;
  const sessionUsername = await ensureHotApiCacheSessionContext();
  const scopedCacheKey = buildSessionScopedCacheKey(cacheKey, sessionUsername);
  const now = Date.now();

  if (!forceFresh) {
    const cached = hotApiCache.get(scopedCacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }

    const inFlight = hotApiInFlight.get(scopedCacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const request = apiRequest<T>(path, requestOptions)
    .then((value) => {
      hotApiCache.set(scopedCacheKey, { expiresAt: Date.now() + ttlMs, value });
      hotApiInFlight.delete(scopedCacheKey);
      return value;
    })
    .catch((error) => {
      hotApiInFlight.delete(scopedCacheKey);
      throw error;
    });

  hotApiInFlight.set(scopedCacheKey, request);
  return request;
}

function invalidateHotApiCache(...keys: string[]) {
  if (!keys.length) {
    hotApiCache.clear();
    hotApiInFlight.clear();
    return;
  }

  keys.forEach((key) => {
    const prefix = `${key}:`;
    Array.from(hotApiCache.keys())
      .filter((entry) => entry === key || entry.startsWith(prefix))
      .forEach((entry) => {
        hotApiCache.delete(entry);
      });
    Array.from(hotApiInFlight.keys())
      .filter((entry) => entry === key || entry.startsWith(prefix))
      .forEach((entry) => {
        hotApiInFlight.delete(entry);
      });
  });
}

function normalizeSessionUsername(value: unknown) {
  return String(value || "").trim().toLowerCase() || null;
}

function buildSessionScopedCacheKey(cacheKey: string, username: string | null) {
  return `${cacheKey}:${username || "guest"}`;
}

async function resolveHotApiSessionUsername() {
  if (hotApiSessionPromise) {
    return hotApiSessionPromise;
  }

  hotApiSessionPromise = apiRequest<{ user: UserSession }>("/api/auth/session", {
    timeoutMs: 5_000,
  })
    .then((payload) => normalizeSessionUsername(payload.user?.username))
    .catch(() => null)
    .finally(() => {
      hotApiSessionPromise = null;
    });

  return hotApiSessionPromise;
}

async function ensureHotApiCacheSessionContext() {
  const nextUsername = await resolveHotApiSessionUsername();
  if (hotApiSessionUsername === nextUsername) {
    return nextUsername;
  }

  hotApiSessionUsername = nextUsername;
  invalidateHotApiCache();
  return nextUsername;
}

async function getRealtimeCoreBridgeToken() {
  if (!realtimeCoreBaseUrl) return "";

  const now = Date.now();
  if (realtimeCoreBridgeTokenCache && realtimeCoreBridgeTokenCache.expiresAt - now > 30_000) {
    return realtimeCoreBridgeTokenCache.token;
  }

  if (realtimeCoreBridgeTokenInFlight) {
    return realtimeCoreBridgeTokenInFlight;
  }

  realtimeCoreBridgeTokenInFlight = apiRequest<{ token: string; expiresAt: string }>("/api/realtime/session", {
    timeoutMs: 10_000,
  })
    .then((payload) => {
      const expiresAt = new Date(payload.expiresAt).getTime();
      realtimeCoreBridgeTokenCache = {
        token: payload.token,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 10 * 60_000,
      };
      realtimeCoreBridgeTokenInFlight = null;
      return payload.token;
    })
    .catch((error) => {
      realtimeCoreBridgeTokenInFlight = null;
      throw error;
    });

  return realtimeCoreBridgeTokenInFlight;
}

async function requestExternalRealtimeCoreHealth() {
  if (!realtimeCoreBaseUrl || typeof fetch !== "function") return null;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 4_000) : null;

  try {
    const response = await fetch(`${realtimeCoreBaseUrl}/health`, {
      method: "GET",
      credentials: "omit",
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload as RealtimeCoreHealthPayload | null;
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

function buildRealtimeCoreRuntimeState(activeMode: RealtimeCoreRuntimeMode, healthy: boolean): RealtimeCoreRuntimeState {
  let targetLabel = "Vercel interno";
  if (realtimeCoreBaseUrl) {
    try {
      targetLabel = new URL(realtimeCoreBaseUrl).host || realtimeCoreBaseUrl;
    } catch {
      targetLabel = realtimeCoreBaseUrl;
    }
  }
  return {
    configured: Boolean(realtimeCoreBaseUrl),
    preferredMode: realtimeCoreBaseUrl ? "external" : "serverless",
    activeMode,
    healthy,
    targetLabel,
    serviceMode: activeMode === "external" ? "unknown" : "serverless-fallback",
    activeChannels: null,
    activeSubscribers: null,
    pollIntervalMs: null,
  };
}

function buildRealtimeCoreRuntimeStateFromHealth(payload: RealtimeCoreHealthPayload | null): RealtimeCoreRuntimeState {
  const base = buildRealtimeCoreRuntimeState(payload?.ok ? "external" : "serverless", Boolean(payload?.ok));
  return {
    ...base,
    serviceMode: payload?.mode || base.serviceMode,
    activeChannels: typeof payload?.activeChannels === "number" ? payload.activeChannels : null,
    activeSubscribers: typeof payload?.activeSubscribers === "number" ? payload.activeSubscribers : null,
    pollIntervalMs: typeof payload?.pollIntervalMs === "number" ? payload.pollIntervalMs : null,
  };
}

function hasUsefulRealtimeBootstrap(payload: RealtimeCoreBootstrapPayload | null) {
  if (!payload?.system) return false;

  const portfolioPayload = payload.system.portfolio as (PortfolioPayload & { connectionIssue?: string }) | null;
  const connectionConnected = Boolean(payload.system.connection?.connected);
  const portfolioTotal = Number(portfolioPayload?.portfolio?.totalValue || 0);
  const topAssetsCount = Array.isArray(payload.system.dashboardSummary?.topAssets)
    ? payload.system.dashboardSummary.topAssets.length
    : 0;
  const recentOrdersCount = Array.isArray(payload.system.dashboardSummary?.execution?.recentOrders)
    ? payload.system.dashboardSummary.execution.recentOrders.length
    : 0;
  const hasUpstreamIssue = Boolean(
    portfolioPayload?.connectionIssue
    || payload.system.dashboardSummary?.connectionIssue,
  );

  // The external core is only valid for first paint when it can produce actual
  // account state, not just a technically healthy response envelope.
  return !hasUpstreamIssue && (portfolioTotal > 0 || topAssetsCount > 0 || recentOrdersCount > 0 || connectionConnected);
}

async function resolveRealtimeCoreMode(forceFresh = false): Promise<RealtimeCoreRuntimeMode> {
  if (!realtimeCoreBaseUrl) return "serverless";

  const now = Date.now();
  if (!forceFresh && realtimeCoreModeCache && realtimeCoreModeCache.expiresAt > now) {
    return realtimeCoreModeCache.mode;
  }

  if (!forceFresh && realtimeCoreModeInFlight) {
    return realtimeCoreModeInFlight;
  }

  realtimeCoreModeInFlight = requestExternalRealtimeCoreHealth()
    .then((payload) => {
      const mode = payload?.ok ? "external" : "serverless";
      realtimeCoreModeCache = {
        mode,
        expiresAt: Date.now() + (mode === "external" ? 15_000 : 8_000),
      };
      realtimeCoreModeInFlight = null;
      return mode;
    })
    .catch(() => {
      realtimeCoreModeCache = {
        mode: "serverless",
        expiresAt: Date.now() + 8_000,
      };
      realtimeCoreModeInFlight = null;
      return "serverless";
    });

  return realtimeCoreModeInFlight;
}

async function buildRealtimeCoreBootstrapPath(coin: string, timeframe: string, period: string) {
  const params = new URLSearchParams({
    coin,
    timeframe,
    period,
  });
  const mode = await resolveRealtimeCoreMode();

  if (mode === "external") {
    const token = await getRealtimeCoreBridgeToken();
    params.set("token", token);
    return {
      mode,
      path: `${realtimeCoreBaseUrl}/bootstrap?${params.toString()}`,
    };
  }

  return {
    mode,
    path: `/api/realtime/bootstrap?${params.toString()}`,
  };
}

async function buildRealtimeCoreEventsPath(options: { intervalMs?: number } = {}) {
  const params = new URLSearchParams();
  if (options.intervalMs) {
    params.set("intervalMs", String(options.intervalMs));
  }

  const mode = await resolveRealtimeCoreMode();
  if (mode === "external") {
    const token = await getRealtimeCoreBridgeToken();
    params.set("token", token);
    return {
      mode,
      path: `${realtimeCoreBaseUrl}/events${params.toString() ? `?${params.toString()}` : ""}`,
    };
  }

  return {
    mode,
    path: `/api/realtime/events${params.toString() ? `?${params.toString()}` : ""}`,
  };
}

function attachRealtimeCoreEventSource(
  eventsPath: string,
  onEvent: (event: RealtimeCoreEventEnvelope) => void,
  options: {
    onFatalError?: () => void;
  } = {},
) {
  const source = new EventSource(eventsPath, {
    withCredentials: !eventsPath.startsWith("http"),
  });

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(event.data) as RealtimeCoreEventEnvelope);
    } catch {
      // ignore malformed event frames
    }
  };

  const handleError = () => {
    options.onFatalError?.();
  };

  source.addEventListener("system.overlay.updated", handleMessage as EventListener);
  source.addEventListener("system.heartbeat", handleMessage as EventListener);
  source.addEventListener("error", handleError as EventListener);

  return () => {
    source.removeEventListener("system.overlay.updated", handleMessage as EventListener);
    source.removeEventListener("system.heartbeat", handleMessage as EventListener);
    source.removeEventListener("error", handleError as EventListener);
    source.close();
  };
}

const marketCache = {
  candles: new Map<string, { expiresAt: number; value: unknown }>(),
  ticker24h: new Map<string, { expiresAt: number; value: unknown }>(),
  symbols: { expiresAt: 0, value: [] as string[] },
};

const marketInFlight = {
  candles: new Map<string, Promise<unknown>>(),
  ticker24h: new Map<string, Promise<unknown>>(),
  symbols: null as Promise<string[]> | null,
};

async function fetchCachedMarketResource<T>({
  cache,
  inflight,
  key,
  ttlMs,
  loader,
}: {
  cache: Map<string, { expiresAt: number; value: unknown }>;
  inflight: Map<string, Promise<unknown>>;
  key: string;
  ttlMs: number;
  loader: () => Promise<T>;
}): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const currentRequest = inflight.get(key);
  if (currentRequest) {
    return currentRequest as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      cache.set(key, { expiresAt: Date.now() + ttlMs, value });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request);
  return request;
}

export const authService = {
  login(username: string, password: string) {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  register(displayName: string, email: string, password: string) {
    return apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password }),
    });
  },
  logout() {
    return apiRequest("/api/auth/logout", { method: "POST" });
  },
  async getSession() {
    try {
      const payload = await apiRequest<{ user: UserSession }>("/api/auth/session", {
        timeoutMs: 8_000,
      });
      return payload.user;
    } catch {
      return null;
    }
  },
  async getUsers() {
    const payload = await apiRequest<{ users: UserSession[] }>("/api/users");
    return payload.users;
  },
};

export const binanceService = {
  getConnection() {
    return apiRequest<BinanceConnection>("/api/binance/connection");
  },
  getPortfolio(period: string, mode: "full" | "live" = "full") {
    return apiRequest<PortfolioPayload>(`/api/binance/portfolio?period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}`);
  },
  connect(apiKey: string, apiSecret: string, accountAlias: string) {
    return apiRequest("/api/binance/connection", {
      method: "POST",
      body: JSON.stringify({ apiKey, apiSecret, accountAlias }),
    });
  },
  disconnect() {
    return apiRequest("/api/binance/connection", { method: "DELETE" });
  },
  getExecutionCenter() {
    return apiRequest<ExecutionCenterPayload>("/api/binance/execution");
  },
  getDashboardSummary(forceFresh = false) {
    return cachedApiRequest<DashboardSummaryPayload>("/api/binance/dashboard-summary", {
      cacheKey: "binance:dashboard-summary",
      ttlMs: 8_000,
      forceFresh,
    });
  },
  updateExecutionProfile(profile: Partial<ExecutionProfile>) {
    return apiRequest<{ profile: ExecutionProfile }>("/api/binance/execution", {
      method: "PATCH",
      body: JSON.stringify(profile),
    });
  },
  executeSignal(
    signalId: number,
    mode: "preview" | "execute",
    options: {
      botId?: string | null;
      botName?: string | null;
      origin?: string | null;
    } = {},
  ) {
    return apiRequest("/api/binance/execution", {
      method: "POST",
      body: JSON.stringify({
        signalId,
        mode,
        botId: options.botId || null,
        botName: options.botName || null,
        origin: options.origin || null,
      }),
    });
  },
  attachProtection(executionOrderId: number) {
    return apiRequest("/api/binance/execution", {
      method: "POST",
      body: JSON.stringify({ action: "attachProtection", executionOrderId }),
    });
  },
};

export const signalService = {
  list() {
    return apiRequest<{ signals: SignalSnapshot[] }>("/api/signals");
  },
  create(payload: {
    coin: string;
    timeframe: string;
    signal: Signal;
    analysis: DashboardAnalysis | null;
    plan: OperationPlan | null;
    multiTimeframes: TimeframeSignal[];
    strategy?: StrategyDescriptor;
    strategyCandidates?: StrategyCandidate[];
    note?: string;
  }) {
    return apiRequest<{ signal: SignalSnapshot }>("/api/signals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: number, payload: { outcomeStatus: SignalOutcomeStatus; outcomePnl: number; note: string }) {
    return apiRequest<{ signal: SignalSnapshot }>(`/api/signals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export const botService = {
  list() {
    return apiRequest<{ bots: Bot[]; lastHydratedAt: string | null }>("/api/bots");
  },
  create(payload: Partial<Bot> & { name?: string }) {
    return apiRequest<{ bot: Bot }>("/api/bots", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<Bot>) {
    return apiRequest<{ bot: Bot }>(`/api/bots/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export const botDecisionService = {
  list(options: { botId?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.botId) params.set("botId", options.botId);
    if (typeof options.limit === "number") params.set("limit", String(options.limit));
    const query = params.toString();
    return apiRequest<{ decisions: BotDecisionRecord[]; lastHydratedAt: string | null }>(
      `/api/bot-decisions${query ? `?${query}` : ""}`,
    );
  },
  create(payload: BotDecisionRecord) {
    return apiRequest<{ decision: BotDecisionRecord }>("/api/bot-decisions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<BotDecisionRecord>) {
    return apiRequest<{ decision: BotDecisionRecord }>(`/api/bot-decisions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};

export const strategyEngineService = {
  list(options: { forceFresh?: boolean } = {}) {
    return cachedApiRequest<{
      registry: StrategyRegistryEntry[];
      versions: StrategyVersionRecord[];
      experiments: StrategyExperimentRecord[];
      recommendations: StrategyRecommendationRecord[];
      decision: StrategyDecisionState;
    }>("/api/strategy-engine", {
      cacheKey: "strategy-engine:list",
      ttlMs: 15_000,
      forceFresh: options.forceFresh,
    });
  },
  listRecommendations(options: { forceFresh?: boolean } = {}) {
    return cachedApiRequest<{ recommendations: StrategyRecommendationRecord[] }>("/api/strategy-engine/recommendations", {
      cacheKey: "strategy-engine:recommendations",
      ttlMs: 20_000,
      forceFresh: options.forceFresh,
    });
  },
  getValidationLab(options: { forceFresh?: boolean } = {}) {
    return cachedApiRequest<StrategyValidationLabPayload>("/api/strategy-engine/backtest", {
      cacheKey: "strategy-engine:validation-lab",
      ttlMs: 20_000,
      forceFresh: options.forceFresh,
    });
  },
  runValidationBacktest(payload?: { label?: string; triggerSource?: string }) {
    invalidateHotApiCache("strategy-engine:validation-lab");
    return apiRequest<StrategyValidationLabPayload>("/api/strategy-engine/backtest", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  processValidationBacktestQueue(payload?: { limit?: number; triggerSource?: string }) {
    invalidateHotApiCache("strategy-engine:validation-lab");
    return apiRequest<StrategyValidationLabPayload>("/api/strategy-engine/backtest", {
      method: "POST",
      body: JSON.stringify({
        action: "processQueue",
        ...(payload || {}),
      }),
    });
  },
  backfillValidationDataset(payload?: { label?: string; triggerSource?: string; limit?: number }) {
    invalidateHotApiCache("strategy-engine:validation-lab");
    return apiRequest<StrategyValidationLabPayload>("/api/strategy-engine/backtest", {
      method: "POST",
      body: JSON.stringify({
        action: "backfillDataset",
        ...(payload || {}),
      }),
    });
  },
  getValidationReport() {
    return apiRequest<StrategyValidationReport>("/api/strategy-engine/backtest").then((payload) => {
      const maybeLab = payload as unknown as StrategyValidationLabPayload;
      return maybeLab.report || (payload as StrategyValidationReport);
    });
  },
  generateRecommendations() {
    invalidateHotApiCache("strategy-engine:list", "strategy-engine:recommendations");
    return apiRequest<{ recommendations: StrategyRecommendationRecord[] }>("/api/strategy-engine/recommendations", {
      method: "POST",
    });
  },
  activateRecommendation(recommendationId: number) {
    invalidateHotApiCache("strategy-engine:list", "strategy-engine:recommendations");
    return apiRequest<RecommendationActivationResult>("/api/strategy-engine/recommendations", {
      method: "PATCH",
      body: JSON.stringify({ recommendationId }),
    });
  },
  createExperiment(payload: {
    baseStrategyId: string;
    candidateStrategyId: string;
    candidateVersion: string;
    marketScope?: string;
    timeframeScope?: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }) {
    return apiRequest<{ experiment: StrategyExperimentRecord }>("/api/strategy-engine", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateExperiment(id: number, payload: { status?: string; summary?: string; metadata?: Record<string, unknown> }) {
    invalidateHotApiCache("strategy-engine:list", "strategy-engine:recommendations");
    return apiRequest<{ experiment: StrategyExperimentRecord }>("/api/strategy-engine", {
      method: "PATCH",
      body: JSON.stringify({ id, ...payload }),
    });
  },
  promoteExperiment(id: number) {
    invalidateHotApiCache("strategy-engine:list", "strategy-engine:recommendations");
    return apiRequest<{ experiment: StrategyExperimentRecord }>("/api/strategy-engine", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "promote" }),
    });
  },
};

export const watchlistService = {
  list() {
    return apiRequest<{ lists: WatchlistGroup[]; activeListName: string | null }>("/api/watchlist");
  },
  replace(listName: string, coins: string[]) {
    return apiRequest<{ lists: WatchlistGroup[]; activeListName: string | null }>("/api/watchlist", {
      method: "PUT",
      body: JSON.stringify({ listName, coins }),
    });
  },
  createList(name: string) {
    return apiRequest<{ lists: WatchlistGroup[]; activeListName: string | null }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  updateList(name: string, payload: { nextName?: string; isActive?: boolean }) {
    return apiRequest<{ lists: WatchlistGroup[]; activeListName: string | null }>("/api/watchlist", {
      method: "PATCH",
      body: JSON.stringify({ name, ...payload }),
    });
  },
  deleteList(name: string) {
    return apiRequest<{ lists: WatchlistGroup[]; activeListName: string | null }>("/api/watchlist", {
      method: "DELETE",
      body: JSON.stringify({ name }),
    });
  },
  scanStatus(options: { forceFresh?: boolean } = {}) {
    return cachedApiRequest<WatchlistScannerStatus>("/api/watchlist/scan", {
      cacheKey: "watchlist:scan-status",
      ttlMs: 12_000,
      forceFresh: options.forceFresh,
    });
  },
  runScan() {
    invalidateHotApiCache("watchlist:scan-status");
    return apiRequest<WatchlistScanExecution>("/api/watchlist/scan", {
      method: "POST",
      timeoutMs: 55_000,
    });
  },
};

export interface MarketTicker {
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
}

export interface MarketTickerStreamPayload {
  c?: string;
  P?: string;
  h?: string;
  l?: string;
  v?: string;
}

export interface MarketKlineStreamPayload {
  k?: {
    t?: number;
    T?: number;
    i?: string;
    o?: string;
    c?: string;
    h?: string;
    l?: string;
    v?: string;
    x?: boolean;
  };
}

function openBinanceStream<T>(streamPath: string, onMessage: (payload: T) => void) {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let manuallyClosed = false;
  let retryCount = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (manuallyClosed) return;

    try {
      socket = new WebSocket(`wss://stream.binance.com:9443/ws/${streamPath}`);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      retryCount = 0;
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as T;
        onMessage(payload);
      } catch {
        // ignore malformed frames
      }
    };

    socket.onerror = () => {
      try {
        socket?.close();
      } catch {
        // ignore close errors
      }
    };

    socket.onclose = () => {
      socket = null;
      if (!manuallyClosed) {
        scheduleReconnect();
      }
    };
  };

  const scheduleReconnect = () => {
    clearReconnectTimer();
    const delay = Math.min(8_000, 1_000 * 2 ** retryCount);
    retryCount += 1;
    reconnectTimer = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const handleVisibility = () => {
    if (manuallyClosed) return;
    if (document.visibilityState === "visible" && !socket) {
      clearReconnectTimer();
      connect();
    }
  };

  connect();
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    manuallyClosed = true;
    clearReconnectTimer();
    document.removeEventListener("visibilitychange", handleVisibility);
    try {
      socket?.close();
    } catch {
      // ignore close errors
    }
  };
}

function openMultiBinanceStreams<T>(streamPaths: string[], onMessage: (payload: T, streamPath: string) => void) {
  const closers = streamPaths.map((streamPath) => openBinanceStream<T>(streamPath, (payload) => onMessage(payload, streamPath)));
  return () => {
    closers.forEach((close) => close());
  };
}

export interface ExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

export const marketService = {
  async fetchCandles(symbol: string, timeframe: string) {
    const cacheKey = `${symbol}:${timeframe}`;
    try {
      return await fetchCachedMarketResource({
        cache: marketCache.candles,
        inflight: marketInFlight.candles,
        key: cacheKey,
        ttlMs: 15_000,
        loader: async () => {
          const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol.replace("/", "")}&interval=${timeframe}&limit=80`,
          );
          const data = await response.json();
          return data.map((d: string[]) => ({
            time: Number(d[0]) / 1000,
            open: Number(d[1]),
            high: Number(d[2]),
            low: Number(d[3]),
            close: Number(d[4]),
            volume: Number(d[5]),
          }));
        },
      });
    } catch {
      return null;
    }
  },
  async fetch24h(symbol: string): Promise<MarketTicker> {
    try {
      return await fetchCachedMarketResource({
        cache: marketCache.ticker24h,
        inflight: marketInFlight.ticker24h,
        key: symbol,
        ttlMs: 10_000,
        loader: async () => {
          const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.replace("/", "")}`);
          return response.json();
        },
      });
    } catch {
      return {
        lastPrice: "70000",
        priceChangePercent: "-1.00",
        highPrice: "71000",
        lowPrice: "69000",
        volume: "25000",
      };
    }
  },
  async fetchSymbols(): Promise<string[]> {
    const now = Date.now();
    if (marketCache.symbols.expiresAt > now && marketCache.symbols.value.length) {
      return marketCache.symbols.value;
    }

    if (marketInFlight.symbols) {
      return marketInFlight.symbols;
    }

    marketInFlight.symbols = (async () => {
      try {
        const response = await fetch("https://api.binance.com/api/v3/exchangeInfo");
        const data = await response.json();
        const symbols = Array.isArray(data?.symbols) ? (data.symbols as ExchangeSymbol[]) : [];
        const nextSymbols = symbols
          .filter((item) => item.status === "TRADING" && item.quoteAsset === "USDT")
          .map((item) => `${item.baseAsset}/${item.quoteAsset}`);
        marketCache.symbols = {
          expiresAt: Date.now() + 30 * 60_000,
          value: nextSymbols,
        };
        return nextSymbols;
      } catch {
        return [];
      } finally {
        marketInFlight.symbols = null;
      }
    })();

    return marketInFlight.symbols;
  },
  openTickerStream(symbol: string, onMessage: (payload: MarketTickerStreamPayload) => void) {
    return openBinanceStream<MarketTickerStreamPayload>(`${symbol.replace("/", "").toLowerCase()}@ticker`, onMessage);
  },
  openKlineStream(symbol: string, timeframe: string, onMessage: (payload: MarketKlineStreamPayload) => void) {
    return openBinanceStream<MarketKlineStreamPayload>(`${symbol.replace("/", "").toLowerCase()}@kline_${timeframe}`, onMessage);
  },
  openComparisonStream(symbols: string[], onMessage: (symbol: string, payload: MarketTickerStreamPayload) => void) {
    const streamPaths = symbols.map((symbol) => `${symbol.replace("/", "").toLowerCase()}@ticker`);
    return openMultiBinanceStreams<MarketTickerStreamPayload>(streamPaths, (payload, streamPath) => {
      const rawSymbol = streamPath.split("@")[0].toUpperCase();
      const symbol = rawSymbol.endsWith("USDT")
        ? `${rawSymbol.slice(0, -4)}/USDT`
        : rawSymbol;
      onMessage(symbol, payload);
    });
  },
};

export const realtimeCoreService = {
  async getRuntimeStatus(forceFresh = false) {
    if (!realtimeCoreBaseUrl) {
      return buildRealtimeCoreRuntimeState("serverless", true);
    }

    const payload = await requestExternalRealtimeCoreHealth();
    if (payload?.ok) {
      realtimeCoreModeCache = {
        mode: "external",
        expiresAt: Date.now() + 15_000,
      };
      return buildRealtimeCoreRuntimeStateFromHealth(payload);
    }

    realtimeCoreModeCache = {
      mode: "serverless",
      expiresAt: Date.now() + (forceFresh ? 0 : 8_000),
    };
    return buildRealtimeCoreRuntimeState("serverless", false);
  },
  async getBootstrap(
    coin: string,
    timeframe: string,
    period = "1d",
    options: { onRuntimeState?: (state: RealtimeCoreRuntimeState) => void } = {},
  ) {
    let mode: RealtimeCoreRuntimeMode = "serverless";
    let bootstrapPath = `/api/realtime/bootstrap?${new URLSearchParams({
      coin,
      timeframe,
      period,
    }).toString()}`;

    try {
      const resolved = await buildRealtimeCoreBootstrapPath(coin, timeframe, period);
      mode = resolved.mode;
      bootstrapPath = resolved.path;
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState(mode, mode === "external"));
    } catch {
      realtimeCoreModeCache = {
        mode: "serverless",
        expiresAt: Date.now() + 8_000,
      };
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState("serverless", false));
    }

    try {
      const payload = await apiRequest<RealtimeCoreBootstrapPayload>(bootstrapPath, {
        timeoutMs: 15_000,
      });
      if (mode === "external" && !hasUsefulRealtimeBootstrap(payload)) {
        throw new Error("Realtime core bootstrap degradado");
      }
      return payload;
    } catch (error) {
      if (mode !== "external") throw error;
      realtimeCoreModeCache = {
        mode: "serverless",
        expiresAt: Date.now() + 8_000,
      };
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState("serverless", false));
      return apiRequest<RealtimeCoreBootstrapPayload>(`/api/realtime/bootstrap?${new URLSearchParams({
        coin,
        timeframe,
        period,
      }).toString()}`, {
        timeoutMs: 15_000,
      });
    }
  },
  async openSystemEvents(
    onEvent: (event: RealtimeCoreEventEnvelope) => void,
    options: {
      intervalMs?: number;
      onRuntimeState?: (state: RealtimeCoreRuntimeState) => void;
    } = {},
  ) {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return () => undefined;
    }

    let closed = false;
    let closeCurrent = () => {};
    let fallbackUsed = false;

    const openFallback = () => {
      if (closed || fallbackUsed) return;
      fallbackUsed = true;
      realtimeCoreModeCache = {
        mode: "serverless",
        expiresAt: Date.now() + 8_000,
      };
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState("serverless", false));
      closeCurrent = attachRealtimeCoreEventSource(
        `/api/realtime/events${options.intervalMs ? `?intervalMs=${encodeURIComponent(String(options.intervalMs))}` : ""}`,
        onEvent,
      );
    };

    let mode: RealtimeCoreRuntimeMode = "serverless";
    let eventsPath = `/api/realtime/events${options.intervalMs ? `?intervalMs=${encodeURIComponent(String(options.intervalMs))}` : ""}`;

    try {
      const resolved = await buildRealtimeCoreEventsPath(options);
      mode = resolved.mode;
      eventsPath = resolved.path;
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState(mode, mode === "external"));
    } catch {
      realtimeCoreModeCache = {
        mode: "serverless",
        expiresAt: Date.now() + 8_000,
      };
      options.onRuntimeState?.(buildRealtimeCoreRuntimeState("serverless", false));
    }

    closeCurrent = attachRealtimeCoreEventSource(eventsPath, onEvent, {
      onFatalError: mode === "external" ? () => {
        closeCurrent();
        openFallback();
      } : undefined,
    });

    return () => {
      closed = true;
      closeCurrent();
    };
  },
};
