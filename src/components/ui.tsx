import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: string;
  valueColor?: string;
}) {
  return (
    <div className="metric-card">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-[22px] font-semibold" style={{ color: valueColor }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <span className="flex items-center gap-2 text-sm font-medium">
              {icon && <span>{icon}</span>}
              {title}
            </span>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const BADGE_CLASS: Record<string, string> = {
  green: "badge badge-green",
  amber: "badge badge-amber",
  red: "badge badge-red",
  blue: "badge badge-blue",
};

export function Badge({
  color,
  children,
}: {
  color: "green" | "amber" | "red" | "blue";
  children: ReactNode;
}) {
  return <span className={BADGE_CLASS[color]}>{children}</span>;
}

export function TrendUp({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--c-primary)" }}>↑ {children}</span>;
}

export function TrendDown({ children }: { children: ReactNode }) {
  return <span style={{ color: "var(--c-danger)" }}>↓ {children}</span>;
}
