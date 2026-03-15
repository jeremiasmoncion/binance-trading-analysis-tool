import type { RefObject } from "react";
import type { Candle, ComparisonCoin, Indicators, OperationPlan, PortfolioPayload, Signal, TimeframeSignal, UserSession, ViewName, BinanceConnection } from "../types";
import { BalanceView } from "../views/BalanceView";
import { CalculatorView } from "../views/CalculatorView";
import { CompareView } from "../views/CompareView";
import { DashboardView } from "../views/DashboardView";
import { LearnView } from "../views/LearnView";
import { MarketView } from "../views/MarketView";
import { ProfileView } from "../views/ProfileView";

interface AppViewProps {
  currentView: ViewName;
  currentCoin: string;
  timeframe: string;
  currentPrice: number;
  signal: Signal | null;
  plan: OperationPlan | null;
  multiTimeframes: TimeframeSignal[];
  candles: Candle[];
  chartRef: RefObject<HTMLCanvasElement | null>;
  indicators: Indicators | null;
  market24h: { change: number; high: number; low: number; volume: string; updatedAt: string };
  support: number;
  resistance: number;
  calculatorValues: { capital: string; entry: string; percent: string; stopPct: string };
  calculatorResult: {
    exitPrice: number;
    gross: number;
    commission: number;
    net: number;
    netPct: number;
    breakEven: number;
    stopPrice: number;
    stopLoss: number;
  };
  onCalculatorChange: (field: "capital" | "entry" | "percent" | "stopPct", value: string) => void;
  onSuggestPlan: () => void;
  onUseCurrentPrice: () => void;
  comparison: ComparisonCoin[];
  onSelectCoin: (coin: string) => void;
  portfolioData: PortfolioPayload | null;
  portfolioPeriod: string;
  hideSmallAssets: boolean;
  onPortfolioPeriodChange: (period: string) => void;
  onRefreshPortfolio: () => void;
  onToggleHideSmallAssets: (value: boolean) => void;
  user: UserSession;
  users: UserSession[];
  connection: BinanceConnection | null;
  binanceForm: { alias: string; apiKey: string; apiSecret: string };
  onBinanceFormChange: (field: "alias" | "apiKey" | "apiSecret", value: string) => void;
  onConnectBinance: () => void;
  onRefreshBinance: () => void;
  onDisconnectBinance: () => void;
}

export function AppView(props: AppViewProps) {
  switch (props.currentView) {
    case "dashboard":
      return (
        <DashboardView
          currentCoin={props.currentCoin}
          timeframe={props.timeframe}
          currentPrice={props.currentPrice}
          signal={props.signal}
          plan={props.plan}
          multiTimeframes={props.multiTimeframes}
          candles={props.candles}
          chartRef={props.chartRef}
        />
      );
    case "market":
      return (
        <MarketView
          currentCoin={props.currentCoin}
          signal={props.signal}
          indicators={props.indicators}
          market24h={props.market24h}
          support={props.support}
          resistance={props.resistance}
        />
      );
    case "calculator":
      return (
        <CalculatorView
          values={props.calculatorValues}
          result={props.calculatorResult}
          onChange={props.onCalculatorChange}
          onSuggest={props.onSuggestPlan}
          onCurrentPrice={props.onUseCurrentPrice}
        />
      );
    case "compare":
      return (
        <CompareView
          comparison={props.comparison}
          currentCoin={props.currentCoin}
          onSelectCoin={props.onSelectCoin}
        />
      );
    case "learn":
      return <LearnView />;
    case "journal":
      return (
        <BalanceView
          payload={props.portfolioData}
          period={props.portfolioPeriod}
          hideSmallAssets={props.hideSmallAssets}
          onPeriodChange={props.onPortfolioPeriodChange}
          onRefresh={props.onRefreshPortfolio}
          onToggleHideSmall={props.onToggleHideSmallAssets}
        />
      );
    case "profile":
      return (
        <ProfileView
          user={props.user}
          users={props.users}
          connection={props.connection}
          binanceForm={props.binanceForm}
          onBinanceFormChange={props.onBinanceFormChange}
          onConnect={props.onConnectBinance}
          onRefresh={props.onRefreshBinance}
          onDisconnect={props.onDisconnectBinance}
        />
      );
    default:
      return null;
  }
}
