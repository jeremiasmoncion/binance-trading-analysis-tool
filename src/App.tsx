import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppView } from "./components/AppView";
import { LoginOverlay } from "./components/LoginOverlay";
import { Sidebar } from "./components/Sidebar";
import { StartupOverlay } from "./components/StartupOverlay";
import { TopBar } from "./components/TopBar";
import { SystemUiHost } from "./components/ui/SystemUiHost";
import { useAuth } from "./hooks/useAuth";
import { useBinanceData } from "./hooks/useBinanceData";
import { useCalculator } from "./hooks/useCalculator";
import { useMarketData } from "./hooks/useMarketData";
import { useMemoryRuntime } from "./hooks/useMemoryRuntime";
import { useSignalMemory } from "./hooks/useSignalMemory";
import { useTheme } from "./hooks/useTheme";
import { useValidationLabRuntime } from "./hooks/useValidationLabRuntime";
import { useViewState } from "./hooks/useViewState";
import { useWatchlist } from "./hooks/useWatchlist";
import { showToast, startLoading, stopLoading } from "./lib/ui-events";
import { getOperationPlan } from "./lib/trading";
import { syncMarketDataPlane, syncMarketDataPlaneActions, syncRealtimeCoreActions, syncRealtimeCoreControl, syncSystemDataPlane, syncSystemDataPlaneActions, syncSystemMemoryActions, syncSystemSignalActions, syncSystemValidationLabActions, syncSystemWatchlistActions } from "./data-platform/syncAppDataPlanes";
import { useRealtimeCoreStatusSelector } from "./data-platform/selectors";
import { realtimeCoreService } from "./services/api";
import { applyRealtimeCoreBootstrap } from "./realtime-core/bootstrap";
import { applyRealtimeCoreEvent } from "./realtime-core/events";
import type { StrategyRecommendationRecord } from "./types";

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth <= 1024;
}

export function App() {
  const view = useViewState("dashboard");
  const {
    currentView,
    sidebarCollapsed,
    toggleSidebar,
    openProfile,
    resetToDashboard,
    setCurrentView,
  } = view;
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const bootstrappedRef = useRef(false);
  const connectionToastStateRef = useRef<{ bootstrapped: boolean; lastConnected: boolean | null }>({
    bootstrapped: false,
    lastConnected: null,
  });
  const realtimeRuntimeToastStateRef = useRef<{ bootstrapped: boolean; lastActiveMode: "external" | "serverless" | null }>({
    bootstrapped: false,
    lastActiveMode: null,
  });
  const seenExecutionEventsRef = useRef<Set<string>>(new Set());
  const executionEventsBootstrappedRef = useRef(false);
  const seenAutomationEventsRef = useRef<Set<string>>(new Set());
  const automationEventsBootstrappedRef = useRef(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [startupPending, setStartupPending] = useState(false);

  const auth = useAuth();
  const { realtimeCore } = useRealtimeCoreStatusSelector();
  const market = useMarketData({ currentView });
  const calculatorState = useCalculator(
    market.indicators,
    market.indicators && market.signal
      ? getOperationPlan(market.indicators, market.signal, 0, market.timeframe, market.analysis)
      : null,
  );
  const binance = useBinanceData({ currentUser: auth.currentUser, currentView });
  const handleNavigateView = useCallback((nextView: typeof currentView) => {
    setCurrentView(nextView);
    if (isMobileViewport() && !sidebarCollapsed) {
      toggleSidebar();
    }
  }, [setCurrentView, sidebarCollapsed, toggleSidebar]);
  const signalMemory = useSignalMemory({ currentUser: auth.currentUser, currentView });
  const memoryRuntime = useMemoryRuntime({ currentUser: auth.currentUser });
  const validationLabRuntime = useValidationLabRuntime({ currentUser: auth.currentUser });
  const watchlist = useWatchlist({ currentUser: auth.currentUser });
  const {
    saveSignal,
    maybeAutoSaveSignal,
    evaluatePendingSignals,
  } = signalMemory;
  const isCurrentCoinWatched = watchlist.isWatched(market.currentCoin);
  const { theme, toggleTheme } = useTheme(chartRef, market.candles);
  const clientMarketAutomationEnabled = currentView === "dashboard" || currentView === "market";
  const plan = useMemo(() => {
    if (!market.indicators || !market.signal) return null;
    return getOperationPlan(market.indicators, market.signal, calculatorState.capitalValue, market.timeframe, market.analysis);
  }, [market.indicators, market.signal, calculatorState.capitalValue, market.timeframe, market.analysis]);

  const hydrateRealtimeBootstrap = useCallback(async (
    coin = market.currentCoin,
    timeframe = market.timeframe,
    period = binance.portfolioPeriod,
  ) => {
    const payload = await realtimeCoreService.getBootstrap(coin, timeframe, period, {
      onRuntimeState: syncRealtimeCoreControl,
    });
    applyRealtimeCoreBootstrap(payload);
    return payload;
  }, [binance.portfolioPeriod, market.currentCoin, market.timeframe]);

  const runInitialWorkspaceLoad = useCallback(async (
    coin = market.currentCoin,
    timeframe = market.timeframe,
    period = binance.portfolioPeriod,
  ) => {
    setStartupPending(true);
    try {
      // First paint only depends on a stable system bootstrap. Market analysis is
      // heavier and can continue in the background without forcing an empty shell.
      await hydrateRealtimeBootstrap(coin, timeframe, period);
      void market.fetchData(coin, timeframe);
    } finally {
      setStartupPending(false);
    }
  }, [binance.portfolioPeriod, hydrateRealtimeBootstrap, market]);

  const refreshRealtimeCoreStatus = useCallback(async () => {
    const runtime = await realtimeCoreService.getRuntimeStatus(true);
    syncRealtimeCoreControl(runtime);
    return runtime;
  }, []);

  useEffect(() => {
    syncMarketDataPlane(market);
  }, [
    market.analysis,
    market.candles,
    market.comparison,
    market.currentCoin,
    market.currentPrice,
    market.indicators,
    market.market24h,
    market.multiTimeframes,
    market.signal,
    market.status,
    market.strategy,
    market.strategyCandidates,
    market.supportResistance,
    market.timeframe,
  ]);

  useEffect(() => {
    syncMarketDataPlaneActions(market);
  }, [market.fetchData, market.selectCoin, market.selectTimeframe]);

  useEffect(() => {
    syncSystemDataPlane(binance, memoryRuntime, validationLabRuntime, watchlist, Boolean(auth.currentUser));
  }, [
    auth.currentUser,
    binance.binanceConnection,
    binance.dashboardSummary,
    binance.executionCenter,
    binance.portfolioData,
    memoryRuntime.scannerStatus,
    memoryRuntime.strategyDecision,
    memoryRuntime.strategyExperiments,
    memoryRuntime.strategyRecommendations,
    memoryRuntime.strategyRegistry,
    memoryRuntime.strategyVersions,
    validationLabRuntime.backtestQueue,
    validationLabRuntime.backtestRuns,
    validationLabRuntime.validationReport,
    watchlist.activeListName,
    watchlist.lists,
  ]);

  useEffect(() => {
    syncSystemDataPlaneActions(binance);
  }, [
    binance.connect,
    binance.disconnect,
    binance.refreshDashboardSummary,
    binance.refreshExecutionCenter,
    binance.refreshPortfolio,
    binance.refreshPortfolioWithFeedback,
    binance.refreshProfileDataWithFeedback,
    binance.setBinanceFormField,
    binance.setHideSmallAssets,
  ]);

  useEffect(() => {
    syncSystemSignalActions(signalMemory);
  }, [signalMemory.refreshSignals]);

  useEffect(() => {
    syncSystemMemoryActions(memoryRuntime);
  }, [memoryRuntime.refreshScannerStatus, memoryRuntime.refreshStrategyEngine]);

  useEffect(() => {
    syncSystemValidationLabActions(validationLabRuntime);
  }, [
    validationLabRuntime.backfillValidationDataset,
    validationLabRuntime.enqueueValidationBacktest,
    validationLabRuntime.processValidationBacktestQueue,
    validationLabRuntime.refreshValidationLab,
  ]);

  useEffect(() => {
    syncSystemWatchlistActions(watchlist);
  }, [
    watchlist.createList,
    watchlist.deleteList,
    watchlist.renameList,
    watchlist.replaceListCoins,
    watchlist.setActiveList,
    watchlist.toggleWatchlist,
  ]);

  useEffect(() => {
    syncRealtimeCoreActions({ refreshRealtimeCoreStatus });
  }, [refreshRealtimeCoreStatus]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      await auth.bootstrapSession(async () => {
        await runInitialWorkspaceLoad("BTC/USDT", "1h", binance.portfolioPeriod);
      });
      setSessionChecked(true);
    })();
  }, [auth, binance.portfolioPeriod, market, runInitialWorkspaceLoad]);

  useEffect(() => {
    if (!auth.currentUser) return undefined;

    let cancelled = false;
    let closeStream: () => void = () => {};

    void realtimeCoreService.openSystemEvents((event) => {
      applyRealtimeCoreEvent(event);
    }, {
      onRuntimeState: syncRealtimeCoreControl,
    }).then((close) => {
      if (cancelled) {
        close();
        return;
      }
      closeStream = close;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      closeStream();
    };
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) {
      realtimeRuntimeToastStateRef.current = { bootstrapped: false, lastActiveMode: null };
      return undefined;
    }

    let intervalId: number | null = null;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void refreshRealtimeCoreStatus().catch(() => undefined);
    };

    tick();
    intervalId = window.setInterval(tick, 30_000);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [auth.currentUser, refreshRealtimeCoreStatus]);

  useEffect(() => {
    if (!clientMarketAutomationEnabled || !auth.currentUser || !market.signal || !market.analysis || !plan || !isCurrentCoinWatched) return;
    // Client-side market automations are only allowed while the user is on a
    // screen that is actively consuming the hot market context. Off-screen
    // coins and background monitoring belong to the backend watcher/runtime.
    void maybeAutoSaveSignal({
      coin: market.currentCoin,
      timeframe: market.timeframe,
      signal: market.signal,
      analysis: market.analysis,
      plan,
      multiTimeframes: market.multiTimeframes,
      strategy: market.strategy,
      strategyCandidates: market.strategyCandidates,
    });
  }, [
    auth.currentUser,
    clientMarketAutomationEnabled,
    market.currentCoin,
    market.timeframe,
    market.signal,
    market.analysis,
    market.multiTimeframes,
    plan,
    maybeAutoSaveSignal,
    isCurrentCoinWatched,
  ]);

  useEffect(() => {
    if (!clientMarketAutomationEnabled || !auth.currentUser || !market.indicators?.current) return;
    void evaluatePendingSignals({
      currentCoin: market.currentCoin,
      currentPrice: market.indicators.current,
    });
  }, [
    auth.currentUser,
    clientMarketAutomationEnabled,
    market.currentCoin,
    market.indicators?.current,
    evaluatePendingSignals,
  ]);

  useEffect(() => {
    if (!auth.currentUser) {
      connectionToastStateRef.current = { bootstrapped: false, lastConnected: null };
      return;
    }

    const connected = Boolean(binance.binanceConnection?.connected);
    if (!connectionToastStateRef.current.bootstrapped) {
      connectionToastStateRef.current = { bootstrapped: true, lastConnected: connected };
      return;
    }

    if (connectionToastStateRef.current.lastConnected === connected) {
      return;
    }

    connectionToastStateRef.current.lastConnected = connected;

    if (connected) {
      showToast({
        tone: "success",
        title: "Binance Demo reconectado",
        message: "La cuenta volvió a estar disponible para balance, señales y ejecución demo.",
      });
      return;
    }

    showToast({
      tone: "error",
      title: "Binance Demo desconectado",
      message: "La conexión cayó y el sistema dejó de leer balance y ejecución hasta que vuelva.",
    });
  }, [auth.currentUser, binance.binanceConnection?.connected]);

  useEffect(() => {
    if (!auth.currentUser) {
      realtimeRuntimeToastStateRef.current = { bootstrapped: false, lastActiveMode: null };
      return;
    }

    const currentMode = realtimeCore.activeMode;
    if (!realtimeRuntimeToastStateRef.current.bootstrapped) {
      realtimeRuntimeToastStateRef.current = {
        bootstrapped: true,
        lastActiveMode: currentMode,
      };
      return;
    }

    if (realtimeRuntimeToastStateRef.current.lastActiveMode === currentMode) {
      return;
    }

    realtimeRuntimeToastStateRef.current.lastActiveMode = currentMode;

    if (currentMode === "external") {
      showToast({
        tone: "success",
        title: "Realtime core externo activo",
        message: `CRYPE volvió a usar ${realtimeCore.targetLabel} como hot path realtime.`,
      });
      return;
    }

    showToast({
      tone: "warning",
      title: "Realtime degradado a fallback",
      message: "La app volvió al camino interno de Vercel mientras el core externo no esté saludable.",
    });
  }, [auth.currentUser, realtimeCore.activeMode, realtimeCore.targetLabel]);

  useEffect(() => {
    if (!auth.currentUser) {
      executionEventsBootstrappedRef.current = false;
      seenExecutionEventsRef.current = new Set();
      return;
    }

    const recentOrders = binance.executionCenter?.recentOrders || [];
    if (!recentOrders.length) return;

    const buildEventKey = (item: typeof recentOrders[number]) => [
      item.id,
      item.lifecycle_status || item.status,
      item.closed_at || item.last_synced_at || item.created_at,
    ].join(":");

    if (!executionEventsBootstrappedRef.current) {
      seenExecutionEventsRef.current = new Set(recentOrders.map(buildEventKey));
      executionEventsBootstrappedRef.current = true;
      return;
    }

    recentOrders.forEach((item) => {
      const eventKey = buildEventKey(item);
      if (seenExecutionEventsRef.current.has(eventKey)) return;
      seenExecutionEventsRef.current.add(eventKey);

      const label = `${item.coin || "Señal"} ${item.side ? `· ${String(item.side).toUpperCase()}` : ""}`.trim();
      const strategyLabel = [item.strategy_name, item.timeframe].filter(Boolean).join(" · ");
      const lifecycle = String(item.lifecycle_status || item.status || "");

      if (item.mode !== "execute") return;

      if (lifecycle === "placed" || lifecycle === "protected" || lifecycle === "filled_unprotected") {
        showToast({
          tone: lifecycle === "protected" ? "success" : "info",
          title: "Operación demo abierta",
          message: strategyLabel
            ? `${label} ya entró a Binance Demo. ${strategyLabel}.`
            : `${label} ya entró a Binance Demo.`,
        });
        return;
      }

      if (lifecycle === "closed_win") {
        const pnlText = item.realized_pnl != null ? ` Resultado ${item.realized_pnl >= 0 ? "+" : ""}${Number(item.realized_pnl).toFixed(2)} USDT.` : "";
        showToast({
          tone: "success",
          title: "Operación demo cerrada en ganancia",
          message: `${label} cerró positivo.${pnlText}`.trim(),
        });
        return;
      }

      if (lifecycle === "closed_loss") {
        const pnlText = item.realized_pnl != null ? ` Resultado ${Number(item.realized_pnl).toFixed(2)} USDT.` : "";
        showToast({
          tone: "error",
          title: "Operación demo cerrada en pérdida",
          message: `${label} cerró negativo.${pnlText}`.trim(),
        });
        return;
      }

      if (lifecycle === "closed_invalidated") {
        showToast({
          tone: "warning",
          title: "Operación demo invalidada",
          message: `${label} salió sin TP ni SL ganador.`,
        });
      }
    });
  }, [auth.currentUser, binance.executionCenter?.recentOrders]);

  useEffect(() => {
    if (!auth.currentUser) {
      automationEventsBootstrappedRef.current = false;
      seenAutomationEventsRef.current = new Set();
      return;
    }

    const emitAutomationToasts = (recommendations: StrategyRecommendationRecord[]) => {
      const automatedItems = recommendations.filter((item) => {
        const evidence = item.evidence;
        return evidence && typeof evidence === "object" && "policyAutomation" in evidence && evidence.policyAutomation;
      });

      const buildAutomationKey = (item: StrategyRecommendationRecord) => {
        const evidence = item.evidence as { policyAutomation?: { action?: string; appliedAt?: string; finalAppliedAt?: string; finalState?: string } };
        const policy = evidence.policyAutomation || {};
        return [
          item.id,
          policy.action || "policy",
          policy.finalState || "state",
          policy.finalAppliedAt || policy.appliedAt || item.updated_at || item.created_at,
        ].join(":");
      };

      if (!automationEventsBootstrappedRef.current) {
        seenAutomationEventsRef.current = new Set(automatedItems.map(buildAutomationKey));
        automationEventsBootstrappedRef.current = true;
        return;
      }

      automatedItems.forEach((item) => {
        const eventKey = buildAutomationKey(item);
        if (seenAutomationEventsRef.current.has(eventKey)) return;
        seenAutomationEventsRef.current.add(eventKey);

        const evidence = item.evidence as {
          recommendationType?: string;
          scopeSummary?: string;
          policyAutomation?: { action?: string; finalState?: string };
        };
        const policy = evidence.policyAutomation || {};
        const scopeLabel = evidence.scopeSummary || `${item.strategy_id} · ${item.parameter_key}`;

        if (policy.finalState === "applied" || policy.action === "cut" || policy.action === "tighten") {
          showToast({
            tone: "warning",
            title: "La IA ajustó el motor automáticamente",
            message: `${scopeLabel} fue endurecido para podar ruido del sistema.`,
          });
          return;
        }

        if (policy.finalState === "sandbox" || policy.action === "sandbox") {
          showToast({
            tone: "info",
            title: "La IA mandó un ajuste a prueba segura",
            message: `${scopeLabel} entró en observación controlada antes de tocar demo.`,
          });
        }
      });
    };

    // App only reacts to the canonical recommendation snapshot now. Polling is
    // owned by useMemoryRuntime so the engine state is refreshed once and then
    // shared across Memory, admin panels and global automation notifications.
    emitAutomationToasts(memoryRuntime.strategyRecommendations);
  }, [auth.currentUser, memoryRuntime.strategyRecommendations]);

  const handleLogout = useCallback(async () => {
    await auth.handleLogout(async () => {
      resetToDashboard();
    });
  }, [auth, resetToDashboard]);

  const handleSaveSignal = useCallback(() => {
    if (!market.signal) {
      showToast({
        tone: "warning",
        title: "Todavia no hay señal para guardar",
        message: "Espera a que el analisis termine de generar una lectura valida.",
      });
      return;
    }
    if (!isCurrentCoinWatched) {
      watchlist.toggleWatchlist(market.currentCoin);
    }
    // Saving a signal is a top-level action passed into Dashboard. Keep the
    // handler stable so AppView does not receive a fresh callback on every
    // unrelated realtime tick from market/system planes.
    void (async () => {
      const loaderId = startLoading({
        label: "Guardando señal",
        detail: `${market.currentCoin} · ${market.timeframe}`,
      });
      try {
        await saveSignal({
          coin: market.currentCoin,
          timeframe: market.timeframe,
          signal: market.signal,
          analysis: market.analysis,
          plan,
          multiTimeframes: market.multiTimeframes,
          strategy: market.strategy,
          strategyCandidates: market.strategyCandidates,
        });
        showToast({
          tone: "success",
          title: "Señal guardada",
          message: `${market.currentCoin} se añadió al historial para seguir su resultado.`,
        });
      } catch (error) {
        showToast({
          tone: "error",
          title: "No se pudo guardar la señal",
          message: error instanceof Error ? error.message : "Intentalo otra vez en unos segundos.",
        });
      } finally {
        stopLoading(loaderId);
      }
    })();
  }, [
    isCurrentCoinWatched,
    market.analysis,
    market.currentCoin,
    market.multiTimeframes,
    market.signal,
    market.strategy,
    market.strategyCandidates,
    market.timeframe,
    plan,
    saveSignal,
    watchlist.toggleWatchlist,
  ]);

  if (!auth.currentUser && !sessionChecked) {
    return (
      <StartupOverlay
        title="Restaurando sesión"
        detail="Validando acceso y preparando el workspace inicial."
      />
    );
  }

  if (auth.authPending) {
    return (
      <StartupOverlay
        title="Preparando acceso"
        detail="Validando sesión y cargando el workspace inicial antes de abrir la app."
      />
    );
  }

  if (!auth.currentUser) {
    return (
      <LoginOverlay
        authMode={auth.authMode}
        error={auth.loginError}
        loginForm={auth.loginForm}
        registerForm={auth.registerForm}
        onToggleMode={auth.toggleAuthMode}
        onLoginChange={auth.setLoginField}
        onRegisterChange={auth.setRegisterField}
        onLoginSubmit={(event) => auth.handleLogin(event, async () => {
          await runInitialWorkspaceLoad(market.currentCoin, market.timeframe, binance.portfolioPeriod);
        })}
        onRegisterSubmit={(event) => auth.handleRegister(event, async () => {
          await runInitialWorkspaceLoad(market.currentCoin, market.timeframe, binance.portfolioPeriod);
        })}
      />
    );
  }

  if (startupPending) {
    return (
      <StartupOverlay
        title="Preparando CRYPE"
        detail="Cargando capital, bot system, mercado y estado realtime inicial."
      />
    );
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <SystemUiHost />
      <button
        type="button"
        className="app-mobile-backdrop"
        aria-label="Cerrar navegación"
        onClick={toggleSidebar}
      />
      <Sidebar
        user={auth.currentUser}
        currentView={currentView}
        collapsed={sidebarCollapsed}
        onViewChange={handleNavigateView}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <TopBar
          user={auth.currentUser}
          showAdmin={auth.currentUser.role === "admin"}
          sidebarCollapsed={sidebarCollapsed}
          onToggleTheme={toggleTheme}
          onToggleSidebar={toggleSidebar}
          onOpenAdmin={openProfile}
          onLogout={handleLogout}
        />

        <AppView
          currentView={currentView}
          theme={theme}
          onNavigateView={handleNavigateView}
          chartRef={chartRef}
          onSaveSignal={handleSaveSignal}
          calculatorValues={calculatorState.calculator}
          calculatorResult={calculatorState.result}
          onCalculatorChange={calculatorState.setField}
          onSuggestPlan={() => calculatorState.applySuggestedPlan()}
          onUseCurrentPrice={calculatorState.useCurrentPrice}
          user={auth.currentUser}
        />
      </main>
    </div>
  );
}
