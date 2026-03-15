import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function SectionCard(props: SectionCardProps) {
  return (
    <div className={`card${props.className ? ` ${props.className}` : ""}`}>
      {(props.title || props.subtitle || props.actions) ? (
        <div className="card-header">
          <div>
            {props.title ? <div className="card-title">{props.title}</div> : null}
            {props.subtitle ? <div className="card-subtitle">{props.subtitle}</div> : null}
          </div>
          {props.actions ? <div>{props.actions}</div> : null}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
