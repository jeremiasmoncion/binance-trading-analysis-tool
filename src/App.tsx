import { useEffect, useMemo, useRef } from "react";
import { AppView } from "./components/AppView";
import { LoginOverlay } from "./components/LoginOverlay";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { SystemUiHost } from "./components/ui/SystemUiHost";
import { useAuth } from "./hooks/useAuth";
import { useBinanceData } from "./hooks/useBinanceData";
import { useCalculator } from "./hooks/useCalculator";
import { useMarketData } from "./hooks/useMarketData";
import { useSignalMemory } from "./hooks/useSignalMemory";
import { useTheme } from "./hooks/useTheme";
import { useViewState } from "./hooks/useViewState";
import { useWatchlist } from "./hooks/useWatchlist";
import { showToast, startLoading, stopLoading } from "./lib/ui-events";
import { getOperationPlan } from "./lib/trading";

export function App() {
  const view = useViewState("dashboard");
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const bootstrappedRef = useRef(false);

  const auth = useAuth();
  const market = useMarketData({ currentView: view.currentView });
  const calculatorState = useCalculator(
    market.indicators,
    market.indicators && market.signal
      ? getOperationPlan(market.indicators, market.signal, 0, market.timeframe, market.analysis)
      : null,
  );
  const binance = useBinanceData({ currentUser: auth.currentUser, currentView: view.currentView });
  const signalMemory = useSignalMemory({ currentUser: auth.currentUser, currentView: view.currentView });
  const watchlist = useWatchlist({ currentUser: auth.currentUser });
  const {
    signals: memorySignals,
    saveSignal,
    updateSignal,
    maybeAutoSaveSignal,
    evaluatePendingSignals,
  } = signalMemory;
  const isCurrentCoinWatched = watchlist.isWatched(market.currentCoin);
  const { theme, toggleTheme } = useTheme(chartRef, market.candles);
  const plan = useMemo(() => {
    if (!market.indicators || !market.signal) return null;
    return getOperationPlan(market.indicators, market.signal, calculatorState.capitalValue, market.timeframe, market.analysis);
  }, [market.indicators, market.signal, calculatorState.capitalValue, market.timeframe, market.analysis]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      const session = await auth.bootstrapSession();
      if (session) {
        await market.fetchData("BTC/USDT", "1h");
      }
    })();
  }, [auth, market]);

  useEffect(() => {
    if (!auth.currentUser || !market.signal || !market.analysis || !plan || !isCurrentCoinWatched) return;
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
    if (!auth.currentUser || !market.indicators?.current) return;
    void evaluatePendingSignals({
      currentCoin: market.currentCoin,
      currentPrice: market.indicators.current,
    });
  }, [
    auth.currentUser,
    market.currentCoin,
    market.indicators?.current,
    evaluatePendingSignals,
  ]);

  async function handleLogout() {
    await auth.handleLogout(async () => {
      view.resetToDashboard();
    });
  }

  async function handleRefreshAnalysis() {
    const loaderId = startLoading({
      label: "Actualizando análisis",
      detail: `${market.currentCoin} · ${market.timeframe}`,
    });
    try {
      await market.fetchData(market.currentCoin, market.timeframe);
      showToast({
        tone: "success",
        title: "Análisis actualizado",
        message: `El mercado de ${market.currentCoin} ya se refrescó con datos recientes.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez en unos segundos.",
      });
    } finally {
      stopLoading(loaderId);
    }
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
          await market.fetchData(market.currentCoin, market.timeframe);
        })}
        onRegisterSubmit={(event) => auth.handleRegister(event, async () => {
          await market.fetchData(market.currentCoin, market.timeframe);
        })}
      />
    );
  }

  return (
    <div className={`app-shell${view.sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <SystemUiHost />
      <Sidebar
        user={auth.currentUser}
        currentView={view.currentView}
        collapsed={view.sidebarCollapsed}
        onViewChange={view.setCurrentView}
        onToggleCollapse={view.toggleSidebar}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <TopBar
          currentCoin={market.currentCoin}
          coinOptions={market.availableCoins}
          popularCoins={market.popularCoins}
          watchlist={watchlist.watchlist}
          isCurrentCoinWatched={isCurrentCoinWatched}
          timeframe={market.timeframe}
          status={market.status}
          user={auth.currentUser}
          showAdmin={auth.currentUser.role === "admin"}
          theme={theme}
          onCoinChange={market.selectCoin}
          onTimeframeChange={market.selectTimeframe}
          onRefresh={() => void handleRefreshAnalysis()}
          onToggleWatchlist={() => watchlist.toggleWatchlist(market.currentCoin)}
          onToggleTheme={toggleTheme}
          onOpenAdmin={view.openProfile}
          onLogout={handleLogout}
        />

        <AppView
          currentView={view.currentView}
          currentCoin={market.currentCoin}
          watchlists={watchlist.lists}
          watchlist={watchlist.watchlist}
          activeWatchlistName={watchlist.activeListName}
          timeframe={market.timeframe}
          currentPrice={market.currentPrice || market.indicators?.current || 0}
          signal={market.signal}
          plan={plan}
          analysis={market.analysis}
          strategy={market.strategy}
          strategyCandidates={market.strategyCandidates}
          strategyRefreshIntervalMs={market.refreshIntervalMs}
          multiTimeframes={market.multiTimeframes}
          candles={market.candles}
          chartRef={chartRef}
          onSaveSignal={() => {
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
          }}
          indicators={market.indicators}
          market24h={market.market24h}
          support={market.supportResistance.support}
          resistance={market.supportResistance.resistance}
          calculatorValues={calculatorState.calculator}
          calculatorResult={calculatorState.result}
          onCalculatorChange={calculatorState.setField}
          onSuggestPlan={() => calculatorState.applySuggestedPlan()}
          onUseCurrentPrice={calculatorState.useCurrentPrice}
          comparison={market.comparison}
          onSelectCoin={market.selectCoin}
          onToggleWatchlist={watchlist.toggleWatchlist}
          onReplaceWatchlistCoins={watchlist.replaceListCoins}
          onCreateWatchlist={watchlist.createList}
          onRenameWatchlist={watchlist.renameList}
          onDeleteWatchlist={watchlist.deleteList}
          onSetActiveWatchlist={watchlist.setActiveList}
          portfolioData={binance.portfolioData}
          executionCenter={binance.executionCenter}
          portfolioPeriod={binance.portfolioPeriod}
          hideSmallAssets={binance.hideSmallAssets}
          onPortfolioPeriodChange={(period) => void binance.refreshPortfolioWithFeedback(period)}
          onRefreshPortfolio={() => void binance.refreshPortfolioWithFeedback()}
          onRefreshExecutionCenter={() => binance.refreshExecutionCenter()}
          onToggleHideSmallAssets={binance.setHideSmallAssets}
          signalMemory={memorySignals.filter((item) => watchlist.watchlistSet.has(item.coin))}
          onUpdateSignal={(id, outcomeStatus, outcomePnl, note) => void updateSignal(id, outcomeStatus, outcomePnl, note)}
          user={auth.currentUser}
          users={binance.availableUsers}
          connection={binance.binanceConnection}
          binanceForm={binance.binanceForm}
          onBinanceFormChange={binance.setBinanceFormField}
          onConnectBinance={binance.connect}
          onRefreshBinance={() => void binance.refreshProfileDataWithFeedback()}
          onDisconnectBinance={binance.disconnect}
        />
      </main>
    </div>
  );
}
