import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import {
  createBotConsumableFeed,
} from "../domain";
import { useMarketSignalsCore } from "../hooks/useMarketSignalsCore";
import { useSelectedBotState } from "../hooks/useSelectedBot";

type SignalsWorkspaceTab = "overview" | "watchlist" | "discovery" | "operational" | "ai-prioritized" | "history";

export function SignalsView() {
  const core = useMarketSignalsCore();
  const { state: registryState, selectedBot } = useSelectedBotState();
  const [activeTab, setActiveTab] = useState<SignalsWorkspaceTab>("overview");
  const signals = core.signalCore.signalMemory;

  const readModel = useMemo(() => {
    const activeBot = selectedBot || registryState.bots[0] || null;
    const acceptedByBots = registryState.bots.reduce((count, bot) => (
      count + createBotConsumableFeed(bot, core.signalCore.subsets.rankedSignals, core.signalCore.feeds.ranked.generatedAt).items.filter((signal) => signal.policyMatches.universe && signal.policyMatches.timeframe && signal.policyMatches.strategy).length
    ), 0);

    return {
      raw: core.signalCore.subsets.publishedSignals,
      ranked: core.signalCore.subsets.rankedSignals,
      watchlistFirst: core.signalCore.subsets.watchlistSignals,
      marketDiscovery: core.signalCore.subsets.marketWideSignals,
      highConfidence: core.signalCore.subsets.highConfidenceSignals,
      priority: core.signalCore.subsets.operableSignals,
      observational: core.signalCore.subsets.observationalSignals,
      informational: core.signalCore.subsets.informationalSignals,
      aiPrioritized: core.signalCore.subsets.aiPrioritizedSignals,
      eligibleCandidates: core.signalCore.subsets.eligibleExecutionCandidates,
      blockedCandidates: core.signalCore.subsets.blockedExecutionCandidates,
      activeBotConsumable: core.signalCore.subsets.botConsumableSignals,
      acceptedByBots,
      activeOpportunity: core.marketCore.activeOpportunity,
      activeBotName: activeBot?.name || "Signal Bot",
    };
  }, [core, registryState.bots, selectedBot]);

  const watchlistVisible = readModel.watchlistFirst.filter((signal) => signal.ranking.tier !== "low-visibility");
  const discoveryVisible = readModel.marketDiscovery.filter((signal) => signal.ranking.tier !== "low-visibility");
  const scannerDiscovery = core.signalCore.scannerDiscovery;
  const marketWideContext = core.signalCore.marketWideContext;
  const operationalContext = core.signalCore.operationalContext;

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
          <StatCard label="AI-prioritized" value={String(readModel.aiPrioritized.length)} sub="Promovidas por la capa adaptativa actual" accentClass="accent-green" />
        </div>

        <ModuleTabs
          items={[
            { key: "overview", label: "Overview" },
            { key: "watchlist", label: "Watchlist" },
            { key: "discovery", label: "Market discovery" },
            { key: "operational", label: "Operational" },
            { key: "ai-prioritized", label: "AI prioritized" },
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
            {readModel.activeOpportunity ? (
              <div className="workspace-mini-metrics with-top-gap">
                <MetricTile label="Mercado activo" value={core.marketCore.currentCoin} note={`Timeframe ${core.marketCore.timeframe} • precio ${formatCompactUsd(core.marketCore.currentPrice)}`} />
                <MetricTile label="Oportunidad líder" value={readModel.activeOpportunity.strategy.label} note={`${readModel.activeOpportunity.signal.label} • score ${Math.round(readModel.activeOpportunity.rankScore)}`} />
                <MetricTile label="Bias MTF" value={String(core.marketCore.multiTimeframes.filter((item) => item.aligned).length)} note="timeframes alineados con la oportunidad principal" />
                <MetricTile label="Scanner activo" value={scannerDiscovery.activeListName} note={`${scannerDiscovery.watchedCoinsCount} monedas • ${scannerDiscovery.latestRunSignalsCreated} señales creadas en el último scan`} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Lo que puede consumir un bot"
            subtitle="Traducido para el usuario: cuántas señales ya están lo bastante limpias para alimentar bots."
            className="workspace-panel"
          >
            <div className="workspace-mini-metrics">
              <MetricTile label="Señales publicadas" value={String(readModel.raw.length)} note="Base total leída desde signal memory" />
              <MetricTile label="Señales rankeadas" value={String(readModel.ranked.length)} note="Ordenadas para reducir ruido" />
              <MetricTile label="Observacionales" value={String(readModel.observational.length)} note="Visibles, pero todavía no pasan al cohort operativo" />
              <MetricTile label="Informativas" value={String(readModel.informational.length)} note="Lectura útil, pero sin prioridad operativa todavía" />
              <MetricTile label="Aptas para bots" value={String(readModel.acceptedByBots)} note="Coinciden con políticas de bots actuales" />
              <MetricTile label="Feed del bot activo" value={String(readModel.activeBotConsumable.length)} note={`Subset consumible para ${readModel.activeBotName}`} />
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
            <div className="workspace-mini-metrics">
              <MetricTile label="Feed source" value={marketWideContext.discoveryFeedSource} note="De dónde sale hoy el discovery market-wide compartido" />
              <MetricTile label="Último scan" value={marketWideContext.latestScanSource || "Sin fuente"} note={`${scannerDiscovery.latestRunFrames} marcos · ${scannerDiscovery.latestRunSignalsCreated} señales creadas`} />
              <MetricTile label="Scheduler" value={marketWideContext.latestSchedulerRunAt ? "Activo" : "Sin evidencia"} note={`${marketWideContext.latestSchedulerSignalsCreated} creadas · ${marketWideContext.latestSchedulerSignalsClosed} cerradas`} />
              <MetricTile label="Cooldown" value={marketWideContext.cooldownActive ? "Activo" : "Libre"} note={marketWideContext.activeCooldownUntil || "Sin enfriamiento automático"} />
            </div>
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

        {activeTab === "ai-prioritized" ? (
          <SectionCard
            title="AI-prioritized"
            subtitle="Señales que la capa adaptativa actual está empujando con más convicción dentro del sistema."
            className="workspace-panel"
          >
            <div className="signal-card-grid signal-card-grid-spotlight">
              {readModel.aiPrioritized.slice(0, 6).map((signal) => (
                <SignalCard
                  key={signal.id}
                  title={`${signal.context.symbol} · ${signal.context.strategyId}`}
                  lane={signal.context.timeframe}
                  value={`${signal.ranking.compositeScore.toFixed(0)} pts`}
                  detail={signal.ranking.summary}
                  meta={`Promovida por ${signal.ranking.primaryReason}`}
                  spotlight
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "operational" ? (
          <SectionCard
            title="Operational funnel"
            subtitle="Separación clara entre lo elegible para operar y lo que hoy queda bloqueado por reglas."
            className="workspace-panel"
          >
            <div className="workspace-mini-metrics">
              <MetricTile label="Elegibles" value={String(readModel.eligibleCandidates.length)} note="Cohorte que hoy sí pasa el gate operativo" />
              <MetricTile label="Bloqueadas" value={String(readModel.blockedCandidates.length)} note="Candidatas reales que fueron frenadas por reglas" />
              <MetricTile label="Operables visibles" value={String(readModel.priority.length)} note="Subset priorizado en el producto" />
              <MetricTile label="Observacionales" value={String(readModel.observational.length)} note="Todavía no pasan a ejecución" />
              <MetricTile label="RR elegible" value={operationalContext.eligibleAvgRr ? operationalContext.eligibleAvgRr.toFixed(2) : "--"} note={`Score medio ${operationalContext.eligibleAvgScore.toFixed(0)} · source ${operationalContext.feedSource}`} />
              <MetricTile label="Auto órdenes" value={String(operationalContext.latestRunAutoOrdersPlaced)} note={`${operationalContext.latestRunAutoOrdersBlocked} bloqueadas · ${operationalContext.latestRunAutoOrdersSkipped} omitidas`} />
            </div>
            <div className="signal-card-grid with-top-gap">
              {readModel.eligibleCandidates.slice(0, 4).map((candidate) => (
                <SignalCard
                  key={candidate.id}
                  title={`${candidate.symbol} · ${candidate.side || "NEUTRAL"}`}
                  lane={candidate.timeframe}
                  value={`${candidate.score.toFixed(0)} pts`}
                  detail={`RR ${candidate.rrRatio.toFixed(2)} · ${candidate.strategyId}`}
                  meta={candidate.reasons[0] || "Elegible por reglas actuales"}
                />
              ))}
              {readModel.blockedCandidates.slice(0, 4).map((candidate) => (
                <SignalCard
                  key={candidate.id}
                  title={`${candidate.symbol} · bloqueada`}
                  lane={candidate.timeframe}
                  value={`${candidate.score.toFixed(0)} pts`}
                  detail={`RR ${candidate.rrRatio.toFixed(2)} · ${candidate.strategyId}`}
                  meta={candidate.reasons[0] || "Bloqueada por reglas actuales"}
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

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number(value || 0));
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
