import { useMemo } from "react";
import { EmptyState } from "../ui/EmptyState";
import { SectionCard } from "../ui/SectionCard";
import { StatCard } from "../ui/StatCard";
import type { SignalSnapshot } from "../../types";
import {
  INITIAL_BOT_REGISTRY_STATE,
  createBotConsumableFeed,
  createBotRegistrySnapshot,
  createPublishedSignalFeedBundleFromMemory,
  rankPublishedFeed,
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
  selectDemotedRankedSignals,
  selectHighConfidenceRankedSignals,
  selectMarketDiscoveryRankedSignals,
  selectPriorityRankedSignals,
  selectPublishedSignals,
  selectRankedPublishedSignals,
  selectWatchlistFirstRankedSignals,
} from "../../domain";

interface SignalsBotsReadOnlyLabProps {
  signals: SignalSnapshot[];
  watchlistSymbols: string[];
}

export function SignalsBotsReadOnlyLab({ signals, watchlistSymbols }: SignalsBotsReadOnlyLabProps) {
  const readModel = useMemo(() => {
    const registry = createBotRegistrySnapshot(INITIAL_BOT_REGISTRY_STATE);
    const bots = selectBots(registry.state);
    const publishedFeeds = createPublishedSignalFeedBundleFromMemory(signals, { watchlistSymbols });
    const publishedSignals = selectPublishedSignals(publishedFeeds.all);
    const rankedPublishedFeed = rankPublishedFeed(publishedFeeds.all);
    const rankedPublishedSignals = selectRankedPublishedSignals(rankedPublishedFeed);
    const highConfidenceSignals = selectHighConfidenceRankedSignals(rankedPublishedFeed);
    const prioritySignals = selectPriorityRankedSignals(rankedPublishedFeed);
    const demotedSignals = selectDemotedRankedSignals(rankedPublishedFeed);
    const watchlistFirstSignals = selectWatchlistFirstRankedSignals(rankedPublishedFeed);
    const marketDiscoverySignals = selectMarketDiscoveryRankedSignals(rankedPublishedFeed);
    const botFeeds = bots.map((bot) => {
      const feed = createBotConsumableFeed(bot, rankedPublishedSignals, rankedPublishedFeed.generatedAt);
      return {
        bot,
        feed,
        accepted: selectAcceptedBotConsumableSignals(feed),
        blocked: selectBlockedBotConsumableSignals(feed),
      };
    });

    return {
      registry,
      publishedFeeds,
      publishedSignals,
      rankedPublishedFeed,
      rankedPublishedSignals,
      highConfidenceSignals,
      prioritySignals,
      demotedSignals,
      watchlistFirstSignals,
      marketDiscoverySignals,
      botFeeds,
    };
  }, [signals, watchlistSymbols]);

  if (!signals.length) {
    return (
      <SectionCard
        title="Signals + Bots Lab"
        subtitle="Superficie de validación read-only del dominio nuevo."
      >
        <EmptyState message="Todavía no hay snapshots en signal memory para construir el feed publicado." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Signals + Bots Lab"
      subtitle="Lectura read-only del dominio nuevo montada sobre signal memory snapshots, con ranking más estricto para discovery y prioridad clara para watchlist-first."
      helpTitle="Signals + Bots Lab"
      helpBody="Esta superficie valida el rediseño nuevo leyendo snapshots ya existentes y derivando feeds publicados y consumibles por bots dentro del dominio nuevo."
      helpBullets={[
        "La fuente base es signal memory, no execution runtime.",
        "Raw feed, ranked feed y bot-consumable feed se derivan por adapters de dominio.",
        "No hay persistencia nueva ni runtime paralelo en esta ronda.",
      ]}
    >
      <div className="domain-lab-hero">
        <div className="domain-lab-hero-copy">
          <span className="domain-lab-kicker">Signals Intelligence</span>
          <h3>Watchlist-first arriba, discovery más estricto abajo</h3>
          <p>
            Esta ronda endurece thresholds, separa mejor discovery de mercado frente a señales cercanas a la watchlist,
            y hace más visible por qué unas señales suben y otras dejan de escalar.
          </p>
        </div>
        <div className="domain-lab-quick-grid">
          <StatCard label="Snapshots base" value={String(signals.length)} sub="Fuente compartida desde signal memory" accentClass="accent-blue" />
          <StatCard label="Watchlist-first" value={String(readModel.watchlistFirstSignals.filter((signal) => signal.ranking.tier !== "low-visibility").length)} sub="Carril principal para señales más cercanas al operador" accentClass="accent-emerald" />
          <StatCard label="Market discovery" value={String(readModel.marketDiscoverySignals.filter((signal) => signal.ranking.tier !== "low-visibility").length)} sub={`${readModel.marketDiscoverySignals.filter((signal) => signal.ranking.tier === "low-visibility").length} quedan abajo por ruido`} accentClass="accent-amber" />
          <StatCard label="High confidence" value={String(readModel.highConfidenceSignals.length)} sub="Subset defendible tras threshold más duro" accentClass="accent-green" />
          <StatCard label="Bots en registry" value={String(readModel.registry.state.bots.length)} sub={`${readModel.botFeeds.filter((item) => item.bot.status === "active").length} activos · ${readModel.botFeeds.filter((item) => item.bot.aiPolicy.isolationScope === "isolated").length} aislados`} accentClass="accent-green" />
        </div>
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Overview del feed</strong>
            <span>Materia prima, discovery y subset fuerte en una lectura rápida</span>
          </div>
          <div className="domain-segment-row">
            <span className="domain-segment-chip is-active">Raw {readModel.publishedSignals.length}</span>
            <span className="domain-segment-chip">Ranked {readModel.rankedPublishedSignals.length}</span>
            <span className="domain-segment-chip">High confidence {readModel.highConfidenceSignals.length}</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.publishedSignals.slice(0, 4).map((signal) => (
              <div key={signal.id} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol} · {signal.context.timeframe}</strong>
                  <span className="domain-readonly-badge">{signal.audience === "watchlist" ? "Watchlist" : "Market"}</span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>Score {signal.context.score.toFixed(0)}</span>
                  <span>Visibility {signal.visibilityScore.toFixed(0)}</span>
                  <span>{signal.context.strategyId}{signal.context.strategyVersion ? ` · ${signal.context.strategyVersion}` : ""}</span>
                </div>
                <p>{signal.reasons[0]}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Ranked feed</strong>
            <span>Orden final después del filtro de ruido y claridad</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.rankedPublishedSignals.slice(0, 6).map((signal) => (
              <div key={signal.id} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol} · {signal.context.timeframe}</strong>
                  <span className={`domain-readonly-badge ${getTierClassName(signal.ranking.tier)}`}>
                    {signal.ranking.tier}
                  </span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>Raw {signal.visibilityScore.toFixed(0)}</span>
                  <span>Ranked {signal.ranking.compositeScore.toFixed(0)}</span>
                  <span>{signal.context.strategyId}</span>
                </div>
                <p>{signal.ranking.rationale[0]}</p>
                <div className="domain-policy-notes">
                  {signal.ranking.boosts.slice(0, 2).map((note) => (
                    <span key={`${signal.id}-boost-${note}`} className="domain-policy-pill is-boost">{note}</span>
                  ))}
                  {signal.ranking.penalties.slice(0, 2).map((note) => (
                    <span key={`${signal.id}-penalty-${note}`} className="domain-policy-pill is-penalty">{note}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Watchlist-first lane</strong>
            <span>Señales más cercanas a operación visible y seguimiento directo</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.watchlistFirstSignals
              .filter((signal) => signal.ranking.tier !== "low-visibility")
              .slice(0, 4)
              .map((signal) => (
                <div key={`watchlist-${signal.id}`} className="domain-readonly-item">
                  <div className="domain-readonly-item-top">
                    <strong>{signal.context.symbol} · {signal.context.timeframe}</strong>
                    <span className={`domain-readonly-badge ${getTierClassName(signal.ranking.tier)}`}>{signal.ranking.tier}</span>
                  </div>
                  <div className="domain-readonly-item-meta">
                    <span>Lane watchlist-first</span>
                    <span>Ranked {signal.ranking.compositeScore.toFixed(0)}</span>
                  </div>
                  <p>{signal.ranking.boosts.join(" · ")}</p>
                </div>
              ))}
          </div>
        </article>

        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Market-wide discovery</strong>
            <span>Descubrimiento más exigente para no contaminar el feed principal</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.marketDiscoverySignals.slice(0, 4).map((signal) => (
              <div key={`market-${signal.id}`} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol} · {signal.context.timeframe}</strong>
                  <span className={`domain-readonly-badge ${getTierClassName(signal.ranking.tier)}`}>{signal.ranking.tier}</span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>Lane market-discovery</span>
                  <span>Ranked {signal.ranking.compositeScore.toFixed(0)}</span>
                </div>
                <p>{(signal.ranking.penalties[0] || signal.ranking.rationale[0])}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Policy fit por bot</strong>
            <span>Cómo el ranked feed se transforma en consumo por bot</span>
          </div>
          <div className="domain-bot-policy-grid">
            {readModel.botFeeds.map(({ bot, accepted, blocked, feed }) => (
              <div key={bot.id} className="domain-bot-policy-card">
                <div className="domain-readonly-item-top">
                  <strong>{bot.name}</strong>
                  <span className={`domain-readonly-badge ${bot.aiPolicy.isolationScope === "isolated" ? "is-isolated" : ""}`}>
                    {bot.executionEnvironment} · {bot.automationMode}
                  </span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>{bot.universePolicy.kind}</span>
                  <span>{bot.stylePolicy.dominantStyle}</span>
                  <span>{bot.status}</span>
                </div>
                <div className="stats-grid compact-stats-grid no-bottom-gap">
                  <StatCard label="Aceptadas" value={String(accepted.length)} sub="Cumplen policy fit actual" accentClass="accent-emerald" />
                  <StatCard label="Bloqueadas" value={String(blocked.length)} sub="Quedan fuera por policy" accentClass="accent-amber" />
                </div>
                <div className="domain-policy-notes">
                  {(accepted[0] || feed.items[0]) ? (
                    (accepted[0] || feed.items[0]).policyNotes.map((note) => (
                      <span key={`${bot.id}-${note}`} className="domain-policy-pill">{note}</span>
                    ))
                  ) : (
                    <span className="domain-policy-pill">Sin señales derivadas todavía.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>High-confidence feed</strong>
            <span>Subset defendible después del ranking</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.highConfidenceSignals.slice(0, 4).map((signal) => (
              <div key={signal.id} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol}</strong>
                  <span className="domain-readonly-badge">High confidence</span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>{signal.context.timeframe}</span>
                  <span>{signal.context.direction}</span>
                  <span>{signal.ranking.compositeScore.toFixed(0)}</span>
                </div>
                <p>{signal.ranking.rationale.join(" · ")}</p>
                <div className="domain-policy-notes">
                  {signal.ranking.boosts.slice(0, 2).map((note) => (
                    <span key={`${signal.id}-hc-${note}`} className="domain-policy-pill is-boost">{note}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Ranking moves</strong>
            <span>Qué sube o baja y por qué</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.prioritySignals.slice(0, 2).map((signal) => (
              <div key={`promoted-${signal.id}`} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol} promovida</strong>
                  <span className="domain-readonly-badge is-accepted">{signal.ranking.tier}</span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>Raw {signal.visibilityScore.toFixed(0)}</span>
                  <span>Ranked {signal.ranking.compositeScore.toFixed(0)}</span>
                  <span>{signal.ranking.lane}</span>
                </div>
                <p>{signal.ranking.boosts.join(" · ") || "Sin boosts visibles."}</p>
              </div>
            ))}
            {readModel.demotedSignals.slice(0, 2).map((signal) => (
              <div key={`demoted-${signal.id}`} className="domain-readonly-item">
                <div className="domain-readonly-item-top">
                  <strong>{signal.context.symbol} degradada</strong>
                  <span className="domain-readonly-badge is-blocked">{signal.ranking.tier}</span>
                </div>
                <div className="domain-readonly-item-meta">
                  <span>Raw {signal.visibilityScore.toFixed(0)}</span>
                  <span>Ranked {signal.ranking.compositeScore.toFixed(0)}</span>
                  <span>{signal.ranking.lane}</span>
                </div>
                <p>{signal.ranking.penalties.join(" · ") || "Sin penalidades visibles."}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Bot-consumable examples</strong>
            <span>Derivación visible desde ranked feed + bot policy</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.botFeeds.flatMap(({ bot, accepted, blocked }) => {
              const sample = [...accepted.slice(0, 1), ...blocked.slice(0, 1)];
              return sample.map((signal) => (
                <div key={signal.id} className="domain-readonly-item">
                  <div className="domain-readonly-item-top">
                    <strong>{bot.name} {"->"} {signal.context.symbol}</strong>
                    <span className={`domain-readonly-badge ${signal.acceptedByPolicy ? "is-accepted" : "is-blocked"}`}>
                      {signal.acceptedByPolicy ? "Consumible" : "Bloqueada"}
                    </span>
                  </div>
                  <div className="domain-readonly-item-meta">
                    <span>{signal.context.timeframe}</span>
                    <span>{signal.context.strategyId}</span>
                    <span>{signal.requiredAutomationMode}</span>
                  </div>
                  <p>{signal.policyNotes.join(" · ")}</p>
                </div>
              ));
            })}
          </div>
        </article>
      </div>
    </SectionCard>
  );
}

function getTierClassName(tier: string): string {
  if (tier === "high-confidence") return "is-accepted";
  if (tier === "priority") return "is-priority";
  if (tier === "low-visibility") return "is-blocked";
  return "";
}
