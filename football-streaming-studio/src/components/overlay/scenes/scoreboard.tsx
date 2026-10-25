import { MatchSnapshot } from "@/lib/types/types";
import { formatClock } from "@/lib/utility/utils";

export function ScoreboardScene({ snapshot }: { snapshot: MatchSnapshot }) {
  const stale = snapshot.freshness !== "fresh";
  return (
    <div className="flex items-start justify-center pt-[6%]">
      <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black/75 shadow-2xl backdrop-blur-md">
        <TeamBar team={snapshot.home} side="home" />
        <div className="flex min-w-[180px] flex-col items-center justify-center bg-black/40 px-6">
          <div className="text-5xl font-black tabular-nums text-white">
            {snapshot.score.home} – {snapshot.score.away}
          </div>
          <div className="mt-1 text-sm font-semibold uppercase tracking-wider text-emerald-400">
            {formatClock(snapshot.minute, snapshot.period)}
          </div>
        </div>
        <TeamBar team={snapshot.away} side="away" />
      </div>
      {stale && (
        <div className="ml-3 self-center rounded bg-amber-600/90 px-2 py-1 text-xs font-bold text-black">
          DATA DELAYED
        </div>
      )}
    </div>
  );
}

function TeamBar({ team, side }: { team: MatchSnapshot["home"]; side: "home" | "away" }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${side === "home" ? "" : "flex-row-reverse"}`}>
      <div className="h-10 w-10 rounded-full border-2 border-white/20" style={{ backgroundColor: team.color }} />
      <span className="text-2xl font-bold uppercase tracking-wide text-white">{team.shortName}</span>
    </div>
  );
}