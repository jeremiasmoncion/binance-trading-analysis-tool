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
  const now = Date.now();

  if (!forceFresh) {
    const cached = hotApiCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }

    const inFlight = hotApiInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const request = apiRequest<T>(path, requestOptions)
    .then((value) => {
      hotApiCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
      hotApiInFlight.delete(cacheKey);
      return value;
    })
    .catch((error) => {
      hotApiInFlight.delete(cacheKey);
      throw error;
    });

  hotApiInFlight.set(cacheKey, request);
  return request;
}

function invalidateHotApiCache(...keys: string[]) {
  keys.forEach((key) => {
    hotApiCache.delete(key);
    hotApiInFlight.delete(key);
  });
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
      const payload = await apiRequest<{ user: UserSession }>("/api/auth/session");
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
  executeSignal(signalId: number, mode: "preview" | "execute") {
    return apiRequest("/api/binance/execution", {
      method: "POST",
      body: JSON.stringify({ signalId, mode }),
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
