"use client";
import { Fixture } from "@/lib/types/types";
import { cn } from "@/lib/utility/utils";
import { Check, X, Play } from "lucide-react";

export function FixtureCard({
  fixture, onStart, busy = false,
}: {
  fixture: Fixture;
  onStart: () => void;
  busy?: boolean;
}) {
  const { home, away, coverage, status, kickoff } = fixture;

  // Use UTC so server and client render the same kickoff label.
  const kickoffLabel = new Date(kickoff).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{fixture.competition}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-medium",
            status === "live" && "bg-red-600/20 text-red-300",
            status === "ft" && "bg-zinc-700/50 text-zinc-300",
            status === "scheduled" && "bg-blue-600/20 text-blue-300"
          )}
        >
          {status.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <TeamBadge name={home.name} short={home.shortName} color={home.color} />
        <span className="text-sm text-zinc-500 tabular-nums">{kickoffLabel}</span>
        <TeamBadge name={away.name} short={away.shortName} color={away.color} align="right" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CoveragePill label="Lineups" ok={coverage.lineups} />
        <CoveragePill label="Events" ok={coverage.events} />
        <CoveragePill label="Stats" ok={coverage.stats} />
        <CoveragePill label="Coords" ok={coverage.coordinates} />
      </div>

      <button
        onClick={onStart}
        disabled={busy}
        className="mt-1 flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
      >
        <Play className="h-4 w-4" />
        {busy ? "Starting…" : "Start Show"}
      </button>
    </div>
  );
}

function TeamBadge({
  name, short, color, align = "left",
}: { name: string; short: string; color: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      <div
        className="mb-1 h-8 w-8 rounded-full"
        style={{ backgroundColor: color, border: "1px solid #333" }}
      />
      <span className="text-sm font-medium">{short}</span>
      <span className="text-xs text-zinc-500">{name}</span>
    </div>
  );
}

function CoveragePill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        ok
          ? "bg-emerald-600/15 text-emerald-300"
          : "bg-zinc-700/40 text-zinc-500"
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}