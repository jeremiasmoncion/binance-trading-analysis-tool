import { useEffect, useMemo, useState } from "react";
import {
  closeHelp,
  onHelp,
  onHelpClose,
  onLoadingStart,
  onLoadingStop,
  onToast,
  type UiHelpPayload,
  type UiLoadingPayload,
  type UiToastPayload,
} from "../../lib/ui-events";
import {
  CheckCircleIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  WarningTriangleIcon,
  XCircleIcon,
} from "../Icons";

interface ToastRecord extends UiToastPayload {
  id: string;
}

export function SystemUiHost() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [help, setHelp] = useState<UiHelpPayload | null>(null);
  const [loaders, setLoaders] = useState<UiLoadingPayload[]>([]);

  useEffect(() => onToast((payload) => {
    const id = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...payload, id }]);

    const duration = payload.durationMs ?? 4200;
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, duration);
  }), []);

  useEffect(() => onHelp((payload) => setHelp(payload)), []);
  useEffect(() => onHelpClose(() => setHelp(null)), []);

  useEffect(() => onLoadingStart((payload) => {
    setLoaders((current) => {
      const exists = current.some((item) => item.id === payload.id);
      return exists ? current.map((item) => (item.id === payload.id ? payload : item)) : [...current, payload];
    });
  }), []);

  useEffect(() => onLoadingStop(({ id }) => {
    setLoaders((current) => current.filter((item) => item.id !== id));
  }), []);

  useEffect(() => {
    if (!help) return undefined;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeHelp();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [help]);

  const primaryLoader = loadingsHead(loaders);

  return (
    <>
      <div className="system-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} />
        ))}
      </div>

      {primaryLoader ? (
        <div className="system-loading-dock" role="status" aria-live="polite">
          <div className="system-loading-icon">
            <div className="system-loading-logo-mark" aria-hidden="true">
              <span className="system-loading-logo-ring" />
              <span className="system-loading-logo-core">C</span>
            </div>
          </div>
          <div className="system-loading-copy">
            <strong>{primaryLoader.label}</strong>
            <span>{primaryLoader.detail || "El sistema está trabajando en segundo plano."}</span>
          </div>
          {loaders.length > 1 ? <div className="system-loading-count">+{loaders.length - 1}</div> : null}
        </div>
      ) : null}

      {help ? (
        <div className="system-help-overlay" role="presentation" onClick={() => closeHelp()}>
          <div className="system-help-modal" role="dialog" aria-modal="true" aria-label={help.title} onClick={(event) => event.stopPropagation()}>
            <div className="system-help-head">
              <div className="system-help-icon">
                <HelpCircleIcon />
              </div>
              <div>
                <div className="system-help-kicker">Ayuda rápida</div>
                <h3>{help.title}</h3>
              </div>
              <button type="button" className="system-help-close" onClick={() => closeHelp()} aria-label="Cerrar ayuda">
                ×
              </button>
            </div>
            {help.body ? <p className="system-help-body">{help.body}</p> : null}
            {help.bullets?.length ? (
              <ul className="system-help-list">
                {help.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {help.footer ? <div className="system-help-footer">{help.footer}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function loadingsHead(loaders: UiLoadingPayload[]) {
  return loaders.length ? loaders[loaders.length - 1] : null;
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const icon = useMemo(() => {
    switch (toast.tone) {
      case "success":
        return <CheckCircleIcon />;
      case "error":
        return <XCircleIcon />;
      case "warning":
        return <WarningTriangleIcon />;
      default:
        return <InfoCircleIcon />;
    }
  }, [toast.tone]);

  return (
    <div className={`system-toast-card tone-${toast.tone}`}>
      <div className="system-toast-icon">{icon}</div>
      <div className="system-toast-copy">
        <strong>{toast.title}</strong>
        {toast.message ? <span>{toast.message}</span> : null}
      </div>
      <button type="button" className="system-toast-dismiss" onClick={onDismiss} aria-label="Cerrar alerta">
        ×
      </button>
    </div>
  );
}
