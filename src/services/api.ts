import type { BinanceConnection, PortfolioPayload, UserSession } from "../types";

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
};

export interface MarketTicker {
  lastPrice?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
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
};
