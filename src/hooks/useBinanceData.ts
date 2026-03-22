import { useCallback, useEffect, useRef, useState } from "react";
import { authService, binanceService } from "../services/api";
import { buildConnectedViewLoadPlan, buildInitialConnectedLoadPlan } from "../data-platform/connectedLoadPlan";
import { hasExecutionCenterChanged } from "../data-platform/executionDiff";
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

function hasConnectionChanged(current: BinanceConnection | null, next: BinanceConnection | null) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return !(
    current.connected === next.connected
    && (current.maskedApiKey || "") === (next.maskedApiKey || "")
    && (current.accountAlias || "") === (next.accountAlias || "")
    && (current.summary?.accountType || "") === (next.summary?.accountType || "")
    && Number(current.summary?.openOrdersCount || 0) === Number(next.summary?.openOrdersCount || 0)
  );
}

function hasUserListChanged(current: UserSession[], next: UserSession[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentUser = current[index];
    const nextUser = next[index];
    if (
      currentUser.username !== nextUser.username
      || currentUser.role !== nextUser.role
      || (currentUser.displayName || "") !== (nextUser.displayName || "")
    ) {
      return true;
    }
  }

  return false;
}

function hasDashboardAssetListChanged(
  current: DashboardSummaryPayload["topAssets"],
  next: DashboardSummaryPayload["topAssets"],
) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.asset !== nextItem.asset
      || Number(currentItem.marketValue || 0) !== Number(nextItem.marketValue || 0)
      || Number(currentItem.quantity || 0) !== Number(nextItem.quantity || 0)
      || Number(currentItem.periodChangePct || 0) !== Number(nextItem.periodChangePct || 0)
    ) {
      return true;
    }
  }

  return false;
}

function hasDashboardOrderListChanged(
  current: DashboardSummaryPayload["execution"]["recentOrders"],
  next: DashboardSummaryPayload["execution"]["recentOrders"],
) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];
    if (
      currentItem.id !== nextItem.id
      || (currentItem.lifecycle_status || "") !== (nextItem.lifecycle_status || "")
      || Number(currentItem.realized_pnl || 0) !== Number(nextItem.realized_pnl || 0)
    ) {
      return true;
    }
  }

  return false;
}

function hasDashboardSummaryChanged(current: DashboardSummaryPayload | null, next: DashboardSummaryPayload | null) {
  if (current === next) return false;
  if (!current || !next) return current !== next;

  return !(
    current.connection.connected === next.connection.connected
    && (current.connection.accountAlias || "") === (next.connection.accountAlias || "")
    && (current.connectionIssue || "") === (next.connectionIssue || "")
    && Number(current.portfolio.totalValue || 0) === Number(next.portfolio.totalValue || 0)
    && Number(current.portfolio.cashValue || 0) === Number(next.portfolio.cashValue || 0)
    && Number(current.portfolio.positionsValue || 0) === Number(next.portfolio.positionsValue || 0)
    && Number(current.portfolio.periodChangeValue || 0) === Number(next.portfolio.periodChangeValue || 0)
    && Number(current.portfolio.periodChangePct || 0) === Number(next.portfolio.periodChangePct || 0)
    && !hasDashboardAssetListChanged(current.topAssets, next.topAssets)
    && Number(current.execution.activeBots || 0) === Number(next.execution.activeBots || 0)
    && Number(current.execution.openOrdersCount || 0) === Number(next.execution.openOrdersCount || 0)
    && Number(current.execution.eligibleCount || 0) === Number(next.execution.eligibleCount || 0)
    && Number(current.execution.blockedCount || 0) === Number(next.execution.blockedCount || 0)
    && !hasDashboardOrderListChanged(current.execution.recentOrders, next.execution.recentOrders)
  );
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
  const previousTotalValue = Number(previous.portfolio?.totalValue || 0);
  const previousPositionsValue = Number(previous.portfolio?.positionsValue || 0);
  const livePositionsValue = Number(live.portfolio?.positionsValue || 0);
  const liveNonCashAssets = mergedAssets.filter((asset) => asset.asset !== "USDT" && Number(asset.marketValue || 0) > 0);
  const liveCashValue = Number(live.portfolio?.cashValue || cashAsset?.marketValue || 0);
  const collapsedToMostlyCash = totalValue > 0 && liveCashValue / totalValue >= 0.9;
  const collapsedPositions = previousPositionsValue > 0 && livePositionsValue <= previousPositionsValue * 0.25;
  const collapsedTotalValue = previousTotalValue > 0 && totalValue <= previousTotalValue * 0.75;

  // Live portfolio mode is intentionally lighter than a full snapshot. If a
  // transient upstream miss suddenly collapses the asset universe down to cash
  // only, or nearly cash-only, preserve the last good snapshot instead of
  // accepting a fake drawdown where totalValue momentarily becomes just the
  // USDT balance plus a tiny remainder from one surviving asset.
  if (
    previousPositionsValue > 0
    && collapsedTotalValue
    && collapsedPositions
    && (
      liveNonCashAssets.length === 0
      || collapsedToMostlyCash
    )
  ) {
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
      setBinanceConnection((current) => (hasConnectionChanged(current, connection) ? connection : current));
      setAvailableUsers((current) => (hasUserListChanged(current, users) ? users : current));
      if (connection?.accountAlias) {
        setBinanceForm((prev) => (
          prev.alias === (connection.accountAlias || "")
            ? prev
            : { ...prev, alias: connection.accountAlias || "" }
        ));
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
      setExecutionCenter((current) => (hasExecutionCenterChanged(current, payload) ? payload : current));
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
        return hasDashboardSummaryChanged(previous, payload) ? payload : previous;
      });
      return { ok: true as const, payload, message: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el dashboard.";
      return { ok: false as const, payload: null, message };
    }
  }, [currentUser?.username]);

  const hydrateConnectedView = useCallback(async (
    view: ViewName = currentView,
    options: {
      previousView?: ViewName | null;
      preferInitialPlan?: boolean;
      forceFreshDashboard?: boolean;
    } = {},
  ) => {
    const username = currentUser?.username || "";
    if (!username) {
      return { ok: false as const, connection: null, users: [] as UserSession[], message: "Sesion no disponible." };
    }

    const policy = getViewRefreshPolicy(view);
    const loadPlan = options.preferInitialPlan || !options.previousView
      ? buildInitialConnectedLoadPlan(view, policy.systemOverlayStreamEnabled, policy.portfolioMode)
      : buildConnectedViewLoadPlan(view, options.previousView, policy.systemOverlayStreamEnabled, policy.portfolioMode);

    const profileResult = await refreshProfileData();
    if (!profileResult.ok || !profileResult.connection?.connected) {
      return profileResult;
    }

    await Promise.all([
      loadPlan.portfolioMode ? refreshPortfolio(portfolioPeriod, loadPlan.portfolioMode) : Promise.resolve(null),
      loadPlan.refreshExecution ? refreshExecutionCenter() : Promise.resolve(null),
      loadPlan.refreshDashboard ? refreshDashboardSummary(options.forceFreshDashboard ?? true).catch(() => null) : Promise.resolve(null),
    ]);

    return profileResult;
  }, [
    currentUser?.username,
    currentView,
    portfolioPeriod,
    refreshDashboardSummary,
    refreshExecutionCenter,
    refreshPortfolio,
    refreshProfileData,
  ]);

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

  const executeDemoSignal = useCallback(async (
    signalId: number,
    mode: "preview" | "execute",
    options: {
      botId?: string | null;
      botName?: string | null;
      origin?: string | null;
    } = {},
  ) => {
    const username = currentUser?.username || "";
    if (!username) {
      return null;
    }

    try {
      const payload = await binanceService.executeSignal(signalId, mode, options);
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
  }, [
    currentUser,
  ]);

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
    hydrateConnectedView,
    updateExecutionProfile,
    executeDemoSignal,
    attachExecutionProtection,
    connect,
    disconnect,
  };
}
