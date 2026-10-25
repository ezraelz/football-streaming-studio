import { MatchEvent } from "@/lib/types/types";

export function PlayerScene({ events }: { events: MatchEvent[] }) {
  const latest = events.slice().reverse().find((e) => e.playerName);
  return (
    <div className="absolute bottom-[10%] left-[5%] w-[420px] rounded-xl border border-white/10 bg-black/75 p-5 backdrop-blur-md">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">Player Spotlight</div>
      <div className="text-2xl font-bold text-white">{latest?.playerName ?? "—"}</div>
      {latest && (
        <div className="mt-1 text-sm text-white/60">
          {latest.minute}' · {latest.type.toUpperCase()}
        </div>
      )}
    </div>
  );
}