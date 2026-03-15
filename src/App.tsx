import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LoginOverlay } from "./components/LoginOverlay";
import { COINS, MAP_TIMEFRAMES } from "./config/constants";
import { drawChart } from "./lib/chart";
import { formatPrice, nowTime } from "./lib/format";
import { calcIndicators, generateFallbackCandles, generateSignal, getOperationPlan, getSupportResistance } from "./lib/trading";
import { authService, binanceService, marketService } from "./services/api";
import type { AppState, Candle, ComparisonCoin, Indicators, Signal, UserSession, ViewName } from "./types";
import { DashboardView } from "./views/DashboardView";
import { MarketView } from "./views/MarketView";
import { CalculatorView } from "./views/CalculatorView";
import { CompareView } from "./views/CompareView";
import { LearnView } from "./views/LearnView";
import { BalanceView } from "./views/BalanceView";
import { ProfileView } from "./views/ProfileView";

const INITIAL_STATE: AppState = {
  currentUser: null,
  currentView: "dashboard",
  authMode: "login",
  currentCoin: "BTC/USDT",
  timeframe: "1h",
  candles: [],
  indicators: null,
  signal: null,
  plan: null,
  multiTimeframes: [],
  binanceConnection: null,
  portfolioData: null,
  portfolioPeriod: "1d",
  availableUsers: [],
  comparison: [],
  hideSmallAssets: true,
};

export function App() {
  const [app, setApp] = useState<AppState>(INITIAL_STATE);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [loginError, setLoginError] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ displayName: "", email: "", password: "" });
  const [binanceForm, setBinanceForm] = useState({ alias: "", apiKey: "", apiSecret: "" });
  const [calculator, setCalculator] = useState({ capital: "0", entry: "", percent: "1.5", stopPct: "1.0" });
  const [market24h, setMarket24h] = useState({ change: 0, high: 0, low: 0, volume: "0 BTC", updatedAt: "--:--" });
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const liveIntervalRef = useRef<number | null>(null);

  const supportResistance = useMemo(() => getSupportResistance(app.candles.length ? app.candles : generateFallbackCandles(app.timeframe)), [app.candles, app.timeframe]);

  const calculatorResult = useMemo(() => {
    const capital = Number(calculator.capital) || 0;
    const entry = Number(calculator.entry) || app.indicators?.current || 0;
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
  }, [calculator, app.indicators]);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("crype_theme") as "light" | "dark" | null) || "dark";
    setTheme(savedTheme);
    document.body.classList.toggle("dark-theme", savedTheme === "dark");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-theme", theme === "dark");
    localStorage.setItem("crype_theme", theme);
    drawChart(chartRef.current, app.candles, theme === "dark");
  }, [theme, app.candles]);

  useEffect(() => {
    bootstrap();
    return () => stopLiveUpdates();
  }, []);

  useEffect(() => {
    if (app.currentUser && (app.currentView === "profile")) {
      void refreshProfileData();
    }
    if (app.currentUser && app.currentView === "journal") {
      void refreshPortfolio();
    }
  }, [app.currentUser, app.currentView]);

  async function bootstrap() {
    const session = await authService.getSession();
    if (!session) return;
    setApp((prev) => ({ ...prev, currentUser: session, currentView: "dashboard" }));
    await fetchData("BTC/USDT", "1h");
    startLiveUpdates();
  }

  function startLiveUpdates() {
    stopLiveUpdates();
    liveIntervalRef.current = window.setInterval(() => {
      if (app.currentView === "dashboard" || app.currentView === "market") {
        void fetchData(app.currentCoin, app.timeframe);
      }
    }, 45000);
  }

  function stopLiveUpdates() {
    if (liveIntervalRef.current) {
      window.clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
  }

  async function fetchData(coin = app.currentCoin, timeframe = app.timeframe) {
    setStatus("loading");
    try {
      const fetchedCandles = (await marketService.fetchCandles(coin, timeframe)) || generateFallbackCandles(timeframe);
      const indicators = calcIndicators(fetchedCandles);
      const signal = generateSignal(indicators);
      const plan = getOperationPlan(indicators, signal, Number(calculator.capital) || 0, timeframe);

      const mapSignals = await Promise.all(
        MAP_TIMEFRAMES.map(async (mapTf) => {
          const candles = (await marketService.fetchCandles(coin, mapTf)) || generateFallbackCandles(mapTf);
          const tfSignal = generateSignal(calcIndicators(candles));
          return {
            timeframe: mapTf,
            label: tfSignal.label,
            note: tfSignal.trend === "Neutral" ? "Sin sesgo claro" : tfSignal.trend,
          };
        }),
      );

      const ticker = await marketService.fetch24h(coin);
      const comparison = await Promise.all(
        COINS.slice(0, 4).map(async (symbol) => {
          const data = await marketService.fetch24h(symbol);
          const change = Number(data.priceChangePercent || 0);
          const coinRow: ComparisonCoin = {
            symbol,
            price: Number(data.lastPrice || 0),
            change,
            impulse: change > 2 ? "Fuerte" : change > 0 ? "Moderado" : "Débil",
          };
          return coinRow;
        }),
      );

      setApp((prev) => ({
        ...prev,
        currentCoin: coin,
        timeframe,
        candles: fetchedCandles,
        indicators,
        signal,
        plan,
        multiTimeframes: mapSignals,
        comparison,
      }));

      setMarket24h({
        change: Number(ticker.priceChangePercent || 0),
        high: Number(ticker.highPrice || 0),
        low: Number(ticker.lowPrice || 0),
        volume: `${(Number(ticker.volume || 0) / 1000).toFixed(1)} BTC`,
        updatedAt: nowTime(),
      });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  async function refreshProfileData() {
    try {
      const [connection, users] = await Promise.all([
        binanceService.getConnection().catch(() => null),
        app.currentUser?.role === "admin" ? authService.getUsers().catch(() => []) : Promise.resolve([]),
      ]);
      setApp((prev) => ({ ...prev, binanceConnection: connection, availableUsers: users }));
      if (connection?.accountAlias) {
        setBinanceForm((prev) => ({ ...prev, alias: connection.accountAlias || "" }));
      }
    } catch {
      // keep current UI state
    }
  }

  async function refreshPortfolio() {
    try {
      const payload = await binanceService.getPortfolio(app.portfolioPeriod);
      setApp((prev) => ({ ...prev, portfolioData: payload }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el balance.";
      setApp((prev) => ({
        ...prev,
        portfolioData: {
          assets: [],
          portfolio: {
            period: prev.portfolioPeriod,
            totalValue: 0,
            periodChangeValue: 0,
            periodChangePct: 0,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            winnersCount: 0,
            openPositionsCount: 0,
            cashValue: 0,
            positionsValue: 0,
            investedValue: 0,
          },
          summary: { accountType: message },
        },
      }));
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      await authService.login(loginForm.username.trim(), loginForm.password);
      const session = await authService.getSession();
      if (!session) return;
      setApp((prev) => ({ ...prev, currentUser: session }));
      setLoginForm({ username: "", password: "" });
      await fetchData(app.currentCoin, app.timeframe);
      startLiveUpdates();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      await authService.register(registerForm.displayName.trim(), registerForm.email.trim(), registerForm.password);
      const session = await authService.getSession();
      if (!session) return;
      setApp((prev) => ({ ...prev, currentUser: session }));
      setRegisterForm({ displayName: "", email: "", password: "" });
      await fetchData(app.currentCoin, app.timeframe);
      startLiveUpdates();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    }
  }

  async function handleLogout() {
    await authService.logout();
    stopLiveUpdates();
    setApp(INITIAL_STATE);
  }

  async function handleBinanceConnect() {
    try {
      await binanceService.connect(binanceForm.apiKey.trim(), binanceForm.apiSecret.trim(), binanceForm.alias.trim());
      setBinanceForm((prev) => ({ ...prev, apiSecret: "" }));
      await refreshProfileData();
      if (app.currentView === "journal") await refreshPortfolio();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo conectar Binance Demo Spot");
    }
  }

  async function handleBinanceDisconnect() {
    try {
      await binanceService.disconnect();
      setBinanceForm({ alias: "", apiKey: "", apiSecret: "" });
      await refreshProfileData();
      if (app.currentView === "journal") await refreshPortfolio();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo desconectar Binance Demo Spot");
    }
  }

  function handleSelectCoin(coin: string) {
    if (!coin) return;
    void fetchData(coin, app.timeframe);
  }

  function handleSuggest() {
    if (!app.plan) return;
    const tpPct = ((app.plan.tp - app.plan.entry) / app.plan.entry) * 100;
    const slPct = ((app.plan.entry - app.plan.sl) / app.plan.entry) * 100;
    setCalculator((prev) => ({
      ...prev,
      entry: app.plan?.entry.toFixed(2) || "",
      percent: tpPct.toFixed(2),
      stopPct: slPct.toFixed(2),
    }));
  }

  function handleUseCurrentPrice() {
    if (!app.indicators?.current) return;
    setCalculator((prev) => ({ ...prev, entry: app.indicators?.current.toFixed(2) || prev.entry }));
  }

  if (!app.currentUser) {
    return (
      <LoginOverlay
        authMode={app.authMode}
        error={loginError}
        loginForm={loginForm}
        registerForm={registerForm}
        onToggleMode={() => setApp((prev) => ({ ...prev, authMode: prev.authMode === "login" ? "register" : "login" }))}
        onLoginChange={(field, value) => setLoginForm((prev) => ({ ...prev, [field]: value }))}
        onRegisterChange={(field, value) => setRegisterForm((prev) => ({ ...prev, [field]: value }))}
        onLoginSubmit={handleLogin}
        onRegisterSubmit={handleRegister}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={app.currentUser}
        currentView={app.currentView}
        onViewChange={(view) => setApp((prev) => ({ ...prev, currentView: view }))}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <TopBar
          currentCoin={app.currentCoin}
          timeframe={app.timeframe}
          status={status}
          user={app.currentUser}
          showAdmin={app.currentUser.role === "admin"}
          theme={theme}
          onCoinChange={handleSelectCoin}
          onTimeframeChange={(timeframe) => {
            setApp((prev) => ({ ...prev, timeframe }));
            void fetchData(app.currentCoin, timeframe);
          }}
          onRefresh={() => void fetchData(app.currentCoin, app.timeframe)}
          onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          onOpenAdmin={() => setApp((prev) => ({ ...prev, currentView: "profile" }))}
          onLogout={handleLogout}
        />

        {app.currentView === "dashboard" ? (
          <DashboardView
            currentCoin={app.currentCoin}
            timeframe={app.timeframe}
            currentPrice={app.indicators?.current || 0}
            signal={app.signal}
            plan={app.plan}
            multiTimeframes={app.multiTimeframes}
            candles={app.candles}
            chartRef={chartRef}
          />
        ) : null}

        {app.currentView === "market" ? (
          <MarketView
            currentCoin={app.currentCoin}
            signal={app.signal}
            indicators={app.indicators}
            market24h={market24h}
            support={supportResistance.support}
            resistance={supportResistance.resistance}
          />
        ) : null}

        {app.currentView === "calculator" ? (
          <CalculatorView
            values={calculator}
            result={calculatorResult}
            onChange={(field, value) => setCalculator((prev) => ({ ...prev, [field]: value }))}
            onSuggest={handleSuggest}
            onCurrentPrice={handleUseCurrentPrice}
          />
        ) : null}

        {app.currentView === "compare" ? (
          <CompareView comparison={app.comparison} currentCoin={app.currentCoin} onSelectCoin={handleSelectCoin} />
        ) : null}

        {app.currentView === "learn" ? <LearnView /> : null}

        {app.currentView === "journal" ? (
          <BalanceView
            payload={app.portfolioData}
            period={app.portfolioPeriod}
            hideSmallAssets={app.hideSmallAssets}
            onPeriodChange={(period) => {
              setApp((prev) => ({ ...prev, portfolioPeriod: period }));
              void binanceService.getPortfolio(period).then((payload) => setApp((prev) => ({ ...prev, portfolioData: payload, portfolioPeriod: period })));
            }}
            onRefresh={() => void refreshPortfolio()}
            onToggleHideSmall={(value) => setApp((prev) => ({ ...prev, hideSmallAssets: value }))}
          />
        ) : null}

        {app.currentView === "profile" ? (
          <ProfileView
            user={app.currentUser}
            users={app.availableUsers}
            connection={app.binanceConnection}
            binanceForm={binanceForm}
            onBinanceFormChange={(field, value) => setBinanceForm((prev) => ({ ...prev, [field]: value }))}
            onConnect={handleBinanceConnect}
            onRefresh={() => void refreshProfileData()}
            onDisconnect={handleBinanceDisconnect}
          />
        ) : null}
      </main>
    </div>
  );
}
