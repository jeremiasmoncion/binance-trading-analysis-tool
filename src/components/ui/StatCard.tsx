import type { ReactNode } from "react";
import { openHelp } from "../../lib/ui-events";
import { HelpCircleIcon } from "../Icons";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  detail?: ReactNode;
  tone?: "profit" | "risk" | "warning" | "accent" | "neutral";
  toneClass?: string;
  accentClass?: string;
  helpTitle?: string;
  helpBody?: string;
}

export function StatCard(props: StatCardProps) {
  const resolvedSub = props.sub ?? props.detail;
  const toneMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
    profit: "portfolio-positive",
    risk: "portfolio-negative",
    warning: "portfolio-warning",
    accent: "portfolio-accent",
    neutral: "",
  };
  const resolvedToneClass = props.toneClass ?? (props.tone ? toneMap[props.tone] : "");

  return (
    <div className={`stat-card${props.accentClass ? ` ${props.accentClass}` : ""}`}>
      <div className="stat-card-topline">
        <div className="label">{props.label}</div>
        {(props.helpTitle || typeof resolvedSub === "string" || props.helpBody) ? (
          <button
            type="button"
            className="card-help-button stat-help-button"
            aria-label={`Ayuda sobre ${props.helpTitle || props.label}`}
            onClick={() => openHelp({
              title: props.helpTitle || props.label,
              body: props.helpBody || (typeof resolvedSub === "string" ? resolvedSub : undefined),
            })}
          >
            <HelpCircleIcon />
          </button>
        ) : null}
      </div>
      <div className={`value${resolvedToneClass ? ` ${resolvedToneClass}` : ""}`}>{props.value}</div>
      {resolvedSub ? <div className="sub">{resolvedSub}</div> : null}
    </div>
  );
}
