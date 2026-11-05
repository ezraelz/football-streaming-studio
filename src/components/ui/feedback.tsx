import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utility/utils";

type AlertTone = "error" | "warn" | "success" | "info";

const META: Record<AlertTone, { cls: string; Icon: typeof Info }> = {
  error: { cls: "border-red-900/60 bg-red-950/30 text-red-200", Icon: AlertCircle },
  warn: { cls: "border-amber-800/50 bg-amber-950/25 text-amber-200", Icon: AlertTriangle },
  success: { cls: "border-emerald-800/50 bg-emerald-950/30 text-emerald-200", Icon: CheckCircle2 },
  info: { cls: "border-sky-800/50 bg-sky-950/30 text-sky-200", Icon: Info },
};

export function Alert({
  tone = "info", children, onDismiss, className,
}: { tone?: AlertTone; children: ReactNode; onDismiss?: () => void; className?: string }) {
  const { cls, Icon } = META[tone];
  return (
    <div
      role={tone === "error" || tone === "warn" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", cls, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <div className="mb-3 text-zinc-500" aria-hidden>{icon}</div>}
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-800/60 motion-reduce:animate-none", className)} />;
}
