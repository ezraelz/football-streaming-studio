import { MatchEvent } from "@/lib/types/types";

export function TimelineScene({ events }: { events: MatchEvent[] }) {
  return (
    <div className="absolute bottom-[6%] left-[5%] right-[5%] rounded-xl border border-white/10 bg-black/75 p-4 backdrop-blur-md">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
        Match Timeline
      </div>
      <div className="relative h-2 rounded-full bg-white/10">
        {events.map((e) => (
          <div
            key={e.eventId}
            className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full"
            style={{
              left: `${Math.min(100, (e.minute / 90) * 100)}%`,
              backgroundColor: e.type === "goal" ? "#10b981" : "#f59e0b",
            }}
            title={`${e.minute}' ${e.type} ${e.playerName ?? ""}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/40">
        <span>0'</span><span>45'</span><span>90'</span>
      </div>
    </div>
  );
}