import { useCallback, useEffect, useState } from "react";
import { authService, binanceService } from "../services/api";
import type { BinanceConnection, PortfolioPayload, UserSession, ViewName } from "../types";

interface BinanceFormState {
  alias: string;
  apiKey: string;
  apiSecret: string;
}

interface UseBinanceDataOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

export function useBinanceData({ currentUser, currentView }: UseBinanceDataOptions) {
  const [binanceConnection, setBinanceConnection] = useState<BinanceConnection | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioPayload | null>(null);
  const [portfolioPeriod, setPortfolioPeriod] = useState("1d");
  const [availableUsers, setAvailableUsers] = useState<UserSession[]>([]);
  const [hideSmallAssets, setHideSmallAssets] = useState(true);
  const [binanceForm, setBinanceForm] = useState<BinanceFormState>({ alias: "", apiKey: "", apiSecret: "" });

  const refreshProfileData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [connection, users] = await Promise.all([
        binanceService.getConnection().catch(() => null),
        currentUser.role === "admin" ? authService.getUsers().catch(() => []) : Promise.resolve([]),
      ]);
      setBinanceConnection(connection);
      setAvailableUsers(users);
      if (connection?.accountAlias) {
        setBinanceForm((prev) => ({ ...prev, alias: connection.accountAlias || "" }));
      }
    } catch {
      // keep current UI state
    }
  }, [currentUser]);

  const refreshPortfolio = useCallback(async (period = portfolioPeriod) => {
    try {
      const payload = await binanceService.getPortfolio(period);
      setPortfolioData(payload);
      setPortfolioPeriod(period);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el balance.";
      setPortfolioData({
        assets: [],
        portfolio: {
          period,
          totalValue: 0,
          periodChangeValue: 0,
          periodChangePct: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          totalPnl: 0,
          winnersCount: 0,
          openPositionsCount: 0,
          cashValue: 0,
          positionsValue: 0,
          investedValue: 0,
        },
        summary: { accountType: message },
      });
      setPortfolioPeriod(period);
    }
  }, [portfolioPeriod]);

  const connect = useCallback(async () => {
    try {
      await binanceService.connect(binanceForm.apiKey.trim(), binanceForm.apiSecret.trim(), binanceForm.alias.trim());
      setBinanceForm((prev) => ({ ...prev, apiSecret: "" }));
      await refreshProfileData();
      if (currentView === "balance") {
        await refreshPortfolio();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo conectar Binance Demo Spot");
    }
  }, [binanceForm, currentView, refreshPortfolio, refreshProfileData]);

  const disconnect = useCallback(async () => {
    try {
      await binanceService.disconnect();
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      await refreshProfileData();
      if (currentView === "balance") {
        await refreshPortfolio();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo desconectar Binance Demo Spot");
    }
  }, [currentView, refreshPortfolio, refreshProfileData]);

  useEffect(() => {
    if (!currentUser) {
      setBinanceConnection(null);
      setPortfolioData(null);
      setAvailableUsers([]);
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      return;
    }

    if (currentView === "profile") {
      void refreshProfileData();
    }

    if (currentView === "balance") {
      void refreshPortfolio();
    }
  }, [currentUser, currentView, refreshPortfolio, refreshProfileData]);

  return {
    binanceConnection,
    portfolioData,
    portfolioPeriod,
    availableUsers,
    hideSmallAssets,
    binanceForm,
    setHideSmallAssets,
    setBinanceFormField(field: keyof BinanceFormState, value: string) {
      setBinanceForm((prev) => ({ ...prev, [field]: value }));
    },
    refreshProfileData,
    refreshPortfolio,
    connect,
    disconnect,
  };
}
