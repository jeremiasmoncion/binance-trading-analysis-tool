import type { ReactNode } from "react";
import { openHelp } from "../../lib/ui-events";
import { HelpCircleIcon } from "../Icons";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
  helpTitle?: string;
  helpBody?: string;
  helpBullets?: string[];
  helpFooter?: string;
}

export function SectionCard(props: SectionCardProps) {
  const hasHelp = Boolean(props.helpTitle || props.helpBody || props.subtitle);

  return (
    <div className={`card${props.className ? ` ${props.className}` : ""}`}>
      {(props.title || props.subtitle || props.actions) ? (
        <div className="card-header">
          <div className="card-header-copy">
            {props.title ? <div className="card-title">{props.title}</div> : null}
            {props.subtitle ? <div className="card-subtitle">{props.subtitle}</div> : null}
          </div>
          <div className="card-header-actions">
            {hasHelp ? (
              <button
                type="button"
                className="card-help-button"
                aria-label={`Ayuda sobre ${props.helpTitle || props.title || "esta tarjeta"}`}
                onClick={() => openHelp({
                  title: props.helpTitle || props.title || "Ayuda rápida",
                  body: props.helpBody || props.subtitle,
                  bullets: props.helpBullets,
                  footer: props.helpFooter,
                })}
              >
                <HelpCircleIcon />
              </button>
            ) : null}
            {props.actions ? <div>{props.actions}</div> : null}
          </div>
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
