import type { BuildStatus, ReadinessStatus } from "@/lib/types";

export function StatCard({
  label,
  value,
  tone = "idle",
}: {
  label: string;
  value: string | number;
  tone?: "idle" | "success" | "danger" | "building";
}) {
  const dot = {
    idle: "bg-signal-idle",
    success: "bg-signal-success",
    danger: "bg-signal-danger",
    building: "bg-signal-building",
  }[tone];

  return (
    <div className="border border-border bg-panel px-4 py-3.5">
      <div className="flex items-center gap-2 text-[11px] text-text-muted uppercase tracking-wide">
        <span className={`w-1.5 h-1.5 ${dot}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-text mono">
        {value}
      </div>
    </div>
  );
}

const BUILD_STATUS_MAP: Record<
  BuildStatus,
  { color: string; label: string }
> = {
  queued: { color: "bg-signal-idle", label: "Queued" },
  running: { color: "bg-signal-building", label: "Running" },
  success: { color: "bg-signal-success", label: "Success" },
  failed: { color: "bg-signal-danger", label: "Failed" },
  cancelled: { color: "bg-signal-idle", label: "Cancelled" },
  blocked: { color: "bg-signal-warning", label: "Blocked" },
};

export function BuildStatusBadge({ status }: { status: BuildStatus }) {
  const info = BUILD_STATUS_MAP[status] ?? { color: "bg-signal-idle", label: status };
  const { color, label } = info;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function ReadinessBar({
  label,
  pct,
}: {
  label: string;
  pct: number;
}) {
  const status: ReadinessStatus =
    pct >= 90 ? "ready" : pct >= 60 ? "warning" : "blocked";
  const barColor = {
    ready: "bg-signal-success",
    warning: "bg-signal-building",
    blocked: "bg-signal-danger",
  }[status];

  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="mono text-text">{pct}%</span>
      </div>
      <div className="h-1.5 bg-panel-raised">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-border-strong bg-panel/50 px-6 py-14 text-center">
      <p className="text-[14px] text-text font-medium">{title}</p>
      <p className="text-[13px] text-text-muted mt-1 max-w-md mx-auto">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-signal-info text-[#0D0E12] hover:brightness-110",
    secondary:
      "bg-transparent border border-border-strong text-text hover:bg-panel-raised",
    danger: "bg-signal-danger text-[#0D0E12] hover:brightness-110",
  }[variant];

  return (
    <button
      {...props}
      className={`px-3 py-1.5 text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
