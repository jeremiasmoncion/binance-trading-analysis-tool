import { useEffect, useMemo, useRef, useState } from "react";
import { LoginOverlay } from "./components/LoginOverlay";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { useAuth } from "./hooks/useAuth";
import { useBinanceData } from "./hooks/useBinanceData";
import { useMarketData } from "./hooks/useMarketData";
import { useTheme } from "./hooks/useTheme";
import type { ViewName } from "./types";
import { BalanceView } from "./views/BalanceView";
import { CalculatorView } from "./views/CalculatorView";
import { CompareView } from "./views/CompareView";
import { DashboardView } from "./views/DashboardView";
import { LearnView } from "./views/LearnView";
import { MarketView } from "./views/MarketView";
import { ProfileView } from "./views/ProfileView";

export function App() {
  const [currentView, setCurrentView] = useState<ViewName>("dashboard");
  const [calculator, setCalculator] = useState({ capital: "0", entry: "", percent: "1.5", stopPct: "1.0" });
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const bootstrappedRef = useRef(false);

  const auth = useAuth();
  const market = useMarketData({ currentView, calculatorCapital: Number(calculator.capital) || 0 });
  const binance = useBinanceData({ currentUser: auth.currentUser, currentView });
  const { theme, toggleTheme } = useTheme(chartRef, market.candles);

  const calculatorResult = useMemo(() => {
    const capital = Number(calculator.capital) || 0;
    const entry = Number(calculator.entry) || market.indicators?.current || 0;
    const pct = Number(calculator.percent) || 0;
    const stopPct = Number(calculator.stopPct) || 0;
    const exitPrice = entry * (1 + pct / 100);
    const gross = capital * pct / 100;
    const commission = capital * 0.002;
    const net = gross - commission;
    const netPct = capital ? (net / capital) * 100 : 0;
    const breakEven = entry * 1.002;
    const stopPrice = entry * (1 - stopPct / 100);
    const stopLoss = capital * stopPct / 100;
    return { exitPrice, gross, commission, net, netPct, breakEven, stopPrice, stopLoss };
  }, [calculator, market.indicators]);

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
      setCurrentView("dashboard");
    });
  }

  function handleSuggest() {
    if (!market.plan) return;
    const tpPct = ((market.plan.tp - market.plan.entry) / market.plan.entry) * 100;
    const slPct = ((market.plan.entry - market.plan.sl) / market.plan.entry) * 100;
    setCalculator((prev) => ({
      ...prev,
      entry: market.plan?.entry.toFixed(2) || "",
      percent: tpPct.toFixed(2),
      stopPct: slPct.toFixed(2),
    }));
  }

  function handleUseCurrentPrice() {
    if (!market.indicators?.current) return;
    setCalculator((prev) => ({ ...prev, entry: market.indicators.current.toFixed(2) || prev.entry }));
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
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <TopBar
          currentCoin={market.currentCoin}
          timeframe={market.timeframe}
          status={market.status}
          user={auth.currentUser}
          showAdmin={auth.currentUser.role === "admin"}
          theme={theme}
          onCoinChange={market.selectCoin}
          onTimeframeChange={market.selectTimeframe}
          onRefresh={() => void market.fetchData(market.currentCoin, market.timeframe)}
          onToggleTheme={toggleTheme}
          onOpenAdmin={() => setCurrentView("profile")}
          onLogout={handleLogout}
        />

        {currentView === "dashboard" ? (
          <DashboardView
            currentCoin={market.currentCoin}
            timeframe={market.timeframe}
            currentPrice={market.indicators?.current || 0}
            signal={market.signal}
            plan={market.plan}
            multiTimeframes={market.multiTimeframes}
            candles={market.candles}
            chartRef={chartRef}
          />
        ) : null}

        {currentView === "market" ? (
          <MarketView
            currentCoin={market.currentCoin}
            signal={market.signal}
            indicators={market.indicators}
            market24h={market.market24h}
            support={market.supportResistance.support}
            resistance={market.supportResistance.resistance}
          />
        ) : null}

        {currentView === "calculator" ? (
          <CalculatorView
            values={calculator}
            result={calculatorResult}
            onChange={(field, value) => setCalculator((prev) => ({ ...prev, [field]: value }))}
            onSuggest={handleSuggest}
            onCurrentPrice={handleUseCurrentPrice}
          />
        ) : null}

        {currentView === "compare" ? (
          <CompareView
            comparison={market.comparison}
            currentCoin={market.currentCoin}
            onSelectCoin={market.selectCoin}
          />
        ) : null}

        {currentView === "learn" ? <LearnView /> : null}

        {currentView === "journal" ? (
          <BalanceView
            payload={binance.portfolioData}
            period={binance.portfolioPeriod}
            hideSmallAssets={binance.hideSmallAssets}
            onPeriodChange={(period) => void binance.refreshPortfolio(period)}
            onRefresh={() => void binance.refreshPortfolio()}
            onToggleHideSmall={binance.setHideSmallAssets}
          />
        ) : null}

        {currentView === "profile" ? (
          <ProfileView
            user={auth.currentUser}
            users={binance.availableUsers}
            connection={binance.binanceConnection}
            binanceForm={binance.binanceForm}
            onBinanceFormChange={binance.setBinanceFormField}
            onConnect={binance.connect}
            onRefresh={() => void binance.refreshProfileData()}
            onDisconnect={binance.disconnect}
          />
        ) : null}
      </main>
    </div>
  );
}
