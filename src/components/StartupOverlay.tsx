interface StartupOverlayProps {
  title: string;
  detail: string;
}

export function StartupOverlay(props: StartupOverlayProps) {
  return (
    <div className="startup-overlay" role="status" aria-live="polite">
      <div className="startup-overlay-card">
        <div className="startup-overlay-mark">C</div>
        <div className="startup-overlay-copy">
          <strong>{props.title}</strong>
          <span>{props.detail}</span>
        </div>
      </div>
    </div>
  );
}
