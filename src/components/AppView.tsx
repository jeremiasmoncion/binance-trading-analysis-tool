import { Suspense, lazy, type ReactNode, type RefObject } from "react";
import type { BinanceConnection, Candle, ComparisonCoin, DashboardAnalysis, DashboardSummaryPayload, ExecutionCenterPayload, Indicators, OperationPlan, PortfolioPayload, Signal, SignalOutcomeStatus, SignalSnapshot, StrategyCandidate, StrategyDescriptor, TimeframeSignal, UserSession, ViewName, WatchlistGroup } from "../types";
import { EmptyState } from "./ui/EmptyState";

const DashboardView = lazy(() => import("../views/DashboardView").then((module) => ({ default: module.DashboardView })));
const MemoryView = lazy(() => import("../views/MemoryView").then((module) => ({ default: module.MemoryView })));
const StatsView = lazy(() => import("../views/StatsView").then((module) => ({ default: module.StatsView })));
const TradingView = lazy(() => import("../views/TradingView").then((module) => ({ default: module.TradingView })));
const ControlPanelView = lazy(() => import("../views/ControlPanelView").then((module) => ({ default: module.ControlPanelView })));
const MarketView = lazy(() => import("../views/MarketView").then((module) => ({ default: module.MarketView })));
const CalculatorView = lazy(() => import("../views/CalculatorView").then((module) => ({ default: module.CalculatorView })));
const CompareView = lazy(() => import("../views/CompareView").then((module) => ({ default: module.CompareView })));
const LearnView = lazy(() => import("../views/LearnView").then((module) => ({ default: module.LearnView })));
const BalanceView = lazy(() => import("../views/BalanceView").then((module) => ({ default: module.BalanceView })));
const ProfileView = lazy(() => import("../views/ProfileView").then((module) => ({ default: module.ProfileView })));

interface AppViewProps {
  currentView: ViewName;
  theme: "light" | "dark";
  onNavigateView: (view: ViewName) => void;
  currentCoin: string;
  watchlists: WatchlistGroup[];
  watchlist: string[];
  activeWatchlistName: string;
  timeframe: string;
  currentPrice: number;
  signal: Signal | null;
  plan: OperationPlan | null;
  analysis: DashboardAnalysis | null;
  strategy: StrategyDescriptor;
  strategyCandidates: StrategyCandidate[];
  strategyRefreshIntervalMs: number;
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
  onToggleWatchlist: (coin: string) => void;
  onReplaceWatchlistCoins: (name: string, coins: string[]) => Promise<void>;
  onCreateWatchlist: (name: string) => Promise<void>;
  onRenameWatchlist: (name: string, nextName: string) => Promise<void>;
  onDeleteWatchlist: (name: string) => Promise<void>;
  onSetActiveWatchlist: (name: string) => Promise<void>;
  portfolioData: PortfolioPayload | null;
  executionCenter: ExecutionCenterPayload | null;
  dashboardSummary: DashboardSummaryPayload | null;
  portfolioPeriod: string;
  hideSmallAssets: boolean;
  onPortfolioPeriodChange: (period: string) => void;
  onRefreshPortfolio: () => void;
  onRefreshPortfolioFull: () => void;
  onRefreshExecutionCenter: () => Promise<unknown>;
  onToggleHideSmallAssets: (value: boolean) => void;
  signalMemory: SignalSnapshot[];
  onSaveSignal: () => void;
  onUpdateSignal: (id: number, outcomeStatus: SignalOutcomeStatus, outcomePnl: number, note: string) => void;
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
  let content: ReactNode = null;

  switch (props.currentView) {
    case "dashboard":
      content = (
        <DashboardView
          theme={props.theme}
          chartRef={props.chartRef}
          onSaveSignal={props.onSaveSignal}
        />
      );
      break;
    case "memory":
      content = (
        <MemoryView
          onUpdateSignal={props.onUpdateSignal}
        />
      );
      break;
    case "stats":
      content = <StatsView />;
      break;
    case "trading":
      content = <TradingView />;
      break;
    case "control-overview":
    case "control-bots":
    case "control-history":
      content = (
        <ControlPanelView
          currentTab={props.currentView}
          onTabChange={(tab) => props.onNavigateView(tab)}
        />
      );
      break;
    case "market":
      content = (
        <MarketView
          onSelectCoin={props.onSelectCoin}
          onToggleWatchlist={props.onToggleWatchlist}
          onReplaceWatchlistCoins={props.onReplaceWatchlistCoins}
          onCreateWatchlist={props.onCreateWatchlist}
          onRenameWatchlist={props.onRenameWatchlist}
          onDeleteWatchlist={props.onDeleteWatchlist}
          onSetActiveWatchlist={props.onSetActiveWatchlist}
        />
      );
      break;
    case "calculator":
      content = (
        <CalculatorView
          values={props.calculatorValues}
          result={props.calculatorResult}
          onChange={props.onCalculatorChange}
          onSuggest={props.onSuggestPlan}
          onCurrentPrice={props.onUseCurrentPrice}
        />
      );
      break;
    case "compare":
      content = (
        <CompareView
          comparison={props.comparison}
          currentCoin={props.currentCoin}
          onSelectCoin={props.onSelectCoin}
        />
      );
      break;
    case "learn":
      content = <LearnView />;
      break;
    case "balance":
      content = (
        <BalanceView />
      );
      break;
    case "profile":
      content = (
        <ProfileView
          user={props.user}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <Suspense fallback={<EmptyState message="Cargando vista..." className="portfolio-empty" />}>
      {content}
    </Suspense>
  );
}
