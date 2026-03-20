import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useSignalsBotsFeedSelector } from "../data-platform/selectors";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectHighConfidenceRankedSignals,
  selectMarketDiscoveryRankedSignals,
  selectPriorityRankedSignals,
  selectPublishedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
} from "../domain";

type SignalsWorkspaceTab = "overview" | "watchlist" | "discovery" | "high-confidence" | "history";

export function SignalsView() {
  const feedData = useSignalsBotsFeedSelector();
  const [activeTab, setActiveTab] = useState<SignalsWorkspaceTab>("overview");
  const signals = feedData.signalMemory;
  const watchlist = feedData.activeWatchlistCoins;

  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const publishedFeed = createPublishedSignalFeedBundleFromMemory(signals, { watchlistSymbols: watchlist }).all;
    const rankedFeed = rankPublishedFeed(publishedFeed);
    const rankedSignals = selectRankedPublishedSignals(rankedFeed);
    const acceptedByBots = registry.state.bots.reduce((count, bot) => (
      count + createBotConsumableFeed(bot, rankedSignals, rankedFeed.generatedAt).items.filter((signal) => signal.policyMatches.universe && signal.policyMatches.timeframe && signal.policyMatches.strategy).length
    ), 0);

    return {
      raw: selectPublishedSignals(publishedFeed),
      ranked: rankedSignals,
      watchlistFirst: selectWatchlistFirstRankedSignals(rankedFeed),
      marketDiscovery: selectMarketDiscoveryRankedSignals(rankedFeed),
      highConfidence: selectHighConfidenceRankedSignals(rankedFeed),
      priority: selectPriorityRankedSignals(rankedFeed),
      acceptedByBots,
    };
  }, [signals, watchlist]);

  const watchlistVisible = readModel.watchlistFirst.filter((signal) => signal.ranking.tier !== "low-visibility");
  const discoveryVisible = readModel.marketDiscovery.filter((signal) => signal.ranking.tier !== "low-visibility");

  return (
    <div id="signalsWorkspaceView" className="view-panel active">
      <section className="workspace-shell">
        <div className="workspace-hero workspace-hero-signals">
          <div className="workspace-hero-copy">
            <span className="workspace-kicker">Signals</span>
            <h1>Oportunidades claras, primero para tu watchlist</h1>
            <p>
              Esta nueva superficie reemplaza la lectura vieja mezclada. Aquí el usuario ve primero qué señales importan,
              cuáles son de descubrimiento y cuáles ya se sienten suficientemente fuertes para actuar.
            </p>
          </div>
          <div className="workspace-hero-actions">
            <button type="button" className="premium-action-button is-primary">Explorar señales</button>
            <button type="button" className="premium-action-button is-ghost">Historial</button>
          </div>
        </div>

        <div className="workspace-stats-grid">
          <StatCard label="Señales visibles" value={String(readModel.priority.length)} sub="Lo más útil ahora mismo" accentClass="accent-blue" />
          <StatCard label="Watchlist-first" value={String(watchlistVisible.length)} sub="Prioridad para lo que ya sigues" accentClass="accent-emerald" />
          <StatCard label="Discovery" value={String(discoveryVisible.length)} sub="Mercado general, con poda más dura" accentClass="accent-amber" />
          <StatCard label="Alta confianza" value={String(readModel.highConfidence.length)} sub="Subset pequeño y defendible" accentClass="accent-green" />
        </div>

        <ModuleTabs
          items={[
            { key: "overview", label: "Overview" },
            { key: "watchlist", label: "Watchlist" },
            { key: "discovery", label: "Market discovery" },
            { key: "high-confidence", label: "Alta confianza" },
            { key: "history", label: "Historial" },
          ]}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as SignalsWorkspaceTab)}
        />

        {activeTab === "overview" ? (
          <div className="workspace-grid">
            <SectionCard
              title="Overview"
              subtitle="Resumen rápido del feed que hoy sí vale la pena mirar."
              className="workspace-panel"
            >
              <div className="workspace-list">
                {readModel.priority.slice(0, 4).map((signal) => (
                  <SignalCard
                    key={signal.id}
                    title={`${signal.context.symbol} · ${signal.context.timeframe}`}
                    lane={signal.ranking.lane === "watchlist-first" ? "Watchlist" : "Discovery"}
                    value={`${signal.ranking.compositeScore.toFixed(0)} pts`}
                    detail={signal.ranking.summary}
                    meta={`${signal.ranking.tier} · ${signal.ranking.primaryReason}`}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Lo que puede consumir un bot"
              subtitle="Traducido para el usuario: cuántas señales ya están lo bastante limpias para alimentar bots."
              className="workspace-panel"
            >
              <div className="workspace-mini-metrics">
                <MetricTile label="Señales publicadas" value={String(readModel.raw.length)} note="Base total leída desde signal memory" />
                <MetricTile label="Señales rankeadas" value={String(readModel.ranked.length)} note="Ordenadas para reducir ruido" />
                <MetricTile label="Aptas para bots" value={String(readModel.acceptedByBots)} note="Coinciden con políticas de bots actuales" />
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "watchlist" ? (
          <SectionCard
            title="Watchlist-first"
            subtitle="Lo más importante para el usuario final: oportunidades dentro de lo que ya sigue."
            className="workspace-panel"
          >
            <div className="signal-card-grid">
              {watchlistVisible.slice(0, 8).map((signal) => (
                <SignalCard
                  key={signal.id}
                  title={`${signal.context.symbol} · ${signal.context.direction.toUpperCase()}`}
                  lane={signal.context.timeframe}
                  value={`${signal.ranking.compositeScore.toFixed(0)} pts`}
                  detail={signal.ranking.summary}
                  meta={`Confianza ${signal.ranking.tier}`}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "discovery" ? (
          <SectionCard
            title="Market discovery"
            subtitle="Descubrimiento del mercado general con filtro más duro para que no se vuelva ruido."
            className="workspace-panel"
          >
            <div className="signal-card-grid">
              {discoveryVisible.slice(0, 8).map((signal) => (
                <SignalCard
                  key={signal.id}
                  title={`${signal.context.symbol} · ${signal.context.direction.toUpperCase()}`}
                  lane={signal.context.timeframe}
                  value={`${signal.ranking.compositeScore.toFixed(0)} pts`}
                  detail={signal.ranking.primaryReason}
                  meta={signal.ranking.summary}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "high-confidence" ? (
          <SectionCard
            title="Alta confianza"
            subtitle="El subconjunto pequeño que mejor traduce la lógica nueva a un flujo claro para usuario."
            className="workspace-panel"
          >
            <div className="signal-card-grid signal-card-grid-spotlight">
              {readModel.highConfidence.slice(0, 6).map((signal) => (
                <SignalCard
                  key={signal.id}
                  title={`${signal.context.symbol} · ${signal.context.strategyId}`}
                  lane={signal.context.timeframe}
                  value={`${signal.ranking.compositeScore.toFixed(0)} pts`}
                  detail={signal.ranking.summary}
                  meta={`Pasa a alta confianza por ${signal.ranking.primaryReason}`}
                  spotlight
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "history" ? (
          <SectionCard
            title="Historial reciente"
            subtitle="Vista compacta del historial para que el usuario vea actividad sin entrar a diagnósticos pesados."
            className="workspace-panel"
          >
            <div className="workspace-history-list">
              {signals.slice(0, 10).map((signal) => (
                <div key={signal.id} className="workspace-history-row">
                  <div>
                    <strong>{signal.coin}</strong>
                    <span>{signal.timeframe} · {signal.setup_type || signal.signal_label}</span>
                  </div>
                  <div>
                    <strong>{signal.signal_score.toFixed(0)}</strong>
                    <span>{signal.outcome_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}
      </section>
    </div>
  );
}

function SignalCard(props: {
  title: string;
  lane: string;
  value: string;
  detail: string;
  meta: string;
  spotlight?: boolean;
}) {
  return (
    <article className={`signal-workspace-card${props.spotlight ? " is-spotlight" : ""}`}>
      <div className="signal-workspace-card-top">
        <div>
          <h3>{props.title}</h3>
          <p>{props.lane}</p>
        </div>
        <span className="signal-workspace-chip">{props.value}</span>
      </div>
      <strong className="signal-workspace-detail">{props.detail}</strong>
      <span className="signal-workspace-meta">{props.meta}</span>
    </article>
  );
}

function MetricTile(props: { label: string; value: string; note: string }) {
  return (
    <div className="workspace-metric-tile">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.note}</small>
    </div>
  );
}
