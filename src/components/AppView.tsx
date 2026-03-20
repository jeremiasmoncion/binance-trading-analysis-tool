import { Suspense, lazy, type ReactNode, type RefObject } from "react";
import type { UserSession, ViewName } from "../types";
import { EmptyState } from "./ui/EmptyState";

const DashboardView = lazy(() => import("../views/DashboardView").then((module) => ({ default: module.DashboardView })));
const MemoryView = lazy(() => import("../views/MemoryView").then((module) => ({ default: module.MemoryView })));
const StatsView = lazy(() => import("../views/StatsView").then((module) => ({ default: module.StatsView })));
const TradingView = lazy(() => import("../views/TradingView").then((module) => ({ default: module.TradingView })));
const ControlOverviewView = lazy(() => import("../views/ControlOverviewView").then((module) => ({ default: module.ControlOverviewView })));
const BotSettingsView = lazy(() => import("../views/BotSettingsView").then((module) => ({ default: module.BotSettingsView })));
const ExecutionLogsView = lazy(() => import("../views/ExecutionLogsView").then((module) => ({ default: module.ExecutionLogsView })));
const SignalBotView = lazy(() => import("../views/SignalBotView").then((module) => ({ default: module.SignalBotView })));
const TemplatePlaceholderView = lazy(() => import("../views/TemplatePlaceholderView").then((module) => ({ default: module.TemplatePlaceholderView })));
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
          onNavigateView={props.onNavigateView}
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
      content = <ControlOverviewView onNavigateView={props.onNavigateView} />;
      break;
    case "control-bot-settings":
      content = <BotSettingsView />;
      break;
    case "control-execution-logs":
      content = <ExecutionLogsView />;
      break;
    case "ai-signal-bot":
      content = <SignalBotView onNavigateView={props.onNavigateView} />;
      break;
    case "ai-dca-bot":
      content = <TemplatePlaceholderView title="DCA Bot" subtitle="Template-aligned AI bot surface reserved for the DCA workflow." />;
      break;
    case "ai-arbitrage-bot":
      content = <TemplatePlaceholderView title="Arbitrage Bot" subtitle="Template-aligned AI bot surface reserved for the arbitrage workflow." />;
      break;
    case "ai-pump-screener":
      content = <TemplatePlaceholderView title="Pump Screener" subtitle="Template-aligned AI bot surface reserved for high-volatility discovery." />;
      break;
    case "defi-center":
      content = <TemplatePlaceholderView title="DeFi Center" subtitle="Section reserved for the DeFi Center flow defined in the template." />;
      break;
    case "yield-farming":
      content = <TemplatePlaceholderView title="Yield Farming" subtitle="Section reserved for the Yield Farming flow defined in the template." />;
      break;
    case "staking-pools":
      content = <TemplatePlaceholderView title="Staking Pools" subtitle="Section reserved for the Staking Pools flow defined in the template." />;
      break;
    case "liquidity-tracker":
      content = <TemplatePlaceholderView title="Liquidity Tracker" subtitle="Section reserved for the Liquidity Tracker flow defined in the template." />;
      break;
    case "portfolio-tracker":
      content = <TemplatePlaceholderView title="Portfolio Tracker" subtitle="Section reserved for the Portfolio Tracker flow defined in the template." />;
      break;
    case "wallets":
      content = <TemplatePlaceholderView title="Wallets" subtitle="Section reserved for the Wallets flow defined in the template." />;
      break;
    case "defi-protocols":
      content = <TemplatePlaceholderView title="DeFi Protocols" subtitle="Section reserved for the DeFi Protocols flow defined in the template." />;
      break;
    case "strategies-marketplace":
      content = <TemplatePlaceholderView title="Strategies Marketplace" subtitle="Section reserved for the marketplace flow defined in the template." />;
      break;
    case "bot-templates":
      content = <TemplatePlaceholderView title="Bot Templates" subtitle="Section reserved for the template library flow defined in the marketplace." />;
      break;
    case "preferences":
      content = <TemplatePlaceholderView title="Preferences" subtitle="Account settings surface aligned to the template account section." />;
      break;
    case "notifications":
      content = <TemplatePlaceholderView title="Notifications" subtitle="Account notifications surface aligned to the template account section." />;
      break;
    case "security-api-keys":
      content = <TemplatePlaceholderView title="Security & API Keys" subtitle="Account security surface aligned to the template account section." />;
      break;
    case "invite-friends":
      content = <TemplatePlaceholderView title="Invite Friends" subtitle="Referral surface aligned to the template account section." />;
      break;
    case "subscription":
      content = <TemplatePlaceholderView title="Subscription" subtitle="Plan and billing surface aligned to the template account section." />;
      break;
    case "help-center":
      content = <TemplatePlaceholderView title="Help Center" subtitle="Support surface aligned to the template account section." />;
      break;
    case "signals":
      content = <SignalBotView onNavigateView={props.onNavigateView} />;
      break;
    case "bots":
      content = <BotSettingsView />;
      break;
    case "market":
      content = <MarketView />;
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
