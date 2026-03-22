interface StartupOverlayProps {
  title: string;
  detail: string;
}

export function StartupOverlay(props: StartupOverlayProps) {
  return (
    <div className="startup-overlay" role="status" aria-live="polite" data-testid="startup-overlay">
      <div className="startup-overlay-card" data-testid="startup-overlay-card">
        <div className="startup-overlay-mark" aria-hidden="true">
          <span className="startup-overlay-spinner startup-overlay-spinner-primary" />
          <span className="startup-overlay-spinner startup-overlay-spinner-secondary" />
        </div>
        <div className="startup-overlay-copy">
          <strong data-testid="startup-overlay-title">{props.title}</strong>
          <span data-testid="startup-overlay-detail">{props.detail}</span>
        </div>
      </div>
    </div>
  );
}
