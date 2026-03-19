import { useCallback, useEffect, useRef, useState } from "react";
import { authService, binanceService } from "../services/api";
import { getViewRefreshPolicy } from "../data-platform/refreshPolicy";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type {
  BinanceConnection,
  DashboardSummaryPayload,
  ExecutionCenterPayload,
  ExecutionProfile,
  PortfolioPayload,
  UserSession,
  ViewName,
} from "../types";

interface BinanceFormState {
  alias: string;
  apiKey: string;
  apiSecret: string;
}

interface UseBinanceDataOptions {
  currentUser: UserSession | null;
  currentView: ViewName;
}

interface ConnectedViewLoadPlan {
  portfolioMode: "full" | "live" | null;
  refreshExecution: boolean;
  refreshDashboard: boolean;
}

function mergePortfolioLivePayload(previous: PortfolioPayload | null, live: PortfolioPayload, period: string): PortfolioPayload {
  if (!previous || !previous.assets?.length) {
    return live;
  }

  const previousByAsset = new Map(previous.assets.map((asset) => [asset.asset, asset]));
  const mergedAssets = (live.assets || []).map((asset) => {
    const prev = previousByAsset.get(asset.asset);
    if (!prev) {
      return asset;
    }

    const avgEntryPrice = asset.asset === "USDT" ? 1 : Number(prev.avgEntryPrice || 0);
    const investedValue = avgEntryPrice > 0 ? asset.quantity * avgEntryPrice : asset.marketValue;
    const pnlValue = asset.marketValue - investedValue;
    const pnlPct = investedValue > 0 ? (pnlValue / investedValue) * 100 : 0;

    return {
      ...prev,
      ...asset,
      avgEntryPrice,
      tradeCount: prev.tradeCount || 0,
      realizedPnl: Number(prev.realizedPnl || 0),
      investedValue,
      pnlValue,
      pnlPct: Number(pnlPct.toFixed(2)),
    };
  });

  const totalValue = mergedAssets.reduce((sum, asset) => sum + Number(asset.marketValue || 0), 0);
  const investedValue = mergedAssets.reduce((sum, asset) => sum + Number(asset.investedValue || 0), 0);
  const realizedPnl = mergedAssets.reduce((sum, asset) => sum + Number(asset.realizedPnl || 0), 0);
  const unrealizedPnl = mergedAssets.reduce((sum, asset) => sum + Number(asset.pnlValue || 0), 0);
  const periodChangeValue = mergedAssets.reduce((sum, asset) => sum + Number(asset.periodChangeValue || 0), 0);
  const periodBaseValue = totalValue - periodChangeValue;
  const periodChangePct = periodBaseValue > 0 ? (periodChangeValue / periodBaseValue) * 100 : 0;
  const cashAsset = mergedAssets.find((asset) => asset.asset === "USDT");
  const openPositions = mergedAssets.filter((asset) => asset.asset !== "USDT" && Number(asset.quantity || 0) > 0);
  const hiddenLockedAssets = live.hiddenLockedAssets || previous.hiddenLockedAssets || [];
  const hiddenLockedValue = hiddenLockedAssets.reduce((sum: number, asset) => sum + Number(asset.marketValue || 0), 0);
  const previousPositionsValue = Number(previous.portfolio?.positionsValue || 0);
  const livePositionsValue = Number(live.portfolio?.positionsValue || 0);
  const liveNonCashAssets = mergedAssets.filter((asset) => asset.asset !== "USDT" && Number(asset.marketValue || 0) > 0);

  // Live portfolio mode is intentionally lighter than a full snapshot. If a
  // transient upstream miss suddenly collapses the asset universe down to cash
  // only, preserve the last good snapshot instead of accepting a fake drawdown
  // where totalValue momentarily becomes just the USDT balance.
  if (previousPositionsValue > 0 && liveNonCashAssets.length === 0 && livePositionsValue <= 0) {
    return {
      ...previous,
      ...live,
      snapshotMode: "live",
      assets: previous.assets,
      hiddenLockedAssets,
      portfolio: {
        ...(previous.portfolio || {}),
        ...(live.portfolio || {}),
        period,
        totalValue: Number(previous.portfolio?.totalValue || 0),
        investedValue: Number(previous.portfolio?.investedValue || 0),
        realizedPnl: Number(previous.portfolio?.realizedPnl || 0),
        unrealizedPnl: Number(previous.portfolio?.unrealizedPnl || 0),
        unrealizedPnlPct: Number(previous.portfolio?.unrealizedPnlPct || 0),
        totalPnl: Number(previous.portfolio?.totalPnl || 0),
        periodChangeValue: Number(previous.portfolio?.periodChangeValue || 0),
        periodChangePct: Number(previous.portfolio?.periodChangePct || 0),
        cashValue: Number(live.portfolio?.cashValue || previous.portfolio?.cashValue || 0),
        positionsValue: Number(previous.portfolio?.positionsValue || 0),
        openPositionsCount: Number(previous.portfolio?.openPositionsCount || 0),
        winnersCount: Number(previous.portfolio?.winnersCount || 0),
        hiddenLockedValue,
        hiddenLockedAssetsCount: hiddenLockedAssets.length,
        updatedAt: live.portfolio?.updatedAt || new Date().toISOString(),
      },
    };
  }

  return {
    ...previous,
    ...live,
    snapshotMode: "live",
    assets: mergedAssets,
    accountMovements: previous.accountMovements || live.accountMovements || [],
    recentOrders: previous.recentOrders || live.recentOrders || [],
    recentTrades: previous.recentTrades || live.recentTrades || [],
    openOrders: live.openOrders || previous.openOrders || [],
    portfolio: {
      ...(previous.portfolio || {}),
      ...(live.portfolio || {}),
      period,
      totalValue,
      investedValue,
      realizedPnl,
      unrealizedPnl,
      unrealizedPnlPct: investedValue > 0 ? Number(((unrealizedPnl / investedValue) * 100).toFixed(2)) : 0,
      totalPnl: realizedPnl + unrealizedPnl,
      periodChangeValue,
      periodChangePct: Number(periodChangePct.toFixed(2)),
      cashValue: Number(cashAsset?.marketValue || 0),
      positionsValue: totalValue - Number(cashAsset?.marketValue || 0),
      openPositionsCount: openPositions.length,
      winnersCount: openPositions.filter((asset) => Number(asset.pnlValue || 0) > 0).length,
      hiddenLockedValue,
      hiddenLockedAssetsCount: hiddenLockedAssets.length,
      updatedAt: live.portfolio?.updatedAt || new Date().toISOString(),
    },
  };
}

function buildConnectedViewLoadPlan(view: ViewName, previousView: ViewName, streamEnabled: boolean, portfolioMode: "full" | "live"): ConnectedViewLoadPlan {
  // Keep the remaining view-specific warm-up behavior centralized so the hook
  // can keep shrinking toward refresh-policy-driven orchestration instead of
  // scattering one-off branches across multiple effects.
  if (view === "balance") {
    return {
      portfolioMode: previousView === "balance" ? "live" : "full",
      refreshExecution: false,
      refreshDashboard: false,
    };
  }

  if (view === "memory") {
    return {
      portfolioMode: null,
      refreshExecution: !streamEnabled,
      refreshDashboard: false,
    };
  }

  if (view === "dashboard") {
    return {
      portfolioMode: streamEnabled ? null : portfolioMode,
      refreshExecution: !streamEnabled,
      refreshDashboard: !streamEnabled,
    };
  }

  return {
    portfolioMode: null,
    refreshExecution: false,
    refreshDashboard: false,
  };
}

export function useBinanceData({ currentUser, currentView }: UseBinanceDataOptions) {
  const refreshPolicy = getViewRefreshPolicy(currentView);
  const [binanceConnection, setBinanceConnection] = useState<BinanceConnection | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioPayload | null>(null);
  const [executionCenter, setExecutionCenter] = useState<ExecutionCenterPayload | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryPayload | null>(null);
  const [portfolioPeriod, setPortfolioPeriod] = useState("1d");
  const [availableUsers, setAvailableUsers] = useState<UserSession[]>([]);
  const [hideSmallAssets, setHideSmallAssets] = useState(true);
  const [binanceForm, setBinanceForm] = useState<BinanceFormState>({ alias: "", apiKey: "", apiSecret: "" });
  const activeUsernameRef = useRef("");
  const lastViewRef = useRef(currentView);

  useEffect(() => {
    activeUsernameRef.current = currentUser?.username || "";
  }, [currentUser?.username]);

  const refreshProfileData = useCallback(async () => {
    const username = currentUser?.username || "";
    const role = currentUser?.role || "generic";
    if (!username) {
      return { ok: false as const, connection: null, users: [] as UserSession[], message: "Sesion no disponible." };
    }
    try {
      const [connection, users] = await Promise.all([
        binanceService.getConnection(),
        role === "admin" ? authService.getUsers().catch(() => []) : Promise.resolve([]),
      ]);
      if (activeUsernameRef.current !== username) {
        return { ok: false as const, connection: null, users: [] as UserSession[], message: "Sesión cambió durante la carga." };
      }
      setBinanceConnection(connection);
      setAvailableUsers(users);
      if (connection?.accountAlias) {
        setBinanceForm((prev) => ({ ...prev, alias: connection.accountAlias || "" }));
      }
      return { ok: true as const, connection, users, message: null };
    } catch (error) {
      // keep current UI state
      return {
        ok: false as const,
        connection: null,
        users: [],
        message: error instanceof Error ? error.message : "No se pudo actualizar el perfil.",
      };
    }
  }, [currentUser]);

  const refreshPortfolio = useCallback(async (period = portfolioPeriod, mode: "full" | "live" = "full") => {
    const username = currentUser?.username || "";
    if (!username) {
      return { ok: false as const, message: "Sesion no disponible." };
    }
    try {
      const payload = await binanceService.getPortfolio(period, mode);
      if (activeUsernameRef.current !== username) {
        return { ok: false as const, message: "Sesión cambió durante la carga." };
      }
      setPortfolioData((previous) => {
        const payloadWithIssue = payload as PortfolioPayload & { connectionIssue?: string };
        if (mode === "live") {
          if (payloadWithIssue.connectionIssue && previous) {
            return previous;
          }
          return mergePortfolioLivePayload(previous, payload, period);
        }
        if (payloadWithIssue.connectionIssue && previous) {
          return {
            ...previous,
            snapshotMode: "full",
            summary: payload.summary || previous.summary,
            accountMovements: payload.accountMovements || previous.accountMovements || [],
          };
        }
        return payload;
      });
      setPortfolioPeriod(period);
      return { ok: true as const, message: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el balance.";
      setPortfolioData((previous) => previous || {
        snapshotMode: mode,
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
      return { ok: false as const, message };
    }
  }, [currentUser?.username, portfolioPeriod]);

  const refreshExecutionCenter = useCallback(async () => {
    const username = currentUser?.username || "";
    if (!username) {
      return { ok: false as const, payload: null, message: "Sesion no disponible." };
    }
    try {
      const payload = await binanceService.getExecutionCenter();
      if (activeUsernameRef.current !== username) {
        return { ok: false as const, payload: null, message: "Sesión cambió durante la carga." };
      }
      setExecutionCenter(payload);
      return { ok: true as const, payload, message: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer la ejecución demo.";
      return { ok: false as const, payload: null, message };
    }
  }, [currentUser?.username]);

  const refreshDashboardSummary = useCallback(async (forceFresh = false) => {
    const username = currentUser?.username || "";
    if (!username) {
      return { ok: false as const, payload: null, message: "Sesion no disponible." };
    }
    try {
      const payload = await binanceService.getDashboardSummary(forceFresh);
      if (activeUsernameRef.current !== username) {
        return { ok: false as const, payload: null, message: "Sesión cambió durante la carga." };
      }
      setDashboardSummary((previous) => {
        const portfolioValue = Number(payload?.portfolio?.totalValue || 0);
        const topAssetsCount = Array.isArray(payload?.topAssets) ? payload.topAssets.length : 0;
        const recentOrdersCount = Array.isArray(payload?.execution?.recentOrders) ? payload.execution.recentOrders.length : 0;
        const hasUsefulPayload = portfolioValue > 0 || topAssetsCount > 0 || recentOrdersCount > 0;

        if (!hasUsefulPayload && payload?.connectionIssue && previous) {
          return previous;
        }
        return payload;
      });
      return { ok: true as const, payload, message: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el dashboard.";
      return { ok: false as const, payload: null, message };
    }
  }, [currentUser?.username]);

  const updateExecutionProfile = useCallback(async (profile: ExecutionProfile) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const payload = await binanceService.updateExecutionProfile(profile);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      await refreshExecutionCenter();
      return payload;
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshExecutionCenter]);

  const executeDemoSignal = useCallback(async (signalId: number, mode: "preview" | "execute") => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const payload = await binanceService.executeSignal(signalId, mode);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      // Demo execution mutates a hot operational domain, so the shared plane
      // refreshes execution immediately after the command completes.
      await refreshExecutionCenter();
      return payload;
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshExecutionCenter]);

  const attachExecutionProtection = useCallback(async (executionOrderId: number) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const payload = await binanceService.attachProtection(executionOrderId);
      if (activeUsernameRef.current !== username) {
        return null;
      }
      await refreshExecutionCenter();
      return payload;
    } catch {
      return null;
    }
  }, [currentUser?.username, refreshExecutionCenter]);

  const refreshProfileDataWithFeedback = useCallback(async () => {
    const loaderId = startLoading({ label: "Actualizando perfil", detail: "Leyendo conexion y acceso" });
    try {
      const result = await refreshProfileData();
      if (!result.ok) {
        showToast({
          tone: "error",
          title: "No se pudo actualizar el perfil",
          message: result.message || "Intentalo otra vez en unos segundos.",
        });
        return null;
      }

      if (result.connection) {
        showToast({
          tone: "success",
          title: "Perfil actualizado",
          message: "La conexion de Binance Demo y el panel de usuarios ya se refrescaron.",
        });
      } else {
        showToast({
          tone: "warning",
          title: "Perfil actualizado con datos limitados",
          message: "No encontramos una conexion activa, pero la vista ya se sincronizo.",
        });
      }
      return result.connection;
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el perfil",
        message: error instanceof Error ? error.message : "Intentalo otra vez en unos segundos.",
      });
      return null;
    } finally {
      stopLoading(loaderId);
    }
  }, [refreshProfileData]);

  const refreshPortfolioWithFeedback = useCallback(async (period = portfolioPeriod, mode: "full" | "live" = "full") => {
    const loaderId = startLoading({ label: "Actualizando balance", detail: `Periodo ${period}` });
    try {
      const result = await refreshPortfolio(period, mode);
      showToast(result.ok
        ? {
            tone: "success",
            title: "Balance actualizado",
            message: "El resumen de capital y posiciones ya refleja la lectura mas reciente.",
          }
        : {
            tone: "warning",
            title: "Balance actualizado con datos limitados",
            message: result.message || "No se pudo leer todo el balance en este intento.",
          });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el balance",
        message: error instanceof Error ? error.message : "Intentalo otra vez en unos segundos.",
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [portfolioPeriod, refreshPortfolio]);

  const connect = useCallback(async () => {
    const loaderId = startLoading({ label: "Conectando Binance Demo", detail: binanceForm.alias.trim() || "Nueva conexión" });
    try {
      await binanceService.connect(binanceForm.apiKey.trim(), binanceForm.apiSecret.trim(), binanceForm.alias.trim());
      setBinanceForm((prev) => ({ ...prev, apiSecret: "" }));
      await refreshProfileData();
      await Promise.all([refreshPortfolio(portfolioPeriod, "full"), refreshExecutionCenter()]);
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
  }, [binanceForm, refreshExecutionCenter, refreshPortfolio, refreshProfileData]);

  const disconnect = useCallback(async () => {
    const loaderId = startLoading({ label: "Desconectando Binance Demo", detail: "Cerrando acceso de cuenta" });
    try {
      await binanceService.disconnect();
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      setExecutionCenter(null);
      await refreshProfileData();
      if (currentView === "balance") {
        await refreshPortfolio(portfolioPeriod, "full");
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
      setExecutionCenter(null);
      setDashboardSummary(null);
      setAvailableUsers([]);
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      return;
    }

    void (async () => {
      const result = await refreshProfileData();
      if (result.connection?.connected) {
        await refreshPortfolio(portfolioPeriod, "full");
        if (!refreshPolicy.systemOverlayStreamEnabled) {
          await Promise.all([
            refreshExecutionCenter(),
            refreshDashboardSummary(true).catch(() => null),
          ]);
        }
      }
    })();
  }, [currentUser, refreshDashboardSummary, refreshExecutionCenter, refreshPolicy.systemOverlayStreamEnabled, refreshPortfolio, refreshProfileData, portfolioPeriod]);

  useEffect(() => {
    if (!currentUser || !binanceConnection?.connected) return;

    const loadPlan = buildConnectedViewLoadPlan(
      currentView,
      lastViewRef.current,
      refreshPolicy.systemOverlayStreamEnabled,
      refreshPolicy.portfolioMode,
    );

    if (loadPlan.portfolioMode) {
      void refreshPortfolio(portfolioPeriod, loadPlan.portfolioMode);
    }

    if (loadPlan.refreshExecution || loadPlan.refreshDashboard) {
      void Promise.all([
        loadPlan.refreshExecution ? refreshExecutionCenter() : Promise.resolve(null),
        loadPlan.refreshDashboard ? refreshDashboardSummary(true) : Promise.resolve(null),
      ]);
    }

    lastViewRef.current = currentView;
  }, [binanceConnection?.connected, currentUser, currentView, portfolioPeriod, refreshDashboardSummary, refreshExecutionCenter, refreshPolicy.portfolioMode, refreshPolicy.systemOverlayStreamEnabled, refreshPortfolio]);

  useEffect(() => {
    if (!currentUser || !binanceConnection?.connected) return undefined;

    const portfolioRefreshInterval = refreshPolicy.portfolioIntervalMs;
    const executionRefreshInterval = refreshPolicy.executionIntervalMs;
    const dashboardRefreshInterval = refreshPolicy.dashboardSummaryIntervalMs;

    const portfolioIntervalId = portfolioRefreshInterval > 0
      ? window.setInterval(() => {
        if (document.visibilityState === "hidden") return;
        const mode = refreshPolicy.portfolioMode;
        void refreshPortfolio(portfolioPeriod, mode);
      }, portfolioRefreshInterval)
      : null;

    const executionIntervalId = executionRefreshInterval > 0
      ? window.setInterval(() => {
        if (document.visibilityState === "hidden") return;
        void refreshExecutionCenter();
      }, executionRefreshInterval)
      : null;

    const dashboardIntervalId = dashboardRefreshInterval
      ? window.setInterval(() => {
        if (document.visibilityState === "hidden") return;
        void refreshDashboardSummary(true);
      }, dashboardRefreshInterval)
      : null;

    return () => {
      if (portfolioIntervalId) window.clearInterval(portfolioIntervalId);
      if (executionIntervalId) window.clearInterval(executionIntervalId);
      if (dashboardIntervalId) window.clearInterval(dashboardIntervalId);
    };
  }, [binanceConnection?.connected, currentUser, portfolioPeriod, refreshDashboardSummary, refreshExecutionCenter, refreshPolicy.dashboardSummaryIntervalMs, refreshPolicy.executionIntervalMs, refreshPolicy.portfolioIntervalMs, refreshPolicy.portfolioMode, refreshPortfolio]);

  return {
    binanceConnection,
    portfolioData,
    executionCenter,
    dashboardSummary,
    portfolioPeriod,
    availableUsers,
    hideSmallAssets,
    binanceForm,
    setHideSmallAssets,
    setBinanceFormField(field: keyof BinanceFormState, value: string) {
      setBinanceForm((prev) => ({ ...prev, [field]: value }));
    },
    refreshProfileData,
    refreshProfileDataWithFeedback,
    refreshPortfolio,
    refreshPortfolioWithFeedback,
    refreshExecutionCenter,
    refreshDashboardSummary,
    updateExecutionProfile,
    executeDemoSignal,
    attachExecutionProtection,
    connect,
    disconnect,
  };
}
