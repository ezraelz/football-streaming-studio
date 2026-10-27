"use client";
import { useShowStore } from "@/lib/stores/show-store";
import { cn } from "@/lib/utility/utils";
import { SectionLabel } from "@/components/ui/panel";

/** Events + stats. The score and freshness now live in <MatchStrip /> above the preview. */
export function LiveDataPanel() {
  const { snapshot, events } = useShowStore();
  if (!snapshot) return null;

  const recent = events.slice(-6).reverse();
  const stats = Object.entries(snapshot.stats);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>Recent events</SectionLabel>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing has happened yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800/80">
            {recent.map((e) => (
              <li key={e.eventId} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-9 text-right text-xs tabular-nums text-zinc-400">{e.minute}&apos;</span>
                <span
                  className={cn(
                    "w-24 shrink-0 text-xs font-medium uppercase tracking-wide",
                    e.type === "goal" ? "text-emerald-400" : e.type === "card" ? "text-amber-300" : "text-zinc-400",
                  )}
                >
                  {e.type}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-200">{e.playerName ?? "—"}</span>
                {e.status !== "confirmed" && (
                  <span className="text-xs text-amber-300">{e.status}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionLabel>Statistics</SectionLabel>
        <ul className="space-y-3">
          {stats.map(([key, v]) => {
            const total = v.home + v.away || 1;
            return (
              <li key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium tabular-nums text-zinc-100">{v.home}</span>
                  <span className="text-xs capitalize text-zinc-400">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium tabular-nums text-zinc-100">{v.away}</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  <div className="rounded-l-full bg-emerald-500/80" style={{ width: `${(v.home / total) * 100}%` }} />
                  <div className="flex-1 rounded-r-full bg-zinc-600" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
