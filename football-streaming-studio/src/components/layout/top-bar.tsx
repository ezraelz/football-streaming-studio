"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pause, Play, OctagonX } from "lucide-react";
import { useShowStore } from "@/lib/stores/show-store";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utility/utils";
import { useT } from "@/lib/i18n";
import { useFormat } from "@/lib/i18n/use-format";
import { useNow } from "@/lib/hooks/use-now";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { StatePill } from "@/components/ui/badge";

const FRESHNESS = {
  fresh: { key: "top.dataLive", dot: "bg-emerald-400", text: "text-zinc-300" },
  stale: { key: "top.dataStale", dot: "bg-amber-400", text: "text-amber-300" },
  disconnected: { key: "top.dataLost", dot: "bg-red-400", text: "text-red-300" },
} as const;

/**
 * Show controls. Only rendered while a show exists, so pages like Settings get the
 * full height. Emergency stop is always visible, visually separated from the routine
 * Pause/Resume, and needs a deliberate second click.
 */
export function TopBar() {
  const t = useT();
  const fmt = useFormat();
  const { session, snapshot, emergencyStop, setSession } = useShowStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useNow(5000); // keep "x s ago" fresh

  if (!session) return null;

  const stopped = session.state === "stopped";
  const fresh = snapshot ? FRESHNESS[snapshot.freshness] : null;

  const transition = async (target: "paused" | "live" | "stopped") => {
    setBusy(target);
    setError(null);
    try {
      const updated = await api.transition(session.id, target);
      setSession(updated);
      if (target === "stopped") emergencyStop();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("top.stateFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <header className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-800 bg-zinc-900/70 px-4 py-2 sm:px-6">
      {/* Context: what is on air */}
      <div className="flex min-w-0 items-center gap-3">
        <StatePill state={session.state} />
        {snapshot && (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate font-semibold text-zinc-100">
              {snapshot.home.shortName}
              <span className="mx-2 tabular-nums">{snapshot.score.home}–{snapshot.score.away}</span>
              {snapshot.away.shortName}
            </span>
          </div>
        )}
        <span className="hidden text-sm text-zinc-400 md:inline">
          {session.mode === "human" ? t("top.human") : t("top.automated")}
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {error && (
          <span role="alert" className="max-w-56 truncate text-xs text-red-300" title={error}>
            {error}
          </span>
        )}

        {fresh && snapshot && mounted && (
          <span className={cn("flex items-center gap-1.5 text-xs", fresh.text)}>
            <span className={cn("h-2 w-2 rounded-full", fresh.dot)} aria-hidden />
            {t(fresh.key)}
            <span className="hidden text-zinc-500 sm:inline">· {fmt.ago(snapshot.receivedAt)}</span>
          </span>
        )}

        {stopped ? (
          <Link href="/" className={buttonClass("primary", "md")}>
            {t("top.pickNext")}
          </Link>
        ) : (
          <>
            {session.state === "live" && (
              <Button onClick={() => transition("paused")} loading={busy === "paused"} disabled={busy !== null}>
                <Pause className="h-4 w-4" aria-hidden /> {t("top.pause")}
              </Button>
            )}
            {session.state === "paused" && (
              <Button variant="primary" onClick={() => transition("live")} loading={busy === "live"} disabled={busy !== null}>
                <Play className="h-4 w-4" aria-hidden /> {t("top.resume")}
              </Button>
            )}

            <span className="hidden h-6 w-px bg-zinc-700 sm:block" aria-hidden />

            <ConfirmButton
              variant="danger"
              icon={<OctagonX className="h-4 w-4" aria-hidden />}
              confirmLabel={t("top.confirmStop")}
              loading={busy === "stopped"}
              disabled={busy !== null && busy !== "stopped"}
              onConfirm={() => transition("stopped")}
            >
              {t("top.stop")}
            </ConfirmButton>
          </>
        )}
      </div>
    </header>
  );
}
