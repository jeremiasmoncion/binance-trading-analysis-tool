import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useMemorySystemSelector } from "../data-platform/selectors";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectHighConfidenceRankedSignals,
  selectPriorityRankedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
} from "../domain";
import type { ViewName } from "../types";

type SignalBotTab = "active-signals" | "signal-history" | "performance" | "settings";

interface SignalBotViewProps {
  onNavigateView: (view: ViewName) => void;
}

export function SignalBotView({ onNavigateView }: SignalBotViewProps) {
  const [activeTab, setActiveTab] = useState<SignalBotTab>("active-signals");
  const systemData = useMemorySystemSelector();
  const signals = systemData.signalMemory;
  const watchlist = systemData.watchlists.find((item) => item.name === systemData.activeWatchlistName)?.coins || [];

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const signalBot = registry.state.bots.find((bot) => bot.slug === "signal-bot-core") || registry.state.bots[0];
    const publishedFeed = createPublishedSignalFeedBundleFromMemory(signals, { watchlistSymbols: watchlist }).all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const watchlistFirst = selectWatchlistFirstRankedSignals(rankedFeed);
    const priority = selectPriorityRankedSignals(rankedFeed);
    const highConfidence = selectHighConfidenceRankedSignals(rankedFeed);
    const botFeed = createBotConsumableFeed(signalBot, rankedSignals, rankedFeed.generatedAt);
    const botApproved = botFeed.items.filter((item) => item.acceptedByPolicy);

    return {
      signalBot,
      rankedSignals,
      watchlistFirst,
      priority,
      highConfidence,
      botApproved,
      openSignals: signals.filter((signal) => signal.outcome_status === "pending"),
      closedSignals: signals.filter((signal) => signal.outcome_status !== "pending"),
    };
  }, [signals, watchlist]);

  return (
    <div id="signalBotView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">AI Bot</span>
            <h1 className="template-page-title">Signal Bot</h1>
            <p className="template-page-subtitle">
              Flujo principal de señales orientado al usuario final: primero oportunidades activas, después historial,
              rendimiento y ajustes del bot.
            </p>
          </div>
          <div className="template-page-actions">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-primary" onClick={() => onNavigateView("control-bot-settings")}>
              Bot Settings
            </button>
          </div>
        </div>

        <div className="template-stats-grid">
          <StatCard label="Active Signals" value={String(readModel.priority.length)} sub="Feed priorizado listo para revisar" accentClass="accent-green" />
          <StatCard label="Win Rate" value={`${calculateWinRate(readModel.closedSignals).toFixed(1)}%`} sub="Historial cerrado de signal memory" accentClass="accent-blue" />
          <StatCard label="Total Profit (30d)" value={formatUsd(sumPnl(readModel.closedSignals))} sub="Resultado acumulado visible para el usuario" accentClass="accent-emerald" />
          <StatCard label="Pending Signals" value={String(readModel.openSignals.length)} sub="Todavía esperando resolución" accentClass="accent-amber" />
        </div>

        <SectionCard className="template-panel" actions={(
          <div className="template-toolbar">
            <button type="button" className="premium-action-button is-ghost">Export</button>
            <button type="button" className="premium-action-button is-ghost">Filters</button>
          </div>
        )}>
          <ModuleTabs
            items={[
              { key: "active-signals", label: "Active Signals" },
              { key: "signal-history", label: "Signal History" },
              { key: "performance", label: "Performance" },
              { key: "settings", label: "Bot Settings" },
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as SignalBotTab)}
          />

          {activeTab === "active-signals" ? (
            <>
              <div className="template-chip-row">
                <button type="button" className="template-chip is-active">All Signals</button>
                <button type="button" className="template-chip">Buy Only</button>
                <button type="button" className="template-chip">Sell Only</button>
                <button type="button" className="template-chip">Watchlist First</button>
                <button type="button" className="template-chip">High Confidence</button>
              </div>
              <div className="template-card-grid">
                {readModel.priority.slice(0, 9).map((signal) => (
                  <article key={signal.id} className={`template-signal-card ${signal.context.direction === "BUY" ? "is-buy" : signal.context.direction === "SELL" ? "is-sell" : ""}`}>
                    <div className="template-signal-card-head">
                      <div>
                        <h3>{signal.context.symbol}</h3>
                        <p>{signal.context.strategyId} · {signal.context.timeframe}</p>
                      </div>
                      <span className="template-signal-badge">{signal.context.direction}</span>
                    </div>
                    <div className="template-signal-metrics">
                      <div>
                        <span>Raw</span>
                        <strong>{signal.ranking.rawScore.toFixed(0)}</strong>
                      </div>
                      <div>
                        <span>Ranked</span>
                        <strong>{signal.ranking.compositeScore.toFixed(0)}</strong>
                      </div>
                      <div>
                        <span>Lane</span>
                        <strong>{signal.ranking.lane === "watchlist-first" ? "Watchlist" : "Discovery"}</strong>
                      </div>
                    </div>
                    <div className="template-progress-track">
                      <div className="template-progress-fill" style={{ width: `${Math.min(signal.ranking.compositeScore, 100)}%` }} />
                    </div>
                    <p className="template-signal-summary">{signal.ranking.summary}</p>
                    <div className="template-signal-foot">
                      <span>{signal.ranking.tier}</span>
                      <span>{signal.ranking.primaryReason}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "signal-history" ? (
            <div className="template-list-card">
              {readModel.closedSignals.slice(0, 10).map((signal) => (
                <div key={signal.id} className="template-list-row">
                  <div>
                    <strong>{signal.coin}</strong>
                    <span>{signal.timeframe} · {signal.setup_type || signal.signal_label}</span>
                  </div>
                  <div>
                    <strong>{Number(signal.signal_score || 0).toFixed(0)}</strong>
                    <span>{signal.outcome_status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "performance" ? (
            <div className="template-mini-grid">
              <MetricTile label="High confidence" value={String(readModel.highConfidence.length)} note="Subset más selectivo del feed." />
              <MetricTile label="Watchlist-first" value={String(readModel.watchlistFirst.length)} note="Lo más cercano a lo que el usuario ya sigue." />
              <MetricTile label="Consumible por bot" value={String(readModel.botApproved.length)} note="Señales que ya pasan la política actual." />
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="template-mini-grid">
              <MetricTile label="Environment" value={readModel.signalBot.executionEnvironment.toUpperCase()} note="Entorno operativo del Signal Bot." />
              <MetricTile label="Automation" value={readModel.signalBot.automationMode.toUpperCase()} note="Nivel de automatización visible al usuario." />
              <MetricTile label="Policy fit" value={`${readModel.botApproved.length}`} note="Señales aprobadas bajo reglas actuales." />
            </div>
          ) : null}
        </SectionCard>
      </section>
    </div>
  );
}

function MetricTile(props: { label: string; value: string; note: string }) {
  return (
    <div className="template-metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
    </div>
  );
}

function sumPnl(signals: Array<{ outcome_pnl: number }>) {
  return signals.reduce((sum, signal) => sum + Number(signal.outcome_pnl || 0), 0);
}

function calculateWinRate(signals: Array<{ outcome_status: string }>) {
  const closed = signals.filter((signal) => signal.outcome_status !== "pending");
  const wins = closed.filter((signal) => signal.outcome_status === "win").length;
  return closed.length ? (wins / closed.length) * 100 : 0;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
