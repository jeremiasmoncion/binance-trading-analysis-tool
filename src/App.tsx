import { useEffect, useMemo, useRef } from "react";
import { AppView } from "./components/AppView";
import { LoginOverlay } from "./components/LoginOverlay";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useAuth } from "./hooks/useAuth";
import { useBinanceData } from "./hooks/useBinanceData";
import { useCalculator } from "./hooks/useCalculator";
import { useMarketData } from "./hooks/useMarketData";
import { useTheme } from "./hooks/useTheme";
import { useViewState } from "./hooks/useViewState";
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
      ? getOperationPlan(market.indicators, market.signal, 0, market.timeframe)
      : null,
  );
  const binance = useBinanceData({ currentUser: auth.currentUser, currentView: view.currentView });
  const { theme, toggleTheme } = useTheme(chartRef, market.candles);
  const plan = useMemo(() => {
    if (!market.indicators || !market.signal) return null;
    return getOperationPlan(market.indicators, market.signal, calculatorState.capitalValue, market.timeframe);
  }, [market.indicators, market.signal, calculatorState.capitalValue, market.timeframe]);

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

  async function handleLogout() {
    await auth.handleLogout(async () => {
      view.resetToDashboard();
    });
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
    <div className="app-shell">
      <Sidebar
        user={auth.currentUser}
        currentView={view.currentView}
        onViewChange={view.setCurrentView}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <TopBar
          currentCoin={market.currentCoin}
          coinOptions={market.availableCoins}
          popularCoins={market.popularCoins}
          timeframe={market.timeframe}
          status={market.status}
          user={auth.currentUser}
          showAdmin={auth.currentUser.role === "admin"}
          theme={theme}
          onCoinChange={market.selectCoin}
          onTimeframeChange={market.selectTimeframe}
          onRefresh={() => void market.fetchData(market.currentCoin, market.timeframe)}
          onToggleTheme={toggleTheme}
          onOpenAdmin={view.openProfile}
          onLogout={handleLogout}
        />

        <AppView
          currentView={view.currentView}
          currentCoin={market.currentCoin}
          timeframe={market.timeframe}
          currentPrice={market.indicators?.current || 0}
          signal={market.signal}
          plan={plan}
          multiTimeframes={market.multiTimeframes}
          candles={market.candles}
          chartRef={chartRef}
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
          portfolioData={binance.portfolioData}
          portfolioPeriod={binance.portfolioPeriod}
          hideSmallAssets={binance.hideSmallAssets}
          onPortfolioPeriodChange={(period) => void binance.refreshPortfolio(period)}
          onRefreshPortfolio={() => void binance.refreshPortfolio()}
          onToggleHideSmallAssets={binance.setHideSmallAssets}
          user={auth.currentUser}
          users={binance.availableUsers}
          connection={binance.binanceConnection}
          binanceForm={binance.binanceForm}
          onBinanceFormChange={binance.setBinanceFormField}
          onConnectBinance={binance.connect}
          onRefreshBinance={() => void binance.refreshProfileData()}
          onDisconnectBinance={binance.disconnect}
        />
      </main>
    </div>
  );
}
