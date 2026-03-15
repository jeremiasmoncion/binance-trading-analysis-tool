import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  toneClass?: string;
  accentClass?: string;
}

export function StatCard(props: StatCardProps) {
  return (
    <div className={`stat-card${props.accentClass ? ` ${props.accentClass}` : ""}`}>
      <div className="label">{props.label}</div>
      <div className={`value${props.toneClass ? ` ${props.toneClass}` : ""}`}>{props.value}</div>
      {props.sub ? <div className="sub">{props.sub}</div> : null}
    </div>
  );
}
