"use client";
import type { ReactNode } from "react";
import { Incident } from "@/lib/api/client";
import { OverlayPanel } from "@/components/overlay/panel";
import { useI18n } from "@/lib/i18n";
import { localTeamName } from "@/lib/branding/clubs";

interface TeamRef { id: string; name: string; shortName: string; color: string }

// Only show these in the timeline — period markers are noise
const IMPORTANT_TYPES = new Set([
  "goal", "penalty_goal", "own_goal", "penalty_missed",
  "yellow_card", "second_yellow_card", "red_card",
  "substitution", "var",
]);

/** Broadcast-style marker glyphs (inline SVG so they render identically in every OBS build). */
function Glyph({ type, size = 30 }: { type: string; size?: number }) {
  const s = { width: size, height: size };
  switch (type) {
    case "goal":
    case "penalty_goal":
    case "own_goal":
      return (
        <svg viewBox="0 0 24 24" {...s}>
          <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#0a101c" strokeWidth="1.5" />
          <path d="M12 6.5 16.4 9.7 14.7 14.8H9.3L7.6 9.7Z" fill="#0a101c" />
          {type === "own_goal" && <circle cx="12" cy="12" r="10.5" fill="none" stroke="#ef4444" strokeWidth="3" />}
        </svg>
      );
    case "penalty_missed":
      return (
        <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10.5" fill="#0a101c" stroke="#ef4444" strokeWidth="2" /><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" /></svg>
      );
    case "yellow_card":
      return <svg viewBox="0 0 24 24" {...s}><rect x="6" y="2.5" width="12" height="19" rx="2" fill="#facc15" stroke="#0a101c" strokeWidth="1.2" /></svg>;
    case "red_card":
      return <svg viewBox="0 0 24 24" {...s}><rect x="6" y="2.5" width="12" height="19" rx="2" fill="#dc2626" stroke="#0a101c" strokeWidth="1.2" /></svg>;
    case "second_yellow_card":
      return (
        <svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="11" height="17" rx="2" fill="#facc15" stroke="#0a101c" strokeWidth="1.2" /><rect x="10" y="5" width="11" height="17" rx="2" fill="#dc2626" stroke="#0a101c" strokeWidth="1.2" /></svg>
      );
    case "substitution":
      return (
        <svg viewBox="0 0 24 24" {...s} fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 20V5M3.5 9 7 5l3.5 4" stroke="#34d399" /><path d="M17 4v15M13.5 15 17 19l3.5-4" stroke="#f87171" />
        </svg>
      );
    case "var":
      return (
        <svg viewBox="0 0 24 24" {...s}><rect x="2.5" y="4" width="19" height="13" rx="2" fill="#0a101c" stroke="#fff" strokeWidth="1.6" /><text x="12" y="13.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">VAR</text><path d="M8 20h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
      );
    default:
      return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4" fill="#fff" /></svg>;
  }
}

interface TimelineSceneProps {
  incidents: Incident[];
  home: TeamRef;
  away: TeamRef;
  competition?: string;
}

export function TimelineScene({ incidents, home, away, competition }: TimelineSceneProps) {
  const { t, lang } = useI18n();
  const shown = incidents.filter((i) => IMPORTANT_TYPES.has(i.type) && !i.rescinded);

  const frame = (children: ReactNode) => (
    <OverlayPanel title={t("ov.timeline")} competition={competition} className="bottom-[3%] left-0 right-0">
      {children}
    </OverlayPanel>
  );

  if (shown.length === 0) {
    return frame(<p className="py-6 text-center text-[30px] font-semibold text-white/50">{t("ov.noIncidents")}</p>);
  }

  const minuteOf = (i: Incident) => (i.minute ?? 0) + (i.added_time ?? 0);
  const maxMinute = Math.max(90, ...shown.map(minuteOf));
  const pct = (m: number) => `${Math.min(100, (m / maxMinute) * 100)}%`;
  const colorOf = (i: Incident) => (i.team === "home" ? home.color : away.color);
  const ticks = [0, 15, 30, 45, 60, 75, 90].filter((m) => m <= maxMinute);

  const label = (i: Incident) => {
    if (i.type === "substitution" && i.related_name) return `${i.player_name} → ${i.related_name}`;
    if (i.type === "var") return i.player_name ?? t("ov.varDecision");
    return i.player_name ?? i.type;
  };

  return frame(
    <div className="flex flex-col gap-5">
      {/* team legend (home above the line, away below) */}
      <div className="flex items-center justify-between text-[26px] font-extrabold uppercase text-white">
        <span className="flex items-center gap-3"><i className="inline-block h-5 w-5 -skew-x-12" style={{ background: home.color }} />{localTeamName(home.name, lang)}</span>
        <span className="flex items-center gap-3">{localTeamName(away.name, lang)}<i className="inline-block h-5 w-5 -skew-x-12" style={{ background: away.color }} /></span>
      </div>

      {/* two-lane timeline: home events above the line, away events below */}
      <div className="relative mx-5" style={{ height: 150 }}>
        <div className="absolute inset-x-0 top-1/2 h-[10px] -translate-y-1/2" style={{ background: "linear-gradient(90deg, rgb(128 128 128 / .35), rgb(128 128 128 / .2))" }} />
        {[45, 90].filter((m) => m <= maxMinute).map((m) => (
          <div key={m} className="absolute top-1/2 h-[46px] w-[4px] -translate-y-1/2 bg-white/40" style={{ left: pct(m) }} />
        ))}
        {shown.map((i) => {
          const home_ = i.team === "home";
          return (
            <div key={i.id} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: pct(minuteOf(i)), [home_ ? "bottom" : "top"]: "calc(50% + 8px)" }}>
              {!home_ && <span className="h-4 w-[3px]" style={{ background: colorOf(i) }} />}
              <span className="rounded-sm px-2 py-0.5 text-[20px] font-black tabular-nums" style={{ background: colorOf(i), color: "#fff" }}>{minuteOf(i)}&apos;</span>
              <span className="my-1"><Glyph type={i.type} /></span>
              {home_ && <span className="h-3 w-[3px]" style={{ background: colorOf(i) }} />}
            </div>
          );
        })}
      </div>
      <div className="relative mx-5 flex justify-between text-[20px] font-bold tabular-nums text-white/50">
        {ticks.map((m) => <span key={m}>{m}&apos;</span>)}
      </div>

      {/* latest incidents */}
      <ul className="grid grid-cols-2 gap-x-10 gap-y-2 border-t border-white/10 pt-4">
        {shown.slice(-6).reverse().map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-[26px]">
            <span className="w-[62px] shrink-0 text-right font-black tabular-nums text-white/60">{minuteOf(i)}&apos;</span>
            <Glyph type={i.type} size={26} />
            <i className="inline-block h-4 w-[6px] shrink-0 -skew-x-12" style={{ background: colorOf(i) }} />
            <span className="truncate font-semibold text-white/90">{label(i)}</span>
          </li>
        ))}
      </ul>
    </div>,
  );
}
