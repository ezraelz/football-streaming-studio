"use client";
import { Incident } from "@/lib/api/client";

interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

const ICON_FOR: Record<string, string> = {
  goal: "⚽",
  penalty_goal: "⚽",
  own_goal: "🥅",
  penalty_missed: "❌",
  yellow_card: "🟨",
  second_yellow_card: "🟨🟥",
  red_card: "🟥",
  substitution: "⇄",
  var: "📺",
  period_start: "▶",
  period_end: "⏸",
};

// Only show these in the timeline — period markers are noise
const IMPORTANT_TYPES = new Set([
  "goal", "penalty_goal", "own_goal", "penalty_missed",
  "yellow_card", "second_yellow_card", "red_card",
  "substitution", "var",
]);

interface TimelineSceneProps {
  incidents: Incident[];
  home: TeamRef;
  away: TeamRef;
}

export function TimelineScene({ incidents, home, away }: TimelineSceneProps) {
  const shown = incidents.filter((i) =>
    IMPORTANT_TYPES.has(i.type) && !i.rescinded
  );

  if (shown.length === 0) {
    return (
      <div className="absolute bottom-[6%] left-[5%] right-[5%] rounded-xl border border-white/10 bg-black/75 p-4 backdrop-blur-md">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          Match Timeline
        </div>
        <p className="text-sm text-white/40">No incidents yet.</p>
      </div>
    );
  }

  const totalMinutes = 90;
  const maxMinute = Math.max(90, ...shown.map((i) => (i.minute ?? 0) + (i.added_time ?? 0)));

  return (
    <div className="absolute bottom-[6%] left-[5%] right-[5%] rounded-xl border border-white/10 bg-black/75 p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/60">
        <span>Match Timeline</span>
        <span className="text-white/40">
          {home.shortName} vs {away.shortName}
        </span>
      </div>

      {/* Horizontal timeline bar */}
      <div className="relative mb-6 mt-8">
        {/* Bar */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />

        {/* Incident markers */}
        {shown.map((inc) => {
          const minute = (inc.minute ?? 0) + (inc.added_time ?? 0);
          const pct = Math.min(100, (minute / maxMinute) * 100);
          const isHome = inc.team === "home";
          const color = isHome ? home.color : away.color;
          const icon = ICON_FOR[inc.type] ?? "•";

          return (
            <div
              key={inc.id}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pct}%` }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs"
                style={{
                  background: "#0a101c",
                  borderColor: color,
                  boxShadow: `0 0 12px ${color}55`,
                }}
                title={`${minute}' — ${inc.player_name ?? inc.type}`}
              >
                {icon}
              </div>
            </div>
          );
        })}

        {/* Minute scale */}
        <div className="absolute inset-x-0 -bottom-6 flex justify-between text-[11px] text-white/40">
          <span>0&apos;</span>
          <span>45&apos;</span>
          <span>90&apos;</span>
        </div>
      </div>

      {/* Recent incidents list (bottom) */}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {shown.slice(-6).reverse().map((inc) => {
          const minute = (inc.minute ?? 0) + (inc.added_time ?? 0);
          const isHome = inc.team === "home";
          const color = isHome ? home.color : away.color;
          const icon = ICON_FOR[inc.type] ?? "•";

          let label = inc.player_name ?? inc.type;
          if (inc.type === "substitution" && inc.related_name) {
            label = `${inc.player_name} → ${inc.related_name}`;
          } else if (inc.type === "var") {
            label = inc.player_name ?? "VAR decision";
          }

          return (
            <li key={inc.id} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 text-right tabular-nums text-white/50">
                {minute}&apos;
              </span>
              <span className="shrink-0">{icon}</span>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="truncate text-white/85">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}