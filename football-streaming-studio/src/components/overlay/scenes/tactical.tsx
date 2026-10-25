import { MatchSnapshot } from "@/lib/types/types";

export function TacticalScene({ snapshot }: { snapshot: MatchSnapshot }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-[60%] rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-md">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          Tactical View · {snapshot.home.shortName} vs {snapshot.away.shortName}
        </div>
        <svg viewBox="0 0 680 420" className="w-full">
          <rect x="0" y="0" width="680" height="420" fill="#0a3d1e" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <line x1="340" y1="0" x2="340" y2="420" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <circle cx="340" cy="210" r="60" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <rect x="0" y="120" width="80" height="180" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          <rect x="600" y="120" width="80" height="180" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
          {/* placeholder players — replace with real lineup positions */}
          {Array.from({ length: 10 }).map((_, i) => (
            <circle key={i} cx={100 + (i % 5) * 120} cy={i < 5 ? 150 : 270} r="10" fill={i < 5 ? "#10b981" : "#3b82f6"} />
          ))}
        </svg>
        <div className="mt-2 text-[10px] text-white/40">
          Formation data illustrative. Real coordinates only shown when the licensed feed provides them.
        </div>
      </div>
    </div>
  );
}