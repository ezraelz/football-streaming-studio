import { MatchSnapshot } from "@/lib/types/types";

export function StatsScene({ snapshot }: { snapshot: MatchSnapshot }) {
  return (
    <div className="absolute right-[5%] top-[15%] w-[420px] rounded-xl border border-white/10 bg-black/75 p-5 backdrop-blur-md">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">Match Stats</div>
      <div className="space-y-3">
        {Object.entries(snapshot.stats).map(([key, v]) => {
          const total = v.home + v.away || 1;
          const homePct = (v.home / total) * 100;
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs text-white/80">
                <span className="tabular-nums">{v.home}</span>
                <span className="capitalize text-white/60">{key}</span>
                <span className="tabular-nums">{v.away}</span>
              </div>
              <div className="flex h-1 overflow-hidden rounded-full bg-white/10">
                <div className="bg-emerald-500" style={{ width: `${homePct}%` }} />
                <div className="flex-1 bg-blue-500" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}