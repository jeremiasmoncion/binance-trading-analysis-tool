import type { CSSProperties, ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  toneClass?: string;
  style?: CSSProperties;
}

export function StatCard(props: StatCardProps) {
  return (
    <div className="stat-card" style={props.style}>
      <div className="label">{props.label}</div>
      <div className={`value${props.toneClass ? ` ${props.toneClass}` : ""}`}>{props.value}</div>
      {props.sub ? <div className="sub">{props.sub}</div> : null}
    </div>
  );
}
