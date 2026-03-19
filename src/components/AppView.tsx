import { Suspense, lazy, type ReactNode, type RefObject } from "react";
import type { UserSession, ViewName } from "../types";
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
  chartRef: RefObject<HTMLCanvasElement | null>;
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
  onSaveSignal: () => void;
  user: UserSession;
  onSelectCoin: (coin: string) => void;
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
      content = <MemoryView />;
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
      content = <CompareView />;
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
