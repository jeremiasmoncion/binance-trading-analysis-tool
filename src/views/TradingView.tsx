import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useStatsSelector } from "../data-platform/selectors";
import type { ExecutionCenterPayload, SignalSnapshot } from "../types";

interface TradingViewProps {
  executionCenter?: ExecutionCenterPayload | null;
  signals?: SignalSnapshot[];
}

export function TradingView(incomingProps: TradingViewProps) {
  const systemData = useStatsSelector();
  const executionCenter = incomingProps.executionCenter ?? systemData.execution;
  const signals = incomingProps.signals ?? systemData.signalMemory;
  const pendingSignals = signals.filter((signal) => signal.outcome_status === "pending").length;
  const candidateOrders = executionCenter?.candidates?.length || 0;
  const recentOrders = executionCenter?.recentOrders || [];
  const openOrders = recentOrders.filter((order) => order.status === "open" || order.status === "pending").length;
  const closedOrders = recentOrders.filter((order) => order.status === "filled" || order.status === "closed").length;

  return (
    <div id="tradingView" className="view-panel active">
      <SectionCard
        title="Trading"
        subtitle="Zona operativa para concentrar las decisiones que sí merecen pasar del análisis a la ejecución."
        helpTitle="Trading"
        helpBody="Esta vista será el puente entre señales, edge y ejecución. Por ahora deja lista la estructura del módulo y una lectura operativa inicial."
      />

      <div className="premium-overview-grid">
        <StatCard label="Señales pendientes" value={String(pendingSignals)} detail="Ideas aún abiertas en memoria" tone="accent" />
        <StatCard label="Candidatas demo" value={String(candidateOrders)} detail="Operaciones listas para evaluar" tone="accent" />
        <StatCard label="Órdenes abiertas" value={String(openOrders)} detail="Seguimiento en tiempo real" tone="neutral" />
        <StatCard label="Órdenes cerradas" value={String(closedOrders)} detail="Base histórica para aprendizaje" tone="neutral" />
      </div>

      <SectionCard
        title="Mesa operativa"
        subtitle="Aquí iremos llevando la selección final de entradas, filtros por convicción y monitoreo rápido del execution center."
        helpTitle="Mesa operativa"
        helpBody="La intención aquí es construir un espacio más tipo desk: menos ruido, más foco en lo que realmente está listo para ejecutarse."
      >
        <div className="field-guide-list">
          <div className="field-guide-item">
            <span className="field-guide-label">Filtro de entrada</span>
            <span className="field-guide-note">Solo setups con edge suficiente y contexto limpio.</span>
          </div>
          <div className="field-guide-item">
            <span className="field-guide-label">Prioridad de ejecución</span>
            <span className="field-guide-note">Primero las operaciones con mejor convicción learned y mejor RR efectivo.</span>
          </div>
          <div className="field-guide-item">
            <span className="field-guide-label">Trazabilidad</span>
            <span className="field-guide-note">Cada movimiento deberá quedar claro en el execution center y en memoria.</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
