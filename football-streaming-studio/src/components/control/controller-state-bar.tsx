"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useShowStore, type ControllerState } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { StatePill } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";

const STATES: ControllerState[] = ["configured", "armed", "live", "paused", "degraded", "stopped"];

// allowed transitions per §10.2
const ALLOWED: Record<ControllerState, ControllerState[]> = {
  configured: ["armed"],
  armed: ["live", "configured"],
  live: ["paused", "stopped", "degraded"],
  paused: ["live", "stopped"],
  degraded: ["live", "paused", "stopped"],
  stopped: ["configured"],
};

const HINTS: Record<ControllerState, string> = {
  configured: "Preview only. No public speech.",
  armed: "Ready — no public output until started.",
  live: "Processing events and selected scenes.",
  paused: "Safe overlay; no new speech queued.",
  degraded: "Stale data — time-sensitive claims suppressed.",
  stopped: "Emergency stop engaged. Queued commentary cancelled.",
};

const ACTION_LABEL: Record<ControllerState, string> = {
  configured: "Reset to configured",
  armed: "Arm",
  live: "Go live",
  paused: "Pause",
  degraded: "Mark degraded",
  stopped: "Stop show",
};

/**
 * Reads the *real* session state (the same one the top bar shows) and drives it through the
 * API. Previously this bar kept its own local state, so it could disagree with the top bar.
 */
export function ControllerStateBar() {
  const { session, setSession, emergencyStop } = useShowStore();
  const [busy, setBusy] = useState<ControllerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  const current = session.state as ControllerState;
  const next = ALLOWED[current] ?? [];

  const go = async (target: ControllerState) => {
    setBusy(target);
    setError(null);
    try {
      const updated = await api.transition(session.id, target);
      setSession(updated);
      if (target === "stopped") emergencyStop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "State change failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Show controller</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatePill state={current} />
            <span className="text-sm text-zinc-300">{HINTS[current]}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {next.map((s) =>
            s === "stopped" ? (
              <ConfirmButton
                key={s}
                confirmLabel="Click again to stop"
                loading={busy === s}
                disabled={busy !== null}
                onConfirm={() => go(s)}
              >
                {ACTION_LABEL[s]}
              </ConfirmButton>
            ) : (
              <Button
                key={s}
                variant={s === "live" ? "primary" : "secondary"}
                onClick={() => go(s)}
                loading={busy === s}
                disabled={busy !== null}
              >
                {ACTION_LABEL[s]} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ),
          )}
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Show lifecycle">
        {STATES.map((s, i) => {
          const idx = STATES.indexOf(current);
          return (
            <li key={s} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  s === current ? "bg-emerald-500" : i < idx ? "bg-zinc-600" : "bg-zinc-800",
                )}
              />
              <span
                className={cn("hidden text-xs capitalize sm:block", s === current ? "font-medium text-zinc-100" : "text-zinc-500")}
                aria-current={s === current ? "step" : undefined}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>

      {error && <Alert tone="error" className="mt-3" onDismiss={() => setError(null)}>{error}</Alert>}
    </div>
  );
}
