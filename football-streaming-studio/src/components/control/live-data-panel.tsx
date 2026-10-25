"use client";
import { useEffect, useState } from "react";
import { useShowStore } from "@/lib/stores/show-store";
import { cn, formatClock, timeAgo } from "@/lib/utility/utils";
import { AlertTriangle } from "lucide-react";

export function LiveDataPanel() {
  const { snapshot, events } = useShowStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!snapshot) return null;


  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      {snapshot.freshness !== "fresh" && (
        <div className="flex items-center gap-2 rounded border border-amber-700/40 bg-amber-950/30 px-2 py-1.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Data {snapshot.freshness} — time-sensitive commentary suppressed
        </div>
      )}

      <div className="flex items-center justify-between">
        <TeamBlock name={snapshot.home.shortName} color={snapshot.home.color} />
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">
            {snapshot.score.home} – {snapshot.score.away}
          </div>
          <div className="text-xs text-zinc-400">
            {formatClock(snapshot.minute, snapshot.period)}
          </div>
        </div>
        <TeamBlock name={snapshot.away.shortName} color={snapshot.away.color} align="right" />
      </div>

      <div className="text-[11px] text-zinc-500">
        Updated {timeAgo(snapshot.receivedAt)}
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Recent Events
        </div>
        <ul className="space-y-1.5">
          {events.slice(-4).reverse().map((e) => (
            <li key={e.eventId} className="flex items-center gap-2 text-sm">
              <span className="w-8 text-right text-xs text-zinc-500">{e.minute}'</span>
              <span className={cn("text-xs uppercase", e.type === "goal" ? "text-emerald-400" : "text-zinc-400")}>
                {e.type}
              </span>
              <span className="truncate">{e.playerName ?? "—"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Statistics
        </div>
        <ul className="space-y-1 text-xs">
          {Object.entries(snapshot.stats).map(([key, v]) => (
            <li key={key} className="flex justify-between text-zinc-300">
              <span className="tabular-nums">{v.home}</span>
              <span className="capitalize text-zinc-500">{key}</span>
              <span className="tabular-nums">{v.away}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TeamBlock({ name, color, align = "left" }: { name: string; color: string; align?: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      <div className="mb-1 h-6 w-6 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}