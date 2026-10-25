"use client";
import { useShowStore, ControllerState } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";

const STATES: ControllerState[] = [
  "configured", "armed", "live", "paused", "degraded", "stopped",
];

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

export function ControllerStateBar() {
  const { controllerState, setControllerState } = useShowStore();
  const next = ALLOWED[controllerState];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Show Controller
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold uppercase",
                controllerState === "live" && "bg-red-600/20 text-red-300",
                controllerState === "paused" && "bg-amber-600/20 text-amber-300",
                controllerState === "stopped" && "bg-zinc-700 text-zinc-300",
                controllerState === "degraded" && "bg-amber-900/40 text-amber-400",
                (controllerState === "armed" || controllerState === "configured") &&
                  "bg-blue-600/20 text-blue-300"
              )}
            >
              {controllerState}
            </span>
            <span className="text-xs text-zinc-400">{HINTS[controllerState]}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {next.map((s) => (
            <button
              key={s}
              onClick={() => setControllerState(s)}
              className={cn(
                "rounded border px-3 py-1.5 text-xs font-medium",
                s === "stopped"
                  ? "border-red-800 bg-red-950/40 text-red-300 hover:bg-red-900/60"
                  : s === "live"
                  ? "border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              → {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-1">
        {STATES.map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s === controllerState
                ? "bg-emerald-500"
                : STATES.indexOf(s) < STATES.indexOf(controllerState)
                ? "bg-zinc-600"
                : "bg-zinc-800"
            )}
            title={s}
          />
        ))}
      </div>
    </div>
  );
}