"use client";
import { useEffect, useRef, useState } from "react";
import { MatchSnapshot } from "@/lib/types/types";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { useOverlayEnv } from "@/components/overlay/env";
import { useI18n } from "@/lib/i18n";
import { localTeamName, luminance } from "@/lib/branding/clubs";
import { accentOn, competitionLabel, themeFor, DEFAULT_THEME } from "@/lib/branding/leagues";

/** True for ~0.8s after `value` changes (not on first render) — pops the score on a goal. */
function useJustChanged(value: number) {
  const prev = useRef(value);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPop(true);
    const id = setTimeout(() => setPop(false), 900);
    return () => clearTimeout(id);
  }, [value]);
  return pop;
}

const inkOn = (bg: string) => (luminance(bg) > 150 ? "#0a101c" : "#ffffff");

/**
 * The score "bug": the always-on-screen graphic of a football broadcast.
 *   [league] [HOME name ◢ crest] [ 2 – 1 ] [crest ◣ AWAY name] [clock]
 * Team names sit on solid team-colour slants, like TV match graphics.
 */
export function ScoreboardScene({ snapshot }: { snapshot: MatchSnapshot }) {
  const { t, lang } = useI18n();
  const { tone } = useOverlayEnv();
  const theme = themeFor(snapshot.competition);
  const accent = accentOn(theme, tone);
  const stale = snapshot.freshness !== "fresh";
  const hasLeague = theme.id !== DEFAULT_THEME.id;

  const isHT = snapshot.period === "HT" || snapshot.status === "ht";
  const isFT = snapshot.period === "FT" || snapshot.status === "ft";
  const upcoming = snapshot.status === "scheduled" && !isHT && !isFT;
  const isLive = !isHT && !isFT && !upcoming;
  const clock = isHT ? t("ov.ht") : isFT ? t("ov.ft") : upcoming ? t("ov.upcoming") : `${snapshot.minute}'`;

  return (
    <div className="absolute inset-x-0 top-[1.5%] flex flex-col items-center">
      <div className="ov-drop-in bc-drop relative flex items-stretch" style={{ filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.5))", height: 116 }}>
        {/* League tab */}
        {hasLeague && (
          <div
            className="bc-slant relative -mr-3 flex shrink-0 items-center"
            style={{ width: 268, paddingLeft: 26, paddingRight: 30, background: `linear-gradient(100deg, ${theme.secondary}, ${theme.primary})`, borderBottom: `6px solid ${theme.accent}` }}
          >
            <span className="flex items-center gap-3">
              <LeagueBadge theme={theme} size={64} />
              <span className="line-clamp-2 text-[21px] font-extrabold uppercase leading-[1.1] tracking-wide text-[#fff]">
                {competitionLabel(snapshot.competition, lang) ?? theme.name}
              </span>
            </span>
          </div>
        )}

        <TeamBlock team={snapshot.home} lang={lang} side="home" />

        {/* Score box */}
        <div
          className="relative z-10 flex min-w-[250px] items-center justify-center gap-5 px-7"
          style={{ background: "var(--ov-surface-solid)", borderBottom: `6px solid ${accent}` }}
        >
          <Digit value={snapshot.score.home} />
          <span className="font-black text-white/40" style={{ fontSize: 56, lineHeight: 1 }}>–</span>
          <Digit value={snapshot.score.away} />
        </div>

        <TeamBlock team={snapshot.away} lang={lang} side="away" />

        {/* Clock tab */}
        <div
          className="bc-slant relative -ml-3 flex shrink-0 items-center justify-center"
          style={{ width: 168, background: isLive ? "#d90f1e" : accent, borderBottom: "6px solid rgb(0 0 0 / 0.35)" }}
        >
          <span className="flex flex-col items-center leading-none" style={{ color: isLive ? "#fff" : inkOn(accent) }}>
            {isLive && (
              <span className="mb-1 flex items-center gap-2 text-[20px] font-extrabold uppercase tracking-[0.18em]">
                <span className="ov-pulse inline-block h-3 w-3 rounded-full bg-white" />{t("ov.live")}
              </span>
            )}
            <span className="text-[50px] font-black tabular-nums">{clock}</span>
          </span>
        </div>
      </div>

      {stale && (
        <div className="ov-card-in mt-3 bg-amber-400 px-6 py-1.5 text-[22px] font-extrabold uppercase tracking-wider text-black" style={{ clipPath: "polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)" }}>
          {t("ov.delayed")}
        </div>
      )}
    </div>
  );
}

function Digit({ value }: { value: number }) {
  const pop = useJustChanged(value);
  return (
    <span className={`inline-block min-w-[1ch] text-center font-black tabular-nums text-white ${pop ? "ov-score-pop" : ""}`} style={{ fontSize: 88, lineHeight: 1 }}>
      {value}
    </span>
  );
}

function TeamBlock({ team, lang, side }: { team: MatchSnapshot["home"]; lang: "en" | "am"; side: "home" | "away" }) {
  const name = localTeamName(team.name, lang);
  const ink = inkOn(team.color);
  const crest = (
    <div className="relative z-20 flex shrink-0 items-center justify-center rounded-full" style={{ width: 96, height: 96, margin: "0 -6px", background: "rgb(255 255 255 / 0.96)", boxShadow: "0 6px 14px rgb(0 0 0 / 0.4)" }}>
      <TeamCrest name={team.name} color={team.color} crestUrl={team.crestUrl} size={78} flat />
    </div>
  );
  const label = (
    <div
      className="bc-slant relative flex min-w-0 flex-1 items-center"
      style={{ width: 360, background: `linear-gradient(${side === "home" ? "100deg" : "260deg"}, ${team.color}, color-mix(in oklab, ${team.color} 72%, black))`, borderBottom: "6px solid rgb(0 0 0 / 0.3)" }}
    >
      <span
        className={`block w-full truncate px-9 text-[44px] font-extrabold uppercase leading-none ${side === "home" ? "text-right" : "text-left"}`}
        style={{ color: ink, letterSpacing: "0.02em" }}
        title={name}
      >
        {name}
      </span>
    </div>
  );
  return (
    <div className="relative flex items-stretch">
      {side === "home" ? <>{label}{crest}</> : <>{crest}{label}</>}
    </div>
  );
}
