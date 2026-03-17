import type {
  BinanceConnection,
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
  StrategyDescriptor,
  StrategyExperimentRecord,
  StrategyRegistryEntry,
  StrategyRecommendationRecord,
  StrategyVersionRecord,
  TimeframeSignal,
  UserSession,
  WatchlistGroup,
  WatchlistScanExecution,
  WatchlistScannerStatus,
} from "../types";

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "No se pudo completar la solicitud");
  }

  return payload as T;
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
  getPortfolio(period: string) {
    return apiRequest<PortfolioPayload>(`/api/binance/portfolio?period=${encodeURIComponent(period)}`);
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
  list() {
    return apiRequest<{
      registry: StrategyRegistryEntry[];
      versions: StrategyVersionRecord[];
      experiments: StrategyExperimentRecord[];
      recommendations: StrategyRecommendationRecord[];
    }>("/api/strategy-engine");
  },
  listRecommendations() {
    return apiRequest<{ recommendations: StrategyRecommendationRecord[] }>("/api/strategy-engine/recommendations");
  },
  generateRecommendations() {
    return apiRequest<{ recommendations: StrategyRecommendationRecord[] }>("/api/strategy-engine/recommendations", {
      method: "POST",
    });
  },
  activateRecommendation(recommendationId: number) {
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
    return apiRequest<{ experiment: StrategyExperimentRecord }>("/api/strategy-engine", {
      method: "PATCH",
      body: JSON.stringify({ id, ...payload }),
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
  scanStatus() {
    return apiRequest<WatchlistScannerStatus>("/api/watchlist/scan");
  },
  runScan() {
    return apiRequest<WatchlistScanExecution>("/api/watchlist/scan", {
      method: "POST",
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

export interface ExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

export const marketService = {
  async fetchCandles(symbol: string, timeframe: string) {
    try {
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
    } catch {
      return null;
    }
  },
  async fetch24h(symbol: string): Promise<MarketTicker> {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.replace("/", "")}`);
      return await response.json();
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
    try {
      const response = await fetch("https://api.binance.com/api/v3/exchangeInfo");
      const data = await response.json();
      const symbols = Array.isArray(data?.symbols) ? (data.symbols as ExchangeSymbol[]) : [];
      return symbols
        .filter((item) => item.status === "TRADING" && item.quoteAsset === "USDT")
        .map((item) => `${item.baseAsset}/${item.quoteAsset}`);
    } catch {
      return [];
    }
  },
  openTickerStream(symbol: string, onMessage: (payload: MarketTickerStreamPayload) => void) {
    return openBinanceStream<MarketTickerStreamPayload>(`${symbol.replace("/", "").toLowerCase()}@ticker`, onMessage);
  },
  openKlineStream(symbol: string, timeframe: string, onMessage: (payload: MarketKlineStreamPayload) => void) {
    return openBinanceStream<MarketKlineStreamPayload>(`${symbol.replace("/", "").toLowerCase()}@kline_${timeframe}`, onMessage);
  },
};
