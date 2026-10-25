"use client";
import { useEffect, useState } from "react";
import { useShowStore } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn, timeAgo } from "@/lib/utility/utils";
import { CircleStop, Radio, Pause, Play } from "lucide-react";

export function TopBar() {
  const { session, snapshot, emergencyStop, setSession } = useShowStore();
  const isLive = session?.state === "live";
  const freshness = snapshot?.freshness;

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  // Wraps a transition API call: applies to server + updates store.
  const transition = async (target: "paused" | "live" | "stopped") => {
    if (!session) return;
    setBusy(target);
    setError(null);
    try {
      const updated = await api.transition(session.id, target);
      setSession(updated);
      if (target === "stopped") emergencyStop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transition failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6">
      <div className="flex items-center gap-3">
        {session ? (
          <>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                isLive
                  ? "bg-red-600/20 text-red-300"
                  : "bg-zinc-700/40 text-zinc-300"
              )}
            >
              <Radio className="h-3 w-3" />
              {session.state.toUpperCase()}
            </span>
            <span className="text-sm text-zinc-400">
              {session.mode === "human" ? "Human presenter" : "Automated AI"}
            </span>
          </>
        ) : (
          <span className="text-sm text-zinc-500">No active session</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}

        {snapshot && mounted && (
          <span
            className={cn(
              "text-xs",
              freshness === "fresh" && "text-emerald-400",
              freshness === "stale" && "text-amber-400",
              freshness === "disconnected" && "text-red-400"
            )}
          >
            Data: {freshness} · {timeAgo(snapshot.receivedAt)}
          </span>
        )}

        {session && session.state === "live" && (
          <button
            onClick={() => transition("paused")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            <Pause className="h-3.5 w-3.5" />
            {busy === "paused" ? "Pausing…" : "Pause"}
          </button>
        )}

        {session && session.state === "paused" && (
          <button
            onClick={() => transition("live")}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            {busy === "live" ? "Resuming…" : "Resume"}
          </button>
        )}

        <button
          onClick={() => transition("stopped")}
          disabled={!session || session.state === "stopped" || busy !== null}
          className="flex items-center gap-1.5 rounded-md border border-red-800 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CircleStop className="h-3.5 w-3.5" />
          {busy === "stopped" ? "Stopping…" : "Emergency Stop"}
        </button>
      </div>
    </header>
  );
}