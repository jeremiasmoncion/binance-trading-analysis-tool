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
  selectAcceptedBotConsumableSignals,
  selectBlockedBotConsumableSignals,
  selectBots,
  selectHighConfidencePublishedSignals,
  selectPublishedSignals,
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
    const highConfidenceSignals = selectHighConfidencePublishedSignals(publishedFeeds.all);
    const botFeeds = bots.map((bot) => {
      const feed = createBotConsumableFeed(bot, publishedSignals, publishedFeeds.all.generatedAt);
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
      highConfidenceSignals,
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
      subtitle="Lectura read-only del dominio nuevo montada sobre signal memory snapshots, sin tocar el hot path operativo."
      helpTitle="Signals + Bots Lab"
      helpBody="Esta superficie valida el rediseño nuevo leyendo snapshots ya existentes y derivando feeds publicados y consumibles por bots dentro del dominio nuevo."
      helpBullets={[
        "La fuente base es signal memory, no execution runtime.",
        "Published feed y bot-consumable feed se derivan por adapters de dominio.",
        "No hay persistencia nueva ni runtime paralelo en esta ronda.",
      ]}
    >
      <div className="stats-grid compact-stats-grid">
        <StatCard label="Snapshots base" value={String(signals.length)} sub="Fuente compartida desde signal memory" accentClass="accent-blue" />
        <StatCard label="Published feed" value={String(readModel.publishedSignals.length)} sub={`${readModel.publishedFeeds.watchlist.items.length} watchlist · ${readModel.publishedFeeds.marketWide.items.length} market-wide`} accentClass="accent-emerald" />
        <StatCard label="High confidence" value={String(readModel.highConfidenceSignals.length)} sub="Señales con visibility score elevado" accentClass="accent-amber" />
        <StatCard label="Bots en registry" value={String(readModel.registry.state.bots.length)} sub={`${readModel.botFeeds.filter((item) => item.bot.status === "active").length} activos · ${readModel.botFeeds.filter((item) => item.bot.aiPolicy.isolationScope === "isolated").length} aislados`} accentClass="accent-green" />
      </div>

      <div className="domain-readonly-grid">
        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Published signals</strong>
            <span>Top priorizadas desde signal memory</span>
          </div>
          <div className="domain-readonly-list">
            {readModel.publishedSignals.slice(0, 6).map((signal) => (
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
            <strong>Policy fit por bot</strong>
            <span>Cómo el feed publicado se transforma en consumo por bot</span>
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
            <span>Subset listo para priorización posterior</span>
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
                  <span>{signal.visibilityScore.toFixed(0)}</span>
                </div>
                <p>{signal.reasons.join(" · ")}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="domain-readonly-card">
          <div className="domain-readonly-head">
            <strong>Bot-consumable examples</strong>
            <span>Derivación visible desde published feed + bot policy</span>
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
