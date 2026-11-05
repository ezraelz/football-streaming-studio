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
  const { tone, stage } = useOverlayEnv();
  const theme = themeFor(snapshot.competition);
  const accent = accentOn(theme, tone);
  const stale = snapshot.freshness !== "fresh";
  const hasLeague = theme.id !== DEFAULT_THEME.id;

  const isHT = snapshot.period === "HT" || snapshot.status === "ht";
  const isFT = snapshot.period === "FT" || snapshot.status === "ft";
  const upcoming = snapshot.status === "scheduled" && !isHT && !isFT;
  const isLive = !isHT && !isFT && !upcoming;
  const kickoffTime = snapshot.kickoff
    ? new Date(snapshot.kickoff).toLocaleTimeString(lang === "am" ? "am-ET" : "en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;
  // Before kick-off: show the time (or UPCOMING) — never LIVE and never a running clock.
  const clock = isHT ? t("ov.ht") : isFT ? t("ov.ft") : upcoming ? (kickoffTime ?? t("ov.upcoming")) : `${snapshot.minute}'`;

  if (stage.compactBug) {
    return (
      <CompactBug
        snapshot={snapshot} lang={lang} t={t} theme={theme} accent={accent} hasLeague={hasLeague}
        upcoming={upcoming} isLive={isLive} clock={clock} stale={stale && !upcoming}
      />
    );
  }

  return (
    <div className="absolute inset-x-0 top-[1.5%] flex flex-col items-center">
      <div className="ov-drop-in bc-drop relative flex items-stretch" style={{ filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.5))", height: 116 }}>
        {/* League tab */}
        {hasLeague && (
          <div
            className="bc-slant relative -mr-3 flex shrink-0 items-center"
            style={{ width: 250, paddingLeft: 22, paddingRight: 26, background: `linear-gradient(100deg, ${theme.secondary}, ${theme.primary})`, borderBottom: `6px solid ${theme.accent}` }}
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
          {upcoming ? (
            <span className="font-black uppercase tracking-[0.2em] text-white/80" style={{ fontSize: 60, lineHeight: 1 }}>{t("card.vsShort")}</span>
          ) : (
            <>
              <Digit value={snapshot.score.home} />
              <span className="font-black text-white/40" style={{ fontSize: 56, lineHeight: 1 }}>–</span>
              <Digit value={snapshot.score.away} />
            </>
          )}
        </div>

        <TeamBlock team={snapshot.away} lang={lang} side="away" />

        {/* Clock tab */}
        <div
          className="bc-slant relative -ml-3 flex shrink-0 items-center justify-center"
          style={{ width: upcoming ? 200 : 168, background: isLive ? "#d90f1e" : accent, borderBottom: "6px solid rgb(0 0 0 / 0.35)" }}
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

      {stale && !upcoming && (
        <div className="ov-card-in mt-3 bg-amber-400 px-6 py-1.5 text-[22px] font-extrabold uppercase tracking-wider text-black" style={{ clipPath: "polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)" }}>
          {t("ov.delayed")}
        </div>
      )}
    </div>
  );
}

function Digit({ value, size = 88 }: { value: number; size?: number }) {
  const pop = useJustChanged(value);
  return (
    <span className={`inline-block min-w-[1ch] text-center font-black tabular-nums text-white ${pop ? "ov-score-pop" : ""}`} style={{ fontSize: size, lineHeight: 1 }}>
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
      className="bc-slant relative flex shrink-0 items-center"
      style={{ width: 390, background: `linear-gradient(${side === "home" ? "100deg" : "260deg"}, ${team.color}, color-mix(in oklab, ${team.color} 72%, black))`, borderBottom: "6px solid rgb(0 0 0 / 0.3)" }}
    >
      <span
        className={`block w-full truncate px-8 font-extrabold uppercase leading-none ${side === "home" ? "text-right" : "text-left"}`}
        style={{ color: ink, letterSpacing: "0.02em", fontSize: name.length > 18 ? 30 : name.length > 13 ? 36 : 44 }}
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


/**
 * Two-row score bug for narrow stages (9:16 and 1:1):
 *   [league tab ......................... clock tab]
 *   [home crest]   2 – 1   [away crest]
 *   [ HOME NAME ]          [ AWAY NAME ]
 */
function CompactBug({
  snapshot, lang, t, theme, accent, hasLeague, upcoming, isLive, clock, stale,
}: {
  snapshot: MatchSnapshot; lang: "en" | "am"; t: (k: never) => string; theme: ReturnType<typeof themeFor>; accent: string;
  hasLeague: boolean; upcoming: boolean; isLive: boolean; clock: string; stale: boolean;
}) {
  const tt = t as unknown as (k: string) => string;
  return (
    <div className="absolute inset-x-0 top-0 flex flex-col items-stretch">
      <div className="ov-drop-in bc-drop flex flex-col" style={{ filter: "drop-shadow(0 12px 22px rgb(0 0 0 / 0.5))" }}>
        {/* tabs */}
        <div className="flex items-stretch justify-between">
          {hasLeague ? (
            <div className="bc-slant -ml-3 flex items-center" style={{ height: 56, paddingLeft: 30, paddingRight: 28, background: `linear-gradient(100deg, ${theme.secondary}, ${theme.primary})`, borderBottom: `5px solid ${theme.accent}` }}>
              <span className="flex items-center gap-3 text-[26px] font-extrabold uppercase tracking-wide text-[#fff]">
                <LeagueBadge theme={theme} size={38} />
                <span className="max-w-[420px] truncate">{competitionLabel(snapshot.competition, lang) ?? theme.name}</span>
              </span>
            </div>
          ) : <span />}
          <div className="bc-slant -mr-3 flex items-center justify-center" style={{ height: 56, minWidth: 150, paddingLeft: 26, paddingRight: 30, background: isLive ? "#d90f1e" : accent, borderBottom: "5px solid rgb(0 0 0 / 0.35)" }}>
            <span className="flex items-center gap-2 text-[30px] font-black tabular-nums" style={{ color: isLive ? "#fff" : inkOn(accent) }}>
              {isLive && <span className="ov-pulse inline-block h-3 w-3 rounded-full bg-white" />}
              {isLive && <span className="text-[20px] uppercase tracking-[0.16em]">{tt("ov.live")}</span>}
              {clock}
            </span>
          </div>
        </div>

        {/* crests + score */}
        <div className="relative flex items-center justify-between" style={{ background: "var(--ov-surface-solid)", padding: "14px 22px", borderBottom: `5px solid ${accent}` }}>
          <CompactTeam team={snapshot.home} lang={lang} />
          <div className="flex items-center gap-4 text-center">
            {upcoming ? (
              <span className="font-black uppercase tracking-[0.2em] text-white/80" style={{ fontSize: 56 }}>{tt("card.vsShort")}</span>
            ) : (
              <>
                <Digit value={snapshot.score.home} size={104} />
                <span className="font-black text-white/40" style={{ fontSize: 60 }}>–</span>
                <Digit value={snapshot.score.away} size={104} />
              </>
            )}
          </div>
          <CompactTeam team={snapshot.away} lang={lang} />
        </div>
      </div>

      {stale && (
        <div className="ov-card-in mx-auto mt-3 bg-amber-400 px-6 py-1.5 text-[22px] font-extrabold uppercase tracking-wider text-black" style={{ clipPath: "polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)" }}>
          {tt("ov.delayed")}
        </div>
      )}
    </div>
  );
}

function CompactTeam({ team, lang }: { team: MatchSnapshot["home"]; lang: "en" | "am" }) {
  const name = localTeamName(team.name, lang);
  return (
    <div className="flex w-[260px] flex-col items-center gap-2">
      <TeamCrest name={team.name} color={team.color} crestUrl={team.crestUrl} size={110} />
      <div
        className="w-full truncate px-3 py-1 text-center font-extrabold uppercase leading-tight"
        style={{ background: team.color, color: inkOn(team.color), fontSize: name.length > 14 ? 26 : 32, clipPath: "polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)" }}
        title={name}
      >
        {name}
      </div>
    </div>
  );
}
