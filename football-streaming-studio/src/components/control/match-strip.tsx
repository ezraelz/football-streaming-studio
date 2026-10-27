"use client";
import { AlertTriangle } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { cn, formatClock } from "@/lib/utility/utils";
import { Alert } from "@/components/ui/feedback";

/** Compact scoreboard that stays above the preview so the operator never loses the match. */
export function MatchStrip() {
  const { snapshot } = useShowStore();
  if (!snapshot) return null;

  return (
    <div className="flex flex-col gap-2">
      {snapshot.freshness !== "fresh" && (
        <Alert tone="warn">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Match data is {snapshot.freshness}. Time-sensitive commentary is suppressed until it recovers.
          </span>
        </Alert>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <Team name={snapshot.home.name} color={snapshot.home.color} />
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums tracking-tight text-zinc-50">
            {snapshot.score.home} – {snapshot.score.away}
          </div>
          <div className="text-xs font-medium text-emerald-400 tabular-nums">
            {formatClock(snapshot.minute, snapshot.period)}
          </div>
        </div>
        <Team name={snapshot.away.name} color={snapshot.away.color} align="right" />
      </div>
    </div>
  );
}

function Team({ name, color, align = "left" }: { name: string; color: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <span
        className="h-7 w-7 shrink-0 rounded-full border border-white/10"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate text-sm font-semibold text-zinc-100 sm:text-base">{name}</span>
    </div>
  );
}
