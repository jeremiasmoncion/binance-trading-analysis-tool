import { SectionCard } from "../components/ui/SectionCard";

interface TemplatePlaceholderViewProps {
  title: string;
  subtitle: string;
}

export function TemplatePlaceholderView({ title, subtitle }: TemplatePlaceholderViewProps) {
  return (
    <div id="templatePlaceholderView" className="view-panel active">
      <section className="template-page-shell">
        <div className="template-page-header">
          <div className="template-page-header-copy">
            <span className="template-page-kicker">Template Flow</span>
            <h1 className="template-page-title">{title}</h1>
            <p className="template-page-subtitle">{subtitle}</p>
          </div>
        </div>

        <SectionCard
          title="Reserved Surface"
          subtitle="La navegación ya sigue el template exacto. Esta página queda reservada hasta que dirección habilite su contenido funcional."
          className="template-panel"
        >
          <div className="template-mini-grid">
            <div className="template-metric-card">
              <span>UX state</span>
              <strong>Aligned</strong>
              <small>La ruta ya existe en el flujo correcto.</small>
            </div>
            <div className="template-metric-card">
              <span>Data state</span>
              <strong>Deferred</strong>
              <small>Sin fetch ni runtime extra mientras no se abra esta fase.</small>
            </div>
            <div className="template-metric-card">
              <span>Layout state</span>
              <strong>Template-first</strong>
              <small>La arquitectura visible ya quedó preparada para crecer sin volver a la UX heredada.</small>
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
