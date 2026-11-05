import type { ReactNode } from "react";
import { cn } from "@/lib/utility/utils";

export function Panel({
  title, icon, actions, children, className, bodyClassName, tone = "default",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "danger" | "warn";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-zinc-900/60",
        tone === "default" && "border-zinc-800",
        tone === "danger" && "border-red-900/60 bg-red-950/20",
        tone === "warn" && "border-amber-800/50 bg-amber-950/20",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-zinc-800/80 border-l-4 border-l-emerald-600 px-4 py-2.5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-zinc-100">
            {icon && <span className="text-emerald-500" aria-hidden>{icon}</span>}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small uppercase label for sub-groups inside a panel. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("mb-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-zinc-400", className)}>
      {children}
    </h3>
  );
}
