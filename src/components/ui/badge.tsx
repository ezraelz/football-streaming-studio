"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utility/utils";
import type { SessionState } from "@/lib/types/types";
import { useT } from "@/lib/i18n";

export type Tone = "neutral" | "live" | "success" | "warn" | "info" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  live: "bg-red-500/15 text-red-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warn: "bg-amber-500/15 text-amber-300",
  info: "bg-sky-500/15 text-sky-300",
  danger: "bg-red-500/15 text-red-300",
};

export function Badge({
  tone = "neutral", children, className,
}: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATE_META: Record<SessionState, { tone: Tone; pulse?: boolean }> = {
  configured: { tone: "info" },
  armed: { tone: "info" },
  live: { tone: "live", pulse: true },
  paused: { tone: "warn" },
  degraded: { tone: "warn" },
  stopped: { tone: "neutral" },
};

/** Session state pill. Red is reserved for "on air". */
export function StatePill({ state, className }: { state: SessionState; className?: string }) {
  const t = useT();
  const meta = STATE_META[state];
  return (
    <Badge tone={meta.tone} className={cn("gap-1.5 rounded-full px-2.5 py-1 uppercase tracking-wide", className)}>
      <span className="relative flex h-1.5 w-1.5">
        {meta.pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60 motion-reduce:animate-none" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {t(`state.${state}` as const)}
    </Badge>
  );
}
