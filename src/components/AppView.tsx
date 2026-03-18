import type { RefObject } from "react";
import type { BinanceConnection, Candle, ComparisonCoin, DashboardAnalysis, ExecutionCenterPayload, Indicators, OperationPlan, PortfolioPayload, Signal, SignalOutcomeStatus, SignalSnapshot, StrategyCandidate, StrategyDescriptor, TimeframeSignal, UserSession, ViewName, WatchlistGroup } from "../types";
import { BalanceView } from "../views/BalanceView";
import { CalculatorView } from "../views/CalculatorView";
import { CompareView } from "../views/CompareView";
import { ControlPanelView } from "../views/ControlPanelView";
import { DashboardView } from "../views/DashboardView";
import { LearnView } from "../views/LearnView";
import { MemoryView } from "../views/MemoryView";
import { MarketView } from "../views/MarketView";
import { ProfileView } from "../views/ProfileView";
import { StatsView } from "../views/StatsView";
import { TradingView } from "../views/TradingView";

interface AppViewProps {
  currentView: ViewName;
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
  switch (props.currentView) {
    case "dashboard":
      return (
        <DashboardView
          currentCoin={props.currentCoin}
          timeframe={props.timeframe}
          currentPrice={props.currentPrice}
          signal={props.signal}
          plan={props.plan}
          analysis={props.analysis}
          strategy={props.strategy}
          strategyCandidates={props.strategyCandidates}
          strategyRefreshIntervalMs={props.strategyRefreshIntervalMs}
          multiTimeframes={props.multiTimeframes}
          candles={props.candles}
          chartRef={props.chartRef}
          onSaveSignal={props.onSaveSignal}
        />
      );
    case "memory":
      return (
        <MemoryView
          signals={props.signalMemory}
          watchlist={props.watchlist}
          executionCenter={props.executionCenter}
          onRefreshExecutionCenter={props.onRefreshExecutionCenter}
          onUpdateSignal={props.onUpdateSignal}
        />
      );
    case "stats":
      return <StatsView portfolioData={props.portfolioData} executionCenter={props.executionCenter} />;
    case "trading":
      return <TradingView executionCenter={props.executionCenter} signals={props.signalMemory} />;
    case "control-overview":
    case "control-bots":
    case "control-history":
      return (
        <ControlPanelView
          currentTab={props.currentView}
          onTabChange={(tab) => props.onNavigateView(tab)}
        />
      );
    case "market":
      return (
        <MarketView
          currentCoin={props.currentCoin}
          watchlists={props.watchlists}
          watchlist={props.watchlist}
          activeWatchlistName={props.activeWatchlistName}
          signal={props.signal}
          indicators={props.indicators}
          market24h={props.market24h}
          support={props.support}
          resistance={props.resistance}
          onSelectCoin={props.onSelectCoin}
          onToggleWatchlist={props.onToggleWatchlist}
          onReplaceWatchlistCoins={props.onReplaceWatchlistCoins}
          onCreateWatchlist={props.onCreateWatchlist}
          onRenameWatchlist={props.onRenameWatchlist}
          onDeleteWatchlist={props.onDeleteWatchlist}
          onSetActiveWatchlist={props.onSetActiveWatchlist}
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
    case "balance":
      return (
        <BalanceView
          payload={props.portfolioData}
          period={props.portfolioPeriod}
          hideSmallAssets={props.hideSmallAssets}
          onPeriodChange={props.onPortfolioPeriodChange}
          onRefresh={props.onRefreshPortfolio}
          onRefreshFull={props.onRefreshPortfolioFull}
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
