import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { useStatsSelector } from "../data-platform/selectors";
import type { ExecutionCenterPayload, PortfolioPayload } from "../types";

interface StatsViewProps {
  portfolioData?: PortfolioPayload | null;
  executionCenter?: ExecutionCenterPayload | null;
}

export function StatsView(incomingProps: StatsViewProps) {
  const systemData = useStatsSelector();
  const portfolioData = incomingProps.portfolioData ?? systemData.portfolio;
  const executionCenter = incomingProps.executionCenter ?? systemData.execution;
  const portfolio = portfolioData?.portfolio;
  const recentOrders = executionCenter?.recentOrders || [];
  const candidates = executionCenter?.candidates || [];
  const closedTrades = recentOrders.filter((order) => order.status === "filled" || order.status === "closed").length;
  const openTrades = recentOrders.filter((order) => order.status === "open" || order.status === "pending").length;
  const strategies = candidates.length;

  return (
    <div id="statsView" className="view-panel active">
      <SectionCard
        title="Mi estadística"
        subtitle="Panel base para leer rendimiento, actividad y presión operativa de tu sistema."
        helpTitle="Mi estadística"
        helpBody="Esta página será la base del área analítica del usuario. Por ahora deja lista la navegación y una primera lectura resumida."
      />

      <div className="premium-overview-grid">
        <StatCard label="PnL total" value={portfolio ? `$${portfolio.totalPnl.toFixed(2)}` : "--"} tone={portfolio && portfolio.totalPnl >= 0 ? "profit" : "risk"} />
        <StatCard label="Trades cerrados" value={String(closedTrades)} detail="Historial operativo reciente" tone="accent" />
        <StatCard label="Trades abiertos" value={String(openTrades)} detail="Operaciones aún en curso" tone="neutral" />
        <StatCard label="Motores activos" value={String(strategies)} detail="Lecturas, bots o estrategias observadas" tone="accent" />
      </div>

      <div className="dashboard-main-grid">
        <SectionCard
          title="Área en construcción"
          subtitle="Aquí vamos a concentrar win rate, PnL por ventana, curvas de equity y rendimiento por estilo."
          helpTitle="Qué sigue aquí"
          helpBody="La navegación ya queda lista para que la plataforma empiece a sentirse como un dashboard de trading completo mientras seguimos afinando el contenido."
        >
          <div className="field-guide-list">
            <div className="field-guide-item">
              <span className="field-guide-label">Win rate y rachas</span>
              <span className="field-guide-note">Lectura rápida de aciertos, pérdidas y estabilidad operativa.</span>
            </div>
            <div className="field-guide-item">
              <span className="field-guide-label">Rendimiento por módulo</span>
              <span className="field-guide-note">Compararemos señales, ejecución demo y gobernanza learned.</span>
            </div>
            <div className="field-guide-item">
              <span className="field-guide-label">Ventanas temporales</span>
              <span className="field-guide-note">Short, recent y global para saber si el edge se está sosteniendo.</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
