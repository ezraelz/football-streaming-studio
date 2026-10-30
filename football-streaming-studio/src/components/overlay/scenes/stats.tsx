"use client";
import { MatchSnapshot } from "@/lib/types/types";
import { OverlayPanel } from "@/components/overlay/panel";
import { useI18n, tOr, prettify } from "@/lib/i18n";
import { localTeamName } from "@/lib/branding/clubs";

export function StatsScene({ snapshot }: { snapshot: MatchSnapshot }) {
  const { t, lang } = useI18n();
  const entries = Object.entries(snapshot.stats).slice(0, 8);
  return (
    <OverlayPanel title={t("ov.matchStats")} competition={snapshot.competition} className="right-0 top-[20%] w-[640px]">
      <div className="mb-4 flex items-center justify-between text-[24px] font-extrabold text-white">
        <span className="flex min-w-0 items-center gap-2"><i className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ background: snapshot.home.color }} /><span className="truncate">{localTeamName(snapshot.home.name, lang)}</span></span>
        <span className="flex min-w-0 items-center gap-2"><span className="truncate">{localTeamName(snapshot.away.name, lang)}</span><i className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ background: snapshot.away.color }} /></span>
      </div>
      <div className="space-y-5">
        {entries.map(([key, v]) => {
          const total = v.home + v.away || 1;
          const homePct = (v.home / total) * 100;
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline justify-between text-white">
                <span className="text-[30px] font-black tabular-nums">{v.home}</span>
                <span className="text-[21px] font-semibold text-white/65">{tOr(t, `stat.${key}`, prettify(key))}</span>
                <span className="text-[30px] font-black tabular-nums">{v.away}</span>
              </div>
              <div className="flex h-[10px] gap-1 overflow-hidden rounded-full">
                <div className="rounded-l-full" style={{ width: `${homePct}%`, background: snapshot.home.color }} />
                <div className="flex-1 rounded-r-full" style={{ background: snapshot.away.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </OverlayPanel>
  );
}
