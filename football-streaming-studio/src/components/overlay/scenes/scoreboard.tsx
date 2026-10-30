"use client";
import { useEffect, useRef, useState } from "react";
import { MatchSnapshot } from "@/lib/types/types";
import { TeamCrest } from "@/components/overlay/crest";
import { LeagueBadge } from "@/components/overlay/league-badge";
import { useOverlayEnv } from "@/components/overlay/env";
import { useI18n } from "@/lib/i18n";
import { localTeamName } from "@/lib/branding/clubs";
import { accentOn, competitionLabel, themeFor, DEFAULT_THEME } from "@/lib/branding/leagues";

/** True for ~0.7s after `value` changes (not on first render) — used to pop the score on a goal. */
function useJustChanged(value: number) {
  const prev = useRef(value);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPop(true);
    const id = setTimeout(() => setPop(false), 800);
    return () => clearTimeout(id);
  }, [value]);
  return pop;
}

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
  const clock = isHT ? t("ov.ht") : isFT ? t("ov.ft") : upcoming ? t("ov.upcoming") : `${snapshot.minute}'`;
  const isLive = !isHT && !isFT && !upcoming;

  return (
    <div className="absolute inset-x-0 top-[2%] flex flex-col items-center">
      <div
        className="ov-drop-in flex items-stretch overflow-hidden rounded-[26px] border backdrop-blur-xl"
        style={{ background: "var(--ov-surface)", borderColor: "var(--ov-border)", boxShadow: "var(--ov-shadow)" }}
      >
        {/* League cap */}
        {hasLeague && (
          <div
            className="flex w-[190px] flex-col items-center justify-center gap-2 px-4 py-3 text-center"
            style={{ background: `linear-gradient(160deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <LeagueBadge theme={theme} size={62} />
            <span className="max-w-full truncate text-[17px] font-bold leading-tight text-[#fff]">
              {competitionLabel(snapshot.competition, lang) ?? theme.name}
            </span>
          </div>
        )}

        <Side team={snapshot.home} align="right" lang={lang} />

        {/* Score + clock */}
        <div className="flex min-w-[250px] flex-col items-center justify-center gap-1.5 px-7 py-3" style={{ background: "rgb(128 128 128 / 0.1)" }}>
          <div className="flex items-center gap-5 font-black tabular-nums text-white" style={{ fontSize: 84, lineHeight: 1 }}>
            <Digit value={snapshot.score.home} />
            <span className="text-white/35" style={{ fontSize: 52 }}>–</span>
            <Digit value={snapshot.score.away} />
          </div>
          <div className="flex items-center gap-2.5 rounded-full px-4 py-1 text-[22px] font-extrabold uppercase tracking-wider" style={{ background: isLive ? "rgb(220 38 38 / 0.18)" : "rgb(128 128 128 / 0.18)", color: isLive ? "#ef4444" : accent }}>
            {isLive && <span className="ov-pulse inline-block h-3 w-3 rounded-full bg-[#ef4444]" />}
            {isLive && <span>{t("ov.live")}</span>}
            <span className="tabular-nums text-white">{clock}</span>
          </div>
        </div>

        <Side team={snapshot.away} align="left" lang={lang} />
      </div>

      {stale && (
        <div className="ov-card-in mt-3 rounded-full bg-amber-500 px-5 py-1.5 text-[20px] font-extrabold text-black shadow-lg">
          {t("ov.delayed")}
        </div>
      )}
    </div>
  );
}

function Digit({ value }: { value: number }) {
  const pop = useJustChanged(value);
  return <span className={`inline-block min-w-[1ch] text-center ${pop ? "ov-score-pop" : ""}`}>{value}</span>;
}

function Side({ team, align, lang }: { team: MatchSnapshot["home"]; align: "left" | "right"; lang: "en" | "am" }) {
  const name = localTeamName(team.name, lang);
  const crest = <TeamCrest name={team.name} color={team.color} crestUrl={team.crestUrl} size={92} />;
  return (
    <div className="relative flex w-[400px] items-center gap-5 px-7 py-3">
      {align === "right" ? (
        <>
          <span className="min-w-0 flex-1 truncate text-right text-[38px] font-extrabold leading-tight text-white" title={name}>{name}</span>
          {crest}
        </>
      ) : (
        <>
          {crest}
          <span className="min-w-0 flex-1 truncate text-left text-[38px] font-extrabold leading-tight text-white" title={name}>{name}</span>
        </>
      )}
      <span className="absolute inset-x-0 bottom-0 h-[6px]" style={{ background: team.color }} />
    </div>
  );
}
