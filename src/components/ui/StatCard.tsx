import type { ReactNode } from "react";
import { openHelp } from "../../lib/ui-events";
import { HelpCircleIcon } from "../Icons";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  toneClass?: string;
  accentClass?: string;
  helpTitle?: string;
  helpBody?: string;
}

export function StatCard(props: StatCardProps) {
  return (
    <div className={`stat-card${props.accentClass ? ` ${props.accentClass}` : ""}`}>
      <div className="stat-card-topline">
        <div className="label">{props.label}</div>
        {(props.helpTitle || typeof props.sub === "string" || props.helpBody) ? (
          <button
            type="button"
            className="card-help-button stat-help-button"
            aria-label={`Ayuda sobre ${props.helpTitle || props.label}`}
            onClick={() => openHelp({
              title: props.helpTitle || props.label,
              body: props.helpBody || (typeof props.sub === "string" ? props.sub : undefined),
            })}
          >
            <HelpCircleIcon />
          </button>
        ) : null}
      </div>
      <div className={`value${props.toneClass ? ` ${props.toneClass}` : ""}`}>{props.value}</div>
      {props.sub ? <div className="sub">{props.sub}</div> : null}
    </div>
  );
}
