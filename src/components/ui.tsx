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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
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
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon && <span className="text-sm opacity-80">{icon}</span>}
        {label}
      </div>
      <div className="text-[23px] font-semibold leading-none tracking-tight" style={{ color: valueColor }}>
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
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
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && (
            <span className="flex items-center gap-2 text-sm font-semibold">
              {icon && <span className="opacity-80">{icon}</span>}
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
