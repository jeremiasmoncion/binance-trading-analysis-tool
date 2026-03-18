import { ModuleTabs } from "../components/ModuleTabs";
import { SectionCard } from "../components/ui/SectionCard";

type ControlPanelTab = "control-overview" | "control-bots" | "control-history";

interface ControlPanelViewProps {
  currentTab: ControlPanelTab;
  onTabChange: (tab: ControlPanelTab) => void;
}

const COPY: Record<ControlPanelTab, { title: string; subtitle: string; bullets: string[] }> = {
  "control-overview": {
    title: "Resumen",
    subtitle: "Lectura ejecutiva del estado actual del sistema, sus módulos y sus automatizaciones.",
    bullets: [
      "Estado general de señales, IA y ejecución.",
      "Bloqueos o incidencias activas del sistema.",
      "Próximas acciones útiles de operación y control.",
    ],
  },
  "control-bots": {
    title: "Configuración de bots",
    subtitle: "Espacio para centralizar parámetros, estilo operativo y criterios de activación por bot.",
    bullets: [
      "Reglas de entrada, filtros y sensibilidad.",
      "Perfiles de riesgo y ventanas permitidas.",
      "Gobernanza learned y settings de ejecución.",
    ],
  },
  "control-history": {
    title: "Registro de historial",
    subtitle: "Timeline para acciones del sistema, cambios de configuración y decisiones importantes del motor.",
    bullets: [
      "Promociones, rollbacks y cambios learned.",
      "Eventos de ejecución y protección.",
      "Bitácora operativa para auditoría del sistema.",
    ],
  },
};

export function ControlPanelView({ currentTab, onTabChange }: ControlPanelViewProps) {
  const copy = COPY[currentTab];

  return (
    <div id="controlPanelView" className="view-panel active">
      <SectionCard
        title="Panel de control"
        subtitle="Centro de administración del motor operativo, sus bots y su historial de gobierno."
        helpTitle="Panel de control"
        helpBody="Esta área será el punto de control fino del sistema. Ya queda lista la estructura para que luego llenemos cada submódulo con contenido real."
      />

      <ModuleTabs
        items={[
          { key: "control-overview", label: "Resumen" },
          { key: "control-bots", label: "Configuración de bots" },
          { key: "control-history", label: "Registro de historial" },
        ]}
        activeKey={currentTab}
        onChange={(key) => onTabChange(key as ControlPanelTab)}
      />

      <SectionCard title={copy.title} subtitle={copy.subtitle}>
        <div className="field-guide-list">
          {copy.bullets.map((bullet) => (
            <div key={bullet} className="field-guide-item">
              <span className="field-guide-label">{copy.title}</span>
              <span className="field-guide-note">{bullet}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
