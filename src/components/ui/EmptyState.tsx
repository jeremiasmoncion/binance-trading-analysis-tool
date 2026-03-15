interface EmptyStateProps {
  message: string;
  className?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return <div className={props.className || "portfolio-empty"}>{props.message}</div>;
}
