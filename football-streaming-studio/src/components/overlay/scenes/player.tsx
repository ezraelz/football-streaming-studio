"use client";
import { MatchEvent, MatchSnapshot } from "@/lib/types/types";
import { OverlayPanel } from "@/components/overlay/panel";
import { TeamCrest } from "@/components/overlay/crest";
import { useI18n, tOr } from "@/lib/i18n";

export function PlayerScene({ events, snapshot }: { events: MatchEvent[]; snapshot: MatchSnapshot }) {
  const { t } = useI18n();
  const latest = events.slice().reverse().find((e) => e.playerName);
  const team = latest ? (latest.teamId === snapshot.home.id ? snapshot.home : latest.teamId === snapshot.away.id ? snapshot.away : undefined) : undefined;
  return (
    <OverlayPanel title={t("ov.spotlight")} competition={snapshot.competition} className="bottom-[8%] left-0 w-[760px]">
      <div className="flex items-center gap-6">
        {team && <TeamCrest name={team.name} color={team.color} crestUrl={team.crestUrl} size={96} />}
        <div className="min-w-0">
          <div className="truncate text-[48px] font-black leading-tight text-white">{latest?.playerName ?? "—"}</div>
          {latest && (
            <div className="mt-1 flex items-center gap-3 text-[26px] font-semibold text-white/70">
              <span className="tabular-nums" style={{ color: team?.color }}>{latest.minute}&apos;</span>
              <span>{tOr(t, `event.${latest.type}`, latest.type)}</span>
              {team && <span className="truncate text-white/50">· {team.shortName}</span>}
            </div>
          )}
        </div>
      </div>
    </OverlayPanel>
  );
}
