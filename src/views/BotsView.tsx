import { useMemo, useState } from "react";
import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { openHelp } from "../lib/ui-events";

type BotsWorkspaceTab = "all-bots" | "performance" | "how-it-works";

export function BotsView() {
  const [activeTab, setActiveTab] = useState<BotsWorkspaceTab>("all-bots");
  const feedReadModel = useSignalsBotsReadModel();

  const readModel = useMemo(() => {
    return {
      cards: feedReadModel.botCards,
    };
  }, [feedReadModel.botCards]);

  const activeBots = readModel.cards.filter((bot) => bot.status === "active").length;

  return (
    <div id="botsWorkspaceView" className="view-panel active">
      <section className="workspace-shell">
        <div className="workspace-hero workspace-hero-bots">
          <div className="workspace-hero-copy">
            <span className="workspace-kicker">Bots</span>
            <h1>Lista clara de bots, no una pared de configuración</h1>
            <p>
              Esta nueva página toma el patrón del template: primero ves tus bots como entidades claras, con estado,
              rendimiento simple y una entrada obvia para crear uno nuevo.
            </p>
          </div>
          <div className="workspace-hero-actions">
            <button
              type="button"
              className="premium-action-button is-primary"
              onClick={() => openHelp({
                title: "Crear bot",
                body: "La siguiente fase abrirá un flujo nuevo de creación de bots con modo simple primero y configuración avanzada después.",
              })}
            >
              Crear bot
            </button>
            <button type="button" className="premium-action-button is-ghost">Ver rendimiento</button>
          </div>
        </div>

        <div className="workspace-stats-grid">
          <StatCard label="Bots activos" value={String(activeBots)} sub={`${readModel.cards.length} listados en total`} accentClass="accent-blue" />
          <StatCard label="Observando" value={String(readModel.cards.filter((bot) => bot.automationMode === "observe").length)} sub="Bots que solo leen y filtran" accentClass="accent-amber" />
          <StatCard label="En demo/real" value={String(readModel.cards.filter((bot) => bot.executionEnvironment !== "paper").length)} sub="Más cerca de operación" accentClass="accent-emerald" />
          <StatCard label="Bot aislado IA" value={String(readModel.cards.filter((bot) => bot.aiPolicy.unrestrictedModeEnabled || bot.aiPolicy.isolationScope === "isolated").length)} sub="Soportado, pero aislado" accentClass="accent-green" />
        </div>

        <ModuleTabs
          items={[
            { key: "all-bots", label: "Todos los bots" },
            { key: "performance", label: "Performance" },
            { key: "how-it-works", label: "Como funciona" },
          ]}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as BotsWorkspaceTab)}
        />

        {activeTab === "all-bots" ? (
          <SectionCard
            title="Todos los bots"
            subtitle="Vista principal de usuario final: cards simples con estado, capital y actividad."
            className="workspace-panel"
          >
            <div className="bot-workspace-grid">
              {readModel.cards.map((bot) => (
                <article key={bot.id} className="bot-workspace-card">
                  <div className="bot-workspace-card-top">
                    <div>
                      <h3>{bot.name}</h3>
                      <p>{bot.executionEnvironment.toUpperCase()} · {bot.automationMode.toUpperCase()}</p>
                    </div>
                    <span className={`bot-workspace-status ${bot.status === "active" ? "is-active" : "is-muted"}`}>
                      {bot.status === "active" ? "Activo" : bot.status}
                    </span>
                  </div>

                  <div className="bot-workspace-metrics">
                    <div className="bot-workspace-metric">
                      <span>Capital</span>
                      <strong>${bot.capital.allocatedUsd.toLocaleString("en-US")}</strong>
                    </div>
                    <div className="bot-workspace-metric">
                      <span>Señales aptas</span>
                      <strong>{bot.accepted}</strong>
                    </div>
                    <div className="bot-workspace-metric">
                      <span>Bloqueadas</span>
                      <strong>{bot.blocked}</strong>
                    </div>
                    <div className="bot-workspace-metric">
                      <span>Estilo</span>
                    <strong>{bot.stylePolicy.allowedStyles[0] || "Mixto"}</strong>
                  </div>
                  </div>

                  <div className="bot-workspace-summary">
                    <strong>{bot.description}</strong>
                    <p>
                      {bot.aiPolicy.unrestrictedModeEnabled
                        ? "Bot experimental con IA libre, aislado del resto del sistema."
                        : "Bot alineado a políticas y pensado para lectura clara de usuario."}
                    </p>
                    <p>
                      {bot.aiPolicy.unrestrictedModeEnabled
                        ? "Este perfil conserva aislamiento contable para no interferir con otros bots."
                        : `Opera en ${bot.executionEnvironment} y ${bot.automationMode}.`}
                    </p>
                  </div>

                  <div className="bot-workspace-actions">
                    <button type="button" className="premium-action-button is-ghost">Ver detalle</button>
                    <button type="button" className="premium-action-button">Configurar</button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "performance" ? (
          <SectionCard
            title="Performance resumido"
            subtitle="Primero traducimos la complejidad a eficiencia y actividad, no a telemetría agresiva."
            className="workspace-panel"
          >
            <div className="workspace-mini-metrics">
              {readModel.cards.map((bot) => (
                <MetricTile
                  key={`perf-${bot.id}`}
                  label={bot.name}
                  value={`${Math.max(bot.accepted - bot.blocked, 0)} limpias`}
                  note={`${bot.accepted} señales aptas · ${bot.blocked} bloqueadas por reglas`}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {activeTab === "how-it-works" ? (
          <SectionCard
            title="Cómo funciona"
            subtitle="Explicación traducida para usuario final, dejando la parte muy técnica para admin más adelante."
            className="workspace-panel"
          >
            <div className="workspace-explainer-grid">
              <MetricTile label="1. El sistema detecta" value="Señales" note="Primero se priorizan oportunidades antes de repartirlas." />
              <MetricTile label="2. El bot filtra" value="Reglas" note="Cada bot decide qué señales le encajan según su perfil." />
              <MetricTile label="3. El usuario actúa" value="Control" note="La interfaz muestra lo mínimo útil para decidir." />
            </div>
          </SectionCard>
        ) : null}
      </section>
    </div>
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
