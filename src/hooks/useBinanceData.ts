import { useCallback, useEffect, useState } from "react";
import { authService, binanceService } from "../services/api";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
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
      return connection;
    } catch {
      // keep current UI state
      return null;
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
    const loaderId = startLoading({ label: "Conectando Binance Demo", detail: binanceForm.alias.trim() || "Nueva conexión" });
    try {
      await binanceService.connect(binanceForm.apiKey.trim(), binanceForm.apiSecret.trim(), binanceForm.alias.trim());
      setBinanceForm((prev) => ({ ...prev, apiSecret: "" }));
      await refreshProfileData();
      if (currentView === "balance") {
        await refreshPortfolio();
      }
      showToast({
        tone: "success",
        title: "Binance Demo conectado",
        message: "La cuenta de prueba ya quedó lista para balance, señales y ejecución demo.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo conectar Binance Demo",
        message: error instanceof Error ? error.message : "Revisa las credenciales y vuelve a intentarlo.",
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [binanceForm, currentView, refreshPortfolio, refreshProfileData]);

  const disconnect = useCallback(async () => {
    const loaderId = startLoading({ label: "Desconectando Binance Demo", detail: "Cerrando acceso de cuenta" });
    try {
      await binanceService.disconnect();
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      await refreshProfileData();
      if (currentView === "balance") {
        await refreshPortfolio();
      }
      showToast({
        tone: "warning",
        title: "Binance Demo desconectado",
        message: "El sistema dejó de usar la cuenta de prueba hasta que vuelvas a conectarla.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo desconectar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez en unos segundos.",
      });
    } finally {
      stopLoading(loaderId);
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

    void (async () => {
      const connection = await refreshProfileData();
      if (connection?.connected) {
        await refreshPortfolio();
      } else if (currentView === "balance") {
        await refreshPortfolio();
      }
    })();
  }, [currentUser, currentView, refreshPortfolio, refreshProfileData]);

  useEffect(() => {
    if (!currentUser || !binanceConnection?.connected) return undefined;

    const refreshInterval =
      currentView === "balance"
        ? 30_000
        : currentView === "dashboard"
          ? 60_000
          : 90_000;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshPortfolio();
    }, refreshInterval);

    return () => window.clearInterval(intervalId);
  }, [binanceConnection?.connected, currentUser, currentView, refreshPortfolio]);

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
